/* GROK GRID — arcade F1, static Three.js r128 */
(() => {
"use strict";

const LAPS = 3;
const N_AI = 4;
const HALF = 8.4;
const CAR_R = 1.22;
const WHEELBASE = 3.15;
const LS = "grokgrid_best";

const CTRL = [
  [-160.0, 0.0],
  [-80.0, 0.0],
  [0.0, 0.0],
  [80.0, 0.0],
  [160.0, 0.0],
  [220.0, 0.0],
  [246.0, 5.3],
  [268.4, 20.6],
  [286.1, 44.9],
  [298.1, 76.0],
  [304.2, 111.5],
  [304.2, 148.5],
  [298.1, 184.0],
  [286.1, 215.1],
  [268.4, 239.4],
  [246.0, 254.7],
  [220.0, 260.0],
  [180.0, 260.0],
  [130.0, 258.0],
  [90.0, 255.0],
  [55.0, 268.0],
  [25.0, 282.0],
  [-5.0, 270.0],
  [-40.0, 250.0],
  [-80.0, 255.0],
  [-125.0, 262.0],
  [-165.0, 258.0],
  [-179.8, 251.7],
  [-193.2, 233.4],
  [-203.8, 204.8],
  [-210.7, 168.9],
  [-213.0, 129.0],
  [-210.7, 89.1],
  [-203.8, 53.2],
  [-193.2, 24.6],
  [-179.8, 6.3]
];

const AI_LIVERY = [
  { name: "NITRO",   skill: 0.96, body: 0x00c8e8, accent: 0x082830, wing: 0x0a0a0a, rim: 0x88eeff, helmet: 0x00e8ff },
  { name: "VIPER",   skill: 0.90, body: 0x9be000, accent: 0x142000, wing: 0x111111, rim: 0xddff66, helmet: 0xc8ff22 },
  { name: "VERTEX",  skill: 0.93, body: 0xff2d6a, accent: 0x2a0014, wing: 0x1a1a1a, rim: 0xff88aa, helmet: 0xffd0e0 },
  { name: "PHANTOM", skill: 0.86, body: 0xf0f2ff, accent: 0xc40014, wing: 0x111111, rim: 0xffffff, helmet: 0xff3344 }
];
const PLAYER_LIV = { name: "GROK", skill: 1, body: 0xff4a1c, accent: 0x00e8ff, wing: 0x141414, rim: 0xffcc33, helmet: 0x00e8ff };

const canvas = document.getElementById("c");
const mini = document.getElementById("minimap");
const mctx = mini.getContext("2d");
const $ = (id) => document.getElementById(id);

const TOUCH = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
if (TOUCH) document.body.classList.add("touch");
const MOBILE = TOUCH || Math.min(window.innerWidth, window.innerHeight) < 700;
const SHADOWS = !MOBILE;

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function wrap(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function cr(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
function formatTime(t) {
  if (!isFinite(t) || t < 0) return "—";
  const m = Math.floor(t / 60);
  const rest = t - m * 60;
  const s = Math.floor(rest);
  const ms = Math.floor((rest - s) * 1000);
  return m + ":" + String(s).padStart(2, "0") + "." + String(ms).padStart(3, "0");
}

/* -------------------- TRACK -------------------- */
const track = { samples: [], length: 0, minX: 0, maxX: 0, minZ: 0, maxZ: 0 };

function buildTrack() {
  const C = CTRL, nC = C.length;
  const raw = [];
  for (let i = 0; i < nC; i++) {
    const p0 = C[(i - 1 + nC) % nC], p1 = C[i], p2 = C[(i + 1) % nC], p3 = C[(i + 2) % nC];
    const seglen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
    const steps = Math.max(2, Math.ceil(seglen / 3.0));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      raw.push({ x: cr(p0[0], p1[0], p2[0], p3[0], t), z: cr(p0[1], p1[1], p2[1], p3[1], t) });
    }
  }
  const pts = [];
  for (let i = 0; i < raw.length; i++) {
    const p = raw[i];
    if (!pts.length || Math.hypot(p.x - pts[pts.length - 1].x, p.z - pts[pts.length - 1].z) > 0.8) pts.push(p);
  }
  let bestI = 0, bestD = 1e9;
  for (let i = 0; i < pts.length; i++) {
    const d = pts[i].x * pts[i].x + pts[i].z * pts[i].z;
    if (d < bestD) { bestD = d; bestI = i; }
  }
  const samples = pts.slice(bestI).concat(pts.slice(0, bestI));
  const n = samples.length;
  let length = 0;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < n; i++) {
    const a = samples[i], b = samples[(i + 1) % n], p = samples[(i - 1 + n) % n];
    const tx = b.x - p.x, tz = b.z - p.z;
    const tl = Math.hypot(tx, tz) || 1;
    a.tx = tx / tl; a.tz = tz / tl;
    a.nx = a.tz; a.nz = -a.tx;
    a.yaw = Math.atan2(a.tx, a.tz);
    a.dist = length;
    const ds = Math.hypot(b.x - a.x, b.z - a.z);
    length += ds;
    minX = Math.min(minX, a.x); maxX = Math.max(maxX, a.x);
    minZ = Math.min(minZ, a.z); maxZ = Math.max(maxZ, a.z);
  }
  for (let i = 0; i < n; i++) {
    const a = samples[i], b = samples[(i + 1) % n];
    let dy = wrap(b.yaw - a.yaw);
    const ds = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    a.curv = dy / ds;
    const runoff = 6.2 + Math.min(11, Math.abs(a.curv) * 220);
    a.half = HALF;
    a.wall = HALF + runoff;
  }
  track.samples = samples;
  track.length = length;
  track.minX = minX; track.maxX = maxX; track.minZ = minZ; track.maxZ = maxZ;
}

function sampleAt(s) {
  const sm = track.samples, n = sm.length, L = track.length;
  s = ((s % L) + L) % L;
  let lo = 0, hi = n - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (sm[mid].dist <= s) lo = mid; else hi = mid - 1;
  }
  const a = sm[lo], b = sm[(lo + 1) % n];
  let ds = b.dist - a.dist; if (ds <= 0) ds += L;
  const t = ds > 1e-6 ? (((s - a.dist) + L) % L) / ds : 0;
  return {
    x: a.x + (b.x - a.x) * t,
    z: a.z + (b.z - a.z) * t,
    yaw: a.yaw + wrap(b.yaw - a.yaw) * t,
    nx: a.nx + (b.nx - a.nx) * t,
    nz: a.nz + (b.nz - a.nz) * t,
    tx: a.tx, tz: a.tz,
    curv: a.curv, wall: a.wall, half: a.half, i: lo, s, t
  };
}

function project(x, z, hint) {
  const sm = track.samples, n = sm.length;
  let best = ((hint | 0) % n + n) % n, bestD = 1e12;
  for (let k = -34; k <= 34; k++) {
    const i = ((best + k) % n + n) % n;
    const dx = x - sm[i].x, dz = z - sm[i].z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  const a = sm[best];
  const lat = (x - a.x) * a.nx + (z - a.z) * a.nz;
  return { i: best, s: a.dist, lat, nx: a.nx, nz: a.nz, yaw: a.yaw, half: a.half, wall: a.wall, x: a.x, z: a.z, tx: a.tx, tz: a.tz, curv: a.curv };
}

function maxCurvAhead(s, dist) {
  let m = 0;
  for (let k = 1; k <= 10; k++) {
    const c = Math.abs(sampleAt(s + dist * k / 10).curv);
    if (c > m) m = c;
  }
  return m;
}

/* -------------------- THREE SCENE -------------------- */
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x6aa7e8);
scene.fog = new THREE.Fog(0x8ec4ee, 90, 420);

const camera = new THREE.PerspectiveCamera(60, 1, 0.15, 700);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !MOBILE, powerPreference: "high-performance" });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MOBILE ? 1.15 : 1.75));
renderer.setClearColor(0x6aa7e8, 1);
if (SHADOWS) {
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
}

