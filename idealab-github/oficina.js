/* IdeaLab · Oficina de agentes en 3D
 * Vista "Oficina" del dashboard: edificio IdeaLab con un agente por departamento,
 * ciclo real de día / tarde / noche, clima que cambia cada día y centro de mando
 * para asignar tareas con tiempo de entrega.
 * Las tareas se guardan en la pestaña "Oficina" de la hoja (acciones tareas_leer / tareas_guardar / tareas_borrar).
 */
(function () {
  'use strict';
  const seccion = document.getElementById('oficina');
  if (!seccion) return;

  /* ---------------- estilos (usan los colores del tema de la app) ---------------- */
  const css = `
#oficina .of{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:14px;height:calc(100vh - 130px);min-height:540px}
#oficina .of-escena{position:relative;border-radius:18px;overflow:hidden;border:1px solid var(--ag-line,rgba(255,255,255,.1));background:#0b1028;min-height:360px}
#oficina .of-escena canvas{display:block;width:100%;height:100%;touch-action:none}
#oficina .of-etq-capa{position:absolute;inset:0;pointer-events:none;overflow:hidden}
#oficina .of-etq{position:absolute;transform:translate(-50%,-100%);white-space:nowrap;pointer-events:auto;cursor:pointer;color:#eef2ff;
  font:600 11px Inter,sans-serif;padding:4px 8px 4px 6px;border-radius:999px;background:rgba(8,14,32,.78);border:1px solid rgba(255,255,255,.12);display:flex;gap:6px;align-items:center}
#oficina .of-etq.sel{border-color:#ffc93c;box-shadow:0 0 0 2px rgba(255,201,60,.25)}
#oficina .of-etq i{width:8px;height:8px;border-radius:50%;display:inline-block}
#oficina .of-etq b{background:linear-gradient(135deg,#ff6a1a,#ffc93c);color:#1a0f00;border-radius:999px;padding:0 6px;font-size:10px}
#oficina .of-etq b.venc{background:#ff5a5a;color:#fff}
#oficina .of-hud{position:absolute;left:12px;top:12px;right:12px;display:flex;gap:8px;flex-wrap:wrap;pointer-events:none}
#oficina .of-chip{pointer-events:auto;color:#eef2ff;background:rgba(8,14,32,.72);border:1px solid rgba(255,255,255,.12);backdrop-filter:blur(6px);border-radius:12px;padding:6px 10px;font-size:12px;display:flex;gap:8px;align-items:center}
#oficina .of-chip strong{font:700 15px Inter,sans-serif}
#oficina .of-chip select{all:unset;cursor:pointer;font-size:12px}
#oficina .of-chip select option{background:#0b1a3a;color:#fff}
#oficina .of-vista{position:absolute;left:12px;bottom:12px;display:flex;gap:8px;flex-wrap:wrap}
#oficina .of-vista button{all:unset;cursor:pointer;color:#eef2ff;font:600 12px Inter,sans-serif;padding:8px 12px;border-radius:10px;background:rgba(8,14,32,.78);border:1px solid rgba(255,255,255,.12)}
#oficina .of-vista button:hover,#oficina .of-vista button.on{border-color:#ff7a1a}
#oficina .of-toast{position:absolute;left:50%;top:56px;transform:translate(-50%,-140px);transition:.35s;background:#13254f;color:#fff;border:1px solid #ff7a1a;padding:9px 14px;border-radius:12px;font-size:13px;z-index:3}
#oficina .of-toast.on{transform:translate(-50%,0)}
#oficina .of-carga{position:absolute;inset:0;display:grid;place-items:center;color:#c9d3ea;font-size:14px}
#oficina .of-panel{background:var(--ag-panel,#101a2d);border:1px solid var(--ag-line,rgba(255,255,255,.1));border-radius:18px;overflow:auto;padding:16px;color:var(--ag-fg,#e8edf7)}
#oficina .of-panel h3{margin:0;font:600 17px Inter,sans-serif}
#oficina .of-panel .of-sub{margin:2px 0 0;font-size:12px;color:var(--ag-muted,#8d9ab3)}
#oficina .of-aviso{margin:10px 0 0;font-size:12px;padding:8px 10px;border-radius:10px;background:rgba(245,184,0,.12);color:var(--ag-gold,#f5b800)}
#oficina .of-kpis{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:12px}
#oficina .of-kpi{background:var(--ag-panel2,rgba(255,255,255,.04));border:1px solid var(--ag-line,rgba(255,255,255,.1));border-radius:12px;padding:8px 10px}
#oficina .of-kpi small{font-size:10px;color:var(--ag-muted,#8d9ab3);text-transform:uppercase;letter-spacing:.6px}
#oficina .of-kpi div{font:700 20px Inter,sans-serif}
#oficina .of-h{font:600 11px Inter,sans-serif;color:var(--ag-muted,#8d9ab3);text-transform:uppercase;letter-spacing:.8px;margin:16px 0 8px}
#oficina .of-deps{display:grid;grid-template-columns:1fr 1fr;gap:6px}
#oficina .of-dep{all:unset;cursor:pointer;display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;background:var(--ag-panel2,rgba(255,255,255,.04));border:1px solid var(--ag-line,rgba(255,255,255,.1));font-size:12px;font-weight:500}
#oficina .of-dep.sel{border-color:var(--ag-gold,#f5b800)}
#oficina .of-dep i{width:9px;height:9px;border-radius:50%;flex:none}
#oficina .of-dep em{margin-left:auto;font-style:normal;font-size:10px;color:var(--ag-muted,#8d9ab3)}
#oficina .of-ficha{margin-top:12px;padding:12px;border-radius:14px;background:var(--ag-panel2,rgba(255,255,255,.04));border:1px solid var(--ag-line,rgba(255,255,255,.1))}
#oficina .of-ficha h4{margin:0;font:600 15px Inter,sans-serif;display:flex;align-items:center;gap:8px}
#oficina .of-ficha p{font-size:12px;color:var(--ag-muted,#8d9ab3);margin:4px 0 0;line-height:1.45}
#oficina .of-ficha b{color:var(--ag-fg,#e8edf7)}
#oficina .of-est{font-size:10px;font-weight:600;padding:2px 8px;border-radius:999px;margin-left:auto}
#oficina .of-est.libre{background:rgba(52,211,153,.15);color:var(--ag-ok,#34d399)}
#oficina .of-est.trab{background:rgba(245,184,0,.16);color:var(--ag-gold,#f5b800)}
#oficina .of-est.atr{background:rgba(251,113,133,.16);color:var(--ag-bad,#fb7185)}
#oficina .of-form{display:grid;gap:8px}
#oficina .of-form label{font-size:11px;color:var(--ag-muted,#8d9ab3);display:grid;gap:4px}
#oficina .of-form textarea{min-height:64px;resize:vertical}
#oficina .of-fila{display:grid;grid-template-columns:1.4fr 1fr;gap:8px}
#oficina .of-rap{display:flex;gap:6px;flex-wrap:wrap}
#oficina .of-rap button{all:unset;cursor:pointer;font-size:11px;padding:3px 8px;border-radius:999px;border:1px solid var(--ag-line,rgba(255,255,255,.12));color:var(--ag-muted,#8d9ab3)}
#oficina .of-rap button:hover{border-color:var(--ag-gold,#f5b800);color:var(--ag-fg,#e8edf7)}
#oficina .of-tareas{display:grid;gap:8px}
#oficina .of-t{padding:10px;border-radius:12px;background:var(--ag-panel2,rgba(255,255,255,.04));border:1px solid var(--ag-line,rgba(255,255,255,.1));border-left:3px solid var(--c,#888)}
#oficina .of-t .tt{font-size:13px;line-height:1.4;white-space:pre-wrap}
#oficina .of-t .mm{display:flex;gap:8px;align-items:center;margin-top:6px;font-size:11px;color:var(--ag-muted,#8d9ab3);flex-wrap:wrap}
#oficina .of-t .venc{color:var(--ag-bad,#fb7185);font-weight:600}
#oficina .of-t .ok{color:var(--ag-ok,#34d399);font-weight:600}
#oficina .of-pri{font-size:10px;padding:1px 6px;border-radius:6px;background:rgba(127,127,127,.15)}
#oficina .of-pri.Alta{background:rgba(251,113,133,.18);color:var(--ag-bad,#fb7185)}
#oficina .of-acc{margin-left:auto;display:flex;gap:4px}
#oficina .of-acc button{all:unset;cursor:pointer;font-size:11px;padding:3px 8px;border-radius:8px;border:1px solid var(--ag-line,rgba(255,255,255,.12))}
#oficina .of-vacio{font-size:12px;color:var(--ag-muted,#8d9ab3);padding:10px;text-align:center;border:1px dashed var(--ag-line,rgba(255,255,255,.12));border-radius:12px}
#oficina .of-t.hecha{opacity:.55}#oficina .of-t.hecha .tt{text-decoration:line-through}
@media (max-width:900px){#oficina .of{grid-template-columns:1fr;height:auto}#oficina .of-escena{height:62vh}#oficina .of-panel{overflow:visible}}
@media (max-width:600px){#oficina .of-chip{padding:5px 8px;font-size:11px}#oficina .of-chip strong{font-size:13px}#oficina .of-etq{font-size:10px}}
`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  seccion.innerHTML = `
<div class="of">
  <div class="of-escena" id="of-escena">
    <div class="of-carga" id="of-carga">Construyendo el edificio…</div>
    <div class="of-etq-capa" id="of-etq"></div>
    <div class="of-hud">
      <div class="of-chip"><strong id="of-hora">--:--</strong><span id="of-fecha"></span></div>
      <div class="of-chip"><span id="of-momento"></span> · <span id="of-clima"></span></div>
      <div class="of-chip" title="Para probar: el edificio usa la hora real y el clima del día">
        <select id="of-sclima" aria-label="Clima"><option value="auto">Clima del día</option><option value="soleado">Soleado</option><option value="nublado">Nublado</option><option value="lluvia">Lluvia</option><option value="nieve">Nieve</option></select>
        <select id="of-svel" aria-label="Velocidad"><option value="1">Hora real</option><option value="120">Rápido (1 h = 30 s)</option></select>
      </div>
    </div>
    <div class="of-vista">
      <button type="button" id="of-bgen">Vista general</button>
      <button type="button" id="of-bint">Ver interior</button>
      <button type="button" id="of-betq">Ocultar nombres</button>
    </div>
    <div class="of-toast" id="of-toast"></div>
  </div>
  <aside class="of-panel">
    <h3>Centro de mando</h3>
    <p class="of-sub">Elige un departamento, escribe la tarea y ponle tiempo de entrega.</p>
    <p class="of-aviso" id="of-aviso" hidden></p>
    <div class="of-kpis">
      <div class="of-kpi"><small>Activas</small><div id="of-kact">0</div></div>
      <div class="of-kpi"><small>Vencidas</small><div id="of-kven">0</div></div>
      <div class="of-kpi"><small>Entregadas</small><div id="of-kok">0</div></div>
    </div>
    <div class="of-h">Departamentos</div>
    <div class="of-deps" id="of-deps"></div>
    <div class="of-ficha" id="of-ficha"></div>
    <div class="of-h">Asignar tarea</div>
    <form class="of-form" id="of-form">
      <label>Tarea<textarea class="ag-in" id="of-ftarea" required placeholder="Ej: Revisa el ROAS de ayer por país y dime qué escalar"></textarea></label>
      <div class="of-fila">
        <label>Tiempo de entrega<input class="ag-in" type="datetime-local" id="of-fentrega" required></label>
        <label>Prioridad<select class="ag-in ag-sel" id="of-fpri"><option>Alta</option><option selected>Media</option><option>Baja</option></select></label>
      </div>
      <div class="of-rap" id="of-rap"><button type="button" data-h="2">En 2 h</button><button type="button" data-h="6">En 6 h</button><button type="button" data-h="24">Mañana</button><button type="button" data-h="72">3 días</button><button type="button" data-h="168">1 semana</button></div>
      <button class="ag-btn pri" type="submit" id="of-fbtn">Asignar al departamento</button>
    </form>
    <div class="of-h" id="of-ttitulo">Tareas</div>
    <div class="of-tareas" id="of-tareas"></div>
  </aside>
</div>`;
  const $ = (id) => document.getElementById(id);

  /* ---------------- departamentos ---------------- */
  const DEPTOS = [
    { id: 'ony', nombre: 'Dirección · ONY', agente: 'ONY, el jefe', color: '#5fd068', piso: 6, lado: 'C', desc: 'Dirige a todo el equipo desde el penthouse, revisa el trabajo de cada departamento y te da el resumen de cada mañana.' },
    { id: 'campanas', nombre: 'Campañas', agente: 'Analista de campañas', color: '#ff8a3d', piso: 1, lado: 'L', desc: 'Revisa ROAS, CPA y gasto por país en Meta Ads. Escala solo con ROAS ≥ 2.' },
    { id: 'ventas', nombre: 'Ventas', agente: 'Analista de ventas', color: '#ffc93c', piso: 1, lado: 'R', desc: 'Cruza las ventas de VEN 2026, ClicChat y ZapData por país.' },
    { id: 'mejoras', nombre: 'Mejoras', agente: 'Estratega', color: '#4fb3ff', piso: 2, lado: 'L', desc: 'Lee los informes de los demás y propone qué escalar, apagar o testear.' },
    { id: 'investigacion', nombre: 'Investigación', agente: 'Investigador', color: '#b388ff', piso: 2, lado: 'R', desc: 'Busca en la Biblioteca de anuncios productos en PDF con muchos anuncios activos.' },
    { id: 'modelado', nombre: 'Modelado', agente: 'Modelador', color: '#ff6fae', piso: 3, lado: 'L', desc: 'Modela los productos ganadores para tu catálogo y tus países.' },
    { id: 'zapdata', nombre: 'Flujos ZapData', agente: 'Arquitecto de flujos', color: '#2ee6c5', piso: 3, lado: 'R', desc: 'Diseña y mejora los flujos de venta por WhatsApp en ZapData.' },
    { id: 'creativo', nombre: 'Creativo', agente: 'Director creativo', color: '#ff5a5a', piso: 4, lado: 'L', desc: 'Busca referencias en TikTok y evalúa creativos con el criterio de Eduardo.' },
    { id: 'juntas', nombre: 'Sala de juntas', agente: 'Todo el equipo', color: '#e8e8f0', piso: 4, lado: 'R', sinAgente: true, desc: 'Si le asignas una tarea, los agentes libres suben a reunirse aquí con ONY.' },
    { id: 'david', nombre: 'Oficina David', agente: 'Asistente de David', color: '#ffd27a', piso: 5, lado: 'L', desc: 'Prepara tus informes de socio: ventas por país, utilidad y cierres.' },
    { id: 'alejandra', nombre: 'Oficina Alejandra', agente: 'Asistente de Alejandra', color: '#ffd27a', piso: 5, lado: 'R', desc: 'Prepara los informes de Alejandra: ventas por país, utilidad y cierres.' },
  ];
  const DEP = Object.fromEntries(DEPTOS.map((d) => [d.id, d]));

  /* ---------------- tareas (servidor) ---------------- */
  let tareas = [];
  let sinServidor = false;
  let seleccion = 'campanas';
  const pendientes = (id) => tareas.filter((t) => t.dept === id && t.estado === 'pendiente');
  const quien = () => (window.idealabPersona && window.idealabPersona.nombre) || '';
  const avisoServidor = (e) => {
    sinServidor = true;
    const a = $('of-aviso'); a.hidden = false;
    a.textContent = /desconocida/i.test(String(e && e.message)) ? 'Falta agregar Oficina.gs al servidor: por ahora las tareas solo viven en esta pantalla y se pierden al recargar.' : 'No pude conectar con el servidor (' + ((e && e.message) || e) + '). Las tareas de esta sesión no se están guardando.';
  };
  const Almacen = {
    async leer() { if (!window.idealabEnviar) throw new Error('sin_login'); const r = await window.idealabEnviar({ accion: 'tareas_leer' }); return r.tareas || []; },
    async guardar(t) { if (sinServidor || !window.idealabEnviar) return null; const r = await window.idealabEnviar({ accion: 'tareas_guardar', tarea: t, quien: quien() }); return r.tareas; },
    async borrar(id) { if (sinServidor || !window.idealabEnviar) return null; const r = await window.idealabEnviar({ accion: 'tareas_borrar', id }); return r.tareas; },
  };
  const cargarTareas = () => Almacen.leer().then((l) => { tareas = l; $('of-aviso').hidden = true; sinServidor = false; render(); }).catch(avisoServidor);
  const sincronizar = (prom) => prom.then((l) => { if (l) { tareas = l; render(); } }).catch((e) => { avisoServidor(e); render(); });

  /* ---------------- panel ---------------- */
  const NOMBRE_EST = { libre: 'Disponible', trab: 'Trabajando', atr: 'Atrasado' };
  const vencida = (t) => new Date(t.entrega) < Date.now();
  const estadoDe = (id) => { const p = pendientes(id); if (p.some(vencida)) return 'atr'; return p.length ? 'trab' : 'libre'; };
  const restante = (iso) => { const ms = new Date(iso) - Date.now(), a = Math.abs(ms), d = Math.floor(a / 864e5), h = Math.floor((a % 864e5) / 36e5), m = Math.floor((a % 36e5) / 6e4);
    const t = d ? `${d} d ${h} h` : h ? `${h} h ${m} min` : `${m} min`; return ms < 0 ? { txt: `Vencida hace ${t}`, venc: true } : { txt: `Entrega en ${t}`, venc: false }; };
  const fmt = (iso) => new Date(iso).toLocaleString('es-CO', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ETQ = {};
  function render() {
    const pend = tareas.filter((t) => t.estado === 'pendiente');
    $('of-kact').textContent = pend.length; $('of-kven').textContent = pend.filter(vencida).length; $('of-kok').textContent = tareas.filter((t) => t.estado === 'entregada').length;
    $('of-deps').innerHTML = DEPTOS.map((d) => { const n = pend.filter((t) => t.dept === d.id).length; return `<button type="button" class="of-dep ${d.id === seleccion ? 'sel' : ''}" data-id="${d.id}"><i style="background:${d.color}"></i>${d.nombre}<em>${n || ''}</em></button>`; }).join('');
    $('of-deps').querySelectorAll('.of-dep').forEach((b) => b.addEventListener('click', () => seleccionar(b.dataset.id, true)));
    const d = DEP[seleccion], est = estadoDe(seleccion);
    $('of-ficha').innerHTML = `<h4><i style="width:10px;height:10px;border-radius:50%;background:${d.color};display:inline-block"></i>${d.nombre}<span class="of-est ${est}">${NOMBRE_EST[est]}</span></h4>
      <p><b>${d.agente}</b> · ${d.piso === 6 ? 'Penthouse' : 'Piso ' + d.piso}</p><p>${d.desc}</p><p>Ahora: <b id="of-actividad">—</b></p>`;
    $('of-ttitulo').textContent = `Tareas de ${d.nombre}`;
    const mias = tareas.filter((t) => t.dept === seleccion).sort((a, b) => (a.estado > b.estado) - (a.estado < b.estado) || new Date(a.entrega) - new Date(b.entrega));
    $('of-tareas').innerHTML = mias.length ? mias.map((t) => { const r = restante(t.entrega), hecha = t.estado === 'entregada';
      return `<div class="of-t ${hecha ? 'hecha' : ''}" style="--c:${d.color}"><div class="tt">${esc(t.titulo)}</div>
        <div class="mm"><span class="of-pri ${esc(t.pri)}">${esc(t.pri)}</span><span class="${hecha ? 'ok' : r.venc ? 'venc' : ''}">${hecha ? 'Entregada' : r.txt}</span><span>· ${fmt(t.entrega)}</span>${t.por ? `<span>· ${esc(t.por)}</span>` : ''}
        <span class="of-acc">${hecha ? '' : `<button type="button" data-ok="${esc(t.id)}">Entregada</button>`}<button type="button" data-del="${esc(t.id)}">Quitar</button></span></div></div>`; }).join('')
      : '<div class="of-vacio">Este departamento no tiene tareas. Asígnale una arriba.</div>';
    $('of-tareas').querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', () => { const t = tareas.find((x) => String(x.id) === b.dataset.ok); if (!t) return; t.estado = 'entregada'; render(); aviso('Tarea entregada'); sincronizar(Almacen.guardar(t)); }));
    $('of-tareas').querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { if (!confirm('¿Quitar esta tarea?')) return; tareas = tareas.filter((x) => String(x.id) !== b.dataset.del); render(); sincronizar(Almacen.borrar(b.dataset.del)); }));
    DEPTOS.forEach((x) => { const n = ETQ[x.id]; if (!n) return; const p = pend.filter((t) => t.dept === x.id), v = p.some(vencida);
      n.className = 'of-etq' + (x.id === seleccion ? ' sel' : ''); n.innerHTML = `<i style="background:${x.color}"></i>${x.nombre}${p.length ? `<b class="${v ? 'venc' : ''}">${p.length}</b>` : ''}`; });
  }
  let motor = null;
  function seleccionar(id, mover) { seleccion = id; render(); if (mover && motor) { motor.enfocar(id); motor.interior(true); } }
  function aviso(t) { const el = $('of-toast'); el.textContent = t; el.classList.add('on'); clearTimeout(aviso.t); aviso.t = setTimeout(() => el.classList.remove('on'), 2400); }
  const p2 = (n) => String(n).padStart(2, '0');
  const aInput = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}T${p2(d.getHours())}:${p2(d.getMinutes())}`;
  $('of-fentrega').value = aInput(new Date(Date.now() + 864e5));
  $('of-rap').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { $('of-fentrega').value = aInput(new Date(Date.now() + b.dataset.h * 36e5)); }));
  $('of-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const titulo = $('of-ftarea').value.trim(); const ent = new Date($('of-fentrega').value);
    if (!titulo || isNaN(ent)) return;
    const t = { id: 't' + Date.now().toString(36), dept: seleccion, titulo, entrega: ent.toISOString(), pri: $('of-fpri').value, estado: 'pendiente', creada: new Date().toISOString(), por: quien() };
    tareas.push(t); $('of-ftarea').value = ''; render();
    if (motor) { motor.enfocar(seleccion); motor.interior(true); }
    aviso(seleccion === 'juntas' ? 'Reunión convocada: los agentes libres van a la sala de juntas' : `Tarea asignada a ${DEP[seleccion].nombre}`);
    sincronizar(Almacen.guardar(t));
  });
  setInterval(() => { if (!seccion.hidden) render(); }, 30000);
  render();

  /* ---------------- arranque perezoso del 3D ---------------- */
  const cargarThree = () => new Promise((ok, mal) => {
    if (window.THREE) return ok(window.THREE);
    const fuentes = ['three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'];
    const probar = (i) => { if (i >= fuentes.length) return mal(new Error('sin three')); const sc = document.createElement('script'); sc.src = fuentes[i]; sc.onload = () => (window.THREE ? ok(window.THREE) : probar(i + 1)); sc.onerror = () => { sc.remove(); probar(i + 1); }; document.head.appendChild(sc); };
    probar(0);
  });
  let arrancando = false, primeraCarga = false;
  const alMostrar = () => {
    if (seccion.hidden) { if (motor) motor.pausar(); return; }
    if (!primeraCarga) { primeraCarga = true; cargarTareas(); } else if (!sinServidor) cargarTareas();
    if (motor) { motor.seguir(); return; }
    if (arrancando) return; arrancando = true;
    cargarThree().then((THREE) => { motor = crearMotor(THREE); $('of-carga').remove(); motor.seguir(); })
      .catch(() => { $('of-carga').textContent = 'Este dispositivo no pudo cargar el 3D.'; });
  };
  new MutationObserver(alMostrar).observe(seccion, { attributes: true, attributeFilter: ['hidden'] });
  if (!seccion.hidden) alMostrar();

  /* =====================================================================
     MOTOR 3D
     ===================================================================== */
  function crearMotor(THREE) {
    const cont = $('of-escena');
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    cont.insertBefore(renderer.domElement, cont.firstChild);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x9fb8d0, 120, 420);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 900);
    const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a4030, 0.5); scene.add(hemi);
    const sol = new THREE.DirectionalLight(0xffffff, 1.2); sol.castShadow = true; const sm = window.innerWidth < 900 ? 2048 : 4096; sol.shadow.mapSize.set(sm, sm); sol.shadow.normalBias = 0.03;
    Object.assign(sol.shadow.camera, { left: -45, right: 45, top: 45, bottom: -30, near: 1, far: 260 }); sol.shadow.bias = -0.0005;
    scene.add(sol); scene.add(sol.target);
    const luna = new THREE.DirectionalLight(0x8fa8ff, 0); luna.position.set(60, 80, -40); scene.add(luna);

    const C = (h) => new THREE.Color(h);
    const lerpC = (a, b, t) => a.clone().lerp(b, t);
    function tex(w, h, f) { const c = document.createElement('canvas'); c.width = w; c.height = h; f(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t; }
    const std = (color, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.7 }, o));
    function caja(w, h, d, mat, x, y, z, padre = scene, sombra = true) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = sombra; m.receiveShadow = true; padre.add(m); return m; }
    function plano(w, h, mat, x, y, z, rx = 0, ry = 0, padre = scene) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); m.receiveShadow = true; padre.add(m); return m; }

    const texLed = tex(4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, '#ff5a12'); gr.addColorStop(0.6, '#ff9a2a'); gr.addColorStop(1, '#ffe07a'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const texHalo = tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,190,110,.95)'); gr.addColorStop(0.4, 'rgba(255,140,50,.35)'); gr.addColorStop(1, 'rgba(255,120,30,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const texGota = tex(32, 32, (g) => { const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); });
    function texPantalla(color, tipo) {
      return tex(512, 288, (g, w, h) => {
        g.fillStyle = '#0a1124'; g.fillRect(0, 0, w, h); g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3;
        if (tipo === 'flujo') { const n = [[60, 60], [200, 60], [340, 60], [200, 170], [340, 170], [460, 230]];
          g.globalAlpha = 0.6; g.beginPath(); [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [2, 4]].forEach(([a, b]) => { g.moveTo(...n[a]); g.lineTo(...n[b]); }); g.stroke();
          g.globalAlpha = 1; n.forEach(([x, y]) => g.fillRect(x - 34, y - 16, 68, 32)); }
        else { for (let i = 0; i < 9; i++) { const bh = 30 + Math.random() * 150; g.globalAlpha = 0.85; g.fillRect(30 + i * 36, h - 30 - bh, 22, bh); }
          g.globalAlpha = 1; g.beginPath(); g.moveTo(350, 200); for (let x = 350; x < 490; x += 20) g.lineTo(x, 60 + Math.random() * 120); g.stroke();
          g.font = '700 34px Inter,sans-serif'; g.fillText(tipo === 'global' ? 'ROAS 2.4' : '+12%', 350, 50); }
      });
    }
    const texLibros = tex(512, 512, (g, w, h) => { g.fillStyle = '#3b2a1e'; g.fillRect(0, 0, w, h); const cols = ['#8b2e2e', '#2e5b8b', '#d9a441', '#3f7a4a', '#e9e2d0', '#6a3d7a', '#c45a2a'];
      for (let r = 0; r < 5; r++) { let x = 6; const y = r * (h / 5); g.fillStyle = '#24190f'; g.fillRect(0, y + h / 5 - 10, w, 10);
        while (x < w - 10) { const bw = 10 + Math.random() * 16, bh = h / 5 - 22 - Math.random() * 22; g.fillStyle = cols[(Math.random() * cols.length) | 0]; g.fillRect(x, y + h / 5 - 10 - bh, bw, bh); x += bw + 2; } } });
    const texCajas = tex(512, 512, (g, w) => { g.fillStyle = '#e9e4da'; g.fillRect(0, 0, w, w); const cols = ['#ff6fae', '#ffc93c', '#4fb3ff', '#ffffff', '#c9b28f'];
      for (let r = 0; r < 4; r++) { g.fillStyle = '#9a9388'; g.fillRect(0, r * 128 + 118, w, 10); for (let c = 0; c < 5; c++) if (Math.random() < 0.8) { g.fillStyle = cols[(Math.random() * 5) | 0]; const bw = 60 + Math.random() * 30; g.fillRect(10 + c * 100, r * 128 + 118 - bw * 0.8, bw, bw * 0.8); } } });
    const texLetrero = () => tex(1600, 360, (g, w, h) => { g.clearRect(0, 0, w, h); g.font = '800 250px Sora, Inter, sans-serif'; g.textBaseline = 'middle';
      const a = 'Idea', b = 'Lab', wa = g.measureText(a).width, wb = g.measureText(b).width, x = w / 2 - (wa + wb) / 2;
      g.fillStyle = '#ffffff'; g.fillText(a, x, h / 2); const gr = g.createLinearGradient(x + wa, 0, x + wa + wb, 0); gr.addColorStop(0, '#ff6a1a'); gr.addColorStop(1, '#ffd23c'); g.fillStyle = gr; g.fillText(b, x + wa, h / 2); });

    const M = {
      piedra: std(0xe9e4dc, { roughness: 0.85 }), piedra2: std(0xd6cfc4, { roughness: 0.9 }),
      losa: std(0x2a2d35, { roughness: 0.6 }), bronce: std(0x3b3128, { metalness: 0.7, roughness: 0.35 }),
      madera: std(0xa57a52, { roughness: 0.55 }), maderaOsc: std(0x5a3a26, { roughness: 0.5 }),
      marmol: std(0xf2efe9, { roughness: 0.25 }), blanco: std(0xf3f4f8, { roughness: 0.35 }), negro: std(0x1d2030, { roughness: 0.5 }),
      tela: std(0x34405e, { roughness: 0.95 }), telaClara: std(0xcfc6b6, { roughness: 0.95 }),
      hoja: std(0x3f8f4a, { roughness: 0.85 }), hoja2: std(0x2f7a3c, { roughness: 0.85 }), tronco: std(0x6b4a30),
      led: new THREE.MeshBasicMaterial({ map: texLed, toneMapped: false }),
      libros: std(0xffffff, { map: texLibros, roughness: 0.8 }), cajas: std(0xffffff, { map: texCajas, roughness: 0.8 }),
    };
    /* ---- texturas realistas generadas en el navegador ---- */
    const rnd = (a, b) => a + Math.random() * (b - a);
    function texRep(t, rx, ry) { const c = t.clone(); c.needsUpdate = true; c.wrapS = c.wrapT = THREE.RepeatWrapping; c.repeat.set(rx, ry); return c; }
    const texTravertino = tex(1024, 1024, (g, w, h) => {
      g.fillStyle = '#d9cebd'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,100,80' : '255,250,240'},${rnd(0.03, 0.09)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 5), rnd(1, 2)); }
      for (let i = 0; i < 160; i++) { g.strokeStyle = `rgba(140,120,95,${rnd(0.04, 0.12)})`; g.lineWidth = rnd(0.5, 2.5); const y = rnd(0, h); g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 64) g.lineTo(x, y + rnd(-3, 3)); g.stroke(); }
      g.strokeStyle = 'rgba(90,78,64,.35)'; g.lineWidth = 2;
      for (let r = 0; r < 4; r++) { const y = r * 256; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); const off = r % 2 ? 0 : 256; for (let x = off; x < w; x += 512) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 256); g.stroke(); } }
    });
    const texMadera = tex(256, 1024, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#7a4a28'); gr.addColorStop(0.5, '#9a6438'); gr.addColorStop(1, '#7a4a28'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,30,12' : '190,130,80'},${rnd(0.08, 0.25)})`; g.lineWidth = rnd(0.6, 2.2); const x0 = rnd(0, w), f = rnd(0.002, 0.01), a = rnd(2, 10);
        g.beginPath(); for (let y = 0; y <= h; y += 8) g.lineTo(x0 + Math.sin(y * f) * a, y); g.stroke(); }
    });
    const texConcreto = tex(512, 512, (g, w, h) => { g.fillStyle = '#7d7f84'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 12000; i++) { const v = rnd(80, 170) | 0; g.fillStyle = `rgba(${v},${v},${v + 4},${rnd(0.05, 0.18)})`; g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(1, 3)); } });
    const texPasto = tex(512, 512, (g, w, h) => { g.fillStyle = '#4f7d3a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26000; i++) { const k = Math.random(); g.fillStyle = k < 0.33 ? 'rgba(98,140,64,.5)' : k < 0.66 ? 'rgba(52,92,38,.5)' : 'rgba(130,160,80,.35)'; g.fillRect(rnd(0, w), rnd(0, h), 1.5, rnd(2, 6)); } });
    const texAdoquin = tex(512, 512, (g, w, h) => { const n = 4, s = w / n;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const v = rnd(196, 222) | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.fillRect(i * s, j * s, s, s);
        for (let k = 0; k < 300; k++) { g.fillStyle = `rgba(120,110,95,${rnd(0.04, 0.12)})`; g.fillRect(i * s + rnd(0, s), j * s + rnd(0, s), 2, 2); } }
      g.strokeStyle = 'rgba(80,72,62,.55)'; g.lineWidth = 3; for (let i = 0; i <= n; i++) { g.beginPath(); g.moveTo(i * s, 0); g.lineTo(i * s, h); g.stroke(); g.beginPath(); g.moveTo(0, i * s); g.lineTo(w, i * s); g.stroke(); } });
    const texAsfalto = tex(512, 512, (g, w, h) => { g.fillStyle = '#2c2d31'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 20000; i++) { const v = rnd(30, 110) | 0; g.fillStyle = `rgba(${v},${v},${v},${rnd(0.1, 0.4)})`; g.fillRect(rnd(0, w), rnd(0, h), 1.5, 1.5); } });
    M.piedra.map = texRep(texTravertino, 2, 3); M.piedra.color.set(0xffffff); M.piedra.roughness = 0.82; M.piedra.needsUpdate = true;
    M.losa.map = texRep(texConcreto, 6, 1); M.losa.color.set(0x55555a); M.losa.needsUpdate = true;
    M.madera.map = texRep(texMadera, 1, 1); M.madera.color.set(0xffffff); M.madera.needsUpdate = true;

    /* ---- materiales de la fachada (se desvanecen al ver el interior) ---- */
    const capaFachada = [];
    const fmat = (m) => { m.transparent = true; m.userData.base = m.opacity; capaFachada.push(m); return m; };
    const Mf = {
      travertino: fmat(std(0xffffff, { map: texRep(texTravertino, 1, 4), roughness: 0.8 })),
      piedra: fmat(std(0xece6dc, { map: texRep(texTravertino, 3, 5), roughness: 0.85 })),
      madera: fmat(std(0xffffff, { map: texRep(texMadera, 1, 1), roughness: 0.55 })),
      marco: fmat(std(0x26262a, { metalness: 0.7, roughness: 0.35 })),
      ventana: fmat(new THREE.MeshStandardMaterial({ color: 0x1e232b, metalness: 0.9, roughness: 0.06, emissive: 0xffb46a, emissiveIntensity: 0.2 })),
      fondoListones: fmat(new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8, emissive: 0xffa555, emissiveIntensity: 0.2 })),
    };
    const vidrioFachada = fmat(new THREE.MeshStandardMaterial({ color: 0xa9bccf, metalness: 0.95, roughness: 0.04, opacity: 0.34, emissive: 0xffc27a, emissiveIntensity: 0, depthWrite: false }));
    const vidrioClaro = new THREE.MeshStandardMaterial({ color: 0xc9deef, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false });
    const vidrioBaranda = new THREE.MeshStandardMaterial({ color: 0xd8eef8, metalness: 0.8, roughness: 0.03, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });

    /* ---- cielo, estrellas, nubes ---- */
    const cieloMat = new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: C('#2f7fe0') }, hor: { value: C('#bcdcf5') }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: C('#ffffff') }, sunVis: { value: 1 }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, moonVis: { value: 0 } },
      vertexShader: 'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader: `uniform vec3 top,hor,sunCol,sunDir,moonDir;uniform float sunVis,moonVis;varying vec3 vP;
        void main(){float h=clamp(vP.y,0.,1.);vec3 c=mix(hor,top,pow(h,.5));if(vP.y<0.)c=hor*.75;
        float s=max(dot(vP,normalize(sunDir)),0.);c+=sunCol*(pow(s,900.)*4.+pow(s,10.)*.35)*sunVis;
        float m=max(dot(vP,normalize(moonDir)),0.);c+=vec3(.9,.93,1.)*pow(m,1800.)*3.*moonVis;gl_FragColor=vec4(c,1.);}` });
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), cieloMat); scene.add(cielo);
    // reflejos: el cielo se refleja en vidrios, metal y agua
    const pmrem = new THREE.PMREMGenerator(renderer); const escenaCielo = new THREE.Scene();
    escenaCielo.add(new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16), cieloMat));
    let rtCielo = null, proxReflejo = 0;
    const actualizarReflejos = () => { const rt = pmrem.fromScene(escenaCielo, 0, 0.1, 100); scene.environment = rt.texture; if (rtCielo) rtCielo.dispose(); rtCielo = rt; };
    const estrellasGeo = new THREE.BufferGeometry(); { const p = []; for (let i = 0; i < 900; i++) { const t = Math.random() * Math.PI * 2, u = Math.random() * 0.9 + 0.08, r = 560; p.push(r * Math.sqrt(1 - u * u) * Math.cos(t), r * u, r * Math.sqrt(1 - u * u) * Math.sin(t)); } estrellasGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); }
    const estrellas = new THREE.Points(estrellasGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false })); scene.add(estrellas);
    const nubeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 });
    const nubeGeo = new THREE.IcosahedronGeometry(1, 2); { const p = nubeGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + rnd(-0.12, 0.12); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } nubeGeo.computeVertexNormals(); }
    const nubes = [];
    for (let i = 0; i < 16; i++) { const g = new THREE.Group(); const n = 6 + ((Math.random() * 6) | 0);
      for (let j = 0; j < n; j++) { const s = new THREE.Mesh(nubeGeo, nubeMat); const r = rnd(5, 11); s.scale.set(r * 1.3, r * 0.6, r); s.position.set(j * 6 - n * 3 + rnd(-2, 2), rnd(0, 4), rnd(-4, 4)); g.add(s); }
      g.position.set(rnd(-280, 280), rnd(80, 120), rnd(-240, 60)); g.userData.v = rnd(1, 3); scene.add(g); nubes.push(g); }

    /* ---- montañas y terreno (como los alrededores de Pereira) ---- */
    const ruido = (x, z) => Math.sin(x * 0.011 + 1.3) * Math.cos(z * 0.009 + 0.4) * 0.55 + Math.sin(x * 0.027 + z * 0.021) * 0.28 + Math.sin(x * 0.061 - z * 0.047 + 2) * 0.12 + Math.cos(x * 0.13 + z * 0.11) * 0.05;
    const tg = new THREE.PlaneGeometry(1500, 1500, 180, 180); tg.rotateX(-Math.PI / 2);
    { const p = tg.attributes.position, col = []; const verde = C('#4c7436'), bosque = C('#2f4f2a'), roca = C('#6e6a60');
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z - 20);
        const m = THREE.MathUtils.smoothstep(r, 170, 380); const h = m * (40 + 120 * Math.max(0, ruido(x, z) + 0.45)) * (0.7 + 0.3 * Math.sin(Math.atan2(z, x) * 3));
        p.setY(i, h - (r < 160 ? 0.02 : 0)); const c = h < 25 ? verde.clone().lerp(bosque, h / 25) : h < 110 ? bosque.clone().lerp(roca, (h - 25) / 85) : roca;
        col.push(c.r, c.g, c.b); }
      tg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); tg.computeVertexNormals(); }
    const terrenoMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, emissive: 0xffffff, emissiveIntensity: 0 });
    const terreno = new THREE.Mesh(tg, terrenoMat); terreno.receiveShadow = true; scene.add(terreno);
    const pastoMat = std(0xffffff, { map: texRep(texPasto, 60, 60), roughness: 1 });
    const suelo = new THREE.Mesh(new THREE.CircleGeometry(165, 64), pastoMat); suelo.rotation.x = -Math.PI / 2; suelo.position.y = 0.01; suelo.receiveShadow = true; scene.add(suelo);

    /* ---- árboles más naturales ---- */
    const HOJAS = ['#3e6b2f', '#4f7f36', '#2f5a28', '#5c8a3e'].map((c) => { const m = std(c, { roughness: 0.9 }); m.userData.base = C(c); return m; });
    const copaGeos = [0, 1, 2].map(() => { const g = new THREE.IcosahedronGeometry(1, 1); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + rnd(-0.22, 0.22); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } g.computeVertexNormals(); return g; });
    const corteza = std(0x5b4433, { roughness: 0.95 });
    function arbol(x, z, s = 1) { const g = new THREE.Group(); g.position.set(x, 0, z); g.scale.setScalar(s); g.rotation.y = rnd(0, 6);
      const t = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.24, 3, 7), corteza); t.position.y = 1.5; t.castShadow = true; g.add(t);
      [[0.5, 2.3, 0.4], [-0.5, 2.6, -0.3]].forEach(([a, b, c]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 1.4, 5), corteza); r.position.set(a * 0.5, b, c * 0.5); r.rotation.set(c, 0, -a); g.add(r); });
      for (let i = 0; i < 13; i++) { const f = new THREE.Mesh(copaGeos[i % 3], HOJAS[(Math.random() * 4) | 0]); const r = rnd(0.55, 1.05);
        f.scale.set(r, r * 0.85, r); f.position.set(rnd(-1.1, 1.1), 3.3 + rnd(-0.6, 1.0), rnd(-1.1, 1.1)); f.castShadow = true; g.add(f); }
      scene.add(g); return g; }
    function arbusto(x, z, s = 1) { for (let i = 0; i < 4; i++) { const f = new THREE.Mesh(copaGeos[i % 3], HOJAS[(i + 1) % 4]); const r = rnd(0.35, 0.6) * s; f.scale.set(r * 1.3, r, r); f.position.set(x + rnd(-0.6, 0.6) * s, r * 0.7, z + rnd(-0.3, 0.3)); f.castShadow = true; scene.add(f); } }

    /* ---- terreno: jardín, piscina, muro con portón, calle ---- */
    const adoquin = std(0xffffff, { map: texRep(texAdoquin, 12, 6), roughness: 0.75 });
    plano(48, 24, adoquin, 0, 0.02, 2, -Math.PI / 2);
    plano(4, 18, std(0xffffff, { map: texRep(texAdoquin, 1, 4.5), roughness: 0.75 }), 0, 0.03, 21, -Math.PI / 2);
    plano(400, 10, std(0xffffff, { map: texRep(texAsfalto, 60, 2), roughness: 0.9 }), 0, 0.02, 40, -Math.PI / 2);
    for (let x = -196; x < 200; x += 8) caja(3.2, 0.01, 0.16, M.blanco, x, 0.035, 40, scene, false);
    plano(400, 2.4, std(0xffffff, { map: texRep(texAdoquin, 100, 1), roughness: 0.75 }), 0, 0.03, 34.2, -Math.PI / 2);
    caja(400, 0.18, 0.2, M.piedra2, 0, 0.09, 35.4, scene, false);
    plano(18, 10, std(0xffffff, { map: texRep(texAdoquin, 4.5, 2.5), roughness: 0.75 }), -17, 0.03, 20, -Math.PI / 2);
    const aguaMat = new THREE.MeshStandardMaterial({ color: 0x1e8fa6, roughness: 0.03, metalness: 0.6, emissive: 0x0a4a5a, emissiveIntensity: 0.25 });
    plano(14, 6, aguaMat, -17, 0.06, 20, -Math.PI / 2);
    caja(14.4, 0.25, 0.3, M.marmol, -17, 0.12, 16.9); caja(14.4, 0.25, 0.3, M.marmol, -17, 0.12, 23.1); caja(0.3, 0.25, 6.2, M.marmol, -24.1, 0.12, 20); caja(0.3, 0.25, 6.2, M.marmol, -9.9, 0.12, 20);
    [-21, -18, -15, -12].forEach((x) => { caja(0.8, 0.25, 1.8, M.blanco, x, 0.35, 25.2); caja(0.8, 0.5, 0.1, M.blanco, x, 0.55, 26.1); });
    [[11, 18], [17, 23], [23, 16], [-28, 13], [-28, 27], [27, 27], [8, 27], [-8, 28], [30, 8], [-31, 4]].forEach(([x, z]) => arbol(x, z, rnd(1, 1.5)));
    [[14, 20], [19, 19]].forEach(([x, z]) => { caja(2.4, 0.12, 0.7, M.madera, x, 0.55, z); caja(2.2, 0.5, 0.1, M.negro, x, 0.27, z); });
    // muro de piedra con portón de listones y puerta de madera (como la referencia)
    const faroles = [];
    const luzPiso = (x, y, z, s = 2.6) => { const b = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.06, 0.18), new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false })); b.position.set(x, y, z); scene.add(b);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); h.scale.set(s, s * 1.4, 1); h.position.set(x, y + s * 0.4, z + 0.05); scene.add(h); faroles.push({ b, h }); };
    const piedraMuro = std(0xffffff, { map: texRep(texTravertino, 6, 1), roughness: 0.85 });
    [[-40, -6.5], [9.8, 40]].forEach(([a, b]) => { caja(b - a, 2.3, 0.5, piedraMuro, (a + b) / 2, 1.15, 31); for (let x = a + 2; x < b - 1; x += 5) { luzPiso(x, 0.05, 31.6); arbusto(x + 1.2, 32.1, 0.8); } });
    [-6.5, 6.5].forEach((x) => caja(1, 2.9, 0.9, piedraMuro, x, 1.45, 31));
    caja(12, 2.3, 0.08, std(0xffffff, { map: texRep(texMadera, 8, 1), roughness: 0.6 }), 0, 1.2, 30.85);
    for (let x = -5.8; x <= 5.8; x += 0.32) caja(0.05, 2.3, 0.07, M.negro, x, 1.2, 31.02, scene, false);
    for (let y = 0.3; y <= 2.2; y += 0.48) caja(12, 0.04, 0.07, M.negro, 0, y, 31.04, scene, false);
    caja(3.3, 3.2, 1.4, piedraMuro, 8.2, 1.6, 31); // pórtico de la puerta peatonal
    caja(1.2, 2.5, 0.06, std(0xffffff, { map: texRep(texMadera, 2, 1), roughness: 0.5 }), 8.2, 1.25, 31.72);
    caja(0.04, 0.5, 0.05, M.bronce, 8.65, 1.25, 31.78, scene, false);
    const placa = plano(0.9, 0.22, new THREE.MeshBasicMaterial({ map: texLetrero(), transparent: true, toneMapped: false }), 8.2, 2.85, 31.71);
    luzPiso(7.4, 0.05, 32); luzPiso(9, 0.05, 32);
    for (let x = -60; x <= 60; x += 15) { caja(0.14, 4.6, 0.14, M.negro, x, 2.3, 35.6, scene, false); caja(0.9, 0.08, 0.12, M.negro, x + 0.4, 4.6, 35.6, scene, false);
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.2), new THREE.MeshBasicMaterial({ color: 0xffe2b8, toneMapped: false })); b.position.set(x + 0.7, 4.54, 35.6); scene.add(b);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: texHalo, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); h.scale.set(4, 4, 1); h.position.copy(b.position); scene.add(h); faroles.push({ b, h }); }
    // carro estacionado (genérico)
    { const g = new THREE.Group(); g.position.set(22.5, 0, 37.2); scene.add(g);
      const pintura = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.9, roughness: 0.25 }); const vid = new THREE.MeshStandardMaterial({ color: 0x0c0f14, metalness: 1, roughness: 0.05 });
      caja(4.6, 0.62, 1.86, pintura, 0, 0.62, 0, g); caja(2.5, 0.55, 1.62, vid, -0.2, 1.18, 0, g); caja(2.3, 0.08, 1.6, pintura, -0.2, 1.48, 0, g);
      [[-1.5, 0.95], [1.5, 0.95], [-1.5, -0.95], [1.5, -0.95]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 20), M.negro); r.rotation.x = Math.PI / 2; r.position.set(x, 0.36, z); g.add(r); });
      [-0.65, 0.65].forEach((z) => { const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.4), new THREE.MeshBasicMaterial({ color: 0xeef4ff, toneMapped: false })); f.position.set(2.31, 0.75, z); g.add(f); }); }

    /* ---- edificio: estilo residencial de lujo ---- */
    const W = 36, D = 16, HP = 3.6, PISOS = 6, ZF = D / 2, TECHO = PISOS * HP;
    const XZ = { L: -10, R: 10, C: 0 };
    const sueloPiso = (f) => f * HP + 0.16;
    caja(1, TECHO + 0.4, D + 0.4, M.piedra, -W / 2, TECHO / 2, 0);
    caja(1, TECHO + 0.4, D + 0.4, M.piedra, W / 2, TECHO / 2, 0);
    caja(W, TECHO, 0.6, M.piedra, 0, TECHO / 2, -ZF + 0.3);
    for (let p = 0; p <= PISOS; p++) caja(W + 0.6, 0.34, D + 0.6, M.losa, 0, p * HP, 0.1);
    const fachada = new THREE.Group(); scene.add(fachada);
    const lineasLed = [], halosLed = [];
    const empotrada = (x, y, z) => { const l = new THREE.Mesh(new THREE.CircleGeometry(0.08, 10), new THREE.MeshBasicMaterial({ color: 0xffe6bf, toneMapped: false, transparent: true })); l.rotation.x = Math.PI / 2; l.position.set(x, y, z); scene.add(l); lineasLed.push(l); };
    // A: balcones en voladizo con baranda de vidrio (izquierda)
    const XA0 = -W / 2 - 0.3, XA1 = 1.2;
    for (let p = 1; p <= PISOS; p++) {
      const y = p * HP, x1 = p === PISOS ? W / 2 + 0.3 : XA1, ancho = x1 - XA0, cx = (XA0 + x1) / 2;
      caja(ancho, 0.42, 2.2, M.losa, cx, y, ZF + 1.3);
      plano(ancho - 0.2, 1.05, vidrioBaranda, cx, y + 0.74, ZF + 2.32);
      caja(ancho - 0.2, 0.05, 0.06, M.bronce, cx, y + 1.28, ZF + 2.32, scene, false);
      for (let x = XA0 + 1.6; x < x1 - 0.5; x += 3.4) empotrada(x, y - 0.215, ZF + 1.7);
      [XA0 + 2.4, XA1 - 1.8].forEach((x) => { caja(0.7, 0.6, 0.7, M.piedra2, x, y + 0.5, ZF + 1.75); arbusto(x, ZF + 1.75, 0.8); scene.children.slice(-4).forEach((f) => { f.position.y += y + 0.75; }); });
      if (p < PISOS) for (let i = 0; i < 6; i++) caja(0.07, HP - 0.4, 0.14, Mf.madera, XA0 + 0.6 + i * 0.16, y - HP / 2 + 0.2, ZF + 2.2, fachada); // listones
    }
    // ventanales de piso a techo
    for (let p = 0; p < PISOS; p++) {
      const y = p * HP + HP / 2, x1 = p === 0 ? W / 2 - 0.5 : XA1, ancho = x1 - (XA0 + 0.8), cx = (XA0 + 0.8 + x1) / 2;
      plano(ancho, HP - 0.34, vidrioFachada, cx, y, ZF + 0.15, 0, 0, fachada);
      for (let x = XA0 + 0.8; x <= x1 + 0.01; x += ancho / Math.round(ancho / 2.4)) caja(0.07, HP - 0.34, 0.1, Mf.marco, x, y, ZF + 0.18, fachada);
      caja(ancho, 0.06, 0.1, Mf.marco, cx, p * HP + 2.7, ZF + 0.18, fachada);
    }
    // B: panel de travertino con el nombre IdeaLab y luces que lo bañan desde abajo
    caja(5.2, TECHO - HP + 0.2, 1.3, Mf.travertino, 3.8, HP + (TECHO - HP) / 2, ZF + 0.6, fachada);
    const letrero = plano(4.3, (4.3 * 360) / 1600, new THREE.MeshBasicMaterial({ map: texLetrero(), transparent: true, toneMapped: false }), 3.8, HP * 3.3, ZF + 1.26, 0, 0, fachada);
    capaFachada.push(letrero.material); letrero.material.userData.base = 1;
    const texBano = tex(32, 256, (g, w, h) => { const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, 'rgba(255,190,120,.85)'); gr.addColorStop(0.35, 'rgba(255,170,90,.25)'); gr.addColorStop(1, 'rgba(255,160,80,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    [2.4, 3.8, 5.2].forEach((x) => { halosLed.push(plano(1.4, 4.5, new THREE.MeshBasicMaterial({ map: texBano, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), x, HP + 2.3, ZF + 1.27, 0, 0, fachada));
      halosLed.push(plano(1.2, 3.2, new THREE.MeshBasicMaterial({ map: texBano, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), x, HP * 3.3 - 0.2, ZF + 1.27, 0, 0, fachada)); });
    // C: celosía vertical de madera de arriba a abajo
    plano(2.6, TECHO - HP, Mf.fondoListones, 7.7, HP + (TECHO - HP) / 2, ZF + 0.3, 0, 0, fachada);
    for (let x = 6.55; x <= 8.85; x += 0.19) caja(0.08, TECHO - HP, 0.16, Mf.madera, x, HP + (TECHO - HP) / 2, ZF + 0.75, fachada);
    // D: volumen de piedra con ventanas angostas y apliques de luz
    caja(9.6, TECHO - HP + 0.2, 0.5, Mf.piedra, 13.9, HP + (TECHO - HP) / 2, ZF + 0.45, fachada);
    for (let p = 1; p < PISOS; p++) { const y = p * HP + 1.75;
      [11.4, 16.2].forEach((x) => { caja(1.15, 2.6, 0.12, Mf.marco, x, y, ZF + 0.72, fachada); plano(0.95, 2.4, Mf.ventana, x, y, ZF + 0.79, 0, 0, fachada); });
      caja(0.16, 0.34, 0.12, Mf.marco, 13.8, y + 0.9, ZF + 0.76, fachada);
      halosLed.push(plano(0.9, 1.8, new THREE.MeshBasicMaterial({ map: texHalo, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), 13.8, y + 0.9, ZF + 0.84, 0, 0, fachada)); }
    // lobby: entrada con marco
    caja(4, 0.25, 1.2, M.losa, -1.5, HP - 0.45, ZF + 1, scene);
    // ascensor panorámico
    const XA = 0, ZA = -1;
    caja(2.6, TECHO + HP, 0.08, vidrioClaro, XA, (TECHO + HP) / 2, ZA + 1.3, scene, false);
    caja(0.12, TECHO + HP, 0.12, M.bronce, XA - 1.3, (TECHO + HP) / 2, ZA + 1.3); caja(0.12, TECHO + HP, 0.12, M.bronce, XA + 1.3, (TECHO + HP) / 2, ZA + 1.3);
    caja(2.6, TECHO + HP, 0.08, M.piedra2, XA, (TECHO + HP) / 2, ZA - 1.3);
    const cabina = caja(2.3, 0.12, 2.3, M.bronce, XA, sueloPiso(0) - 0.02, ZA);
    // penthouse de ONY con gran techo en voladizo, luces empotradas y óculo con listones
    const yPH = TECHO + 0.16;
    plano(18, HP - 0.3, vidrioClaro, 0, yPH + HP / 2 - 0.1, -7); plano(18, HP - 0.3, vidrioClaro, 0, yPH + HP / 2 - 0.1, 1);
    plano(8, HP - 0.3, vidrioClaro, -9, yPH + HP / 2 - 0.1, -3, 0, Math.PI / 2); plano(8, HP - 0.3, vidrioClaro, 9, yPH + HP / 2 - 0.1, -3, 0, Math.PI / 2);
    caja(0.3, HP, 0.3, M.bronce, -9, yPH + HP / 2, 1); caja(0.3, HP, 0.3, M.bronce, 9, yPH + HP / 2, 1);
    plano(17.6, 7.6, M.madera, 0, yPH + 0.01, -3, -Math.PI / 2);
    { const x0 = -W / 2 - 1.2, x1 = W / 2 + 1.2, z0 = -ZF - 1, z1 = ZF + 3, ox = 7, oz = 4.4, orad = 2;
      const sh = new THREE.Shape(); sh.moveTo(x0, -z0); sh.lineTo(x1, -z0); sh.lineTo(x1, -z1); sh.lineTo(x0, -z1); sh.lineTo(x0, -z0);
      const hueco = new THREE.Path(); hueco.absarc(ox, -oz, orad, 0, Math.PI * 2, true); sh.holes.push(hueco);
      const techo = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: false, curveSegments: 40 }), [std(0xffffff, { map: texRep(texMadera, 0.08, 0.08), roughness: 0.6 }), std(0x24221f, { roughness: 0.5 })]);
      techo.rotation.x = -Math.PI / 2; techo.position.y = yPH + HP - 0.15; techo.castShadow = true; techo.receiveShadow = true; scene.add(techo);
      for (let x = x0 + 1.5; x < x1 - 1; x += 3.2) for (let z = 2; z < z1 - 0.5; z += 2.6) if (Math.hypot(x - ox, z - oz) > orad + 0.6) empotrada(x, yPH + HP - 0.16, z);
      for (let x = ox - orad + 0.2; x < ox + orad; x += 0.3) { const l = Math.sqrt(Math.max(0, orad * orad - (x - ox) ** 2)) * 2; if (l > 0.3) caja(0.08, 0.5, l, M.madera, x, yPH + HP + 0.2, oz, scene); }
      caja(1.6, 0.9, 1.6, M.piedra2, ox, yPH + 0.45, oz); const a = arbol(ox, oz, 1.15); a.position.y = yPH + 0.9;
    }
    [-14, 14].forEach((x) => { caja(0.8, 0.8, 0.8, M.piedra2, x, yPH + 0.4, 2.5); const a = arbol(x, 2.5, 0.6); a.position.y = yPH + 0.8; });
    [-5, -3].forEach((x) => caja(0.8, 0.25, 1.8, M.blanco, x, yPH + 0.3, 4.8));

    // interior
    const luces = {};
    const zonaLuz = (k, x, y, z) => { const l = new THREE.PointLight(0xffd9a8, 0.6, 16, 2); l.position.set(x, y - 0.8, z); scene.add(l);
      luces[k] = { luz: l, panel: plano(7, 3.2, new THREE.MeshBasicMaterial({ color: 0xfff1d8, toneMapped: false }), x, y - 0.18, z, Math.PI / 2) }; };
    for (let f = 0; f < PISOS; f++) { plano(W - 1.2, D - 0.8, f === 0 ? M.marmol : M.madera, 0, sueloPiso(f) + 0.005, 0, -Math.PI / 2);
      if (f > 0) { zonaLuz('L' + f, -10, (f + 1) * HP, 1); zonaLuz('R' + f, 10, (f + 1) * HP, 1); } }
    zonaLuz('lobbyL', -10, HP, 1); zonaLuz('lobbyR', 10, HP, 1); zonaLuz('ph', 0, yPH + HP, -3);
    const plantaMaceta = (x, y, z, s = 1) => { caja(0.5 * s, 0.6 * s, 0.5 * s, M.blanco, x, y + 0.3 * s, z); const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55 * s, 0), M.hoja); f.position.set(x, y + s, z); f.castShadow = true; scene.add(f); };
    const sofa = (x, y, z, rot = 0, mat = M.tela, ancho = 2.2) => { const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = rot; scene.add(g);
      caja(ancho, 0.45, 0.9, mat, 0, 0.22, 0, g); caja(ancho, 0.5, 0.2, mat, 0, 0.65, -0.38, g); caja(0.18, 0.35, 0.9, mat, -ancho / 2 + 0.09, 0.55, 0, g); caja(0.18, 0.35, 0.9, mat, ancho / 2 - 0.09, 0.55, 0, g); };
    const pantallaPared = (color, tipo, x, y, z, w = 4.2) => { plano(w, w * 0.5625, new THREE.MeshBasicMaterial({ map: texPantalla(color, tipo), toneMapped: false }), x, y, z); caja(w + 0.15, w * 0.5625 + 0.15, 0.06, M.negro, x, y, z - 0.04, scene, false); };
    const yDe = (f) => (f === 6 ? yPH : sueloPiso(f));
    const HOLOS = {};
    DEPTOS.forEach((d) => {
      const x = XZ[d.lado], y = yDe(d.piso), z = -2.2;
      const g = new THREE.Group(); g.position.set(x, y, 0); scene.add(g);
      plano(7, 4.6, std(new THREE.Color(d.color).multiplyScalar(0.35), { roughness: 1 }), 0, 0.02, -2.4, -Math.PI / 2, 0, g);
      if (d.id === 'juntas') {
        caja(6, 0.1, 2, M.maderaOsc, 0, 0.8, z + 1, g); caja(5, 0.75, 0.3, M.negro, 0, 0.4, z + 1, g);
        for (let i = -2; i <= 2; i++) { caja(0.5, 0.5, 0.5, M.negro, i * 1.2, 0.25, z - 0.3, g); caja(0.5, 0.5, 0.5, M.negro, i * 1.2, 0.25, z + 2.3, g); }
        pantallaPared('#e8e8f0', 'global', x, y + 2, -7.6, 5);
      } else {
        const ejecutivo = ['david', 'alejandra', 'ony'].includes(d.id);
        caja(ejecutivo ? 2.8 : 2.2, 0.08, 1, ejecutivo ? M.maderaOsc : M.madera, 0, 0.8, z, g);
        caja(ejecutivo ? 2.6 : 2, 0.75, 0.06, M.negro, 0, 0.4, z + 0.45, g);
        caja(0.6, 0.5, 0.55, M.negro, 0, 0.25, z - 1, g); caja(0.6, 0.8, 0.1, M.negro, 0, 0.85, z - 1.3, g);
        caja(0.5, 0.32, 0.04, M.negro, -0.5, 1.02, z - 0.2, g);
        HOLOS[d.id] = plano(1.3, 0.75, new THREE.MeshBasicMaterial({ map: texPantalla(d.color), transparent: true, opacity: 0.7, side: THREE.DoubleSide, toneMapped: false, depthWrite: false }), 1.3, 1.6, z + 0.1, 0, -0.5, g);
        pantallaPared(d.color, d.id === 'zapdata' ? 'flujo' : d.id === 'ony' ? 'global' : '', x, y + 2, d.piso === 6 ? -6.9 : -7.6, d.id === 'ony' ? 6 : 4.2);
        if (ejecutivo && d.id !== 'ony') { sofa(x + (d.lado === 'L' ? -5 : 5), y, -5.5, 0, M.telaClara, 2.6); plantaMaceta(x + (d.lado === 'R' ? -5 : 5), y, -6.5, 1.2); }
      }
      const bx = x + (d.lado === 'R' ? 4.8 : -4.8);
      if (d.id === 'investigacion' || d.id === 'mejoras') { caja(3.6, 3, 0.5, M.maderaOsc, bx, y + 1.5, -7.3); plano(3.4, 2.9, M.libros, bx, y + 1.5, -7.04); }
      if (d.id === 'modelado') { caja(3.6, 3, 0.5, M.piedra2, bx, y + 1.5, -7.3); plano(3.4, 2.9, M.cajas, bx, y + 1.5, -7.04); }
      if (d.id === 'creativo') { caja(0.05, 1.4, 0.05, M.negro, bx, y + 0.7, -3); const aro = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.05, 8, 32), new THREE.MeshBasicMaterial({ color: 0xfff4e0, toneMapped: false })); aro.position.set(bx, y + 1.7, -3); scene.add(aro);
        [['#ff5a5a', -1], ['#ffc93c', 0], ['#4fb3ff', 1]].forEach(([c, i]) => plano(1, 1.4, std(c), bx + i * 1.1, y + 1.8, -7.55)); }
      if (['campanas', 'ventas', 'zapdata'].includes(d.id)) plantaMaceta(bx, y, -6.5, 1.1);
    });
    { const y = sueloPiso(0); // lobby
      caja(4, 1.05, 1, M.marmol, -6, y + 0.52, 3); caja(4, 0.06, 0.02, M.led, -6, y + 0.9, 3.51, scene, false);
      sofa(-12, y, 2.2, Math.PI, M.tela); sofa(-14.2, y, 0.2, Math.PI / 2, M.tela); caja(1.6, 0.4, 1, M.maderaOsc, -12, y + 0.2, 0.4);
      caja(5, 1.1, 0.9, M.maderaOsc, 11, y + 0.55, -1); caja(5.2, 0.08, 1.1, M.marmol, 11, y + 1.12, -1);
      [9, 10.4, 11.8, 13.2].forEach((x) => { caja(0.4, 0.08, 0.4, M.negro, x, y + 0.75, 0.2); caja(0.06, 0.75, 0.06, M.negro, x, y + 0.37, 0.2); });
      caja(5, 2, 0.3, M.maderaOsc, 11, y + 2.4, -7.5);
      [-16.5, 16.5].forEach((x) => plantaMaceta(x, y, 6.5, 1.3));
      var nombreLobby = plano(6, (6 * 360) / 1600, new THREE.MeshBasicMaterial({ map: texLetrero(), transparent: true, toneMapped: false }), -9, y + 2.4, -7.64); }
    if (document.fonts) document.fonts.ready.then(() => { [letrero, nombreLobby, placa].forEach((m) => { m.material.map = texLetrero(); m.material.needsUpdate = true; }); });
    for (let f = 1; f < PISOS; f++) { const s = f % 2 ? -1 : 1, x = s * 15.2, y = sueloPiso(f);
      sofa(x - 0.9, y, 4.6, Math.PI * 0.15 * s + (Math.PI / 2) * s, M.telaClara, 1); sofa(x + 0.9, y, 4.6, (-Math.PI / 2) * s, M.telaClara, 1); caja(0.8, 0.4, 0.8, M.maderaOsc, x, y + 0.2, 4.6); plantaMaceta(x + s * 1.8, y, 6.6, 1); }
    sofa(-6, yPH, -5, 0, M.telaClara, 3); plantaMaceta(7.5, yPH, -6, 1.3);

    /* ---- agentes ---- */
    const texBurbujas = ['···', '¿?', '¡!', 'ROAS', 'idea'].map((s) => tex(128, 96, (g, w, h) => { g.fillStyle = 'rgba(255,255,255,.95)'; g.beginPath(); if (g.roundRect) g.roundRect(4, 4, w - 8, h - 30, 22); else g.rect(4, 4, w - 8, h - 30); g.fill();
      g.beginPath(); g.moveTo(w / 2 - 10, h - 27); g.lineTo(w / 2, h - 8); g.lineTo(w / 2 + 10, h - 27); g.fill(); g.fillStyle = '#13254f'; g.font = (s.length > 3 ? '700 30px' : '800 38px') + ' Inter,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, w / 2, (h - 26) / 2 + 4); }));
    function cuerpoRobot(color) { const g = new THREE.Group(), c = C(color);
      const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.62, 18), std(c, { roughness: 0.4 })); cuerpo.position.y = 0.55; cuerpo.castShadow = true; g.add(cuerpo);
      const pies = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.2, 14), M.negro); pies.position.y = 0.12; g.add(pies);
      const cab = new THREE.Group(); cab.position.y = 1.1; g.add(cab);
      const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 20), M.blanco); cabeza.castShadow = true; cab.add(cabeza);
      const visor = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.11, 0.06), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); visor.position.set(0, 0.02, 0.24); cab.add(visor);
      const ant = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), new THREE.MeshBasicMaterial({ color: c, toneMapped: false })); ant.position.y = 0.36; cab.add(ant);
      g.userData = { cab, ant, alto: 1.55 }; return g; }
    function cuerpoONY() { const g = new THREE.Group(); g.scale.setScalar(1.15);
      const verde = std(0x4cbf55, { roughness: 0.9 }), verdeO = std(0x2f9a3c, { roughness: 0.9 });
      const tallo = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.75, 16), std(0x9be07a, { roughness: 0.8 })); tallo.position.y = 0.42; tallo.castShadow = true; g.add(tallo);
      const cab = new THREE.Group(); cab.position.y = 0.8; g.add(cab);
      [[0, 0.3, 0, 0.46], [-0.4, 0.15, 0.05, 0.33], [0.4, 0.15, 0.05, 0.33], [-0.22, 0.55, -0.1, 0.3], [0.24, 0.57, -0.08, 0.31], [0, 0.2, 0.3, 0.28], [-0.3, 0.35, 0.25, 0.24], [0.3, 0.35, 0.25, 0.24]]
        .forEach(([x, y, z, r], i) => { const s = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 16), i % 2 ? verdeO : verde); s.position.set(x, y, z); s.castShadow = true; cab.add(s); });
      const ojo = std(0x101010, { roughness: 0.2 });
      [-0.11, 0.11].forEach((x) => { const o = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10), ojo); o.position.set(x, 0.57, 0.31); g.add(o); });
      [-0.2, 0.2].forEach((x) => { const r = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: 0xff8fa3 })); r.position.set(x, 0.49, 0.33); g.add(r); });
      const corbata = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.28, 0.03), std(0x0b1a3a)); corbata.position.set(0, 0.3, 0.31); g.add(corbata);
      const nudo = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.04), std(0xff7a1a)); nudo.position.set(0, 0.44, 0.32); g.add(nudo);
      g.userData = { cab, alto: 1.9 }; return g; }

    const LUGARES = [
      { id: 'sala', nombre: 'la sala del lobby', f: 0, x: -12, z: 0.8, r: 1.4 },
      { id: 'cafe', nombre: 'la cafetería', f: 0, x: 11, z: 0.9, r: 1.3 },
      { id: 'piscina', nombre: 'la piscina', f: 0, x: -17, z: 25.5, r: 2, afuera: true },
      { id: 'jardin', nombre: 'el jardín', f: 0, x: 16.5, z: 20.5, r: 1.6, afuera: true },
      { id: 'terraza', nombre: 'la terraza', f: 6, x: -4, z: 5.2, r: 1.6, aire: true },
      ...[1, 2, 3, 4, 5].map((f) => ({ id: 'descanso' + f, nombre: `la zona de descanso del piso ${f}`, f, x: (f % 2 ? -1 : 1) * 15.2, z: 3.2, r: 1.2 })),
    ];
    LUGARES.forEach((l) => { l.ocup = new Set(); });
    const JUNTAS = { f: 4, x: 10, z: -1.2 };
    const AGENTES = [];
    DEPTOS.filter((d) => !d.sinAgente).forEach((d) => {
      const g = d.id === 'ony' ? cuerpoONY() : cuerpoRobot(d.color); scene.add(g);
      const bur = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBurbujas[0], depthWrite: false, transparent: true })); bur.scale.set(0.9, 0.68, 1); bur.visible = false; scene.add(bur);
      const a = { d, g, bur, f: d.piso, x: XZ[d.lado] + (Math.random() - 0.5) * 4, z: 2 + Math.random() * 3, y: yDe(d.piso), ruta: [], meta: null, hasta: 0, fase: Math.random() * 9, actividad: '', hablaHasta: 0 };
      g.traverse((o) => { if (o.isMesh) o.userData.dept = d.id; });
      AGENTES.push(a);
    });

    let fac = 1, tiempoSim = 0, climaActual = 'soleado', diaFactor = 1, nieveAcum = 0, flash = 0, primerCuadro = true, interior = false;
    const esNoche = () => diaFactor < 0.25;
    const giro = (a, b, k) => { const d = ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI; return a + d * k; };
    function lugarLibre() {
      const ops = LUGARES.filter((l) => !((l.afuera || l.aire) && (climaActual === 'lluvia' || climaActual === 'nieve' || esNoche())) && l.ocup.size < 4);
      const conGente = ops.filter((l) => l.ocup.size > 0);
      const lista = conGente.length && Math.random() < 0.6 ? conGente : ops;
      return lista[(Math.random() * lista.length) | 0];
    }
    const soltar = (a) => { if (a.meta && a.meta.lugar) a.meta.lugar.ocup.delete(a); };
    function decidir(a) {
      const t = tiempoSim;
      if (pendientes(a.d.id).length) return { f: a.d.piso, x: XZ[a.d.lado], z: -3.2, mira: 0, tipo: 'trabajo', clave: 'mesa' };
      if (pendientes('juntas').length) { const i = AGENTES.indexOf(a), lado = i % 2 ? 1 : -1, k = ((i >> 1) % 5) - 2;
        return { f: JUNTAS.f, x: JUNTAS.x + k * 1.2, z: lado > 0 ? JUNTAS.z + 1.3 : JUNTAS.z - 1.3, mira: lado > 0 ? Math.PI : 0, tipo: 'reunion', clave: 'juntas' }; }
      if (a.meta && t < a.hasta && ['social', 'ronda', 'oficina'].includes(a.meta.tipo)) return a.meta;
      if (a.d.id === 'ony') {
        const trabajando = DEPTOS.filter((d) => d.id !== 'ony' && !d.sinAgente && pendientes(d.id).length);
        if (trabajando.length && Math.random() < 0.6) { const d = trabajando[(Math.random() * trabajando.length) | 0]; a.hasta = t + 14 + Math.random() * 10;
          return { f: d.piso, x: XZ[d.lado] + 0.6, z: -0.4, mira: Math.PI, tipo: 'ronda', clave: 'ronda' + d.id, visita: d }; }
        a.hasta = t + 25 + Math.random() * 20;
        return Math.random() < 0.6 ? { f: 6, x: 0, z: -3.2, mira: 0, tipo: 'oficina', clave: 'ph' } : { f: 6, x: -5.5, z: -4.2, mira: 0, tipo: 'oficina', clave: 'phsofa' };
      }
      const l = lugarLibre(); a.hasta = t + 18 + Math.random() * 25; const ang = Math.random() * Math.PI * 2;
      return { f: l.f, x: l.x + Math.cos(ang) * l.r, z: l.z + Math.sin(ang) * l.r * 0.7, tipo: 'social', clave: 'l' + l.id + ang.toFixed(2), lugar: l };
    }
    function planear(a, m) {
      const R = []; const w = (x, z) => R.push({ x, z }); let cx = a.x, cz = a.z, f = a.f;
      const alFrente = () => { if (cz > ZF + 0.2) { w(0, ZF + 3); w(0, 5.5); } else w(cx, 5.5); cx = 0; cz = 5.5; };
      if (m.f !== f) { alFrente(); w(0, 5.5); w(XA, ZA); R.push({ piso: m.f }); w(0, 5.5); cx = 0; cz = 5.5; f = m.f; }
      if (m.z > ZF + 0.5) { if (!(cx === 0 && cz === 5.5)) alFrente(); w(0, ZF + 3); w(m.x, m.z); }
      else { if (cz > ZF + 0.2) { w(0, ZF + 3); w(0, 5.5); cx = 0; cz = 5.5; }
        if (Math.sign(cx) !== Math.sign(m.x) || Math.abs(cx - m.x) > 6) { w(cx, 5.5); w(m.x, 5.5); }
        w(m.x, m.z); }
      a.ruta = R;
    }
    function actualizarAgente(a, dt, t) {
      if (!a.ruta.length && (!a.prox || t > a.prox)) { a.prox = t + 1; const m = decidir(a);
        if (!a.meta || m.clave !== a.meta.clave) { soltar(a); a.meta = m; if (m.lugar) m.lugar.ocup.add(a); planear(a, m); } }
      let caminando = false;
      if (a.ruta.length) { const p = a.ruta[0];
        if (p.piso !== undefined) { const yt = yDe(p.piso), dy = yt - a.y, v = 4 * dt; if (Math.abs(dy) <= v) { a.y = yt; a.f = p.piso; a.ruta.shift(); } else a.y += Math.sign(dy) * v; cabina.position.y = a.y - 0.08; }
        else { const dx = p.x - a.x, dz = p.z - a.z, dist = Math.hypot(dx, dz), v = (a.d.id === 'ony' ? 1.9 : 2.3) * dt;
          if (dist <= v) { a.x = p.x; a.z = p.z; a.ruta.shift(); } else { a.x += (dx / dist) * v; a.z += (dz / dist) * v; a.g.rotation.y = giro(a.g.rotation.y, Math.atan2(dx, dz), 0.2); caminando = true; } } }
      const m = a.meta || {}; const llego = !a.ruta.length;
      if (llego) {
        if (m.tipo === 'social' && m.lugar) { const otros = [...m.lugar.ocup].filter((o) => o !== a && !o.ruta.length);
          const cx = otros.length ? otros.reduce((s, o) => s + o.x, 0) / otros.length : m.lugar.x, cz = otros.length ? otros.reduce((s, o) => s + o.z, 0) / otros.length : m.lugar.z;
          a.g.rotation.y = giro(a.g.rotation.y, Math.atan2(cx - a.x, cz - a.z), 0.08); a.conversa = otros.length > 0; }
        else { a.conversa = m.tipo === 'reunion' || m.tipo === 'ronda'; if (m.mira !== undefined) a.g.rotation.y = giro(a.g.rotation.y, m.mira, 0.08); }
      } else a.conversa = false;
      const trabajando = llego && m.tipo === 'trabajo';
      const salto = caminando ? Math.abs(Math.sin(t * 9 + a.fase)) * 0.08 : trabajando ? Math.abs(Math.sin(t * 6 + a.fase)) * 0.02 : 0;
      a.g.position.set(a.x, a.y + salto, a.z); a.g.rotation.z = caminando ? Math.sin(t * 9 + a.fase) * 0.06 : 0;
      const u = a.g.userData;
      if (u.cab) { u.cab.rotation.y = trabajando ? Math.sin(t * 1.8 + a.fase) * 0.3 : a.conversa ? Math.sin(t * 1.2 + a.fase) * 0.25 : 0; u.cab.rotation.x = trabajando ? 0.15 : 0; }
      if (u.ant) { const atr = pendientes(a.d.id).some(vencida); u.ant.material.color.set(atr && Math.sin(t * 6) > 0 ? 0xff3b3b : a.d.color); }
      if (a.conversa && llego) { if (t > a.hablaHasta) { a.hablaHasta = t + 1.8 + Math.random() * 2.5; a.hablando = Math.random() < 0.55; a.bur.material.map = texBurbujas[(Math.random() * texBurbujas.length) | 0]; a.bur.material.needsUpdate = true; } a.bur.visible = a.hablando; }
      else a.bur.visible = false;
      a.bur.position.set(a.x, a.y + (u.alto || 1.6) + 0.45, a.z);
      a.actividad = !llego ? (a.meta && a.meta.f !== a.f ? 'Va en el ascensor o camino a otro piso' : 'Caminando')
        : m.tipo === 'trabajo' ? 'Trabajando en su escritorio' : m.tipo === 'reunion' ? 'En reunión en la sala de juntas'
        : m.tipo === 'ronda' ? `Revisando el trabajo de ${m.visita.nombre}` : m.tipo === 'oficina' ? 'En su oficina del penthouse'
        : m.lugar ? (a.conversa ? `Conversando en ${m.lugar.nombre}` : `Descansando en ${m.lugar.nombre}`) : '';
    }

    /* ---- hora y clima ---- */
    let velocidad = 1, climaManual = 'auto';
    let baseReal = Date.now(), baseSim = Date.now();
    const ahoraSim = () => new Date(baseSim + (Date.now() - baseReal) * velocidad);
    function climaDelDia(fecha) { const k = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`; let h = 2166136261;
      for (const c of k) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } const r = ((h >>> 0) % 1000) / 1000;
      return r < 0.42 ? 'soleado' : r < 0.64 ? 'nublado' : r < 0.87 ? 'lluvia' : 'nieve'; }
    const NOMBRE_CLIMA = { soleado: 'Soleado', nublado: 'Nublado', lluvia: 'Lluvia', nieve: 'Nieve' };
    const CLAVES = [[0, '#040817', '#0d1630', '#000000'], [4.8, '#060c22', '#141c3a', '#000000'], [5.8, '#2c3a73', '#e98a63', '#ff9a60'],
      [7, '#4b8bd6', '#cfe2f1', '#ffe2b8'], [12, '#2f7fe0', '#bcdcf5', '#ffffff'], [16, '#4583d0', '#d6e3ee', '#fff0d0'],
      [17.4, '#4c4c98', '#ff9a55', '#ffa050'], [18.3, '#2a2350', '#d4593c', '#ff6a30'], [19.2, '#0b1028', '#1d2040', '#000000'], [24, '#040817', '#0d1630', '#000000']];
    const claveEn = (h) => { for (let i = 0; i < CLAVES.length - 1; i++) { const a = CLAVES[i], b = CLAVES[i + 1]; if (h >= a[0] && h <= b[0]) { const t = (h - a[0]) / (b[0] - a[0]); return [1, 2, 3].map((j) => lerpC(C(a[j]), C(b[j]), t)); } } return [C('#040817'), C('#0d1630'), C('#000')]; };
    const GRIS = { nublado: [0.55, '#8f99a5', '#20242c'], lluvia: [0.78, '#6c7682', '#14171d'], nieve: [0.6, '#c9d2dc', '#2a3140'], soleado: [0, '#fff', '#000'] };
    const pastoV = C('#5d8a45'), pastoN = C('#eef2f7'), hojaV = C('#3f8f4a'), hojaN = C('#e4ebf0');
    const momento = (h) => (h < 5.3 ? 'Noche' : h < 7 ? 'Amanecer' : h < 16.6 ? 'Día' : h < 18.7 ? 'Atardecer' : 'Noche');
    const NL = 3500, lluviaGeo = new THREE.BufferGeometry(), lp = new Float32Array(NL * 6);
    for (let i = 0; i < NL; i++) { const x = (Math.random() - 0.5) * 130, y = Math.random() * 60, z = (Math.random() - 0.5) * 100 + 5; lp.set([x, y, z, x - 0.1, y - 0.9, z], i * 6); }
    lluviaGeo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    const lluvia = new THREE.LineSegments(lluviaGeo, new THREE.LineBasicMaterial({ color: 0xaabbd0, transparent: true, opacity: 0.45 })); lluvia.frustumCulled = false; scene.add(lluvia);
    const NN = 3500, nieveGeo = new THREE.BufferGeometry(), np = new Float32Array(NN * 3);
    for (let i = 0; i < NN; i++) np.set([(Math.random() - 0.5) * 130, Math.random() * 60, (Math.random() - 0.5) * 100 + 5], i * 3);
    nieveGeo.setAttribute('position', new THREE.BufferAttribute(np, 3));
    const nieve = new THREE.Points(nieveGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, map: texGota, transparent: true, depthWrite: false })); nieve.frustumCulled = false; scene.add(nieve);

    function ambiente(dt, t) {
      const now = ahoraSim(), h = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
      climaActual = climaManual === 'auto' ? climaDelDia(now) : climaManual;
      const [top, hor, solC] = claveEn(h);
      const ang = ((h - 6) / 12) * Math.PI, alt = Math.sin(ang);
      diaFactor = THREE.MathUtils.smoothstep(alt, -0.1, 0.25);
      const [k, gDia, gNoche] = GRIS[climaActual], gris = lerpC(C(gNoche), C(gDia), diaFactor);
      top.lerp(gris, k); hor.lerp(gris.clone().multiplyScalar(1.05), k);
      const sd = new THREE.Vector3(-Math.cos(ang), Math.max(alt, -0.3), 0.45).normalize();
      sol.position.copy(sd).multiplyScalar(140); sol.color.copy(solC.clone().lerp(C('#ffffff'), 0.2));
      sol.intensity = Math.min(Math.max(0, alt * 3.5) * (1 - k * 0.85) * 1.5, 1.15 * (1 - k * 0.85));
      luna.intensity = (1 - diaFactor) * 0.35 * (1 - k * 0.6);
      cieloMat.uniforms.top.value.copy(top); cieloMat.uniforms.hor.value.copy(hor);
      cieloMat.uniforms.sunDir.value.copy(sd); cieloMat.uniforms.sunCol.value.copy(solC); cieloMat.uniforms.sunVis.value = (1 - k) * (alt > -0.05 ? 1 : 0);
      cieloMat.uniforms.moonDir.value.set(Math.cos(ang), -alt, -0.3).normalize(); cieloMat.uniforms.moonVis.value = (1 - diaFactor) * (1 - k);
      estrellas.material.opacity = (1 - diaFactor) * (1 - k) * 0.9;
      hemi.intensity = 0.06 + 0.22 * diaFactor; hemi.color.copy(top.clone().lerp(C('#ffffff'), 0.5)); hemi.groundColor.set(climaActual === 'nieve' ? 0x9aa4b0 : 0x4a4030);
      if (climaActual === 'lluvia' && Math.random() < dt * 0.04) flash = 0.25; flash = Math.max(0, flash - dt);
      if (flash > 0 && Math.random() < 0.5) hemi.intensity += 2.2;
      scene.fog.color.copy(hor);
      const niebla = { soleado: [140, 480], nublado: [90, 360], lluvia: [45, 220], nieve: [40, 200] }[climaActual]; scene.fog.near = niebla[0]; scene.fog.far = niebla[1];
      renderer.toneMappingExposure = 0.78 + 0.08 * diaFactor;
      nubes.forEach((n, i) => { n.position.x += n.userData.v * dt; if (n.position.x > 280) n.position.x = -280; n.visible = climaActual !== 'soleado' || i < 5; });
      nubeMat.color.copy(lerpC(C(k ? '#6d7480' : '#ffffff'), C('#1a1e2a'), 1 - diaFactor).lerp(solC, diaFactor < 0.9 && diaFactor > 0.1 ? 0.35 : 0));
      lluvia.visible = climaActual === 'lluvia'; nieve.visible = climaActual === 'nieve';
      if (lluvia.visible) { for (let i = 0; i < NL; i++) { const o = i * 6; let y = lp[o + 1] - 38 * dt; if (y < 0) y = 60; lp[o + 1] = y; lp[o + 4] = y - 0.9; lp[o + 3] = lp[o] - 0.1; } lluviaGeo.attributes.position.needsUpdate = true; }
      if (nieve.visible) { for (let i = 0; i < NN; i++) { const o = i * 3; np[o + 1] -= 1.6 * dt; np[o] += Math.sin(t + i) * 0.01; if (np[o + 1] < 0) np[o + 1] = 60; } nieveGeo.attributes.position.needsUpdate = true; }
      const objNieve = climaActual === 'nieve' ? 1 : 0; nieveAcum = primerCuadro ? objNieve : nieveAcum + (objNieve - nieveAcum) * dt * 0.3; primerCuadro = false;
      pastoMat.color.copy(lerpC(C('#ffffff'), pastoN, nieveAcum)); pastoMat.emissive.set(0xffffff); pastoMat.emissiveIntensity = nieveAcum * 0.25; terrenoMat.emissiveIntensity = nieveAcum * 0.35; M.hoja.color.copy(lerpC(hojaV, hojaN, nieveAcum * 0.7)); HOJAS.forEach((m) => m.color.copy(lerpC(m.userData.base, hojaN, nieveAcum * 0.75)));
      pastoMat.roughness = climaActual === 'lluvia' ? 0.35 : 1; adoquin.roughness = climaActual === 'lluvia' ? 0.25 : 0.8;
      const oscuro = Math.min(1, 1 - diaFactor + k * 0.5);
      faroles.forEach((f) => { f.h.material.opacity = oscuro; f.b.material.color.set(oscuro > 0.3 ? 0xffd9a0 : 0x777777); });
      halosLed.forEach((hh) => { hh.material.opacity = 0.15 + oscuro * 0.85; }); lineasLed.forEach((l) => { l.material.opacity = 0.15 + oscuro * 0.6; });
      vidrioFachada.emissiveIntensity = interior ? 0 : oscuro * 0.3; Mf.ventana.emissiveIntensity = 0.1 + oscuro * 0.9; Mf.fondoListones.emissiveIntensity = 0.05 + oscuro * 0.8;
      if (t > proxReflejo) { proxReflejo = t + 4; actualizarReflejos(); } aguaMat.emissiveIntensity = 0.15 + oscuro * 0.5;
      if (Date.now() - (ambiente.ult || 0) > 1000) { ambiente.ult = Date.now();
        $('of-hora').textContent = now.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
        $('of-fecha').textContent = now.toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric', month: 'short' });
        $('of-momento').textContent = momento(h); $('of-clima').textContent = NOMBRE_CLIMA[climaActual];
      }
      return oscuro;
    }

    /* ---- cámara ---- */
    const movil = () => cont.clientWidth < 700;
    const cam = { target: new THREE.Vector3(0, 11, 6), r: 88, theta: 0.3, phi: 1.38 }, dest = { target: cam.target.clone(), r: 88, theta: 0.3, phi: 1.38 };
    let animando = true;
    const vistaGeneral = () => { dest.target.set(0, 11, 6); dest.r = movil() ? 120 : 88; dest.theta = 0.3; dest.phi = 1.38; animando = true; };
    const enfocar = (id) => { const d = DEP[id], y = yDe(d.piso); dest.target.set(XZ[d.lado], y + 1.6, -1); dest.r = (d.piso === 6 ? 26 : 22) * (movil() ? 1.4 : 1); dest.theta = d.lado === 'L' ? -0.18 : d.lado === 'R' ? 0.18 : 0; dest.phi = 1.42; animando = true; };
    function actualizarCam() {
      if (animando) { const k = 0.07; cam.target.lerp(dest.target, k); cam.r += (dest.r - cam.r) * k; cam.theta += (dest.theta - cam.theta) * k; cam.phi += (dest.phi - cam.phi) * k;
        if (cam.target.distanceTo(dest.target) < 0.01 && Math.abs(dest.r - cam.r) < 0.02) animando = false; }
      const s = Math.sin(cam.phi);
      camera.position.set(cam.target.x + cam.r * s * Math.sin(cam.theta), Math.max(1.5, cam.target.y + cam.r * Math.cos(cam.phi)), cam.target.z + cam.r * s * Math.cos(cam.theta));
      camera.lookAt(cam.target); cielo.position.copy(camera.position); estrellas.position.copy(camera.position);
    }
    const el = renderer.domElement, punteros = new Map(); let arrastre = 0, distPinch = 0;
    el.addEventListener('pointerdown', (e) => { el.setPointerCapture(e.pointerId); punteros.set(e.pointerId, { x: e.clientX, y: e.clientY }); arrastre = 0;
      if (punteros.size === 2) { const [a, b] = [...punteros.values()]; distPinch = Math.hypot(a.x - b.x, a.y - b.y); } });
    el.addEventListener('pointermove', (e) => { const p = punteros.get(e.pointerId); if (!p) { el.style.cursor = pick(e) ? 'pointer' : 'grab'; return; }
      const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (punteros.size === 2) { const [a, b] = [...punteros.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (distPinch) { cam.r = THREE.MathUtils.clamp((cam.r * distPinch) / d, 8, 170); dest.r = cam.r; } distPinch = d; arrastre += 5; return; }
      arrastre += Math.abs(dx) + Math.abs(dy);
      if (arrastre > 4) { animando = false;
        if (e.shiftKey || e.buttons === 2) { const r = new THREE.Vector3().subVectors(camera.position, cam.target).cross(camera.up).normalize(); cam.target.addScaledVector(r, (dx * 0.03 * cam.r) / 40); cam.target.y = THREE.MathUtils.clamp(cam.target.y + (dy * 0.03 * cam.r) / 40, 1, 30); }
        else { cam.theta -= dx * 0.006; cam.phi = THREE.MathUtils.clamp(cam.phi - dy * 0.005, 0.35, 1.56); }
        dest.theta = cam.theta; dest.phi = cam.phi; dest.target.copy(cam.target); dest.r = cam.r; } });
    el.addEventListener('pointerup', (e) => { punteros.delete(e.pointerId); distPinch = 0; if (arrastre <= 4 && punteros.size === 0) { const id = pick(e); if (id) seleccionar(id, true); } });
    el.addEventListener('pointercancel', (e) => { punteros.delete(e.pointerId); distPinch = 0; });
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { e.preventDefault(); cam.r = THREE.MathUtils.clamp(cam.r * (1 + e.deltaY * 0.001), 8, 170); dest.r = cam.r; }, { passive: false });
    const ray = new THREE.Raycaster(), mouse = new THREE.Vector2();
    const clicables = []; AGENTES.forEach((a) => a.g.traverse((o) => { if (o.isMesh) clicables.push(o); }));
    function pick(e) { const r = el.getBoundingClientRect(); mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(mouse, camera);
      const h = ray.intersectObjects(clicables, false)[0]; return h && h.object.userData.dept; }
    const ponerInterior = (v) => { interior = v; const b = $('of-bint'); b.classList.toggle('on', v); b.textContent = v ? 'Ver fachada' : 'Ver interior'; };
    $('of-bint').addEventListener('click', () => ponerInterior(!interior));
    $('of-bgen').addEventListener('click', vistaGeneral);
    $('of-sclima').addEventListener('change', (e) => { climaManual = e.target.value; });
    $('of-svel').addEventListener('change', (e) => { const n = ahoraSim(); baseSim = e.target.value === '1' ? Date.now() : n.getTime(); baseReal = Date.now(); velocidad = Number(e.target.value); });

    /* ---- etiquetas ---- */
    const capa = $('of-etq');
    DEPTOS.forEach((d) => { const n = document.createElement('div'); n.className = 'of-etq'; n.addEventListener('click', () => seleccionar(d.id, true)); capa.appendChild(n); ETQ[d.id] = n;
      d.ancla = new THREE.Vector3(XZ[d.lado], yDe(d.piso) + HP - 0.4, d.piso === 6 ? 1.4 : ZF + 0.6); });
    let verEtq = true;
    $('of-betq').addEventListener('click', (e) => { verEtq = !verEtq; capa.style.display = verEtq ? '' : 'none'; e.target.textContent = verEtq ? 'Ocultar nombres' : 'Mostrar nombres'; });
    const v3 = new THREE.Vector3();
    function moverEtiquetas() { if (!verEtq) return; const w = cont.clientWidth, h = cont.clientHeight;
      DEPTOS.forEach((d) => { v3.copy(d.ancla).project(camera); const n = ETQ[d.id]; if (v3.z > 1) { n.style.display = 'none'; return; } n.style.display = '';
        n.style.left = ((v3.x + 1) / 2) * w + 'px'; n.style.top = ((1 - v3.y) / 2) * h + 'px'; }); }
    render();

    /* ---- bucle ---- */
    const tamano = () => { const w = cont.clientWidth, h = cont.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    if (window.ResizeObserver) new ResizeObserver(tamano).observe(cont); else window.addEventListener('resize', tamano);
    tamano(); vistaGeneral();
    const reloj = new THREE.Clock(); let raf = 0;
    function bucle() {
      raf = requestAnimationFrame(bucle);
      const dt = Math.min(reloj.getDelta(), 0.05); tiempoSim += dt; const t = tiempoSim;
      const oscuro = ambiente(dt, t);
      fac += ((interior ? 0 : 1) - fac) * 0.08;
      capaFachada.forEach((m) => { m.opacity = m.userData.base * fac; });
      fachada.visible = fac > 0.03;
      DEPTOS.forEach((d) => { const z = d.piso === 6 ? luces.ph : luces[d.lado + d.piso]; if (!z) return; const est = estadoDe(d.id);
        const obj = (est === 'libre' ? 0.45 : 1.3) * (0.55 + oscuro * 0.6); z.luz.intensity += (obj - z.luz.intensity) * 0.05;
        z.luz.color.set(est === 'atr' && Math.sin(t * 4) > 0 ? 0xff7060 : 0xffd9a8); z.panel.material.color.set(est === 'libre' ? 0xb8ae9c : 0xfff1d8);
        const ho = HOLOS[d.id]; if (ho) ho.material.opacity = est === 'libre' ? 0.15 : 0.55 + Math.sin(t * 6 + d.piso) * 0.15; });
      luces.lobbyL.luz.intensity = luces.lobbyR.luz.intensity = 0.5 + oscuro * 0.6;
      AGENTES.forEach((a) => actualizarAgente(a, dt, t));
      if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) { const a = AGENTES.find((x) => x.d.id === seleccion); const s = $('of-actividad'); if (s) s.textContent = a ? a.actividad : pendientes('juntas').length ? 'Reunión en curso' : 'Sala libre'; }
      actualizarCam(); renderer.render(scene, camera); moverEtiquetas();
    }
    return {
      enfocar, interior: ponerInterior,
      seguir() { if (!raf) { reloj.getDelta(); tamano(); bucle(); } },
      pausar() { if (raf) { cancelAnimationFrame(raf); raf = 0; } },
    };
  }
})();
