/**
 * IdeaLab · Boda (archivo aparte dentro del proyecto «IdeaLab servidor»)
 *
 * Lee la lista de invitados del Excel «INVITADOS BODA» SIN CAMBIAR NADA de la «Hoja 1»
 * (ni pases, ni invitaciones, ni confirmaciones): la invitación web sigue funcionando igual.
 * Lo de la app (proveedores, abonos, mesas y acomodación) se guarda en pestañas NUEVAS
 * de ese mismo Excel: «APP PROVEEDORES», «APP ABONOS», «APP MESAS», «APP ACOMODACION» y «APP SALON»
 * (entrada, mesa de los novios, pasabocas, torta, cofre… del plano del salón).
 *
 * Única excepción, y solo si la pides con el botón «Pasar mesas al Excel»: escribe el
 * número de mesa en la columna MESA de la Hoja 1 (ninguna otra columna).
 *
 * Para activarlo, en Código.gs, dentro de doPost, junto a  case 'hoja': ...  agrega:
 *     case 'boda': return boda_(body);
 */
const BODA_HOJA_ID = '1qbXbe_euYS6Z1f8fEboG7LYqUix7uq9nXN5zWfxQg08';
const BODA_INVITADOS = 'Hoja 1';
const BODA_TABS = {
  proveedores: ['APP PROVEEDORES', ['ID', 'Proveedor', 'Categoría', 'Costo total', 'Fecha límite', 'Contacto', 'Nota', 'Actualizado']],
  abonos: ['APP ABONOS', ['ID', 'Proveedor ID', 'Fecha', 'Valor', 'Nota', 'Registrado por', 'Registrado']],
  sobrecostos: ['APP SOBRECOSTOS', ['ID', 'Proveedor ID', 'Fecha', 'Valor', 'Descripción', 'Registrado por', 'Registrado']],
  mesas: ['APP MESAS', ['Mesa', 'Nombre', 'Capacidad', 'X plano', 'Y plano', 'Forma', 'Girada']],
  salon: ['APP SALON', ['ID', 'Tipo', 'Nombre', 'X plano', 'Y plano', 'Girado']],
  acomodacion: ['APP ACOMODACION', ['Clave', 'Invitado', 'Invitación', 'Mesa']],
};

function boda_(body) {
  const libro = SpreadsheetApp.openById(BODA_HOJA_ID);
  const quien = String(body.quien || '').slice(0, 60);
  const ahora = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
  switch (body.op || 'leer') {
    case 'leer': break;
    case 'proveedor_guardar': {
      const p = body.proveedor || {};
      const nombre = String(p.proveedor || '').trim();
      if (!nombre) throw new Error('Falta el nombre del proveedor');
      const fila = [p.id || bodaId_(), nombre, String(p.categoria || 'Otro'), bodaNum_(p.costo), String(p.fecha_limite || ''), String(p.contacto || ''), String(p.nota || ''), ahora];
      bodaUpsert_(libro, 'proveedores', fila);
      break;
    }
    case 'proveedor_eliminar': {
      bodaBorrar_(libro, 'proveedores', (r) => r[0] === String(body.id));
      bodaBorrar_(libro, 'abonos', (r) => r[1] === String(body.id));
      bodaBorrar_(libro, 'sobrecostos', (r) => r[1] === String(body.id));
      break;
    }
    case 'abono_guardar': {
      const a = body.abono || {};
      if (!a.proveedor_id) throw new Error('Falta el proveedor del abono');
      if (!(bodaNum_(a.valor) > 0)) throw new Error('El valor del abono debe ser mayor a 0');
      bodaUpsert_(libro, 'abonos', [a.id || bodaId_(), String(a.proveedor_id), String(a.fecha || ahora.slice(0, 10)), bodaNum_(a.valor), String(a.nota || ''), quien, ahora]);
      break;
    }
    case 'sobrecosto_guardar': {
      const a = body.sobrecosto || {};
      if (!a.proveedor_id) throw new Error('Falta el proveedor del sobrecosto');
      if (!(bodaNum_(a.valor) > 0)) throw new Error('El valor del sobrecosto debe ser mayor a 0');
      if (!String(a.descripcion || '').trim()) throw new Error('Escribe de qué fue el sobrecosto');
      bodaUpsert_(libro, 'sobrecostos', [a.id || bodaId_(), String(a.proveedor_id), String(a.fecha || ahora.slice(0, 10)), bodaNum_(a.valor), String(a.descripcion).trim(), quien, ahora]);
      break;
    }
    case 'sobrecosto_eliminar': bodaBorrar_(libro, 'sobrecostos', (r) => r[0] === String(body.id)); break;
    case 'abono_eliminar': bodaBorrar_(libro, 'abonos', (r) => r[0] === String(body.id)); break;
    case 'mesas_guardar': {
      const pos = (v) => (v === null || v === undefined || v === '' || !isFinite(Number(v)) ? '' : Math.max(0, Math.min(1000, Math.round(Number(v)))));
      const formas = ['redonda', 'cuadrada', 'rectangular'];
      const mesas = (body.mesas || []).map((m) => [String(m.id), String(m.nombre || ''), Number(m.capacidad) || 0, pos(m.x), pos(m.y), formas.indexOf(m.forma) >= 0 ? m.forma : 'redonda', m.girada ? 'SI' : '']);
      const salon = (body.salon || []).map((e) => [String(e.id), String(e.tipo || 'otro'), String(e.nombre || ''), pos(e.x), pos(e.y), e.girado ? 'SI' : '']);
      const aco = (body.acomodacion || []).map((x) => [String(x.clave), String(x.nombre || ''), String(x.invitacion || ''), String(x.mesa || '')]);
      bodaReemplazar_(libro, 'mesas', mesas);
      bodaReemplazar_(libro, 'acomodacion', aco);
      if (Array.isArray(body.salon)) bodaReemplazar_(libro, 'salon', salon);
      break;
    }
    case 'mesas_a_excel': bodaMesasAExcel_(libro); break;
    default: throw new Error('Acción de boda desconocida: ' + body.op);
  }
  return bodaLeer_(libro);
}

