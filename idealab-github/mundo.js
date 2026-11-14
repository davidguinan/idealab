/* IdeaLab · Mundo 3D
 * Maqueta 3D de Latinoamérica y la península ibérica hecha con relieve real (elevación y satélite).
 * - Mar animado con olas y espuma en la costa.
 * - Al acercarte a un país ves árboles, pueblos y montañas; al pasar el puntero, su ROAS y ventas.
 * - Cada venta del periodo elegido levanta una casita en su país (pueblo con banderín).
 * - Herramientas para construir: casas, cultivos, árboles, personas, barcos (se pueden arrastrar),
 *   puentes, nubes y tormentas. Lo construido se guarda en la hoja (pestaña Mundo) y lo ven los dos socios.
 */
(function () {
  'use strict';
  const X0 = 165, Y0 = 96, W = 360, H = 364, CX = X0 + W / 2, CZ = Y0 + H / 2; // región del mapa (unidades del mapa)
  const HMAX = 9, HONDO = 2.2;
  let iniciado = false, activo = false;
  const S = {}; // estado compartido

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

  // ---------------------------------------------------------------- Altura del terreno
  const valorAlto = (mx, my) => {
    const A = S.alto; const px = (mx - X0) * 2 - 0.5, py = (my - Y0) * 2 - 0.5;
    if (px < 0 || py < 0 || px > A.w - 1 || py > A.h - 1) return 0;
    const x0 = Math.floor(px), y0 = Math.floor(py), fx = px - x0, fy = py - y0, x1 = Math.min(A.w - 1, x0 + 1), y1 = Math.min(A.h - 1, y0 + 1);
    const g = (x, y) => A.d[(y * A.w + x) * 4];
    return g(x0, y0) * (1 - fx) * (1 - fy) + g(x1, y0) * fx * (1 - fy) + g(x0, y1) * (1 - fx) * fy + g(x1, y1) * fx * fy;
  };
  const alturaDe = (v) => (v >= 64 ? ((v - 64) / 191) * HMAX : ((v - 64) / 64) * HONDO);
  const altura = (x, z) => alturaDe(valorAlto(x + CX, z + CZ));
  const esTierra = (x, z) => altura(x, z) > 0.12;
  const colorEn = (x, z) => { const C = S.color; const px = Math.round((x + CX - X0) * 4), py = Math.round((z + CZ - Y0) * 4); if (px < 0 || py < 0 || px >= C.w || py >= C.h) return [0, 0, 0]; const o = (py * C.w + px) * 4; return [C.d[o], C.d[o + 1], C.d[o + 2]]; };

  // ---------------------------------------------------------------- Países (para el puntero y los pueblos)
  const prepararPaises = () => {
    const M = window.MAPA_MUNDO; S.paises = [];
    if (!M) return;
    M.paths.filter((p) => p.n).forEach((p) => {
      const anillos = []; let cur = null;
      const tok = p.d.match(/[MLZ]|-?\d+(?:\.\d+)?/g) || [];
      for (let i = 0; i < tok.length; i++) {
        const t = tok[i];
        if (t === 'M') { cur = []; anillos.push(cur); } else if (t === 'L' || t === 'Z') { /* nada */ } else { cur.push([Number(t), Number(tok[++i])]); }
      }
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      anillos.forEach((a) => a.forEach(([x, y]) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }));
      S.paises.push({ n: p.n, c: p.c, anillos, caja: [x0, y0, x1, y1] });
    });
  };
  const dentro = (a, x, y) => { let s = false; for (let i = 0, j = a.length - 1; i < a.length; j = i++) { const [xi, yi] = a[i], [xj, yj] = a[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) s = !s; } return s; };
  const paisEn = (x, z) => { const mx = x + CX, my = z + CZ; for (const p of S.paises) { const c = p.caja; if (mx < c[0] || mx > c[2] || my < c[1] || my > c[3]) continue; if (p.anillos.some((a) => dentro(a, mx, my))) return p.n; } return null; };
  const filaPais = (n) => { const R = window.dash && window.dash.data('resumen'); return R && R.status === 'ok' ? R.data.find((f) => f.clave === 'pais|' + n) : null; };
  const rangoTxt = () => { const p = window.dash ? window.dash.params() : {}; const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']; const f = (s) => (s ? Number(s.slice(8, 10)) + ' ' + M[Number(s.slice(5, 7)) - 1] : ''); return p.desde === p.hasta ? 'el ' + f(p.desde) : 'del ' + f(p.desde) + ' al ' + f(p.hasta); };

  // ---------------------------------------------------------------- Modelos (formas sencillas tipo maqueta)
  const crearModelos = (THREE) => {
    const mat = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.85, flatShading: true }, o || {}));
    const M = {
      blanco: mat(0xf4efe4), crema: mat(0xeedfc0), terracota: mat(0xc0583a), azul: mat(0x2f6fb5), madera: mat(0x7a4b2a), madera2: mat(0x9a6a3e),
      hoja: mat(0x4f9a3a), hoja2: mat(0x2f7a32), palma: mat(0x5aa63c), tierra: mat(0x8a6038), brote: mat(0x7cc24a), vela: mat(0xfbf7ec),
      piel: mat(0xe0b08a), nube: mat(0xffffff, { roughness: 1, transparent: true, opacity: 0.95 }), nubeOsc: mat(0x5d6573, { roughness: 1, transparent: true, opacity: 0.95 }),
      piedra: mat(0xb9b2a6), verde: mat(0x2e9e57), rojo: mat(0xd93025), gris: mat(0x7a7f87),
    };
    const ropa = [0xd93025, 0x1a73e8, 0xf9ab00, 0x188038, 0x9334e6, 0xff6d01].map((c) => mat(c));
    const techos = [M.terracota, M.azul, mat(0x8f3b2a), mat(0x3d7a4a)];
    const paredes = [M.blanco, M.crema, mat(0xf2d7b6), mat(0xdfe8ef)];
    const G = {
      caja: new THREE.BoxGeometry(1, 1, 1), techo: new THREE.ConeGeometry(0.72, 0.45, 4, 1), cono: new THREE.ConeGeometry(1, 1, 7, 1), esfera: new THREE.IcosahedronGeometry(1, 0),
      cil: new THREE.CylinderGeometry(1, 1, 1, 6), bola: new THREE.SphereGeometry(1, 8, 6),
    };
    G.techo.rotateY(Math.PI / 4); G.techo.translate(0, 0.225, 0);
    const malla = (g, m, sx, sy, sz, x, y, z) => { const o = new THREE.Mesh(g, m); o.scale.set(sx, sy, sz); o.position.set(x || 0, y || 0, z || 0); o.castShadow = true; o.receiveShadow = true; return o; };
    const r = (n, i) => n[Math.abs(i) % n.length];
    const F = {
      casa: (v) => { const g = new THREE.Group(); const k = v || 0; g.add(malla(G.caja, r(paredes, k), 0.5, 0.36, 0.42, 0, 0.18, 0)); const t = malla(G.techo, r(techos, k >> 2), 0.5, 0.6, 0.42, 0, 0.36, 0); g.add(t); g.add(malla(G.caja, M.madera, 0.1, 0.18, 0.02, 0.08, 0.09, 0.215)); if (k % 3 === 0) g.add(malla(G.caja, r(paredes, k + 1), 0.22, 0.6, 0.22, -0.18, 0.3, -0.12)); return g; },
      arbol: (v) => { const g = new THREE.Group(); const k = v || 0; if (k % 3 === 2) { g.add(malla(G.cil, M.madera2, 0.035, 0.7, 0.035, 0, 0.35, 0)); for (let i = 0; i < 5; i++) { const h = malla(G.cono, M.palma, 0.06, 0.38, 0.06, 0, 0.72, 0); h.rotation.z = 1.2; h.rotation.y = (i / 5) * Math.PI * 2; h.position.x = Math.cos(h.rotation.y) * 0.12; h.position.z = -Math.sin(h.rotation.y) * 0.12; g.add(h); } } else if (k % 3 === 1) { g.add(malla(G.cil, M.madera, 0.04, 0.2, 0.04, 0, 0.1, 0)); g.add(malla(G.cono, M.hoja2, 0.22, 0.6, 0.22, 0, 0.48, 0)); } else { g.add(malla(G.cil, M.madera, 0.045, 0.25, 0.045, 0, 0.125, 0)); g.add(malla(G.esfera, M.hoja, 0.24, 0.24, 0.24, 0, 0.42, 0)); } return g; },
      cultivo: (v) => { const g = new THREE.Group(); g.add(malla(G.caja, M.tierra, 1.1, 0.04, 0.8, 0, 0.02, 0)); const brotes = new THREE.Group(); brotes.name = 'brotes'; for (let i = 0; i < 5; i++) for (let j = 0; j < 7; j++) brotes.add(malla(G.cono, (v || 0) % 2 ? M.brote : M.hoja, 0.045, 0.16, 0.045, -0.42 + j * 0.14, 0.12, -0.28 + i * 0.14)); g.add(brotes); return g; },
      persona: (v) => { const g = new THREE.Group(); const k = v || 0; const cuerpo = new THREE.Group(); cuerpo.name = 'cuerpo'; cuerpo.add(malla(G.cil, r(ropa, k), 0.045, 0.12, 0.045, 0, 0.1, 0)); cuerpo.add(malla(G.cil, M.madera, 0.03, 0.06, 0.03, 0, 0.03, 0)); cuerpo.add(malla(G.bola, M.piel, 0.04, 0.04, 0.04, 0, 0.2, 0)); g.add(cuerpo); return g; },
      barco: (v) => { const g = new THREE.Group(); const casco = new THREE.Group(); casco.name = 'casco'; const forma = new THREE.Shape(); forma.moveTo(-0.45, 0.1); forma.lineTo(0.5, 0.1); forma.lineTo(0.32, -0.08); forma.lineTo(-0.38, -0.08); forma.lineTo(-0.45, 0.1); const gc = new THREE.ExtrudeGeometry(forma, { depth: 0.24, bevelEnabled: false }); gc.translate(0, 0, -0.12); const c = new THREE.Mesh(gc, (v || 0) % 2 ? M.madera : mat(0xffffff)); c.castShadow = true; casco.add(c); casco.add(malla(G.cil, M.madera, 0.015, 0.7, 0.015, 0, 0.45, 0)); const fv = new THREE.Shape(); fv.moveTo(0, 0); fv.lineTo(0, 0.55); fv.lineTo(0.36, 0); fv.lineTo(0, 0); const vela = new THREE.Mesh(new THREE.ShapeGeometry(fv), new THREE.MeshStandardMaterial({ color: 0xfbf7ec, side: THREE.DoubleSide, roughness: 0.9 })); vela.position.set(0.02, 0.18, 0); vela.castShadow = true; casco.add(vela); g.add(casco); return g; },
      nube: (oscura) => { const g = new THREE.Group(); const m = oscura ? M.nubeOsc : M.nube; [[0, 0, 0, 0.9], [0.8, -0.1, 0.2, 0.7], [-0.8, -0.15, -0.1, 0.65], [0.3, 0.35, -0.2, 0.6], [-0.35, 0.3, 0.25, 0.55], [0.1, -0.1, 0.6, 0.6]].forEach(([x, y, z, s]) => { const b = malla(G.bola, m, s, s * 0.8, s, x, y, z); b.castShadow = true; g.add(b); }); return g; },
      banderin: () => { const g = new THREE.Group(); g.add(malla(G.cil, M.gris, 0.02, 1.4, 0.02, 0, 0.7, 0)); const b = malla(G.caja, M.verde, 0.45, 0.25, 0.02, 0.23, 1.25, 0); b.name = 'tela'; g.add(b); return g; },
      puente: (largo) => { const g = new THREE.Group(); const n = Math.max(3, Math.round(largo / 0.22)); for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = -largo / 2 + t * largo, y = Math.sin(t * Math.PI) * Math.min(0.6, largo * 0.12); g.add(malla(G.caja, i % 2 ? M.madera : M.madera2, largo / n + 0.02, 0.05, 0.36, x, y, 0)); if (i % 2 === 0) { g.add(malla(G.cil, M.madera, 0.015, 0.22, 0.015, x, y + 0.11, 0.17)); g.add(malla(G.cil, M.madera, 0.015, 0.22, 0.015, x, y + 0.11, -0.17)); } } g.add(malla(G.caja, M.piedra, 0.22, 0.6, 0.42, -largo / 2, -0.25, 0)); g.add(malla(G.caja, M.piedra, 0.22, 0.6, 0.42, largo / 2, -0.25, 0)); return g; },
    };
    return { M, G, F, mat };
  };

  // ---------------------------------------------------------------- Escena
  const construir = async (host) => {
    const THREE = await cargarThree();
    const [imAlto, imColor] = await Promise.all([cargarImg('mundo-alto.png'), cargarImg('mundo-color.jpg')]);
    S.alto = pixeles(imAlto); S.color = pixeles(imColor);
    prepararPaises();
    const Mo = crearModelos(THREE); S.Mo = Mo;

    host.replaceChildren();
    const lienzo = document.createElement('div'); lienzo.className = 'mundo-lienzo'; host.appendChild(lienzo);
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    lienzo.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const CIELO = new THREE.Color(0xbfe6f7);
    scene.background = CIELO; scene.fog = new THREE.Fog(CIELO, 200, 700);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 3000);
    S.THREE = THREE; S.scene = scene; S.camera = camera; S.renderer = renderer;

    // Luces
    scene.add(new THREE.HemisphereLight(0xdff3ff, 0x6d5f45, 0.6));
    const sol = new THREE.DirectionalLight(0xfff1d6, 1.05); sol.castShadow = true; sol.shadow.mapSize.set(2048, 2048); sol.shadow.bias = -0.0006; sol.shadow.normalBias = 0.02;
    scene.add(sol); scene.add(sol.target); S.sol = sol;
    const destello = new THREE.PointLight(0xdfe8ff, 0, 40); scene.add(destello); S.destello = destello;

    // Terreno con relieve real
    const SX = 300, SY = 303;
    const geo = new THREE.PlaneGeometry(W, H, SX, SY); geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, altura(x, z)); }
    geo.computeVertexNormals();
    const tex = new THREE.Texture(imColor); tex.encoding = THREE.sRGBEncoding; tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); tex.needsUpdate = true;
    const terreno = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 }));
    terreno.receiveShadow = true; scene.add(terreno); S.terreno = terreno;

    // Mar animado (olas, brillo y espuma en la costa)
    const texAlto = new THREE.Texture(imAlto); texAlto.needsUpdate = true; texAlto.minFilter = THREE.LinearFilter; texAlto.generateMipmaps = false;
    const aguaMat = new THREE.ShaderMaterial({
      transparent: true, extensions: { derivatives: true }, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { t: { value: 0 }, alto: { value: null }, sol: { value: new THREE.Vector3(0.4, 0.8, 0.3).normalize() } }]),
      vertexShader: `uniform float t; varying vec3 vW; varying vec2 vUv;
        #include <fog_pars_vertex>
        void main(){ vec3 p = position; float w = sin(p.x*.55+t*1.1)*.045 + cos(p.y*.47+t*.8)*.045 + sin((p.x+p.y)*1.9+t*2.2)*.018; p.z += w;
          vec4 wp = modelMatrix*vec4(p,1.); vW = wp.xyz; vUv = vec2((wp.x+${CX.toFixed(1)}-${X0.toFixed(1)})/${W.toFixed(1)}, 1.-(wp.z+${CZ.toFixed(1)}-${Y0.toFixed(1)})/${H.toFixed(1)});
          vec4 mvPosition = viewMatrix*wp; gl_Position = projectionMatrix*mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float t; uniform sampler2D alto; uniform vec3 sol; varying vec3 vW; varying vec2 vUv;
        #include <fog_pars_fragment>
        void main(){ vec3 n = normalize(cross(dFdx(vW), dFdy(vW))); if (n.y < 0.) n = -n;
          float h = 0.; if (vUv.x>0. && vUv.x<1. && vUv.y>0. && vUv.y<1.) h = texture2D(alto, vUv).r*255.; float prof = clamp((64.-h)/64., 0., 1.);
          vec3 bajo = vec3(.45,.9,.86), medio = vec3(.13,.68,.78), hondo = vec3(.04,.36,.58);
          vec3 c = prof < .35 ? mix(bajo, medio, prof/.35) : mix(medio, hondo, (prof-.35)/.65);
          vec3 v = normalize(cameraPosition - vW); float fres = pow(1.-max(dot(n,v),0.), 3.);
          float spec = pow(max(dot(reflect(-sol, n), v), 0.), 60.)*.8*(1.-smoothstep(40., 160., length(cameraPosition - vW)));
          float dCam = length(cameraPosition - vW); float brillo = smoothstep(.985, 1., sin(vW.x*3.1+t*1.7)*sin(vW.z*2.7-t*1.3))*.35*(1.-smoothstep(15., 60., dCam));
          float espuma = (1.-smoothstep(.0,.07,prof)) * mix(.75, .55+.45*sin(prof*120.-t*2.5), 1.-smoothstep(30., 120., dCam)) * step(.004, prof);
          c = mix(c, vec3(.85,.95,1.), fres*.35) + spec + brillo; c = mix(c, vec3(1.), clamp(espuma,0.,1.)*.8);
          float a = mix(.55, .98, smoothstep(.0,.6,prof)) ; a = max(a, espuma*.9);
          gl_FragColor = vec4(c, a);
          #include <fog_fragment>
        }`,
    });
    aguaMat.uniforms.alto.value = texAlto;
    const agua = new THREE.Mesh(new THREE.PlaneGeometry(W * 3, H * 3, 220, 220), aguaMat); agua.rotation.x = -Math.PI / 2; agua.position.y = 0.02; scene.add(agua); S.agua = agua;
    // Fondo marino fuera de la región
    const fondo = new THREE.Mesh(new THREE.PlaneGeometry(W * 6, H * 6), new THREE.MeshBasicMaterial({ color: 0x0c4f7e })); fondo.rotation.x = -Math.PI / 2; fondo.position.y = -HONDO - 0.05; scene.add(fondo);

    // Bosques (decoración): árboles donde el terreno es verde
    const rnd = azar('bosque-idealab');
    const pinos = [], redondos = [];
    for (let i = 0; i < 26000 && pinos.length + redondos.length < 7000; i++) {
      const x = (rnd() - 0.5) * W, z = (rnd() - 0.5) * H; const h = altura(x, z); if (h < 0.25 || h > 6.5) continue;
      const [r, g, b] = colorEn(x, z); if (!(g > r + 12 && g > b + 20)) continue;
      (h > 3 || rnd() < 0.3 ? pinos : redondos).push([x, h, z, 0.5 + rnd() * 0.6, rnd() * 6.28]);
    }
    const instancias = (geom, mat, lista, dy, sx, sy) => { const im = new THREE.InstancedMesh(geom, mat, lista.length); const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(); lista.forEach(([x, h, z, s, r], i) => { e.set(0, r, 0); q.setFromEuler(e); m.compose(new THREE.Vector3(x, h + dy * s, z), q, new THREE.Vector3(sx * s, sy * s, sx * s)); im.setMatrixAt(i, m); }); im.castShadow = true; im.receiveShadow = true; scene.add(im); return im; };
    instancias(Mo.G.cono, Mo.M.hoja2, pinos, 0.32, 0.17, 0.5);
    instancias(Mo.G.esfera, Mo.M.hoja, redondos, 0.28, 0.2, 0.2);
    instancias(Mo.G.cil, Mo.M.madera, pinos.concat(redondos), 0.06, 0.03, 0.14);

    // Grupos
    S.objetos = new THREE.Group(); scene.add(S.objetos);
    S.pueblos = new THREE.Group(); scene.add(S.pueblos);
    S.lluvia = [];
    S.lista = []; // objetos construidos {id, t, x, z, r, e, o3d}

    // Cámara tipo mapa: arrastrar, rueda/pellizco para acercar, clic derecho o dos dedos para girar
    S.cam = { tx: -10, tz: 40, dist: 330, az: 0, dTx: -10, dTz: 40, dDist: 330, dAz: 0 };
    const tamano = () => { const w = lienzo.clientWidth || 800, h = lienzo.clientHeight || 520; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    new ResizeObserver(tamano).observe(lienzo); tamano();

    montarInterfaz(host, lienzo);
    montarControles(renderer.domElement);
    await cargarConstruido();
    actualizarPueblos();
    if (window.dash) window.dash.onData(() => { if (activo) actualizarPueblos(); });
    setInterval(() => { if (activo && !S.ocupado) cargarConstruido(true); }, 60000);

    const reloj = new THREE.Clock();
    const bucle = () => {
      requestAnimationFrame(bucle);
      if (!activo || !host.offsetParent) return;
      const dt = Math.min(0.05, reloj.getDelta()), t = reloj.elapsedTime;
      animar(dt, t);
      renderer.render(scene, camera);
    };
    bucle();
  };

  // ---------------------------------------------------------------- Cámara
  const ponerCamara = () => {
    const { THREE, camera, sol } = S; const c = S.cam;
    const k = 0.12; c.tx += (c.dTx - c.tx) * k; c.tz += (c.dTz - c.tz) * k; c.dist += (c.dDist - c.dist) * k; c.az += (c.dAz - c.az) * k;
    const cerca = Math.max(0, Math.min(1, (c.dist - 4) / 300)); // 0 = muy cerca, 1 = lejos
    const incl = (1 - cerca) * 1.05 + cerca * 0.18; // ángulo desde la vertical: de cerca se ve en perspectiva, de lejos casi desde arriba
    const ty = Math.max(0, altura(c.tx, c.tz));
    camera.position.set(c.tx + Math.sin(c.az) * Math.sin(incl) * c.dist, ty + Math.cos(incl) * c.dist, c.tz + Math.cos(c.az) * Math.sin(incl) * c.dist);
    camera.lookAt(c.tx, ty, c.tz);
    camera.near = Math.max(0.03, c.dist / 400); camera.far = c.dist * 8 + 400; camera.updateProjectionMatrix();
    S.scene.fog.near = c.dist * 1.6; S.scene.fog.far = c.dist * 4 + 300;
    // Sombras alrededor de lo que se mira
    const r = Math.max(6, Math.min(140, c.dist * 0.9));
    sol.position.set(c.tx - r * 0.6, ty + r * 1.4, c.tz - r * 0.4); sol.target.position.set(c.tx, ty, c.tz);
    const sc = sol.shadow.camera; sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r; sc.near = 0.1; sc.far = r * 4; sc.updateProjectionMatrix();
  };
  const limitar = () => { const c = S.cam; c.dTx = Math.max(-W / 2, Math.min(W / 2, c.dTx)); c.dTz = Math.max(-H / 2, Math.min(H / 2, c.dTz)); c.dDist = Math.max(3, Math.min(360, c.dDist)); };
  const irA = (x, z, dist) => { S.cam.dTx = x; S.cam.dTz = z; S.cam.dDist = dist; limitar(); };

  // ---------------------------------------------------------------- Rayos (qué hay bajo el puntero)
  const rayo = (ev) => {
    const { THREE, camera, renderer } = S; const r = renderer.domElement.getBoundingClientRect();
    const v = new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(v, camera); return rc;
  };
  const puntoSuelo = (ev) => {
    const rc = rayo(ev); const hit = rc.intersectObject(S.terreno, false)[0];
    let p = hit ? hit.point : null;
    const pl = new S.THREE.Plane(new S.THREE.Vector3(0, 1, 0), -0.02); const pa = new S.THREE.Vector3();
    if (rc.ray.intersectPlane(pl, pa) && (!p || p.y < 0.02)) p = pa; // si el terreno está bajo el agua, el punto es el agua
    return p;
  };
  const objetoBajo = (ev, filtro) => { const rc = rayo(ev); const hits = rc.intersectObjects(S.objetos.children, true); for (const h of hits) { let o = h.object; while (o && !o.userData.id) o = o.parent; if (o && (!filtro || filtro(o))) return o; } return null; };

  // ---------------------------------------------------------------- Interfaz
  const HERR = [
    ['explorar', '🖐️', 'Explorar', 'Explorar y mover barcos'], ['casa', '🏠', 'Casa', 'Construir casa'], ['cultivo', '🌱', 'Cultivo', 'Sembrar cultivo'], ['arbol', '🌳', 'Árbol', 'Plantar árbol'],
    ['persona', '🧍', 'Personas', 'Poner personas'], ['barco', '⛵', 'Barco', 'Poner barco en el mar'], ['puente', '🌉', 'Puente', 'Construir puente (toca dos orillas)'],
    ['nube', '☁️', 'Nube', 'Crear nube'], ['tormenta', '⛈️', 'Tormenta', 'Crear tormenta'], ['borrar', '🗑️', 'Quitar', 'Quitar lo que toques'],
  ];
  const montarInterfaz = (host, lienzo) => {
    S.herr = 'explorar';
    const barra = document.createElement('div'); barra.className = 'mundo-barra'; barra.setAttribute('role', 'toolbar');
    HERR.forEach(([id, ic, corto, tit]) => { const b = document.createElement('button'); b.type = 'button'; b.dataset.h = id; b.title = tit; b.setAttribute('aria-label', tit); b.innerHTML = '<span>' + ic + '</span><em>' + corto + '</em>'; if (id === 'explorar') b.classList.add('on'); b.addEventListener('click', () => { S.herr = id; S.puenteA = null; barra.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); avisar(id === 'puente' ? 'Toca la primera orilla del puente.' : id === 'explorar' ? 'Arrastra para moverte, rueda para acercarte; arrastra un barco para moverlo.' : tit + ': toca el mapa.'); }); barra.appendChild(b); });
    host.appendChild(barra);
    const zoom = document.createElement('div'); zoom.className = 'mundo-zoom';
    [['+', 'Acercar', () => { S.cam.dDist *= 0.6; limitar(); }], ['−', 'Alejar', () => { S.cam.dDist /= 0.6; limitar(); }], ['⟲', 'Ver todo', () => { S.cam.dAz = 0; irA(-10, 40, 330); }]].forEach(([t, ti, fn]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t; b.title = ti; b.setAttribute('aria-label', ti); b.addEventListener('click', fn); zoom.appendChild(b); });
    lienzo.appendChild(zoom);
    S.tip = document.createElement('div'); S.tip.className = 'map-tip'; S.tip.hidden = true; lienzo.appendChild(S.tip);
    S.aviso = document.createElement('div'); S.aviso.className = 'mundo-aviso'; lienzo.appendChild(S.aviso);
    avisar('Toca un país para acercarte. Cada venta del periodo levanta una casita en su país.');
  };
  const avisar = (txt) => { if (!S.aviso) return; S.aviso.textContent = txt; S.aviso.classList.add('ver'); clearTimeout(S.avisoT); S.avisoT = setTimeout(() => S.aviso.classList.remove('ver'), 5000); };

  const mostrarTip = (ev) => {
    const p = puntoSuelo(ev); const tip = S.tip;
    if (!p) { tip.hidden = true; return; }
    const n = p.y > 0.05 ? paisEn(p.x, p.z) : null;
    if (!n) { tip.hidden = true; return; }
    const f = filaPais(n); tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = n; tip.appendChild(b);
    const linea = (lb, val, cls) => { const sp = document.createElement('span'); sp.append(lb + ': '); const em = document.createElement('em'); em.textContent = val; if (cls) em.className = cls; sp.appendChild(em); tip.appendChild(sp); };
    if (f) { linea('ROAS', f.roas === null || f.roas === undefined ? '—' : fmtD.format(f.roas) + 'x', f.roas >= 2 ? 'pos' : f.roas !== null && f.roas < 1 ? 'neg' : ''); linea('Ventas', fmtN.format(f.ventas_total_n || 0)); linea('Utilidad', fmtCop.format(f.ganancia || 0), f.ganancia > 0 ? 'pos' : f.ganancia < 0 ? 'neg' : ''); const r = document.createElement('span'); r.style.fontSize = '11px'; r.textContent = rangoTxt(); tip.appendChild(r); }
    else { const sp = document.createElement('span'); sp.textContent = 'Aún no vendes aquí'; tip.appendChild(sp); }
    const caja = S.renderer.domElement.getBoundingClientRect();
    tip.style.left = Math.max(80, Math.min(caja.width - 80, ev.clientX - caja.left)) + 'px'; tip.style.top = Math.max(70, ev.clientY - caja.top) + 'px'; tip.hidden = false;
  };

  // ---------------------------------------------------------------- Controles del puntero
  const montarControles = (el) => {
    const pts = new Map(); let ini = null, movido = 0, distP = 0, angP = 0, arrastreBarco = null, ultimoTip = 0;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault(); const p = puntoSuelo(e); const f = e.deltaY < 0 ? 0.8 : 1.25; const c = S.cam;
      if (p && f < 1) { c.dTx += (p.x - c.dTx) * 0.25; c.dTz += (p.z - c.dTz) * 0.25; }
      c.dDist *= f; limitar();
    }, { passive: false });
    el.addEventListener('pointerdown', (e) => {
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); movido = 0;
      ini = { x: e.clientX, y: e.clientY, tx: S.cam.dTx, tz: S.cam.dTz, az: S.cam.dAz, btn: e.button };
      if (pts.size === 2) { const [a, b] = [...pts.values()]; distP = Math.hypot(a[0] - b[0], a[1] - b[1]); angP = Math.atan2(b[1] - a[1], b[0] - a[0]); }
      arrastreBarco = null;
      if (S.herr === 'explorar' && pts.size === 1 && e.button === 0) { const o = objetoBajo(e, (o) => o.userData.t === 'barco'); if (o) arrastreBarco = o; }
    });
    el.addEventListener('pointermove', (e) => {
      if (!pts.has(e.pointerId)) { const ahora = performance.now(); if (ahora - ultimoTip > 60) { ultimoTip = ahora; mostrarTip(e); } return; }
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const c = S.cam;
      if (pts.size === 2) { const [a, b] = [...pts.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]), an = Math.atan2(b[1] - a[1], b[0] - a[0]); if (distP) { c.dDist *= distP / d; c.dAz -= an - angP; limitar(); } distP = d; angP = an; movido = 99; return; }
      if (!ini) return;
      const dx = e.clientX - ini.x, dy = e.clientY - ini.y; movido = Math.max(movido, Math.abs(dx) + Math.abs(dy));
      if (movido < 4) return;
      S.tip.hidden = true;
      if (arrastreBarco) { const p = puntoSuelo(e); if (p && p.y <= 0.05) { const o = arrastreBarco; const ang = Math.atan2(-(p.z - o.position.z), p.x - o.position.x); if (Math.hypot(p.x - o.position.x, p.z - o.position.z) > 0.02) o.rotation.y = ang; o.position.x = p.x; o.position.z = p.z; o.userData.x = p.x; o.userData.z = p.z; o.userData.r = o.rotation.y; } return; }
      if (ini.btn === 2) { c.dAz = ini.az - dx * 0.006; return; }
      const r = S.renderer.domElement.getBoundingClientRect(); const esc = (c.dist * 0.9) / r.height;
      const ca = Math.cos(c.az), sa = Math.sin(c.az);
      c.dTx = ini.tx - (dx * ca + dy * sa) * esc; c.dTz = ini.tz - (-dx * sa + dy * ca) * esc; limitar();
    });
    const soltar = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId); if (pts.size < 2) distP = 0;
      if (arrastreBarco && movido >= 4) { guardarMovimiento(arrastreBarco); }
      if (!pts.size && movido < 4 && e.type === 'pointerup' && ini && ini.btn === 0) tocar(e);
      if (!pts.size) { ini = null; arrastreBarco = null; }
    };
    el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
    el.addEventListener('pointerleave', () => { S.tip.hidden = true; });
  };

  // ---------------------------------------------------------------- Construir
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const tocar = (e) => {
    const h = S.herr;
    if (h === 'borrar') { const o = objetoBajo(e); if (o) quitar(o.userData.id, true); else avisar('Toca algo que hayas construido para quitarlo.'); return; }
    const p = puntoSuelo(e); if (!p) return;
    if (h === 'explorar') { const n = p.y > 0.05 ? paisEn(p.x, p.z) : null; if (n && S.cam.dDist > 40) { irA(p.x, p.z, 28); avisar(n + ': arrastra para recorrerlo, gira con clic derecho o dos dedos.'); } return; }
    const tierra = p.y > 0.12, agua = p.y <= 0.05;
    if (['casa', 'cultivo', 'arbol', 'persona'].includes(h) && !tierra) { avisar('Eso va en tierra firme.'); return; }
    if (h === 'barco' && !agua) { avisar('El barco va en el mar.'); return; }
    if (h === 'puente') {
      if (!S.puenteA) { S.puenteA = [p.x, p.z]; avisar('Ahora toca la otra orilla.'); return; }
      const [ax, az] = S.puenteA; S.puenteA = null; const largo = Math.hypot(p.x - ax, p.z - az);
      if (largo < 0.3 || largo > 12) { avisar(largo > 12 ? 'Ese puente es muy largo: acércate y elige orillas más cercanas.' : 'Las orillas están muy juntas.'); return; }
      agregar({ id: nuevoId(), t: 'puente', x: (ax + p.x) / 2, z: (az + p.z) / 2, r: Math.atan2(-(p.z - az), p.x - ax), e: largo.toFixed(2) + '|' + Math.max(altura(ax, az), altura(p.x, p.z), 0).toFixed(2) });
      return;
    }
    const r = Math.random() * Math.PI * 2;
    if (h === 'persona') { for (let i = 0; i < 3; i++) agregar({ id: nuevoId(), t: 'persona', x: p.x + (Math.random() - 0.5) * 0.5, z: p.z + (Math.random() - 0.5) * 0.5, r, e: String(Math.floor(Math.random() * 60)) }); return; }
    agregar({ id: nuevoId(), t: h, x: p.x, z: p.z, r, e: String(Math.floor(Math.random() * 60)) });
  };

  const crear3D = (d) => {
    const { F } = S.Mo; const v = Number(String(d.e || '0').split('|')[0]) || 0; let o;
    const y = Math.max(0, altura(d.x, d.z));
    switch (d.t) {
      case 'casa': o = F.casa(v); break;
      case 'arbol': o = F.arbol(v); o.scale.setScalar(1.2); break;
      case 'cultivo': o = F.cultivo(v); break;
      case 'persona': o = F.persona(v); break;
      case 'barco': o = F.barco(v); break;
      case 'puente': { const [l, hh] = String(d.e).split('|').map(Number); o = F.puente(l || 1); o.position.y = (hh || 0) + 0.12; break; }
      case 'nube': o = F.nube(false); o.scale.setScalar(1.6); break;
      case 'tormenta': o = F.nube(true); o.scale.setScalar(2); break;
      default: return null;
    }
    o.position.x = d.x; o.position.z = d.z; if (d.t !== 'puente') o.position.y = d.t === 'barco' ? 0.05 : d.t === 'nube' || d.t === 'tormenta' ? Math.max(y, 0) + 9 : y;
    o.rotation.y = d.r || 0;
    o.userData = { id: d.id, t: d.t, x: d.x, z: d.z, r: d.r || 0, nace: d.f ? Date.parse(d.f) || Date.now() : Date.now(), cx: d.x, cz: d.z, fase: Math.random() * 6.28 };
    if (d.t === 'tormenta') {
      const n = 240, g = new S.THREE.BufferGeometry(), arr = new Float32Array(n * 6);
      for (let i = 0; i < n; i++) { const x = (Math.random() - 0.5) * 3, z = (Math.random() - 0.5) * 3, yy = -Math.random() * 9; arr.set([x, yy, z, x - 0.05, yy - 0.5, z], i * 6); }
      g.setAttribute('position', new S.THREE.BufferAttribute(arr, 3));
      const lluvia = new S.THREE.LineSegments(g, new S.THREE.LineBasicMaterial({ color: 0xbfd6ee, transparent: true, opacity: 0.7 })); lluvia.scale.setScalar(0.5); o.add(lluvia); o.userData.lluvia = lluvia;
    }
    return o;
  };
  const agregar = (d, sinGuardar) => {
    if (S.lista.length >= 3000) { avisar('El mundo ya está lleno (3.000 cosas). Quita algunas para seguir.'); return; }
    const o = crear3D(d); if (!o) return;
    S.objetos.add(o); S.lista.push(Object.assign({}, d, { o3d: o }));
    if (!sinGuardar) guardar('mundo_agregar', { obj: limpio(d) });
  };
  const quitar = (id, guardarlo) => {
    const i = S.lista.findIndex((x) => x.id === id); if (i < 0) return;
    S.objetos.remove(S.lista[i].o3d); S.lista.splice(i, 1);
    if (guardarlo) guardar('mundo_borrar', { id });
  };
  const limpio = (d) => ({ id: d.id, t: d.t, x: Math.round(d.x * 1000) / 1000, z: Math.round(d.z * 1000) / 1000, r: Math.round((d.r || 0) * 1000) / 1000, e: d.e || '' });
  const guardarMovimiento = (o) => { const d = S.lista.find((x) => x.id === o.userData.id); if (!d) return; d.x = o.userData.x; d.z = o.userData.z; d.r = o.userData.r; guardar('mundo_mover', { obj: limpio(d) }); };

  // ---------------------------------------------------------------- Guardar en la hoja (compartido)
  const guardar = async (accion, extra) => {
    if (!window.idealabEnviar) return;
    S.ocupado = true;
    try { await window.idealabEnviar(Object.assign({ accion }, extra)); }
    catch (e) { avisar(/desconocida/i.test(String(e.message)) ? 'Para guardar el mundo hay que publicar la versión nueva del servidor.' : 'No se pudo guardar: ' + e.message); }
    S.ocupado = false;
  };
  const cargarConstruido = async (silencioso) => {
    if (!window.idealabEnviar) return;
    try {
      const r = await window.idealabEnviar({ accion: 'mundo_leer' });
      const llegan = (r.objetos || []).filter((d) => d && d.id && d.t);
      const ids = new Set(llegan.map((d) => d.id));
      S.lista.slice().forEach((d) => { if (!ids.has(d.id)) quitar(d.id, false); });
      llegan.forEach((d) => {
        const ya = S.lista.find((x) => x.id === d.id);
        const dd = { id: String(d.id), t: String(d.t), x: Number(d.x), z: Number(d.z), r: Number(d.r) || 0, e: String(d.e || ''), f: d.f };
        if (!ya) agregar(dd, true);
        else if (ya.t === 'barco' && (Math.abs(ya.x - dd.x) > 0.01 || Math.abs(ya.z - dd.z) > 0.01)) { ya.x = dd.x; ya.z = dd.z; ya.o3d.position.x = dd.x; ya.o3d.position.z = dd.z; ya.o3d.rotation.y = dd.r; ya.o3d.userData.x = dd.x; ya.o3d.userData.z = dd.z; }
      });
    } catch (e) { if (!silencioso) avisar(/desconocida/i.test(String(e.message)) ? 'Para guardar lo que construyas hay que publicar la versión nueva del servidor.' : 'No se pudo leer el mundo guardado: ' + e.message); }
  };

  // ---------------------------------------------------------------- Pueblos de las ventas
  const etiqueta = (texto, color) => {
    const THREE = S.THREE; const c = document.createElement('canvas'); c.width = 512; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = 'rgba(255,255,255,.92)'; const r = 28; x.beginPath(); x.moveTo(r, 8); x.arcTo(504, 8, 504, 120, r); x.arcTo(504, 120, 8, 120, r); x.arcTo(8, 120, 8, 8, r); x.arcTo(8, 8, 504, 8, r); x.fill();
    x.fillStyle = color; x.beginPath(); x.arc(52, 64, 18, 0, 7); x.fill();
    x.fillStyle = '#202124'; x.font = '600 40px system-ui, sans-serif'; x.textBaseline = 'middle'; x.fillText(texto, 86, 66);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true })); s.scale.set(4, 1, 1); s.renderOrder = 10; return s;
  };
  const actualizarPueblos = () => {
    if (!S.pueblos) return;
    S.pueblos.clear();
    const R = window.dash && window.dash.data('resumen'); if (!R || R.status !== 'ok') return;
    R.data.filter((f) => f.nivel === 'pais' && (f.ventas_total_n > 0 || f.gasto > 0)).forEach((f) => {
      const p = S.paises.find((x) => x.n === f.nombre); if (!p) return;
      const cx = p.c[0] - CX, cz = p.c[1] - CZ;
      const rnd = azar(f.nombre);
      const n = Math.min(40, f.ventas_total_n || 0);
      let puestas = 0;
      for (let i = 0; i < 400 && puestas < n; i++) {
        const ang = rnd() * 6.28, rad = 0.4 + Math.sqrt(rnd()) * (1.2 + n * 0.08);
        const x = cx + Math.cos(ang) * rad, z = cz + Math.sin(ang) * rad;
        if (!esTierra(x, z) || paisEn(x, z) !== f.nombre) continue;
        const c = S.Mo.F.casa(Math.floor(rnd() * 16)); c.position.set(x, altura(x, z), z); c.rotation.y = rnd() * 6.28; S.pueblos.add(c); puestas++;
      }
      const ban = S.Mo.F.banderin(); const by = Math.max(0, altura(cx, cz)); ban.position.set(cx, by, cz); ban.scale.setScalar(1.6);
      const tela = ban.getObjectByName('tela'); tela.material = f.ganancia > 0 ? S.Mo.M.verde : f.ganancia < 0 ? S.Mo.M.rojo : S.Mo.M.gris; S.pueblos.add(ban);
      const et = etiqueta(f.nombre + ' · ' + fmtN.format(f.ventas_total_n || 0) + ' ventas · ROAS ' + (f.roas === null || f.roas === undefined ? '—' : fmtD.format(f.roas) + 'x'), f.ganancia > 0 ? '#188038' : f.ganancia < 0 ? '#d93025' : '#5f6368');
      et.position.set(cx, by + 4, cz); et.userData.etiqueta = true; S.pueblos.add(et);
    });
  };

  // ---------------------------------------------------------------- Animación
  const animar = (dt, t) => {
    ponerCamara();
    S.agua.material.uniforms.t.value = t;
    const ahora = Date.now();
    // Etiquetas de los pueblos: del tamaño justo según la distancia
    const esc = Math.max(1.2, Math.min(18, S.cam.dist * 0.05));
    S.pueblos.children.forEach((o) => { if (o.userData.etiqueta) o.scale.set(esc * 4, esc, 1); });
    let rayoAhora = false;
    S.lista.forEach((d) => {
      const o = d.o3d, u = o.userData;
      switch (d.t) {
        case 'barco': { const c = o.getObjectByName('casco'); c.position.y = Math.sin(t * 1.6 + u.fase) * 0.03; c.rotation.z = Math.sin(t * 1.3 + u.fase) * 0.07; c.rotation.x = Math.cos(t * 1.1 + u.fase) * 0.05; break; }
        case 'persona': {
          if (!u.dest || Math.hypot(u.dest[0] - o.position.x, u.dest[1] - o.position.z) < 0.03) { for (let k = 0; k < 6; k++) { const nx = u.cx + (Math.random() - 0.5) * 1.6, nz = u.cz + (Math.random() - 0.5) * 1.6; if (esTierra(nx, nz)) { u.dest = [nx, nz]; break; } } if (!u.dest) u.dest = [u.cx, u.cz]; }
          const dx = u.dest[0] - o.position.x, dz = u.dest[1] - o.position.z, L = Math.hypot(dx, dz) || 1, vel = 0.12 * dt;
          o.position.x += (dx / L) * vel; o.position.z += (dz / L) * vel; o.position.y = Math.max(0, altura(o.position.x, o.position.z));
          o.rotation.y = Math.atan2(dx, dz); o.getObjectByName('cuerpo').position.y = Math.abs(Math.sin(t * 9 + u.fase)) * 0.02; break;
        }
        case 'cultivo': { const b = o.getObjectByName('brotes'); const k = Math.min(1, 0.25 + (ahora - u.nace) / 90000); b.scale.set(1, k, 1); break; }
        case 'nube': case 'tormenta': {
          o.position.x = u.cx + Math.sin(t * 0.05 + u.fase) * 3; o.position.z = u.cz + Math.cos(t * 0.04 + u.fase) * 2;
          if (u.lluvia) { const a = u.lluvia.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 14; if (y < -9.5) y += 9; a.setY(i, y); } a.needsUpdate = true; if (Math.random() < dt * 0.25) rayoAhora = o; }
          break;
        }
        default: break;
      }
    });
    // Relámpago de alguna tormenta
    if (rayoAhora) { S.destello.position.copy(rayoAhora.position); S.destello.intensity = 6; S.flash = 0.25; }
    if (S.flash > 0) { S.flash -= dt; S.destello.intensity = S.flash > 0 ? 6 * (S.flash / 0.25) * (Math.random() > 0.3 ? 1 : 0.2) : 0; }
  };

  // ---------------------------------------------------------------- API
  window.idealabMundo = {
    abrir: (host) => {
      activo = true;
      if (iniciado) { actualizarPueblos(); return; }
      iniciado = true;
      host.textContent = 'Cargando el mundo 3D…';
      construir(host).catch((e) => { iniciado = false; host.textContent = 'No se pudo abrir el mundo 3D: ' + (e && e.message ? e.message : e); });
    },
    cerrar: () => { activo = false; },
  };
})();
