/**
 * IdeaLab · Servidor de la app "Rentabilidad Meta Ads"
 * Va pegado a la hoja "Tasas de cambio a COP (dashboard Meta Ads)".
 * Guarda el token de Meta y la clave de la app en Propiedades del script (nunca en el código).
 *
 * Propiedades del script que debes crear (Configuración del proyecto → Propiedades del script):
 *   META_TOKEN  = token del usuario del sistema de Meta
 *   APP_CLAVE   = una clave larga que solo conocen Anthony y Alejandra
 *
 * Usuarios propios (se crean desde la app, Configuración): cada socio puede entrar con su usuario y clave
 * (acceso total) y cada trabajadora con los suyos (solo Creativos). Se guardan en la pestaña Config,
 * con la clave cifrada.
 *
 * Creativos: los archivos se guardan en tu Google Drive, carpeta "IdeaLab · Creativos", en las subcarpetas
 * IMG (imágenes) y VID (videos), con su código consecutivo (IMG11, VD12…). El historial por país queda en
 * la pestaña Creativos_paises. La primera vez ejecuta la función "configurarCreativos" para dar permisos.
 */

const HOJA_ID = '1f0jljK5Pxt908HcQuAO9xorqN9XaVH2PdlkIBLIKLvw';
const VENTAS_ID = '1LV6ubaW7XlUn79u7Zu6uD4DjVOiI-IymxKAWokwBNjY';
const META_VERSION = 'v23.0';
const CUENTAS = [
  ['833750669763474', 'Vzla'],
  ['2453307908465571', 'VENEZUELA'],
  ['985534177360479', 'COLOMBIA'],
  ['2675892466135634', 'testeo1'],
  ['998190215723784', 'Europa (EUR)'],
];

// ---------------------------------------------------------------- Entrada

function doGet(e) {
  const ia = entradaUsuario_(e); if (ia.respuesta) return ia.respuesta; e = ia.e;
  return responder(() => {
    validarClave_(e.parameter.clave);
    const accion = e.parameter.accion || 'datos';
    if (accion === 'ping') return { ok: true, hora: new Date().toISOString() };
    if (accion === 'datos') return datos_(e.parameter.desde, e.parameter.hasta);
    if (accion === 'rango') return metaAnunciosRango_(e.parameter.desde, e.parameter.hasta, false);
    if (accion === 'meta_dia') return metaAnunciosRango_(e.parameter.desde, e.parameter.hasta, true);
    throw new Error('Acción desconocida: ' + accion);
  });
}

function doPost(e) {
  const ia = entradaUsuario_(e); if (ia.respuesta) return ia.respuesta; e = ia.e;
  return responder(() => {
    const body = JSON.parse(e.postData.contents || '{}');
    validarClave_(body.clave);
    // Creativos va aparte: las subidas son largas y no deben frenar el resto de la app
    if (String(body.accion || '').indexOf('creativos_') === 0) return creativos_(body, 'socios');
    if (body.accion === 'facturas') { const h = SpreadsheetApp.openById(HOJA_ID).getSheetByName('Facturas'); return { values: h ? h.getDataRange().getDisplayValues() : [] }; }
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      switch (body.accion) {
        case 'hoja': return hoja_(body.tool, body.input || {});
        case 'gasto_agregar': return gastoAgregar_(body);
        case 'gasto_eliminar': return limpiarFila_('Gastos', body.fila, 'G');
        case 'numero_guardar': return numeroGuardar_(body);
        case 'numero_estado': return escribir_('Numeros', 'F' + Number(body.fila), [[body.estado]]);
        case 'config_porcentajes': return escribir_('Config', 'B2:B6', body.valores.map((v) => [Number(v)]));
        case 'trabajador_guardar': return trabajadorGuardar_(body);
        case 'trabajador_eliminar': return limpiarFila_('Config', body.fila, 'C');
        case 'meta_apagar': return metaCambiar_(body.id, { status: 'PAUSED' });
        case 'meta_presupuesto':
        case 'presupuesto': return metaCambiar_(body.id, { daily_budget: Math.round(Number(body.presupuesto)) });
        default: throw new Error('Acción desconocida: ' + body.accion);
      }
    } finally {
      lock.releaseLock();
    }
  });
}

function responder(fn) {
  let salida;
  try { salida = { ok: true, ...fn() }; } catch (err) { salida = { ok: false, error: String(err && err.message || err) }; }
  return ContentService.createTextOutput(JSON.stringify(salida)).setMimeType(ContentService.MimeType.JSON);
}

function validarClave_(clave) {
  const real = PropertiesService.getScriptProperties().getProperty('APP_CLAVE');
  if (!real) throw new Error('Falta crear la propiedad APP_CLAVE en el script.');
  if (!clave || clave !== real) throw new Error('Clave incorrecta.');
}

// ---------------------------------------------------------------- Lectura

function datos_(desde, hasta) {
  AVISOS.length = 0;
  const hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
  hasta = hasta || hoy;
  desde = desde || hasta;
  const libro = SpreadsheetApp.openById(HOJA_ID);
  const hoja = (n) => { const h = libro.getSheetByName(n); return h ? h.getDataRange().getDisplayValues() : []; };
  return {
    hoy, desde, hasta,
    hojas: {
      productos: hoja('Productos'), tasas: hoja('Tasas'), config: hoja('Config'), gastos: hoja('Gastos'),
      cierres: hoja('Cierres'), numeros: hoja('Numeros'), cambios: hoja('Cambios_programados'), meta_diario: hoja('Meta_diario'), facturas: hoja('Facturas'), fan_pages: hoja('Fan_pages'),
    },
    ventas: ventas_(hoja('Productos')),
    meta: metaTodo_(desde, hasta, hoy),
    avisos: AVISOS.slice(),
  };
}

