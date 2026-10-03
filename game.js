'use strict';

/* GROK GRID 2.0 — arcade open-wheel racer (THREE r128 global, tracks from tracks.js) */

(function () {
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const wrapAng = (a) => {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  };
  const fmtTime = (t) => {
    if (!isFinite(t) || t < 0) return '—';
    const m = Math.floor(t / 60);
    const s = t - m * 60;
    return m + ':' + s.toFixed(3).padStart(6, '0');
  };
  let seed = 1;
  const srand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const rand = (a, b) => a + Math.random() * (b - a);
  const srnd = (a, b) => a + srand() * (b - a);
  const pick = (arr) => arr[(Math.random() * arr.length) | 0];

  const { TRACKS, elevAt, controlPoints } = window.GRID_TRACKS;
  const FIELD = 5;
  // online play (grid-online.js): remote cars are driven by the network, not the AI / physics
  const net = () => (window.GridNet && window.GridNet.active ? window.GridNet : null);
  const CAR_RADIUS = 1.35;
  const MAX_DAMAGE = 100;
  const POINTS = [10, 6, 4, 2, 1];

  const DIFFS = {
    easy: { label: 'EASY', pace: 0.88, corner: 0.82, power: 0.955, brake: 0.8, spread: 0.03, boost: 0.03, slow: 0.12 },
    normal: { label: 'NORMAL', pace: 0.955, corner: 0.9, power: 1.0, brake: 0.92, spread: 0.02, boost: 0.06, slow: 0.05 },
    hard: { label: 'HARD', pace: 1.0, corner: 0.965, power: 1.03, brake: 1.0, spread: 0.012, boost: 0.08, slow: 0.025 },
    pilot: { label: 'PILOT', pace: 1.0, corner: 0.965, power: 1.0, brake: 1.0, spread: 0, boost: 0, slow: 0 },
  };

  // per-track mutable geometry state
  let TR = TRACKS[0];
  let TOTAL_LAPS = 3;
  let TRACK_HALF = 8.2;
  let WALL_DIST = 16.4;
  let SAMPLES = 640;
  let samples = [];
  let TRACK_LEN = 1;
  let DS = 4.5;
  let minX = 0, maxX = 1, minZ = 0, maxZ = 1;
  let line = null; // racing line {off, k, v}
  let trackGroup = null;
  let lightsArr = [];
  let weather = null;

  /* ---------- DOM ---------- */
  const el = (id) => document.getElementById(id);
  const canvas = el('c');
  const miniCv = el('minimap');
  const miniCtx = miniCv.getContext('2d');
  const hud = el('hud');
  const lapEl = el('lap');
  const posEl = el('pos');
  const laptimeEl = el('laptime');
  const bestEl = el('best');
  const speedEl = el('speed');
  const gearEl = el('gear');
  const dmgFill = el('dmg-fill');
  const dmgTxt = el('dmg-txt');
  const raceTimeEl = el('race-time');
  const trackNameEl = el('track-name');
  const countdownEl = el('countdown');
  const lapFlashEl = el('lap-flash');
  const impactEl = el('impact');
  const muteBtn = el('mute');
  const pauseBtn = el('pause');
  const touchUI = el('touch-ui');
  const steerPad = el('steer-pad');
  const steerStick = el('steer-stick');
  const btnBrake = el('btn-brake');
  const btnAccel = el('btn-accel');
  const overlay = el('overlay');
  const cards = {
    title: el('title-card'),
    track: el('track-card'),
    champ: el('champ-card'),
    pause: el('pause-card'),
    finish: el('finish-card'),
    dnf: el('dnf-card'),
  };
  const titleBest = el('title-best');
  const finishKicker = el('finish-kicker');
  const finishTitle = el('finish-title');
  const finishMsg = el('finish-msg');
  const finishStats = el('finish-stats');
  const retryBtn = el('retry-btn');
  const finishMenuBtn = el('finish-menu-btn');
  const dnfMsg = el('dnf-msg');
  const dnfStats = el('dnf-stats');
  const dnfRetryBtn = el('dnf-retry-btn');
  const dnfMenuBtn = el('dnf-menu-btn');

  const LS_SET = 'grokgrid2_settings';
  const LS_CHAMP = 'grokgrid2_champ';
  const lapKey = (id) => 'grokgrid2_lap_' + id;
  const raceKey = (id, laps) => 'grokgrid2_race_' + id + '_' + laps;

  const isTouch =
    window.matchMedia('(pointer: coarse)').matches ||
    'ontouchstart' in window ||
    navigator.maxTouchPoints > 0;
  if (isTouch) document.body.classList.add('touch');

  /* ---------- renderer / scene ---------- */
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: !isTouch,
    powerPreference: 'high-performance',
    alpha: false,
  });
  let pixelRatio = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = !isTouch;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x6fa3c8);
  scene.fog = new THREE.Fog(0x8eb6d0, 140, 520);

  const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.2, 1400);
  camera.position.set(0, 8, -16);

  const hemi = new THREE.HemisphereLight(0xcfe6ff, 0x3d4a28, 0.62);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 0.95);
  const sunDir = new THREE.Vector3(120, 160, 60).normalize();
  sun.castShadow = !isTouch;
  if (sun.castShadow) {
    sun.shadow.mapSize.set(2048, 2048);
    const s = 110;
    sun.shadow.camera.left = -s;
    sun.shadow.camera.right = s;
    sun.shadow.camera.top = s;
    sun.shadow.camera.bottom = -s;
    sun.shadow.camera.near = 20;
    sun.shadow.camera.far = 520;
    sun.shadow.bias = -0.0004;
  }
  scene.add(sun);
  scene.add(sun.target);
  const ambient = new THREE.AmbientLight(0x6a7a90, 0.22);
  scene.add(ambient);

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------- textures ---------- */
  function noiseTex(size, base, speckle) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < size * size * 0.35; i++) {
      const v = (Math.random() * 40) | 0;
      g.fillStyle = 'rgba(' + v + ',' + v + ',' + v + ',' + speckle + ')';
      g.fillRect((Math.random() * size) | 0, (Math.random() * size) | 0, 2, 2);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  }

  function checkTex() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const n = 8;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#f4f7ff' : '#111218';
        g.fillRect((x * 64) / n, (y * 64) / n, 64 / n + 0.5, 64 / n + 0.5);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.magFilter = THREE.NearestFilter;
    return t;
  }

  function windowTex(night) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 128;
    const g = c.getContext('2d');
    g.fillStyle = night ? '#0b0f1c' : '#c9ced6';
    g.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 124; y += 10) {
      for (let x = 4; x < 60; x += 10) {
        const lit = Math.random();
        if (night) g.fillStyle = lit < 0.45 ? '#ffd27a' : lit < 0.6 ? '#7ff3ff' : '#161c2c';
        else g.fillStyle = lit < 0.5 ? '#4a6a8a' : '#6d8fb0';
        g.fillRect(x, y, 6, 6);
      }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  const flagMap = checkTex();

  /* ---------- track geometry ---------- */
  const layoutCache = {};
  function computeLayout(track) {
    if (layoutCache[track.id]) return layoutCache[track.id];
    const cp = controlPoints(track);
    const curve = new THREE.CatmullRomCurve3(
      cp.map(([x, z]) => new THREE.Vector3(x, 0, z)),
      true,
      track.pts ? 'catmullrom' : 'centripetal',
      track.tension || 0.5
    );
    curve.arcLengthDivisions = 2400;
    const len = curve.getLength();
    const N = Math.max(240, Math.round(len / 4.5));
    const out = new Array(N);
    let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity;
    for (let i = 0; i < N; i++) {
      const t = i / N;
      const p = curve.getPointAt(t);
      const tan = curve.getTangentAt(t);
      tan.y = 0;
      tan.normalize();
      const y = elevAt(track, t);
      out[i] = { t, x: p.x, y, z: p.z, tx: tan.x, tz: tan.z, nx: -tan.z, nz: tan.x, slope: 0 };
      if (p.x < bx0) bx0 = p.x;
      if (p.x > bx1) bx1 = p.x;
      if (p.z < bz0) bz0 = p.z;
      if (p.z > bz1) bz1 = p.z;
    }
    const ds = len / N;
    for (let i = 0; i < N; i++) out[i].slope = (out[(i + 1) % N].y - out[i].y) / ds;
    const res = { samples: out, len, N, ds, minX: bx0, maxX: bx1, minZ: bz0, maxZ: bz1 };
    layoutCache[track.id] = res;
    return res;
  }

  function sampleAt(idx) {
    return samples[((idx % SAMPLES) + SAMPLES) % SAMPLES];
  }

  function nearestIdx(x, z, hint) {
    const base = (((hint | 0) % SAMPLES) + SAMPLES) % SAMPLES;
    let best = base;
    let bestD = Infinity;
    const win = 28;
    for (let k = -win; k <= win; k++) {
      const idx = (base + k + SAMPLES) % SAMPLES;
      const s = samples[idx];
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < bestD) {
        bestD = d;
        best = idx;
      }
    }
    if (bestD > 90 * 90) {
      for (let i = 0; i < SAMPLES; i += 2) {
        const s = samples[i];
        const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
    }
    return best;
  }

  // distance from (x,z) to the closest centreline sample (full scan; scenery placement only)
  function trackDist(x, z) {
    let bestD = Infinity, bi = 0;
    for (let i = 0; i < SAMPLES; i++) {
      const s = samples[i];
      const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
      if (d < bestD) {
        bestD = d;
        bi = i;
      }
    }
    return { d: Math.sqrt(bestD), i: bi };
  }

  function pointSide(idx, offset) {
    const s = sampleAt(idx);
    return { x: s.x + s.nx * offset, z: s.z + s.nz * offset, yaw: Math.atan2(s.tx, s.tz) };
  }

  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach((m) => {
          if (m.map && m.map !== flagMap) m.map.dispose();
          m.dispose();
        });
      }
    });
  }

  function buildStrip(innerW, outerW, yOff, colorFn) {
    const segs = SAMPLES;
    const pos = new Float32Array(segs * 2 * 3);
    const nrm = new Float32Array(segs * 2 * 3);
    const uv = new Float32Array(segs * 2 * 2);
    const col = colorFn ? new Float32Array(segs * 2 * 3) : null;
    const rep = segs; // one texture row per sample (~4.5 m)
    for (let i = 0; i < segs; i++) {
      const s = samples[i];
      const v = i / segs;
      const i3 = i * 6;
      const i2 = i * 4;
      pos[i3] = s.x + s.nx * innerW;
      pos[i3 + 1] = s.y + yOff;
      pos[i3 + 2] = s.z + s.nz * innerW;
      pos[i3 + 3] = s.x + s.nx * outerW;
      pos[i3 + 4] = s.y + yOff;
      pos[i3 + 5] = s.z + s.nz * outerW;
      nrm[i3] = nrm[i3 + 3] = -s.tx * s.slope;
      nrm[i3 + 1] = nrm[i3 + 4] = 1;
      nrm[i3 + 2] = nrm[i3 + 5] = -s.tz * s.slope;
      uv[i2] = 0;
      uv[i2 + 1] = v * rep;
      uv[i2 + 2] = 1;
      uv[i2 + 3] = v * rep;
      if (col) {
        const c = colorFn(i);
        col[i3] = col[i3 + 3] = c.r;
        col[i3 + 1] = col[i3 + 4] = c.g;
        col[i3 + 2] = col[i3 + 5] = c.b;
      }
    }
    const idx = [];
    for (let i = 0; i < segs; i++) {
      const a = i * 2;
      const b = a + 1;
      const c = ((i + 1) % segs) * 2;
      const d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(idx);
    return geo;
  }

  function buildWalls(dist, height, colors, glow, bottom) {
    const pal = colors.map((c) => new THREE.Color(c));
    function side(sign) {
      const pos = [];
      const col = [];
      const idx = [];
      for (let i = 0; i < SAMPLES; i++) {
        const s = samples[i];
        const s2 = sampleAt(i + 1);
        const x1 = s.x + s.nx * dist * sign;
        const z1 = s.z + s.nz * dist * sign;
        const x2 = s2.x + s2.nx * dist * sign;
        const z2 = s2.z + s2.nz * dist * sign;
        const base = pos.length / 3;
        const b1 = bottom == null ? s.y : s.y - bottom;
        const b2 = bottom == null ? s2.y : s2.y - bottom;
        pos.push(x1, b1, z1, x2, b2, z2, x2, s2.y + height, z2, x1, s.y + height, z1);
        const band = ((i / 6) | 0) % pal.length;
        const cc = pal[band];
        for (let k = 0; k < 4; k++) col.push(cc.r, cc.g, cc.b);
        if (sign > 0) idx.push(base, base + 2, base + 1, base, base + 3, base + 2);
        else idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      return geo;
    }
    const mat = glow
      ? new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })
      : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide });
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(side(1), mat);
    const m2 = new THREE.Mesh(side(-1), mat);
    m1.castShadow = m2.castShadow = !glow;
    m1.receiveShadow = m2.receiveShadow = !glow;
    g.add(m1, m2);
    return g;
  }

  function instanced(geo, mat, list, opts) {
    if (!list.length) return new THREE.Group();
    const m = new THREE.InstancedMesh(geo, mat, list.length);
    const o = new THREE.Object3D();
    o.rotation.order = 'YXZ';
    const c = new THREE.Color();
    list.forEach((it, i) => {
      o.position.set(it.x, it.y || 0, it.z);
      o.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      o.scale.set(it.sx || 1, it.sy || it.sx || 1, it.sz || it.sx || 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
      if (it.color != null) {
        c.set(it.color);
        m.setColorAt(i, c);
      }
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.castShadow = !!(opts && opts.cast);
    m.receiveShadow = !!(opts && opts.receive);
    return m;
  }

  // scatter points beside the track: returns [{x,z,y,d,i,side}]
  function scatter(count, dMin, dMax, minClear) {
    const res = [];
    let guard = 0;
    while (res.length < count && guard++ < count * 6) {
      const i = (srand() * SAMPLES) | 0;
      const s = samples[i];
      const sign = srand() < 0.5 ? 1 : -1;
      const d = srnd(dMin, dMax);
      const x = s.x + s.nx * d * sign;
      const z = s.z + s.nz * d * sign;
      const td = trackDist(x, z);
      if (td.d < WALL_DIST + minClear) continue;
      res.push({ x, z, y: samples[td.i].y, d: td.d, i: td.i, side: sign });
    }
    return res;
  }

  // terrain heightfield that hugs elevated tracks (also returns a height lookup for scenery)
  function buildTerrain(theme, farH) {
    const pad = 260;
    const x0 = minX - pad, x1 = maxX + pad, z0 = minZ - pad, z1 = maxZ + pad;
    const nx = isTouch ? 90 : 130;
    const nz = Math.max(40, Math.round((nx * (z1 - z0)) / (x1 - x0)));
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0, nx, nz);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const cols = new Float32Array(pos.count * 3);
    const cLow = new THREE.Color(theme.groundTint);
    const cHigh = new THREE.Color(theme.terrainHigh || theme.groundTint);
    const cRock = new THREE.Color(theme.rock || 0x8a8f99);
    const tmp = new THREE.Color();
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v) + cx;
      const z = pos.getZ(v) + cz;
      let bestD = Infinity, bi = 0;
      for (let i = 0; i < SAMPLES; i += 2) {
        const s = samples[i];
        const d = (s.x - x) * (s.x - x) + (s.z - z) * (s.z - z);
        if (d < bestD) {
          bestD = d;
          bi = i;
        }
      }
      const d = Math.sqrt(bestD);
      const sy = samples[bi].y;
      let h;
      if (d < WALL_DIST + 3) h = sy - 0.7;
      else {
        const road = sy - 0.7 - (d - WALL_DIST - 3) * (theme.bankSlope || 0.3);
        h = Math.max(road, farH(x, z, d));
      }
      pos.setY(v, h);
      const steep = clamp((h - sy + 0.7) / 30, 0, 1);
      tmp.copy(cLow).lerp(cHigh, clamp(h / 60, 0, 1));
      if (theme.rock && d > WALL_DIST + 8) tmp.lerp(cRock, steep * 0.6);
      cols[v * 3] = tmp.r;
      cols[v * 3 + 1] = tmp.g;
      cols[v * 3 + 2] = tmp.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.position.set(cx, 0, cz);
    mesh.receiveShadow = true;
    return mesh;
  }

  function computeRacingLine() {
    const N = SAMPLES;
    const lim = TRACK_HALF - 1.8;
    const off = new Float32Array(N);
    const px = (i) => samples[i].x + samples[i].nx * off[i];
    const pz = (i) => samples[i].z + samples[i].nz * off[i];
    // shortest-path relaxation at decreasing stencil sizes (fast convergence)
    for (const k of [12, 8, 5, 3, 2, 1]) {
      const iters = k === 1 ? 160 : 90;
      for (let it = 0; it < iters; it++) {
        for (let i = 0; i < N; i++) {
          const a = (i - k + N) % N;
          const b = (i + k) % N;
          const mx = (px(a) + px(b)) / 2;
          const mz = (pz(a) + pz(b)) / 2;
          const s = samples[i];
          off[i] = clamp((mx - s.x) * s.nx + (mz - s.z) * s.nz, -lim, lim);
        }
      }
    }
    // spread the apexes a little (closer to a minimum-curvature line)
    const tmp = new Float32Array(N);
    for (let pass = 0; pass < 6; pass++) {
      for (let i = 0; i < N; i++) {
        let acc = 0;
        for (let k = -3; k <= 3; k++) acc += off[(i + k + N) % N];
        tmp[i] = clamp(acc / 7, -lim, lim);
      }
      off.set(tmp);
    }
    // signed curvature of the racing line
    const kap = new Float32Array(N);
    const st = 3;
    for (let i = 0; i < N; i++) {
      const a = (i - st + N) % N;
      const b = (i + st) % N;
      const ax = px(a), az = pz(a), bx = px(i), bz = pz(i), cx = px(b), cz = pz(b);
      const ab = Math.hypot(bx - ax, bz - az);
      const bc = Math.hypot(cx - bx, cz - bz);
      const ac = Math.hypot(cx - ax, cz - az);
      const cross = (bx - ax) * (cz - az) - (bz - az) * (cx - ax);
      kap[i] = ab * bc * ac > 1e-6 ? (2 * cross) / (ab * bc * ac) : 0;
    }
    const ks = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      let m = 0;
      for (let k = -2; k <= 2; k++) m = Math.max(m, Math.abs(kap[(i + k + N) % N]));
      ks[i] = m;
    }
    line = { off, k: ks, ksign: kap, v: new Float32Array(N), vp: new Float32Array(N), diff: null };
  }

  // speed profile from the car's own steering limit: v*kappa <= 2.25*(0.52 - 0.3*v/85)*m,
  // then a backward pass so every corner gets a proper braking point.
  function computeSpeedProfile(dset, target) {
    const N = SAMPLES;
    const v = target || line.v;
    const m = dset.corner;
    for (let i = 0; i < N; i++) v[i] = Math.min(80, (1.17 * m) / (line.k[i] + 0.00794 * m));
    const aB = 64 * dset.brake;
    for (let pass = 0; pass < 2; pass++) {
      for (let i = N - 1; i >= 0; i--) {
        const nxt = v[(i + 1) % N];
        const lim = Math.sqrt(nxt * nxt + 2 * aB * DS);
        if (v[i] > lim) v[i] = lim;
      }
    }
    if (!target) line.diff = dset;
  }

  function buildTrack(track) {
    if (trackGroup) {
      scene.remove(trackGroup);
      disposeGroup(trackGroup);
    }
    TR = track;
    const th = track.theme;
    const L = computeLayout(track);
    samples = L.samples;
    SAMPLES = L.N;
    TRACK_LEN = L.len;
    DS = L.ds;
    minX = L.minX;
    maxX = L.maxX;
    minZ = L.minZ;
    maxZ = L.maxZ;
    TRACK_HALF = track.half;
    WALL_DIST = track.wall;
    seed = 1000 + track.id.length * 77 + track.id.charCodeAt(0);
    const elevated = !!track.elev;

    const G = new THREE.Group();
    trackGroup = G;

    scene.background = new THREE.Color(th.sky);
    scene.fog = new THREE.Fog(th.fog, th.fogNear, th.fogFar);
    renderer.setClearColor(th.sky, 1);
    hemi.color.set(th.hemiSky);
    hemi.groundColor.set(th.hemiGround);
    hemi.intensity = th.hemiI;
    sun.color.set(th.sunColor);
    sun.intensity = th.sunI;
    sunDir.set(th.sunDir[0], th.sunDir[1], th.sunDir[2]).normalize();
    ambient.intensity = th.ambient;

    // road surfaces
    const asphaltMap = noiseTex(256, th.asphalt, 0.18);
    asphaltMap.repeat.set(2, 0.5);
    const asphalt = new THREE.Mesh(
      buildStrip(-TRACK_HALF, TRACK_HALF, 0.02),
      new THREE.MeshStandardMaterial({
        map: asphaltMap,
        color: th.asphaltTint,
        roughness: th.night ? 0.6 : 0.92,
        metalness: th.night ? 0.2 : 0.05,
        emissive: th.night ? 0x0c1020 : 0x000000,
      })
    );
    asphalt.receiveShadow = true;
    G.add(asphalt);

    const runMap = noiseTex(128, th.runoff, 0.16);
    runMap.repeat.set(1, 0.5);
    const runMat = new THREE.MeshStandardMaterial({ map: runMap, color: th.runoffTint, roughness: 1, metalness: 0 });
    const r1 = new THREE.Mesh(buildStrip(TRACK_HALF, WALL_DIST + 0.2, 0.01), runMat);
    const r2 = new THREE.Mesh(buildStrip(-(WALL_DIST + 0.2), -TRACK_HALF, 0.01), runMat);
    r1.receiveShadow = r2.receiveShadow = true;
    G.add(r1, r2);

    const ca = new THREE.Color(th.curb[0]);
    const cb = new THREE.Color(th.curb[1]);
    const curbCol = (i) => (((i / 3) | 0) % 2 ? ca : cb);
    const curbMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    G.add(
      new THREE.Mesh(buildStrip(TRACK_HALF - 0.15, TRACK_HALF + 0.85, 0.04, curbCol), curbMat),
      new THREE.Mesh(buildStrip(-(TRACK_HALF + 0.85), -(TRACK_HALF - 0.15), 0.04, curbCol), curbMat)
    );

    G.add(buildWalls(WALL_DIST, th.wallH, th.walls, !!th.wallGlow, elevated ? 1.5 : null));

    // dashed centre line (one instanced draw call)
    {
      const list = [];
      for (let i = 0; i < SAMPLES; i += 6) {
        const s = samples[i];
        list.push({ x: s.x, y: s.y + 0.045, z: s.z, ry: Math.atan2(s.tx, s.tz), rx: -Math.atan(s.slope) });
      }
      const dashMat = th.night
        ? new THREE.MeshBasicMaterial({ color: th.line })
        : new THREE.MeshStandardMaterial({ color: th.line, roughness: 0.6 });
      G.add(instanced(new THREE.BoxGeometry(0.18, 0.03, 2.2), dashMat, list));
    }

    // start/finish band
    {
      const s0 = samples[0];
      const geo = new THREE.PlaneGeometry(TRACK_HALF * 2, 3.2);
      geo.rotateX(-Math.PI / 2);
      const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: flagMap, roughness: 0.7, metalness: 0 }));
      mesh.position.set(s0.x + s0.tx * 2, s0.y + 0.05, s0.z + s0.tz * 2);
      mesh.rotation.y = Math.atan2(s0.tx, s0.tz);
      G.add(mesh);
    }

    // start gantry with lights
    lightsArr = [];
    {
      const s = samples[0];
      const g = new THREE.Group();
      const poleMat = new THREE.MeshStandardMaterial({ color: 0x1a1e28, metalness: 0.6, roughness: 0.35 });
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(new THREE.BoxGeometry(0.45, 8.5, 0.45), poleMat);
        pole.position.set((TRACK_HALF + 3) * side, 4.25, 0);
        pole.castShadow = true;
        g.add(pole);
      }
      const beam = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF * 2 + 8, 0.5, 1.4), poleMat);
      beam.position.y = 8.4;
      g.add(beam);
      const board = new THREE.Mesh(
        new THREE.BoxGeometry(TRACK_HALF * 2 + 4, 1.1, 0.2),
        new THREE.MeshStandardMaterial({ color: 0x0b0e16, roughness: 0.5 })
      );
      board.position.set(0, 7.6, 0.6);
      g.add(board);
      for (let i = 0; i < 5; i++) {
        const bulb = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 10, 8),
          new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0x220000, roughness: 0.4 })
        );
        bulb.position.set(-3.2 + i * 1.6, 7.6, 0.75);
        g.add(bulb);
        lightsArr.push(bulb);
      }
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(8, 1.4, 0.15),
        new THREE.MeshStandardMaterial({ color: 0xff4a1c, emissive: 0x4a1208, roughness: 0.45 })
      );
      sign.position.set(0, 9.3, 0);
      g.add(sign);
      g.position.set(s.x - s.tx * 4, s.y, s.z - s.tz * 4);
      g.rotation.y = Math.atan2(s.tx, s.tz);
      G.add(g);
    }

    // grandstand near S/F
    {
      const s = sampleAt(Math.round(40 / DS));
      const side = track.id === 'park' ? 1 : -1;
      const stand = new THREE.Group();
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(48, 10, 8),
        new THREE.MeshStandardMaterial({ color: th.night ? 0x2a3044 : 0xcfd5de, roughness: 0.7 })
      );
      base.position.y = 5;
      const seats = new THREE.Mesh(
        new THREE.BoxGeometry(46, 8, 6),
        new THREE.MeshStandardMaterial({ color: th.night ? 0xff2d9a : 0x1c4a8a, roughness: 0.6, emissive: th.night ? 0x40102a : 0x000000 })
      );
      seats.position.set(0, 6, -1.2);
      stand.add(base, seats);
      const d = WALL_DIST + 10;
      stand.position.set(s.x + s.nx * d * side, s.y - 1, s.z + s.nz * d * side);
      stand.rotation.y = Math.atan2(s.tx, s.tz) + (side < 0 ? Math.PI : 0);
      base.castShadow = true;
      G.add(stand);
    }

    // flat ground (under the terrain on elevated tracks)
    const groundMap = noiseTex(256, th.ground, 0.2);
    groundMap.repeat.set(90, 90);
    const flat = new THREE.Mesh(
      new THREE.PlaneGeometry(2600, 2600),
      new THREE.MeshStandardMaterial({ map: groundMap, color: th.groundTint, roughness: 1 })
    );
    flat.rotation.x = -Math.PI / 2;
    flat.position.set((minX + maxX) / 2, elevated ? -2 : -0.02, (minZ + maxZ) / 2);
    flat.receiveShadow = true;
    G.add(flat);

    buildScenery(G, th);

    scene.add(G);
    computeRacingLine();
    computeSpeedProfile(DIFFS[settings.diff] || DIFFS.normal);
    computeSpeedProfile(DIFFS.pilot, line.vp); // test autopilot profile
    setStartLights(0);
  }

  /* ---------- scenery per theme ---------- */
  function buildScenery(G, th) {
    const kind = th.scenery;
    const cx0 = (minX + maxX) / 2;
    const cz0 = (minZ + maxZ) / 2;
    weather = null;
    if (kind === 'park') {
      const hills = [];
      for (let i = 0; i < 18; i++) {
        const ang = (i / 18) * TAU;
        const r = srnd(280, 420);
        const sc = srnd(28, 70);
        hills.push({ x: Math.cos(ang) * r + cx0, y: -20, z: Math.sin(ang) * r + cz0, sx: sc, sy: sc * srnd(0.25, 0.5), sz: sc });
      }
      G.add(instanced(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial({ color: 0x4d8a42 }), hills));
      addTrees(G, 70, 0x2f7a32, false);
    } else if (kind === 'city') {
      const tex = windowTex(false);
      tex.repeat.set(2, 3);
      const list = [];
      const pal = [0xd8d2c4, 0xb8c4d0, 0xe0b090, 0x9aa8b8, 0xcfd8e0, 0xc89878, 0xf0ece0];
      for (let i = 0; i < SAMPLES; i += 3) {
        const s = samples[i];
        for (const sign of [-1, 1]) {
          if (srand() < 0.25) continue;
          const d = WALL_DIST + srnd(9, 16);
          const x = s.x + s.nx * d * sign;
          const z = s.z + s.nz * d * sign;
          const w = srnd(10, 18);
          if (trackDist(x, z).d < WALL_DIST + w * 0.5 + 2) continue;
          const h = srnd(14, 60);
          list.push({ x, y: h / 2, z, sx: w, sy: h, sz: srnd(10, 18), ry: Math.atan2(s.tx, s.tz), color: pal[(srand() * pal.length) | 0] });
        }
      }
      for (let i = 0; i < 70; i++) {
        const a = srand() * TAU;
        const r = srnd(420, 620);
        const h = srnd(40, 140);
        list.push({ x: cx0 + Math.cos(a) * r, y: h / 2, z: cz0 + Math.sin(a) * r, sx: srnd(20, 40), sy: h, sz: srnd(20, 40), color: pal[(srand() * pal.length) | 0] });
      }
      G.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ map: tex }), list, { receive: true }));
      const water = new THREE.Mesh(
        new THREE.PlaneGeometry(2600, 900),
        new THREE.MeshStandardMaterial({ color: 0x2f6f9a, roughness: 0.25, metalness: 0.3 })
      );
      water.rotation.x = -Math.PI / 2;
      water.position.set(cx0, 0.02, minZ - 470);
      G.add(water);
      const posts = [];
      for (let i = 0; i < SAMPLES; i += 4) {
        const s = samples[i];
        for (const sign of [-1, 1]) posts.push({ x: s.x + s.nx * (WALL_DIST + 0.3) * sign, y: 2.6, z: s.z + s.nz * (WALL_DIST + 0.3) * sign });
      }
      G.add(instanced(new THREE.BoxGeometry(0.12, 3, 0.12), new THREE.MeshLambertMaterial({ color: 0x555a63 }), posts));
      addLamps(G, 14, 0xfff2c0, false);
    } else if (kind === 'canyon') {
      G.add(
        buildTerrain(Object.assign({ terrainHigh: 0xc0703a, rock: 0xa0502a, bankSlope: 0.35 }, th), (x, z, d) => {
          const ridge = d > 70 ? (Math.sin(x * 0.012) + Math.cos(z * 0.015) + 0.6) * 18 * clamp((d - 70) / 120, 0, 1) : 0;
          return Math.max(0, ridge);
        })
      );
      const mesas = [];
      const pal = [0xb4532a, 0xc8663a, 0x9c4424, 0xd47a48];
      scatter(26, WALL_DIST + 30, WALL_DIST + 130, 22).forEach((p) => {
        const w = srnd(14, 34);
        const h = srnd(20, 55);
        mesas.push({ x: p.x, y: h / 2 - 2, z: p.z, sx: w, sy: h, sz: w * srnd(0.7, 1.3), ry: srand() * TAU, color: pal[(srand() * 4) | 0] });
      });
      for (let i = 0; i < 26; i++) {
        const a = srand() * TAU;
        const r = srnd(450, 650);
        const w = srnd(40, 90);
        const h = srnd(50, 120);
        mesas.push({ x: cx0 + Math.cos(a) * r, y: h / 2 - 4, z: cz0 + Math.sin(a) * r, sx: w, sy: h, sz: w, ry: srand() * TAU, color: pal[(srand() * 4) | 0] });
      }
      G.add(instanced(new THREE.CylinderGeometry(0.85, 1, 1, 7), new THREE.MeshLambertMaterial({ color: 0xffffff }), mesas, { receive: true }));
      const cacti = [];
      const arms = [];
      scatter(110, WALL_DIST + 3, WALL_DIST + 40, 2).forEach((p) => {
        const h = srnd(2.5, 5);
        cacti.push({ x: p.x, y: p.y + h / 2 - 0.6, z: p.z, sx: 1, sy: h, sz: 1 });
        if (srand() < 0.7) arms.push({ x: p.x + 0.55, y: p.y + h * 0.55, z: p.z, sx: 0.8, sy: 1.4, sz: 0.8, rz: -0.25 });
      });
      const cMat = new THREE.MeshLambertMaterial({ color: 0x4f8a3a });
      G.add(instanced(new THREE.CylinderGeometry(0.32, 0.38, 1, 7), cMat, cacti, { cast: true }));
      G.add(instanced(new THREE.CylinderGeometry(0.22, 0.26, 1, 6), cMat, arms));
      const rocks = scatter(80, WALL_DIST + 2, WALL_DIST + 60, 1).map((p) => ({
        x: p.x, y: p.y - 0.4, z: p.z, sx: srnd(0.8, 2.6), sy: srnd(0.6, 1.6), sz: srnd(0.8, 2.6), ry: srand() * 3, color: pal[(srand() * 4) | 0],
      }));
      G.add(instanced(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), rocks));
    } else if (kind === 'alpine') {
      G.add(
        buildTerrain(Object.assign({ terrainHigh: 0xffffff, rock: 0x7d8796, bankSlope: 0.28 }, th), (x, z, d) => {
          const m = clamp((d - 60) / 160, 0, 1);
          const n = Math.sin(x * 0.009 + 1.3) * Math.cos(z * 0.011) + Math.sin(x * 0.021 + z * 0.017) * 0.5 + 0.7;
          return Math.max(0, n * 70 * m);
        })
      );
      addTrees(G, 140, 0x1f4d2e, true);
      const n = isTouch ? 350 : 700;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        pos[i * 3] = rand(-60, 60);
        pos[i * 3 + 1] = rand(0, 40);
        pos[i * 3 + 2] = rand(-60, 60);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, transparent: true, opacity: 0.85, depthWrite: false }));
      pts.frustumCulled = false;
      G.add(pts);
      weather = { pts, pos, n, kind: 'snow' };
    } else if (kind === 'night') {
      const tex = windowTex(true);
      tex.repeat.set(2, 4);
      const list = [];
      const pal = [0xffffff, 0xd0e0ff, 0xffd0f0, 0xd0fff8];
      for (let i = 0; i < SAMPLES; i += 4) {
        const s = samples[i];
        for (const sign of [-1, 1]) {
          if (srand() < 0.45) continue;
          const d = WALL_DIST + srnd(14, 40);
          const x = s.x + s.nx * d * sign;
          const z = s.z + s.nz * d * sign;
          const w = srnd(10, 20);
          if (trackDist(x, z).d < WALL_DIST + w * 0.5 + 4) continue;
          const h = srnd(20, 80);
          list.push({ x, y: h / 2, z, sx: w, sy: h, sz: srnd(10, 20), ry: Math.atan2(s.tx, s.tz), color: pal[(srand() * 4) | 0] });
        }
      }
      for (let i = 0; i < 80; i++) {
        const a = srand() * TAU;
        const r = srnd(380, 600);
        const h = srnd(50, 170);
        list.push({ x: cx0 + Math.cos(a) * r, y: h / 2, z: cz0 + Math.sin(a) * r, sx: srnd(20, 40), sy: h, sz: srnd(20, 40), color: pal[(srand() * 4) | 0] });
      }
      G.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: tex }), list));
      addLamps(G, 9, 0xfff0c0, true);
      const n = 500;
      const pos = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU;
        const e = Math.random() * 1.2 + 0.15;
        pos[i * 3] = cx0 + Math.cos(a) * Math.cos(e) * 900;
        pos[i * 3 + 1] = Math.sin(e) * 900;
        pos[i * 3 + 2] = cz0 + Math.sin(a) * Math.cos(e) * 900;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const stars = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
      stars.frustumCulled = false;
      G.add(stars);
      const moon = new THREE.Mesh(new THREE.CircleGeometry(30, 24), new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
      moon.position.set(cx0 + 300, 420, cz0 + 600);
      moon.lookAt(cx0, 0, cz0);
      G.add(moon);
    } else if (kind === 'coast') {
      const shore = maxZ + 50;
      G.add(
        buildTerrain(Object.assign({ terrainHigh: 0x6aa850, bankSlope: 0.12 }, th), (x, z, d) => {
          // land rises inland (negative z) and drops into the sea to the north (positive z)
          if (z > shore) return -6 - (z - shore) * 0.05;
          const hills = d > 80 ? (Math.sin(x * 0.01) * 0.5 + 0.8) * 30 * clamp((shore - 140 - z) / 300, 0, 1) : 0;
          return Math.max(0, hills);
        })
      );
      const sea = new THREE.Mesh(
        new THREE.PlaneGeometry(3000, 1600),
        new THREE.MeshStandardMaterial({ color: th.sea, roughness: 0.18, metalness: 0.35, emissive: 0x0a2030 })
      );
      sea.rotation.x = -Math.PI / 2;
      sea.position.set(cx0, -0.6, shore + 800);
      G.add(sea);
      const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(60, 32), new THREE.MeshBasicMaterial({ color: 0xffe0a0, fog: false }));
      sunDisc.position.set(cx0, 70, maxZ + 1100);
      sunDisc.lookAt(cx0, 0, cz0);
      G.add(sunDisc);
      const trunks = [];
      const crowns = [];
      scatter(120, WALL_DIST + 3, WALL_DIST + 30, 2).forEach((p) => {
        const h = srnd(6, 10);
        const lean = srnd(-0.25, 0.25);
        trunks.push({ x: p.x, y: p.y + h / 2 - 0.7, z: p.z, sx: 1, sy: h, sz: 1, rz: lean });
        crowns.push({ x: p.x - Math.sin(lean) * h * 0.5, y: p.y + h - 0.7, z: p.z, sx: srnd(2.6, 3.4), sy: 1, sz: srnd(2.6, 3.4), ry: srand() * 3 });
      });
      G.add(instanced(new THREE.CylinderGeometry(0.22, 0.34, 1, 6), new THREE.MeshLambertMaterial({ color: 0x8a6a42 }), trunks, { cast: true }));
      G.add(instanced(new THREE.ConeGeometry(1, 0.9, 7), new THREE.MeshLambertMaterial({ color: 0x2f8a3a }), crowns, { cast: true }));
      const hutCols = [0xff6b6b, 0x4ecdc4, 0xffe66d, 0xf7fff7];
      const huts = scatter(16, WALL_DIST + 12, WALL_DIST + 40, 8).map((p) => ({
        x: p.x, y: p.y + 1.2, z: p.z, sx: 4, sy: 3, sz: 4, ry: srand() * 3, color: hutCols[(srand() * 4) | 0],
      }));
      G.add(instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), huts));
    }
  }

  function addTrees(G, count, leafColor, snowy) {
    const pts = scatter(count, WALL_DIST + 5, WALL_DIST + 34, 3);
    const trunks = [];
    const leaves = [];
    const caps = [];
    pts.forEach((p) => {
      const sc = srnd(0.8, 1.6);
      trunks.push({ x: p.x, y: p.y + 1.1 * sc - 0.6, z: p.z, sx: sc });
      leaves.push({ x: p.x, y: p.y + 3.3 * sc - 0.6, z: p.z, sx: sc, ry: srand() * 6 });
      if (snowy) caps.push({ x: p.x, y: p.y + 4.4 * sc - 0.6, z: p.z, sx: sc * 0.62, ry: srand() * 6 });
    });
    G.add(instanced(new THREE.CylinderGeometry(0.22, 0.32, 2.2, 5), new THREE.MeshLambertMaterial({ color: 0x5a3a22 }), trunks));
    G.add(instanced(new THREE.ConeGeometry(1.6, 3.4, 6), new THREE.MeshLambertMaterial({ color: leafColor }), leaves, { cast: true }));
    if (snowy) G.add(instanced(new THREE.ConeGeometry(1.6, 1.6, 6), new THREE.MeshLambertMaterial({ color: 0xf6f9ff }), caps));
  }

  function addLamps(G, every, color, bright) {
    const poles = [];
    const heads = [];
    const pools = [];
    for (let i = 0; i < SAMPLES; i += every) {
      const s = samples[i];
      const sign = ((i / every) | 0) % 2 ? 1 : -1;
      const d = WALL_DIST + 1.2;
      poles.push({ x: s.x + s.nx * d * sign, y: s.y + 5, z: s.z + s.nz * d * sign });
      heads.push({ x: s.x + s.nx * (d - 2.2) * sign, y: s.y + 9.8, z: s.z + s.nz * (d - 2.2) * sign, ry: Math.atan2(s.tx, s.tz) });
      if (bright) pools.push({ x: s.x + s.nx * (d - 7) * sign, y: s.y + 0.06, z: s.z + s.nz * (d - 7) * sign });
    }
    G.add(instanced(new THREE.CylinderGeometry(0.14, 0.2, 10, 6), new THREE.MeshLambertMaterial({ color: 0x3a3f4a }), poles));
    G.add(instanced(new THREE.BoxGeometry(0.8, 0.3, 2.6), new THREE.MeshBasicMaterial({ color }), heads));
    if (pools.length) {
      // fake floodlight pools: additive discs instead of real lights (cheap on phones)
      const geo = new THREE.CircleGeometry(9, 20);
      geo.rotateX(-Math.PI / 2);
      const mat = new THREE.MeshBasicMaterial({ color: 0x3a3424, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false });
      G.add(instanced(geo, mat, pools));
    }
  }

  function setStartLights(nOn) {
    for (let i = 0; i < lightsArr.length; i++) {
      const on = i < nOn;
      const m = lightsArr[i].material;
      m.emissive.set(on ? 0xff1a1a : 0x220000);
      m.color.set(on ? 0xff3333 : 0x330000);
    }
  }

  function updateWeather(dt) {
    if (!weather || weather.kind !== 'snow') return;
    const p = weather.pos;
    const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
    for (let i = 0; i < weather.n; i++) {
      let x = p[i * 3], y = p[i * 3 + 1], z = p[i * 3 + 2];
      y -= dt * 4;
      x += Math.sin(y * 0.3 + i) * dt * 0.8;
      if (y < cy - 12) y += 40;
      if (y > cy + 30) y -= 40;
      if (x < cx - 60) x += 120;
      if (x > cx + 60) x -= 120;
      if (z < cz - 60) z += 120;
      if (z > cz + 60) z -= 120;
      p[i * 3] = x;
      p[i * 3 + 1] = y;
      p[i * 3 + 2] = z;
    }
    weather.pts.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- cars ---------- */
  function makeWheel() {
    const geo = new THREE.CylinderGeometry(0.38, 0.38, 0.34, 12);
    geo.rotateZ(Math.PI / 2);
    const tire = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x111114, roughness: 0.95, metalness: 0.1 }));
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.36, 10),
      new THREE.MeshStandardMaterial({ color: 0xdddde4, metalness: 0.7, roughness: 0.25 })
    );
    rim.rotation.z = Math.PI / 2;
    const w = new THREE.Group();
    w.add(tire, rim);
    tire.castShadow = true;
    return w;
  }

  function makeCar(spec) {
    const root = new THREE.Group();
    root.rotation.order = 'YXZ';
    const body = new THREE.Group();
    root.add(body);
    const col = new THREE.Color(spec.color);
    const accent = new THREE.Color(spec.accent);
    const bodyMat = new THREE.MeshStandardMaterial({ color: col.clone(), metalness: 0.45, roughness: 0.38 });
    const accentMat = new THREE.MeshStandardMaterial({ color: accent, metalness: 0.4, roughness: 0.4 });
    const blk = new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.5, metalness: 0.3 });
    const haloMat = new THREE.MeshStandardMaterial({ color: 0xc5c8d0, metalness: 0.8, roughness: 0.25 });
    const add = (geo, mat, x, y, z, cast) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (cast) m.castShadow = true;
      body.add(m);
      return m;
    };
    add(new THREE.BoxGeometry(1.55, 0.28, 3.15), bodyMat, 0, 0.42, 0.05, true);
    add(new THREE.BoxGeometry(0.38, 0.16, 1.55), bodyMat, 0, 0.34, 2.15, true);
    add(new THREE.BoxGeometry(0.18, 0.1, 0.5), bodyMat, 0, 0.32, 2.95);
    add(new THREE.BoxGeometry(0.72, 0.32, 0.9), blk, 0, 0.62, 0.15);
    const halo = add(new THREE.TorusGeometry(0.42, 0.045, 6, 14, Math.PI), haloMat, 0, 0.78, 0.28);
    halo.rotation.x = Math.PI / 2;
    add(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: spec.helmet || 0xffe14a, roughness: 0.4 }), 0, 0.72, 0.22);
    add(new THREE.BoxGeometry(0.42, 0.28, 1.5), bodyMat, -0.72, 0.4, -0.15);
    add(new THREE.BoxGeometry(0.42, 0.28, 1.5), bodyMat, 0.72, 0.4, -0.15);
    add(new THREE.BoxGeometry(0.7, 0.36, 1.1), blk, 0, 0.55, -1.15);
    add(new THREE.BoxGeometry(0.28, 0.34, 0.5), accentMat, 0, 0.82, -0.55);
    add(new THREE.BoxGeometry(1.4, 0.05, 3.4), blk, 0, 0.22, 0.1);
    add(new THREE.BoxGeometry(0.18, 0.3, 3.0), accentMat, 0, 0.43, 0.1);
    // rear rain light
    add(new THREE.BoxGeometry(0.22, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xff2020 }), 0, 0.5, -2.07);

    const fw = new THREE.Group();
    const fwMain = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.06, 0.42), accentMat);
    fwMain.castShadow = true;
    const fwPlateL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.28, 0.5), blk);
    fwPlateL.position.set(-0.96, 0.1, 0);
    const fwPlateR = fwPlateL.clone();
    fwPlateR.position.x = 0.96;
    fw.add(fwMain, fwPlateL, fwPlateR);
    fw.position.set(0, 0.22, 3.15);
    body.add(fw);

    const rw = new THREE.Group();
    const rwMain = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.07, 0.38), accentMat);
    rwMain.position.y = 0.55;
    const rwLow = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.05, 0.28), accentMat);
    rwLow.position.y = 0.32;
    const rwL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.42), blk);
    rwL.position.set(-0.56, 0.28, 0);
    const rwR = rwL.clone();
    rwR.position.x = 0.56;
    rw.add(rwMain, rwLow, rwL, rwR);
    rw.position.set(0, 0.55, -1.85);
    body.add(rw);

    const wheels = [];
    [
      [-0.78, 0.38, 1.22],
      [0.78, 0.38, 1.22],
      [-0.82, 0.38, -1.28],
      [0.82, 0.38, -1.28],
    ].forEach((p, i) => {
      const w = makeWheel();
      w.position.set(p[0], p[1], p[2]);
      if (i >= 2) w.scale.set(1.08, 1.08, 1.08);
      root.add(w);
      wheels.push(w);
    });
    return { root, body, bodyMat, baseColor: col.clone(), frontWing: fw, rearWing: rw, wheels, fwBaseY: fw.position.y };
  }

  const LIVERY = [
    { name: 'YOU', color: 0xff4a1c, accent: 0x00e8ff, helmet: 0x00e8ff, player: true, css: '#ff4a1c' },
    { name: 'ROSSO', color: 0xc1121f, accent: 0xffe14a, helmet: 0xffeeaa, css: '#e0303a' },
    { name: 'SILVER', color: 0xc5d0d8, accent: 0x00a39a, helmet: 0x111111, css: '#c5d0d8' },
    { name: 'NAVY', color: 0x1a2a6c, accent: 0xffe14a, helmet: 0xff4a1c, css: '#4a6aee' },
    { name: 'PAPAYA', color: 0xff8a00, accent: 0x1a3a8a, helmet: 0x2266ff, css: '#ff8a00' },
  ];

  const cars = [];
  for (let i = 0; i < FIELD; i++) {
    const spec = LIVERY[i];
    const vis = makeCar(spec);
    scene.add(vis.root);
    cars.push({
      id: i, name: spec.name, css: spec.css, isPlayer: !!spec.player, vis,
      x: 0, z: 0, y: 0, yaw: 0, speed: 0, steer: 0, throttle: 0, brake: 0, handbrake: 0,
      damage: 0, idx: 0, t: 0, progress: 0, lap: 1, lapTime: 0, bestLap: Infinity, lastT: 0,
      crossedStart: false, finished: false, dnf: false, finishTime: 0,
      skill: 1, power: 1, aiPower: 1, maxSpd: 78, lat: 0, passOff: 0, slope: 0,
      impactCd: 0, stall: 0, roll: 0, pitch: 0, place: i + 1, steerVis: 0,
    });
  }
  const player = cars[0];

  /* ---------- smoke particles ---------- */
  const SMOKE_N = 120;
  const smokePos = new Float32Array(SMOKE_N * 3);
  const smokeLife = new Float32Array(SMOKE_N);
  const smokeVel = new Float32Array(SMOKE_N * 3);
  const smokeGeo = new THREE.BufferGeometry();
  smokeGeo.setAttribute('position', new THREE.BufferAttribute(smokePos, 3));
  const smokePts = new THREE.Points(
    smokeGeo,
    new THREE.PointsMaterial({ color: 0x9a9aa4, size: 0.72, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true })
  );
  smokePts.frustumCulled = false;
  scene.add(smokePts);
  let smokeCursor = 0;

  function emitSmoke(x, y, z, heavy, fire) {
    const i = smokeCursor++ % SMOKE_N;
    smokePos[i * 3] = x + rand(-0.2, 0.2);
    smokePos[i * 3 + 1] = y;
    smokePos[i * 3 + 2] = z + rand(-0.2, 0.2);
    smokeVel[i * 3] = rand(-0.4, 0.4);
    smokeVel[i * 3 + 1] = rand(1.4, 3.2) * (heavy ? 1.4 : 1);
    smokeVel[i * 3 + 2] = rand(-0.4, 0.4);
    smokeLife[i] = fire ? 0.9 : 1;
  }

  function stepSmoke(dt) {
    for (let i = 0; i < SMOKE_N; i++) {
      if (smokeLife[i] <= 0) {
        smokePos[i * 3 + 1] = -100;
        continue;
      }
      smokeLife[i] -= dt * 0.85;
      smokePos[i * 3] += smokeVel[i * 3] * dt;
      smokePos[i * 3 + 1] += smokeVel[i * 3 + 1] * dt;
      smokePos[i * 3 + 2] += smokeVel[i * 3 + 2] * dt;
      smokeVel[i * 3 + 1] += dt * 0.8;
    }
    smokeGeo.attributes.position.needsUpdate = true;
  }

  /* ---------- audio ---------- */
  const audio = { ctx: null, muted: false, engine: null, gain: null, filt: null, osc2: null };

  function audioEnsure() {
    if (audio.ctx) {
      if (audio.ctx.state === 'suspended') audio.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    audio.ctx = ctx;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    osc.connect(filt);
    osc2.connect(filt);
    filt.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    audio.engine = osc;
    audio.osc2 = osc2;
    audio.filt = filt;
    audio.gain = gain;
  }

  function audioEngine(speed, throttle, dmg, racing) {
    if (!audio.ctx || !audio.engine) return;
    if (audio.muted || state.paused) {
      audio.gain.gain.setTargetAtTime(0, audio.ctx.currentTime, 0.03);
      return;
    }
    const rpm = 40 + Math.abs(speed) * 4.2 + throttle * 18;
    audio.engine.frequency.setTargetAtTime(rpm, audio.ctx.currentTime, 0.06);
    audio.osc2.frequency.setTargetAtTime(rpm * 0.5, audio.ctx.currentTime, 0.06);
    audio.filt.frequency.setTargetAtTime(700 + throttle * 1400 - dmg * 4, audio.ctx.currentTime, 0.08);
    const vol = racing ? 0.035 + throttle * 0.04 + Math.min(0.03, Math.abs(speed) * 0.0004) : 0.012;
    audio.gain.gain.setTargetAtTime(vol * (dmg > 85 ? 0.7 : 1), audio.ctx.currentTime, 0.05);
  }

  function audioBeep(freq, dur, vol) {
    if (!audio.ctx || audio.muted) return;
    const o = audio.ctx.createOscillator();
    const g = audio.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.value = vol || 0.08;
    o.connect(g);
    g.connect(audio.ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.ctx.currentTime + dur);
    o.stop(audio.ctx.currentTime + dur);
  }

  function audioImpact(mag) {
    if (!audio.ctx || audio.muted) return;
    const ctx = audio.ctx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.value = 90 + mag * 2;
    g.gain.value = clamp(mag * 0.004, 0.02, 0.14);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.18);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.22);
    o.stop(ctx.currentTime + 0.23);
  }

  muteBtn.addEventListener('click', () => {
    audio.muted = !audio.muted;
    muteBtn.classList.toggle('off', audio.muted);
    if (!audio.muted) audioEnsure();
  });

  /* ---------- input ---------- */
  const keys = Object.create(null);
  const touch = { steer: 0, accel: 0, brake: 0, pointerId: null };

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'Escape' || e.code === 'KeyP') {
      if (state.mode === 'race' || state.mode === 'countdown') togglePause();
    }
    if (e.code === 'Enter') {
      if (state.paused) togglePause();
      else if (state.mode === 'title' && !cards.title.classList.contains('hidden')) openTrackSelect();
      else if (state.mode === 'title' && !cards.track.classList.contains('hidden')) startRace();
      else if (state.mode === 'title' && !cards.champ.classList.contains('hidden')) el('champ-go').click();
      else if ((state.mode === 'finish' || state.mode === 'dnf') && state.finishTimer <= 0) onResultPrimary();
    }
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    touch.accel = touch.brake = 0;
    endSteer();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.mode === 'race' && !state.paused) togglePause();
  });

  function readInput() {
    let th = 0, br = 0, st = 0, hb = 0;
    if (keys.KeyW || keys.ArrowUp) th = 1;
    if (keys.KeyS || keys.ArrowDown || keys.Space) br = 1;
    if (keys.KeyA || keys.ArrowLeft) st -= 1;
    if (keys.KeyD || keys.ArrowRight) st += 1;
    if (keys.ShiftLeft || keys.ShiftRight) hb = 1;
    if (isTouch) {
      th = Math.max(th, touch.accel);
      br = Math.max(br, touch.brake);
      if (touch.pointerId != null || touch.steer !== 0) st = touch.steer;
    }
    return { th: clamp(th, 0, 1), br: clamp(br, 0, 1), st: clamp(st, -1, 1), hb };
  }

  function onSteer(e) {
    const r = steerPad.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width * 0.5);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height * 0.5);
    const m = Math.hypot(dx, dy) || 1;
    const cx = clamp(dx / Math.max(1, m), -1, 1);
    const cy = clamp(dy / Math.max(1, m), -1, 1);
    // small dead zone + gentle response curve: finer corrections on a phone
    const ax = Math.min(1, Math.abs(dx));
    const v = ax < 0.06 ? 0 : (ax - 0.06) / 0.94;
    touch.steer = Math.sign(dx) * Math.pow(v, 1.2);
    steerStick.style.transform = 'translate(' + cx * 38 + 'px,' + cy * 38 + 'px)';
  }
  function endSteer() {
    touch.steer = 0;
    touch.pointerId = null;
    steerStick.style.transform = 'translate(0,0)';
  }
  steerPad.addEventListener('pointerdown', (e) => {
    steerPad.setPointerCapture(e.pointerId);
    touch.pointerId = e.pointerId;
    onSteer(e);
  });
  steerPad.addEventListener('pointermove', (e) => {
    if (touch.pointerId === e.pointerId) onSteer(e);
  });
  steerPad.addEventListener('pointerup', endSteer);
  steerPad.addEventListener('pointercancel', endSteer);

  function holdBtn(btn, key) {
    const down = (e) => {
      e.preventDefault();
      touch[key] = 1;
      btn.setPointerCapture(e.pointerId);
    };
    const up = () => {
      touch[key] = 0;
    };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up);
    btn.addEventListener('pointercancel', up);
    btn.addEventListener('pointerleave', (e) => {
      if (e.buttons === 0) touch[key] = 0;
    });
  }
  holdBtn(btnAccel, 'accel');
  holdBtn(btnBrake, 'brake');
  touchUI.addEventListener('contextmenu', (e) => e.preventDefault());

  /* ---------- settings / persistence ---------- */
  function lsGet(k) {
    try {
      return localStorage.getItem(k);
    } catch (e) {
      return null;
    }
  }
  function lsSet(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {}
  }
  const settings = Object.assign(
    { diff: 'normal', laps: 3, track: 'park' },
    (() => {
      try {
        return JSON.parse(lsGet(LS_SET) || '{}') || {};
      } catch (e) {
        return {};
      }
    })()
  );
  if (!DIFFS[settings.diff] || settings.diff === 'pilot') settings.diff = 'normal';
  settings.laps = +settings.laps;
  if (![1, 3, 5].includes(settings.laps)) settings.laps = 3;
  if (!TRACKS.some((t) => t.id === settings.track)) settings.track = 'park';
  function saveSettings() {
    lsSet(LS_SET, JSON.stringify(settings));
  }

  function bestLapFor(id) {
    const v = parseFloat(lsGet(lapKey(id)) || '0');
    return v > 0 ? v : 0;
  }
  function persistBestLap(t) {
    const prev = bestLapFor(TR.id);
    if (!prev || t < prev) {
      lsSet(lapKey(TR.id), String(t));
      return true;
    }
    return false;
  }
  function persistRace(time) {
    const k = raceKey(TR.id, TOTAL_LAPS);
    const prev = parseFloat(lsGet(k) || '0');
    if (!prev || time < prev) {
      lsSet(k, String(time));
      return true;
    }
    return false;
  }

  /* ---------- game state ---------- */
  const state = {
    mode: 'title', // title | countdown | race | finish | dnf
    paused: false,
    raceTime: 0,
    countdown: 0,
    cdStep: 0,
    camX: 0, camY: 8, camZ: 0, lookX: 0, lookY: 0, lookZ: 0,
    shake: 0,
    impactFlash: 0,
    bestLapSession: Infinity,
    newRecord: false,
    autopilot: false,
    finishTimer: 0,
    finishCard: 'finish',
    headless: false,
    inChamp: false,
  };

  const champ = { active: false, round: 0, points: [0, 0, 0, 0, 0], diff: null, laps: null, order: TRACKS.map((t) => t.id) };
  (() => {
    try {
      const c = JSON.parse(lsGet(LS_CHAMP) || 'null');
      if (c && c.active && Array.isArray(c.points) && c.points.length === FIELD) {
        champ.active = true;
        champ.round = c.round | 0;
        champ.points = c.points.map((v) => +v || 0);
        champ.diff = DIFFS[c.diff] ? c.diff : null;
        champ.laps = [1, 3, 5].includes(+c.laps) ? +c.laps : null;
      }
    } catch (e) {}
  })();
  function saveChamp() {
    lsSet(LS_CHAMP, JSON.stringify({ active: champ.active, round: champ.round, points: champ.points, diff: champ.diff, laps: champ.laps }));
  }

  function gridPlace() {
    const order = state.gridOrder || [1, 2, 0, 3, 4]; // car ids from pole: you start P3 (online: set by grid-online.js)
    const dset = DIFFS[settings.diff] || DIFFS.normal;
    const skillTab = [0, 0.6, -0.2, 0.2, -0.6];
    const powTab = [0, 0.5, 0, -0.3, -0.6];
    for (let g = 0; g < FIELD; g++) {
      const car = cars[order[g]];
      const dist = 12 + g * 9;
      const idx = SAMPLES - Math.round(dist / DS);
      const off = g % 2 ? -2.4 : 2.4;
      const p = pointSide(idx, off);
      const s = sampleAt(idx);
      Object.assign(car, {
        x: p.x, z: p.z, y: s.y, yaw: p.yaw, speed: 0, steer: 0, damage: 0, idx,
        t: idx / SAMPLES, lastT: idx / SAMPLES, progress: idx / SAMPLES - 1,
        lap: 1, lapTime: 0, bestLap: Infinity, crossedStart: false, finished: false, dnf: false, finishTime: 0,
        throttle: 0, brake: 0, handbrake: 0, steerVis: 0, roll: 0, pitch: 0, stall: 0, impactCd: 0,
        passOff: 0, lat: off, slope: 0, maxSpd: 78,
      });
      // AI personality: small spread around the chosen difficulty
      car.skill = car.isPlayer ? 1 : 1 + skillTab[car.id] * dset.spread * 1.6;
      car.power = car.isPlayer ? 1 : dset.power * (1 + powTab[car.id] * dset.spread);
      car.aiPower = car.power;
      const vis = car.vis;
      vis.frontWing.visible = true;
      vis.rearWing.visible = true;
      vis.frontWing.rotation.set(0, 0, 0);
      vis.rearWing.rotation.set(0, 0, 0);
      vis.frontWing.position.y = vis.fwBaseY;
      vis.wheels[0].position.y = 0.38;
      vis.bodyMat.color.copy(vis.baseColor);
      vis.bodyMat.roughness = 0.38;
      syncCarMesh(car);
    }
    state.bestLapSession = Infinity;
    state.newRecord = false;
    state.raceTime = 0;
    state.shake = 0;
    state.impactFlash = 0;
    state.finishTimer = 0;
    for (let i = 0; i < SMOKE_N; i++) smokeLife[i] = 0;
  }

  function syncCarMesh(car) {
    const r = car.vis.root;
    r.position.set(car.x, car.y, car.z);
    r.rotation.y = car.yaw;
    r.rotation.x = -Math.atan(car.slope);
    car.vis.body.rotation.z = car.roll;
    car.vis.body.rotation.x = car.pitch;
  }

  function applyVisualDamage(car) {
    const d = car.damage;
    const vis = car.vis;
    vis.frontWing.rotation.x = clamp(d / 28, 0, 1) * 0.7;
    vis.frontWing.position.y = vis.fwBaseY - clamp(d, 0, 50) * 0.003;
    vis.frontWing.visible = d < 58;
    vis.rearWing.rotation.z = d > 42 ? (d - 42) * 0.01 : 0;
    vis.rearWing.rotation.x = d > 72 ? 0.45 : 0;
    vis.rearWing.visible = d < 92;
    const dark = 1 - d * 0.0045;
    vis.bodyMat.color.copy(vis.baseColor).multiplyScalar(Math.max(0.35, dark));
    vis.bodyMat.roughness = 0.38 + d * 0.005;
    vis.wheels[0].position.y = 0.38 + (d > 60 ? Math.sin(state.raceTime * 18) * 0.03 : 0);
  }

  function dmgLabel(d) {
    if (d < 6) return ['CLEAN', '#b8ff00'];
    if (d < 20) return ['SCUFFED', '#b8ff00'];
    if (d < 38) return ['WING DAMAGE', '#ffe14a'];
    if (d < 55) return ['BENT', '#ffe14a'];
    if (d < 72) return ['CRITICAL', '#ff4a1c'];
    if (d < 90) return ['FAILING', '#ff2d6a'];
    return ['TERMINAL', '#ff2d6a'];
  }

  function addDamage(car, amount, impactSpeed) {
    if (car.dnf || car.finished || amount <= 0) return;
    if (car.impactCd > 0 && amount < 8) return;
    car.damage = clamp(car.damage + amount, 0, MAX_DAMAGE);
    car.impactCd = 0.12;
    applyVisualDamage(car);
    if (car.isPlayer && amount > 3) {
      state.shake = Math.max(state.shake, clamp(amount / 18, 0.15, 1.4));
      state.impactFlash = clamp(amount / 25, 0.15, 1);
      audioImpact(impactSpeed || amount * 2);
    }
    if (car.damage >= MAX_DAMAGE) {
      car.dnf = true;
      car.speed *= 0.3;
      if (car.isPlayer && state.mode === 'race') endDnf();
    }
  }

  /* ---------- AI ---------- */
  // Racing-line follower: pure-pursuit steering on a precomputed line, a braking-point speed
  // profile, overtaking around slower cars, slipstream, and rubber-banding toward the player.
  function updateAI(car, dt, dsetOverride) {
    if (car.dnf) {
      car.throttle = 0;
      car.brake = 1;
      car.handbrake = 0;
      return;
    }
    const dset = dsetOverride || line.diff;
    const N = SAMPLES;
    const v = Math.max(0, car.speed);
    const lim = TRACK_HALF - 1.5;

    // rubber band toward the player
    // finished cars do a slow cool-down lap instead of parking on the racing line
    let pace = dset.pace * car.skill * (car.finished ? 0.62 : 1);
    let power = car.isPlayer ? 1 : car.power;
    if (!car.isPlayer && !car.finished && !player.dnf && !player.finished) {
      const gap = (car.progress - player.progress) * TRACK_LEN; // + = AI ahead
      if (gap < -45) {
        const b = Math.min(1, (-gap - 45) / 500) * dset.boost;
        pace *= 1 + b * 0.6;
        power *= 1 + b;
      } else if (gap > 55) {
        const s = Math.min(1, (gap - 55) / 700) * dset.slow;
        pace *= 1 - s * 0.7;
        power *= 1 - s;
      }
    }

    // traffic: closest car ahead
    let tgtPass = 0;
    let followCap = Infinity;
    let slip = false;
    let best = null;
    let bestGap = 40;
    for (let i = 0; i < cars.length; i++) {
      const o = cars[i];
      if (o === car) continue;
      const gap = (o.progress - car.progress) * TRACK_LEN;
      if (gap > 0 && gap < bestGap) {
        bestGap = gap;
        best = o;
      }
    }
    const myLineLat = line.off[car.idx];
    if (best) {
      const latDiff = best.lat - car.lat;
      if (Math.abs(latDiff) < 2.6 && bestGap < 30) slip = true;
      const closing = v - Math.max(0, best.speed);
      if (Math.abs(latDiff) < 3.1 && (bestGap < 14 || (bestGap < 32 && closing > 2))) {
        // pick a side with room, preferring the inside of the next corner
        const ahead = (car.idx + Math.round(60 / DS)) % N;
        const kAhead = line.ksign[ahead];
        const roomPos = lim - best.lat;
        const roomNeg = best.lat + lim;
        let pref;
        if (Math.abs(kAhead) > 0.004) pref = kAhead > 0 ? 1 : -1;
        else pref = latDiff !== 0 ? -Math.sign(latDiff) : car.id % 2 ? 1 : -1;
        let side = 0;
        if (pref > 0 && roomPos > 3.3) side = 1;
        else if (pref < 0 && roomNeg > 3.3) side = -1;
        else if (roomPos > 3.3) side = 1;
        else if (roomNeg > 3.3) side = -1;
        if (side) tgtPass = clamp(best.lat + side * 3.5, -lim, lim) - myLineLat;
        if (!side || bestGap < 7) followCap = Math.max(0, best.speed) + Math.max(0, bestGap - 5) * 0.6;
      }
    }
    // side by side: leave each other a little room
    for (let i = 0; i < cars.length; i++) {
      const o = cars[i];
      if (o === car) continue;
      const along = Math.abs(o.progress - car.progress) * TRACK_LEN;
      const ld = car.lat - o.lat;
      if (along < 5 && Math.abs(ld) < 3) tgtPass += (ld >= 0 ? 1 : -1) * (3 - Math.abs(ld)) * 0.6;
    }
    car.passOff = lerp(car.passOff, tgtPass, Math.min(1, dt * 2.2));

    // steering: pure pursuit to a point on the (offset) racing line
    const look = 7 + v * 0.3;
    const li = (car.idx + Math.max(2, Math.round(look / DS))) % N;
    const ls = samples[li];
    const off = clamp(line.off[li] + car.passOff, -lim, lim);
    const dx = ls.x + ls.nx * off - car.x;
    const dz = ls.z + ls.nz * off - car.z;
    const Ld = Math.hypot(dx, dz) || 1;
    const alpha = wrapAng(Math.atan2(dx, dz) - car.yaw);
    const omega = (2 * Math.max(v, 8) * Math.sin(alpha)) / Ld;
    const maxSteer = (0.52 - Math.min(v / 85, 1) * 0.3) * Math.max(0.4, 1 - car.damage * 0.0048);
    car.steer = v < 9 ? clamp(alpha * 2.5, -1, 1) : clamp(omega / (2.25 * maxSteer), -1, 1);

    // speed: braking-point profile a little ahead
    const reach = Math.max(1, Math.round((v * 0.18) / DS) + 1);
    let vt = Infinity;
    const prof = dset === DIFFS.pilot ? line.vp : line.v;
    for (let k = 0; k <= reach; k++) vt = Math.min(vt, prof[(car.idx + k) % N]);
    vt *= pace * (1 - car.damage * 0.004);
    if (Math.abs(car.passOff) > 1) vt *= 0.985;
    vt = Math.min(vt, followCap);
    let th = 0.45, br = 0;
    if (v < vt - 1) th = 1;
    else if (v > vt + 1.2) {
      th = 0;
      br = clamp((v - vt) / 7, 0.25, 1);
    }
    if (slip && th > 0.9) power *= 1.035;
    car.throttle = th;
    car.brake = br;
    car.handbrake = 0;
    car.aiPower = power;
  }

  /* ---------- physics ---------- */
  function integrateCar(car, dt, canDrive) {
    const dmg = car.damage;
    const dmgSpeed = 1 - dmg * 0.0052;
    const dmgGrip = 1 - dmg * 0.006;
    const dmgSteer = 1 - dmg * 0.0048;

    if (car.stall > 0) {
      car.stall -= dt;
      car.throttle *= 0.15;
    }
    if (dmg > 78 && canDrive && Math.random() < dt * (dmg - 78) * 0.04) car.stall = rand(0.2, 0.55);

    const s = sampleAt(car.idx);
    const lat = (car.x - s.x) * s.nx + (car.z - s.z) * s.nz;
    const onTrack = Math.abs(lat) < TRACK_HALF + 0.4;
    const onCurb = Math.abs(lat) >= TRACK_HALF - 0.2 && Math.abs(lat) < TRACK_HALF + 1.1;
    const off = Math.abs(lat) > TRACK_HALF + 0.6;

    let grip = (onTrack ? 1 : 0.32) * dmgGrip;
    if (onCurb) grip *= 0.75;
    if (car.handbrake) grip *= 0.35;

    const maxSteer = (0.52 - Math.min(Math.abs(car.speed) / 85, 1) * 0.3) * dmgSteer;
    const steerTgt = canDrive ? car.steer * maxSteer : 0;
    car.steerVis = lerp(car.steerVis, steerTgt, Math.min(1, 16 * dt));

    const sign = Math.sign(car.speed) || 1;
    const drag = 0.01 * car.speed * car.speed * sign;
    const rollFric = (off ? 18 : 5.5) * sign;
    const pw = car.isPlayer && !state.autopilot ? 1 : car.aiPower;
    const engine = canDrive ? car.throttle * 58 * dmgSpeed * pw : 0;
    const brakes = canDrive ? car.brake * 78 : car.finished || car.dnf ? 40 : 0;
    const hb = canDrive && car.handbrake ? 50 * sign : 0;
    const gravity = canDrive ? -9.8 * car.slope * 1.6 : 0; // hills matter a little

    car.speed += (engine - brakes - hb - drag - rollFric + gravity) * dt;
    if (!canDrive && state.mode !== 'race') car.speed *= Math.pow(0.02, dt);
    if (!canDrive && Math.abs(car.speed) < 0.5) car.speed = 0;

    const maxSpd = car.maxSpd * dmgSpeed * (off ? 0.55 : 1);
    if (car.speed > maxSpd) car.speed = lerp(car.speed, maxSpd, 0.08);
    if (car.speed < -18) car.speed = -18;
    if (car.dnf) {
      car.speed *= Math.pow(0.12, dt);
      // the wreck limps off the racing line onto the run-off
      const sd = sampleAt(car.idx);
      const la = (car.x - sd.x) * sd.nx + (car.z - sd.z) * sd.nz;
      if (Math.abs(la) < TRACK_HALF + 2) {
        const dir = la >= 0 ? 1 : -1;
        car.x += sd.nx * dir * 2.2 * dt;
        car.z += sd.nz * dir * 2.2 * dt;
      }
    }

    const speedFactor = Math.min(1, Math.abs(car.speed) / 9);
    const turn = car.steerVis * speedFactor * 2.25 * grip;
    car.yaw = wrapAng(car.yaw + turn * dt);

    car.x += Math.sin(car.yaw) * car.speed * dt;
    car.z += Math.cos(car.yaw) * car.speed * dt;

    // walls
    car.idx = nearestIdx(car.x, car.z, car.idx);
    const s2 = sampleAt(car.idx);
    const lat2 = (car.x - s2.x) * s2.nx + (car.z - s2.z) * s2.nz;
    const limit = WALL_DIST - 0.55;
    if (Math.abs(lat2) > limit) {
      const outward = Math.sign(lat2) || 1;
      const nx = s2.nx * outward;
      const nz = s2.nz * outward;
      const into = Math.sin(car.yaw) * nx + Math.cos(car.yaw) * nz;
      const impact = Math.abs(car.speed * Math.max(into, 0));
      car.x = s2.x + s2.nx * clamp(lat2, -limit, limit);
      car.z = s2.z + s2.nz * clamp(lat2, -limit, limit);
      if (into > 0.05 && Math.abs(car.speed) > 4) {
        car.yaw = wrapAng(car.yaw + wrapAng(Math.atan2(-nx, -nz) - car.yaw) * 0.55);
        let dmgAmt = 0;
        if (impact < 8) dmgAmt = impact * 0.12;
        else if (impact < 22) dmgAmt = 4 + (impact - 8) * 0.85;
        else dmgAmt = 18 + (impact - 22) * 1.35;
        if (!car.isPlayer) dmgAmt *= 0.55;
        addDamage(car, dmgAmt, impact);
        car.speed *= -0.18;
      } else {
        car.speed *= 0.92;
        if (Math.abs(car.speed) > 12 && car.isPlayer) addDamage(car, dt * 4, Math.abs(car.speed));
      }
    }
    // height, slope and lateral position from the centreline
    {
      const a = sampleAt(car.idx);
      const along = (car.x - a.x) * a.tx + (car.z - a.z) * a.tz;
      const b = along >= 0 ? sampleAt(car.idx + 1) : sampleAt(car.idx - 1);
      const f = clamp(Math.abs(along) / DS, 0, 1);
      car.y = lerp(a.y, b.y, f);
      car.slope = a.slope * Math.cos(wrapAng(car.yaw - Math.atan2(a.tx, a.tz)));
      car.lat = (car.x - a.x) * a.nx + (car.z - a.z) * a.nz;
    }

    // progress / laps
    const newT = car.idx / SAMPLES;
    let dT = newT - car.lastT;
    if (dT < -0.5) {
      dT += 1;
      // a lap only counts if the car really covered it (no shuffling back and forth over the line)
      const covered = car.progress + dT;
      if (state.mode === 'race') {
        if (!car.crossedStart) {
          car.crossedStart = true;
          car.lapTime = 0;
        } else if (!car.finished && !car.dnf && covered >= car.lap - 0.03) {
          const thisLap = car.lapTime;
          if (thisLap > 5 && thisLap < car.bestLap) car.bestLap = thisLap;
          if (car.isPlayer && thisLap > 5 && thisLap < state.bestLapSession) {
            state.bestLapSession = thisLap;
            if (!state.autopilot && persistBestLap(thisLap)) state.newRecord = true;
          }
          car.lap += 1;
          car.lapTime = 0;
          if (car.lap > TOTAL_LAPS) {
            car.finished = true;
            car.lap = TOTAL_LAPS;
            car.finishTime = state.raceTime;
            if (car.isPlayer) {
              flashLap(TOTAL_LAPS + 1);
              endFinish();
            }
          } else if (car.isPlayer) {
            flashLap(car.lap);
          }
        }
      }
    } else if (dT > 0.5) {
      dT -= 1;
    }
    car.lastT = newT;
    car.t = newT;
    car.progress += dT;
    if (canDrive && !car.finished && !car.dnf) car.lapTime += dt;

    car.roll = lerp(car.roll, -car.steerVis * clamp(Math.abs(car.speed) / 50, 0, 1) * 0.28, Math.min(1, 8 * dt));
    car.pitch = lerp(car.pitch, (car.brake - car.throttle) * 0.06, Math.min(1, 8 * dt));

    if (!state.headless) {
      const spin = car.speed * dt * 1.65;
      const wh = car.vis.wheels;
      for (let i = 0; i < 4; i++) {
        wh[i].rotation.x += spin;
        if (i < 2) wh[i].rotation.y = car.steerVis * 4.5;
      }
      if (dmg > 26 && Math.random() < dt * (4 + dmg * 0.12)) {
        emitSmoke(car.x - Math.sin(car.yaw) * 1.9, car.y + 0.7, car.z - Math.cos(car.yaw) * 1.9, dmg > 60, dmg > 82);
      }
      if (off && Math.abs(car.speed) > 12 && Math.random() < dt * 8) emitSmoke(car.x, car.y + 0.2, car.z, false, false);
    }

    if (car.impactCd > 0) car.impactCd -= dt;
    syncCarMesh(car);
    if (dmg > 0) applyVisualDamage(car);
  }

  function collideCars() {
    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) {
        const a = cars[i];
        const b = cars[j];
        if (a.out || b.out) continue;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d2 = dx * dx + dz * dz;
        const min = CAR_RADIUS * 2;
        if (d2 < min * min && d2 > 0.0001) {
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const nz = dz / d;
          const overlap = min - d;
          a.x -= nx * overlap * 0.52;
          a.z -= nz * overlap * 0.52;
          b.x += nx * overlap * 0.52;
          b.z += nz * overlap * 0.52;
          const va = Math.sin(a.yaw) * a.speed;
          const vza = Math.cos(a.yaw) * a.speed;
          const vb = Math.sin(b.yaw) * b.speed;
          const vzb = Math.cos(b.yaw) * b.speed;
          const rel = (vb - va) * nx + (vzb - vza) * nz;
          const impact = Math.abs(rel);
          if (impact > 6) {
            const dmg = impact < 16 ? (impact - 6) * 0.55 : 6 + (impact - 16) * 0.7;
            if (!a.remote) addDamage(a, dmg * (a.isPlayer ? 1 : 0.7), impact);
            if (!b.remote) addDamage(b, dmg * (b.isPlayer ? 1 : 0.7), impact);
            a.speed *= 0.78;
            b.speed *= 0.78;
          }
          a.speed += -rel * 0.15;
          b.speed += rel * 0.15;
        }
      }
    }
  }

  function rankCars() {
    const live = cars.filter((c) => !c.out).sort((a, b) => {
      if (a.dnf !== b.dnf) return a.dnf ? 1 : -1;
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    live.forEach((c, i) => {
      c.place = i + 1;
    });
    return live;
  }

  /* ---------- camera ---------- */
  function updateCamera(dt) {
    const c = player;
    const spd = Math.abs(c.speed);
    const back = 8.2 + spd * 0.045;
    const height = 3.35 + spd * 0.012;
    let tx = c.x - Math.sin(c.yaw) * back;
    let tz = c.z - Math.cos(c.yaw) * back;
    let ty = c.y + height;
    if (state.mode === 'title') {
      const t = performance.now() * 0.00015;
      tx = c.x + Math.cos(t) * 16;
      tz = c.z + Math.sin(t) * 16;
      ty = c.y + 7;
    }
    const k = state.mode === 'title' ? 1.8 : 6.5;
    const a = 1 - Math.pow(0.02, dt * k * 0.25);
    state.camX = lerp(state.camX, tx, a);
    state.camY = lerp(state.camY, ty, a);
    state.camZ = lerp(state.camZ, tz, a);
    // keep the camera above the road on crests
    const under = sampleAt(nearestIdx(state.camX, state.camZ, c.idx - 2));
    if (state.camY < under.y + 1.8) state.camY = under.y + 1.8;
    state.lookX = lerp(state.lookX, c.x + Math.sin(c.yaw) * 8, a);
    state.lookY = lerp(state.lookY, c.y + 1.15, a);
    state.lookZ = lerp(state.lookZ, c.z + Math.cos(c.yaw) * 8, a);

    let sx = 0, sy = 0, sz = 0;
    if (state.shake > 0) {
      sx = (Math.random() - 0.5) * state.shake * 0.7;
      sy = (Math.random() - 0.5) * state.shake * 0.4;
      sz = (Math.random() - 0.5) * state.shake * 0.7;
      state.shake = Math.max(0, state.shake - dt * 2.4);
    }
    camera.position.set(state.camX + sx, state.camY + sy, state.camZ + sz);
    camera.lookAt(state.lookX, state.lookY, state.lookZ);
    const fovT = 68 + Math.min(spd / 80, 1) * 9;
    if (Math.abs(camera.fov - fovT) > 0.15) {
      camera.fov = lerp(camera.fov, fovT, 0.08);
      camera.updateProjectionMatrix();
    }
    // shadow frustum follows the player
    sun.position.set(c.x + sunDir.x * 260, c.y + sunDir.y * 260, c.z + sunDir.z * 260);
    sun.target.position.set(c.x, c.y, c.z);
  }

  /* ---------- HUD / minimap ---------- */
  function refreshTitleBest() {
    const t = trackById(settings.track);
    const bl = bestLapFor(t.id);
    const br = parseFloat(lsGet(raceKey(t.id, settings.laps)) || '0');
    const bits = [t.name];
    if (bl) bits.push('BEST LAP ' + fmtTime(bl));
    if (br) bits.push('BEST ' + settings.laps + '-LAP RACE ' + fmtTime(br));
    titleBest.textContent = bits.join('  ·  ');
  }

  let lapFlashTimer = 0;
  function flashLap(nextLap) {
    if (state.headless) return;
    if (typeof nextLap === 'string') lapFlashEl.textContent = nextLap;
    else if (nextLap > TOTAL_LAPS) lapFlashEl.textContent = 'CHEQUERED FLAG';
    else if (nextLap === TOTAL_LAPS) lapFlashEl.textContent = 'FINAL LAP';
    else lapFlashEl.textContent = 'LAP ' + nextLap;
    lapFlashEl.classList.add('show');
    clearTimeout(lapFlashTimer);
    lapFlashTimer = setTimeout(() => lapFlashEl.classList.remove('show'), 1400);
  }

  const hudCache = {};
  function setText(node, key, v, html) {
    if (hudCache[key] === v) return;
    hudCache[key] = v;
    if (html) node.innerHTML = v;
    else node.textContent = v;
  }

  function activeCount() {
    let n = 0;
    for (const c of cars) if (!c.out) n++;
    return n;
  }
  function updateHUD() {
    const p = player;
    const kmh = Math.max(0, Math.round(Math.abs(p.speed) * 3.6));
    setText(speedEl, 'spd', String(kmh));
    const gtab = [0, 35, 70, 110, 150, 190, 230, 270, 320];
    let g = 0;
    for (let i = 1; i < gtab.length; i++) if (kmh >= gtab[i]) g = i;
    setText(gearEl, 'gear', kmh < 8 ? 'N' : String(Math.min(8, g + 1)));
    setText(lapEl, 'lap', clamp(p.lap, 1, TOTAL_LAPS) + '<span class="dim">/' + TOTAL_LAPS + '</span>', true);
    setText(posEl, 'pos', 'P' + p.place + '<span class="dim">/' + activeCount() + '</span>', true);
    setText(laptimeEl, 'lt', fmtTime(p.lapTime));
    const best = Math.min(p.bestLap, state.bestLapSession);
    setText(bestEl, 'best', isFinite(best) && best < 1e8 ? fmtTime(best) : '—');
    const dw = clamp(p.damage, 0, 100).toFixed(0) + '%';
    if (hudCache.dw !== dw) {
      hudCache.dw = dw;
      dmgFill.style.width = dw;
      const [lab, col] = dmgLabel(p.damage);
      dmgTxt.textContent = lab;
      dmgTxt.style.color = col;
    }
    raceTimeEl.style.display = state.mode === 'race' || state.mode === 'countdown' ? 'block' : 'none';
    setText(raceTimeEl, 'rt', fmtTime(state.raceTime));
    impactEl.style.opacity = state.impactFlash > 0 ? String(state.impactFlash * 0.85) : '0';
  }

  // draws a track outline into any 2D context
  function drawTrackShape(ctx, w, h, L, opts) {
    const pad = opts.pad || 12;
    const sc = Math.min((w - pad * 2) / (L.maxX - L.minX), (h - pad * 2) / (L.maxZ - L.minZ));
    const cx = (L.minX + L.maxX) / 2;
    const cz = (L.minZ + L.maxZ) / 2;
    const X = (x) => w / 2 + (x - cx) * sc;
    const Z = (z) => h / 2 + (z - cz) * sc;
    ctx.beginPath();
    for (let i = 0; i <= L.N; i++) {
      const s = L.samples[i % L.N];
      if (i === 0) ctx.moveTo(X(s.x), Z(s.z));
      else ctx.lineTo(X(s.x), Z(s.z));
    }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = opts.glow || 'rgba(0,232,255,0.25)';
    ctx.lineWidth = opts.glowW || 8;
    ctx.stroke();
    ctx.strokeStyle = opts.color || '#d8dce6';
    ctx.lineWidth = opts.lineW || 2.2;
    ctx.stroke();
    const s0 = L.samples[0];
    ctx.fillStyle = '#ffe14a';
    ctx.fillRect(X(s0.x) - 3, Z(s0.z) - 3, 6, 6);
    return { X, Z };
  }

  let miniBg = null;
  function prepMinimap() {
    const w = miniCv.width, h = miniCv.height;
    miniBg = document.createElement('canvas');
    miniBg.width = w;
    miniBg.height = h;
    const r = drawTrackShape(miniBg.getContext('2d'), w, h, computeLayout(TR), { pad: 14 });
    miniBg.X = r.X;
    miniBg.Z = r.Z;
  }

  function drawMinimap() {
    const ctx = miniCtx;
    ctx.clearRect(0, 0, miniCv.width, miniCv.height);
    if (!miniBg) return;
    ctx.drawImage(miniBg, 0, 0);
    const X = miniBg.X, Z = miniBg.Z;
    for (let i = cars.length - 1; i >= 0; i--) {
      const c = cars[i];
      if (c.out) continue;
      ctx.beginPath();
      ctx.arc(X(c.x), Z(c.z), c.isPlayer ? 4.5 : c.human ? 4 : 3.2, 0, TAU);
      ctx.fillStyle = c.isPlayer ? '#00e8ff' : c.dnf ? '#666' : c.css;
      ctx.fill();
      if (c.isPlayer) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
    }
  }

  /* ---------- menus ---------- */
  function showOverlay(which) {
    overlay.classList.add('show');
    for (const k in cards) cards[k].classList.toggle('hidden', k !== which);
    overlay.scrollTop = 0;
  }
  function hideOverlay() {
    overlay.classList.remove('show');
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
  }

  function setRacingChrome(on) {
    hud.classList.toggle('hidden', !on);
    document.body.classList.toggle('racing', on);
    pauseBtn.classList.toggle('hidden', !on);
    if (isTouch) {
      touchUI.classList.toggle('hidden', !on);
      touchUI.setAttribute('aria-hidden', on ? 'false' : 'true');
    } else touchUI.classList.add('hidden');
  }

  function trackById(id) {
    return TRACKS.find((t) => t.id === id) || TRACKS[0];
  }

  function segInit(id, key, parse) {
    const root = el(id);
    const btns = Array.from(root.querySelectorAll('button'));
    const sync = () => btns.forEach((b) => b.classList.toggle('on', String(settings[key]) === b.dataset.v));
    btns.forEach((b) =>
      b.addEventListener('click', () => {
        settings[key] = parse(b.dataset.v);
        saveSettings();
        sync();
        refreshTitleBest();
        if (key === 'diff' && line) computeSpeedProfile(DIFFS[settings.diff]);
      })
    );
    sync();
  }
  segInit('seg-diff', 'diff', (v) => v);
  segInit('seg-laps', 'laps', (v) => +v);

  const trackList = el('track-list');
  const trackDesc = el('track-desc');
  const tileArt = {};
  function tileCanvas(t) {
    if (tileArt[t.id]) return tileArt[t.id];
    const cv = document.createElement('canvas');
    cv.width = 272;
    cv.height = 168;
    const ctx = cv.getContext('2d');
    const sky = '#' + new THREE.Color(t.theme.sky).getHexString();
    const grd = ctx.createLinearGradient(0, 0, 0, cv.height);
    grd.addColorStop(0, sky);
    grd.addColorStop(1, t.theme.mini);
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = 'rgba(4,8,16,0.45)';
    ctx.fillRect(0, 0, cv.width, cv.height);
    drawTrackShape(ctx, cv.width, cv.height, computeLayout(t), { pad: 18, lineW: 5, glowW: 14, glow: 'rgba(0,0,0,0.55)', color: '#ffffff' });
    tileArt[t.id] = cv;
    return cv;
  }
  function renderTrackList() {
    trackList.innerHTML = '';
    TRACKS.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'track-tile' + (t.id === settings.track ? ' on' : '');
      b.dataset.id = t.id;
      const src = tileCanvas(t);
      const cv = document.createElement('canvas');
      cv.width = src.width;
      cv.height = src.height;
      cv.getContext('2d').drawImage(src, 0, 0);
      b.appendChild(cv);
      const L = computeLayout(t);
      const bl = bestLapFor(t.id);
      b.insertAdjacentHTML(
        'beforeend',
        '<div class="tt">' + t.tag + ' · ' + (L.len / 1000).toFixed(2) + ' KM</div><div class="tn">' + t.name + '</div><div class="tb">' + (bl ? 'BEST ' + fmtTime(bl) : '&nbsp;') + '</div>'
      );
      b.addEventListener('click', () => selectTrack(t.id));
      trackList.appendChild(b);
    });
    trackDesc.textContent = trackById(settings.track).sub;
  }

  function selectTrack(id) {
    settings.track = id;
    saveSettings();
    Array.from(trackList.children).forEach((c) => c.classList.toggle('on', c.dataset.id === id));
    trackDesc.textContent = trackById(id).sub;
    if (TR.id !== id) loadTrack(trackById(id));
    refreshTitleBest();
  }

  function loadTrack(t) {
    buildTrack(t);
    prepMinimap();
    gridPlace();
    snapCamera();
    trackNameEl.textContent = t.name;
  }

  function snapCamera() {
    state.camX = player.x - Math.sin(player.yaw) * 12;
    state.camZ = player.z - Math.cos(player.yaw) * 12;
    state.camY = player.y + 6;
    state.lookX = player.x;
    state.lookY = player.y;
    state.lookZ = player.z;
  }

  function openTrackSelect() {
    state.inChamp = false;
    el('track-opts').textContent = DIFFS[settings.diff].label + ' · ' + settings.laps + (settings.laps === 1 ? ' LAP' : ' LAPS');
    renderTrackList();
    showOverlay('track');
    const on = trackList.querySelector('.on');
    if (on) trackList.scrollLeft = Math.max(0, on.offsetLeft - trackList.clientWidth / 2 + on.clientWidth / 2);
  }

  function champStandings() {
    return cars.map((c) => ({ c, pts: champ.points[c.id] })).sort((a, b) => b.pts - a.pts || a.c.id - b.c.id);
  }

  function renderChamp(kicker, title, msg, goLabel) {
    el('champ-kicker').textContent = kicker;
    el('champ-title').textContent = title;
    el('champ-msg').textContent = msg;
    el('champ-table').innerHTML = champStandings()
      .map(
        (r, i) =>
          '<tr class="' + (r.c.isPlayer ? 'me' : '') + '"><td>' + (i + 1) + '</td><td class="dot"><span style="background:' + r.c.css + '"></span></td><td>' +
          r.c.name + '</td><td class="pts">' + r.pts + ' PTS</td></tr>'
      )
      .join('');
    el('champ-go').textContent = goLabel;
    state.mode = 'title';
    state.paused = false;
    state.finishTimer = 0;
    setRacingChrome(false);
    showOverlay('champ');
  }

  function openChampionship(fresh) {
    if (fresh || !champ.active || champ.round >= TRACKS.length) {
      champ.active = true;
      champ.round = 0;
      champ.points = [0, 0, 0, 0, 0];
      champ.diff = settings.diff;
      champ.laps = settings.laps;
    }
    state.inChamp = true;
    saveChamp();
    const t = trackById(champ.order[champ.round]);
    if (TR.id !== t.id) loadTrack(t);
    renderChamp(
      'GROK GRID CHAMPIONSHIP · ' + DIFFS[champ.diff].label + ' · ' + champ.laps + (champ.laps === 1 ? ' LAP' : ' LAPS'),
      'ROUND ' + (champ.round + 1) + ' / ' + TRACKS.length,
      'Next: ' + t.name + '. Points 10-6-4-2-1, a DNF scores nothing.',
      'START ROUND'
    );
  }

  function updateChampButton() {
    const mid = champ.active && champ.round > 0 && champ.round < TRACKS.length;
    el('champ-btn').textContent = mid ? 'CHAMPIONSHIP · R' + (champ.round + 1) : 'CHAMPIONSHIP';
  }

  function goTitle() {
    state.mode = 'title';
    state.paused = false;
    state.inChamp = false;
    showOverlay('title');
    setRacingChrome(false);
    gridPlace();
    setStartLights(0);
    countdownEl.classList.remove('show', 'go');
    countdownEl.textContent = '';
    refreshTitleBest();
    updateChampButton();
  }

  function startRace(opts) {
    opts = opts || {};
    audioEnsure();
    let dkey = settings.diff;
    if (state.inChamp && champ.active) {
      dkey = champ.diff;
      TOTAL_LAPS = champ.laps;
      const t = trackById(champ.order[champ.round]);
      if (TR.id !== t.id) loadTrack(t);
    } else {
      state.inChamp = false;
      TOTAL_LAPS = settings.laps;
      const t = trackById(settings.track);
      if (TR.id !== t.id) loadTrack(t);
    }
    computeSpeedProfile(DIFFS[dkey] || DIFFS.normal);
    const keepDiff = settings.diff;
    settings.diff = dkey; // gridPlace reads the spread from the active difficulty
    gridPlace();
    settings.diff = keepDiff;
    state.mode = 'countdown';
    state.paused = false;
    hideOverlay();
    setRacingChrome(true);
    snapCamera();
    state.camX = player.x - Math.sin(player.yaw) * 9;
    state.camZ = player.z - Math.cos(player.yaw) * 9;
    state.raceTime = 0;
    state.countdown = opts.quick ? 0.001 : 0.78;
    state.cdStep = opts.quick ? 2 : 0;
    setStartLights(1);
    countdownEl.textContent = '3';
    countdownEl.classList.add('show');
    countdownEl.classList.remove('go');
    audioBeep(520, 0.18, 0.09);
    flashLap(TR.name);
  }

  function tickCountdown(dt) {
    state.countdown -= dt;
    if (state.countdown > 0) return;
    state.cdStep++;
    if (state.cdStep < 3) {
      countdownEl.textContent = String(3 - state.cdStep);
      setStartLights(state.cdStep + 2);
      audioBeep(520, 0.18, 0.09);
      state.countdown = 0.78;
    } else {
      countdownEl.textContent = 'GO';
      countdownEl.classList.add('show', 'go');
      setStartLights(0);
      audioBeep(880, 0.35, 0.11);
      state.mode = 'race';
      state.raceTime = 0;
      state.goTimer = 0.45;
    }
  }

  function togglePause() {
    if (net()) return; // no pausing an online race
    if (state.mode !== 'race' && state.mode !== 'countdown') return;
    state.paused = !state.paused;
    if (state.paused) {
      touch.accel = touch.brake = 0;
      endSteer();
      el('pause-menu-btn').textContent = state.inChamp ? 'RETIRE (DNF)' : 'QUIT TO MENU';
      showOverlay('pause');
    } else {
      hideOverlay();
      clock.getDelta();
    }
  }

  function statBox(label, val) {
    return '<div><span class="label">' + label + '</span>' + val + '</div>';
  }

  function awardChampPoints(ranked) {
    const got = [0, 0, 0, 0, 0];
    ranked.forEach((c, i) => {
      if (!c.dnf) got[c.id] = POINTS[i] || 0;
    });
    for (let i = 0; i < FIELD; i++) champ.points[i] += got[i];
    champ.round++;
    saveChamp();
    return got;
  }

  function endFinish() {
    if (state.mode !== 'race') return;
    state.mode = 'finish';
    if (net()) { rankCars(); net().onLocalEnd('finish'); return; }
    const ranked = rankCars();
    const p = player.place;
    const recordRace = state.autopilot ? false : persistRace(state.raceTime);
    finishKicker.textContent = (p === 1 ? 'YOU WIN · ' : 'CHEQUERED FLAG · ') + TR.name;
    finishTitle.textContent = 'P' + p;
    finishMsg.textContent =
      p === 1
        ? 'You beat a field that actually races back. Proper drive.'
        : p <= 3
          ? 'Podium. The car is still in one piece — mostly.'
          : 'You classified. The rivals are sharper now — nail the braking points.';
    let extra = '';
    if (state.inChamp && champ.active) {
      const got = awardChampPoints(ranked);
      extra = statBox('CHAMP POINTS', '+' + got[0] + ' · ' + champ.points[0] + ' total');
    }
    finishStats.innerHTML =
      statBox('RACE TIME', fmtTime(state.raceTime) + (recordRace ? ' ★' : '')) +
      statBox('BEST LAP', fmtTime(Math.min(player.bestLap, state.bestLapSession)) + (state.newRecord ? ' ★ NEW' : '')) +
      statBox('DAMAGE', Math.round(player.damage) + '%') +
      statBox('POSITION', 'P' + p + ' / ' + FIELD) +
      extra;
    configureResultButtons();
    state.finishTimer = 0.9;
    state.finishCard = 'finish';
  }

  function endDnf() {
    if (state.mode !== 'race' && state.mode !== 'countdown') return;
    state.mode = 'dnf';
    if (net()) { rankCars(); net().onLocalEnd('dnf'); return; }
    const ranked = rankCars();
    dnfMsg.textContent = pick([
      'The car is done. Wings gone, pride gone.',
      'Terminal damage. The marshals are already walking.',
      'You found the wall. The wall won.',
      'That is a DNF. The garage will not be pleased.',
    ]);
    let extra = '';
    if (state.inChamp && champ.active) {
      awardChampPoints(ranked);
      extra = statBox('CHAMP POINTS', '+0 · ' + champ.points[0] + ' total');
    }
    dnfStats.innerHTML =
      statBox('LAP', player.lap + ' / ' + TOTAL_LAPS) +
      statBox('RACE TIME', fmtTime(state.raceTime)) +
      statBox('POSITION', 'DNF') +
      statBox('DAMAGE', '100%') +
      extra;
    configureResultButtons();
    state.finishTimer = 0.7;
    state.finishCard = 'dnf';
  }

  function configureResultButtons() {
    const label = state.inChamp ? (champ.round >= TRACKS.length ? 'FINAL STANDINGS' : 'STANDINGS') : 'RETRY';
    retryBtn.textContent = label;
    dnfRetryBtn.textContent = label;
  }

  function onResultPrimary() {
    if (net()) return; // online results have their own buttons
    if (state.inChamp) {
      if (champ.round >= TRACKS.length) {
        const st = champStandings();
        const myPos = st.findIndex((r) => r.c.isPlayer) + 1;
        renderChamp(
          'SEASON COMPLETE · ' + DIFFS[champ.diff].label,
          myPos === 1 ? 'WORLD CHAMPION!' : 'P' + myPos + ' IN THE STANDINGS',
          myPos === 1 ? 'Six tracks, one champion. Take a bow.' : 'Season over. Go again and take the title.',
          'NEW SEASON'
        );
        champ.active = false;
        saveChamp();
      } else openChampionship();
    } else startRace();
  }

  el('play-btn').addEventListener('click', () => openTrackSelect());
  el('champ-btn').addEventListener('click', () => openChampionship(false));
  el('track-go').addEventListener('click', () => startRace());
  el('track-back').addEventListener('click', () => goTitle());
  el('champ-go').addEventListener('click', () => {
    if (!champ.active) openChampionship(true);
    else startRace();
  });
  el('champ-quit').addEventListener('click', () => goTitle());
  el('resume-btn').addEventListener('click', () => togglePause());
  el('restart-btn').addEventListener('click', () => {
    state.paused = false;
    startRace();
  });
  el('pause-menu-btn').addEventListener('click', () => {
    state.paused = false;
    if (state.inChamp && state.mode === 'race') {
      // retiring mid-season scores the round as a DNF
      hideOverlay();
      player.damage = MAX_DAMAGE - 0.5;
      player.impactCd = 0;
      addDamage(player, 9, 0);
      return;
    }
    goTitle();
  });
  pauseBtn.addEventListener('click', () => togglePause());
  retryBtn.addEventListener('click', onResultPrimary);
  dnfRetryBtn.addEventListener('click', onResultPrimary);
  finishMenuBtn.addEventListener('click', () => goTitle());
  dnfMenuBtn.addEventListener('click', () => goTitle());

  /* ---------- loop ---------- */
  const clock = new THREE.Clock();

  function update(dt) {
    const racing = state.mode === 'race';
    const counting = state.mode === 'countdown';
    if (counting) tickCountdown(dt);
    if (state.goTimer > 0) {
      state.goTimer -= dt;
      if (state.goTimer <= 0) countdownEl.classList.remove('show', 'go');
    }
    if (racing) state.raceTime += dt;
    if (state.impactFlash > 0) state.impactFlash = Math.max(0, state.impactFlash - dt * 2.2);
    if (state.finishTimer > 0) {
      state.finishTimer -= dt;
      if (state.finishTimer <= 0) showOverlay(state.finishCard);
    }

    if ((racing || counting) && !player.dnf && !player.finished) {
      if (state.autopilot && racing) {
        updateAI(player, dt, DIFFS.pilot);
      } else {
        const inp = readInput();
        player.throttle = inp.th;
        player.brake = racing ? inp.br : 0;
        player.steer = racing ? inp.st : inp.st * 0.35;
        player.handbrake = racing ? inp.hb : 0;
      }
    } else {
      player.throttle = 0;
      player.brake = racing ? 0.4 : 1;
      player.steer = racing ? player.steer * 0.9 : 0;
      player.handbrake = 0;
    }

    const N = net();
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.out) continue;
      if (car.remote && N) { N.stepRemote(car, dt); continue; }
      if (!car.isPlayer && racing) updateAI(car, dt);
      integrateCar(car, dt, racing && !car.dnf && !(car.isPlayer && car.finished));
    }
    if (racing || counting) collideCars();
    rankCars();
  }

  // adaptive resolution for phones: drop the pixel ratio if frames run long
  let perfAcc = 0, perfN = 0;
  function perfTick(rawDt) {
    if (!isTouch || pixelRatio <= 1) return;
    perfAcc += rawDt;
    perfN++;
    if (perfN >= 90) {
      const avg = perfAcc / perfN;
      perfAcc = perfN = 0;
      if (avg > 0.024) {
        pixelRatio = Math.max(1, pixelRatio - 0.25);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight);
      }
    }
  }

  function frame() {
    requestAnimationFrame(frame);
    const raw = clock.getDelta();
    const dt = Math.min(raw, 0.05);
    if (state.mode === 'race') perfTick(raw);
    if (!state.paused) {
      // two half steps on long frames keeps the physics stable on slow phones
      if (dt > 0.03) {
        update(dt / 2);
        update(dt / 2);
      } else update(dt);
      stepSmoke(dt);
      updateWeather(dt);
    }
    updateCamera(state.paused ? 0 : dt);
    updateHUD();
    if (state.mode !== 'title') drawMinimap();
    audioEngine(player.speed, player.throttle, player.damage, state.mode === 'race' || state.mode === 'countdown');
    renderer.render(scene, camera);
  }

  // boot
  loadTrack(trackById(settings.track));
  goTitle();
  frame();

  // test / debug hook (harmless in production)
  window.__grid = {
    state, cars, player, settings, champ, TRACKS, DIFFS,
    get track() { return TR; },
    get samples() { return samples; },
    get group() { return trackGroup; },
    THREE,
    get line() { return line; },
    get trackLen() { return TRACK_LEN; },
    get laps() { return TOTAL_LAPS; },
    loadTrack: (id) => loadTrack(trackById(id)),
    selectTrack,
    startRace: (o) => startRace(o),
    openTrackSelect, openChampionship, goTitle, togglePause, onResultPrimary,
    rankCars, showOverlay, hideOverlay, setRacingChrome, fmtTime, syncCarMesh, applyVisualDamage, snapCamera, gridPlace, setStartLights,
    get countdownEl() { return countdownEl; },
    setAutopilot: (on) => {
      state.autopilot = !!on;
    },
    // advance the simulation deterministically without rendering (used by tests)
    sim: (seconds, step) => {
      step = step || 1 / 60;
      state.headless = true;
      const n = Math.round(seconds / step);
      for (let i = 0; i < n; i++) {
        update(step);
        if ((state.mode === 'finish' || state.mode === 'dnf') && state.finishTimer <= 0) break;
      }
      state.headless = false;
      // put the chase camera where it would have settled
      const c = player;
      const back = 8.2 + Math.abs(c.speed) * 0.045;
      state.camX = c.x - Math.sin(c.yaw) * back;
      state.camZ = c.z - Math.cos(c.yaw) * back;
      state.camY = c.y + 3.35 + Math.abs(c.speed) * 0.012;
      state.lookX = c.x + Math.sin(c.yaw) * 8;
      state.lookY = c.y + 1.15;
      state.lookZ = c.z + Math.cos(c.yaw) * 8;
      return { mode: state.mode, t: +state.raceTime.toFixed(3), lap: player.lap, place: player.place, dmg: +player.damage.toFixed(1) };
    },
  };
})();