function onResize() {
  const w = window.innerWidth, h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}
window.addEventListener("resize", onResize);
onResize();

const hemi = new THREE.HemisphereLight(0xfff0d8, 0x2d5a28, 0.72);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff3d4, 0.78);
sun.position.set(80, 140, 40);
if (SHADOWS) {
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 420;
  sun.shadow.camera.left = -180;
  sun.shadow.camera.right = 180;
  sun.shadow.camera.top = 180;
  sun.shadow.camera.bottom = -180;
}
scene.add(sun);
scene.add(new THREE.AmbientLight(0x6a80a8, 0.28));

function makeSky() {
  const g = new THREE.SphereGeometry(480, 20, 12);
  const pos = g.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 480;
    let r, gch, b;
    if (y < 0) { r = 0.22; gch = 0.28; b = 0.16; }
    else {
      const t = Math.pow(y, 0.65);
      r = lerp(1.00, 0.28, t);
      gch = lerp(0.62, 0.42, t);
      b = lerp(0.38, 0.78, t);
    }
    col[i * 3] = r; col[i * 3 + 1] = gch; col[i * 3 + 2] = b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
}
scene.add(makeSky());

function box(w, h, d) { return new THREE.BoxGeometry(w, h, d); }
function mesh(geo, mat, shadows) {
  const m = new THREE.Mesh(geo, mat);
  if (shadows !== false && SHADOWS) { m.castShadow = true; m.receiveShadow = true; }
  return m;
}

function addStrip(pos, col, idx, samples, latL, latR, y, colorFn) {
  const base = pos.length / 3;
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    pos.push(s.x + s.nx * latL, y, s.z + s.nz * latL);
    pos.push(s.x + s.nx * latR, y, s.z + s.nz * latR);
    const c0 = colorFn(s, 0), c1 = colorFn(s, 1);
    col.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2]);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = base + i * 2, b = a + 1, c = base + j * 2, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
}

function addWall(pos, col, idx, samples, latSign, y0, y1, colorFn) {
  const base = pos.length / 3;
  const n = samples.length;
  for (let i = 0; i < n; i++) {
    const s = samples[i];
    const lat = latSign * s.wall;
    const x = s.x + s.nx * lat, z = s.z + s.nz * lat;
    pos.push(x, y0, z, x, y1, z);
    const c = colorFn(s);
    col.push(c[0], c[1], c[2], c[0] * 0.7, c[1] * 0.7, c[2] * 0.7);
  }
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const a = base + i * 2, b = a + 1, c = base + j * 2, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
}

function geoFrom(pos, col, idx) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new THREE.BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

buildTrack();
const SM = track.samples;

