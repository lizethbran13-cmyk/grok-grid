'use strict';

/* GROK GRID - SUPER GRID EXPANSION (DLC #40, bought in the Grok Arcade DLC Shop for 75 tickets).
 * Adds 3 tracks (Sky Islands, Candy Kingdom, Volcano Run), 4 new vehicles (Ratita Rocket, Thunder GT,
 * Sandstorm Buggy, Comet Hover), items + boost pads, and the Super Grid Hub you can drive around.
 * Unlock key: localStorage 'grokDLC.grid.super_grid_expansion' (same origin as the arcade).
 * Load order: three.min.js, tracks.js, supergrid.js, sg-*.js, game.js. game.js calls GRID_EXT.boot(). */

(function (root) {
  const KEY = 'grokDLC.grid.super_grid_expansion';
  const TAU = Math.PI * 2;
  function owned() {
    try {
      if (localStorage.getItem(KEY)) return true;
      const l = JSON.parse(localStorage.getItem('grokDLC.owned') || '[]');
      if (Array.isArray(l) && l.indexOf(KEY) >= 0) return true;
    } catch (e) {}
    try {
      // Time Jumper previews and Save Vault betas let everyone try it
      if (/\/(previews|archive)\//.test(location.pathname)) return true;
    } catch (e) {}
    return false;
  }

  /* ---------- 3 new tracks ---------- */
  const NEW_TRACKS = [
    {
      id: 'sky',
      dlc: true,
      name: 'SKY ISLANDS',
      sub: 'SUPER GRID \u2014 a ribbon of road across floating islands: rainbow arches, waterfalls into the clouds and hot-air balloons.',
      tag: 'SUPER GRID \u00b7 SKY',
      half: 8.2, wall: 13, scale: 1.15,
      poly: [[300, 0], [470, 30], [540, 140], [470, 250], [330, 230], [250, 300], [300, 420], [160, 480], [20, 420], [-60, 300], [-200, 330], [-300, 220], [-240, 90], [-120, 40]],
      radii: [70, 60, 50, 50, 40, 45, 50, 55, 50, 45, 50, 55, 50, 60],
      elev: { a: [[3, 1, 0.6], [1.5, 3, 2.0]], base: 4 },
      theme: {
        scenery: 'sky',
        sky: 0x6cc4ff, fog: 0xd4ecff, fogNear: 200, fogFar: 820,
        hemiSky: 0xeaf6ff, hemiGround: 0x6a8ab0, hemiI: 0.78,
        sunColor: 0xfff4dc, sunI: 1.0, sunDir: [120, 190, 80], ambient: 0.26,
        ground: '#5cc24e', groundTint: 0x6fd060,
        runoff: '#7ad66a', runoffTint: 0x86de74,
        asphalt: '#3a3f4c', asphaltTint: 0xa8acb8,
        walls: [0xff5fa2, 0xffffff, 0x3fa9ff, 0xffffff, 0xffd23b, 0xffffff], wallH: 1.25,
        curb: [0x3fa9ff, 0xffffff], line: 0xffffff,
        mini: '#86de74',
        floorY: -70, floorColor: 0xf4f8ff,
      },
    },
    {
      id: 'candy',
      dlc: true,
      name: 'CANDY KINGDOM',
      sub: 'SUPER GRID \u2014 lollipop forests, gumdrop hills, giant donut arches and a chocolate lake by the Cake Castle.',
      tag: 'SUPER GRID \u00b7 CANDY',
      half: 7.9, wall: 12.5, scale: 1.15,
      poly: [[260, 0], [400, 0], [460, 90], [400, 190], [290, 170], [220, 240], [280, 330], [220, 430], [80, 430], [30, 330], [-80, 380], [-200, 320], [-200, 180], [-110, 120], [-150, 30]],
      radii: [50, 40, 45, 40, 36, 40, 40, 45, 40, 36, 40, 45, 40, 36, 40],
      elev: { a: [[3.5, 2, 0.2], [1.8, 3, 1.4]], base: 5 },
      theme: {
        scenery: 'candy',
        sky: 0xffbfe3, fog: 0xffd6ee, fogNear: 150, fogFar: 640,
        hemiSky: 0xfff0fa, hemiGround: 0x9a6aa0, hemiI: 0.8,
        sunColor: 0xfff2e6, sunI: 0.95, sunDir: [-90, 180, 120], ambient: 0.28,
        ground: '#8fe3c0', groundTint: 0x9ff0cc,
        runoff: '#ffc4e2', runoffTint: 0xffd0e8,
        asphalt: '#4a3a52', asphaltTint: 0xb8a8c0,
        walls: [0xff3f8a, 0xffffff], wallH: 1.25,
        curb: [0xff3f8a, 0xffffff], line: 0xfff3a0,
        mini: '#9ff0cc',
        terrainHigh: 0xffb8dc,
      },
    },
    {
      id: 'volcano',
      dlc: true,
      name: 'VOLCANO RUN',
      sub: 'SUPER GRID \u2014 a sunset island lap past rivers of glowing lava, tiki torches and a rumbling, erupting volcano.',
      tag: 'SUPER GRID \u00b7 LAVA',
      half: 8.0, wall: 13.5, scale: 1.1,
      poly: [[320, 0], [520, 40], [600, 160], [560, 300], [420, 340], [360, 260], [260, 300], [220, 440], [60, 480], [-80, 400], [-60, 270], [-180, 200], [-200, 60], [-80, -30]],
      radii: [80, 60, 60, 55, 40, 36, 45, 60, 60, 50, 45, 50, 55, 60],
      elev: { a: [[5, 1, 1.2], [2.5, 2, 0.4]], base: 7 },
      theme: {
        scenery: 'volcano',
        sky: 0xff9a6a, fog: 0xe88a6a, fogNear: 140, fogFar: 640,
        hemiSky: 0xffd2b0, hemiGround: 0x5a2a3a, hemiI: 0.72,
        sunColor: 0xffb070, sunI: 1.0, sunDir: [-200, 90, -60], ambient: 0.26,
        ground: '#4a3a3a', groundTint: 0x6a5048,
        runoff: '#2e2a2c', runoffTint: 0x4a4246,
        asphalt: '#2a2a2e', asphaltTint: 0x9a96a0,
        walls: [0xffb000, 0x2a2a2a], wallH: 1.25,
        curb: [0xffb000, 0x1a1a1a], line: 0xffd27a,
        mini: '#6a5048',
        sea: 0x2a7ab0,
      },
    },
  ];
  NEW_TRACKS.forEach((t) => root.GRID_TRACKS.TRACKS.push(t));

  /* ---------- vehicles ---------- */
  // stats: acc = engine, top = top speed, grip = turn grip, off = how well it keeps grip/speed off the road.
  // Only the player's car uses them (AI rivals stay on the base car model so races stay fair).
  const VEHICLES = [
    { id: 'f1', name: 'GRID F1', blurb: 'The classic open-wheeler. Balanced everywhere.', color: 0xff4a1c, accent: 0x00e8ff, stats: { acc: 1, top: 1, grip: 1, off: 1 }, bars: [3, 3, 3, 2] },
    { id: 'rocket', dlc: true, name: 'RATITA ROCKET', blurb: 'Ratita Industries\u2019 cheesy speedster, ears and tail included. Highest top speed.', color: 0xffc62e, accent: 0xff5fa2, stats: { acc: 0.97, top: 1.045, grip: 0.985, off: 1 }, bars: [5, 2, 3, 2] },
    { id: 'gt', dlc: true, name: 'THUNDER GT', blurb: 'A closed-cockpit supercar with launch control. Best acceleration.', color: 0x2a6cff, accent: 0xffe14a, stats: { acc: 1.09, top: 1.0, grip: 0.965, off: 1 }, bars: [3, 5, 2, 2] },
    { id: 'buggy', dlc: true, name: 'SANDSTORM BUGGY', blurb: 'Big tyres and a roll cage. Keeps its speed on grass, sand and snow.', color: 0x2fc46a, accent: 0xff8a00, stats: { acc: 1.04, top: 0.965, grip: 1.0, off: 1.7 }, bars: [2, 4, 3, 5] },
    { id: 'hover', dlc: true, name: 'COMET HOVER', blurb: 'Floats on four hover pads. The most grip in the corners.', color: 0xa855ff, accent: 0x3ff0ff, stats: { acc: 1.0, top: 0.985, grip: 1.07, off: 1.3 }, bars: [3, 3, 5, 3] },
  ];
  const vehById = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];

  const EXT = (root.GRID_EXT = {
    KEY, owned, TRACKS: NEW_TRACKS, VEHICLES, vehById,
    VEHICLE_IDS: VEHICLES.map((v) => v.id),
    scenery: {},
    stats: (kind) => vehById(kind).stats,
  });

  /* ---------- geometry helpers (smooth shapes, merged multi-colour props) ---------- */
  const U = (EXT.U = {});
  // rounded slab (soft edges) - width x height x depth, corner radius r
  U.roundBox = function (THREE, w, h, d, r, segs) {
    r = Math.min(r, w / 2 - 0.001, d / 2 - 0.001, h / 2 - 0.001);
    const s = new THREE.Shape();
    const x = -w / 2 + r, y = -d / 2 + r, ww = w - 2 * r, dd = d - 2 * r;
    s.moveTo(x, y - r);
    s.lineTo(x + ww, y - r);
    s.quadraticCurveTo(x + ww + r, y - r, x + ww + r, y);
    s.lineTo(x + ww + r, y + dd);
    s.quadraticCurveTo(x + ww + r, y + dd + r, x + ww, y + dd + r);
    s.lineTo(x, y + dd + r);
    s.quadraticCurveTo(x - r, y + dd + r, x - r, y + dd);
    s.lineTo(x - r, y);
    s.quadraticCurveTo(x - r, y - r, x, y - r);
    const bev = Math.min(r * 0.8, h * 0.45);
    const geo = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.001, h - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: segs || 3, curveSegments: segs || 4 });
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, -(h - bev * 2) / 2, 0);
    geo.computeVertexNormals();
    return geo;
  };
  // lathe pod along +z: profile = [[radius, z], ...] from back to front
  U.pod = function (THREE, profile, segs) {
    const pts = profile.map(([r, z]) => new THREE.Vector2(Math.max(0.0001, r), z));
    const geo = new THREE.LatheGeometry(pts, segs || 16);
    geo.rotateX(Math.PI / 2);
    geo.computeVertexNormals();
    return geo;
  };
  // tube along a smooth curve
  U.tube = function (THREE, pts, radius, segs, radial) {
    const c = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(p[0], p[1], p[2])));
    return new THREE.TubeGeometry(c, segs || 16, radius, radial || 6, false);
  };
  // merge several (geometry, colour, matrix) parts into one vertex-coloured geometry (one draw call per prop type)
  U.merge = function (THREE, parts) {
    const pos = [], nrm = [], col = [];
    const c = new THREE.Color();
    for (const p of parts) {
      let g = p.geo;
      if (p.m) g.applyMatrix4(p.m);
      if (g.index) g = g.toNonIndexed();
      const pa = g.attributes.position, na = g.attributes.normal;
      c.set(p.color != null ? p.color : 0xffffff);
      for (let i = 0; i < pa.count; i++) {
        pos.push(pa.getX(i), pa.getY(i), pa.getZ(i));
        nrm.push(na.getX(i), na.getY(i), na.getZ(i));
        col.push(c.r, c.g, c.b);
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    out.computeBoundingSphere();
    return out;
  };
  U.mat4 = function (THREE, x, y, z, rx, ry, rz, sx, sy, sz) {
    const o = new THREE.Object3D();
    o.rotation.order = 'YXZ';
    o.position.set(x || 0, y || 0, z || 0);
    o.rotation.set(rx || 0, ry || 0, rz || 0);
    o.scale.set(sx || 1, sy || sx || 1, sz || sx || 1);
    o.updateMatrix();
    return o.matrix.clone();
  };
  // chunked instancing: splits a big list into spatial cells, each with real bounds, so the renderer
  // can skip cells that are off screen; `far` hides small-prop cells beyond that distance (far-only LOD,
  // near props are never simplified).
  const lodList = (EXT.lodList = []);
  U.chunked = function (H, geo, mat, list, opts) {
    const THREE = H.THREE;
    opts = opts || {};
    const cell = opts.cell || 160;
    const groups = new Map();
    for (const it of list) {
      const k = Math.floor(it.x / cell) + ',' + Math.floor(it.z / cell);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(it);
    }
    const out = new THREE.Group();
    let first = true;
    for (const [, items] of groups) {
      const g = first ? geo : geo.clone();
      first = false;
      const m = H.instanced(g, mat, items, opts);
      out.add(m);
      if (opts.far) lodList.push({ m, x: g.boundingSphere.center.x, z: g.boundingSphere.center.z, r: g.boundingSphere.radius, far: opts.far });
    }
    return out;
  };
  EXT.updateLod = function (camera) {
    const cx = camera.position.x, cz = camera.position.z;
    for (let i = lodList.length - 1; i >= 0; i--) {
      const e = lodList[i];
      if (!e.m.parent) { lodList.splice(i, 1); continue; }
      const d = Math.hypot(e.x - cx, e.z - cz) - e.r;
      e.m.visible = d < e.far;
    }
  };
  // canvas texture with text (signs) - keeps the canvas aspect so text is never squashed
  U.signTex = function (THREE, lines, opts) {
    opts = opts || {};
    const w = opts.w || 512, h = opts.h || 128;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, opts.bg || '#ff4a1c');
    grd.addColorStop(1, opts.bg2 || opts.bg || '#c42a10');
    g.fillStyle = grd;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = opts.border || 'rgba(255,255,255,0.85)';
    g.lineWidth = Math.max(4, h * 0.05);
    g.strokeRect(g.lineWidth, g.lineWidth, w - g.lineWidth * 2, h - g.lineWidth * 2);
    g.fillStyle = opts.fg || '#ffffff';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      const fs = (opts.size || 0.5) * h / Math.max(1, n * 0.85);
      g.font = '900 ' + Math.round(i === 0 ? fs : fs * 0.7) + 'px system-ui, "Segoe UI", sans-serif';
      let tw = g.measureText(ln).width;
      if (tw > w * 0.9) g.font = '900 ' + Math.round((i === 0 ? fs : fs * 0.7) * (w * 0.9) / tw) + 'px system-ui, sans-serif';
      g.fillText(ln, w / 2, h * ((i + 0.5) / n));
    });
    const t = new THREE.CanvasTexture(cv);
    t.encoding = THREE.sRGBEncoding;
    t.anisotropy = 4;
    return t;
  };
  U.stripeTex = function (THREE, a, b, n, vertical) {
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 64;
    const g = cv.getContext('2d');
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? b : a;
      if (vertical) g.fillRect((i * 64) / n, 0, 64 / n + 1, 64);
      else g.fillRect(0, (i * 64) / n, 64, 64 / n + 1);
    }
    const t = new THREE.CanvasTexture(cv);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.encoding = THREE.sRGBEncoding;
    return t;
  };

  /* ---------- vehicle models (smooth, rounded, no boxes) ---------- */
  function std(THREE, color, rough, metal, extra) {
    return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: rough == null ? 0.4 : rough, metalness: metal == null ? 0.3 : metal }, extra || {}));
  }
  function torusWheel(THREE, r, w, rimColor, tyre) {
    const g = new THREE.Group();
    const tube = w * 0.5;
    const tg = new THREE.TorusGeometry(r - tube, tube, 10, 22);
    tg.rotateY(Math.PI / 2);
    const t = new THREE.Mesh(tg, tyre || std(THREE, 0x15151a, 0.9, 0.05));
    t.castShadow = true;
    const hg = new THREE.CylinderGeometry(r - tube * 1.2, r - tube * 1.2, w * 0.7, 16);
    hg.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hg, std(THREE, rimColor || 0xdfe3ea, 0.25, 0.75));
    const cg = new THREE.SphereGeometry(r * 0.22, 10, 8);
    cg.scale(1.6, 1, 1);
    const cap = new THREE.Mesh(cg, std(THREE, 0x2a2d36, 0.3, 0.7));
    g.add(t, hub, cap);
    return g;
  }
  function wingSet(THREE, mat, endMat, w, chord, z, y) {
    const g = new THREE.Group();
    const main = new THREE.Mesh(U.roundBox(THREE, w, 0.08, chord, 0.04, 2), mat);
    main.castShadow = true;
    g.add(main);
    for (const s of [-1, 1]) {
      const ep = new THREE.Mesh(U.roundBox(THREE, 0.07, 0.34, chord + 0.12, 0.03, 2), endMat);
      ep.position.set((s * w) / 2, 0.08, 0);
      g.add(ep);
    }
    g.position.set(0, y, z);
    return g;
  }
  function addMesh(parent, geo, mat, x, y, z, cast) {
    const m = new THREE_().Mesh(geo, mat);
    m.position.set(x, y, z);
    if (cast) m.castShadow = true;
    parent.add(m);
    return m;
  }
  let _T = null;
  function THREE_() { return _T; }

  EXT.makeVehicle = function (spec, THREE) {
    _T = THREE;
    const v = vehById(spec.kind);
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const body = new THREE.Group();
    root.add(body);
    const col = new THREE.Color(spec.color != null ? spec.color : v.color);
    const bodyMat = std(THREE, col.clone(), 0.32, 0.4);
    const accentMat = std(THREE, v.accent, 0.35, 0.35);
    const dark = std(THREE, 0x16171d, 0.5, 0.35);
    const chrome = std(THREE, 0xe8ecf2, 0.18, 0.85);
    const helmetMat = std(THREE, spec.helmet || 0xffe14a, 0.3, 0.2);
    const wheels = [];
    let fw, rw, wheelY = 0.38, noSpin = false;
    const W = (x, y, z, r, w, rim) => { const wh = torusWheel(THREE, r, w, rim); wh.position.set(x, y, z); root.add(wh); wheels.push(wh); return wh; };
    if (v.id === 'rocket') {
      // cheese-yellow rat racer: smooth fuselage, cheese-hole sidepods, round ears, nose + whiskers, curly tail
      const fus = addMesh(body, U.pod(THREE, [[0.05, -2.0], [0.34, -1.7], [0.44, -0.8], [0.46, 0.2], [0.36, 1.2], [0.22, 2.3], [0.08, 3.0], [0.0001, 3.08]], 18), bodyMat, 0, 0.5, 0, true);
      fus.scale.set(1.45, 0.72, 1);
      for (const s of [-1, 1]) {
        const sp = new THREE.SphereGeometry(1, 18, 12);
        const pod = addMesh(body, sp, bodyMat, s * 0.74, 0.44, -0.2, true);
        pod.scale.set(0.36, 0.25, 1.15);
        for (let k = 0; k < 3; k++) {
          const hole = addMesh(body, new THREE.SphereGeometry(0.075 + k * 0.012, 10, 8), std(THREE, 0xd99a14, 0.6, 0.1), s * (0.78 + (k % 2) * 0.06), 0.66, -0.75 + k * 0.42);
          hole.scale.set(1, 0.35, 1);
        }
      }
      const cock = addMesh(body, new THREE.SphereGeometry(0.34, 16, 10), dark, 0, 0.66, 0.2);
      cock.scale.set(1, 0.5, 1.5);
      addMesh(body, new THREE.SphereGeometry(0.21, 14, 10), helmetMat, 0, 0.8, 0.12);
      const halo = addMesh(body, new THREE.TorusGeometry(0.4, 0.045, 8, 18, Math.PI), chrome, 0, 0.82, 0.3);
      halo.rotation.x = Math.PI / 2;
      // airbox + rat ears
      const ab = addMesh(body, new THREE.SphereGeometry(0.28, 14, 10), bodyMat, 0, 0.86, -0.45, true);
      ab.scale.set(1, 1.1, 1.6);
      const earOut = std(THREE, 0xb9b3c8, 0.5, 0.1), earIn = std(THREE, 0xff9fc4, 0.5, 0.05);
      for (const s of [-1, 1]) {
        const e = addMesh(body, new THREE.SphereGeometry(0.27, 16, 12), earOut, s * 0.3, 1.18, -0.42, true);
        e.scale.set(1, 1, 0.28);
        e.rotation.z = -s * 0.3;
        const ei = addMesh(body, new THREE.SphereGeometry(0.19, 14, 10), earIn, s * 0.3, 1.18, -0.36);
        ei.scale.set(1, 1, 0.2);
        ei.rotation.z = -s * 0.3;
      }
      // nose + whiskers
      addMesh(body, new THREE.SphereGeometry(0.11, 12, 10), std(THREE, 0xff5fa2, 0.35, 0.1), 0, 0.5, 3.08);
      for (const s of [-1, 1]) for (const k of [-1, 1]) {
        const wk = addMesh(body, new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4), dark, s * 0.32, 0.52 + k * 0.05, 2.95);
        wk.rotation.z = Math.PI / 2 + k * 0.15 * s;
      }
      // curly tail
      addMesh(body, U.tube(THREE, [[0, 0.55, -1.95], [0, 0.75, -2.45], [0, 1.2, -2.7], [0, 1.55, -2.45], [0, 1.45, -2.15], [0, 1.25, -2.25]], 0.055, 24, 6), std(THREE, 0xff9fc4, 0.45, 0.05), 0, 0, 0);
      fw = wingSet(THREE, accentMat, dark, 1.95, 0.46, 2.95, 0.24);
      rw = wingSet(THREE, accentMat, dark, 1.2, 0.4, -1.75, 0.98);
      W(-0.8, 0.38, 1.22, 0.4, 0.36, 0xff5fa2); W(0.8, 0.38, 1.22, 0.4, 0.36, 0xff5fa2);
      W(-0.84, 0.4, -1.28, 0.43, 0.42, 0xff5fa2); W(0.84, 0.4, -1.28, 0.43, 0.42, 0xff5fa2);
    } else if (v.id === 'gt') {
      // closed supercar: extruded rounded side profile, glass canopy, headlights, spoiler
      const s = new THREE.Shape();
      s.moveTo(-2.15, 0.22);
      s.lineTo(2.2, 0.22);
      s.quadraticCurveTo(2.5, 0.24, 2.42, 0.42);
      s.quadraticCurveTo(2.1, 0.58, 1.1, 0.7);
      s.quadraticCurveTo(0.2, 0.82, -1.3, 0.84);
      s.quadraticCurveTo(-2.1, 0.84, -2.2, 0.62);
      s.quadraticCurveTo(-2.3, 0.3, -2.15, 0.22);
      const depth = 1.5;
      const bg = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.16, bevelSegments: 4, curveSegments: 14 });
      bg.translate(0, 0, -depth / 2);
      bg.rotateY(-Math.PI / 2);
      bg.computeVertexNormals();
      addMesh(body, bg, bodyMat, 0, 0, 0, true);
      const glass = std(THREE, 0x0d1a3a, 0.08, 0.9, { emissive: 0x050c22 });
      const can = addMesh(body, new THREE.SphereGeometry(1, 22, 14, 0, TAU, 0, Math.PI / 2), glass, 0, 0.84, -0.25, true);
      can.scale.set(0.74, 0.46, 1.35);
      // bonnet stripe + side lightning
      const st = addMesh(body, new THREE.SphereGeometry(1, 16, 8), accentMat, 0, 0.87, 0.2);
      st.scale.set(0.14, 0.04, 1.9);
      for (const sd of [-1, 1]) {
        const bolt = new THREE.Shape();
        bolt.moveTo(-0.9, 0); bolt.lineTo(0.1, 0.12); bolt.lineTo(-0.05, 0.02); bolt.lineTo(0.9, 0.16); bolt.lineTo(-0.1, 0.0); bolt.lineTo(0.05, 0.1); bolt.lineTo(-0.9, 0);
        const bgeo = new THREE.ExtrudeGeometry(bolt, { depth: 0.02, bevelEnabled: false });
        bgeo.scale(1.2, 1.6, 1);
        const b = addMesh(body, bgeo, accentMat, sd * 1.03, 0.38, 0);
        b.rotation.y = sd > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      const hl = std(THREE, 0xffffff, 0.2, 0.1, { emissive: 0xfff6c8, emissiveIntensity: 0.9 });
      const tl = std(THREE, 0xff2030, 0.3, 0.1, { emissive: 0xff1020, emissiveIntensity: 0.8 });
      for (const sd of [-1, 1]) {
        const h = addMesh(body, new THREE.SphereGeometry(0.16, 12, 8), hl, sd * 0.6, 0.44, 2.36);
        h.scale.set(1.5, 0.6, 0.6);
        const t = addMesh(body, new THREE.SphereGeometry(0.14, 12, 8), tl, sd * 0.6, 0.62, -2.32);
        t.scale.set(1.6, 0.6, 0.5);
        const ex = addMesh(body, new THREE.CylinderGeometry(0.08, 0.09, 0.3, 12), chrome, sd * 0.3, 0.3, -2.3);
        ex.rotation.x = Math.PI / 2;
      }
      fw = new THREE.Group();
      const spl = new THREE.Mesh(U.roundBox(THREE, 1.8, 0.07, 0.4, 0.03, 2), dark);
      fw.add(spl);
      fw.position.set(0, 0.2, 2.3);
      rw = new THREE.Group();
      const sp = new THREE.Mesh(U.roundBox(THREE, 1.75, 0.08, 0.42, 0.04, 2), accentMat);
      sp.position.y = 0.3;
      sp.castShadow = true;
      rw.add(sp);
      for (const sd of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.32, 8), dark);
        post.position.set(sd * 0.55, 0.13, 0);
        rw.add(post);
      }
      rw.position.set(0, 0.84, -1.95);
      W(-0.88, 0.4, 1.38, 0.42, 0.34, 0xffe14a); W(0.88, 0.4, 1.38, 0.42, 0.34, 0xffe14a);
      W(-0.9, 0.42, -1.35, 0.45, 0.4, 0xffe14a); W(0.9, 0.42, -1.35, 0.45, 0.4, 0xffe14a);
      wheelY = 0.4;
    } else if (v.id === 'buggy') {
      // dune buggy: rounded tub, roll cage, chunky tyres, light bar, spare wheel + pennant
      wheelY = 0.56;
      const tub = addMesh(body, new THREE.SphereGeometry(1, 22, 14), bodyMat, 0, 0.82, 0, true);
      tub.scale.set(0.82, 0.38, 1.7);
      const nose = addMesh(body, new THREE.SphereGeometry(1, 18, 12), bodyMat, 0, 0.78, 1.3, true);
      nose.scale.set(0.6, 0.3, 0.7);
      const seat = addMesh(body, new THREE.SphereGeometry(0.4, 14, 10), dark, 0, 1.05, -0.2);
      seat.scale.set(1.1, 0.6, 1.2);
      addMesh(body, new THREE.SphereGeometry(0.23, 14, 10), helmetMat, 0, 1.38, -0.15);
      const cage = std(THREE, v.accent, 0.35, 0.5);
      for (const sd of [-1, 1]) {
        addMesh(body, U.tube(THREE, [[sd * 0.62, 0.95, 0.9], [sd * 0.58, 1.75, 0.35], [sd * 0.55, 1.85, -0.5], [sd * 0.62, 1.0, -1.05]], 0.055, 20, 6), cage, 0, 0, 0);
      }
      for (const z of [0.38, -0.55]) {
        const bar = addMesh(body, new THREE.CylinderGeometry(0.05, 0.05, 1.12, 8), cage, 0, z > 0 ? 1.74 : 1.84, z);
        bar.rotation.z = Math.PI / 2;
      }
      const lm = std(THREE, 0xfff8d0, 0.2, 0.1, { emissive: 0xfff0a0, emissiveIntensity: 0.9 });
      for (let k = 0; k < 4; k++) addMesh(body, new THREE.SphereGeometry(0.09, 10, 8), lm, -0.36 + k * 0.24, 1.92, 0.36);
      fw = new THREE.Group();
      const bump = new THREE.Mesh(U.tube(THREE, [[-0.7, 0, -0.1], [-0.45, -0.05, 0.2], [0.45, -0.05, 0.2], [0.7, 0, -0.1]], 0.06, 16, 6), cage);
      fw.add(bump);
      fw.position.set(0, 0.62, 1.95);
      rw = new THREE.Group();
      const spare = torusWheel(THREE, 0.42, 0.3);
      spare.rotation.y = Math.PI / 2;
      spare.rotation.z = Math.PI / 2;
      rw.add(spare);
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.6, 6), chrome);
      pole.position.set(0.45, 0.8, -0.1);
      rw.add(pole);
      const flag = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.6, 3), std(THREE, 0xff8a00, 0.6, 0));
      flag.rotation.z = -Math.PI / 2;
      flag.position.set(0.75, 1.45, -0.1);
      rw.add(flag);
      rw.position.set(0, 0.98, -1.7);
      for (const sd of [-1, 1]) for (const z of [1.3, -1.3]) {
        const spr = addMesh(body, new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), chrome, sd * 0.78, 0.7, z);
        spr.rotation.z = sd * 0.6;
      }
      W(-1.0, 0.56, 1.3, 0.56, 0.48, 0xff8a00); W(1.0, 0.56, 1.3, 0.56, 0.48, 0xff8a00);
      W(-1.02, 0.58, -1.3, 0.58, 0.52, 0xff8a00); W(1.02, 0.58, -1.3, 0.58, 0.52, 0xff8a00);
    } else {
      // hover racer: teardrop hull, glass bubble, swept fins, four glowing hover pods
      noSpin = true;
      wheelY = 0.42;
      const hull = addMesh(body, U.pod(THREE, [[0.12, -2.2], [0.45, -1.9], [0.6, -1.0], [0.62, 0.0], [0.52, 1.0], [0.3, 2.1], [0.06, 2.8], [0.0001, 2.86]], 20), bodyMat, 0, 0.72, 0, true);
      hull.scale.set(1.5, 0.62, 1);
      const glass = std(THREE, 0x8ff4ff, 0.05, 0.6, { transparent: true, opacity: 0.55, emissive: 0x0a3a44 });
      const dome = addMesh(body, new THREE.SphereGeometry(0.5, 20, 12, 0, TAU, 0, Math.PI / 2), glass, 0, 0.98, 0.15);
      dome.scale.set(1, 0.85, 1.6);
      addMesh(body, new THREE.SphereGeometry(0.2, 14, 10), helmetMat, 0, 1.08, 0.05);
      const glowM = new THREE.MeshBasicMaterial({ color: v.accent });
      const stripe = addMesh(body, new THREE.TorusGeometry(0.93, 0.03, 6, 40), glowM, 0, 0.72, 0);
      stripe.rotation.x = Math.PI / 2;
      stripe.scale.set(1, 2.2, 1);
      const thr = addMesh(body, new THREE.ConeGeometry(0.28, 0.6, 14, 1, true), new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0.8 }), 0, 0.72, -2.3);
      thr.rotation.x = -Math.PI / 2;
      fw = new THREE.Group();
      for (const sd of [-1, 1]) {
        const c = new THREE.Mesh(U.roundBox(THREE, 0.7, 0.06, 0.32, 0.03, 2), accentMat);
        c.position.set(sd * 0.55, 0, 0);
        c.rotation.y = sd * 0.35;
        fw.add(c);
      }
      fw.position.set(0, 0.6, 1.9);
      rw = new THREE.Group();
      for (const sd of [-1, 1]) {
        const fin = new THREE.Shape();
        fin.moveTo(0, 0); fin.quadraticCurveTo(0.3, 0.1, 0.9, 0.75); fin.lineTo(0.55, 0.78); fin.quadraticCurveTo(0.1, 0.4, -0.4, 0.05); fin.lineTo(0, 0);
        const fg = new THREE.ExtrudeGeometry(fin, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2 });
        fg.rotateY(Math.PI / 2);
        const f = new THREE.Mesh(fg, bodyMat);
        f.position.set(sd * 0.55, 0, 0.3);
        f.rotation.z = -sd * 0.35;
        f.rotation.y = Math.PI;
        f.castShadow = true;
        rw.add(f);
      }
      rw.position.set(0, 0.8, -1.4);
      const podMat = std(THREE, 0x2a2d3a, 0.3, 0.7);
      const ringM = new THREE.MeshBasicMaterial({ color: v.accent });
      const padGlowM = new THREE.MeshBasicMaterial({ color: v.accent, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
      [[-0.95, 1.25], [0.95, 1.25], [-1.0, -1.3], [1.0, -1.3]].forEach(([x, z]) => {
        const g = new THREE.Group();
        const pod = new THREE.Mesh(new THREE.SphereGeometry(0.34, 16, 10), podMat);
        pod.scale.set(1, 0.55, 1.25);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 20), ringM);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = -0.14;
        const dg = new THREE.CircleGeometry(0.42, 18);
        dg.rotateX(Math.PI / 2);
        const glow = new THREE.Mesh(dg, padGlowM);
        glow.position.y = -0.3;
        g.add(pod, ring, glow);
        g.position.set(x, 0.42, z);
        root.add(g);
        wheels.push(g);
      });
    }
    body.add(fw, rw);
    return { root, body, bodyMat, baseColor: col.clone(), frontWing: fw, rearWing: rw, wheels, fwBaseY: fw.position.y, wheelY, kind: v.id, noSpin };
  };
})(typeof window !== 'undefined' ? window : globalThis);
