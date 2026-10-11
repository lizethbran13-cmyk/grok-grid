'use strict';
/* Super Grid Expansion - boost pads + item gems.
 * Boost pads: drive over the glowing chevrons for a short burst.
 * Item gems: drive through one to get an item, then tap the ITEM button (or E / Q on a keyboard):
 *   TURBO (a big burst), TRIPLE TURBO (three bursts), SHIELD (6 s, walls and bumps do no damage), REPAIR (fixes the car).
 * Items only ever affect your own car, so online races stay in sync. */
(function () {
  const EXT = window.GRID_EXT;
  const U = EXT.U;
  const ITEMS = {
    turbo: { icon: '\uD83D\uDD25', name: 'TURBO' },
    turbo3: { icon: '\uD83D\uDD25\u00d73', name: 'TRIPLE TURBO' },
    shield: { icon: '\uD83D\uDEE1\uFE0F', name: 'SHIELD' },
    repair: { icon: '\uD83D\uDD27', name: 'REPAIR' },
  };
  const I = (EXT.items = { ITEMS, active: false, pads: [], rows: [], group: null });
  let gemMesh = null, glowMesh = null, padMat = null, gemList = [];

  // pick straights (low curvature) spread round the lap
  function straightIdx(H, count, phase) {
    const S = H.samples, N = H.SAMPLES;
    const curv = (i) => {
      let tot = 0;
      for (let k = 0; k < 10; k++) {
        const a = S[(i + k) % N], b = S[(i + k + 1) % N];
        tot += Math.abs(Math.atan2(a.tx * b.tz - a.tz * b.tx, a.tx * b.tx + a.tz * b.tz));
      }
      return tot;
    };
    const out = [];
    for (let c = 0; c < count; c++) {
      const want = Math.round(((c + phase) / count) * N);
      let best = want, bv = Infinity;
      for (let k = -Math.round(N / count / 3); k <= Math.round(N / count / 3); k++) {
        const i = (want + k + N) % N;
        if (i < 30 || i > N - 20) continue; // keep the start grid clear
        const v = curv(i);
        if (v < bv) { bv = v; best = i; }
      }
      out.push(best);
    }
    return out;
  }

  I.build = function (G, H) {
    const T = H.THREE, S = H.samples;
    I.pads = []; I.rows = []; gemList = [];
    const grp = new T.Group();
    grp.visible = false;
    I.group = grp;
    // boost pads: glowing chevron decals on the road
    const cv = document.createElement('canvas');
    cv.width = 64; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#1a0a2a'; g.fillRect(0, 0, 64, 128);
    for (let k = 0; k < 3; k++) {
      g.fillStyle = ['#ffe14a', '#ff8a00', '#ff3f8a'][k];
      g.beginPath(); const y = 18 + k * 36;
      g.moveTo(6, y + 26); g.lineTo(32, y); g.lineTo(58, y + 26); g.lineTo(46, y + 30); g.lineTo(32, y + 16); g.lineTo(18, y + 30); g.closePath(); g.fill();
    }
    const tex = new T.CanvasTexture(cv);
    tex.wrapT = T.RepeatWrapping;
    padMat = new T.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 });
    const pg = new T.PlaneGeometry(4.2, 7);
    pg.rotateX(-Math.PI / 2);
    straightIdx(H, 4, 0.55).forEach((i, k) => {
      const s = S[i];
      const lat = (k % 2 ? 1 : -1) * 3.2;
      const m = new T.Mesh(pg, padMat);
      m.position.set(s.x + s.nx * lat, s.y + 0.06, s.z + s.nz * lat);
      m.rotation.y = Math.atan2(s.tx, s.tz);
      grp.add(m);
      I.pads.push({ i, lat });
    });
    // item gem rows (4 across the road)
    straightIdx(H, 3, 0.2).forEach((i) => {
      const s = S[i];
      const row = { i, gems: [] };
      [-5.4, -1.8, 1.8, 5.4].forEach((lat) => {
        const gm = { x: s.x + s.nx * lat, y: s.y + 1.25, z: s.z + s.nz * lat, lat, cd: 0, row };
        row.gems.push(gm);
        gemList.push(gm);
      });
      I.rows.push(row);
    });
    // faceted crystal gems (stretched octahedron, flat shaded) with an additive glow shell
    const gg = new T.OctahedronGeometry(0.42, 0);
    gg.scale(1, 1.45, 1);
    gemMesh = new T.InstancedMesh(gg, new T.MeshStandardMaterial({ color: 0xffffff, roughness: 0.08, metalness: 0.2, flatShading: true, emissive: 0x2a2a3a }), gemList.length);
    gemMesh.frustumCulled = false;
    glowMesh = new T.InstancedMesh(gg, new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, blending: T.AdditiveBlending, depthWrite: false }), gemList.length);
    glowMesh.frustumCulled = false;
    const c = new T.Color();
    const hues = [0.55, 0.13, 0.85, 0.33];
    gemList.forEach((gm, k) => { c.setHSL(hues[k % 4], 1, 0.6); gemMesh.setColorAt(k, c); glowMesh.setColorAt(k, c); });
    grp.add(gemMesh, glowMesh);
    G.add(grp);
  };

  function giveItem(car, place, field) {
    const r = Math.random();
    const behind = field > 1 ? (place - 1) / (field - 1) : 0;
    if (car.damage > 35 && r < 0.4) return 'repair';
    if (r < 0.15 + behind * 0.3) return 'turbo3';
    if (r < 0.7) return 'turbo';
    if (r < 0.88) return 'shield';
    return car.damage > 10 ? 'repair' : 'turbo';
  }

  I.reset = function (on) {
    I.active = !!on;
    if (I.group) I.group.visible = I.active;
    gemList.forEach((g) => (g.cd = 0));
    const api = EXT.api;
    if (api) api.cars.forEach((c) => { c.item = null; c.itemUses = 0; c.boostT = 0; c.shieldT = 0; c.aiItemT = 0; });
    EXT.ui && EXT.ui.itemSlot(null);
  };

  I.use = function (car) {
    const api = EXT.api;
    if (!car.item || !I.active || api.state.mode !== 'race') return false;
    const it = car.item;
    if (it === 'turbo' || it === 'turbo3') {
      car.boostT = Math.max(car.boostT, 1.6);
      if (it === 'turbo3' && --car.itemUses > 0) {
        // keep the remaining uses
      } else car.item = null;
      if (car.isPlayer) { api.audioBeep(660, 0.12, 0.08); api.audioBeep(990, 0.18, 0.06); }
    } else if (it === 'shield') {
      car.shieldT = 6;
      car.item = null;
      if (car.isPlayer) api.audioBeep(520, 0.25, 0.08);
    } else if (it === 'repair') {
      car.damage = Math.max(0, car.damage - 45);
      api.applyVisualDamage && api.applyVisualDamage(car);
      car.item = null;
      if (car.isPlayer) api.audioBeep(780, 0.2, 0.08);
    }
    if (car.isPlayer) EXT.ui.itemSlot(car.item, car.itemUses);
    return true;
  };

  I.update = function (dt, racing) {
    if (!I.active) return;
    const api = EXT.api, H = api.H, N = H.SAMPLES;
    const live = api.cars.filter((c) => !c.out);
    for (const car of api.cars) {
      if (car.out || car.dnf || car.finished || (car.remote)) continue;
      // boost pads
      for (const p of I.pads) {
        let d = car.idx - p.i;
        if (d > N / 2) d -= N;
        if (d < -N / 2) d += N;
        if (d >= -1 && d <= 1 && Math.abs(car.lat - p.lat) < 2.4) {
          if (car.boostT < 0.9) {
            car.boostT = 1.15;
            if (car.isPlayer) { api.audioBeep(880, 0.1, 0.06); EXT.ui.flash('BOOST!'); }
          }
        }
      }
      // gems
      if (racing && !car.item) {
        for (const r of I.rows) {
          let d = car.idx - r.i;
          if (d > N / 2) d -= N;
          if (d < -N / 2) d += N;
          if (d < -2 || d > 2) continue;
          for (const gm of r.gems) {
            if (gm.cd > 0) continue;
            if (Math.abs(car.lat - gm.lat) < 1.9) {
              gm.cd = 3;
              car.item = giveItem(car, car.place, live.length);
              car.itemUses = car.item === 'turbo3' ? 3 : 1;
              car.aiItemT = 1 + Math.random() * 3;
              if (car.isPlayer) { api.audioBeep(1200, 0.08, 0.06); EXT.ui.itemSlot(car.item, car.itemUses); }
              break;
            }
          }
        }
      }
      // AI uses its item after a short think (turbos on straights)
      if (!car.isPlayer && car.item && racing) {
        car.aiItemT -= dt;
        if (car.aiItemT <= 0) { I.use(car); car.aiItemT = 0.8; }
      }
    }
    for (const gm of gemList) if (gm.cd > 0) gm.cd -= dt;
  };

  // visuals: spinning gems, scrolling pads, shields + boost flames
  const shields = new Map();
  let flame = null;
  I.frame = function (t, dt) {
    const api = EXT.api;
    if (!api) return;
    const T = api.H.THREE;
    if (I.active && gemMesh) {
      const o = I._o || (I._o = new T.Object3D());
      gemList.forEach((gm, k) => {
        const s = gm.cd > 0 ? Math.max(0.001, 1 - gm.cd / 0.4) * (gm.cd < 0.4 ? 1 : 0.001) : 1;
        o.position.set(gm.x, gm.y + Math.sin(t * 2.4 + k) * 0.25, gm.z);
        o.rotation.set(0, t * 1.6 + k, 0);
        o.scale.setScalar(gm.cd > 0 ? (gm.cd < 0.5 ? 1 - gm.cd * 2 : 0.001) : 1);
        o.updateMatrix();
        gemMesh.setMatrixAt(k, o.matrix);
        o.scale.multiplyScalar(1.55 + Math.sin(t * 5 + k) * 0.12);
        o.updateMatrix();
        glowMesh.setMatrixAt(k, o.matrix);
      });
      gemMesh.instanceMatrix.needsUpdate = true;
      glowMesh.instanceMatrix.needsUpdate = true;
      if (padMat) padMat.map.offset.y = -t * 1.5;
    }
    // shield bubbles + boost flames for every car
    if (!flame) {
      flame = new T.MeshBasicMaterial({ color: 0x7df3ff, transparent: true, opacity: 0.85, blending: T.AdditiveBlending, depthWrite: false });
    }
    for (const car of api.cars) {
      let sh = shields.get(car);
      const need = car.shieldT > 0 || car.boostT > 0;
      if (!sh && !need) continue;
      if (!sh) {
        const bub = new T.Mesh(new T.SphereGeometry(2.6, 20, 14), new T.MeshBasicMaterial({ color: 0x7df3ff, transparent: true, opacity: 0.22, depthWrite: false }));
        bub.scale.set(1, 0.6, 1.4);
        bub.position.y = 0.7;
        const fl = new T.Mesh(new T.ConeGeometry(0.35, 1.8, 10), flame);
        fl.rotation.x = -Math.PI / 2;
        fl.position.set(0, 0.55, -2.8);
        sh = { bub, fl, parent: null };
        shields.set(car, sh);
      }
      if (sh.parent !== car.vis.root) { car.vis.root.add(sh.bub, sh.fl); sh.parent = car.vis.root; }
      sh.bub.visible = car.shieldT > 0 && (car.shieldT > 1.2 || Math.sin(t * 20) > 0);
      sh.fl.visible = car.boostT > 0;
      if (sh.fl.visible) sh.fl.scale.set(1, 0.8 + Math.random() * 0.6, 1);
    }
  };
})();