(function buildWorld() {
  const grass = mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshLambertMaterial({ color: 0x2f9e3e }), true);
  grass.rotation.x = -Math.PI / 2;
  grass.position.y = -0.06;
  grass.receiveShadow = SHADOWS;
  grass.castShadow = false;
  scene.add(grass);

  const pos = [], col = [], idx = [];
  addStrip(pos, col, idx, SM, -HALF - 14, HALF + 14, -0.02, (s) => {
    const gravel = Math.abs(s.curv) > 0.012;
    return gravel ? [0.78, 0.64, 0.34] : [0.22, 0.62, 0.28];
  });
  addStrip(pos, col, idx, SM, -HALF, HALF, 0.04, (s, side) => {
    const dash = ((s.dist * 0.55) % 8) < 0.25 && Math.abs(side - 0.5) < 2;
    if (Math.abs((s.x + s.nx * (side ? HALF : -HALF))) < 0) {}
    const shade = 0.22 + 0.03 * Math.sin(s.dist * 0.2);
    return [shade, shade + 0.01, shade + 0.035];
  });
  addStrip(pos, col, idx, SM, -0.11, 0.11, 0.055, (s) => {
    const on = ((s.dist) % 8) < 4;
    return on ? [0.95, 0.95, 0.92] : [0.22, 0.23, 0.26];
  });
  addStrip(pos, col, idx, SM, -HALF, -HALF + 0.28, 0.057, () => [0.95, 0.95, 0.9]);
  addStrip(pos, col, idx, SM, HALF - 0.28, HALF, 0.057, () => [0.95, 0.95, 0.9]);
  addStrip(pos, col, idx, SM, -HALF - 1.25, -HALF, 0.07, (s) => {
    const red = Math.floor(s.dist / 2.4) % 2 === 0;
    return red ? [0.92, 0.12, 0.14] : [0.96, 0.96, 0.96];
  });
  addStrip(pos, col, idx, SM, HALF, HALF + 1.25, 0.07, (s) => {
    const red = Math.floor(s.dist / 2.4) % 2 === 0;
    return red ? [0.92, 0.12, 0.14] : [0.96, 0.96, 0.96];
  });
  const tMesh = new THREE.Mesh(geoFrom(pos, col, idx), new THREE.MeshLambertMaterial({ vertexColors: true }));
  tMesh.receiveShadow = SHADOWS;
  scene.add(tMesh);

  const wp = [], wc = [], wi = [];
  addWall(wp, wc, wi, SM, 1, 0, 1.12, (s) => (Math.floor(s.dist / 3.2) % 2 ? [1, 0.42, 0.08] : [0.12, 0.38, 0.95]));
  addWall(wp, wc, wi, SM, -1, 0, 1.12, (s) => (Math.floor(s.dist / 3.2) % 2 ? [0.12, 0.38, 0.95] : [1, 0.42, 0.08]));
  const wall = new THREE.Mesh(geoFrom(wp, wc, wi), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  wall.castShadow = SHADOWS;
  scene.add(wall);

  const sf = sampleAt(0);
  const cheq = mesh(box(HALF * 2.05, 0.03, 2.4), new THREE.MeshLambertMaterial({ color: 0xffffff }));
  cheq.position.set(sf.x, 0.08, sf.z);
  cheq.rotation.y = sf.yaw;
  scene.add(cheq);
  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 2; j++) {
      if ((i + j) % 2 === 0) continue;
      const sq = mesh(box(HALF * 2.05 / 8, 0.04, 1.15), new THREE.MeshLambertMaterial({ color: 0x111111 }));
      const lat = -HALF + (i + 0.5) * (HALF * 2 / 8);
      sq.position.set(sf.x + sf.nx * lat + sf.tx * (j - 0.5) * 1.15, 0.09, sf.z + sf.nz * lat + sf.tz * (j - 0.5) * 1.15);
      sq.rotation.y = sf.yaw;
      scene.add(sq);
    }
  }

  const gantry = new THREE.Group();
  const beam = mesh(box(HALF * 2 + 4, 0.22, 0.22), new THREE.MeshLambertMaterial({ color: 0x22262e }));
  beam.position.set(0, 4.1, 0);
  gantry.add(beam);
  [-1, 1].forEach((side) => {
    const post = mesh(box(0.22, 4.2, 0.22), new THREE.MeshLambertMaterial({ color: 0x333845 }));
    post.position.set(side * (HALF + 1.6), 2.1, 0);
    gantry.add(post);
  });
  const startLights = [];
  for (let i = 0; i < 5; i++) {
    const mat = new THREE.MeshLambertMaterial({ color: 0x2a0000, emissive: 0x000000 });
    const sph = mesh(new THREE.SphereGeometry(0.16, 8, 8), mat, false);
    sph.position.set((i - 2) * 0.55, 3.85, 0.2);
    gantry.add(sph);
    startLights.push(sph);
  }
  gantry.position.set(sf.x - sf.tx * 2.5, 0, sf.z - sf.tz * 2.5);
  gantry.rotation.y = sf.yaw;
  scene.add(gantry);
  track.startLights = startLights;

  const nTree = MOBILE ? 28 : 55;
  for (let i = 0; i < nTree; i++) {
    const s = SM[(i * 17 + 9) % SM.length];
    const side = (i % 2 ? 1 : -1);
    const lat = side * (s.wall + 8 + (i * 13) % 18);
    const g = new THREE.Group();
    const trunk = mesh(new THREE.CylinderGeometry(0.28, 0.4, 2.2, 5), new THREE.MeshLambertMaterial({ color: 0x6a3a18 }), false);
    trunk.position.y = 1.1;
    const leaves = mesh(new THREE.ConeGeometry(2.1 + (i % 3) * 0.3, 4.2, 6), new THREE.MeshLambertMaterial({ color: i % 3 === 0 ? 0x1f8a34 : 0x2bb34a }), false);
    leaves.position.y = 3.6;
    g.add(trunk, leaves);
    g.position.set(s.x + s.nx * lat, 0, s.z + s.nz * lat);
    scene.add(g);
  }

  for (let k = 0; k < 6; k++) {
    const s = sampleAt(40 + k * 22);
    const stand = mesh(box(18, 6, 7), new THREE.MeshLambertMaterial({ color: k % 2 ? 0x3a4258 : 0x2a3144 }));
    const lat = -s.wall - 10;
    stand.position.set(s.x + s.nx * lat, 3, s.z + s.nz * lat);
    stand.rotation.y = s.yaw;
    scene.add(stand);
    const crowd = mesh(box(17.2, 1.6, 2.2), new THREE.MeshLambertMaterial({ color: k % 3 === 0 ? 0xff4a1c : k % 3 === 1 ? 0x00e8ff : 0xffe14a }));
    crowd.position.set(s.x + s.nx * lat, 5.4, s.z + s.nz * lat);
    crowd.rotation.y = s.yaw;
    scene.add(crowd);
  }

  for (let k = 0; k < 10; k++) {
    const s = sampleAt(k * (track.length / 10) + 12);
    const ban = mesh(box(0.12, 1.4, 6), new THREE.MeshBasicMaterial({ color: [0xff4a1c, 0x00e8ff, 0xffe14a, 0xff2d6a, 0xb8ff00][k % 5] }));
    const lat = s.wall + 0.2;
    ban.position.set(s.x + s.nx * lat, 2.2, s.z + s.nz * lat);
    ban.rotation.y = s.yaw;
    scene.add(ban);
  }

  for (let i = 0; i < SM.length; i += 10) {
    if (Math.abs(SM[i].curv) < 0.018) continue;
    const s = SM[i];
    for (let t = 0; t < 3; t++) {
      const tire = mesh(new THREE.TorusGeometry(0.38, 0.18, 6, 10), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }), false);
      tire.rotation.x = Math.PI / 2;
      const lat = (s.curv > 0 ? 1 : -1) * (s.wall - 0.6);
      tire.position.set(s.x + s.nx * lat + s.tx * (t - 1) * 0.85, 0.38, s.z + s.nz * lat + s.tz * (t - 1) * 0.85);
      scene.add(tire);
    }
  }

  const hillM = new THREE.MeshLambertMaterial({ color: 0x3d8c4a });
  [[-90, -80, 28], [120, -90, 22], [40, 360, 36], [-280, 80, 40], [360, 160, 32]].forEach((h) => {
    const hill = mesh(new THREE.SphereGeometry(h[2], 8, 6), hillM, false);
    hill.position.set(h[0], -h[2] * 0.35, h[1]);
    scene.add(hill);
  });
})();

/* -------------------- CARS -------------------- */
function makeCar(liv) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: liv.body });
  const accent = new THREE.MeshLambertMaterial({ color: liv.accent });
  const wing = new THREE.MeshLambertMaterial({ color: liv.wing });
  const black = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const rubber = new THREE.MeshLambertMaterial({ color: 0x161616 });
  const rim = new THREE.MeshLambertMaterial({ color: liv.rim });
  const halo = new THREE.MeshLambertMaterial({ color: 0x9aa8b8 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x0c121c });
  const helmet = new THREE.MeshLambertMaterial({ color: liv.helmet });
  const light = new THREE.MeshLambertMaterial({ color: 0xff2200, emissive: 0x661100 });

  const chassis = mesh(box(0.78, 0.22, 3.05), body);
  chassis.position.set(0, 0.34, 0.05);
  g.add(chassis);
  const nose = mesh(box(0.26, 0.14, 1.15), body);
  nose.position.set(0, 0.30, 1.85);
  g.add(nose);
  const engine = mesh(box(0.62, 0.36, 1.15), body);
  engine.position.set(0, 0.52, -0.55);
  g.add(engine);
  const podL = mesh(box(0.42, 0.28, 1.35), accent);
  podL.position.set(-0.52, 0.34, -0.15);
  const podR = mesh(box(0.42, 0.28, 1.35), accent);
  podR.position.set(0.52, 0.34, -0.15);
  g.add(podL, podR);

  const fw = new THREE.Group();
  fw.name = "frontWing";
  const fwMain = mesh(box(1.92, 0.055, 0.42), wing);
  fwMain.position.set(0, 0.15, 2.28);
  const fwP1 = mesh(box(0.055, 0.22, 0.42), accent);
  fwP1.position.set(-0.94, 0.22, 2.28);
  const fwP2 = mesh(box(0.055, 0.22, 0.42), accent);
  fwP2.position.set(0.94, 0.22, 2.28);
  const fwEl = mesh(box(1.6, 0.03, 0.18), wing);
  fwEl.position.set(0, 0.21, 2.18);
  fw.add(fwMain, fwP1, fwP2, fwEl);
  g.add(fw);

  const pit = mesh(box(0.5, 0.26, 0.72), glass);
  pit.position.set(0, 0.55, 0.42);
  g.add(pit);
  const helm = mesh(new THREE.SphereGeometry(0.16, 8, 6), helmet, false);
  helm.position.set(0, 0.68, 0.48);
  g.add(helm);
  const haloM = mesh(new THREE.TorusGeometry(0.30, 0.032, 6, 10, Math.PI), halo, false);
  haloM.rotation.x = Math.PI / 2;
  haloM.position.set(0, 0.66, 0.42);
  g.add(haloM);

  const rw = new THREE.Group();
  rw.name = "rearWing";
  const rwMain = mesh(box(1.55, 0.08, 0.36), wing);
  rwMain.position.set(0, 0.92, -1.62);
  const rwLow = mesh(box(1.45, 0.05, 0.28), wing);
  rwLow.position.set(0, 0.72, -1.62);
  const rwP1 = mesh(box(0.05, 0.55, 0.38), accent);
  rwP1.position.set(-0.78, 0.72, -1.62);
  const rwP2 = mesh(box(0.05, 0.55, 0.38), accent);
  rwP2.position.set(0.78, 0.72, -1.62);
  rw.add(rwMain, rwLow, rwP1, rwP2);
  g.add(rw);

  const rl = mesh(box(0.12, 0.08, 0.12), light, false);
  rl.position.set(-0.28, 0.42, -1.55);
  const rr = mesh(box(0.12, 0.08, 0.12), light, false);
  rr.position.set(0.28, 0.42, -1.55);
  g.add(rl, rr);

  const wheels = [];
  const wpos = [[-0.82, 1.38], [0.82, 1.38], [-0.82, -1.42], [0.82, -1.42]];
  wpos.forEach((p) => {
    const w = new THREE.Group();
    const tire = mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.32, 10), rubber);
    tire.rotation.z = Math.PI / 2;
    const disc = mesh(new THREE.CylinderGeometry(0.20, 0.20, 0.34, 10), rim, false);
    disc.rotation.z = Math.PI / 2;
    w.add(tire, disc);
    w.position.set(p[0], 0.36, p[1]);
    g.add(w);
    wheels.push(w);
  });

  g.userData = { frontWing: fw, rearWing: rw, wheels, bodyMat: body, accentMat: accent, liv, origBody: liv.body, origAccent: liv.accent };
  return g;
}