function ventas_(productos) {
  const libro = SpreadsheetApp.openById(VENTAS_ID);
  const filas = [];
  productos.slice(1).forEach((p) => {
    const [producto, , pais, hojaN, , moneda] = p;
    if (!hojaN) return;
    const h = libro.getSheetByName(hojaN);
    if (!h) return;
    const ult = h.getLastRow();
    if (ult < 2) return;
    const v = h.getRange(2, 3, ult - 1, 5).getDisplayValues(); // C..G
    v.forEach((r) => filas.push({ hoja: hojaN, producto, pais, moneda: String(moneda).toUpperCase(), fecha: r[0], valor: r[2], ad_id: String(r[4]).replace(/\D/g, '') }));
  });
  return filas;
}

// ---------------------------------------------------------------- Meta Ads (API de Marketing)

const AVISOS = [];
function aviso_(nombre, err) { const m = nombre + ': ' + String(err && err.message || err); if (AVISOS.indexOf(m) < 0) AVISOS.push(m); }

// Cuentas sin permiso: se recuerdan 6 horas para no volver a preguntarle a Meta en cada carga.
function omitidas_() { try { return JSON.parse(CacheService.getScriptCache().get('omitidas') || '[]'); } catch (e) { return []; } }
function omitir_(id) { const o = omitidas_(); if (o.indexOf(id) < 0) o.push(id); CacheService.getScriptCache().put('omitidas', JSON.stringify(o), 21600); }

function urlMeta_(ruta, params) {
  const token = PropertiesService.getScriptProperties().getProperty('META_TOKEN');
  if (!token) throw new Error('Falta crear la propiedad META_TOKEN en el script.');
  const q = Object.entries({ ...(params || {}), access_token: token }).map(([k, v]) => k + '=' + encodeURIComponent(v)).join('&');
  return 'https://graph.facebook.com/' + META_VERSION + '/' + ruta + '?' + q;
}

/**
 * Hace muchas consultas a Meta a la vez (en paralelo) para todas las cuentas.
 * specs: { clave: { ruta: (id) => 'act_'+id+'/...', params: {...} } }
 * Devuelve { clave: [ { id, nombre, datos: [...] } ] }
 */
