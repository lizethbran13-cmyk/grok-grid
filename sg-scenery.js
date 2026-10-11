'use strict';
/* Super Grid Expansion - scenery for SKY ISLANDS, CANDY KINGDOM and VOLCANO RUN.
 * Everything is instanced or merged into vertex-coloured props (few draw calls), chunked so off-screen
 * cells are culled, and small props hide only when far away. */
(function () {
  const EXT = window.GRID_EXT;
  const U = EXT.U;
  const TAU = Math.PI * 2;
  EXT.anim = [];

  // a merged prop from [geometry, colour, x, y, z, rx, ry, rz, sx, sy, sz]
  function prop(T, parts) {
    return U.merge(T, parts.map((p) => ({ geo: p[0], color: p[1], m: U.mat4(T, p[2], p[3], p[4], p[5], p[6], p[7], p[8], p[9], p[10]) })));
  }
  function vcMat(T, shiny) {
    return shiny ? new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.08 }) : new T.MeshLambertMaterial({ vertexColors: true });
  }
  // flat ribbon beside the track between samples i0..i1 at lateral offsets a..b (skips bits that would touch another part of the track)
  function ribbon(H, i0, i1, a, b, yOff, mat, step) {
    const T = H.THREE, S = H.samples, N = H.SAMPLES;
    step = step || 2;
    const pos = [], uv = [], idx = [];
    let k = 0, run = 0, prevOk = false;
    for (let j = i0; j <= i1; j += step) {
      const s = S[((j % N) + N) % N];
      const pA = [s.x + s.nx * a, s.z + s.nz * a], pB = [s.x + s.nx * b, s.z + s.nz * b];
      const ok = H.trackDist(pA[0], pA[1]).d > H.WALL_DIST + 2.5 && H.trackDist(pB[0], pB[1]).d > H.WALL_DIST + 2.5;
      pos.push(pA[0], s.y + yOff, pA[1], pB[0], s.y + yOff, pB[1]);
      uv.push(0, run * 0.05, 1, run * 0.05);
      if (k > 0 && ok && prevOk) idx.push(2 * (k - 1), 2 * (k - 1) + 1, 2 * k, 2 * (k - 1) + 1, 2 * k + 1, 2 * k);
      prevOk = ok;
      run += step;
      k++;
    }
    const g = new T.BufferGeometry();
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return new T.Mesh(g, mat);
  }
  function cloudGeo(T, tint) {
    const parts = [];
    const c = tint || 0xffffff;
    [[0, 0, 0, 1.0], [0.9, -0.15, 0.2, 0.75], [-0.9, -0.1, -0.1, 0.8], [0.35, 0.45, -0.1, 0.7], [-0.4, 0.35, 0.3, 0.65], [1.6, -0.3, 0, 0.5], [-1.6, -0.3, 0.1, 0.5]].forEach(([x, y, z, r]) => parts.push([new T.IcosahedronGeometry(1, 1), c, x, y, z, 0, 0, 0, r, r * 0.85, r]));
    return prop(T, parts);
  }
  function placeFar(H, n, rMin, rMax, cx0, cz0, clear) {
    const out = [];
    let guard = 0;
    while (out.length < n && guard++ < n * 8) {
      const a = H.srand() * TAU, r = H.srnd(rMin, rMax);
      const x = cx0 + Math.cos(a) * r, z = cz0 + Math.sin(a) * r;
      if (H.trackDist(x, z).d < H.WALL_DIST + (clear || 30)) continue;
      out.push({ x, z });
    }
    return out;
  }

  /* ================= SKY ISLANDS ================= */
  EXT.scenery.sky = function (G, th, H, cx0, cz0) {
    const T = H.THREE, S = H.samples, N = H.SAMPLES, W = H.WALL_DIST;
    EXT.anim = [];
    // grassy shoulders + rocky island underside all along the road (the road floats in the sky)
    const caps = [], rocks = [], dirt = [];
    for (let i = 0; i < N; i += 3) {
      const s = S[i];
      caps.push({ x: s.x, y: s.y - 0.78, z: s.z, sx: W + 6.5, sy: 1, sz: W + 6.5, ry: i });
      dirt.push({ x: s.x, y: s.y - 2.1, z: s.z, sx: W + 6.2, sy: 1.6, sz: W + 6.2, ry: i * 0.7 });
      if (i % 6 === 0) rocks.push({ x: s.x + H.srnd(-2, 2), y: s.y - 2.8, z: s.z + H.srnd(-2, 2), sx: W + H.srnd(2, 6), sy: H.srnd(14, 32), sz: W + H.srnd(2, 6), ry: H.srand() * 3 });
    }
    G.add(U.chunked(H, new T.CylinderGeometry(1, 0.96, 1, 9), new T.MeshLambertMaterial({ color: 0x72d65e }), caps, { receive: true }));
    G.add(U.chunked(H, new T.CylinderGeometry(0.97, 0.9, 1, 8), new T.MeshLambertMaterial({ color: 0x9a6a42 }), dirt));
    const rockGeo = new T.ConeGeometry(1, 1, 6);
    rockGeo.rotateX(Math.PI);
    rockGeo.translate(0, -0.5, 0);
    G.add(U.chunked(H, rockGeo, new T.MeshLambertMaterial({ color: 0x8a6448 }), rocks));
    // flowers + round bushes on the shoulders
    const fl = [], bushes = [];
    const fcols = [0xff5fa2, 0xffe14a, 0xffffff, 0xa86bff, 0xff8a3a];
    for (let i = 0; i < N; i += 2) {
      const s = S[i];
      for (const sg of [-1, 1]) {
        const d = W + H.srnd(1.2, 5.5);
        const x = s.x + s.nx * d * sg, z = s.z + s.nz * d * sg;
        if (H.trackDist(x, z).d < W + 0.8) continue;
        if (H.srand() < 0.55) fl.push({ x, y: s.y - 0.15, z, sx: H.srnd(0.25, 0.45), color: fcols[(H.srand() * 5) | 0] });
        else if (H.srand() < 0.3) bushes.push({ x, y: s.y - 0.1, z, sx: H.srnd(0.8, 1.6), sy: H.srnd(0.7, 1.1), sz: H.srnd(0.8, 1.6), color: [0x3fae3a, 0x4cc046, 0x2f9a3a][(H.srand() * 3) | 0] });
      }
    }
    G.add(U.chunked(H, new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ color: 0xffffff }), fl, { far: 220 }));
    G.add(U.chunked(H, new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ color: 0xffffff }), bushes, { far: 320 }));
    // floating islands with lollipop trees, cottages and waterfalls
    const treeParts = (x, z, h, c) => [
      [new T.CylinderGeometry(0.06, 0.09, 1, 6), 0x7a5232, x, 0.1 + h * 0.5, z, 0, 0, 0, 1, h, 1],
      [new T.IcosahedronGeometry(0.5, 1), c, x, 0.1 + h + 0.25, z, 0, 0, 0, 1, 0.9, 1],
    ];
    const isl1 = prop(T, [
      [new T.CylinderGeometry(1, 0.95, 0.22, 11), 0x72d65e, 0, 0, 0],
      [new T.ConeGeometry(0.95, 1.6, 7), 0x8a6448, 0, -0.9, 0, Math.PI, 0, 0],
      [new T.ConeGeometry(0.4, 0.8, 8), 0x7a5a40, 0.45, -1.1, 0.2, Math.PI, 0, 0.2],
      ...treeParts(0.3, 0.2, 0.55, 0x3fbe48), ...treeParts(-0.35, -0.25, 0.42, 0x6fd34a), ...treeParts(-0.1, 0.5, 0.35, 0xff8fc8),
    ]);
    const isl2 = prop(T, [
      [new T.CylinderGeometry(1, 0.95, 0.22, 11), 0x72d65e, 0, 0, 0],
      [new T.ConeGeometry(0.95, 1.9, 7), 0x8a6448, 0, -1.05, 0, Math.PI, 0, 0],
      [new T.CylinderGeometry(0.22, 0.24, 0.32, 8), 0xfff2dc, 0.1, 0.27, 0.0],
      [new T.ConeGeometry(0.32, 0.32, 8), 0xff5f6a, 0.1, 0.59, 0.0],
      [new T.SphereGeometry(0.06, 8, 6), 0x5ab8ff, 0.1, 0.27, 0.23],
      ...treeParts(-0.45, 0.3, 0.5, 0x4cc046), ...treeParts(0.5, -0.4, 0.4, 0xffd23b),
    ]);
    const L1 = [], L2 = [], falls = [];
    placeFar(H, H.isTouch ? 34 : 50, 120, 620, cx0, cz0, 40).forEach((p, i) => {
      const sc = H.srnd(10, 34);
      const it = { x: p.x, y: H.srnd(-30, 40), z: p.z, sx: sc, sy: sc, sz: sc, ry: H.srand() * TAU };
      (i % 2 ? L2 : L1).push(it);
      if (i % 3 === 0) falls.push({ x: p.x + sc * 0.8, y: it.y - sc * 1.3, z: p.z, sx: sc * 0.12, sy: sc * 2.6, sz: sc * 0.12 });
    });
    const vc = vcMat(T);
    G.add(U.chunked(H, isl1, vc, L1, { cell: 400 }));
    G.add(U.chunked(H, isl2, vc, L2, { cell: 400 }));
    G.add(H.instanced(new T.CylinderGeometry(1, 1.4, 1, 8, 1, true), new T.MeshBasicMaterial({ color: 0xd8f4ff, transparent: true, opacity: 0.7, depthWrite: false, side: T.DoubleSide }), falls));
    // clouds: a fluffy cloud sea below and puffs all around
    const cg = cloudGeo(T);
    const cm = new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x404858 });
    const sea = [], puffs = [];
    for (let i = 0; i < (H.isTouch ? 90 : 140); i++) {
      const a = H.srand() * TAU, r = Math.sqrt(H.srand()) * 900;
      sea.push({ x: cx0 + Math.cos(a) * r, y: -62 + H.srnd(-4, 4), z: cz0 + Math.sin(a) * r, sx: H.srnd(28, 60), sy: H.srnd(10, 18), sz: H.srnd(28, 60), ry: H.srand() * 3 });
    }
    placeFar(H, 60, 60, 700, cx0, cz0, 25).forEach((p) => puffs.push({ x: p.x, y: H.srnd(-25, 70), z: p.z, sx: H.srnd(8, 22), sy: H.srnd(5, 10), sz: H.srnd(8, 18), ry: H.srand() * 3 }));
    G.add(U.chunked(H, cg, cm, sea, { cell: 500 }));
    G.add(U.chunked(H, cloudGeo(T), cm, puffs, { cell: 400 }));
    // rainbow arches over the road
    const RB = [0xff3b3b, 0xff9a2a, 0xffe14a, 0x3fd65a, 0x3fa9ff, 0x9a5bff];
    [0.12, 0.47, 0.78].forEach((f) => {
      const s = S[Math.round(N * f) % N];
      const R = W + 4;
      const parts = RB.map((c, k) => [new T.TorusGeometry(R - k * 0.9, 0.48, 6, 30, Math.PI), c, 0, 0, 0]);
      parts.push([new T.IcosahedronGeometry(1, 1), 0xffffff, R - 2.2, 0, 0, 0, 0, 0, 3.6, 2.4, 3.2], [new T.IcosahedronGeometry(1, 1), 0xffffff, -R + 2.2, 0, 0, 0, 0, 0, 3.6, 2.4, 3.2]);
      const m = new T.Mesh(prop(T, parts), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x202020 }));
      m.position.set(s.x, s.y - 0.4, s.z);
      m.rotation.y = Math.atan2(-s.tx, -s.tz);
      m.castShadow = true;
      G.add(m);
    });
    // hot-air balloons, gently bobbing
    const balloon = (c1, c2) => prop(T, [
      [new T.SphereGeometry(1, 12, 8), c1, 0, 1.2, 0, 0, 0, 0, 1, 1.12, 1],
      [new T.TorusGeometry(0.97, 0.08, 6, 21), c2, 0, 1.25, 0, Math.PI / 2, 0, 0],
      [new T.TorusGeometry(0.8, 0.07, 6, 21), c2, 0, 1.85, 0, Math.PI / 2, 0, 0],
      [new T.ConeGeometry(0.5, 0.6, 9), c1, 0, 0.12, 0, Math.PI, 0, 0],
      [new T.CylinderGeometry(0.22, 0.18, 0.26, 8), 0x9a6a3a, 0, -0.62, 0],
      [new T.CylinderGeometry(0.012, 0.012, 0.6, 4), 0x5a4030, 0.17, -0.28, 0.0],
      [new T.CylinderGeometry(0.012, 0.012, 0.6, 4), 0x5a4030, -0.17, -0.28, 0.0],
    ]);
    const bl = [];
    const bcols = [[0xff5f6a, 0xffe14a], [0x3fa9ff, 0xffffff], [0xa86bff, 0x7df3ff], [0x3fd65a, 0xffe14a]];
    const bms = bcols.map(([a, b]) => new T.InstancedMesh(balloon(a, b), vc, 4));
    const o = new T.Object3D();
    placeFar(H, 16, 40, 420, cx0, cz0, 22).forEach((p, i) => bl.push({ m: bms[i % 4], k: (i / 4) | 0, x: p.x, y: H.srnd(14, 60), z: p.z, s: H.srnd(5, 9), ph: H.srand() * 6 }));
    bms.forEach((m) => { m.count = 0; m.frustumCulled = false; G.add(m); });
    bl.forEach((b) => { b.m.count = Math.max(b.m.count, b.k + 1); });
    EXT.anim.push((t) => {
      for (const b of bl) {
        o.position.set(b.x, b.y + Math.sin(t * 0.5 + b.ph) * 2.2, b.z);
        o.rotation.set(0, t * 0.05 + b.ph, 0);
        o.scale.setScalar(b.s);
        o.updateMatrix();
        b.m.setMatrixAt(b.k, o.matrix);
      }
      bms.forEach((m) => (m.instanceMatrix.needsUpdate = true));
    });
    // windmills on the shoulders (spinning sails)
    const sails = [];
    H.scatter(8, W + 3.5, W + 5.5, 2.5).forEach((p) => {
      const g = new T.Group();
      const tower = new T.Mesh(new T.CylinderGeometry(0.9, 1.6, 9, 8), new T.MeshLambertMaterial({ color: 0xfff2dc }));
      tower.position.y = 4.5;
      const cap = new T.Mesh(new T.ConeGeometry(1.4, 2, 8), new T.MeshLambertMaterial({ color: 0xff5f6a }));
      cap.position.y = 10;
      const hub = new T.Group();
      hub.position.set(0, 8.4, 1.3);
      for (let k = 0; k < 4; k++) {
        const sl = new T.Mesh(U.roundBox(T, 0.9, 0.12, 4.6, 0.1, 2), new T.MeshLambertMaterial({ color: 0xffffff }));
        sl.rotation.x = Math.PI / 2;
        sl.position.y = 2.4;
        const arm = new T.Group();
        arm.rotation.z = (k / 4) * TAU;
        arm.add(sl);
        hub.add(arm);
      }
      g.add(tower, cap, hub);
      g.position.set(p.x, p.y - 0.5, p.z);
      g.rotation.y = H.srand() * TAU;
      G.add(g);
      sails.push(hub);
    });
    EXT.anim.push((t, dt) => sails.forEach((h, i) => (h.rotation.z += dt * (0.8 + i * 0.05))));
    // a sun with a soft halo
    const sun = new T.Mesh(new T.CircleGeometry(45, 32), new T.MeshBasicMaterial({ color: 0xfff6c8, fog: false }));
    sun.position.set(cx0 + 400, 420, cz0 - 700);
    sun.lookAt(cx0, 0, cz0);
    G.add(sun);
    H.addParticles(G, H.isTouch ? 80 : 140, 0xffffff, 0.45, 0.75, 'leaves');
  };

  /* ================= CANDY KINGDOM ================= */
  EXT.scenery.candy = function (G, th, H, cx0, cz0) {
    const T = H.THREE, S = H.samples, N = H.SAMPLES, W = H.WALL_DIST;
    EXT.anim = [];
    G.add(H.buildTerrain(Object.assign({ terrainHigh: 0xffb8dc, bankSlope: 0.3 }, th), (x, z, d) => {
      const m = H.clamp((d - 55) / 150, 0, 1);
      const n = Math.sin(x * 0.02 + 0.5) * Math.cos(z * 0.024) + Math.sin(x * 0.041 - z * 0.033) * 0.4 + 0.7;
      return Math.max(0, n * 26 * m);
    }));
    const shiny = vcMat(T, true);
    // lollipop trees
    const lolly = (c) => prop(T, [
      [new T.CylinderGeometry(0.11, 0.13, 4.2, 8), 0xffffff, 0, 2.1, 0],
      [new T.CylinderGeometry(1.45, 1.45, 0.34, 16), c, 0, 4.9, 0, Math.PI / 2, 0, 0],
      [new T.TorusGeometry(1.0, 0.13, 4, 16), 0xffffff, 0, 4.9, 0.18],
      [new T.TorusGeometry(0.55, 0.12, 4, 12), 0xffffff, 0, 4.9, 0.18],
      [new T.TorusGeometry(1.0, 0.13, 4, 16), 0xffffff, 0, 4.9, -0.18],
      [new T.TorusGeometry(0.55, 0.12, 4, 12), 0xffffff, 0, 4.9, -0.18],
    ]);
    const lcols = [0xff3f8a, 0x3fc8ff, 0xffb02e, 0x9a5bff];
    const lists = lcols.map(() => []);
    H.scatter(H.isTouch ? 130 : 190, W + 3, W + 48, 2).forEach((p, i) => {
      const sc = H.srnd(0.9, 1.8);
      lists[i % 4].push({ x: p.x, y: p.y - 0.7, z: p.z, sx: sc, ry: H.srand() * TAU });
    });
    lcols.forEach((c, i) => G.add(U.chunked(H, lolly(c), shiny, lists[i], { cast: true, far: 420 })));
    // gumdrops
    const gd = [];
    const gcols = [0xff4a5a, 0xff9a2a, 0xffe14a, 0x3fd65a, 0xa86bff, 0x3fa9ff];
    H.scatter(H.isTouch ? 140 : 220, W + 2, W + 60, 1.5).forEach((p) => {
      const r = H.srnd(1.2, 3.6);
      gd.push({ x: p.x, y: p.y - 0.75, z: p.z, sx: r, sy: r * H.srnd(0.9, 1.25), sz: r, color: gcols[(H.srand() * 6) | 0] });
    });
    G.add(U.chunked(H, new T.SphereGeometry(1, 11, 6, 0, TAU, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0.05 }), gd, { cast: true, far: 380 }));
    // candy canes along the barriers
    const caneParts = [];
    for (let k = 0; k < 8; k++) caneParts.push([new T.CylinderGeometry(0.22, 0.22, 0.6, 8, 1, true), k % 2 ? 0xffffff : 0xff2a4a, 0, 0.3 + k * 0.6, 0]);
    for (let k = 0; k < 6; k++) caneParts.push([new T.TorusGeometry(0.7, 0.22, 7, 3, Math.PI / 6), k % 2 ? 0xffffff : 0xff2a4a, 0.7, 4.8, 0, 0, 0, (k * Math.PI) / 6]);
    const caneG = prop(T, caneParts);
    const canes = [];
    for (let i = 0; i < N; i += 7) {
      const s = S[i];
      for (const sg of [-1, 1]) {
        const d = W + 1.6;
        const x = s.x + s.nx * d * sg, z = s.z + s.nz * d * sg;
        if (H.trackDist(x, z).d < W + 1) continue;
        canes.push({ x, y: s.y - 0.4, z, ry: Math.atan2(s.tx, s.tz) + (sg > 0 ? 0 : Math.PI) });
      }
    }
    G.add(U.chunked(H, caneG, shiny, canes, { far: 300 }));
    // donut arches over the road (the bottom of the ring is under the road)
    [[0.18, 0xff7ab8], [0.52, 0x7a4a2a], [0.83, 0x7df3e0]].forEach(([f, frost]) => {
      const s = S[Math.round(N * f) % N];
      const R = W + 3.2, cy = R * 0.5;
      const parts = [[new T.TorusGeometry(R, 2.3, 12, 39), 0xe0a05a, 0, cy, 0], [new T.TorusGeometry(R + 0.2, 2.15, 10, 33, Math.PI), frost, 0, cy, 0.15]];
      for (let k = 0; k < 46; k++) {
        const a = 0.15 + (k / 46) * (Math.PI - 0.3);
        const rr = R + 0.2 + Math.cos(k * 2.3) * 1.2;
        parts.push([new T.CylinderGeometry(0.12, 0.12, 0.7, 6), gcols[k % 6], Math.cos(a) * rr, cy + Math.sin(a) * rr, Math.sin(k * 1.7) * 1.6 + (k % 2 ? 1.6 : -1.6) * 0.6, k, k * 0.7, 0]);
      }
      const m = new T.Mesh(prop(T, parts), shiny);
      m.position.set(s.x, s.y, s.z);
      m.rotation.y = Math.atan2(-s.tx, -s.tz);
      m.castShadow = true;
      G.add(m);
    });
    // cupcake cottages
    const cup = (c) => prop(T, [
      [new T.CylinderGeometry(2.4, 1.9, 2.6, 11), 0xffffff, 0, 1.3, 0],
      [new T.CylinderGeometry(2.42, 1.92, 2.6, 11, 1, true), c, 0, 1.3, 0, 0, 0.2, 0],
      [new T.SphereGeometry(2.6, 12, 7, 0, TAU, 0, Math.PI / 2), 0xfff0f6, 0, 2.6, 0, 0, 0, 0, 1, 0.8, 1],
      [new T.SphereGeometry(1.6, 9, 6, 0, TAU, 0, Math.PI / 2), 0xfff0f6, 0, 4.2, 0, 0, 0, 0, 1, 0.7, 1],
      [new T.SphereGeometry(0.5, 8, 6), 0xff2a4a, 0, 5.4, 0],
      [new T.CylinderGeometry(0.5, 0.5, 1.3, 8, 1, false, 0, Math.PI), 0x8a4a2a, 0, 0.65, 2.15, 0, -Math.PI / 2, 0],
      [new T.SphereGeometry(0.35, 8, 6), 0x7df3ff, 1.3, 1.6, 1.75],
      [new T.SphereGeometry(0.35, 8, 6), 0x7df3ff, -1.3, 1.6, 1.75],
    ]);
    const cups = [[], [], []];
    H.scatter(18, W + 10, W + 34, 7).forEach((p, i) => cups[i % 3].push({ x: p.x, y: p.y - 0.7, z: p.z, sx: H.srnd(1.1, 1.6), ry: Math.atan2(H.samples[p.i].x - p.x, H.samples[p.i].z - p.z) }));
    [0xff7ab8, 0x7ab8ff, 0xb8ff7a].forEach((c, i) => G.add(U.chunked(H, cup(c), shiny, cups[i], { cast: true })));
    // ice cream cone towers in the distance
    const cone = (a, b) => prop(T, [
      [new T.ConeGeometry(1, 3, 11), 0xd9a05a, 0, 1.5, 0, Math.PI, 0, 0],
      [new T.SphereGeometry(1.08, 11, 7), a, 0, 3.3, 0],
      [new T.SphereGeometry(0.9, 11, 7), b, 0, 4.5, 0],
      [new T.SphereGeometry(0.28, 8, 6), 0xff2a4a, 0, 5.5, 0],
    ]);
    const ic = [[], []];
    placeFar(H, 26, 150, 560, cx0, cz0, 60).forEach((p, i) => ic[i % 2].push({ x: p.x, y: -1, z: p.z, sx: H.srnd(5, 10), ry: H.srand() * 3 }));
    G.add(U.chunked(H, cone(0xffb8dc, 0xa8ffd8), shiny, ic[0], { cell: 400 }));
    G.add(U.chunked(H, cone(0xfff2c8, 0x8a5a3a), shiny, ic[1], { cell: 400 }));
    // the Cake Castle
    {
      const p = placeFar(H, 1, 170, 230, cx0, cz0, 80)[0] || { x: cx0, z: cz0 + 300 };
      const parts = [];
      [[16, 7, 0xfff0f6], [11.5, 6, 0xffb8dc], [7, 5, 0xfff0f6]].reduce((y, [r, h, c]) => {
        parts.push([new T.CylinderGeometry(r, r, h, 22), c, 0, y + h / 2, 0]);
        parts.push([new T.TorusGeometry(r, 0.9, 7, 28), 0xff7ab8, 0, y + h, 0, Math.PI / 2, 0, 0]);
        for (let k = 0; k < 14; k++) parts.push([new T.SphereGeometry(0.8, 8, 6), 0xff2a4a, Math.cos((k / 14) * TAU) * r, y + h + 0.8, Math.sin((k / 14) * TAU) * r]);
        return y + h;
      }, 0);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * TAU + 0.4, x = Math.cos(a) * 19, z = Math.sin(a) * 19;
        parts.push([new T.CylinderGeometry(3, 3.4, 16, 14), 0xfff0f6, x, 8, z], [new T.ConeGeometry(4, 7, 14), 0xa86bff, x, 19.5, z], [new T.SphereGeometry(0.8, 8, 6), 0xffe14a, x, 23.4, z]);
      }
      for (let k = 0; k < 5; k++) parts.push([new T.CylinderGeometry(0.5, 0.5, 4, 7), [0xff3f8a, 0x3fc8ff, 0xffe14a, 0x3fd65a, 0xa86bff][k], Math.cos(k) * 3.5, 20, Math.sin(k) * 3.5]);
      const m = new T.Mesh(prop(T, parts), shiny);
      m.position.set(p.x, -1, p.z);
      G.add(m);
      const flames = new T.Mesh(new T.ConeGeometry(0.45, 1.2, 7), new T.MeshBasicMaterial({ color: 0xffb02e }));
      flames.position.set(p.x, 23, p.z);
      G.add(flames);
      EXT.anim.push((t) => flames.scale.set(1, 1 + Math.sin(t * 9) * 0.2, 1));
    }
    // chocolate lake with marshmallows
    {
      const p = placeFar(H, 1, 90, 200, cx0, cz0, 60)[0];
      if (p) {
        const lg = new T.CircleGeometry(38, 40);
        lg.rotateX(-Math.PI / 2);
        const lake = new T.Mesh(lg, new T.MeshStandardMaterial({ color: 0x6a3a1e, roughness: 0.15, metalness: 0.2 }));
        lake.position.set(p.x, 0.25, p.z);
        G.add(lake);
        const mm = [];
        for (let k = 0; k < 14; k++) { const a = H.srand() * TAU, r = H.srnd(5, 32); mm.push({ x: p.x + Math.cos(a) * r, y: 0.5, z: p.z + Math.sin(a) * r, sx: H.srnd(1.2, 2), sy: 1.1, sz: H.srnd(1.2, 2) }); }
        G.add(H.instanced(new T.CylinderGeometry(1, 1, 1, 11), new T.MeshLambertMaterial({ color: 0xfffaf4 }), mm));
      }
    }
    // cotton-candy clouds
    const cc = [[], []];
    placeFar(H, 40, 80, 650, cx0, cz0, 25).forEach((p, i) => cc[i % 2].push({ x: p.x, y: H.srnd(55, 130), z: p.z, sx: H.srnd(10, 24), sy: H.srnd(6, 11), sz: H.srnd(10, 20), ry: H.srand() * 3 }));
    G.add(U.chunked(H, cloudGeo(T, 0xffa8d8), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x402030 }), cc[0], { cell: 400 }));
    G.add(U.chunked(H, cloudGeo(T, 0xa8d8ff), new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x203040 }), cc[1], { cell: 400 }));
    H.addParticles(G, H.isTouch ? 90 : 160, 0xff9ad0, 0.4, 0.85, 'leaves');
  };

  /* ================= VOLCANO RUN ================= */
  EXT.scenery.volcano = function (G, th, H, cx0, cz0) {
    const T = H.THREE, S = H.samples, N = H.SAMPLES, W = H.WALL_DIST;
    EXT.anim = [];
    const B = H.bounds;
    const vx = (B.minX + B.maxX) / 2 + 60, vz = B.maxZ + 230, vH = 150;
    G.add(H.buildTerrain(Object.assign({ terrainHigh: 0x3a2c2c, rock: 0x2a2020, bankSlope: 0.3 }, th), (x, z, d) => {
      const m = H.clamp((d - 50) / 130, 0, 1);
      const hills = (Math.sin(x * 0.015) * Math.cos(z * 0.018) + 0.8) * 18 * m;
      const dv = Math.hypot(x - vx, z - vz);
      let v = Math.max(0, vH - dv * 0.62);
      if (dv < 34) v = vH - 20 + (dv / 34) * 12;
      return Math.max(0, Math.max(hills, v * H.clamp((d - 40) / 60, 0, 1)));
    }));
    // crater glow, lava flows, smoke plume, lava bombs
    const lavaM = new T.MeshBasicMaterial({ color: 0xff6a1a });
    const cg = new T.CircleGeometry(30, 32);
    cg.rotateX(-Math.PI / 2);
    const crater = new T.Mesh(cg, new T.MeshBasicMaterial({ color: 0xffa020 }));
    crater.position.set(vx, vH - 19, vz);
    G.add(crater);
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.45 + 0.1;
      const pts = [];
      for (let j = 0; j <= 10; j++) {
        const r = 30 + j * 16, wob = Math.sin(j * 1.3 + k) * 8;
        const x = vx + Math.cos(a) * r - Math.sin(a) * wob, z = vz + Math.sin(a) * r + Math.cos(a) * wob;
        pts.push([x, Math.max(1, vH - 14 - (r - 34) * 0.62), z]);
      }
      G.add(new T.Mesh(U.tube(T, pts, 2.4, 40, 6), lavaM));
    }
    const smokeM = new T.MeshLambertMaterial({ color: 0x6a5a5a, transparent: true, opacity: 0.75, depthWrite: false });
    const puffs = [];
    for (let k = 0; k < 12; k++) {
      const m = new T.Mesh(new T.IcosahedronGeometry(1, 1), smokeM);
      G.add(m);
      puffs.push({ m, ph: k / 12 });
    }
    const bombM = new T.MeshBasicMaterial({ color: 0xffb030 });
    const bombs = [];
    for (let k = 0; k < 7; k++) {
      const m = new T.Mesh(new T.IcosahedronGeometry(2.2, 1), bombM);
      G.add(m);
      bombs.push({ m, ph: k * 0.37, a: k * 0.9 });
    }
    EXT.anim.push((t) => {
      for (const p of puffs) {
        const q = (t * 0.06 + p.ph) % 1;
        p.m.position.set(vx + Math.sin(q * 5 + p.ph * 9) * 10 + q * 60, vH - 10 + q * 170, vz + q * 30);
        p.m.scale.setScalar(12 + q * 34);
      }
      for (const b of bombs) {
        const q = (t * 0.28 + b.ph) % 1;
        const r = q * 70;
        b.m.position.set(vx + Math.cos(b.a) * r, vH - 15 + q * 90 - q * q * 120, vz + Math.sin(b.a) * r);
      }
      crater.material.color.setHSL(0.07, 1, 0.5 + Math.sin(t * 3) * 0.06);
    });
    // lava rivers beside the track (flowing texture)
    const lt = (() => {
      const cv = document.createElement('canvas');
      cv.width = 64; cv.height = 128;
      const g = cv.getContext('2d');
      g.fillStyle = '#ff5a10';
      g.fillRect(0, 0, 64, 128);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = ['#ffb030', '#ffd060', '#e03a08', '#ff8a20'][i % 4];
        g.beginPath();
        g.ellipse(Math.random() * 64, Math.random() * 128, 3 + Math.random() * 10, 2 + Math.random() * 5, 0, 0, TAU);
        g.fill();
      }
      const t = new T.CanvasTexture(cv);
      t.wrapS = t.wrapT = T.RepeatWrapping;
      return t;
    })();
    const riverM = new T.MeshBasicMaterial({ map: lt });
    [[0.08, 0.2, 1], [0.4, 0.52, -1], [0.66, 0.8, 1]].forEach(([a, b, sg]) => {
      const i0 = Math.round(a * N), i1 = Math.round(b * N);
      const inner = (W + 6) * sg, outer = (W + 15) * sg;
      G.add(ribbon(H, i0, i1, Math.min(inner, outer), Math.max(inner, outer), -0.55, riverM, 2));
      const bank = [];
      for (let j = i0; j <= i1; j += 2) {
        const s = S[j % N];
        for (const off of [W + 4.6, W + 16.4]) {
          const x = s.x + s.nx * off * sg, z = s.z + s.nz * off * sg;
          if (H.trackDist(x, z).d < W + 2.5) continue;
          bank.push({ x, y: s.y - 0.6, z, sx: H.srnd(0.9, 1.8), sy: H.srnd(0.6, 1.2), sz: H.srnd(0.9, 1.8), ry: j });
        }
      }
      G.add(U.chunked(H, new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0x2a2224 }), bank, { far: 300 }));
    });
    EXT.anim.push((t) => { lt.offset.y = -t * 0.12; });
    // palms
    const palm = (flip) => {
      const parts = [];
      let x = 0, y = 0;
      for (let k = 0; k < 7; k++) {
        parts.push([new T.CylinderGeometry(0.2 - k * 0.012, 0.26 - k * 0.012, 1.25, 8), k % 2 ? 0x9a6a3a : 0x8a5a2e, x, y + 0.62, 0, 0, 0, -0.07 * flip * k * 0.5]);
        x += 0.09 * flip * k * 0.5;
        y += 1.2;
      }
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        parts.push([new T.SphereGeometry(1, 8, 6), k % 2 ? 0x2fae3a : 0x3fc84a, x + Math.cos(a) * 1.4, y + 0.1, Math.sin(a) * 1.4, 0, -a, 0.45, 1.8, 0.12, 0.45]);
      }
      for (let k = 0; k < 3; k++) parts.push([new T.SphereGeometry(0.22, 8, 6), 0x6a4a22, x + Math.cos(k * 2) * 0.35, y - 0.35, Math.sin(k * 2) * 0.35]);
      return prop(T, parts);
    };
    const pl = [[], []];
    H.scatter(H.isTouch ? 110 : 160, W + 3, W + 40, 2).forEach((p, i) => pl[i % 2].push({ x: p.x, y: p.y - 0.7, z: p.z, sx: H.srnd(0.9, 1.4), ry: H.srand() * TAU }));
    const vc = vcMat(T);
    G.add(U.chunked(H, palm(1), vc, pl[0], { cast: true, far: 420 }));
    G.add(U.chunked(H, palm(-1), vc, pl[1], { cast: true, far: 420 }));
    // tiki torches along the barriers (flickering)
    const torchG = prop(T, [[new T.CylinderGeometry(0.12, 0.16, 3.2, 8), 0x8a5a2e, 0, 1.6, 0], [new T.CylinderGeometry(0.4, 0.22, 0.5, 7), 0x5a3a1e, 0, 3.4, 0]]);
    const torches = [], flames = [];
    for (let i = 0; i < N; i += 9) {
      const s = S[i];
      const sg = (i / 9) % 2 ? 1 : -1;
      const d = W + 1.5;
      const x = s.x + s.nx * d * sg, z = s.z + s.nz * d * sg;
      if (H.trackDist(x, z).d < W + 1) continue;
      torches.push({ x, y: s.y - 0.5, z });
      flames.push({ x, y: s.y + 3.6, z, sx: 0.4, sy: 1.0, sz: 0.4 });
    }
    G.add(U.chunked(H, torchG, vc, torches, { far: 320 }));
    const flameM = new T.MeshBasicMaterial({ color: 0xffa020 });
    G.add(U.chunked(H, new T.ConeGeometry(1, 1.4, 8), flameM, flames, { far: 360 }));
    EXT.anim.push((t) => flameM.color.setHSL(0.08 + Math.sin(t * 13) * 0.015, 1, 0.55 + Math.sin(t * 17) * 0.05));
    // smiling tiki statues
    const tiki = prop(T, [
      [new T.CylinderGeometry(1, 1.1, 3.4, 9), 0x9a6a3a, 0, 1.7, 0],
      [new T.SphereGeometry(0.34, 8, 6), 0xffffff, -0.42, 2.4, 0.86],
      [new T.SphereGeometry(0.34, 8, 6), 0xffffff, 0.42, 2.4, 0.86],
      [new T.SphereGeometry(0.16, 8, 6), 0x1a1a1a, -0.42, 2.4, 1.14],
      [new T.SphereGeometry(0.16, 8, 6), 0x1a1a1a, 0.42, 2.4, 1.14],
      [new T.TorusGeometry(0.45, 0.1, 6, 12, Math.PI), 0x5a2a1a, 0, 1.55, 0.95, 0, 0, Math.PI],
      [new T.SphereGeometry(0.2, 8, 6), 0xff7a5a, 0, 1.95, 1.05],
      [new T.ConeGeometry(0.5, 1.6, 6), 0x3fc84a, -0.5, 3.9, 0, 0, 0, 0.4],
      [new T.ConeGeometry(0.5, 1.8, 6), 0x2fae3a, 0, 4.1, 0],
      [new T.ConeGeometry(0.5, 1.6, 6), 0x3fc84a, 0.5, 3.9, 0, 0, 0, -0.4],
    ]);
    const tk = [];
    H.scatter(18, W + 5, W + 26, 4).forEach((p) => tk.push({ x: p.x, y: p.y - 0.7, z: p.z, sx: H.srnd(1, 1.6), ry: Math.atan2(S[p.i].x - p.x, S[p.i].z - p.z) }));
    G.add(U.chunked(H, tiki, vc, tk, { cast: true }));
    // tiki huts on stilts
    const hut = prop(T, [
      [new T.CylinderGeometry(3.2, 3.2, 0.4, 11), 0x9a6a3a, 0, 1.6, 0],
      [new T.CylinderGeometry(2.6, 2.8, 2.4, 11), 0xe8c890, 0, 3.0, 0],
      [new T.ConeGeometry(4.4, 3.4, 11), 0xd8a848, 0, 5.8, 0],
      [new T.CylinderGeometry(0.9, 0.9, 1.8, 8, 1, false, 0, Math.PI), 0x3a2416, 0, 2.7, 2.5, 0, -Math.PI / 2, 0],
      ...[[2.4, 2.4], [-2.4, 2.4], [2.4, -2.4], [-2.4, -2.4]].map(([x, z]) => [new T.CylinderGeometry(0.2, 0.2, 1.6, 8), 0x7a4a26, x, 0.8, z]),
    ]);
    const hl = [];
    H.scatter(10, W + 14, W + 40, 9).forEach((p) => hl.push({ x: p.x, y: p.y - 0.7, z: p.z, sx: H.srnd(1, 1.3), ry: Math.atan2(S[p.i].x - p.x, S[p.i].z - p.z) }));
    G.add(U.chunked(H, hut, vc, hl, { cast: true }));
    // glowing lava rocks + ember sparks
    const gl = H.scatter(70, W + 2, W + 50, 1.5).map((p) => ({ x: p.x, y: p.y - 0.5, z: p.z, sx: H.srnd(0.5, 1.4), ry: H.srand() * 3 }));
    G.add(U.chunked(H, new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0x3a2a2a, emissive: 0x5a1a04 }), gl, { far: 300 }));
    // the sea and a low sunset sun
    const seaM = new T.Mesh(new T.PlaneGeometry(3200, 1400), new T.MeshStandardMaterial({ color: th.sea, roughness: 0.2, metalness: 0.35, emissive: 0x2a1020 }));
    seaM.rotation.x = -Math.PI / 2;
    seaM.position.set(cx0, -0.9, B.minZ - 900);
    G.add(seaM);
    const sun = new T.Mesh(new T.CircleGeometry(70, 32), new T.MeshBasicMaterial({ color: 0xffd080, fog: false }));
    sun.position.set(cx0 - 500, 90, B.minZ - 1000);
    sun.lookAt(cx0, 0, cz0);
    G.add(sun);
    H.addParticles(G, H.isTouch ? 90 : 160, 0xffa040, 0.5, 0.9, 'leaves');
  };

  EXT.tickAnim = function (t, dt) {
    for (const f of EXT.anim) f(t, dt);
  };
})();