function makeDriver(liv, isPlayer) {
  return {
    x: 0, z: 0, yaw: 0, vx: 0, vz: 0, speed: 0, steer: 0, spin: 0,
    throttle: 0, brake: 0, handbrake: 0, steerIn: 0,
    damage: 0, dead: false, dnfAt: 0,
    lapsCompleted: 0, armed: false, s: 0, hint: 0, lat: 0,
    lapStart: 0, lastLap: -1, bestLap: -1, raceTime: 0,
    slip: 0, hitCD: 0, scrape: 0,
    isPlayer, name: liv.name, skill: liv.skill, liv,
    mesh: makeCar(liv),
    smokeAcc: 0
  };
}

const player = makeDriver(PLAYER_LIV, true);
const ais = AI_LIVERY.map((l) => makeDriver(l, false));
const cars = [player, ...ais];
cars.forEach((c) => scene.add(c.mesh));

/* -------------------- PARTICLES -------------------- */
const PMAX = MOBILE ? 220 : 380;
const pLife = new Float32Array(PMAX);
const pX = new Float32Array(PMAX), pY = new Float32Array(PMAX), pZ = new Float32Array(PMAX);
const pVX = new Float32Array(PMAX), pVY = new Float32Array(PMAX), pVZ = new Float32Array(PMAX);
const pCol = new Float32Array(PMAX * 3);
const pGeo = new THREE.BufferGeometry();
const pPosArr = new Float32Array(PMAX * 3);
pGeo.setAttribute("position", new THREE.BufferAttribute(pPosArr, 3));
pGeo.setAttribute("color", new THREE.BufferAttribute(pCol, 3));
const pMesh = new THREE.Points(pGeo, new THREE.PointsMaterial({
  size: 0.62, vertexColors: true, transparent: true, opacity: 0.78, depthWrite: false, sizeAttenuation: true
}));
scene.add(pMesh);
let pHead = 0;

function spawnP(x, y, z, vx, vy, vz, r, g, b, life) {
  const i = pHead++ % PMAX;
  pX[i] = x; pY[i] = y; pZ[i] = z;
  pVX[i] = vx; pVY[i] = vy; pVZ[i] = vz;
  pLife[i] = life;
  pCol[i * 3] = r; pCol[i * 3 + 1] = g; pCol[i * 3 + 2] = b;
}

function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    if (pLife[i] <= 0) {
      pPosArr[i * 3 + 1] = -20;
      continue;
    }
    pLife[i] -= dt;
    pX[i] += pVX[i] * dt;
    pY[i] += pVY[i] * dt;
    pZ[i] += pVZ[i] * dt;
    pVY[i] += 1.6 * dt;
    pVX[i] *= 0.98; pVZ[i] *= 0.98;
    pPosArr[i * 3] = pX[i];
    pPosArr[i * 3 + 1] = pY[i];
    pPosArr[i * 3 + 2] = pZ[i];
    const fade = clamp(pLife[i], 0, 1);
    pCol[i * 3] *= 0.99;
    pCol[i * 3 + 1] *= 0.99;
    pCol[i * 3 + 2] *= 0.99;
    if (fade < 0.2) pPosArr[i * 3 + 1] -= (0.2 - fade) * 4;
  }
  pGeo.attributes.position.needsUpdate = true;
  pGeo.attributes.color.needsUpdate = true;
}

/* -------------------- PHYSICS -------------------- */
function placeCar(car, s, lat) {
  const p = sampleAt(s);
  car.x = p.x + p.nx * lat;
  car.z = p.z + p.nz * lat;
  car.yaw = p.yaw;
  car.vx = 0; car.vz = 0; car.speed = 0; car.steer = 0; car.spin = 0;
  car.s = ((s % track.length) + track.length) % track.length;
  car.hint = p.i;
  car.lat = lat;
  car.damage = 0; car.dead = false; car.dnfAt = 0;
  car.lapsCompleted = 0; car.armed = false;
  car.lapStart = 0; car.lastLap = -1; car.bestLap = -1; car.raceTime = 0;
  car.hitCD = 0; car.slip = 0;
  applyDamageVisual(car);
}

function applyDamageVisual(car) {
  const d = car.damage;
  const ud = car.mesh.userData;
  ud.frontWing.visible = d < 52;
  ud.rearWing.visible = d < 78;
  ud.frontWing.rotation.z = Math.min(d, 50) * 0.014;
  ud.frontWing.rotation.x = d > 28 ? (d - 28) * 0.012 : 0;
  ud.frontWing.position.y = -d * 0.0018;
  ud.rearWing.rotation.z = d > 40 ? (d - 40) * 0.018 : 0;
  ud.rearWing.rotation.x = d > 55 ? -0.35 : 0;
  const t = clamp(d / 120, 0, 1);
  ud.bodyMat.color.setHex(ud.origBody).lerp(new THREE.Color(0x2a241f), t);
}

function impactFX(mag) {
  shake = Math.min(1.6, shake + mag * 0.045);
  impactEl.style.opacity = clamp(mag / 28, 0, 0.85);
  crashSound(mag);
}

