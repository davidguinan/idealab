/* IdeaLab · Mundo 3D (v2)
 * Todo el planeta en 3D con relieve real (elevación y satélite), sin bordes: el mar sigue hasta el horizonte.
 * - Mar animado con olas, brillo y espuma en la costa.
 * - Construir aldeas ordenadas (cuadrícula): casas, edificios, muros, puentes, cultivos, árboles, personas y barcos.
 * - Mover tierra: cavar (si queda bajo el nivel del mar, entra el agua y se forma un lago) o levantar.
 * - Clima: nubes, tormentas (lluvia, rayos e inundación si duran mucho) y sol fuerte.
 * - Las personas reaccionan: con lluvia corren a la casa más cercana; con sol, si hay playa cerca, van a la playa.
 * - Cada venta del periodo levanta una casita en su país. Lo construido se guarda en la hoja y lo ven los dos socios.
 */
(function () {
  'use strict';
  const W = 1000, H = 520, CX = W / 2, CZ = H / 2; // el mapa completo (unidades del mapa)
  const HS = 2, HW = W * HS, HH = H * HS; // pixeles de altura por unidad
  const HMAX = 9, HONDO = 2.2;
  const INICIO = { x: 345 - CX, z: 300 - CZ, dist: 260 };
  let iniciado = false, activo = false;
  const S = {};

  const cargarThree = () => new Promise((ok, mal) => {
    if (window.THREE) return ok(window.THREE);
    const fuentes = ['three.min.js', 'https://cdn.jsdelivr.net/npm/three@0.149.0/build/three.min.js'];
    const probar = (i) => { if (i >= fuentes.length) return mal(new Error('No se pudo cargar el motor 3D')); const sc = document.createElement('script'); sc.src = fuentes[i]; sc.onload = () => (window.THREE ? ok(window.THREE) : probar(i + 1)); sc.onerror = () => { sc.remove(); probar(i + 1); }; document.head.appendChild(sc); };
    probar(0);
  });
  const cargarImg = (src) => new Promise((ok, mal) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => mal(new Error('No cargó ' + src)); im.src = src; });
  const pixeles = (im) => { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); return { w: im.width, h: im.height, d: x.getImageData(0, 0, im.width, im.height).data }; };
  const azar = (semilla) => { let s = 0; for (let i = 0; i < semilla.length; i++) s = (s * 31 + semilla.charCodeAt(i)) >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
  const fmtN = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });
  const fmtD = new Intl.NumberFormat('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtCop = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------------------------------------------------------- Alturas (se pueden modificar: cavar / levantar)
  const alturaDe = (v) => (v >= 64 ? ((v - 64) / 191) * HMAX : ((v - 64) / 64) * HONDO);
  const valorDe = (h) => (h >= 0 ? 64 + (h / HMAX) * 191 : 64 + (h / HONDO) * 64);
  const altura = (x, z) => {
    const px = (x + CX) * HS - 0.5, py = (z + CZ) * HS - 0.5;
    if (px < 0 || py < 0 || px > HW - 1 || py > HH - 1) return -HONDO;
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0, x1 = Math.min(HW - 1, x0 + 1), y1 = Math.min(HH - 1, y0 + 1), A = S.h;
    return A[y0 * HW + x0] * (1 - fx) * (1 - fy) + A[y0 * HW + x1] * fx * (1 - fy) + A[y1 * HW + x0] * (1 - fx) * fy + A[y1 * HW + x1] * fx * fy;
  };
  const esTierra = (x, z) => altura(x, z) > 0.12;
  const colorEn = (x, z) => { const C = S.color; const px = Math.round((x + CX) * (C.w / W)), py = Math.round((z + CZ) * (C.h / H)); if (px < 0 || py < 0 || px >= C.w || py >= C.h) return [0, 0, 0]; const o = (py * C.w + px) * 4; return [C.d[o], C.d[o + 1], C.d[o + 2]]; };

  // ---------------------------------------------------------------- Países (puntero y pueblos)
  const prepararPaises = () => {
    const M = window.MAPA_MUNDO; S.paises = [];
    if (!M) return;
    M.paths.filter((p) => p.n).forEach((p) => {
      const anillos = []; let cur = null;
      const tok = p.d.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
      for (let i = 0; i < tok.length; i++) { const t = tok[i]; if (t === 'M') { cur = []; anillos.push(cur); } else if (t !== 'L' && t !== 'Z') cur.push([Number(t), Number(tok[++i])]); }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      anillos.forEach((a) => a.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
      S.paises.push({ n: p.n, c: p.c, anillos, caja: [x0, y0, x1, y1] });
    });
  };
  const dentro = (a, x, y) => { let s = false; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const [xi, yi] = a[i], [xj, yj] = a[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  const paisEn = (x, z) => { const mx = x + CX, my = z + CZ; for (const p of S.paises) { const c = p.caja; if (mx < c[0] || mx > c[2] || my < c[1] || my > c[3]) continue; if (p.anillos.some((a) => dentro(a, mx, my))) return p.n; } return null; };
  const filaPais = (n) => { const R = window.dash && window.dash.data('resumen'); return R && R.status === 'ok' ? R.data.find((f) => f.clave === 'pais|' + n) : null; };
  const rangoTxt = () => { const p = window.dash ? window.dash.params() : {}; const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; const f = (s) => (s ? Number(s.slice(8, 10)) + ' ' + M[Number(s.slice(5, 7)) - 1] : ''); return p.desde === p.hasta ? 'el ' + f(p.desde) : 'del ' + f(p.desde) + ' al ' + f(p.hasta); };

  // ---------------------------------------------------------------- Modelos (estilo maqueta, con más detalle)
  const crearModelos = (THREE) => {
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.82, metalness: 0, flatShading: true }, o || {}));
    const M = {
      blanco: mat(0xf6f1e7), crema: mat(0xefe0c2), arena: mat(0xf2d7b6), celeste: mat(0xdfe8ef), rosa: mat(0xf3d3cf),
      teja: mat(0xc0583a), tejaOsc: mat(0x8f3b2a), azul: mat(0x2f6fb5), verdeTecho: mat(0x3d7a4a), pizarra: mat(0x4a5361),
      ventana: mat(0x2c4a6e, { roughness: 0.3, metalness: 0.2 }), luz: mat(0xffd27a, { emissive: 0x6b4a10 }), marco: mat(0xffffff),
      madera: mat(0x7a4b2a), madera2: mat(0x9a6a3e), madera3: mat(0x5b3a22), piedra: mat(0xb9b2a6), piedra2: mat(0x9c958a), piedraOsc: mat(0x7e776d),
      hoja: mat(0x4f9a3a), hoja2: mat(0x2f7a32), hoja3: mat(0x6cb64a), palma: mat(0x5aa63c), tierra: mat(0x8a6038), brote: mat(0x7cc24a), trigo: mat(0xe0c060),
      piel: mat(0xe0b08a), piel2: mat(0xa8744f), pelo: mat(0x3b2a20), vela: mat(0xfbf7ec, { side: THREE.DoubleSide, roughness: 0.95 }), casco: mat(0xffffff), casco2: mat(0x1f3b5c), franja: mat(0xd93025),
      nube: mat(0xffffff, { roughness: 1, flatShading: false }), nubeOsc: mat(0x58606d, { roughness: 1, flatShading: false }),
      verde: mat(0x2e9e57), rojo: mat(0xd93025), gris: mat(0x7a7f87), acero: mat(0x9aa3ad, { metalness: 0.4, roughness: 0.4 }),
      sombrilla: [mat(0xff6d01), mat(0x1a73e8), mat(0xd93025), mat(0x9334e6)], toalla: [mat(0xf9ab00), mat(0x34a853), mat(0xe8eaed)],
    };
    const ropa = [0xd93025, 0x1a73e8, 0xf9ab00, 0x188038, 0x9334e6, 0xff6d01, 0x00acc1].map((c) => mat(c));
    const paredes = [M.blanco, M.crema, M.arena, M.celeste, M.rosa];
    const techos = [M.teja, M.tejaOsc, M.azul, M.verdeTecho, M.pizarra];
    const G = {
      caja: new THREE.BoxGeometry(1, 1, 1), cono: new THREE.ConeGeometry(1, 1, 8, 1), esfera: new THREE.IcosahedronGeometry(1, 1), esferaLow: new THREE.IcosahedronGeometry(1, 0),
      cil: new THREE.CylinderGeometry(1, 1, 1, 8), bola: new THREE.SphereGeometry(1, 10, 8),
    };
    // Techo a dos aguas con alero (prisma)
    const techo2 = new THREE.Shape(); techo2.moveTo(-0.6, 0); techo2.lineTo(0, 0.42); techo2.lineTo(0.6, 0); techo2.lineTo(-0.6, 0);
    G.techo = new THREE.ExtrudeGeometry(techo2, { depth: 1.1, bevelEnabled: false }); G.techo.translate(0, 0, -0.55);
    // Ventanas de los edificios (textura dibujada)
    const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const cx = cv.getContext('2d');
    cx.fillStyle = '#e9e4da'; cx.fillRect(0, 0, 64, 128);
    for (let y = 6; y < 128; y += 16) for (let x = 6; x < 64; x += 14) { cx.fillStyle = Math.random() < 0.25 ? '#ffd27a' : '#35577d'; cx.fillRect(x, y, 8, 10); }
    const texVent = new THREE.CanvasTexture(cv); texVent.wrapS = texVent.wrapT = THREE.RepeatWrapping; texVent.encoding = THREE.sRGBEncoding;
    const malla = (g, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; };
    const r = (n, i) => n[Math.abs(i) % n.length];
    const ventanas = (g, w, h, d, y0, pisos) => { for (let p = 0; p < pisos; p++) { const y = y0 + p * 0.3; [-1, 1].forEach((lado) => { for (let k = -1; k <= 1; k += 2) { g.add(malla(G.caja, M.ventana, 0.09, 0.1, 0.012, k * w * 0.25, y, lado * (d / 2 + 0.004))); } }); } };
    const F = {
      casa: (v) => {
        const g = new THREE.Group(); const k = v || 0; const pisos = k % 4 === 0 ? 2 : 1; const w = 0.55 + (k % 3) * 0.08, d = 0.46, h = 0.3 * pisos;
        g.add(malla(G.caja, M.piedra2, w + 0.04, 0.05, d + 0.04, 0, 0.025, 0));
        g.add(malla(G.caja, r(paredes, k), w, h, d, 0, 0.05 + h / 2, 0));
        const t = malla(G.techo, r(techos, k >> 1), (w + 0.12) / 1.2, 0.8, (d + 0.12) / 1.1, 0, 0.05 + h, 0); g.add(t);
        g.add(malla(G.caja, M.madera3, 0.11, 0.18, 0.014, 0, 0.14, d / 2 + 0.006));
        ventanas(g, w, h, d, 0.19, pisos);
        if (k % 2 === 0) g.add(malla(G.caja, M.piedraOsc, 0.07, 0.22, 0.07, w * 0.28, 0.05 + h + 0.2, -d * 0.18));
        if (k % 5 === 1) { g.add(malla(G.caja, M.madera2, w * 0.9, 0.03, 0.18, 0, 0.12, d / 2 + 0.09)); }
        return g;
      },
      edificio: (v) => {
        const g = new THREE.Group(); const k = v || 0; const pisos = 4 + (k % 9); const w = 0.7 + (k % 2) * 0.2, d = 0.7, h = pisos * 0.22;
        const mt = new THREE.MeshStandardMaterial({ map: texVent.clone(), roughness: 0.6, metalness: 0.1 }); mt.map.needsUpdate = true; mt.map.repeat.set(w * 2, pisos / 4);
        g.add(malla(G.caja, M.piedra2, w + 0.12, 0.08, d + 0.12, 0, 0.04, 0));
        g.add(malla(G.caja, mt, w, h, d, 0, 0.08 + h / 2, 0));
        g.add(malla(G.caja, r([M.gris, M.piedra, M.pizarra], k), w + 0.05, 0.06, d + 0.05, 0, 0.08 + h + 0.03, 0));
        if (pisos > 8) { g.add(malla(G.cil, M.acero, 0.015, 0.6, 0.015, 0.1, 0.08 + h + 0.33, 0.1)); g.add(malla(G.caja, M.gris, 0.25, 0.15, 0.25, -0.12, 0.08 + h + 0.1, -0.1)); }
        return g;
      },
      muro: (largo) => {
        const g = new THREE.Group(); const n = Math.max(1, Math.round(largo / 0.32));
        g.add(malla(G.caja, M.piedra, largo, 0.42, 0.22, 0, 0.21, 0));
        g.add(malla(G.caja, M.piedra2, largo + 0.02, 0.05, 0.26, 0, 0.44, 0));
        for (let i = 0; i < n; i++) { const x = -largo / 2 + (i + 0.5) * (largo / n); g.add(malla(G.caja, M.piedra, 0.14, 0.12, 0.24, x, 0.52, 0)); }
        [-1, 1].forEach((s) => { g.add(malla(G.cil, M.piedra2, 0.19, 0.75, 0.19, s * largo / 2, 0.375, 0)); g.add(malla(G.cono, M.tejaOsc, 0.24, 0.32, 0.24, s * largo / 2, 0.91, 0)); });
        return g;
      },
      arbol: (v) => {
        const g = new THREE.Group(); const k = v || 0; const tipo = k % 4;
        if (tipo === 3) { g.add(malla(G.cil, M.madera2, 0.035, 0.75, 0.035, 0, 0.375, 0)); for (let i = 0; i < 6; i++) { const h = malla(G.cono, M.palma, 0.07, 0.42, 0.03, 0, 0.75, 0); h.rotation.z = 1.25; h.rotation.y = (i / 6) * Math.PI * 2; h.position.x = Math.cos(h.rotation.y) * 0.15; h.position.z = -Math.sin(h.rotation.y) * 0.15; g.add(h); } }
        else if (tipo === 1) { g.add(malla(G.cil, M.madera, 0.04, 0.2, 0.04, 0, 0.1, 0)); [[0.26, 0.4, 0.36], [0.21, 0.36, 0.56], [0.15, 0.3, 0.74]].forEach(([rr, hh, y]) => g.add(malla(G.cono, M.hoja2, rr, hh, rr, 0, y, 0))); }
        else { g.add(malla(G.cil, M.madera, 0.045, 0.28, 0.045, 0, 0.14, 0)); g.add(malla(G.esfera, tipo ? M.hoja3 : M.hoja, 0.24, 0.22, 0.24, 0, 0.44, 0)); g.add(malla(G.esfera, tipo ? M.hoja : M.hoja3, 0.17, 0.16, 0.17, 0.1, 0.58, 0.04)); }
        return g;
      },
      cultivo: (v) => {
        const g = new THREE.Group(); const k = v || 0; g.add(malla(G.caja, M.tierra, 1.1, 0.04, 0.8, 0, 0.02, 0));
        const borde = [[0, 0.41], [0, -0.41]]; borde.forEach(([x, z]) => g.add(malla(G.caja, M.madera2, 1.14, 0.06, 0.03, x, 0.05, z))); [[0.56, 0], [-0.56, 0]].forEach(([x, z]) => g.add(malla(G.caja, M.madera2, 0.03, 0.06, 0.84, x, 0.05, z)));
        const brotes = new THREE.Group(); brotes.name = 'brotes';
        for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) brotes.add(malla(k % 2 ? G.cono : G.esferaLow, k % 3 === 2 ? M.trigo : k % 2 ? M.brote : M.hoja, 0.045, k % 2 ? 0.16 : 0.06, 0.045, -0.42 + j * 0.14, k % 2 ? 0.12 : 0.08, -0.28 + i * 0.14));
        g.add(brotes); return g;
      },
      persona: (v) => {
        const g = new THREE.Group(); const k = v || 0; const cuerpo = new THREE.Group(); cuerpo.name = 'cuerpo';
        cuerpo.add(malla(G.cil, M.casco2, 0.022, 0.07, 0.022, -0.02, 0.035, 0)); cuerpo.add(malla(G.cil, M.casco2, 0.022, 0.07, 0.022, 0.02, 0.035, 0));
        cuerpo.add(malla(G.cil, r(ropa, k), 0.05, 0.1, 0.04, 0, 0.12, 0));
        cuerpo.add(malla(G.bola, k % 3 ? M.piel : M.piel2, 0.038, 0.04, 0.038, 0, 0.205, 0)); cuerpo.add(malla(G.bola, M.pelo, 0.04, 0.02, 0.04, 0, 0.228, -0.005));
        g.add(cuerpo);
        const playa = new THREE.Group(); playa.name = 'playa'; playa.visible = false;
        playa.add(malla(G.cil, M.gris, 0.006, 0.32, 0.006, 0.08, 0.16, 0)); playa.add(malla(G.cono, r(M.sombrilla, k), 0.2, 0.08, 0.2, 0.08, 0.33, 0)); playa.add(malla(G.caja, r(M.toalla, k), 0.12, 0.005, 0.24, -0.06, 0.003, 0.05));
        g.add(playa); return g;
      },
      barco: (v) => {
        const g = new THREE.Group(); const k = v || 0; const casco = new THREE.Group(); casco.name = 'casco';
        const perfil = new THREE.Shape(); perfil.moveTo(-0.5, 0.12); perfil.lineTo(0.42, 0.12); perfil.quadraticCurveTo(0.62, 0.1, 0.6, 0.04); perfil.quadraticCurveTo(0.45, -0.1, 0.25, -0.11); perfil.lineTo(-0.38, -0.11); perfil.quadraticCurveTo(-0.5, -0.06, -0.5, 0.12);
        const gc = new THREE.ExtrudeGeometry(perfil, { depth: 0.26, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.02, bevelSegments: 2, steps: 1 }); gc.translate(0, 0, -0.13);
        const c = new THREE.Mesh(gc, k % 2 ? M.casco2 : M.casco); c.castShadow = true; casco.add(c);
        casco.add(malla(G.caja, M.franja, 0.95, 0.025, 0.31, 0.03, 0.07, 0));
        casco.add(malla(G.caja, M.madera2, 0.9, 0.02, 0.26, 0.02, 0.135, 0));
        casco.add(malla(G.caja, M.blanco, 0.24, 0.13, 0.2, -0.2, 0.2, 0)); casco.add(malla(G.caja, M.ventana, 0.245, 0.04, 0.205, -0.2, 0.22, 0)); casco.add(malla(G.caja, M.azul, 0.27, 0.025, 0.23, -0.2, 0.275, 0));
        casco.add(malla(G.cil, M.madera3, 0.014, 0.85, 0.014, 0.08, 0.56, 0));
        const vg = new THREE.PlaneGeometry(1, 1, 4, 4); const pv = vg.attributes.position; for (let i = 0; i < pv.count; i++) { const x = pv.getX(i), y = pv.getY(i); pv.setZ(i, Math.sin((x + 0.5) * Math.PI) * 0.12 * (1 - (y + 0.5) * 0.6)); } vg.computeVertexNormals();
        const forma = (w, h) => { const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, h); s.lineTo(w, 0); s.lineTo(0, 0); return new THREE.ShapeGeometry(s); };
        const mayor = new THREE.Mesh(forma(0.38, 0.7), M.vela); mayor.position.set(0.09, 0.18, 0); mayor.castShadow = true; casco.add(mayor);
        const foque = new THREE.Mesh(forma(-0.32, 0.55), M.vela); foque.position.set(0.07, 0.18, 0.003); foque.castShadow = true; casco.add(foque);
        casco.add(malla(G.caja, k % 2 ? M.rojo : M.verde, 0.1, 0.06, 0.005, 0.13, 0.95, 0));
        g.add(casco);
        const estela = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })); estela.rotation.x = -Math.PI / 2; estela.position.set(-0.95, 0.02, 0); estela.name = 'estela'; g.add(estela);
        return g;
      },
      nube: (oscura) => { const g = new THREE.Group(); const m = oscura ? M.nubeOsc : M.nube; const rnd = azar(oscura ? 'tormenta' : 'nube' + Math.random()); for (let i = 0; i < 11; i++) { const s = 0.45 + rnd() * 0.55; const b = malla(G.bola, m, s, s * 0.78, s, (rnd() - 0.5) * 2.4, (rnd() - 0.3) * 0.5, (rnd() - 0.5) * 1.4); g.add(b); } return g; },
      banderin: () => { const g = new THREE.Group(); g.add(malla(G.cil, M.gris, 0.02, 1.4, 0.02, 0, 0.7, 0)); const b = malla(G.caja, M.verde, 0.45, 0.25, 0.02, 0.23, 1.25, 0); b.name = 'tela'; g.add(b); return g; },
      puente: (largo) => { const g = new THREE.Group(); const n = Math.max(3, Math.round(largo / 0.2)); const alto = Math.min(0.6, largo * 0.12); for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = -largo / 2 + t * largo, y = Math.sin(t * Math.PI) * alto; const tab = malla(G.caja, i % 2 ? M.madera : M.madera2, largo / n + 0.03, 0.05, 0.4, x, y, 0); tab.rotation.z = Math.cos(t * Math.PI) * alto * Math.PI / largo; g.add(tab); if (i % 2 === 0) { g.add(malla(G.cil, M.madera3, 0.015, 0.24, 0.015, x, y + 0.12, 0.19)); g.add(malla(G.cil, M.madera3, 0.015, 0.24, 0.015, x, y + 0.12, -0.19)); } } g.add(malla(G.caja, M.madera3, largo, 0.02, 0.02, 0, alto * 0.7 + 0.24, 0.19)); g.add(malla(G.caja, M.madera3, largo, 0.02, 0.02, 0, alto * 0.7 + 0.24, -0.19)); g.add(malla(G.caja, M.piedra, 0.26, 0.7, 0.46, -largo / 2, -0.28, 0)); g.add(malla(G.caja, M.piedra, 0.26, 0.7, 0.46, largo / 2, -0.28, 0)); return g; },
    };
    return { M, G, F, mat };
  };

  // ---------------------------------------------------------------- Escena
  const construir = async (host) => {
    const THREE = await cargarThree();
    const [imAlto, imColor] = await Promise.all([cargarImg('mundo2-alto.png'), cargarImg('mundo2-color.jpg')]);
    const A = pixeles(imAlto); S.color = pixeles(imColor);
    S.h = new Float32Array(HW * HH); S.v8 = new Uint8Array(HW * HH * 4);
    for (let i = 0; i < HW * HH; i++) { const v = A.d[i * 4]; S.v8[i * 4] = v; S.v8[i * 4 + 3] = 255; S.h[i] = alturaDe(v); }
    prepararPaises();
    const Mo = crearModelos(THREE); S.Mo = Mo; S.THREE = THREE;

    host.replaceChildren();
    const lienzo = document.createElement('div'); lienzo.className = 'mundo-lienzo'; host.appendChild(lienzo);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    lienzo.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const HORIZONTE = new THREE.Color(0xcfe9f5);
    scene.fog = new THREE.Fog(HORIZONTE, 200, 900);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 5000);
    S.scene = scene; S.camera = camera; S.renderer = renderer;

    // Cielo con degradado (sin bordes: siempre hay horizonte)
    const cielo = new THREE.Mesh(new THREE.SphereGeometry(2400, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { arriba: { value: new THREE.Color(0x4f9fd6) }, abajo: { value: HORIZONTE.clone() }, sol: { value: 0 } },
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform vec3 arriba; uniform vec3 abajo; uniform float sol; varying vec3 vP; void main(){ float t = clamp(vP.y*1.6, 0., 1.); vec3 c = mix(abajo, arriba, pow(t,.7)); c += vec3(1.,.85,.5)*sol*.15*(1.-t); gl_FragColor = vec4(c,1.); }',
    }));
    scene.add(cielo); S.cielo = cielo;

    // Luces
    S.hemi = new THREE.HemisphereLight(0xe3f3ff, 0x6d5f45, 0.62); scene.add(S.hemi);
    const sol = new THREE.DirectionalLight(0xfff0d0, 1.05); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0005; sol.shadow.normalBias = 0.03;
    scene.add(sol); scene.add(sol.target); S.sol = sol;
    S.destello = new THREE.PointLight(0xdfe8ff, 0, 30); scene.add(S.destello);

    // Textura de color y de profundidad (la profundidad se actualiza al cavar)
    const tex = new THREE.Texture(imColor); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
    S.texProf = new THREE.DataTexture(S.v8, HW, HH, THREE.RGBAFormat, THREE.UnsignedByteType); S.texProf.magFilter = THREE.LinearFilter; S.texProf.minFilter = THREE.LinearFilter; S.texProf.needsUpdate = true;
    const matTierra = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 });

    // Terreno del mundo completo (detalle medio) + parche de alto detalle que sigue a la cámara
    const crearMalla = (ancho, alto, sx, sy, material) => {
      const geo = new THREE.PlaneGeometry(ancho, alto, sx, sy); geo.rotateX(-Math.PI / 2);
      const m = new THREE.Mesh(geo, material); m.receiveShadow = true; m.userData.base = geo.attributes.position.array.slice(0); return m;
    };
    const ponerAlturas = (m) => {
      const pos = m.geometry.attributes.position, uv = m.geometry.attributes.uv, ox = m.position.x, oz = m.position.z, b = m.userData.base;
      for (let i = 0; i < pos.count; i++) { const x = b[i * 3] + ox, z = b[i * 3 + 2] + oz; pos.setY(i, altura(x, z)); uv.setXY(i, (x + CX) / W, 1 - (z + CZ) / H); }
      pos.needsUpdate = true; uv.needsUpdate = true; m.geometry.computeVertexNormals(); m.geometry.computeBoundingSphere(); m.geometry.computeBoundingBox();
    };
    S.ponerAlturas = ponerAlturas;
    const matBase = matTierra.clone(); matBase.polygonOffset = true; matBase.polygonOffsetFactor = 1; matBase.polygonOffsetUnits = 4;
    S.terreno = crearMalla(W, H, 640, 333, matBase); ponerAlturas(S.terreno); scene.add(S.terreno);
    S.parche = crearMalla(48, 48, 192, 192, matTierra); S.parche.visible = false; scene.add(S.parche); S.parcheC = null;

    // Mar animado (sigue a la cámara: no tiene fin)
    const aguaMat = new THREE.ShaderMaterial({
      transparent: true, extensions: { derivatives: true }, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, prof: { value: null }, solDir: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() }, calor: { value: 0 } }]),
      vertexShader: `uniform float t; varying vec3 vW; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){ vec3 p = position; vec4 wp0 = modelMatrix*vec4(p,1.); float w = sin(wp0.x*.55+t*1.1)*.045 + cos(wp0.z*.47+t*.8)*.045 + sin((wp0.x+wp0.z)*1.9+t*2.2)*.018; p.z += w;
          vec4 wp = modelMatrix*vec4(p,1.); vW = wp.xyz; vUv = vec2((wp.x+${CX.toFixed(1)})/${W.toFixed(1)}, (wp.z+${CZ.toFixed(1)})/${H.toFixed(1)});
          vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float t; uniform sampler2D prof; uniform vec3 solDir; uniform float calor; varying vec3 vW; varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){ vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.) n = -n;
          float h = 2.; if (vUv.x>0. && vUv.x<1. && vUv.y>0. && vUv.y<1.) h = texture2D(prof, vUv).r*255.; float pr = clamp((64.-h)/64., 0., 1.);
          vec3 bajo = vec3(.45,.9,.86), medio = vec3(.13,.68,.78), hondo = vec3(.04,.36,.58);
          vec3 c = pr < .35 ? mix(bajo, medio, pr/.35) : mix(medio, hondo, (pr-.35)/.65);
          float dCam = length(cameraPosition - vW); vec3 v = normalize(cameraPosition - vW); float fres = pow(1.-max(dot(n,v),0.), 3.);
          float spec = pow(max(dot(reflect(-solDir, n), v), 0.), 60.)*(.8+calor*.6)*(1.-smoothstep(40., 160., dCam));
          vec2 cel = floor(vW.xz*3.); float nz = fract(sin(dot(cel, vec2(12.9898,78.233)))*43758.5453); vec2 fr = fract(vW.xz*3.)-.5; float brillo = step(.992, nz)*smoothstep(.25,.0,length(fr))*(.5+.5*sin(t*2.5+nz*40.))*.6*(1.-smoothstep(10., 45., dCam));
          float espuma = (1.-smoothstep(.0,.07,pr)) * mix(.75, .55+.45*sin(pr*120.-t*2.5), 1.-smoothstep(30., 120., dCam)) * step(.004, pr);
          c = mix(c, vec3(.85,.95,1.), fres*.35) + spec + brillo; c = mix(c, vec3(1.), clamp(espuma,0.,1.)*.8);
          float a = mix(.55, .98, smoothstep(.0,.6,pr)); a = max(a, espuma*.9);
          gl_FragColor = vec4(c, a);
          #include <fog_fragment>
        }`,
    });
    aguaMat.uniforms.prof.value = S.texProf;
    S.agua = new THREE.Mesh(new THREE.PlaneGeometry(1400, 1400, 180, 180), aguaMat); S.agua.rotation.x = -Math.PI / 2; S.agua.position.y = 0.02; scene.add(S.agua);
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshBasicMaterial({ color: 0x0c4f7e })); fondo.rotation.x = -Math.PI / 2; fondo.position.y = -HONDO - 0.05; scene.add(fondo);

    // Bosques (decoración); se mueven o desaparecen al cavar
    const rnd = azar('bosque-idealab-2');
    S.arboles = [];
    for (let i = 0; i < 200000 && S.arboles.length < 26000; i++) {
      const x = (rnd() - 0.5) * W, z = (rnd() - 0.5) * H; const h = altura(x, z); if (h < 0.25 || h > 6.5) continue;
      const [r, g, b] = colorEn(x, z); if (!(g > r + 12 && g > b + 20)) continue;
      S.arboles.push({ x, z, s: 0.5 + rnd() * 0.6, r: rnd() * 6.28, pino: h > 3 || rnd() < 0.3 });
    }
    // Los árboles van por zonas (50 x 52): solo se dibujan las zonas cercanas a la cámara (más fluido)
    const trunco = new THREE.CylinderGeometry(1, 1, 1, 5);
    const zonas = {};
    S.arboles.forEach((a) => { const k = Math.floor((a.x + CX) / 50) + ',' + Math.floor((a.z + CZ) / 52); (zonas[k] = zonas[k] || []).push(a); });
    S.zonasArb = Object.entries(zonas).map(([k, lista]) => {
      const [i, j] = k.split(',').map(Number); const g = new THREE.Group(); g.userData.c = [i * 50 + 25 - CX, j * 52 + 26 - CZ];
      const inst = (geom, mat, l, dy, sx, sy) => { const im = new THREE.InstancedMesh(geom, mat, Math.max(1, l.length)); im.count = l.length; im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false; im.userData = { lista: l, dy, sx, sy }; g.add(im); return im; };
      inst(Mo.G.cono, Mo.M.hoja2, lista.filter((a) => a.pino), 0.34, 0.17, 0.52); inst(Mo.G.esferaLow, Mo.M.hoja, lista.filter((a) => !a.pino), 0.3, 0.21, 0.2); inst(trunco, Mo.M.madera, lista, 0.07, 0.03, 0.15);
      g.visible = false; scene.add(g); return g;
    });
    S.ponerArboles = (x0, z0, x1, z1) => {
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
      S.zonasArb.forEach((g) => { const [gx, gz] = g.userData.c; if (x0 !== undefined && (gx + 26 < x0 || gx - 26 > x1 || gz + 27 < z0 || gz - 27 > z1)) return;
        g.children.forEach((im) => { const { lista, dy, sx, sy } = im.userData; lista.forEach((a, i) => { if (x0 !== undefined && (a.x < x0 || a.x > x1 || a.z < z0 || a.z > z1)) return; const h = altura(a.x, a.z); const vivo = h > 0.2; e.set(0, a.r, 0); q.setFromEuler(e); v.set(a.x, h + dy * a.s, a.z); sc.set(vivo ? sx * a.s : 0, vivo ? sy * a.s : 0, vivo ? sx * a.s : 0); m.compose(v, q, sc); im.setMatrixAt(i, m); }); im.instanceMatrix.needsUpdate = true; }); });
    };
    S.ponerArboles();

    S.objetos = new THREE.Group(); scene.add(S.objetos);
    S.pueblos = new THREE.Group(); scene.add(S.pueblos);
    S.inundaciones = new THREE.Group(); scene.add(S.inundaciones);
    S.lista = []; S.pendiente = []; S.giro = 0; S.calor = false;
    S.matInunda = new THREE.MeshStandardMaterial({ color: 0x1f7fa8, transparent: true, opacity: 0.62, roughness: 0.08, metalness: 0.2, depthWrite: false });

    S.cam = { tx: INICIO.x, tz: INICIO.z, dist: INICIO.dist, az: 0, dTx: INICIO.x, dTz: INICIO.z, dDist: INICIO.dist, dAz: 0 };
    const tamano = () => { const w = lienzo.clientWidth || 800, h = lienzo.clientHeight || 520; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    new ResizeObserver(tamano).observe(lienzo); tamano();

    montarInterfaz(host, lienzo);
    montarControles(renderer.domElement);
    await cargarConstruido();
    actualizarPueblos();
    if (window.dash) window.dash.onData(() => { if (activo) actualizarPueblos(); });
    setInterval(() => { if (activo && !S.ocupado && !S.cola.length) cargarConstruido(true); }, 60000);

    const reloj = new THREE.Clock();
    const bucle = () => { requestAnimationFrame(bucle); if (!activo || !host.offsetParent) return; const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime; animar(dt, t); renderer.render(scene, camera); };
    bucle();
  };

  // ---------------------------------------------------------------- Cámara
  const ponerCamara = () => {
    const { camera, sol } = S; const c = S.cam;
    const k = 0.12; c.tx += (c.dTx - c.tx) * k; c.tz += (c.dTz - c.tz) * k; c.dist += (c.dDist - c.dist) * k; c.az += (c.dAz - c.az) * k;
    const lejos = cl((c.dist - 4) / 300, 0, 1);
    const incl = (1 - lejos) * 1.08 + lejos * 0.2;
    const ty = Math.max(0, altura(c.tx, c.tz));
    camera.position.set(c.tx + Math.sin(c.az) * Math.sin(incl) * c.dist, ty + Math.cos(incl) * c.dist, c.tz + Math.cos(c.az) * Math.sin(incl) * c.dist);
    const minY = Math.max(0.3, altura(camera.position.x, camera.position.z) + 0.4); if (camera.position.y < minY) camera.position.y = minY;
    camera.lookAt(c.tx, ty, c.tz);
    camera.near = Math.max(0.03, c.dist / 500); camera.far = 5000; camera.updateProjectionMatrix();
    S.scene.fog.near = c.dist * 1.8 + 20; S.scene.fog.far = c.dist * 5 + 400;
    S.cielo.position.copy(camera.position);
    // El mar y el parche de detalle siguen a la cámara
    S.agua.position.x = Math.round(c.tx / 5) * 5; S.agua.position.z = Math.round(c.tz / 5) * 5;
    const verParche = c.dist < 70; S.parche.visible = verParche;
    if (verParche) { const px = Math.round(c.tx / 6) * 6, pz = Math.round(c.tz / 6) * 6; if (!S.parcheC || S.parcheC[0] !== px || S.parcheC[1] !== pz || S.parcheSucio) { S.parche.position.set(px, 0, pz); S.ponerAlturas(S.parche); S.parcheC = [px, pz]; S.parcheSucio = false; } }
    sol.castShadow = c.dist < 140;
    const radioArb = c.dist < 220 ? Math.max(60, c.dist * 1.3) : 0;
    S.zonasArb.forEach((g) => { g.visible = radioArb > 0 && Math.hypot(g.userData.c[0] - c.tx, g.userData.c[1] - c.tz) < radioArb + 40; });
    const r = Math.max(6, Math.min(160, c.dist * 0.9));
    sol.position.set(c.tx - r * 0.6, ty + r * 1.4, c.tz - r * 0.4); sol.target.position.set(c.tx, ty, c.tz);
    const sc = sol.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.1; sc.far = r * 4; sc.updateProjectionMatrix();
  };
  const limitar = () => { const c = S.cam; c.dTx = cl(c.dTx, -W / 2 - 40, W / 2 + 40); c.dTz = cl(c.dTz, -H / 2 - 20, H / 2 + 20); c.dDist = cl(c.dDist, 2.5, 600); };
  const irA = (x, z, dist) => { S.cam.dTx = x; S.cam.dTz = z; S.cam.dDist = dist; limitar(); };

  // ---------------------------------------------------------------- Rayos
  const rayo = (ev) => { const { THREE, camera, renderer } = S; const r = renderer.domElement.getBoundingClientRect(); const v = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1); const rc = new THREE.Raycaster(); rc.setFromCamera(v, camera); return rc; };
  // Punto del suelo (o del agua) bajo el puntero: se recorre el rayo sobre el mapa de alturas (rápido)
  const puntoSuelo = (ev) => {
    const ray = rayo(ev).ray, o = ray.origin, d = ray.direction;
    if (d.y >= -1e-4) return null;
    const sup = (x, z) => Math.max(altura(x, z), 0.02);
    const tmax = (o.y + HONDO) / -d.y; let t0 = 0, t = 0, hit = false;
    for (let i = 0; i < 3000 && t < tmax; i++) { const step = Math.max(0.03, t * 0.004); t += step; if (o.y + d.y * t <= sup(o.x + d.x * t, o.z + d.z * t)) { hit = true; break; } t0 = t; }
    if (!hit) return null;
    let a = t0, b = t; for (let k = 0; k < 12; k++) { const m = (a + b) / 2; if (o.y + d.y * m <= sup(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m; }
    const x = o.x + d.x * b, z = o.z + d.z * b; return new S.THREE.Vector3(x, altura(x, z), z);
  };
  const objetoBajo = (ev, filtro) => { const rc = rayo(ev); const hits = rc.intersectObjects(S.objetos.children, true); for (const h of hits) { let o = h.object; while (o && !o.userData.id) o = o.parent; if (o && (!filtro || filtro(o))) return o; } return null; };

  // ---------------------------------------------------------------- Interfaz
  const HERR = [
    ['explorar', '🖐️', 'Explorar', 'Explorar y mover barcos'],
    ['casa', '🏠', 'Casa', 'Construir casa (se alinea en cuadrícula)'], ['edificio', '🏢', 'Edificio', 'Construir edificio para tu ciudad'], ['muro', '🧱', 'Muro', 'Construir muro (toca el inicio y el final)'], ['puente', '🌉', 'Puente', 'Construir puente (toca dos orillas)'],
    ['cultivo', '🌱', 'Cultivo', 'Sembrar cultivo'], ['arbol', '🌳', 'Árbol', 'Plantar árbol'], ['persona', '🧍', 'Personas', 'Poner personas'], ['barco', '⛵', 'Barco', 'Poner barco en el mar'],
    ['cavar', '⛏️', 'Cavar', 'Cavar: mantén y arrastra; bajo el nivel del mar se llena de agua'], ['elevar', '⛰️', 'Elevar', 'Levantar tierra: mantén y arrastra'],
    ['nube', '☁️', 'Nube', 'Crear nube'], ['tormenta', '⛈️', 'Tormenta', 'Crear tormenta (si dura mucho, inunda)'],
    ['sol', '☀️', 'Sol', 'Sol fuerte: la gente cerca del mar va a la playa'], ['girar', '↻', 'Girar', 'Girar lo próximo que construyas 90°'], ['borrar', '🗑️', 'Quitar', 'Quitar lo que toques'],
  ];
  const montarInterfaz = (host, lienzo) => {
    S.herr = 'explorar';
    const barra = document.createElement('div'); barra.className = 'mundo-barra'; barra.setAttribute('role', 'toolbar');
    HERR.forEach(([id, ic, corto, tit]) => {
      const b = document.createElement('button'); b.type = 'button'; b.dataset.h = id; b.title = tit; b.setAttribute('aria-label', tit); b.innerHTML = '<span>' + ic + '</span><em>' + corto + '</em>'; if (id === 'explorar') b.classList.add('on');
      b.addEventListener('click', () => {
        if (id === 'sol') { S.calor = !S.calor; b.classList.toggle('on', S.calor); avisar(S.calor ? 'Sol fuerte: la gente cerca del mar se va a la playa.' : 'El sol se calmó.'); return; }
        if (id === 'girar') { S.giro = (S.giro + Math.PI / 2) % (Math.PI * 2); avisar('Lo próximo que construyas quedará girado ' + Math.round((S.giro * 180) / Math.PI) + '°.'); return; }
        S.herr = id; S.inicioLinea = null; barra.querySelectorAll('button').forEach((x) => { if (x.dataset.h !== 'sol') x.classList.toggle('on', x === b); });
        avisar(id === 'puente' || id === 'muro' ? 'Toca dónde empieza.' : id === 'explorar' ? 'Arrastra para moverte, rueda para acercarte; arrastra un barco para moverlo.' : tit + '.');
      });
      barra.appendChild(b);
    });
    host.appendChild(barra);
    const zoom = document.createElement('div'); zoom.className = 'mundo-zoom';
    [['+', 'Acercar', () => { S.cam.dDist *= 0.6; limitar(); }], ['−', 'Alejar', () => { S.cam.dDist /= 0.6; limitar(); }], ['⟲', 'Volver a Latinoamérica', () => { S.cam.dAz = 0; irA(INICIO.x, INICIO.z, INICIO.dist); }]].forEach(([t, ti, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.title = ti; b.setAttribute('aria-label', ti); b.addEventListener('click', fn); zoom.appendChild(b); });
    lienzo.appendChild(zoom);
    S.tip = document.createElement('div'); S.tip.className = 'map-tip'; S.tip.hidden = true; lienzo.appendChild(S.tip);
    S.aviso = document.createElement('div'); S.aviso.className = 'mundo-aviso'; lienzo.appendChild(S.aviso);
    document.addEventListener('keydown', (e) => { if (!activo || /input|textarea/i.test((e.target && e.target.tagName) || '')) return; if (e.key === 'r' || e.key === 'R') { S.giro = (S.giro + Math.PI / 2) % (Math.PI * 2); avisar('Girado ' + Math.round((S.giro * 180) / Math.PI) + '°.'); } });
    avisar('Toca un país para acercarte. Construye, cava lagos o crea tormentas con la barra de abajo.');
  };
  const avisar = (txt) => { if (!S.aviso) return; S.aviso.textContent = txt; S.aviso.classList.add('ver'); clearTimeout(S.avisoT); S.avisoT = setTimeout(() => S.aviso.classList.remove('ver'), 4500); };

  const mostrarTip = (ev) => {
    const tip = S.tip; if (S.herr !== 'explorar') { tip.hidden = true; return; }
    const p = puntoSuelo(ev); if (!p || p.y < 0.05) { tip.hidden = true; return; }
    const n = paisEn(p.x, p.z); const f = n && filaPais(n);
    if (!f || !(f.ventas_total_n > 0 || f.gasto > 0)) { tip.hidden = true; return; } // solo países con movimiento
    tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = n; tip.appendChild(b);
    const linea = (lb, val, cls) => { const sp = document.createElement('span'); sp.append(lb + ': '); const em = document.createElement('em'); em.textContent = val; if (cls) em.className = cls; sp.appendChild(em); tip.appendChild(sp); };
    linea('ROAS', f.roas === null || f.roas === undefined ? '—' : fmtD.format(f.roas) + 'x', f.roas >= 2 ? 'pos' : f.roas !== null && f.roas < 1 ? 'neg' : '');
    linea('Ventas', fmtN.format(f.ventas_total_n || 0)); linea('Utilidad', fmtCop.format(f.ganancia || 0), f.ganancia > 0 ? 'pos' : f.ganancia < 0 ? 'neg' : '');
    const r = document.createElement('span'); r.style.fontSize = '11px'; r.textContent = rangoTxt(); tip.appendChild(r);
    const caja = S.renderer.domElement.getBoundingClientRect();
    tip.style.left = cl(ev.clientX - caja.left, 80, caja.width - 80) + 'px'; tip.style.top = Math.max(70, ev.clientY - caja.top) + 'px'; tip.hidden = false;
  };

  // ---------------------------------------------------------------- Controles
  const montarControles = (el) => {
    const pts = new Map(); let ini = null, movido = 0, distP = 0, angP = 0, arrastreBarco = null, ultimoTip = 0, ultimoPincel = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => { e.preventDefault(); const p = puntoSuelo(e); const f = e.deltaY < 0 ? 0.8 : 1.25; const c = S.cam; if (p && f < 1) { c.dTx += (p.x - c.dTx) * 0.25; c.dTz += (p.z - c.dTz) * 0.25; } c.dDist *= f; limitar(); }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); movido = 0;
      ini = { x: e.clientX, y: e.clientY, tx: S.cam.dTx, tz: S.cam.dTz, az: S.cam.dAz, btn: e.button };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; distP = Math.hypot(a[0] - b[0], a[1] - b[1]); angP = Math.atan2(b[1] - a[1], b[0] - a[0]); }
      arrastreBarco = null;
      if (S.herr === 'explorar' && pts.size === 1 && e.button === 0) { const o = objetoBajo(e, (o) => o.userData.t === 'barco'); if (o) arrastreBarco = o; }
      if ((S.herr === 'cavar' || S.herr === 'elevar') && pts.size === 1 && e.button === 0) { pincel(e); ultimoPincel = performance.now(); }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) { const ahora = performance.now(); if (ahora - ultimoTip > 60) { ultimoTip = ahora; mostrarTip(e); } return; }
      pts.set(e.pointerId, [e.clientX, e.clientY]); const c = S.cam;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), an = Math.atan2(b[1] - a[1], b[0] - a[0]); if (distP) { c.dDist *= distP / d; c.dAz -= an - angP; limitar(); } distP = d; angP = an; movido = 99; return; }
      if (!ini) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y; movido = Math.max(movido, Math.abs(dx) + Math.abs(dy));
      if ((S.herr === 'cavar' || S.herr === 'elevar') && ini.btn === 0) { const ahora = performance.now(); if (ahora - ultimoPincel > 110) { ultimoPincel = ahora; pincel(e); } return; }
      if (movido < 4) return;
      S.tip.hidden = true;
      if (arrastreBarco) { const p = puntoSuelo(e); if (p && p.y <= 0.05) { const o = arrastreBarco; const dd = Math.hypot(p.x - o.position.x, p.z - o.position.z); if (dd > 0.02) { o.rotation.y = Math.atan2(-(p.z - o.position.z), p.x - o.position.x); o.userData.vel = Math.min(1, dd * 6); } o.position.x = p.x; o.position.z = p.z; o.userData.x = p.x; o.userData.z = p.z; o.userData.r = o.rotation.y; } return; }
      if (ini.btn === 2) { c.dAz = ini.az - dx * 0.006; return; }
      const r = S.renderer.domElement.getBoundingClientRect(); const esc = (c.dist * 0.9) / r.height; const ca = Math.cos(c.az), sa = Math.sin(c.az);
      c.dTx = ini.tx - (dx * ca + dy * sa) * esc; c.dTz = ini.tz - (-dx * sa + dy * ca) * esc; limitar();
    });
    const soltar = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId); if (pts.size < 2) distP = 0;
      if (arrastreBarco && movido >= 4) guardarMovimiento(arrastreBarco);
      if (!pts.size && movido < 4 && e.type === 'pointerup' && ini && ini.btn === 0 && S.herr !== 'cavar' && S.herr !== 'elevar') tocar(e);
      if (!pts.size) { ini = null; arrastreBarco = null; }
    };
    el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
    el.addEventListener('pointerleave', () => { S.tip.hidden = true; });
  };

  // ---------------------------------------------------------------- Mover tierra
  const radioPincel = () => cl(S.cam.dist * 0.035, 0.9, 6);
  const pincel = (ev) => {
    const p = puntoSuelo(ev); if (!p) return;
    const rad = radioPincel(), delta = (S.herr === 'cavar' ? -0.32 : 0.32) * cl(rad / 1.5, 0.8, 3);
    const d = { id: nuevoId(), t: 'terreno', x: p.x, z: p.z, r: 0, e: rad.toFixed(2) + '|' + delta.toFixed(2) };
    aplicarTerreno(d, true); S.lista.push(Object.assign({}, d, { o3d: null })); guardar('mundo_agregar', { obj: limpio(d) });
  };
  const aplicarTerreno = (d, refrescar) => {
    const [rad, delta] = String(d.e).split('|').map(Number); if (!(rad > 0)) return;
    const px0 = Math.max(0, Math.floor((d.x - rad + CX) * HS)), px1 = Math.min(HW - 1, Math.ceil((d.x + rad + CX) * HS)), py0 = Math.max(0, Math.floor((d.z - rad + CZ) * HS)), py1 = Math.min(HH - 1, Math.ceil((d.z + rad + CZ) * HS));
    for (let py = py0; py <= py1; py++) for (let px = px0; px <= px1; px++) {
      const x = (px + 0.5) / HS - CX, z = (py + 0.5) / HS - CZ, dd = Math.hypot(x - d.x, z - d.z) / rad; if (dd >= 1) continue;
      const i = py * HW + px, f = 0.5 + 0.5 * Math.cos(dd * Math.PI);
      S.h[i] = cl(S.h[i] + delta * f, -HONDO, HMAX); S.v8[i * 4] = Math.round(cl(valorDe(S.h[i]), 0, 255));
    }
    if (refrescar) refrescarTerreno(d.x - rad - 2, d.z - rad - 2, d.x + rad + 2, d.z + rad + 2);
  };
  const refrescarTerreno = (x0, z0, x1, z1) => {
    // Malla del mundo: solo los vértices de la zona
    const m = S.terreno, pos = m.geometry.attributes.position, b = m.userData.base;
    for (let i = 0; i < pos.count; i++) { const x = b[i * 3], z = b[i * 3 + 2]; if (x < x0 || x > x1 || z < z0 || z > z1) continue; pos.setY(i, altura(x, z)); }
    pos.needsUpdate = true; m.geometry.computeVertexNormals();
    S.parcheSucio = true; S.texProf.needsUpdate = true;
    S.ponerArboles(x0, z0, x1, z1);
    // Lo construido en la zona se acomoda a la nueva altura
    S.lista.forEach((d) => { const o = d.o3d; if (!o || d.t === 'barco' || d.t === 'nube' || d.t === 'tormenta' || d.t === 'puente') return; if (o.position.x < x0 || o.position.x > x1 || o.position.z < z0 || o.position.z > z1) return; o.position.y = Math.max(0, altura(o.position.x, o.position.z)); });
  };

  // ---------------------------------------------------------------- Construir
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const rejilla = (v) => Math.round(v * 2) / 2;
  const tocar = (e) => {
    const h = S.herr;
    if (h === 'borrar') { const o = objetoBajo(e); if (o) quitar(o.userData.id, true); else avisar('Toca algo que hayas construido para quitarlo.'); return; }
    const p = puntoSuelo(e); if (!p) return;
    if (h === 'explorar') { const n = p.y > 0.05 ? paisEn(p.x, p.z) : null; if (n && S.cam.dDist > 40) { irA(p.x, p.z, 26); avisar(n + ': arrastra para recorrerlo, gira con clic derecho o dos dedos.'); } return; }
    const tierra = p.y > 0.12, agua = p.y <= 0.05;
    if (['casa', 'edificio', 'cultivo', 'arbol', 'persona', 'muro'].includes(h) && !tierra) { avisar('Eso va en tierra firme.'); return; }
    if (h === 'barco' && !agua) { avisar('El barco va en el agua.'); return; }
    if (h === 'puente' || h === 'muro') {
      const x = h === 'muro' ? rejilla(p.x) : p.x, z = h === 'muro' ? rejilla(p.z) : p.z;
      if (!S.inicioLinea) { S.inicioLinea = [x, z]; avisar('Ahora toca dónde termina.'); return; }
      const [ax, az] = S.inicioLinea; S.inicioLinea = null; const largo = Math.hypot(x - ax, z - az);
      if (largo < 0.3 || largo > 14) { avisar(largo > 14 ? 'Es muy largo: acércate y hazlo por partes.' : 'Los puntos están muy juntos.'); return; }
      const extra = h === 'puente' ? largo.toFixed(2) + '|' + Math.max(altura(ax, az), altura(x, z), 0).toFixed(2) : largo.toFixed(2);
      agregar({ id: nuevoId(), t: h, x: (ax + x) / 2, z: (az + z) / 2, r: Math.atan2(-(z - az), x - ax), e: extra });
      if (h === 'muro') { S.inicioLinea = [x, z]; avisar('Sigue tocando para continuar el muro; cambia de herramienta para terminar.'); }
      return;
    }
    const v = String(Math.floor(Math.random() * 60));
    if (h === 'persona') { for (let i = 0; i < 3; i++) agregar({ id: nuevoId(), t: 'persona', x: p.x + (Math.random() - 0.5) * 0.5, z: p.z + (Math.random() - 0.5) * 0.5, r: 0, e: v + i }); return; }
    const enRejilla = h === 'casa' || h === 'edificio' || h === 'cultivo';
    agregar({ id: nuevoId(), t: h, x: enRejilla ? rejilla(p.x) : p.x, z: enRejilla ? rejilla(p.z) : p.z, r: enRejilla ? S.giro : Math.random() * 6.28, e: v });
  };

  const crear3D = (d) => {
    const { F } = S.Mo; const v = Number(String(d.e || '0').split('|')[0]) || 0; let o;
    const y = Math.max(0, altura(d.x, d.z));
    switch (d.t) {
      case 'casa': o = F.casa(v); break;
      case 'edificio': o = F.edificio(v); break;
      case 'muro': o = F.muro(Number(d.e) || 1); break;
      case 'arbol': o = F.arbol(v); o.scale.setScalar(1.2); break;
      case 'cultivo': o = F.cultivo(v); break;
      case 'persona': o = F.persona(v); break;
      case 'barco': o = F.barco(v); break;
      case 'puente': { const [l, hh] = String(d.e).split('|').map(Number); o = F.puente(l || 1); o.position.y = (hh || 0) + 0.12; break; }
      case 'nube': o = F.nube(false); o.scale.setScalar(1.7); break;
      case 'tormenta': o = F.nube(true); o.scale.setScalar(2); break;
      default: return null;
    }
    o.position.x = d.x; o.position.z = d.z;
    if (d.t !== 'puente') o.position.y = d.t === 'barco' ? 0.05 : d.t === 'nube' || d.t === 'tormenta' ? Math.max(y, 0) + 9 : y;
    o.rotation.y = d.r || 0;
    o.userData = { id: d.id, t: d.t, x: d.x, z: d.z, r: d.r || 0, nace: d.f ? Date.parse(d.f) || Date.now() : Date.now(), cx: d.x, cz: d.z, fase: Math.random() * 6.28, estado: 'pasear', lluvia: 0 };
    if (d.t === 'tormenta') {
      const n = 300, g = new S.THREE.BufferGeometry(), arr = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 3, z = (Math.random() - 0.5) * 2, yy = -Math.random() * 9; arr.set([x, yy, z, x - 0.05, yy - 0.5, z], i * 6); }
      g.setAttribute('position', new S.THREE.BufferAttribute(arr, 3));
      const ll = new S.THREE.LineSegments(g, new S.THREE.LineBasicMaterial({ color: 0xbfd6ee, transparent: true, opacity: 0.7 })); ll.scale.setScalar(0.5); o.add(ll); o.userData.gotas = ll;
      const inunda = new S.THREE.Mesh(new S.THREE.CircleGeometry(3.2, 40), S.matInunda); inunda.rotation.x = -Math.PI / 2; inunda.visible = false; S.inundaciones.add(inunda); o.userData.inunda = inunda;
    }
    return o;
  };
  const agregar = (d, sinGuardar) => {
    if (S.lista.length >= 6000) { avisar('El mundo ya está lleno. Quita algunas cosas para seguir.'); return; }
    if (d.t === 'terreno') { aplicarTerreno(d, !sinGuardar); S.lista.push(Object.assign({}, d, { o3d: null })); if (!sinGuardar) guardar('mundo_agregar', { obj: limpio(d) }); return; }
    const o = crear3D(d); if (!o) return;
    S.objetos.add(o); S.lista.push(Object.assign({}, d, { o3d: o, local: sinGuardar ? 0 : Date.now() }));
    if (!sinGuardar) guardar('mundo_agregar', { obj: limpio(d) });
  };
  const quitar = (id, guardarlo) => {
    const i = S.lista.findIndex((x) => x.id === id); if (i < 0) return;
    const o = S.lista[i].o3d; if (o) { if (o.userData.inunda) S.inundaciones.remove(o.userData.inunda); S.objetos.remove(o); }
    S.lista.splice(i, 1);
    if (guardarlo) guardar('mundo_borrar', { id });
  };
  const limpio = (d) => ({ id: d.id, t: d.t, x: Math.round(d.x * 1000) / 1000, z: Math.round(d.z * 1000) / 1000, r: Math.round((d.r || 0) * 1000) / 1000, e: d.e || '' });
  const guardarMovimiento = (o) => { const d = S.lista.find((x) => x.id === o.userData.id); if (!d) return; d.x = o.userData.x; d.z = o.userData.z; d.r = o.userData.r; guardar('mundo_mover', { obj: limpio(d) }); };

  // ---------------------------------------------------------------- Guardar en la hoja (en cola, de a uno)
  S.cola = [];
  const guardar = (accion, extra) => { S.cola.push(Object.assign({ accion }, extra)); if (!S.ocupado) vaciarCola(); };
  const vaciarCola = async () => {
    if (!window.idealabEnviar) return;
    S.ocupado = true;
    while (S.cola.length) {
      const b = S.cola.shift();
      try { await window.idealabEnviar(b); }
      catch (e) { avisar(/desconocida|no válido/i.test(String(e.message)) ? 'Para guardar esto hay que publicar la versión nueva del servidor.' : 'No se pudo guardar: ' + e.message); }
    }
    S.ocupado = false;
  };
  const cargarConstruido = async (silencioso) => {
    if (!window.idealabEnviar) return;
    try {
      const r = await window.idealabEnviar({ accion: 'mundo_leer' });
      const llegan = (r.objetos || []).filter((d) => d && d.id && d.t);
      const ids = new Set(llegan.map((d) => d.id));
      S.lista.slice().forEach((d) => { if (!ids.has(d.id) && d.t !== 'terreno' && !(d.local && Date.now() - d.local < 180000)) quitar(d.id, false); });
      let cambioTerreno = false;
      llegan.forEach((d) => {
        const ya = S.lista.find((x) => x.id === d.id);
        const dd = { id: String(d.id), t: String(d.t), x: Number(d.x), z: Number(d.z), r: Number(d.r) || 0, e: String(d.e || ''), f: d.f };
        if (!ya) { if (dd.t === 'terreno') { aplicarTerreno(dd, false); S.lista.push(Object.assign({}, dd, { o3d: null })); cambioTerreno = true; } else agregar(dd, true); }
        else if (ya.t === 'barco' && (Math.abs(ya.x - dd.x) > 0.01 || Math.abs(ya.z - dd.z) > 0.01)) { ya.x = dd.x; ya.z = dd.z; ya.o3d.position.x = dd.x; ya.o3d.position.z = dd.z; ya.o3d.rotation.y = dd.r; ya.o3d.userData.x = dd.x; ya.o3d.userData.z = dd.z; }
      });
      if (cambioTerreno) { S.ponerAlturas(S.terreno); S.parcheSucio = true; S.texProf.needsUpdate = true; S.ponerArboles(); S.lista.forEach((d) => { const o = d.o3d; if (o && ['casa', 'edificio', 'muro', 'arbol', 'cultivo', 'persona'].includes(d.t)) o.position.y = Math.max(0, altura(o.position.x, o.position.z)); }); }
    } catch (e) { if (!silencioso) avisar(/desconocida/i.test(String(e.message)) ? 'Para guardar lo que construyas hay que publicar la versión nueva del servidor.' : 'No se pudo leer el mundo guardado: ' + e.message); }
  };

  // ---------------------------------------------------------------- Pueblos de las ventas (sin letreros)
  const actualizarPueblos = () => {
    if (!S.pueblos) return;
    S.pueblos.clear(); S.refugiosPueblo = [];
    const R = window.dash && window.dash.data('resumen'); if (!R || R.status !== 'ok') return;
    R.data.filter((f) => f.nivel === 'pais' && f.ventas_total_n > 0).forEach((f) => {
      const p = S.paises.find((x) => x.n === f.nombre); if (!p) return;
      const cx = p.c[0] - CX, cz = p.c[1] - CZ; const rnd = azar(f.nombre);
      const n = Math.min(40, f.ventas_total_n); let puestas = 0;
      // Pueblo ordenado: casas en cuadrícula alrededor de una plaza
      for (let i = 0; i < 600 && puestas < n; i++) {
        const lado = Math.ceil(Math.sqrt(n)) + 2, gx = (Math.floor(rnd() * lado) - lado / 2) * 0.9, gz = (Math.floor(rnd() * lado) - lado / 2) * 0.9;
        if (Math.abs(gx) < 0.9 && Math.abs(gz) < 0.9) continue;
        const x = cx + gx, z = cz + gz; if (!esTierra(x, z) || S.pueblos.children.some((c) => Math.hypot(c.position.x - x, c.position.z - z) < 0.5)) continue;
        const c = S.Mo.F.casa(Math.floor(rnd() * 20)); c.position.set(x, altura(x, z), z); c.rotation.y = Math.floor(rnd() * 4) * Math.PI / 2; S.pueblos.add(c); S.refugiosPueblo.push(c); puestas++;
      }
      const ban = S.Mo.F.banderin(); ban.position.set(cx, Math.max(0, altura(cx, cz)), cz); ban.scale.setScalar(1.4);
      ban.getObjectByName('tela').material = f.ganancia > 0 ? S.Mo.M.verde : f.ganancia < 0 ? S.Mo.M.rojo : S.Mo.M.gris; S.pueblos.add(ban);
    });
  };

  // ---------------------------------------------------------------- Vida: personas, clima, barcos
  const refugios = () => S.lista.filter((d) => d.o3d && (d.t === 'casa' || d.t === 'edificio')).map((d) => d.o3d).concat(S.refugiosPueblo || []);
  const tormentaSobre = (x, z) => S.lista.find((d) => d.t === 'tormenta' && d.o3d && Math.hypot(d.o3d.position.x - x, d.o3d.position.z - z) < 3.4);
  const buscarPlaya = (x, z) => {
    let mejor = null, md = 1e9;
    for (let k = 0; k < 40; k++) { const a = (k / 40) * 6.28, rr = 0.6 + (k % 8) * 0.7; const px = x + Math.cos(a) * rr, pz = z + Math.sin(a) * rr; const h = altura(px, pz); if (h > 0.13 && h < 0.45) { const ax = px + Math.cos(a) * 0.5, az = pz + Math.sin(a) * 0.5; if (altura(ax, az) < 0.05) { const dd = Math.hypot(px - x, pz - z); if (dd < md) { md = dd; mejor = [px, pz]; } } } }
    return mejor;
  };
  const caminarHacia = (o, u, tx, tz, vel, dt, t) => {
    const dx = tx - o.position.x, dz = tz - o.position.z, L = Math.hypot(dx, dz);
    if (L < 0.04) return true;
    const paso = Math.min(L, vel * dt); const nx = o.position.x + (dx / L) * paso, nz = o.position.z + (dz / L) * paso;
    if (altura(nx, nz) > 0.08) { o.position.x = nx; o.position.z = nz; }
    else { u.dest = null; return true; }
    o.position.y = Math.max(0, altura(o.position.x, o.position.z)); o.rotation.y = Math.atan2(dx, dz);
    o.getObjectByName('cuerpo').position.y = Math.abs(Math.sin(t * (vel > 0.3 ? 16 : 9) + u.fase)) * 0.025;
    return false;
  };
  const vivirPersona = (o, u, dt, t) => {
    u.pensar = (u.pensar || 0) - dt;
    if (u.pensar <= 0) {
      u.pensar = 0.6;
      const lluvia = tormentaSobre(o.position.x, o.position.z) || (u.casa && tormentaSobre(u.casa.position.x, u.casa.position.z));
      if (lluvia) {
        if (u.estado !== 'refugio' && u.estado !== 'dentro') { let mejor = null, md = 9; refugios().forEach((c) => { const dd = Math.hypot(c.position.x - o.position.x, c.position.z - o.position.z); if (dd < md) { md = dd; mejor = c; } }); if (mejor) { u.estado = 'refugio'; u.casa = mejor; } else { u.estado = 'huir'; const tz = lluvia.o3d.position; const a = Math.atan2(o.position.z - tz.z, o.position.x - tz.x); u.dest = [o.position.x + Math.cos(a) * 4, o.position.z + Math.sin(a) * 4]; } }
      } else if (u.estado === 'dentro' || u.estado === 'refugio' || u.estado === 'huir') { u.estado = 'pasear'; o.visible = true; u.dest = null; }
      else if (S.calor && u.estado !== 'playa' && u.estado !== 'yendoPlaya') { const p = buscarPlaya(o.position.x, o.position.z); if (p) { u.estado = 'yendoPlaya'; u.dest = p; } }
      else if (!S.calor && (u.estado === 'playa' || u.estado === 'yendoPlaya')) { u.estado = 'pasear'; u.dest = null; o.getObjectByName('playa').visible = false; }
    }
    switch (u.estado) {
      case 'refugio': if (u.casa && caminarHacia(o, u, u.casa.position.x, u.casa.position.z + 0.3, 0.6, dt, t)) { u.estado = 'dentro'; o.visible = false; } break;
      case 'dentro': break;
      case 'huir': if (!u.dest || caminarHacia(o, u, u.dest[0], u.dest[1], 0.6, dt, t)) u.estado = 'pasear'; break;
      case 'yendoPlaya': if (!u.dest || caminarHacia(o, u, u.dest[0], u.dest[1], 0.35, dt, t)) { u.estado = 'playa'; o.getObjectByName('playa').visible = true; o.getObjectByName('cuerpo').position.y = 0; } break;
      case 'playa': break;
      default: {
        if (!u.dest) { for (let k = 0; k < 6; k++) { const nx = u.cx + (Math.random() - 0.5) * 1.8, nz = u.cz + (Math.random() - 0.5) * 1.8; if (esTierra(nx, nz)) { u.dest = [nx, nz]; break; } } if (!u.dest) u.dest = [u.cx, u.cz]; }
        if (caminarHacia(o, u, u.dest[0], u.dest[1], 0.14, dt, t)) u.dest = null;
      }
    }
  };
  const animar = (dt, t) => {
    ponerCamara();
    const U = S.agua.material.uniforms; U.t.value = t; U.calor.value += ((S.calor ? 1 : 0) - U.calor.value) * 0.05;
    const c = U.calor.value; S.sol.intensity = 1.05 + c * 0.45; S.sol.color.setHSL(0.11 - c * 0.02, 0.6 + c * 0.3, 0.88); S.hemi.intensity = 0.62 + c * 0.15; S.cielo.material.uniforms.sol.value = c;
    const ahora = Date.now(); let rayoAhora = null;
    S.lista.forEach((d) => {
      const o = d.o3d; if (!o) return; const u = o.userData;
      switch (d.t) {
        case 'barco': { const k = o.getObjectByName('casco'); k.position.y = Math.sin(t * 1.6 + u.fase) * 0.03; k.rotation.x = Math.sin(t * 1.3 + u.fase) * 0.06; k.rotation.z = Math.cos(t * 1.1 + u.fase) * 0.04; u.vel = (u.vel || 0) * 0.96; const es = o.getObjectByName('estela'); es.material.opacity = Math.min(0.6, u.vel); break; }
        case 'persona': vivirPersona(o, u, dt, t); break;
        case 'cultivo': { const b = o.getObjectByName('brotes'); b.scale.set(1, Math.min(1, 0.25 + (ahora - u.nace) / 90000), 1); break; }
        case 'nube': case 'tormenta': {
          o.position.x = u.cx + Math.sin(t * 0.05 + u.fase) * 2.5; o.position.z = u.cz + Math.cos(t * 0.04 + u.fase) * 1.6;
          if (u.gotas) {
            const a = u.gotas.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 14; if (y < -9.5) y += 9; a.setY(i, y); } a.needsUpdate = true;
            if (Math.random() < dt * 0.25) rayoAhora = o;
            // Si llueve mucho tiempo en el mismo lugar, se inunda (el agua sube en lo más bajo)
            u.lluvia = Math.min(150, u.lluvia + dt); const nivel = Math.max(0, (u.lluvia - 25) / 125) * 0.55;
            const iu = u.inunda; iu.visible = nivel > 0.01; if (iu.visible) { const gx = u.cx, gz = u.cz; let hmin = 99; for (let k = 0; k < 9; k++) { const hh = altura(gx + (k % 3 - 1) * 1.4, gz + (Math.floor(k / 3) - 1) * 1.4); hmin = Math.min(hmin, hh); } iu.position.set(gx, Math.max(0.03, hmin) + nivel, gz); iu.scale.setScalar(0.6 + nivel * 1.2); }
          }
          break;
        }
        default: break;
      }
    });
    if (rayoAhora) { S.destello.position.copy(rayoAhora.position); S.flash = 0.25; }
    if (S.flash > 0) { S.flash -= dt; S.destello.intensity = S.flash > 0 ? 6 * (S.flash / 0.25) * (Math.random() > 0.3 ? 1 : 0.2) : 0; }
  };

  // ---------------------------------------------------------------- API
  window.idealabMundo = {
    abrir: (host) => {
      activo = true;
      if (iniciado) { actualizarPueblos(); return; }
      iniciado = true; host.textContent = 'Cargando el mundo 3D…';
      construir(host).catch((e) => { iniciado = false; host.textContent = 'No se pudo abrir el mundo 3D: ' + (e && e.message ? e.message : e); });
    },
    cerrar: () => { activo = false; },
    _estado: () => S,
  };
})();
