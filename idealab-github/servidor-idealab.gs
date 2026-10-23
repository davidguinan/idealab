/**
 * IdeaLab · funciones extra del servidor para la app:
 *   - "presupuesto": cambiar el presupuesto diario de una campaña (o conjunto) en Meta.
 *   - "facturas":    leer la pestaña Facturas (facturas por pagar).
 *
 * Reemplaza a servidor-presupuesto.gs: si ya lo habías pegado, borra ese archivo y pega este.
 *
 * ESTE ARCHIVO NO VA A GITHUB. Va en el proyecto de Apps Script de tu servidor
 * (el que está publicado como aplicación web y al que se conecta la app).
 *
 * Cómo instalarlo (5 minutos):
 *  1. Abre el proyecto de Apps Script del servidor.
 *  2. Pulsa  +  (Archivos) → Secuencia de comandos → nómbrala "idealab_extra" y pega todo este archivo.
 *  3. En tu función doPost, justo DESPUÉS de verificar la clave, agrega estas dos líneas:
 *
 *        if (body.accion === 'presupuesto') return idealabPresupuestoRespuesta(body);
 *        if (body.accion === 'facturas') return idealabFacturasRespuesta();
 *
 *     (cambia "body" por el nombre que tenga ahí el objeto que llega en el POST, por ejemplo datos o req)
 *  4. Revisa la función idealabTokenMeta() de abajo: debe devolver el MISMO token de Meta que ya usa
 *     tu servidor para leer las campañas. Si lo tienes en Propiedades del script con otro nombre,
 *     agrégalo a la lista.
 *  5. Implementar → Gestionar implementaciones → lápiz → Versión: Nueva versión → Implementar.
 *     (Así la URL de la app no cambia.)
 *
 * Mientras no lo instales, la app no falla: el cambio de presupuesto queda anotado en Cambios_programados
 * y las facturas se guardan en la pestaña Facturas (solo que la app no puede mostrarlas todavía).
 */

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