function hurtCar(car, amt, spinKick) {
  if (car.dead) return;
  car.damage = clamp(car.damage + amt, 0, 100);
  car.spin += spinKick || 0;
  applyDamageVisual(car);
  if (car.damage >= 100) {
    car.dead = true;
    car.dnfAt = 1.35;
    car.spin += (Math.random() < 0.5 ? -1 : 1) * 3.2;
    if (car.isPlayer) impactFX(24);
  }
}

function physicsCar(car, dt) {
  const p = project(car.x, car.z, car.hint);
  car.hint = p.i;
  car.s = p.s;
  car.lat = p.lat;
  const onAsphalt = Math.abs(p.lat) <= p.half + 0.4;
  const onKerb = Math.abs(p.lat) > p.half - 0.2 && Math.abs(p.lat) < p.half + 1.4;
  const onGrass = !onAsphalt && Math.abs(p.lat) < p.wall - 0.2;
  const dmgT = car.damage / 100;
  const gripBase = lerp(1.05, 0.42, dmgT);
  const surfGrip = onAsphalt ? 1 : onKerb ? 0.72 : onGrass ? 0.38 : 0.22;
  const grip = gripBase * surfGrip * (car.handbrake ? 0.28 : 1);
  const maxSpeed = lerp(76, 34, dmgT * 0.92) * (onAsphalt ? 1 : 0.55);
  const accel = lerp(30, 13, dmgT);

  if (!car.dead && state === "racing") {
    if (car.throttle) car.speed += accel * car.throttle * dt;
    if (car.brake) car.speed -= 46 * car.brake * dt;
  }
  if (car.dead) car.speed *= Math.pow(0.22, dt);

  const drag = (onAsphalt ? 1 : 3.4) * (1 + dmgT * 0.5);
  car.speed -= Math.sign(car.speed) * (2.4 + 0.014 * car.speed * car.speed * drag) * dt;
  if (car.handbrake) car.speed -= Math.sign(car.speed) * 28 * dt;
  if (car.speed > maxSpeed) car.speed = lerp(car.speed, maxSpeed, 1 - Math.pow(0.02, dt));
  if (!car.brake && car.speed < 0) car.speed = 0;
  if (car.speed < -14) car.speed = -14;

  const wobble = dmgT > 0.55 ? Math.sin(clock * 17) * dmgT * 0.25 : 0;
  const maxSteer = 0.48 / (1 + Math.abs(car.speed) * 0.038);
  const want = clamp(car.steerIn + wobble, -1, 1) * maxSteer;
  car.steer = lerp(car.steer, want, 1 - Math.pow(0.0008, dt));

  const desiredYaw = (car.speed / WHEELBASE) * Math.tan(car.steer);
  const maxYaw = (grip * 11.5) / Math.max(Math.abs(car.speed), 5);
  const yawRate = clamp(desiredYaw, -maxYaw, maxYaw);
  car.slip = desiredYaw - yawRate;
  if (car.handbrake) car.spin += -car.steerIn * 2.8 * dt * Math.min(1, Math.abs(car.speed) / 20);
  car.spin *= Math.pow(0.12, dt);
  if (car.dead) car.spin *= Math.pow(0.45, dt);

  car.yaw += (yawRate + car.spin) * dt;

  const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
  const rx = Math.cos(car.yaw), rz = -Math.sin(car.yaw);
  const targetVx = fx * car.speed;
  const targetVz = fz * car.speed;
  const align = 1 - Math.exp(-grip * 9 * dt);
  car.vx = lerp(car.vx, targetVx, align);
  car.vz = lerp(car.vz, targetVz, align);
  car.vx += rx * car.slip * Math.abs(car.speed) * 0.12 * dt;
  car.vz += rz * car.slip * Math.abs(car.speed) * 0.12 * dt;

  car.x += car.vx * dt;
  car.z += car.vz * dt;

  const p2 = project(car.x, car.z, car.hint);
  car.hint = p2.i;
  const limit = p2.wall - CAR_R;
  if (Math.abs(p2.lat) > limit) {
    const sign = Math.sign(p2.lat) || 1;
    const over = Math.abs(p2.lat) - limit;
    car.x -= p2.nx * over * sign;
    car.z -= p2.nz * over * sign;
    const into = car.vx * p2.nx * sign + car.vz * p2.nz * sign;
    if (into > 0) {
      car.vx -= p2.nx * sign * into * 1.15;
      car.vz -= p2.nz * sign * into * 1.15;
      car.speed = car.vx * Math.sin(car.yaw) + car.vz * Math.cos(car.yaw);
    }
    if (into > 3.2 && car.hitCD <= 0) {
      const amt = 2.0 * into + 0.10 * into * into;
      const kick = (Math.random() - 0.5) * into * 0.18 + Math.sign(car.steerIn || 1) * into * 0.04;
      hurtCar(car, amt, kick);
      car.hitCD = 0.22;
      car.speed *= 0.42;
      if (car.isPlayer) impactFX(into);
      for (let k = 0; k < 10; k++) {
        spawnP(car.x, 0.4, car.z, (Math.random() - 0.5) * 8, 2 + Math.random() * 4, (Math.random() - 0.5) * 8, 1, 0.6 + Math.random() * 0.3, 0.15, 0.35 + Math.random() * 0.3);
      }
    } else if (Math.abs(car.speed) > 8) {
      car.scrape += dt;
      hurtCar(car, 7.5 * dt * (Math.abs(car.speed) / 40), 0);
      if (car.isPlayer && Math.random() < 0.4) {
        spawnP(car.x, 0.2, car.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 1, 0.75, 0.2, 0.2);
      }
      car.speed *= Math.pow(0.55, dt);
    }
  }

  if (Math.abs(car.slip) > 0.35 && Math.abs(car.speed) > 18 && Math.random() < 0.6) {
    spawnP(car.x - fx * 1.4 + rx * 0.7, 0.12, car.z - fz * 1.4 + rz * 0.7, -car.vx * 0.1, 0.4, -car.vz * 0.1, 0.55, 0.55, 0.55, 0.45);
  }

  const smoke = car.damage > 22 ? (car.damage - 22) / 78 : 0;
  car.smokeAcc += smoke * dt * 28;
  while (car.smokeAcc > 1) {
    car.smokeAcc -= 1;
    const gray = 0.25 + Math.random() * 0.25;
    spawnP(car.x - fx * 1.7, 0.7, car.z - fz * 1.7, -fx * 1.2 + (Math.random() - 0.5) * 1.4, 1.8 + Math.random() * 2.2, -fz * 1.2 + (Math.random() - 0.5) * 1.4, gray, gray, gray, 0.7 + Math.random() * 0.6);
  }

  if (car.hitCD > 0) car.hitCD -= dt;

  const prevS = car._prevS == null ? car.s : car._prevS;
  if (car.s > 90 && car.s < track.length * 0.55) car.armed = true;
  if (car.armed && prevS > track.length * 0.72 && car.s < track.length * 0.22) {
    car.armed = false;
    onLap(car);
  }
  car._prevS = car.s;
}