function metaLote_(specs) {
  const omit = omitidas_();
  const cuentas = CUENTAS.filter(([id]) => omit.indexOf(id) < 0);
  omit.forEach((id) => { const c = CUENTAS.find((x) => x[0] === id); if (c) aviso_(c[1], 'sin permiso (se reintenta en unas horas)'); });
  const lista = [];
  Object.entries(specs).forEach(([clave, sp]) => cuentas.forEach(([id, nombre]) => lista.push({ clave, id, nombre, url: urlMeta_(sp.ruta(id), sp.params) })));
  // Google limita cuántas consultas seguidas se le hacen a Meta: van en grupos pequeños con pausa.
  const resps = [];
  const GRUPO = 6;
  for (let i = 0; i < lista.length; i += GRUPO) {
    const trozo = lista.slice(i, i + GRUPO).map((x) => ({ url: x.url, muteHttpExceptions: true }));
    let rs = null;
    for (let intento = 0; intento < 4 && !rs; intento++) {
      try { rs = UrlFetchApp.fetchAll(trozo); }
      catch (e) {
        if (!/demasiadas veces|rateMax|too many times/i.test(String(e.message)) || intento === 3) throw e;
        Utilities.sleep(1500 * (intento + 1));
      }
    }
    rs.forEach((r) => resps.push(r));
    if (i + GRUPO < lista.length) Utilities.sleep(700);
  }
  const out = {};
  Object.keys(specs).forEach((k) => { out[k] = []; });
  resps.forEach((r, i) => {
    const x = lista[i];
    try {
      let j = JSON.parse(r.getContentText());
      if (j.error) throw new Error('Meta: ' + j.error.message);
      const datos = (j.data || []).slice();
      let next = j.paging && j.paging.next;
      for (let k = 0; next && k < 20; k++) {
        Utilities.sleep(300);
        const j2 = JSON.parse(UrlFetchApp.fetch(next, { muteHttpExceptions: true }).getContentText());
        if (j2.error) throw new Error('Meta: ' + j2.error.message);
        (j2.data || []).forEach((d) => datos.push(d));
        next = j2.paging && j2.paging.next;
      }
      out[x.clave].push({ id: x.id, nombre: x.nombre, datos });
    } catch (err) {
      aviso_(x.nombre, err);
      if (/\(#200\)|permission/i.test(String(err.message))) omitir_(x.id);
    }
  });
  return out;
}

function conversaciones_(acciones) {
  const a = (acciones || []).find((x) => x.action_type === 'onsite_conversion.messaging_conversation_started_7d');
  return a ? Number(a.value) : 0;
}

function specInsights_(desde, hasta, porDia) {
  const params = {
    level: 'ad', limit: 500,
    fields: 'ad_id,ad_name,campaign_id,campaign_name,adset_id,adset_name,spend,actions,impressions,frequency,account_currency',
    time_range: JSON.stringify({ since: desde, until: hasta }),
  };
  if (porDia) params.time_increment = 1;
  return { ruta: (id) => 'act_' + id + '/insights', params };
}

function filasInsights_(bloques, desde, hasta, porDia) {
  const filas = [];
  bloques.forEach(({ id, nombre, datos }) => datos.forEach((r) => filas.push({
    fecha: porDia ? r.date_start : null, cuenta_id: id, cuenta: nombre, moneda: r.account_currency || 'COP',
    ad_id: r.ad_id, anuncio: r.ad_name, campana_id: r.campaign_id, campana: r.campaign_name, conjunto_id: r.adset_id, conjunto: r.adset_name,
    gasto: Number(r.spend || 0), conversaciones: conversaciones_(r.actions), impresiones: Number(r.impressions || 0), frecuencia: r.frequency ? Number(r.frequency) : null,
    rango_desde: desde, rango_hasta: hasta,
  })));
  return filas;
}

/** Gasto y conversaciones por anuncio en un rango (porDia = una fila por anuncio y día). */
function metaAnunciosRango_(desde, hasta, porDia) {
  AVISOS.length = 0;
  const r = metaLote_({ ins: specInsights_(desde, hasta, porDia) });
  return { filas: filasInsights_(r.ins, desde, hasta, porDia), avisos: AVISOS.slice() };
}

/** Todo lo de Meta que necesita la app, en una sola tanda de consultas paralelas. */
function metaTodo_(desde, hasta, hoy) {
  const r = metaLote_({
    rango: specInsights_(desde, hasta, false),
    hoy: specInsights_(hoy, hoy, false),
    campanas: { ruta: (id) => 'act_' + id + '/campaigns', params: { fields: 'id,name,effective_status,daily_budget', limit: 500 } },
    conjuntos: { ruta: (id) => 'act_' + id + '/adsets', params: { fields: 'id,name,campaign_id,effective_status,daily_budget,promoted_object,destination_type', limit: 500 } },
    activos: { ruta: (id) => 'act_' + id + '/ads', params: { fields: 'id,name,effective_status,adset_id,campaign{id,name},creative{effective_object_story_id}', effective_status: JSON.stringify(['ACTIVE']), limit: 500 } },
    // Aparte, para que si falla no afecte lo demás: a qué número de WhatsApp manda cada anuncio
    anuncios_wa: { ruta: (id) => 'act_' + id + '/ads', params: { fields: 'id,adset_id,campaign_id,creative{object_story_spec,asset_feed_spec,effective_object_story_id}', effective_status: JSON.stringify(['ACTIVE', 'PAUSED', 'ADSET_PAUSED', 'CAMPAIGN_PAUSED']), limit: 200 } },
    paginas: { ruta: (id) => 'act_' + id + '/promote_pages', params: { fields: 'id,name', limit: 100 } },
  });
  const plano = (bloques) => { const f = []; bloques.forEach(({ id, nombre, datos }) => datos.forEach((x) => f.push({ ...x, cuenta_id: id, cuenta: nombre }))); return f; };
  const paginas = {};
  r.paginas.forEach(({ nombre, datos }) => datos.forEach((p) => { paginas[p.id] = paginas[p.id] || { page_id: p.id, pagina: p.name, cuentas: [] }; paginas[p.id].cuentas.push(nombre); }));
  // Además, todas las páginas a las que tiene acceso el usuario del token (aunque no estén ligadas a una cuenta publicitaria)
  try {
    let url = urlMeta_('me/accounts', { fields: 'id,name', limit: 100 });
    for (let k = 0; url && k < 5; k++) {
      const j = JSON.parse(UrlFetchApp.fetch(url, { muteHttpExceptions: true }).getContentText());
      if (j.error) throw new Error('Meta: ' + j.error.message);
      (j.data || []).forEach((p) => { if (!paginas[p.id]) paginas[p.id] = { page_id: p.id, pagina: p.name, cuentas: [] }; });
      url = j.paging && j.paging.next;
    }
  } catch (err) { aviso_('Páginas', err); }
  const conjuntos = plano(r.conjuntos).map((c) => { const w = whatsappDe_(c.promoted_object); delete c.promoted_object; return { ...c, whatsapp: w }; });
  let wa = [];
  try { wa = whatsappAnuncios_(plano(r.anuncios_wa), conjuntos, paginas); } catch (err) { aviso_('WhatsApp', err); }
  const diag = { anuncios: wa.length, con_numero: wa.filter((a) => a.whatsapp).length, fuentes: wa.reduce((o, a) => { if (a.fuente) o[a.fuente] = (o[a.fuente] || 0) + 1; return o; }, {}) };
  return {
    rango: filasInsights_(r.rango, desde, hasta, false),
    hoy: filasInsights_(r.hoy, hoy, hoy, false),
    campanas: plano(r.campanas),
    // Número de WhatsApp al que manda cada conjunto o anuncio (para contar los mensajes por número)
    conjuntos,
    activos: plano(r.activos),
    anuncios_wa: wa,
    paginas: Object.values(paginas),
    wa_diag: diag,
  };
}

/** Número de WhatsApp de cada anuncio cuando Meta lo da: el del conjunto (promoted_object) o el del creativo. */
function whatsappAnuncios_(anuncios, conjuntos, paginas) {
  const porSet = {}; conjuntos.forEach((c) => { if (c.whatsapp) porSet[c.id] = c.whatsapp; });
  const wa = anuncios.map((a) => {
    const historia = String((a.creative && a.creative.effective_object_story_id) || '');
    let w = porSet[a.adset_id] || '', fuente = w ? 'conjunto' : '';
    if (!w) { w = whatsappDe_(a.creative); if (w) fuente = 'anuncio'; }
    return { id: a.id, conjunto_id: a.adset_id, campana_id: a.campaign_id, historia, page_id: historia.indexOf('_') > 0 ? historia.split('_')[0] : '', whatsapp: w, fuente };
  });
  // Meta no entrega el número cuando el anuncio usa una publicación de la página y el número se elige en el conjunto
  // («Destinos del mensaje»): en ese caso la app usa el código del número en el nombre (B3) o lo que se asigne en la tabla.
  return wa;
}

/** Lee un campo de muchos objetos de Meta (de a 50), guardando 6 horas lo que encuentra. */
function leerEnLotes_(ids, campo, pref, sacar) {
  const out = {};
  if (!ids.length) return out;
  const cache = CacheService.getScriptCache();
  const enCache = cache.getAll(ids.map((id) => pref + id));
  const pedir = [];
  ids.forEach((id) => { const v = enCache[pref + id]; if (v === undefined || v === null) pedir.push(id); else out[id] = v === '-' ? '' : v; });
  const trozos = []; for (let i = 0; i < pedir.length && i < 500; i += 50) trozos.push(pedir.slice(i, i + 50));
  if (!trozos.length) return out;
  let rs = [];
  try { rs = UrlFetchApp.fetchAll(trozos.map((t) => ({ url: urlMeta_('', { ids: t.join(','), fields: campo }), muteHttpExceptions: true }))); }
  catch (err) { aviso_('WhatsApp (' + campo + ')', err); return out; }
  const guardar = {};
  rs.forEach((r, i) => {
    try {
      const j = JSON.parse(r.getContentText());
      if (j.error) throw new Error('Meta: ' + j.error.message);
      trozos[i].forEach((id) => { const v = sacar(j[id]) || ''; out[id] = v; guardar[pref + id] = v || '-'; });
    } catch (err) { aviso_('WhatsApp (' + campo + ')', err); }
  });
  try { cache.putAll(guardar, 21600); } catch (x) {}
  return out;
}

/** Busca el número de WhatsApp dentro de la configuración de un conjunto o de un anuncio de Meta. */
function whatsappDe_(obj) {
  if (!obj) return '';
  const t = JSON.stringify(obj);
  const pat = [/"whatsapp_phone_number"\s*:\s*"?\+?([\d\s-]{8,20})/, /"whatsapp_number"\s*:\s*"?\+?([\d\s-]{8,20})/, /"phone_number"\s*:\s*"?\+?([\d\s-]{8,20})/, /wa\.me\\?\/\+?(\d{8,15})/, /[?&]phone=(?:%2B|\+)?(\d{8,15})/];
  for (let i = 0; i < pat.length; i++) { const m = t.match(pat[i]); if (m) { const d = m[1].replace(/\D/g, ''); if (d.length >= 8) return d; } }
  return '';
}

/** Apagar o cambiar presupuesto. Solo se llama desde un botón con confirmación en la app. */
function metaCambiar_(id, campos) {
  if (!/^\d+$/.test(String(id))) throw new Error('ID de Meta inválido.');
  const token = PropertiesService.getScriptProperties().getProperty('META_TOKEN');
  const r = UrlFetchApp.fetch('https://graph.facebook.com/' + META_VERSION + '/' + id, {
    method: 'post', muteHttpExceptions: true, payload: { ...campos, access_token: token },
  });
  const j = JSON.parse(r.getContentText());
  if (j.error) throw new Error('Meta: ' + j.error.message);
  const hoja = SpreadsheetApp.openById(HOJA_ID).getSheetByName('Cambios_programados');
  const ahora = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
  hoja.appendRow([ahora, '', '', String(id), '', campos.status ? 'apagar' : 'presupuesto', campos.daily_budget || '', 'ahora', 'Aplicado', ahora + ' · desde la app']);
  return { aplicado: true };
}

// ---------------------------------------------------------------- Escritura en la hoja

function escribir_(pestana, rango, valores) {
  SpreadsheetApp.openById(HOJA_ID).getSheetByName(pestana).getRange(rango).setValues(valores);
  return { guardado: true };
}

function limpiarFila_(pestana, fila, ultimaCol) {
  fila = Number(fila);
  if (!(fila >= 2)) throw new Error('Fila inválida.');
  SpreadsheetApp.openById(HOJA_ID).getSheetByName(pestana).getRange('A' + fila + ':' + ultimaCol + fila).clearContent();
  return { eliminado: true };
}

function gastoAgregar_(b) {
  if (!b.fecha || !b.concepto || !(Number(b.valor) > 0)) throw new Error('Faltan datos del gasto.');
  SpreadsheetApp.openById(HOJA_ID).getSheetByName('Gastos').appendRow([b.fecha, b.concepto, '', Number(b.valor), b.pagado_por || 'Empresa', 'desde la app', b.pais || 'General']);
  return { guardado: true };
}

function numeroGuardar_(b) {
  const hoja = SpreadsheetApp.openById(HOJA_ID).getSheetByName('Numeros');
  const fila = [b.codigo, b.numero, b.celular, b.pais || '', b.portafolio || '', b.estado || 'CALENTAMIENTO', b.inicio || '', b.fan_page || '', b.nota || ''];
  if (b.fila) hoja.getRange('A' + Number(b.fila) + ':I' + Number(b.fila)).setValues([fila]);
  else hoja.appendRow(fila);
  return { guardado: true };
}

function trabajadorGuardar_(b) {
  const hoja = SpreadsheetApp.openById(HOJA_ID).getSheetByName('Config');
  const fila = [b.nombre, Number(b.pct), b.nota || ''];
  if (b.fila) hoja.getRange('A' + Number(b.fila) + ':C' + Number(b.fila)).setValues([fila]);
  else {
    // primera fila vacía debajo del encabezado "Trabajadores"
    const v = hoja.getRange('A1:A200').getValues().map((r) => String(r[0]).trim());
    const inicio = v.findIndex((x) => /^trabajadores$/i.test(x));
    let f = inicio + 2;
    while (v[f - 1]) f++;
    hoja.getRange('A' + f + ':C' + f).setValues([fila]);
  }
  return { guardado: true };
}

/** Escrituras que hace el dashboard (mismas que con el conector de Google Sheets), solo en pestañas permitidas. */
const PESTANAS_EDITABLES = ['Gastos', 'Numeros', 'Config', 'Cambios_programados', 'Facturas', 'Fan_pages'];
function partirRango_(r) {
  const m = String(r || '').match(/^'?([^'!]+)'?!([A-Z]+\d*(?::[A-Z]+\d*)?)$/);
  if (!m || PESTANAS_EDITABLES.indexOf(m[1]) < 0) throw new Error('Rango no permitido: ' + r);
  return { hoja: SpreadsheetApp.openById(HOJA_ID).getSheetByName(m[1]), a1: m[2] };
}
function hoja_(tool, input) {
  if (tool === 'append_values') {
    const { hoja } = partirRango_(input.range);
    (input.values || []).forEach((fila) => hoja.appendRow(fila));
    return { guardado: true };
  }
  if (tool === 'update_values') {
    const { hoja, a1 } = partirRango_(input.range);
    const v = input.values || [];
    hoja.getRange(a1).offset(0, 0, v.length, v[0].length).setValues(v);
    return { guardado: true };
  }
  if (tool === 'batch_clear_values') {
    (input.ranges || []).forEach((r) => { const { hoja, a1 } = partirRango_(r); hoja.getRange(a1).clearContent(); });
    return { eliminado: true };
  }
  throw new Error('Herramienta no permitida: ' + tool);
}

// ---------------------------------------------------------------- Usuarios (socios y trabajadoras)

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function cuerpo_(e) {
  try { if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents); } catch (x) {}
  return (e && e.parameter) || {};
}

/** Huella de la clave (la app guarda solo esto en Config, nunca la clave). */
function huella_(clave) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'idealab|' + String(clave), Utilities.Charset.UTF_8)
    .map((b) => ('0' + (b & 255).toString(16)).slice(-2)).join('');
}