function bodaLeer_(libro) {
  const tab = (k) => { const v = bodaHoja_(libro, k).getDataRange().getDisplayValues(); return v.slice(1).filter((r) => String(r[0]).trim()); };
  const proveedores = tab('proveedores').map((r) => ({ id: r[0], proveedor: r[1], categoria: r[2], costo: bodaNum_(r[3]), fecha_limite: bodaFecha_(r[4]), contacto: r[5], nota: r[6], actualizado: r[7] }));
  const abonos = tab('abonos').map((r) => ({ id: r[0], proveedor_id: r[1], fecha: bodaFecha_(r[2]), valor: bodaNum_(r[3]), nota: r[4], quien: r[5], registrado: r[6] }));
  const sobrecostos = tab('sobrecostos').map((r) => ({ id: r[0], proveedor_id: r[1], fecha: bodaFecha_(r[2]), valor: bodaNum_(r[3]), descripcion: r[4], quien: r[5], registrado: r[6] }));
  const xy = (v) => (String(v || '').trim() === '' ? null : bodaNum_(v));
  const mesas = tab('mesas').map((r) => ({ id: r[0], nombre: r[1], capacidad: bodaNum_(r[2]), x: xy(r[3]), y: xy(r[4]), forma: r[5] || 'redonda', girada: r[6] === 'SI' }));
  const salon = tab('salon').map((r) => ({ id: r[0], tipo: r[1], nombre: r[2], x: xy(r[3]), y: xy(r[4]), girado: r[5] === 'SI' }));
  const acomodacion = tab('acomodacion').map((r) => ({ clave: r[0], nombre: r[1], invitacion: r[2], mesa: r[3] }));
  return { proveedores, abonos, sobrecostos, mesas, acomodacion, salon, invitados: bodaInvitados_(libro) };
}

/** Lee la Hoja 1 tal cual (solo lectura). Cada bloque empieza con una fila de títulos: N | INVITADOS… | GRUPO | INVITACIÓN | CONFIRMACIÓN… | MESA … */
function bodaInvitados_(libro) {
  const h = libro.getSheetByName(BODA_INVITADOS);
  if (!h) return [];
  const v = h.getDataRange().getDisplayValues();
  const out = [];
  let cols = null, virtual = false;
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  v.forEach((r, i) => {
    const up = r.map(norm);
    const iNom = up.findIndex((c) => c.indexOf('INVITADOS') === 0);
    if (iNom >= 0) {
      virtual = up[iNom].indexOf('VIDEOLLAMADA') >= 0;
      cols = { nom: iNom, n: up.indexOf('N'), grupo: up.indexOf('GRUPO'), inv: up.indexOf('INVITACION'), conf: up.findIndex((c) => c.indexOf('CONFIRMACION') === 0), mesa: up.indexOf('MESA'), fecha: up.indexOf('FECHA CONFIRMACION'), por: up.indexOf('CONFIRMADO POR') };
      return;
    }
    if (!cols) return;
    const nombre = String(r[cols.nom] || '').replace(/\s+/g, ' ').trim();
    if (!nombre) return;
    const g = (k) => (cols[k] >= 0 ? String(r[cols[k]] || '').replace(/\s+/g, ' ').trim() : '');
    out.push({ fila: i + 1, n: g('n'), nombre, grupo: g('grupo'), invitacion: g('inv'), estado: (g('conf') || 'PENDIENTE').toUpperCase(), mesa_excel: g('mesa'), fecha: g('fecha'), por: g('por'), virtual });
  });
  return out;
}