function carCollisions() {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i], b = cars[j];
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz) || 0.0001;
      const minD = CAR_R * 2.05;
      if (d >= minD) continue;
      const nx = dx / d, nz = dz / d;
      const overlap = minD - d;
      a.x -= nx * overlap * 0.5; a.z -= nz * overlap * 0.5;
      b.x += nx * overlap * 0.5; b.z += nz * overlap * 0.5;
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const imp = -rel * 0.55;
        a.vx -= nx * imp; a.vz -= nz * imp;
        b.vx += nx * imp; b.vz += nz * imp;
        a.speed = a.vx * Math.sin(a.yaw) + a.vz * Math.cos(a.yaw);
        b.speed = b.vx * Math.sin(b.yaw) + b.vz * Math.cos(b.yaw);
        const mag = -rel;
        if (mag > 4 && a.hitCD <= 0 && b.hitCD <= 0) {
          hurtCar(a, mag * 1.15, (Math.random() - 0.5) * mag * 0.08);
          hurtCar(b, mag * 1.15, (Math.random() - 0.5) * mag * 0.08);
          a.hitCD = b.hitCD = 0.18;
          if (a.isPlayer || b.isPlayer) impactFX(mag);
        }
      }
    }
  }
}

function aiDrive(car, dt) {
  if (car.dead || state !== "racing") { car.throttle = 0; car.brake = 0; car.steerIn = 0; return; }
  const look = 14 + Math.abs(car.speed) * 0.48;
  const fut = sampleAt(car.s + look);
  const lineLat = clamp(-fut.curv * 90, -2.6, 2.6);
  const tx = fut.x + fut.nx * lineLat;
  const tz = fut.z + fut.nz * lineLat;
  const wantYaw = Math.atan2(tx - car.x, tz - car.z);
  car.steerIn = clamp(wrap(wantYaw - car.yaw) * 1.65, -1, 1);

  const c = maxCurvAhead(car.s, 18 + car.speed * 0.5);
  const safe = Math.sqrt((18 * car.skill * (1 - car.damage * 0.004)) / Math.max(c, 0.0015));
  const cap = safe * (0.90 + car.skill * 0.12);
  if (car.speed > cap) { car.throttle = 0; car.brake = clamp((car.speed - cap) / 14, 0.2, 1); }
  else { car.throttle = 1; car.brake = 0; }

  for (let i = 0; i < cars.length; i++) {
    const o = cars[i];
    if (o === car) continue;
    let ds = o.s - car.s; if (ds < -track.length * 0.5) ds += track.length;
    if (ds > 0 && ds < 16 && Math.abs(o.lat - car.lat) < 3.2) {
      car.steerIn = clamp(car.steerIn + (car.lat >= o.lat ? 0.45 : -0.45), -1, 1);
      if (ds < 8) car.brake = Math.max(car.brake, 0.35);
    }
  }
  if (Math.abs(car.lat) > HALF - 1.2) car.steerIn += -Math.sign(car.lat) * 0.5;
}

function progressOf(car) {
  let p = car.lapsCompleted + car.s / track.length;
  if (car.lapsCompleted === 0 && car.s > track.length * 0.5) p = car.s / track.length - 1;
  return p;
}

function standings() {
  const arr = cars.map((c, i) => ({ c, i, p: progressOf(c) }));
  arr.sort((a, b) => b.p - a.p);
  return arr;
}

/* -------------------- AUDIO -------------------- */
let actx = null, osc = null, gain = null, muted = false;
function ensureAudio() {
  if (actx || muted) return;
  try {
    actx = new (window.AudioContext || window.webkitAudioContext)();
    osc = actx.createOscillator();
    gain = actx.createGain();
    osc.type = "sawtooth";
    osc.frequency.value = 70;
    gain.gain.value = 0;
    const filt = actx.createBiquadFilter();
    filt.type = "lowpass";
    filt.frequency.value = 900;
    osc.connect(filt); filt.connect(gain); gain.connect(actx.destination);
    osc.start();
  } catch (e) { actx = null; }
}
function engineTick() {
  if (!actx || muted || !gain) return;
  if (actx.state === "suspended") actx.resume();
  const moving = state === "racing" || state === "countdown";
  const rpm = 70 + Math.abs(player.speed) * 16 + player.throttle * 28;
  osc.frequency.setTargetAtTime(rpm, actx.currentTime, 0.06);
  const vol = muted ? 0 : (moving ? 0.035 + Math.abs(player.speed) * 0.0011 : 0);
  gain.gain.setTargetAtTime(vol, actx.currentTime, 0.08);
}
function crashSound(mag) {
  if (!actx || muted) return;
  try {
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = "square";
    o.frequency.value = 80 + mag * 4;
    g.gain.value = clamp(mag / 40, 0.04, 0.16);
    o.connect(g); g.connect(actx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + 0.18);
    o.stop(actx.currentTime + 0.2);
  } catch (e) {}
}
$("mute").addEventListener("click", () => {
  muted = !muted;
  $("mute").classList.toggle("off", muted);
  $("mute").textContent = muted ? "×" : "♪";
  if (gain) gain.gain.value = 0;
});

