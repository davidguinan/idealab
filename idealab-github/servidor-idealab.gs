/**
 * IdeaLab · funciones extra del servidor para la app (versión con CREATIVOS)
 *   - presupuesto: cambiar el presupuesto diario de una campaña o conjunto en Meta.
 *   - facturas:    leer la pestaña Facturas.
 *   - creativos:   subir imágenes y videos a Drive con su consecutivo (IMG11, VD11…),
 *                  leer y editar la pestaña Creativos, y la clave aparte para la persona de creativos.
 *
 * Reemplaza a servidor-idealab.gs y a servidor-presupuesto.gs: si ya pegaste alguno, borra ese archivo
 * del proyecto y pega este en su lugar.
 *
 * ESTE ARCHIVO NO VA A GITHUB. Va en el proyecto de Apps Script de tu servidor
 * (el que está publicado como aplicación web y al que se conecta la app).
 *
 * CÓMO INSTALARLO
 *  1. Abre el proyecto de Apps Script del servidor.
 *  2. Pulsa  +  (Archivos) → Secuencia de comandos → nómbrala "idealab_extra" y pega todo este archivo.
 *
 *  3. En tu función doGet(e), agrega como PRIMERA línea:
 *
 *        var cr = idealabEntradaCreativos(e); if (cr) return cr;
 *
 *  4. En tu función doPost(e), agrega como PRIMERA línea la misma:
 *
 *        var cr = idealabEntradaCreativos(e); if (cr) return cr;
 *
 *     y justo DESPUÉS de donde tu doPost verifica la clave, estas tres:
 *
 *        if (body.accion === 'presupuesto') return idealabPresupuestoRespuesta(body);
 *        if (body.accion === 'facturas') return idealabFacturasRespuesta();
 *        if (String(body.accion || '').indexOf('creativos_') === 0) return idealabCreativosRespuesta(body, 'socios');
 *
 *     (cambia "body" por el nombre que tenga ahí el objeto que llega en el POST, por ejemplo datos o req)
 *
 *  5. Arriba, en la lista de funciones, elige "idealabConfigurarCreativos" y pulsa Ejecutar. Acepta los
 *     permisos que pide Google (Drive para guardar los archivos y conexión externa para subirlos).
 *     Eso crea la carpeta "IdeaLab · Creativos" en el Drive de la cuenta dueña de este proyecto.
 *
 *     Las trabajadoras NO se configuran aquí: se agregan en la app, en Configuración → Trabajadores,
 *     con su usuario y su clave para Creativos. Apenas las guardas, ya pueden entrar.
 *
 *  6. Revisa idealabTokenMeta(): debe devolver el MISMO token de Meta que ya usa tu servidor.
 *
 *  7. Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar.
 *     (Así la URL de la app no cambia.)
 *
 * Los archivos quedan en tu Google Drive, en la carpeta "IdeaLab · Creativos", con el nombre del código
 * (IMG11.jpg, VD11.mp4…) y con enlace de solo lectura para que se puedan ver desde la app.
 */

// ===================== CREATIVOS =====================
var IDEALAB_CARPETA_CREATIVOS = 'IdeaLab · Creativos';
// Último consecutivo que ya existía antes de la app: el siguiente será IMG11 y VD11.
var IDEALAB_BASE_CONSECUTIVO = { IMG: 10, VD: 10 };
var IDEALAB_COLS_CREATIVOS = ['Código', 'Tipo', 'Archivo original', 'Enlace', 'ID archivo', 'Subido', 'Subido por', 'Estado', 'Inicio', 'Fin', 'Días', 'Nota'];

/** Ejecútala UNA vez desde el editor para dar los permisos y crear la pestaña y la carpeta. */
function idealabConfigurarCreativos() {
  idealabHojaCreativos();
  var c = idealabCarpetaCreativos();
  Logger.log('Listo. Carpeta de creativos: ' + c.getUrl());
}