/**
 * Busca a la persona en Config: sección "Equipo con acceso" (socios, acceso total) o "Trabajadores"
 * (solo Creativos). Columnas: A nombre, D usuario, E huella de la clave, F apodo.
 */
function persona_(usuario, clave) {
  const v = SpreadsheetApp.openById(HOJA_ID).getSheetByName('Config').getDataRange().getDisplayValues();
  const u = String(usuario || '').trim().toLowerCase(), h = huella_(clave);
  let sec = '';
  for (let i = 0; i < v.length; i++) {
    const a = String(v[i][0] || '').trim();
    if (/^equipo/i.test(a)) { sec = 'socios'; continue; }
    if (/^trabajadores$/i.test(a)) { sec = 'creativos'; continue; }
    if (!sec || !a) continue;
    if (u && String(v[i][3] || '').trim().toLowerCase() === u && String(v[i][4] || '').trim() === h) return { nombre: a, rol: sec, apodo: String(v[i][5] || '').trim() || a.split(' ')[0] };
  }
  return null;
}

/**
 * Primera línea de doGet y doPost.
 *   - Sin usuario (clave de siempre): sigue igual que antes.
 *   - Socio con su usuario: se valida su clave y sigue como si hubiera puesto APP_CLAVE, a su nombre.
 *   - Trabajadora: solo puede usar Creativos.
 */