/** Escribe la mesa guardada en la columna MESA de la Hoja 1, solo en las filas de invitados presenciales. */
function bodaMesasAExcel_(libro) {
  const h = libro.getSheetByName(BODA_INVITADOS);
  const datos = bodaLeer_(libro);
  const nomMesa = {}; datos.mesas.forEach((m) => { nomMesa[m.id] = m.nombre || m.id; });
  const mesaDe = {}; datos.acomodacion.forEach((a) => { mesaDe[a.clave] = nomMesa[a.mesa] || ''; });
  const v = h.getDataRange().getDisplayValues();
  const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  let colMesa = -1, colNom = -1, colInv = -1, virtual = false;
  v.forEach((r, i) => {
    const up = r.map(norm);
    const iNom = up.findIndex((c) => c.indexOf('INVITADOS') === 0);
    if (iNom >= 0) { virtual = up[iNom].indexOf('VIDEOLLAMADA') >= 0; colMesa = up.indexOf('MESA'); colNom = iNom; colInv = up.indexOf('INVITACION'); return; }
    if (virtual || colMesa < 0 || colNom < 0) return;
    const nombre = up[colNom];
    if (!nombre) return;
    const clave = nombre + '|' + (colInv >= 0 ? up[colInv] : '');
    const nueva = mesaDe[clave] !== undefined ? mesaDe[clave] : '';
    if (String(r[colMesa] || '') !== nueva) h.getRange(i + 1, colMesa + 1).setValue(nueva);
  });
}

// ---- utilidades
function bodaHoja_(libro, k) {
  const [nombre, titulos] = BODA_TABS[k];
  let h = libro.getSheetByName(nombre);
  if (h && h.getLastColumn() < titulos.length) h.getRange(1, 1, 1, titulos.length).setValues([titulos]).setFontWeight('bold');
  if (!h) {
    h = libro.insertSheet(nombre);
    h.getRange(1, 1, 1, titulos.length).setValues([titulos]).setFontWeight('bold');
    h.setFrozenRows(1);
    h.getRange('A:A').setNumberFormat('@');
    if (k === 'abonos' || k === 'sobrecostos') h.getRange('B:B').setNumberFormat('@');
    if (k === 'proveedores') {
      const hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
      h.getRange(2, 1, 3, titulos.length).setValues([
        [bodaId_(), 'Wedding planner', 'Wedding planner', 0, '', '', '', hoy],
        [bodaId_(), 'Finca', 'Finca / lugar', 0, '', '', '', hoy],
        [bodaId_(), 'Pastor (ceremonia)', 'Ceremonia', 0, '', '', '', hoy],
      ]);
    }
  }
  return h;
}
function bodaUpsert_(libro, k, fila) {
  const h = bodaHoja_(libro, k);
  const ids = h.getRange(1, 1, Math.max(h.getLastRow(), 1), 1).getDisplayValues().map((r) => r[0]);
  const i = ids.indexOf(String(fila[0]));
  if (i > 0) h.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
  else h.appendRow(fila);
}
function bodaBorrar_(libro, k, cond) {
  const h = bodaHoja_(libro, k);
  const v = h.getDataRange().getDisplayValues();
  for (let i = v.length - 1; i >= 1; i--) if (cond(v[i])) h.deleteRow(i + 1);
}
function bodaReemplazar_(libro, k, filas) {
  const h = bodaHoja_(libro, k);
  const n = BODA_TABS[k][1].length;
  if (h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, n).clearContent();
  if (filas.length) h.getRange(2, 1, filas.length, n).setValues(filas);
}
function bodaId_() { return Utilities.getUuid().slice(0, 8); }
function bodaNum_(t) {
  if (typeof t === 'number') return t;
  let s = String(t || '').replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  if (s.indexOf(',') >= 0) s = s.replace(/\./g, '').replace(',', '.');
  else if (/\.\d{3}$/.test(s) || (s.match(/\./g) || []).length > 1) s = s.replace(/\./g, '');
  const n = Number(s); return isFinite(n) ? n : 0;
}
function bodaFecha_(t) {
  const s = String(t || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/); if (m) return m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
  return s;
}