/** Huella de la clave (la app guarda solo esto en Config, nunca la clave). */
function idealabHuella(clave) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'idealab|' + String(clave), Utilities.Charset.UTF_8)
    .map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('');
}

/** Busca la trabajadora en Config → Trabajadores (A: nombre, D: usuario, E: huella de la clave). */
function idealabTrabajadora(usuario, clave) {
  var v = SpreadsheetApp.openById(IDEALAB_HOJA).getSheetByName('Config').getDataRange().getDisplayValues();
  var enTrab = false, u = String(usuario || '').trim().toLowerCase(), h = idealabHuella(clave);
  for (var i = 0; i < v.length; i++) {
    var a = String(v[i][0] || '').trim();
    if (/^trabajadores$/i.test(a)) { enTrab = true; continue; }
    if (!enTrab || !a) continue;
    if (String(v[i][3] || '').trim().toLowerCase() === u && String(v[i][4] || '').trim() && String(v[i][4]).trim() === h) return a;
  }
  return null;
}

function idealabJson(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function idealabCuerpo(e) {
  try { if (e && e.postData && e.postData.contents) return JSON.parse(e.postData.contents); } catch (x) {}
  return (e && e.parameter) || {};
}

/**
 * Va al inicio de doGet y doPost. Atiende solo a quien entra con usuario (una trabajadora de creativos);
 * a los socios (que entran solo con clave) los deja pasar a tu código de siempre devolviendo null.
 */
function idealabEntradaCreativos(e) {
  var body = idealabCuerpo(e);
  if (!body || !body.usuario) return null;
  var nombre = idealabTrabajadora(body.usuario, body.clave);
  if (!nombre) return idealabJson({ ok: false, error: 'Clave incorrecta' });
  if (body.accion === 'ping') return idealabJson({ ok: true, rol: 'creativos', nombre: nombre });
  if (String(body.accion || '').indexOf('creativos_') === 0) { body.quien = nombre; return idealabCreativosRespuesta(body, 'creativos'); }
  return idealabJson({ ok: false, error: 'Sin permiso: esta cuenta solo abre Creativos' });
}

function idealabHojaCreativos() {
  var ss = SpreadsheetApp.openById(IDEALAB_HOJA);
  var h = ss.getSheetByName('Creativos');
  if (!h) { h = ss.insertSheet('Creativos'); h.getRange(1, 1, 1, IDEALAB_COLS_CREATIVOS.length).setValues([IDEALAB_COLS_CREATIVOS]); h.setFrozenRows(1); }
  return h;
}

function idealabCarpetaCreativos() {
  var it = DriveApp.getFoldersByName(IDEALAB_CARPETA_CREATIVOS);
  return it.hasNext() ? it.next() : DriveApp.createFolder(IDEALAB_CARPETA_CREATIVOS);
}

function idealabSiguienteCodigo(h, pref) {
  var n = h.getLastRow() - 1, max = IDEALAB_BASE_CONSECUTIVO[pref] || 0;
  if (n > 0) h.getRange(2, 1, n, 1).getDisplayValues().forEach(function (r) {
    var m = String(r[0]).trim().toUpperCase().match(new RegExp('^' + pref + '(\\d+)$'));
    if (m) max = Math.max(max, Number(m[1]));
  });
  return pref + (max + 1);
}

function idealabCreativosRespuesta(body, rol) {
  try { return idealabJson(idealabCreativos(body, rol)); }
  catch (e) { return idealabJson({ ok: false, error: String(e.message || e) }); }
}

function idealabCreativos(body, rol) {
  var h = idealabHojaCreativos();
  // Quién sube: la trabajadora que entró, o el socio que eligieron en la app
  var quien = String(body.quien || '').trim() || (rol === 'creativos' ? 'Trabajadora' : 'Socios');
  var cache = CacheService.getScriptCache();

  if (body.accion === 'creativos_leer') return { ok: true, rol: rol, values: h.getDataRange().getDisplayValues() };

  if (body.accion === 'creativos_subir_inicio') {
    var pref = body.tipo === 'video' ? 'VD' : 'IMG';
    var tam = Number(body.tam);
    if (!(tam > 0)) throw new Error('Archivo vacío');
    var lock = LockService.getScriptLock(); lock.waitLock(30000);
    try {
      var codigo = idealabSiguienteCodigo(h, pref);
      var ext = (String(body.nombre || '').match(/\.[A-Za-z0-9]{2,5}$/) || [''])[0].toLowerCase();
      var carpeta = idealabCarpetaCreativos();
      var r = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id', {
        method: 'post', contentType: 'application/json; charset=UTF-8', muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), 'X-Upload-Content-Type': body.mime || 'application/octet-stream', 'X-Upload-Content-Length': String(tam) },
        payload: JSON.stringify({ name: codigo + ext, parents: [carpeta.getId()], description: 'IdeaLab · ' + codigo + ' · ' + (body.nombre || '') }),
      });
      if (r.getResponseCode() >= 300) throw new Error('Drive no abrió la subida: ' + r.getContentText().slice(0, 200));
      var hd = r.getAllHeaders(), sesion = hd.Location || hd.location;
      var hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd');
      h.appendRow([codigo, pref === 'VD' ? 'Video' : 'Imagen', body.nombre || '', '', '', hoy, quien, 'Subiendo', '', '', '', body.nota || '']);
      var fila = h.getLastRow();
      h.getRange(fila, 6).setNumberFormat('@').setValue(hoy);
      var token = Utilities.getUuid();
      cache.put('sub_' + token, JSON.stringify({ s: sesion, fila: fila, tam: tam, codigo: codigo }), 21600);
      return { ok: true, codigo: codigo, token: token, fila: fila };
    } finally { lock.releaseLock(); }
  }

  if (body.accion === 'creativos_subir_parte') {
    var info = JSON.parse(cache.get('sub_' + body.token) || 'null');
    if (!info) throw new Error('La subida expiró; vuelve a intentarlo.');
    var bytes = Utilities.base64Decode(String(body.datos || ''));
    var desde = Number(body.desde), hasta = desde + bytes.length - 1;
    var rp = UrlFetchApp.fetch(info.s, { method: 'put', contentType: 'application/octet-stream', payload: bytes, muteHttpExceptions: true, headers: { 'Content-Range': 'bytes ' + desde + '-' + hasta + '/' + info.tam } });
    var code = rp.getResponseCode();
    if (code === 308) return { ok: true, completo: false, recibido: hasta + 1 };
    if (code === 200 || code === 201) {
      var meta = JSON.parse(rp.getContentText());
      var f = DriveApp.getFileById(meta.id);
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (x) {}
      if (h.getRange(info.fila, 1).getDisplayValue() === info.codigo) { h.getRange(info.fila, 4, 1, 2).setValues([[f.getUrl(), meta.id]]); h.getRange(info.fila, 8).setValue('Sin publicar'); }
      cache.remove('sub_' + body.token);
      return { ok: true, completo: true, codigo: info.codigo, id: meta.id, enlace: f.getUrl() };
    }
    throw new Error('Drive respondió ' + code + ': ' + rp.getContentText().slice(0, 200));
  }

  if (body.accion === 'creativos_actualizar') {
    var fila2 = Number(body.fila);
    if (!(fila2 >= 2 && fila2 <= h.getLastRow())) throw new Error('Fila no válida');
    if (body.codigo && h.getRange(fila2, 1).getDisplayValue() !== body.codigo) throw new Error('La lista cambió; actualiza la página e inténtalo de nuevo.');
    var ini = String(body.inicio || ''), fin = String(body.fin || '');
    var dias = ini && fin ? Math.round((Date.parse(fin + 'T12:00:00Z') - Date.parse(ini + 'T12:00:00Z')) / 864e5) + 1 : '';
    h.getRange(fila2, 9, 1, 2).setNumberFormat('@');
    h.getRange(fila2, 8, 1, 5).setValues([[String(body.estado || ''), ini, fin, dias, String(body.nota || '')]]);
    return { ok: true, dias: dias };
  }

  if (body.accion === 'creativos_borrar') {
    if (rol !== 'socios') throw new Error('Solo los socios pueden borrar creativos.');
    var fila3 = Number(body.fila);
    if (!(fila3 >= 2 && fila3 <= h.getLastRow())) throw new Error('Fila no válida');
    if (body.codigo && h.getRange(fila3, 1).getDisplayValue() !== body.codigo) throw new Error('La lista cambió; actualiza la página e inténtalo de nuevo.');
    var id = h.getRange(fila3, 5).getDisplayValue();
    if (id) { try { DriveApp.getFileById(id).setTrashed(true); } catch (x) {} }
    h.deleteRow(fila3);
    return { ok: true };
  }

  throw new Error('Acción de creativos desconocida');
}