function entradaUsuario_(e) {
  const body = cuerpo_(e);
  if (!body || !body.usuario) return { e };
  let p = null;
  try { p = persona_(body.usuario, body.clave); } catch (err) { return { respuesta: json_({ ok: false, error: String(err.message || err) }) }; }
  if (!p) return { respuesta: json_({ ok: false, error: 'Clave incorrecta.' }) };
  if (body.accion === 'ping') return { respuesta: json_({ ok: true, rol: p.rol, nombre: p.nombre, apodo: p.apodo }) };
  if (p.rol === 'creativos') {
    if (String(body.accion || '').indexOf('creativos_') === 0) { body.quien = p.nombre; return { respuesta: responder(() => creativos_(body, 'creativos')) }; }
    return { respuesta: json_({ ok: false, error: 'Sin permiso: esta cuenta solo abre Creativos.' }) };
  }
  const maestra = PropertiesService.getScriptProperties().getProperty('APP_CLAVE');
  const nb = { ...body, clave: maestra }; delete nb.usuario;
  if (String(nb.accion || '').indexOf('creativos_') === 0) nb.quien = p.nombre;
  const par = { ...((e && e.parameter) || {}), clave: maestra }; delete par.usuario;
  const pars = {}; Object.keys(par).forEach((k) => { pars[k] = [par[k]]; });
  const e2 = { parameter: par, parameters: pars, queryString: (e && e.queryString) || '', contentLength: (e && e.contentLength) || -1 };
  if (e && e.postData) { const txt = JSON.stringify(nb); e2.postData = { contents: txt, type: e.postData.type, length: txt.length, name: 'postData' }; }
  return { e: e2 };
}

// ---------------------------------------------------------------- Creativos

const CARPETA_CREATIVOS = 'IdeaLab · Creativos';
const SUBCARPETA = { IMG: 'IMG', VD: 'VID' };
// Último consecutivo usado antes de la app. El siguiente es el primer número libre después de este,
// contando lo que hay en la pestaña Creativos y los archivos que ya están en las carpetas IMG y VID.
const BASE_CONSECUTIVO = { IMG: 10, VD: 10 };
const COLS_CREATIVOS = ['Código', 'Tipo', 'Archivo original', 'Enlace', 'ID archivo', 'Subido', 'Subido por', 'Estado', 'Inicio', 'Fin', 'Días', 'Nota'];
const COLS_PAISES = ['ID', 'Código', 'País', 'Inicio testeo', 'Inicio escala', 'Fin', 'Resultado', 'Nota', 'Actualizado', 'Por', 'Bitácora'];

