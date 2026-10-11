'use strict';
/* Super Grid Expansion - THE SUPER GRID HUB: a plaza you drive around freely.
 *  - Super Grid Garage (drive inside): every car on display, park on a glowing pad to switch cars
 *  - Pit Stop Cafe (drive inside) with Chef Squeaks
 *  - 4 race gates: Sky Islands, Candy Kingdom, Volcano Run and Classic Tracks - drive through to race
 *  - Stunt Park: ramps, boost pads and a cone slalom
 *  - 12 Golden Lug Nuts hidden around (collect them all for GOLD paint)
 *  - Torty (Martina) the tortoise, the hub's flag marshal
 * Steering uses the same input as the races (right = turns right on screen; reversing works like a real car). */
(function () {
  const EXT = window.GRID_EXT;
  const U = EXT.U;
  const TAU = Math.PI * 2;
  const R_EDGE = 150;
  const LS_NUTS = 'grokgrid_sg_nuts';
  const hub = (EXT.hub = { active: false, built: false });
  let G = null, roofs = [], colliders = [], ramps = [], pads = [], gates = [], nuts = [], interiors = [], torty = null, turntables = [], spinners = [];
  let saveLight = null, hiddenCars = [], promptKey = '', gateCd = 0, nutGot = [];

  function loadNuts() { try { const a = JSON.parse(localStorage.getItem(LS_NUTS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function saveNuts() { try { localStorage.setItem(LS_NUTS, JSON.stringify(nutGot)); } catch (e) {} }
  hub.nutCount = () => loadNuts().length;
  hub.goldUnlocked = () => loadNuts().length >= 12;

  /* ---------- building the hub ---------- */
  function build() {
    const api = EXT.api, T = api.H.THREE;
    G = new T.Group();
    G.name = 'superGridHub';
    const L = [], S = []; // merged lambert / shiny parts
    const P = (arr, geo, color, x, y, z, rx, ry, rz, sx, sy, sz) => arr.push({ geo, color, m: U.mat4(T, x, y, z, rx, ry, rz, sx, sy, sz) });
    const rb = (w, h, d, r) => U.roundBox(T, w, h, d, r == null ? 0.25 : r, 2);
    // solid wall piece: visual + collider
    const wall = (x0, z0, x1, z1, h, color) => {
      const w = Math.abs(x1 - x0), d = Math.abs(z1 - z0);
      P(L, rb(w, h, d, 0.3), color, (x0 + x1) / 2, h / 2, (z0 + z1) / 2);
      colliders.push({ t: 'box', x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) });
    };
    const circ = (x, z, r) => colliders.push({ t: 'c', x, z, r });

    // ground: grass, plaza, roads
    const grassT = api.H.noiseTex(256, '#5cbf4a', 0.18);
    grassT.repeat.set(40, 40);
    const gg = new T.CircleGeometry(420, 64);
    gg.rotateX(-Math.PI / 2);
    const grass = new T.Mesh(gg, new T.MeshStandardMaterial({ map: grassT, color: 0x7ad866, roughness: 1 }));
    grass.receiveShadow = true;
    G.add(grass);
    const pave = (() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 128;
      const g = cv.getContext('2d');
      g.fillStyle = '#c9b493'; g.fillRect(0, 0, 128, 128);
      g.fillStyle = '#b89f7c'; for (let i = 0; i < 6; i++) g.fillRect((i * 37) % 112, (i * 53) % 112, 16, 16);
      g.strokeStyle = '#8f7a5e'; g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(128, i * 32); g.stroke(); }
      for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) { const x = i * 32 + (r % 2) * 16; g.beginPath(); g.moveTo(x, r * 32); g.lineTo(x, r * 32 + 32); g.stroke(); }
      const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(26, 26); return t;
    })();
    const pg = new T.CircleGeometry(62, 64);
    pg.rotateX(-Math.PI / 2);
    const plaza = new T.Mesh(pg, new T.MeshStandardMaterial({ map: pave, color: 0xa89878, roughness: 0.9 }));
    plaza.position.y = 0.03;
    plaza.receiveShadow = true;
    G.add(plaza);
    const asphalt = new T.MeshStandardMaterial({ map: api.H.noiseTex(128, '#34373e', 0.16), roughness: 0.9 });
    const road = (x, z, w, d, ry) => {
      const g = new T.PlaneGeometry(w, d);
      g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, asphalt);
      m.position.set(x, 0.05, z);
      m.rotation.y = ry || 0;
      m.receiveShadow = true;
      G.add(m);
    };
    road(0, -78, 150, 22); // gate avenue
    road(0, 54, 22, 30); // to the garage
    road(-58, 10, 30, 14); // to the cafe
    road(80, -10, 70, 66); // stunt park pad
    const ringG = new T.RingGeometry(16, 26, 48);
    ringG.rotateX(-Math.PI / 2);
    const ring = new T.Mesh(ringG, asphalt);
    ring.position.y = 0.06;
    G.add(ring);
    // dashed ring line
    for (let k = 0; k < 24; k++) { const a = (k / 24) * TAU; P(S, new T.BoxGeometry(0.3, 0.04, 2.2), 0xffffff, Math.cos(a) * 21, 0.08, Math.sin(a) * 21, 0, -a, 0); }

    // fountain with a spinning golden trophy
    P(L, new T.CylinderGeometry(10, 10.6, 1.2, 40), 0xf4f0e6, 0, 0.6, 0);
    P(S, new T.CylinderGeometry(9, 9, 0.2, 40), 0x3fb8ff, 0, 1.15, 0);
    P(L, new T.CylinderGeometry(1.6, 2.2, 3, 20), 0xf4f0e6, 0, 2.2, 0);
    circ(0, 0, 11);
    const trophy = new T.Group();
    const gold = new T.MeshStandardMaterial({ color: 0xffc83a, roughness: 0.2, metalness: 0.9, emissive: 0x3a2400 });
    const cupG = new T.LatheGeometry([[0.3, 0], [1.4, 0.1], [0.6, 0.5], [0.4, 1.4], [1.6, 2.4], [2.2, 3.8], [2.1, 4.0]].map(([r, y]) => new T.Vector2(r, y)), 28);
    trophy.add(new T.Mesh(cupG, gold));
    for (const s of [-1, 1]) { const h = new T.Mesh(new T.TorusGeometry(0.9, 0.18, 10, 20, Math.PI), gold); h.position.set(s * 2.2, 2.9, 0); h.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2; trophy.add(h); }
    trophy.position.y = 3.7;
    trophy.scale.setScalar(1.3);
    G.add(trophy);
    spinners.push((t) => (trophy.rotation.y = t * 0.6));
    // water jets
    const jetM = new T.MeshBasicMaterial({ color: 0xbfeaff, transparent: true, opacity: 0.6, depthWrite: false });
    const jets = [];
    for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; const j = new T.Mesh(new T.CylinderGeometry(0.15, 0.35, 4, 8), jetM); j.position.set(Math.cos(a) * 6.5, 3, Math.sin(a) * 6.5); j.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); G.add(j); jets.push(j); }
    spinners.push((t) => jets.forEach((j, k) => (j.scale.y = 0.85 + Math.sin(t * 4 + k) * 0.15)));

    /* ----- Super Grid Garage (x -30..30, z 70..106) ----- */
    const gx0 = -30, gx1 = 30, gz0 = 70, gz1 = 106, gh = 11;
    const wc = 0xf2f4f8, trim = 0xff4a1c;
    wall(gx0 - 1, gz0, gx0, gz1, gh, wc);
    wall(gx1, gz0, gx1 + 1, gz1, gh, wc);
    wall(gx0 - 1, gz1, gx1 + 1, gz1 + 1, gh, wc);
    wall(gx0 - 1, gz0 - 1, -10, gz0, gh, wc);
    wall(10, gz0 - 1, gx1 + 1, gz0, gh, wc);
    P(L, rb(20, 2.6, 1.2, 0.3), wc, 0, gh - 1.3, gz0 - 0.5); // door lintel
    // stripes on the facade
    for (const sx of [-1, 1]) {
      P(S, rb(21.4, 0.8, 1.4, 0.2), trim, sx * 20.5, 1.2, gz0 - 0.5);
      P(S, rb(21.4, 0.5, 1.4, 0.2), 0x00c8ff, sx * 20.5, 2.0, gz0 - 0.5);
      P(S, rb(1.6, gh - 2.6, 1.8, 0.3), 0xffd23b, sx * 10.2, (gh - 2.6) / 2, gz0 - 0.5); // door frame
    }
    // roof (hidden while you are inside so the camera can see)
    const roof = new T.Mesh(rb(64, 1.2, 40, 0.5), new T.MeshLambertMaterial({ color: 0x2a3550 }));
    roof.position.set(0, gh + 0.6, (gz0 + gz1) / 2);
    roof.castShadow = true;
    G.add(roof);
    roofs.push(roof);
    const sign = new T.Mesh(rb(30, 5, 0.8, 0.4), [new T.MeshStandardMaterial({ color: 0x15182a })]);
    sign.position.set(0, gh + 3.6, gz0 - 1);
    G.add(sign);
    const st = new T.Mesh(new T.PlaneGeometry(29, 4.6), new T.MeshBasicMaterial({ map: U.signTex(T, ['SUPER GRID GARAGE'], { w: 1024, h: 160, bg: '#ff4a1c', bg2: '#c42a10' }) }));
    st.position.set(0, gh + 3.6, gz0 - 1.45);
    st.rotation.y = Math.PI;
    G.add(st);
    // checker floor
    const chk = (() => { const cv = document.createElement('canvas'); cv.width = cv.height = 64; const g = cv.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { g.fillStyle = (i + j) % 2 ? '#e8ecf2' : '#2a2e3a'; g.fillRect(i * 8, j * 8, 8, 8); } const t = new T.CanvasTexture(cv); t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(7, 4); t.magFilter = T.NearestFilter; return t; })();
    const fl = new T.PlaneGeometry(60, 36);
    fl.rotateX(-Math.PI / 2);
    const floor = new T.Mesh(fl, new T.MeshStandardMaterial({ map: chk, roughness: 0.35, metalness: 0.1 }));
    floor.position.set(0, 0.07, 88);
    floor.receiveShadow = true;
    G.add(floor);
    interiors.push({ x0: gx0, x1: gx1, z0: gz0, z1: gz1, h: gh, roof, name: 'garage' });
    // display stands with every car + glowing swap pads
    const glowPad = new T.MeshBasicMaterial({ color: 0x3ff0ff, transparent: true, opacity: 0.55, depthWrite: false });
    EXT.VEHICLES.forEach((v, k) => {
      const x = -22 + k * 11, z = 98;
      P(S, new T.CylinderGeometry(4, 4.3, 0.6, 32), 0x2a2e3a, x, 0.3, z);
      P(S, new T.TorusGeometry(4.05, 0.12, 8, 40), v.accent, x, 0.62, z, Math.PI / 2, 0, 0);
      circ(x, z, 4.2);
      const car = api.makeCar(Object.assign({}, api.LIVERY[0], { kind: v.id, color: v.color, accent: v.accent }));
      car.root.position.set(x, 0.62, z);
      G.add(car.root);
      turntables.push({ root: car.root, k });
      const pg2 = new T.RingGeometry(1.6, 2.6, 32);
      pg2.rotateX(-Math.PI / 2);
      const pad = new T.Mesh(pg2, glowPad);
      pad.position.set(x, 0.1, 86);
      G.add(pad);
      pads.push({ t: 'car', x, z: 86, r: 2.8, v });
      const pl = new T.Mesh(new T.PlaneGeometry(8, 2), new T.MeshBasicMaterial({ map: U.signTex(T, [v.name], { w: 512, h: 128, bg: '#15182a', bg2: '#0a0c16', fg: '#' + new T.Color(v.accent).getHexString() }) }));
      pl.position.set(x, 3.2, z + 4.4 + 0.6);
      pl.rotation.y = Math.PI;
      G.add(pl);
      P(L, rb(8.4, 2.4, 0.4, 0.15), 0x15182a, x, 3.2, z + 5.2);
      P(L, new T.CylinderGeometry(0.15, 0.15, 3, 8), 0x9aa0ac, x - 3.5, 1.5, z + 5.2);
      P(L, new T.CylinderGeometry(0.15, 0.15, 3, 8), 0x9aa0ac, x + 3.5, 1.5, z + 5.2);
    });
    // tool walls, tyre stacks, tool chests, a car lift, hanging lamps
    for (let k = 0; k < 4; k++) {
      const z = 75 + k * 8;
      P(L, rb(0.4, 4, 6, 0.1), 0xd0a070, gx0 + 0.3, 3.4, z);
      for (let j = 0; j < 5; j++) P(S, rb(0.3, 0.9 + (j % 2) * 0.5, 0.25, 0.08), [0xff4a1c, 0x3fa9ff, 0xffe14a, 0x2fc46a, 0xa855ff][j], gx0 + 0.6, 3 + (j % 2) * 0.6, z - 2.2 + j * 1.1);
      P(S, rb(1.6, 2.4, 3.2, 0.25), 0xe0302a, gx1 - 1.4, 1.2, z);
      for (let d = 0; d < 3; d++) P(S, rb(0.1, 0.12, 2.6, 0.05), 0xc8ccd6, gx1 - 2.25, 0.6 + d * 0.7, z);
      circ(gx1 - 1.4, z, 1.8);
    }
    for (let k = 0; k < 3; k++) for (let j = 0; j < 5; j++) P(S, new T.TorusGeometry(0.75, 0.32, 10, 20), 0x1a1a20, -24 + k * 2.4, 0.35 + j * 0.62, 104, Math.PI / 2, 0, 0);
    circ(-21.6, 104, 3.5);
    // lift with a raised GT
    P(S, rb(0.6, 6, 0.6, 0.15), 0xffd23b, 18, 3, 76); P(S, rb(0.6, 6, 0.6, 0.15), 0xffd23b, 26, 3, 76);
    P(S, rb(9, 0.3, 4, 0.12), 0x5a606c, 22, 2.6, 76);
    circ(18, 76, 0.8); circ(26, 76, 0.8);
    {
      const c = api.makeCar(Object.assign({}, api.LIVERY[0], { kind: 'gt', color: 0xff4a1c, accent: 0xffffff }));
      c.root.position.set(22, 2.75, 76);
      c.root.rotation.y = Math.PI / 2;
      G.add(c.root);
    }
    const lampM = new T.MeshBasicMaterial({ color: 0xfff6d8 });
    for (let k = 0; k < 4; k++) for (let j = 0; j < 2; j++) { const l = new T.Mesh(rb(6, 0.25, 1.2, 0.1), lampM); l.position.set(-18 + k * 12, gh - 1.6, 80 + j * 14); G.add(l); }
    // posters on the back wall
    ['GO FAST!', 'RATITA ROCKET', 'BE KIND ON TRACK', 'SUPER GRID'].forEach((tx, k) => {
      const pm = new T.Mesh(new T.PlaneGeometry(7, 3.5), new T.MeshBasicMaterial({ map: U.signTex(T, [tx], { w: 512, h: 256, bg: ['#ff3f8a', '#ffc62e', '#2fc46a', '#2a6cff'][k], bg2: '#15182a' }) }));
      pm.position.set(-21 + k * 14, 7.6, gz1 - 0.05);
      pm.rotation.y = Math.PI;
      G.add(pm);
    });

    /* ----- Pit Stop Cafe (x -93..-67, z 0..20) ----- */
    const cx0 = -93, cx1 = -67, cz0 = 0, cz1 = 20, ch = 7;
    const cw = 0xfff2dc;
    wall(cx0 - 1, cz0, cx0, cz1, ch, cw);
    wall(cx0 - 1, cz1, cx1 + 1, cz1 + 1, ch, cw);
    wall(cx0 - 1, cz0 - 1, cx1 + 1, cz0, ch, cw);
    wall(cx1, cz0, cx1 + 1, 5, ch, cw);
    wall(cx1, 15, cx1 + 1, cz1, ch, cw);
    P(L, rb(1.2, 2, 10, 0.3), cw, cx1 + 0.5, ch - 1, 10);
    // red/white awning stripes along the door wall
    for (let k = 0; k < 10; k++) P(S, rb(2.2, 0.3, 2.2, 0.12), k % 2 ? 0xffffff : 0xff3b3b, cx1 + 2, ch - 1.4, 1 + k * 2.05, 0, 0, -0.3);
    const croof = new T.Mesh(rb(29, 1, 23, 0.4), new T.MeshLambertMaterial({ color: 0xff6a5a }));
    croof.position.set((cx0 + cx1) / 2, ch + 0.5, 10);
    croof.castShadow = true;
    G.add(croof);
    roofs.push(croof);
    interiors.push({ x0: cx0, x1: cx1, z0: cz0, z1: cz1, h: ch, roof: croof, name: 'cafe' });
    const csign = new T.Mesh(new T.PlaneGeometry(14, 3), new T.MeshBasicMaterial({ map: U.signTex(T, ['PIT STOP CAFE', 'cheese fries \u00b7 shakes'], { w: 768, h: 168, bg: '#ffc62e', bg2: '#ff8a00', fg: '#3a1a00' }) }));
    csign.position.set(cx1 + 1.1, ch + 2.2, 10);
    csign.rotation.y = Math.PI / 2;
    G.add(csign);
    P(L, rb(0.6, 3.4, 14.4, 0.2), 0x15182a, cx1 + 0.75, ch + 2.2, 10);
    const cfl = new T.PlaneGeometry(26, 20);
    cfl.rotateX(-Math.PI / 2);
    const cfloor = new T.Mesh(cfl, new T.MeshStandardMaterial({ map: (() => { const t = chk.clone(); t.needsUpdate = true; t.repeat.set(5, 4); return t; })(), color: 0xffd8d8, roughness: 0.4 }));
    cfloor.position.set(-80, 0.07, 10);
    G.add(cfloor);
    // counter, stools, tables, menu board, milkshake machine
    P(S, rb(3, 2.2, 16, 0.3), 0xff3b3b, -89.5, 1.1, 10);
    P(S, rb(3.4, 0.3, 16.4, 0.15), 0xf4f4f0, -89.5, 2.3, 10);
    colliders.push({ t: 'box', x0: -91, x1: -88, z0: 2, z1: 18 });
    for (let k = 0; k < 5; k++) { P(S, new T.CylinderGeometry(0.7, 0.7, 0.3, 16), 0xff3b3b, -86.4, 1.4, 3.5 + k * 3.2); P(L, new T.CylinderGeometry(0.12, 0.12, 1.3, 8), 0xc8ccd6, -86.4, 0.65, 3.5 + k * 3.2); }
    [[-79, 5], [-79, 15], [-73, 10]].forEach(([x, z]) => {
      P(S, new T.CylinderGeometry(1.6, 1.6, 0.2, 24), 0xffffff, x, 1.6, z);
      P(L, new T.CylinderGeometry(0.2, 0.4, 1.5, 10), 0xc8ccd6, x, 0.75, z);
      P(S, new T.SphereGeometry(0.35, 12, 10), 0xffc62e, x - 0.5, 1.95, z);
      P(S, new T.CylinderGeometry(0.25, 0.18, 0.7, 12), 0xff7ab8, x + 0.5, 2.05, z);
      for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU; P(S, new T.CylinderGeometry(0.55, 0.55, 0.25, 14), 0x3fa9ff, x + Math.cos(a) * 2.6, 1.0, z + Math.sin(a) * 2.6); }
      circ(x, z, 2);
    });
    const menu = new T.Mesh(new T.PlaneGeometry(9, 3.4), new T.MeshBasicMaterial({ map: U.signTex(T, ['MENU', 'cheese fries 3 \u00b7 shake 2 \u00b7 burger 4'], { w: 768, h: 290, bg: '#15182a', fg: '#ffe14a' }) }));
    menu.position.set(cx0 + 0.1, 4.6, 10);
    menu.rotation.y = Math.PI / 2;
    G.add(menu);
    // Chef Squeaks (a Ratita chef) behind the counter
    const chef = new T.Group();
    const grey = new T.MeshStandardMaterial({ color: 0xb9b3c8, roughness: 0.6 }), pink = new T.MeshStandardMaterial({ color: 0xff9fc4, roughness: 0.6 }), white = new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }), blk = new T.MeshStandardMaterial({ color: 0x15151a, roughness: 0.4 });
    const cb = new T.Mesh(new T.SphereGeometry(1, 18, 14), white); cb.scale.set(0.9, 1.1, 0.8); cb.position.y = 1.6;
    const chead = new T.Mesh(new T.SphereGeometry(0.75, 18, 14), grey); chead.position.y = 3.1;
    const csn = new T.Mesh(new T.SphereGeometry(0.4, 14, 10), grey); csn.scale.set(0.8, 0.7, 1.2); csn.position.set(0, 2.95, 0.65);
    const cno = new T.Mesh(new T.SphereGeometry(0.12, 10, 8), pink); cno.position.set(0, 3.0, 1.12);
    chef.add(cb, chead, csn, cno);
    for (const s of [-1, 1]) { const e = new T.Mesh(new T.SphereGeometry(0.4, 14, 10), grey); e.scale.set(1, 1, 0.3); e.position.set(s * 0.55, 3.75, -0.1); const ei = new T.Mesh(new T.SphereGeometry(0.27, 12, 10), pink); ei.scale.set(1, 1, 0.3); ei.position.set(s * 0.55, 3.75, 0.0); const ey = new T.Mesh(new T.SphereGeometry(0.1, 10, 8), blk); ey.position.set(s * 0.27, 3.25, 0.66); chef.add(e, ei, ey); }
    const hat = new T.Mesh(new T.CylinderGeometry(0.5, 0.45, 0.8, 16), white); hat.position.y = 3.95; const puff = new T.Mesh(new T.SphereGeometry(0.62, 16, 12), white); puff.position.y = 4.45; chef.add(hat, puff);
    chef.position.set(-91.6, 0, 10);
    chef.rotation.y = Math.PI / 2;
    G.add(chef);
    spinners.push((t) => (chef.rotation.z = Math.sin(t * 2) * 0.05));
    pads.push({ t: 'chef', x: -84.5, z: 10, r: 5 });

    /* ----- Race gates (south, z = -86) ----- */
    const gateDefs = [
      { x: -54, track: 'sky', name: 'SKY ISLANDS', c: 0x3fa9ff, c2: '#3fa9ff' },
      { x: -18, track: 'candy', name: 'CANDY KINGDOM', c: 0xff3f8a, c2: '#ff3f8a' },
      { x: 18, track: 'volcano', name: 'VOLCANO RUN', c: 0xff8a00, c2: '#ff6a1a' },
      { x: 54, track: null, name: 'CLASSIC TRACKS', c: 0x2fc46a, c2: '#2fc46a' },
    ];
    const portalMats = [];
    gateDefs.forEach((d) => {
      const z = -86;
      for (const s of [-1, 1]) {
        P(S, new T.CylinderGeometry(1.1, 1.4, 9, 20), 0xf4f4f0, d.x + s * 8, 4.5, z);
        P(S, new T.SphereGeometry(1.4, 18, 12), d.c, d.x + s * 8, 9.4, z);
        circ(d.x + s * 8, z, 1.6);
      }
      P(S, new T.TorusGeometry(8, 0.9, 12, 40, Math.PI), d.c, d.x, 9, z);
      const pm = new T.MeshBasicMaterial({ color: d.c, transparent: true, opacity: 0.35, side: T.DoubleSide, depthWrite: false });
      portalMats.push(pm);
      const sh = new T.Shape();
      sh.moveTo(-7, 0); sh.lineTo(-7, 9); sh.absarc(0, 9, 7, Math.PI, 0, true); sh.lineTo(7, 0); sh.lineTo(-7, 0);
      const portal = new T.Mesh(new T.ShapeGeometry(sh, 20), pm);
      portal.position.set(d.x, 0, z);
      G.add(portal);
      const sg = new T.Mesh(new T.PlaneGeometry(12, 2.6), new T.MeshBasicMaterial({ map: U.signTex(T, [d.name], { w: 640, h: 140, bg: d.c2, bg2: '#15182a' }), side: T.DoubleSide }));
      sg.position.set(d.x, 19.2, z);
      G.add(sg);
      P(L, rb(12.6, 3.2, 0.5, 0.2), 0x15182a, d.x, 19.2, z - 0.35);
      P(L, new T.CylinderGeometry(0.2, 0.2, 2.4, 8), 0x9aa0ac, d.x, 16.8, z - 0.35);
      gates.push({ x: d.x, z, track: d.track, name: d.name });
    });
    spinners.push((t) => portalMats.forEach((m, k) => (m.opacity = 0.3 + Math.sin(t * 3 + k) * 0.12)));
    const gsign = new T.Mesh(new T.PlaneGeometry(26, 3.6), new T.MeshBasicMaterial({ map: U.signTex(T, ['DRIVE THROUGH A GATE TO RACE'], { w: 1024, h: 140, bg: '#15182a', fg: '#ffe14a' }), side: T.DoubleSide }));
    gsign.position.set(0, 25, -100);
    G.add(gsign);

    /* ----- Stunt park (east) ----- */
    const rampDefs = [
      { x: 72, z: -6, w: 9, len: 16, h: 3.2, dir: 1 },
      { x: 98, z: -32, w: 9, len: 20, h: 4.6, dir: 1 },
    ];
    rampDefs.forEach((r) => {
      const sh = new T.Shape();
      sh.moveTo(0, 0); sh.lineTo(r.len, r.h); sh.lineTo(r.len, 0); sh.lineTo(0, 0);
      const g = new T.ExtrudeGeometry(sh, { depth: r.w, bevelEnabled: true, bevelThickness: 0.2, bevelSize: 0.2, bevelSegments: 2 });
      g.translate(0, 0, -r.w / 2);
      g.rotateY(-Math.PI / 2); // shape x -> +z
      if (r.dir < 0) g.rotateY(Math.PI);
      const m = new T.Mesh(g, new T.MeshStandardMaterial({ color: 0xffd23b, roughness: 0.5 }));
      m.position.set(r.x, 0, r.z);
      m.castShadow = m.receiveShadow = true;
      G.add(m);
      // chevrons up the ramp
      for (let k = 0; k < 4; k++) P(S, rb(r.w * 0.6, 0.06, 0.6, 0.05), 0xff3f8a, r.x, (r.h * (k + 0.5)) / 4 + 0.2, r.z + r.dir * (r.len * (k + 0.5)) / 4, -Math.atan2(r.h, r.len) * r.dir, 0, 0);
      ramps.push({ x0: r.x - r.w / 2, x1: r.x + r.w / 2, z0: r.dir > 0 ? r.z : r.z - r.len, z1: r.dir > 0 ? r.z + r.len : r.z, h: r.h, dir: r.dir, base: r.z, len: r.len });
    });
    // boost pads
    const padT = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 128; const g = cv.getContext('2d'); g.fillStyle = '#1a0a2a'; g.fillRect(0, 0, 64, 128); for (let k = 0; k < 3; k++) { g.fillStyle = ['#ffe14a', '#ff8a00', '#ff3f8a'][k]; g.beginPath(); const y = 18 + k * 36; g.moveTo(6, y + 26); g.lineTo(32, y); g.lineTo(58, y + 26); g.lineTo(46, y + 30); g.lineTo(32, y + 16); g.lineTo(18, y + 30); g.closePath(); g.fill(); } const t = new T.CanvasTexture(cv); t.wrapT = T.RepeatWrapping; return t; })();
    const bpM = new T.MeshBasicMaterial({ map: padT });
    [[72, -18, 0], [98, -40, 0], [0, -40, Math.PI / 2], [0, 34, 0]].forEach(([x, z, ry]) => {
      const g = new T.PlaneGeometry(4.4, 7);
      g.rotateX(-Math.PI / 2);
      const m = new T.Mesh(g, bpM);
      m.position.set(x, 0.09, z);
      m.rotation.y = ry;
      G.add(m);
      pads.push({ t: 'boost', x, z, r: 3, ry });
    });
    spinners.push((t) => (padT.offset.y = -t * 1.5));
    // cone slalom + tyre walls
    const cones = [];
    for (let k = 0; k < 9; k++) cones.push({ x: 54 + k * 6, y: 0, z: 54 + (k % 2) * 4 });
    const coneG = U.merge(T, [{ geo: new T.ConeGeometry(0.5, 1.4, 14), color: 0xff6a1a, m: U.mat4(T, 0, 0.75, 0) }, { geo: new T.CylinderGeometry(0.34, 0.4, 0.22, 14), color: 0xffffff, m: U.mat4(T, 0, 0.75, 0) }, { geo: new T.CylinderGeometry(0.7, 0.7, 0.1, 14), color: 0xff6a1a, m: U.mat4(T, 0, 0.05, 0) }]);
    G.add(api.H.instanced(coneG, new T.MeshLambertMaterial({ vertexColors: true }), cones));
    cones.forEach((c) => circ(c.x, c.z, 0.7));
    const tyres = [];
    for (let k = 0; k < 14; k++) for (let j = 0; j < 2; j++) tyres.push({ x: 116, y: 0.35 + j * 0.62, z: -30 + k * 1.7, rx: Math.PI / 2, color: k % 2 ? 0xff3b3b : 0xffffff });
    G.add(api.H.instanced(new T.TorusGeometry(0.75, 0.32, 10, 20), new T.MeshLambertMaterial({ color: 0xffffff }), tyres));
    colliders.push({ t: 'box', x0: 115, x1: 117, z0: -31, z1: -6 });
    // grandstand by the stunt park
    for (let k = 0; k < 5; k++) P(S, rb(30, 1, 2.6, 0.2), [0xff3f8a, 0xffffff, 0x3fa9ff, 0xffffff, 0xffd23b][k], 86, 0.5 + k, -60 - k * 2.4);
    colliders.push({ t: 'box', x0: 70, x1: 102, z0: -72, z1: -58.5 });
    // crowd of round fans in the stand
    const fans = [];
    for (let k = 0; k < 4; k++) for (let j = 0; j < 12; j++) if ((k * 7 + j * 3) % 5) fans.push({ x: 74 + j * 2.2, y: 1.9 + k, z: -60.6 - k * 2.4, sx: 0.5, color: [0xff5f6a, 0x3fa9ff, 0xffe14a, 0x2fc46a, 0xa855ff, 0xffffff][(k + j) % 6] });
    G.add(api.H.instanced(new T.SphereGeometry(1, 12, 10), new T.MeshLambertMaterial({ color: 0xffffff }), fans));

    /* ----- Torty (Martina) the tortoise flag marshal ----- */
    {
      const t = new T.Group();
      const shellM = new T.MeshStandardMaterial({ color: 0x3f9a4a, roughness: 0.5 }), skin = new T.MeshStandardMaterial({ color: 0x9ad06a, roughness: 0.6 });
      const shell = new T.Mesh(new T.SphereGeometry(1.6, 24, 16, 0, TAU, 0, Math.PI / 2), shellM);
      shell.scale.set(1, 0.85, 1.15);
      shell.position.y = 0.9;
      const rim = new T.Mesh(new T.TorusGeometry(1.6, 0.18, 10, 32), new T.MeshStandardMaterial({ color: 0xd9b25a }));
      rim.rotation.x = Math.PI / 2; rim.scale.set(1, 1.15, 1); rim.position.y = 0.92;
      t.add(shell, rim);
      for (let k = 0; k < 6; k++) { const a = (k / 6) * TAU; const sp = new T.Mesh(new T.SphereGeometry(0.42, 12, 8), new T.MeshStandardMaterial({ color: 0x2f7a3a })); sp.scale.set(1, 0.35, 1); sp.position.set(Math.cos(a) * 0.95, 1.95, Math.sin(a) * 1.05); sp.lookAt(0, -1, 0); t.add(sp); }
      const top = new T.Mesh(new T.SphereGeometry(0.5, 12, 8), new T.MeshStandardMaterial({ color: 0x2f7a3a })); top.scale.set(1, 0.4, 1); top.position.y = 2.25; t.add(top);
      const head = new T.Mesh(new T.SphereGeometry(0.62, 18, 14), skin); head.position.set(0, 1.5, 1.9); t.add(head);
      for (const s of [-1, 1]) {
        const e = new T.Mesh(new T.SphereGeometry(0.17, 12, 10), new T.MeshStandardMaterial({ color: 0xffffff })); e.position.set(s * 0.25, 1.7, 2.38); t.add(e);
        const p = new T.Mesh(new T.SphereGeometry(0.09, 10, 8), new T.MeshStandardMaterial({ color: 0x15151a })); p.position.set(s * 0.25, 1.7, 2.52); t.add(p);
        const lg = new T.Mesh(new T.SphereGeometry(0.42, 12, 10), skin); lg.scale.set(1, 0.8, 1); lg.position.set(s * 1.2, 0.35, 1); t.add(lg);
        const lg2 = lg.clone(); lg2.position.z = -1; t.add(lg2);
      }
      const smile = new T.Mesh(new T.TorusGeometry(0.2, 0.04, 6, 14, Math.PI), new T.MeshStandardMaterial({ color: 0x3a1a10 })); smile.rotation.z = Math.PI; smile.position.set(0, 1.4, 2.45); t.add(smile);
      const bow = new T.Mesh(new T.SphereGeometry(0.2, 10, 8), new T.MeshStandardMaterial({ color: 0xff5fa2 })); bow.scale.set(1.6, 1, 0.6); bow.position.set(0, 2.1, 1.85); t.add(bow);
      // waving checkered flag
      const arm = new T.Group();
      const stick = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.6, 8), new T.MeshStandardMaterial({ color: 0x8a5a2e })); stick.position.y = 1.3;
      const fg = new T.PlaneGeometry(1.6, 1.1, 8, 1);
      const flagT = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 44; const g = cv.getContext('2d'); for (let i = 0; i < 8; i++) for (let j = 0; j < 5; j++) { g.fillStyle = (i + j) % 2 ? '#fff' : '#111'; g.fillRect(i * 8, j * 9, 8, 9); } return new T.CanvasTexture(cv); })();
      const flag = new T.Mesh(fg, new T.MeshStandardMaterial({ map: flagT, side: T.DoubleSide }));
      flag.position.set(0.82, 2.2, 0);
      arm.add(stick, flag);
      arm.position.set(1.0, 1.2, 1.6);
      t.add(arm);
      t.position.set(0, 0, -70);
      t.scale.setScalar(1.25);
      G.add(t);
      torty = t;
      circ(0, -70, 3);
      pads.push({ t: 'torty', x: 0, z: -66, r: 7 });
      const fp = fg.attributes.position, base = Float32Array.from(fp.array);
      spinners.push((tm) => {
        arm.rotation.z = -0.5 + Math.sin(tm * 3) * 0.5;
        head.position.y = 1.5 + Math.sin(tm * 2) * 0.05;
        for (let i = 0; i < fp.count; i++) fp.setZ(i, base[i * 3 + 2] + Math.sin(tm * 8 + base[i * 3] * 3) * 0.12 * (base[i * 3] + 0.8));
        fp.needsUpdate = true;
      });
    }

    /* ----- trees, lamps, flags, benches, flowers, fence ----- */
    const treeG = U.merge(T, [
      { geo: new T.CylinderGeometry(0.35, 0.5, 4, 8), color: 0x7a5232, m: U.mat4(T, 0, 2, 0) },
      { geo: new T.IcosahedronGeometry(2.4, 1), color: 0x3fae3a, m: U.mat4(T, 0, 5, 0) },
      { geo: new T.IcosahedronGeometry(1.7, 1), color: 0x4cc046, m: U.mat4(T, 1.2, 6.2, 0.4) },
      { geo: new T.IcosahedronGeometry(1.5, 1), color: 0x5ad04a, m: U.mat4(T, -1.1, 6.0, -0.5) },
    ]);
    const trees = [];
    for (let k = 0; k < 70; k++) {
      const a = (k / 70) * TAU + Math.sin(k) * 0.03, r = 128 + Math.sin(k * 3.1) * 8;
      trees.push({ x: Math.cos(a) * r, y: 0, z: Math.sin(a) * r, sx: 1 + Math.sin(k * 1.7) * 0.25, ry: k });
    }
    [[-50, 40], [-40, 60], [45, 45], [55, 62], [-60, -40], [-110, -20], [-110, 40], [40, -50], [120, 40], [-40, -112], [40, -112]].forEach(([x, z], k) => trees.push({ x, y: 0, z, sx: 1.1, ry: k }));
    trees.forEach((t) => { if (Math.hypot(t.x, t.z) < 140) circ(t.x, t.z, 1.2); });
    G.add(U.chunked(api.H, treeG, new T.MeshLambertMaterial({ vertexColors: true }), trees, { cast: true, cell: 120 }));
    const lampG = U.merge(T, [
      { geo: new T.CylinderGeometry(0.15, 0.22, 7, 8), color: 0x3a3f4a, m: U.mat4(T, 0, 3.5, 0) },
      { geo: new T.SphereGeometry(0.6, 14, 10), color: 0xfff6d8, m: U.mat4(T, 0, 7.3, 0) },
    ]);
    const lamps = [];
    for (let k = 0; k < 16; k++) { const a = ((k + 0.5) / 16) * TAU; lamps.push({ x: Math.cos(a) * 64, y: 0, z: Math.sin(a) * 64 }); }
    lamps.forEach((l) => circ(l.x, l.z, 0.5));
    G.add(api.H.instanced(lampG, new T.MeshLambertMaterial({ vertexColors: true, emissive: 0x202020 }), lamps));
    // bunting flags around the plaza
    const flags = [];
    for (let k = 0; k < 96; k++) { const a = (k / 96) * TAU; flags.push({ x: Math.cos(a) * 64, y: 6.2 - Math.abs(Math.sin(k * Math.PI / 6)) * 0.8, z: Math.sin(a) * 64, ry: -a, rx: Math.PI, color: [0xff3f8a, 0xffe14a, 0x3fa9ff, 0x2fc46a][k % 4] }); }
    G.add(api.H.instanced(new T.ConeGeometry(0.45, 1.1, 3), new T.MeshLambertMaterial({ color: 0xffffff }), flags));
    const fb = [];
    for (let k = 0; k < 140; k++) { const a = (k / 140) * TAU, r = 58 + (k % 3); if (Math.min(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) * r < 13) continue; fb.push({ x: Math.cos(a) * r, y: 0.2, z: Math.sin(a) * r, sx: 0.5, color: [0xff5fa2, 0xffe14a, 0xffffff, 0xa86bff][k % 4] }); }
    G.add(api.H.instanced(new T.IcosahedronGeometry(1, 1), new T.MeshLambertMaterial({ color: 0xffffff }), fb));
    const posts = [];
    for (let k = 0; k < 150; k++) { const a = (k / 150) * TAU; posts.push({ x: Math.cos(a) * (R_EDGE + 1), y: 0.7, z: Math.sin(a) * (R_EDGE + 1), color: k % 2 ? 0xff3b3b : 0xffffff }); }
    G.add(api.H.instanced(new T.BoxGeometry(1.6, 1.4, 6.2), new T.MeshLambertMaterial({ color: 0xffffff }), posts.map((p, k) => Object.assign(p, { ry: -(k / 150) * TAU }))));
    // parked cars in the lot by the cafe
    ['rocket', 'buggy', 'hover', 'gt'].forEach((kind, k) => {
      const v = EXT.vehById(kind);
      const c = api.makeCar(Object.assign({}, api.LIVERY[0], { kind, color: v.color, accent: v.accent }));
      c.root.position.set(-112 + k * 7, 0, -46);
      G.add(c.root);
      circ(-112 + k * 7, -46, 2.6);
    });
    for (let k = 0; k < 5; k++) P(S, new T.BoxGeometry(0.25, 0.03, 6), 0xffffff, -115.5 + k * 7, 0.08, -46);
    road(-101, -46, 34, 12);

    /* ----- 12 Golden Lug Nuts ----- */
    const nutPos = [[-26, 1.4, 102], [26, 1.4, 102], [-80, 1.4, 17], [0, 1.4, 118], [-130, 1.4, 0], [130, 1.4, -10], [98, 6.2, 0], [72, 6, 18], [-54, 1.4, -100], [54, 1.4, -100], [36, 1.4, 20], [-26, 1.4, -26]];
    nutGot = loadNuts();
    const nutM = new T.MeshStandardMaterial({ color: 0xffc83a, roughness: 0.2, metalness: 0.9, emissive: 0x4a3000 });
    const nutG = new T.TorusGeometry(0.75, 0.38, 6, 6);
    nutPos.forEach(([x, y, z], i) => {
      const m = new T.Mesh(nutG, nutM);
      m.position.set(x, y, z);
      G.add(m);
      nuts.push({ m, x, y, z, i, got: nutGot.indexOf(i) >= 0 });
      m.visible = !nuts[i].got;
    });
    spinners.push((t) => nuts.forEach((n) => { if (n.m.visible) { n.m.rotation.y = t * 2 + n.i; n.m.position.y = n.y + Math.sin(t * 3 + n.i) * 0.25; } }));

    // merge all the static coloured parts into two meshes
    const lm = new T.Mesh(U.merge(T, L), new T.MeshLambertMaterial({ vertexColors: true }));
    lm.castShadow = lm.receiveShadow = true;
    const sm = new T.Mesh(U.merge(T, S), new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.15 }));
    sm.castShadow = sm.receiveShadow = true;
    G.add(lm, sm);
    // clouds
    const clouds = [];
    for (let k = 0; k < 18; k++) { const a = (k / 18) * TAU; clouds.push({ x: Math.cos(a) * 320, y: 70 + (k % 3) * 20, z: Math.sin(a) * 320, sx: 30, sy: 10, sz: 18, ry: a }); }
    G.add(api.H.instanced(new T.IcosahedronGeometry(1, 2), new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x505860 }), clouds));
    hub.built = true;
  }

  /* ---------- enter / exit ---------- */
  hub.enter = function () {
    const api = EXT.api, T = api.H.THREE;
    if (!EXT.owned()) return false;
    if (!hub.built) build();
    const st = api.state;
    api.hideOverlay();
    saveLight = { bg: api.scene.background, fog: api.scene.fog, hs: api.hemi.color.getHex(), hg: api.hemi.groundColor.getHex(), hi: api.hemi.intensity, sc: api.sun.color.getHex(), si: api.sun.intensity, sd: api.sunDir.clone(), ai: api.ambient.intensity };
    api.scene.background = new T.Color(0x8fd0ff);
    api.scene.fog = new T.Fog(0xcfeaff, 160, 600);
    api.renderer.setClearColor(0x8fd0ff, 1);
    api.hemi.color.set(0xeaf6ff); api.hemi.groundColor.set(0x5a7a40); api.hemi.intensity = 0.78;
    api.sun.color.set(0xfff2dc); api.sun.intensity = 1.0; api.sunDir.set(120, 180, -60).normalize(); api.ambient.intensity = 0.3;
    if (api.trackGroup) api.trackGroup.visible = false;
    hiddenCars = [];
    api.cars.forEach((c) => { if (c !== api.player && c.vis.root.visible) { c.vis.root.visible = false; hiddenCars.push(c); } });
    api.scene.add(G);
    const p = api.player;
    Object.assign(p, { x: 0, z: -48, y: 0, yaw: Math.PI, speed: 0, steer: 0, steerVis: 0, damage: 0, roll: 0, pitch: 0, slope: 0, boostT: 0, shieldT: 0, vy: 0, air: false });
    api.applyVisualDamage(p);
    p.vis.root.visible = true;
    st.mode = 'hub';
    st.paused = false;
    hub.active = true;
    gateCd = 1.2;
    api.setRacingChrome(true);
    document.body.classList.add('inhub');
    api.snapCamera();
    EXT.ui.hubHud(true);
    EXT.ui.say('\uD83D\uDC22 TORTY: Welcome to the Super Grid Hub! Drive into the Garage to try a new car, or through a gate to race.', 6);
    return true;
  };
  hub.exit = function () {
    if (!hub.active) return;
    const api = EXT.api;
    hub.active = false;
    api.scene.remove(G);
    if (saveLight) {
      api.scene.background = saveLight.bg; api.scene.fog = saveLight.fog; api.renderer.setClearColor(saveLight.bg, 1);
      api.hemi.color.set(saveLight.hs); api.hemi.groundColor.set(saveLight.hg); api.hemi.intensity = saveLight.hi;
      api.sun.color.set(saveLight.sc); api.sun.intensity = saveLight.si; api.sunDir.copy(saveLight.sd); api.ambient.intensity = saveLight.ai;
    }
    if (api.trackGroup) api.trackGroup.visible = true;
    hiddenCars.forEach((c) => (c.vis.root.visible = !c.out));
    hiddenCars = [];
    document.body.classList.remove('inhub');
    roofs.forEach((r) => (r.visible = true));
    EXT.ui.hubHud(false);
    EXT.ui.prompt(null);
  };

  /* ---------- driving ---------- */
  function groundAt(x, z) {
    for (const r of ramps) {
      if (x < r.x0 || x > r.x1 || z < r.z0 || z > r.z1) continue;
      const t = r.dir > 0 ? (z - r.base) / r.len : (r.base - z) / r.len;
      return Math.max(0, Math.min(1, t)) * r.h + 0.2;
    }
    return 0;
  }
  function collide(c) {
    let hit = false;
    for (const k of colliders) {
      if (k.t === 'c') {
        const dx = c.x - k.x, dz = c.z - k.z, d = Math.hypot(dx, dz), m = k.r + 1.2;
        if (d < m && d > 1e-4) { c.x = k.x + (dx / d) * m; c.z = k.z + (dz / d) * m; hit = true; }
      } else {
        const m = 1.2;
        if (c.x > k.x0 - m && c.x < k.x1 + m && c.z > k.z0 - m && c.z < k.z1 + m && c.y < 9) {
          const pen = [c.x - (k.x0 - m), k.x1 + m - c.x, c.z - (k.z0 - m), k.z1 + m - c.z];
          const i = pen.indexOf(Math.min(...pen));
          if (i === 0) c.x = k.x0 - m; else if (i === 1) c.x = k.x1 + m; else if (i === 2) c.z = k.z0 - m; else c.z = k.z1 + m;
          hit = true;
        }
      }
    }
    const r = Math.hypot(c.x, c.z);
    if (r > R_EDGE - 1.5) { c.x *= (R_EDGE - 1.5) / r; c.z *= (R_EDGE - 1.5) / r; hit = true; }
    return hit;
  }
  hub.update = function (dt, inp) {
    const api = EXT.api, c = api.player, H = api.H;
    if (!hub.active) return;
    const vs = c.veh || { acc: 1, top: 1, grip: 1, off: 1 };
    const top = 38 * vs.top * (c.boostT > 0 ? 1.35 : 1);
    if (c.boostT > 0) c.boostT -= dt;
    let acc = 0;
    if (inp.th > 0) acc += (c.speed < 0 ? 40 : 26 * vs.acc) * inp.th;
    if (inp.br > 0) acc -= (c.speed > 0.5 ? 42 : 16) * inp.br;
    if (c.boostT > 0) acc += 30;
    c.speed += acc * dt;
    c.speed -= c.speed * (inp.th || inp.br ? 0.25 : 0.9) * dt;
    if (c.speed > top) c.speed = H.lerp(c.speed, top, 0.1);
    if (c.speed < -13) c.speed = -13;
    if (!inp.th && !inp.br && Math.abs(c.speed) < 0.3) c.speed = 0;
    const lim = 0.68 - Math.min(Math.abs(c.speed) / 85, 1) * 0.2;
    c.steerVis = H.lerp(c.steerVis, inp.st * lim, Math.min(1, 14 * dt));
    if (!c.air) {
      // reversing turns like a real car: the tail swings the way you steer
      const turn = c.steerVis * Math.min(1, Math.abs(c.speed) / 5) * 2.25 * 1.1 * vs.grip * Math.sign(c.speed || 1);
      c.yaw = H.wrapAng(c.yaw + turn * dt);
    }
    const px = c.x, pz = c.z;
    c.x += Math.sin(c.yaw) * c.speed * dt;
    c.z += Math.cos(c.yaw) * c.speed * dt;
    // ground / ramps / jumps
    const g = groundAt(c.x, c.z);
    if (c.air) {
      c.vy -= 24 * dt;
      c.y += c.vy * dt;
      if (c.y <= g) { c.y = g; c.air = false; if (c.vy < -8) { api.audioBeep(140, 0.12, 0.08); api.state.shake = Math.min(0.8, -c.vy * 0.04); } c.vy = 0; }
    } else {
      if (g - c.y > 0.8) { c.x = px; c.z = pz; c.speed *= -0.2; }
      else if (g < c.y - 0.15) { c.air = true; c.vy = Math.max(0, c.lastVy || 0); }
      else { c.lastVy = (g - c.y) / Math.max(dt, 1e-3); c.y = g; }
    }
    c.slope = c.air ? H.lerp(c.slope, H.clamp(c.vy / Math.max(8, Math.abs(c.speed)), -0.5, 0.5), 0.1) : H.lerp(c.slope, (groundAt(c.x + Math.sin(c.yaw), c.z + Math.cos(c.yaw)) - g), 0.3);
    if (collide(c)) { if (Math.abs(c.speed) > 10) api.audioBeep(180, 0.06, 0.05); c.speed *= 0.6; }
    c.roll = H.lerp(c.roll, -c.steerVis * H.clamp(Math.abs(c.speed) / 40, 0, 1) * 0.25, Math.min(1, 8 * dt));
    c.pitch = H.lerp(c.pitch, (inp.br - inp.th) * 0.05, Math.min(1, 8 * dt));
    c.throttle = inp.th;
    const wh = c.vis.wheels;
    if (c.vis.noSpin) { c.vis.body.position.y = Math.sin(performance.now() * 0.006) * 0.06; for (let i = 0; i < wh.length; i++) wh[i].rotation.y = i < 2 ? c.steerVis * 2 : 0; }
    else for (let i = 0; i < wh.length; i++) { wh[i].rotation.x += c.speed * dt * 1.65; if (i < 2) wh[i].rotation.y = c.steerVis * 4.5; }
    api.syncCarMesh(c);
    // triggers
    if (gateCd > 0) gateCd -= dt;
    let near = null;
    for (const p of pads) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d > p.r) continue;
      if (p.t === 'boost') { if (c.boostT < 0.5) { c.boostT = 1.2; api.audioBeep(880, 0.1, 0.06); EXT.ui.flash('BOOST!'); } }
      else near = p;
    }
    for (const n of nuts) {
      if (n.got) continue;
      if (Math.hypot(c.x - n.x, c.z - n.z) < 2.6 && Math.abs(c.y + 0.8 - n.m.position.y) < 2.6) {
        n.got = true; n.m.visible = false; nutGot.push(n.i); saveNuts();
        api.audioBeep(1320, 0.1, 0.07); api.audioBeep(1760, 0.16, 0.05);
        const cnt = nutGot.length;
        EXT.ui.flash('\uD83D\uDD29 ' + cnt + ' / 12');
        if (cnt >= 12) EXT.ui.say('\uD83C\uDFC6 All 12 Golden Lug Nuts! GOLD PAINT unlocked - pick it next to your car on the title screen.', 7);
        EXT.ui.hubHud(true);
      }
    }
    for (const gt of gates) {
      if (gateCd > 0) break;
      if (Math.abs(c.x - gt.x) < 6.5 && Math.abs(c.z - gt.z) < 1.6 && c.speed > 1) { gateCd = 3; hub.gate(gt); return; }
    }
    // prompts
    if (near && near.t === 'car') {
      const mine = (api.settings.car || 'f1') === near.v.id;
      EXT.ui.prompt(mine ? '\u2705 You are driving the ' + near.v.name : near.v.name + ' \u2014 ' + near.v.blurb, mine ? null : 'DRIVE IT', () => { EXT.ui.pickCar(near.v.id); EXT.ui.prompt(null); EXT.ui.flash(near.v.name + '!'); });
    } else if (near && near.t === 'chef') {
      EXT.ui.prompt('\uD83E\uDDC0 CHEF SQUEAKS: Welcome to the Pit Stop! Torty says the cheese fries make you 3% faster. (They don\u2019t. But they\u2019re yummy!)', null);
    } else if (near && near.t === 'torty') {
      EXT.ui.prompt('\uD83D\uDC22 TORTY: Hi, I\u2019m Martina \u2014 everyone calls me Torty! Drive through a gate to race. ' + (nutGot.length < 12 ? 'There are ' + (12 - nutGot.length) + ' Golden Lug Nuts still hidden - try the big ramps!' : 'You found every Golden Lug Nut!'), null);
    } else EXT.ui.prompt(null);
  };
  hub.gate = function (gt) {
    const api = EXT.api;
    api.player.speed = 0;
    if (!gt.track) { api.goTitle(); api.openTrackSelect(); return; }
    api.goTitle();
    api.selectTrack(gt.track);
    api.state.fromHub = true;
    api.startRace();
  };
  // camera stays inside buildings when you drive in; roofs hide so you can see
  hub.frame = function (t, dt) {
    if (!hub.active) return;
    const api = EXT.api, c = api.player, st = api.state, cam = api.camera;
    spinners.forEach((f) => f(t, dt));
    turntables.forEach((tt) => (tt.root.rotation.y = t * 0.4 + tt.k));
    let inside = null;
    for (const b of interiors) if (c.x > b.x0 && c.x < b.x1 && c.z > b.z0 && c.z < b.z1) inside = b;
    roofs.forEach((r) => (r.visible = !inside || inside.roof !== r));
    if (inside) {
      const m = 1.2;
      st.camX = Math.min(inside.x1 - m, Math.max(inside.x0 + m, st.camX));
      st.camZ = Math.min(inside.z1 - m, Math.max(inside.z0 + m, st.camZ));
      // when a wall pushes the camera close to the car, lift it up for an over-the-top view instead
      const d = Math.hypot(st.camX - c.x, st.camZ - c.z);
      if (d < 7) st.camY = Math.max(st.camY, c.y + 3.4 + (7 - d) * 0.55);
      st.camY = Math.min(inside.h - 1.2, st.camY);
      cam.position.set(st.camX, st.camY, st.camZ);
      const k = d < 7 ? (7 - d) / 7 : 0;
      cam.lookAt(st.lookX + (c.x - st.lookX) * k * 0.8, st.lookY + (c.y + 0.6 - st.lookY) * k * 0.8, st.lookZ + (c.z - st.lookZ) * k * 0.8);
    }
    EXT.ui.drawHubMap(c, gates, nuts, interiors);
  };
  hub._debug = () => ({ active: hub.active, nuts: nutGot.length, colliders: colliders.length, x: EXT.api.player.x, z: EXT.api.player.z, y: EXT.api.player.y, air: !!EXT.api.player.air });
})();