// ===================== PRESUPUESTO Y FACTURAS =====================
var IDEALAB_GRAPH = 'https://graph.facebook.com/v21.0/';
var IDEALAB_HOJA = '1f0jljK5Pxt908HcQuAO9xorqN9XaVH2PdlkIBLIKLvw';

function idealabTokenMeta() {
  var props = PropertiesService.getScriptProperties();
  var nombres = ['META_TOKEN', 'TOKEN_META', 'META_ACCESS_TOKEN', 'ACCESS_TOKEN', 'FB_TOKEN', 'TOKEN'];
  for (var i = 0; i < nombres.length; i++) {
    var t = props.getProperty(nombres[i]);
    if (t) return t;
  }
  throw new Error('Meta: no encontré el token de Meta en las Propiedades del script (revisa idealabTokenMeta).');
}

function idealabPresupuestoRespuesta(body) {
  var out;
  try { out = idealabCambiarPresupuesto(body); }
  catch (e) { out = { ok: false, error: String(e.message || e) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function idealabCambiarPresupuesto(body) {
  var id = String(body.id || '').replace(/[^0-9]/g, '');
  var valor = Math.round(Number(body.presupuesto));
  if (!id) throw new Error('Meta: falta el ID de la campaña o del conjunto.');
  if (!(valor >= 1000)) throw new Error('Meta: el presupuesto diario debe ser de al menos 1.000.');

  // Mismo valor que la app muestra como "Presupuesto diario" (en las cuentas en COP, pesos sin decimales).
  var resp = UrlFetchApp.fetch(IDEALAB_GRAPH + id, {
    method: 'post',
    payload: { daily_budget: String(valor), access_token: idealabTokenMeta() },
    muteHttpExceptions: true,
  });
  var j = {};
  try { j = JSON.parse(resp.getContentText()); } catch (e) {}
  if (resp.getResponseCode() >= 300 || !j.success) {
    var msg = (j.error && (j.error.error_user_msg || j.error.message)) || ('respuesta ' + resp.getResponseCode());
    throw new Error('Meta: ' + msg);
  }

  // Deja constancia en la pestaña Cambios_programados
  try {
    var hoja = SpreadsheetApp.openById(IDEALAB_HOJA).getSheetByName('Cambios_programados');
    if (hoja) {
      var hoy = Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd HH:mm');
      hoja.appendRow([hoy, body.cuenta || '', body.nivel === 'conjunto' ? 'conjunto' : 'campaña', id, body.nombre || '', 'presupuesto', valor, 'ahora', 'Aplicado', 'desde la app']);
    }
  } catch (e) {}

  return { ok: true, id: id, presupuesto: valor };
}

function idealabFacturasRespuesta() {
  var out;
  try {
    var hoja = SpreadsheetApp.openById(IDEALAB_HOJA).getSheetByName('Facturas');
    out = { ok: true, values: hoja ? hoja.getDataRange().getDisplayValues() : [] };
  } catch (e) { out = { ok: false, error: String(e.message || e) }; }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