/* -------------------- INPUT -------------------- */
const keys = Object.create(null);
const input = { steer: 0, throttle: 0, brake: 0, handbrake: 0 };
window.addEventListener("keydown", (e) => {
  keys[e.code] = true;
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (e.code === "Enter") {
    if (state === "title") startRace();
    else if (state === "finish" || state === "dnf") retry();
  }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

let touchSteer = 0, touchThrottle = 0, touchBrake = 0;
function bindHold(el, on, off) {
  const down = (e) => { e.preventDefault(); on(); };
  const up = (e) => { e.preventDefault(); off(); };
  el.addEventListener("pointerdown", down);
  el.addEventListener("pointerup", up);
  el.addEventListener("pointercancel", up);
  el.addEventListener("pointerleave", up);
}
if (TOUCH) {
  $("touch-ui").classList.remove("hidden");
  $("touch-ui").classList.add("hidden");
  bindHold($("btn-accel"), () => { touchThrottle = 1; }, () => { touchThrottle = 0; });
  bindHold($("btn-brake"), () => { touchBrake = 1; }, () => { touchBrake = 0; });
  const pad = $("steer-pad"), stick = $("steer-stick");
  let pid = null;
  function steerFrom(e) {
    const r = pad.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 2 - 1;
    touchSteer = clamp(x * 1.35, -1, 1);
    stick.style.transform = "translateX(" + (touchSteer * 38) + "px)";
  }
  pad.addEventListener("pointerdown", (e) => { pid = e.pointerId; pad.setPointerCapture(pid); steerFrom(e); });
  pad.addEventListener("pointermove", (e) => { if (e.pointerId === pid) steerFrom(e); });
  const end = (e) => { if (e.pointerId === pid) { pid = null; touchSteer = 0; stick.style.transform = ""; } };
  pad.addEventListener("pointerup", end);
  pad.addEventListener("pointercancel", end);
}

function readInput() {
  const l = keys.KeyA || keys.ArrowLeft;
  const r = keys.KeyD || keys.ArrowRight;
  const t = keys.KeyW || keys.ArrowUp;
  const b = keys.KeyS || keys.ArrowDown || keys.Space;
  input.steer = (r ? 1 : 0) - (l ? 1 : 0) + touchSteer;
  input.steer = clamp(input.steer, -1, 1);
  input.throttle = (t || touchThrottle) ? 1 : 0;
  input.brake = (b || touchBrake) ? 1 : 0;
  input.handbrake = keys.ShiftLeft || keys.ShiftRight ? 1 : 0;
}

/* -------------------- STATE / UI -------------------- */
let state = "title";
let clock = 0, shake = 0, countT = 0, countPhase = 0;
let raceClock = 0, bestEver = 0;
try { bestEver = parseFloat(localStorage.getItem(LS) || "0") || 0; } catch (e) { bestEver = 0; }
const impactEl = $("impact");
const countdownEl = $("countdown");
const lapFlash = $("lap-flash");

function setLights(n) {
  const ls = track.startLights || [];
  ls.forEach((sph, i) => {
    if (i < n) { sph.material.emissive.setHex(0xff1a1a); sph.material.color.setHex(0xff3333); }
    else { sph.material.emissive.setHex(0x000000); sph.material.color.setHex(0x2a0000); }
  });
}

function gridUp() {
  const spots = [
    { car: ais[0], s: -6, lat: -2.15 },
    { car: ais[1], s: -6, lat: 2.15 },
    { car: player, s: -14, lat: -2.15 },
    { car: ais[2], s: -14, lat: 2.15 },
    { car: ais[3], s: -22, lat: -2.15 }
  ];
  spots.forEach((sp) => placeCar(sp.car, sp.s, sp.lat));
}

function showOverlay(which) {
  $("overlay").classList.add("show");
  $("title-card").classList.toggle("hidden", which !== "title");
  $("finish-card").classList.toggle("hidden", which !== "finish");
  $("dnf-card").classList.toggle("hidden", which !== "dnf");
}
function hideOverlay() { $("overlay").classList.remove("show"); }

function setHud(on) {
  $("hud").classList.toggle("hidden", !on);
  document.body.classList.toggle("racing", on);
  if (TOUCH) $("touch-ui").classList.toggle("hidden", !on);
}

function flashLap(text) {
  lapFlash.textContent = text;
  lapFlash.classList.add("show");
  setTimeout(() => lapFlash.classList.remove("show"), 1100);
}

function onLap(car) {
  car.lapsCompleted += 1;
  const t = raceClock - car.lapStart;
  car.lastLap = t;
  car.lapStart = raceClock;
  if (car.bestLap < 0 || t < car.bestLap) car.bestLap = t;
  if (car.isPlayer) {
    if (t > 5 && (bestEver <= 0 || t < bestEver)) {
      bestEver = t;
      try { localStorage.setItem(LS, String(bestEver)); } catch (e) {}
    }
    if (car.lapsCompleted >= LAPS) finishRace();
    else flashLap("LAP " + (car.lapsCompleted + 1) + "  " + formatTime(t));
  }
}

function startRace() {
  ensureAudio();
  gridUp();
  cars.forEach((c) => { c.lapStart = 0; c.raceTime = 0; });
  raceClock = 0;
  countT = 0; countPhase = 0;
  state = "countdown";
  hideOverlay();
  setHud(true);
  setLights(0);
  countdownEl.textContent = "";
  countdownEl.classList.remove("go");
  camPos.set(player.x - Math.sin(player.yaw) * 9.2, 3.4, player.z - Math.cos(player.yaw) * 9.2);
  shake = 0;
  keys.Space = false;
}

function retry() {
  startRace();
}

function finishRace() {
  if (state !== "racing") return;
  state = "finish";
  const st = standings();
  const pos = st.findIndex((x) => x.c === player) + 1;
  const titles = { 1: "P1 · LIGHTS TO FLAG", 2: "P2 · STRONG HAUL", 3: "P3 · ON THE BOX", 4: "P4 · POINTS-ISH", 5: "P5 · AT LEAST YOU FINISHED" };
  $("finish-kicker").textContent = "CHEQUERED FLAG";
  $("finish-title").textContent = "P" + pos;
  $("finish-msg").textContent = titles[pos] || ("P" + pos);
  $("finish-stats").innerHTML =
    "<div><span class='label'>TOTAL</span>" + formatTime(raceClock) + "</div>" +
    "<div><span class='label'>BEST LAP</span>" + formatTime(player.bestLap) + "</div>" +
    "<div><span class='label'>DAMAGE</span>" + Math.round(player.damage) + "%</div>" +
    "<div><span class='label'>LAPS</span>" + LAPS + "/" + LAPS + "</div>";
  setHud(true);
  if (TOUCH) $("touch-ui").classList.add("hidden");
  showOverlay("finish");
}

function dnfRace() {
  if (state !== "racing") return;
  state = "dnf";
  const st = standings();
  const pos = st.findIndex((x) => x.c === player) + 1;
  $("dnf-msg").textContent = "Wings gone. Chassis cooked. That's a bin.";
  $("dnf-stats").innerHTML =
    "<div><span class='label'>LAP</span>" + Math.min(player.lapsCompleted + 1, LAPS) + "/" + LAPS + "</div>" +
    "<div><span class='label'>POS</span>P" + pos + "</div>" +
    "<div><span class='label'>TIME</span>" + formatTime(raceClock) + "</div>" +
    "<div><span class='label'>DAMAGE</span>100%</div>";
  if (TOUCH) $("touch-ui").classList.add("hidden");
  showOverlay("dnf");
}

function goTitle() {
  state = "title";
  gridUp();
  setHud(false);
  setLights(0);
  showOverlay("title");
  if (bestEver > 0) $("title-best").textContent = "BEST LAP  " + formatTime(bestEver);
}

$("play-btn").addEventListener("click", startRace);
$("retry-btn").addEventListener("click", retry);
$("dnf-retry-btn").addEventListener("click", retry);
$("finish-menu-btn").addEventListener("click", goTitle);
$("dnf-menu-btn").addEventListener("click", goTitle);

/* -------------------- CAMERA / HUD / MINIMAP -------------------- */
const camPos = new THREE.Vector3(0, 12, -20);
const camLook = new THREE.Vector3();

function updateCamera(dt) {
  if (state === "title") {
    const p = sampleAt((clock * 22) % track.length);
    camPos.set(p.x - p.tx * 10 + p.nx * 12, 7.5, p.z - p.tz * 10 + p.nz * 12);
    camera.position.copy(camPos);
    camera.lookAt(p.x, 0.6, p.z);
    camera.fov = 58;
    camera.updateProjectionMatrix();
    return;
  }
  const back = 8.6 + Math.min(3.5, Math.abs(player.speed) * 0.05);
  const height = 3.15 + Math.abs(player.speed) * 0.012;
  const wantX = player.x - Math.sin(player.yaw) * back;
  const wantZ = player.z - Math.cos(player.yaw) * back;
  const k = 1 - Math.pow(0.008, dt);
  camPos.x = lerp(camPos.x, wantX, k);
  camPos.z = lerp(camPos.z, wantZ, k);
  camPos.y = lerp(camPos.y, height, k);
  if (shake > 0) {
    camPos.x += (Math.random() - 0.5) * shake * 0.45;
    camPos.y += (Math.random() - 0.5) * shake * 0.25;
    shake = Math.max(0, shake - dt * 3.5);
  }
  camera.position.copy(camPos);
  camLook.set(
    player.x + Math.sin(player.yaw) * 7.5,
    0.55,
    player.z + Math.cos(player.yaw) * 7.5
  );
  camera.lookAt(camLook);
  const fov = 58 + Math.min(11, Math.abs(player.speed) * 0.12);
  if (Math.abs(camera.fov - fov) > 0.2) {
    camera.fov = fov;
    camera.updateProjectionMatrix();
  }
}

function dmgLabel(d) {
  if (d < 8) return "CLEAN";
  if (d < 25) return "SCUFFED";
  if (d < 45) return "FRONT WING";
  if (d < 65) return "SMOKING";
  if (d < 85) return "REAR WING GONE";
  if (d < 100) return "CHASSIS CRACKING";
  return "TERMINAL";
}

function updateHUD() {
  if (state === "title") return;
  const st = standings();
  const pos = st.findIndex((x) => x.c === player) + 1;
  const lapShow = Math.min(player.lapsCompleted + 1, LAPS);
  $("lap").innerHTML = lapShow + "<span class='dim'>/" + LAPS + "</span>";
  $("pos").innerHTML = "P" + pos + "<span class='dim'>/5</span>";
  const lt = state === "countdown" ? 0 : raceClock - player.lapStart;
  $("laptime").textContent = formatTime(lt);
  $("best").textContent = player.bestLap > 0 ? formatTime(player.bestLap) : (bestEver > 0 ? formatTime(bestEver) : "—");
  const kmh = Math.max(0, Math.round(Math.abs(player.speed) * 3.6));
  $("speed").textContent = String(kmh);
  const gear = kmh < 8 ? "N" : String(clamp(1 + Math.floor(kmh / 38), 1, 8));
  $("gear").textContent = gear;
  const d = player.damage;
  $("dmg-fill").style.width = d + "%";
  $("dmg-txt").textContent = dmgLabel(d);
  $("dmg-txt").style.color = d > 70 ? "#ff2d6a" : d > 40 ? "#ff4a1c" : "#b8ff00";
  impactEl.style.opacity = String(Math.max(0, parseFloat(impactEl.style.opacity || "0") - 0.045));
}

function drawMini() {
  const w = mini.width, h = mini.height;
  mctx.clearRect(0, 0, w, h);
  const pad = 16;
  const bw = track.maxX - track.minX, bh = track.maxZ - track.minZ;
  const sc = Math.min((w - pad * 2) / bw, (h - pad * 2) / bh);
  const ox = pad - track.minX * sc;
  const oy = pad - track.minZ * sc;
  function sx(x) { return ox + x * sc; }
  function sy(z) { return oy + z * sc; }
  mctx.lineJoin = "round";
  mctx.lineCap = "round";
  mctx.strokeStyle = "#1c2420";
  mctx.lineWidth = 9;
  mctx.beginPath();
  SM.forEach((s, i) => { if (i === 0) mctx.moveTo(sx(s.x), sy(s.z)); else mctx.lineTo(sx(s.x), sy(s.z)); });
  mctx.closePath(); mctx.stroke();
  mctx.strokeStyle = "#3a3f4a";
  mctx.lineWidth = 5;
  mctx.stroke();
  mctx.strokeStyle = "#e8ecf8";
  mctx.lineWidth = 1;
  mctx.setLineDash([4, 4]);
  mctx.stroke();
  mctx.setLineDash([]);
  const colors = ["#ff4a1c", "#00c8e8", "#9be000", "#ff2d6a", "#f0f2ff"];
  cars.forEach((c, i) => {
    mctx.fillStyle = colors[i];
    mctx.beginPath();
    mctx.arc(sx(c.x), sy(c.z), c.isPlayer ? 4.2 : 3.1, 0, Math.PI * 2);
    mctx.fill();
    if (c.isPlayer) {
      mctx.strokeStyle = "#ffe14a";
      mctx.lineWidth = 1.5;
      mctx.stroke();
    }
  });
}

function syncMeshes() {
  cars.forEach((c) => {
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.yaw;
    const spin = c.speed * 2.15;
    c.mesh.userData.wheels.forEach((w, i) => {
      w.rotation.x += spin * 0.016;
      if (i < 2) w.rotation.y = c.steer * 0.55;
    });
  });
}

/* -------------------- LOOP -------------------- */
function updateCountdown(dt) {
  countT += dt;
  const beats = [0.9, 1.8, 2.7, 3.6];
  if (countPhase < 3 && countT >= beats[countPhase]) {
    countPhase++;
    setLights(countPhase);
    countdownEl.textContent = String(4 - countPhase);
    countdownEl.classList.add("show");
    countdownEl.classList.remove("go");
  }
  if (countPhase === 3 && countT >= beats[3]) {
    countPhase = 4;
    setLights(0);
    countdownEl.textContent = "GO";
    countdownEl.classList.add("show", "go");
    state = "racing";
    cars.forEach((c) => { c.lapStart = 0; });
    raceClock = 0;
    setTimeout(() => countdownEl.classList.remove("show"), 500);
  }
  player.steerIn = input.steer;
  player.throttle = input.throttle;
  player.brake = 0;
  player.handbrake = 0;
  cars.forEach((c) => {
    const spin = (c.isPlayer ? player.throttle : 1) * 0.4;
    c.mesh.userData.wheels.forEach((w) => { w.rotation.x += spin; });
    c.mesh.position.set(c.x, 0, c.z);
    c.mesh.rotation.y = c.yaw;
  });
}

document.addEventListener("visibilitychange", () => { last = performance.now(); });
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock += dt;
  readInput();
  engineTick();

  if (state === "countdown") {
    updateCountdown(dt);
  } else if (state === "racing") {
    raceClock += dt;
    player.steerIn = input.steer;
    player.throttle = input.throttle;
    player.brake = input.brake;
    player.handbrake = input.handbrake;
    ais.forEach((a) => aiDrive(a, dt));
    const steps = dt > 0.02 ? 2 : 1;
    const h = dt / steps;
    for (let s = 0; s < steps; s++) {
      cars.forEach((c) => physicsCar(c, h));
      carCollisions();
    }
    if (player.dead) {
      player.dnfAt -= dt;
      if (player.dnfAt <= 0) dnfRace();
    }
    syncMeshes();
    updateParticles(dt);
  } else if (state === "finish" || state === "dnf") {
    ais.forEach((a) => aiDrive(a, dt));
    cars.forEach((c) => { if (!c.isPlayer) physicsCar(c, dt); });
    if (!player.dead) physicsCar(player, dt * 0.4);
    else physicsCar(player, dt);
    carCollisions();
    syncMeshes();
    updateParticles(dt);
  } else {
    syncMeshes();
    updateParticles(dt);
  }

  updateCamera(dt);
  updateHUD();
  if (state !== "title") drawMini();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

goTitle();
if (bestEver > 0) $("title-best").textContent = "BEST LAP  " + formatTime(bestEver);
requestAnimationFrame(frame);
})();