/** Ejecútala UNA vez desde el editor para dar los permisos y crear las pestañas y las carpetas. */
function configurarCreativos() {
  hojaCreativos_(); hojaPaises_();
  const c = carpetaCreativos_(); carpetaTipo_('IMG'); carpetaTipo_('VD');
  Logger.log('Listo. Carpeta de creativos: ' + c.getUrl());
}

function hojaCon_(nombre, cols) {
  const ss = SpreadsheetApp.openById(HOJA_ID);
  let h = ss.getSheetByName(nombre);
  if (!h) { h = ss.insertSheet(nombre); h.getRange(1, 1, 1, cols.length).setValues([cols]); h.setFrozenRows(1); }
  return h;
}
function hojaCreativos_() { return hojaCon_('Creativos', COLS_CREATIVOS); }
function hojaPaises_() { return hojaCon_('Creativos_paises', COLS_PAISES); }

function carpetaCreativos_() {
  const it = DriveApp.getFoldersByName(CARPETA_CREATIVOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(CARPETA_CREATIVOS);
}
function carpetaTipo_(pref) {
  const madre = carpetaCreativos_(), nombre = SUBCARPETA[pref];
  const it = madre.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : madre.createFolder(nombre);
}

/** Código a partir del nombre del archivo: «IMG17.png» → IMG17, «VID 7.mov» o «VD7.MOV» → VD7. */
function codigoDeNombre_(n) {
  const m = String(n || '').trim().match(/^(IMG|VID|VD)\s*0*(\d+)\b/i);
  if (!m) return null;
  return (m[1].toUpperCase() === 'IMG' ? 'IMG' : 'VD') + Number(m[2]);
}

/** Archivos con código que ya están en las carpetas IMG y VID. */
function archivosDrive_() {
  const out = [];
  ['IMG', 'VD'].forEach((pref) => {
    const it = carpetaTipo_(pref).getFiles();
    while (it.hasNext()) {
      const f = it.next();
      const c = codigoDeNombre_(f.getName());
      if (c && c.indexOf(pref) === 0) out.push({ codigo: c, pref, archivo: f });
    }
  });
  return out;
}

function consecutivo_(usados, pref) {
  let n = BASE_CONSECUTIVO[pref] || 0;
  while (usados[pref + (n + 1)]) n++;
  return { actual: pref + n, siguiente: pref + (n + 1) };
}

/** Pone en la pestaña Creativos los archivos que alguien subió directo a las carpetas IMG o VID. */
function sincronizar_(h) {
  const n = h.getLastRow() - 1;
  const enHoja = {};
  if (n > 0) h.getRange(2, 1, n, 1).getDisplayValues().forEach((r) => { enHoja[String(r[0]).trim().toUpperCase()] = true; });
  const archivos = archivosDrive_();
  const usados = Object.assign({}, enHoja);
  archivos.forEach((a) => {
    usados[a.codigo] = true;
    if (enHoja[a.codigo]) return;
    const f = a.archivo;
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
    const fecha = Utilities.formatDate(f.getDateCreated(), 'America/Bogota', 'yyyy-MM-dd');
    h.appendRow([a.codigo, a.pref === 'VD' ? 'Video' : 'Imagen', f.getName(), f.getUrl(), f.getId(), fecha, 'Drive', 'Sin publicar', '', '', '', '']);
    h.getRange(h.getLastRow(), 6).setNumberFormat('@').setValue(fecha);
    enHoja[a.codigo] = true;
  });
  return usados;
}

function filaDe_(h, fila, codigo) {
  fila = Number(fila);
  if (!(fila >= 2 && fila <= h.getLastRow())) throw new Error('Fila no válida.');
  if (codigo && h.getRange(fila, 1).getDisplayValue().trim().toUpperCase() !== String(codigo).toUpperCase()) throw new Error('La lista cambió; actualiza la página e inténtalo de nuevo.');
  return fila;
}

const dia_ = (s) => Date.parse(String(s) + 'T12:00:00Z');
const hoyBog_ = () => Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
const fechaCorta_ = (s) => { if (!s) return ''; const m = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; return Number(s.slice(8, 10)) + ' ' + m[Number(s.slice(5, 7)) - 1]; };

function resultadoPais_(r) {
  if (r.fin) return r.escala ? 'Escaló y se apagó' : 'Murió en testeo';
  return r.escala ? 'Escalado' : 'En testeo';
}

/** Resume los países de un creativo en las columnas Estado, Inicio, Fin y Días de la pestaña Creativos. */
function resumirCreativo_(codigo) {
  const h = hojaCreativos_(), hp = hojaPaises_();
  const v = hp.getDataRange().getDisplayValues().slice(1).filter((r) => String(r[1]).toUpperCase() === String(codigo).toUpperCase() && r[2]);
  const n = h.getLastRow() - 1; if (n < 1) return;
  const cods = h.getRange(2, 1, n, 1).getDisplayValues().map((r) => String(r[0]).trim().toUpperCase());
  const i = cods.indexOf(String(codigo).toUpperCase()); if (i < 0) return;
  const fila = i + 2;
  if (!v.length) { h.getRange(fila, 8).setValue('Sin publicar'); return; }
  const ps = v.map((r) => ({ inicio: r[3], escala: r[4], fin: r[5] }));
  const activoEsc = ps.some((p) => p.escala && !p.fin), activoTest = ps.some((p) => !p.escala && !p.fin), algunaEsc = ps.some((p) => p.escala);
  const estado = activoEsc ? 'Escalado' : activoTest ? 'En testeo' : algunaEsc ? 'Apagado' : 'Murió en testeo';
  const inicio = ps.map((p) => p.inicio).filter(Boolean).sort()[0] || '';
  const fin = activoEsc || activoTest ? '' : ps.map((p) => p.fin).filter(Boolean).sort().pop() || '';
  const dias = inicio ? Math.round(((fin ? dia_(fin) : dia_(hoyBog_())) - dia_(inicio)) / 864e5) + 1 : '';
  h.getRange(fila, 9, 1, 2).setNumberFormat('@');
  h.getRange(fila, 8, 1, 4).setValues([[estado, inicio, fin, dias]]);
}

function creativos_(body, rol) {
  const h = hojaCreativos_();
  const quien = String(body.quien || '').trim() || (rol === 'creativos' ? 'Trabajadora' : 'Socios');
  const cache = CacheService.getScriptCache();

  if (body.accion === 'creativos_leer') {
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    let usados;
    try { usados = sincronizar_(h); } finally { lock.releaseLock(); }
    const prod = SpreadsheetApp.openById(HOJA_ID).getSheetByName('Productos');
    const lista = prod ? [...new Set(prod.getDataRange().getDisplayValues().slice(1).map((r) => String(r[2] || '').trim()).filter(Boolean))] : [];
    return { rol, values: h.getDataRange().getDisplayValues(), paises: hojaPaises_().getDataRange().getDisplayValues(), lista_paises: lista, consecutivos: { IMG: consecutivo_(usados, 'IMG'), VD: consecutivo_(usados, 'VD') } };
  }

  if (body.accion === 'creativos_subir_inicio') {
    const tam = Number(body.tam);
    if (!(tam > 0)) throw new Error('Archivo vacío.');
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      let codigo, pref, fila = null, viejo = '';
      if (body.reemplazar_fila) {
        // Nueva versión del mismo creativo: conserva su código y su historial
        fila = filaDe_(h, body.reemplazar_fila, body.codigo);
        codigo = h.getRange(fila, 1).getDisplayValue().trim().toUpperCase();
        pref = codigo.indexOf('VD') === 0 ? 'VD' : 'IMG';
        viejo = h.getRange(fila, 5).getDisplayValue();
      } else {
        pref = body.tipo === 'video' ? 'VD' : 'IMG';
        codigo = consecutivo_(sincronizar_(h), pref).siguiente;
      }
      const ext = (String(body.nombre || '').match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0].toLowerCase();
      const carpeta = carpetaTipo_(pref);
      const r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': body.mime || 'application/octet-stream', 'X-Upload-Content-Length': String(tam) },
        payload: JSON.stringify({ name: codigo + ext, parents: [carpeta.getId()], description: 'IdeaLab · ' + codigo + ' · ' + (body.nombre || '') }),
      });
      if (r.getResponseCode() >= 300) throw new Error('Drive no abrió la subida: ' + r.getContentText().slice(0, 200));
      const hd = r.getAllHeaders(), sesion = hd.Location || hd.location;
      const hoy = hoyBog_();
      if (!fila) {
        h.appendRow([codigo, pref === 'VD' ? 'Video' : 'Imagen', body.nombre || '', '', '', hoy, quien, 'Subiendo', '', '', '', body.nota || '']);
        fila = h.getLastRow();
        h.getRange(fila, 6).setNumberFormat('@').setValue(hoy);
      }
      const token = Utilities.getUuid();
      cache.put('sub_' + token, JSON.stringify({ s: sesion, fila, tam, codigo, viejo, reemplazo: !!body.reemplazar_fila, nombre: body.nombre || '', quien }), 21600);
      return { codigo, token, fila };
    } finally { lock.releaseLock(); }
  }

  if (body.accion === 'creativos_subir_parte') {
    const info = JSON.parse(cache.get('sub_' + body.token) || 'null');
    if (!info) throw new Error('La subida expiró; vuelve a intentarlo.');
    const bytes = Utilities.base64Decode(String(body.datos || ''));
    const desde = Number(body.desde), hasta = desde + bytes.length - 1;
    const rp = UrlFetchApp.fetch(info.s, { method: 'put', contentType: 'application/octet-stream', payload: bytes, muteHttpExceptions: true, headers: { 'Content-Range': 'bytes ' + desde + '-' + hasta + '/' + info.tam } });
    const code = rp.getResponseCode();
    if (code === 308) return { completo: false, recibido: hasta + 1 };
    if (code === 200 || code === 201) {
      const meta = JSON.parse(rp.getContentText());
      const f = DriveApp.getFileById(meta.id);
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
      if (h.getRange(info.fila, 1).getDisplayValue().trim().toUpperCase() === info.codigo) {
        h.getRange(info.fila, 3, 1, 3).setValues([[info.nombre, f.getUrl(), meta.id]]);
        if (!info.reemplazo) h.getRange(info.fila, 8).setValue('Sin publicar');
        else {
          const nota = h.getRange(info.fila, 12).getDisplayValue();
          h.getRange(info.fila, 12).setValue((nota ? nota + ' · ' : '') + 'Archivo reemplazado el ' + fechaCorta_(hoyBog_()) + ' por ' + info.quien);
        }
      }
      if (info.viejo && info.viejo !== meta.id) { try { DriveApp.getFileById(info.viejo).setTrashed(true); } catch (x) {} }
      cache.remove('sub_' + body.token);
      return { completo: true, codigo: info.codigo, id: meta.id, enlace: f.getUrl() };
    }
    throw new Error('Drive respondió ' + code + ': ' + rp.getContentText().slice(0, 200));
  }

  if (body.accion === 'creativos_actualizar') {
    const fila = filaDe_(h, body.fila, body.codigo);
    h.getRange(fila, 12).setValue(String(body.nota || ''));
    return { guardado: true };
  }

  if (body.accion === 'creativos_borrar') {
    const fila = filaDe_(h, body.fila, body.codigo);
    const por = h.getRange(fila, 7).getDisplayValue().trim();
    if (rol !== 'socios' && por.toLowerCase() !== quien.toLowerCase()) throw new Error('Solo puedes borrar los creativos que subiste tú. Pídele a un socio que lo borre.');
    const codigo = h.getRange(fila, 1).getDisplayValue().trim().toUpperCase();
    const id = h.getRange(fila, 5).getDisplayValue();
    if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (x) {} }
    h.deleteRow(fila);
    // También su historial por país
    const hp = hojaPaises_(), vp = hp.getDataRange().getDisplayValues();
    for (let i = vp.length - 1; i >= 1; i--) if (String(vp[i][1]).toUpperCase() === codigo) hp.deleteRow(i + 1);
    return { eliminado: true };
  }

  // ---- Historial por país: cuándo empezó el testeo, cuándo escaló y cuándo se apagó, en cada país
  if (body.accion === 'creativos_pais_guardar') {
    const codigo = String(body.codigo || '').trim().toUpperCase();
    const pais = String(body.pais || '').trim();
    const ini = String(body.inicio || ''), esc = String(body.escala || ''), fin = String(body.fin || '');
    if (!codigo || !pais) throw new Error('Falta el creativo o el país.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ini)) throw new Error('Pon el día en que empezó el testeo.');
    if (esc && esc < ini) throw new Error('El día de escala no puede ser antes del inicio del testeo.');
    if (fin && fin < (esc || ini)) throw new Error('El día de fin no puede ser antes del inicio.');
    const hp = hojaPaises_();
    const lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      const v = hp.getDataRange().getDisplayValues();
      let fila = null, antes = null;
      if (body.id) { for (let i = 1; i < v.length; i++) if (v[i][0] === String(body.id)) { fila = i + 1; antes = v[i]; break; } if (!fila) throw new Error('Ese registro ya no existe; actualiza la página.'); }
      const ahora = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
      const eventos = [];
      if (!antes) eventos.push('Empezó testeo en ' + pais + ' (' + fechaCorta_(ini) + ')');
      else {
        if (antes[3] !== ini) eventos.push('Inicio de testeo: ' + fechaCorta_(ini));
        if (antes[4] !== esc) eventos.push(esc ? 'Escaló (' + fechaCorta_(esc) + ')' : 'Quitó la escala');
        if (antes[5] !== fin) eventos.push(fin ? 'Se apagó (' + fechaCorta_(fin) + ')' : 'Volvió a estar activo');
        if (antes[2] !== pais) eventos.push('País: ' + pais);
      }
      if (!antes && esc) eventos.push('Escaló (' + fechaCorta_(esc) + ')');
      if (!antes && fin) eventos.push('Se apagó (' + fechaCorta_(fin) + ')');
      const bit = ((antes && antes[10]) ? antes[10] + '\n' : '') + (eventos.length ? ahora + ' · ' + quien + ': ' + eventos.join(' · ') : '');
      const id = antes ? antes[0] : Utilities.getUuid().slice(0, 8);
      const filaV = [id, codigo, pais, ini, esc, fin, resultadoPais_({ escala: esc, fin }), String(body.nota || ''), ahora, quien, bit.trim()];
      if (fila) { hp.getRange(fila, 4, 1, 3).setNumberFormat('@'); hp.getRange(fila, 1, 1, filaV.length).setValues([filaV]); }
      else { hp.appendRow(filaV); hp.getRange(hp.getLastRow(), 4, 1, 3).setNumberFormat('@').setValues([[ini, esc, fin]]); }
    } finally { lock.releaseLock(); }
    resumirCreativo_(codigo);
    return { guardado: true };
  }

  if (body.accion === 'creativos_pais_borrar') {
    const hp = hojaPaises_(), v = hp.getDataRange().getDisplayValues();
    for (let i = 1; i < v.length; i++) if (v[i][0] === String(body.id)) { const cod = v[i][1]; hp.deleteRow(i + 1); resumirCreativo_(cod); return { eliminado: true }; }
    throw new Error('Ese registro ya no existe; actualiza la página.');
  }

  throw new Error('Acción de creativos desconocida.');
}


// ---------------------------------------------------------------- Prueba manual desde el editor

function probar() {
  const t0 = Date.now();
  const r = datos_();
  Logger.log('Tardó ' + Math.round((Date.now() - t0) / 1000) + ' s');
  Logger.log('Hoy: ' + r.hoy + ' · anuncios con gasto hoy: ' + r.meta.hoy.length + ' · campañas: ' + r.meta.campanas.length + ' · páginas: ' + r.meta.paginas.length + ' · ventas: ' + r.ventas.length);
  Logger.log('WhatsApp detectado en ' + r.meta.wa_diag.con_numero + ' de ' + r.meta.wa_diag.anuncios + ' anuncios · ' + JSON.stringify(r.meta.wa_diag.fuentes));
  if (r.avisos.length) Logger.log('Cuentas sin acceso (se saltan): ' + r.avisos.join(' | '));
  else Logger.log('Todas las cuentas respondieron.');
}
