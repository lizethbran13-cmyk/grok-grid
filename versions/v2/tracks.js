'use strict';

/* GROK GRID 2.0 — track library.
 * Each track: layout (either Catmull-Rom control points `pts`, or a polygon `poly` with
 * per-corner fillet radii), road widths, elevation profile and a visual theme.
 * Pure data + one helper, no THREE dependency, so tests can load it in node. */

(function (root) {
  const TAU = Math.PI * 2;

  // Rounded polygon -> dense point list. Corners become true circular arcs of radius r.
  function filletPath(verts, radii, step) {
    step = step || 6;
    const n = verts.length;
    const out = [];
    const issues = [];
    const L = verts[n - 1];
    const F = verts[0];
    let cur = [(L[0] + F[0]) / 2, (L[1] + F[1]) / 2];
    out.push(cur.slice());
    const pushLine = (to) => {
      const dx = to[0] - cur[0];
      const dz = to[1] - cur[1];
      const len = Math.hypot(dx, dz);
      const m = Math.max(1, Math.round(len / step));
      for (let k = 1; k <= m; k++) out.push([cur[0] + (dx * k) / m, cur[1] + (dz * k) / m]);
      cur = to.slice();
    };
    const tLen = [];
    for (let i = 0; i < n; i++) {
      const P = verts[(i - 1 + n) % n];
      const C = verts[i];
      const N = verts[(i + 1) % n];
      let d1x = C[0] - P[0], d1z = C[1] - P[1];
      let d2x = N[0] - C[0], d2z = N[1] - C[1];
      const l1 = Math.hypot(d1x, d1z), l2 = Math.hypot(d2x, d2z);
      d1x /= l1; d1z /= l1; d2x /= l2; d2z /= l2;
      const r = Array.isArray(radii) ? radii[i] : radii;
      const dot = Math.max(-1, Math.min(1, d1x * d2x + d1z * d2z));
      const theta = Math.acos(dot);
      const cross = d1x * d2z - d1z * d2x;
      const t = r * Math.tan(theta / 2);
      tLen.push({ t, l1, l2 });
      if (theta < 1e-3) { pushLine(C); continue; }
      const A = [C[0] - d1x * t, C[1] - d1z * t];
      pushLine(A);
      const sg = cross > 0 ? 1 : -1;
      const px = -d1z * sg, pz = d1x * sg;
      const cx = A[0] + px * r, cz = A[1] + pz * r;
      const a0 = Math.atan2(A[1] - cz, A[0] - cx);
      const sweep = theta * sg;
      const m = Math.max(2, Math.ceil((Math.abs(sweep) * r) / step));
      for (let k = 1; k <= m; k++) {
        const a = a0 + (sweep * k) / m;
        out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
      }
      cur = out[out.length - 1].slice();
    }
    // close back toward the start point (exclusive)
    const dx = out[0][0] - cur[0];
    const dz = out[0][1] - cur[1];
    const len = Math.hypot(dx, dz);
    const m = Math.max(1, Math.round(len / step));
    for (let k = 1; k < m; k++) out.push([cur[0] + (dx * k) / m, cur[1] + (dz * k) / m]);
    // fillet feasibility: tangent lengths on every edge must fit
    for (let i = 0; i < n; i++) {
      const a = tLen[i];
      const b = tLen[(i + 1) % n];
      if (a.t + b.t > a.l2 + 0.01) issues.push('edge ' + i + '->' + ((i + 1) % n) + ' too short for fillets (' + (a.t + b.t).toFixed(1) + ' > ' + a.l2.toFixed(1) + ')');
    }
    return { pts: out, issues };
  }

  const TRACKS = [
    {
      id: 'park',
      name: 'GROK PARK',
      sub: 'The original, tidied up. Parkland sweepers, a hairpin and a fast back loop.',
      tag: 'CLASSIC',
      half: 8.2,
      wall: 16.4,
      scale: 1.15,
      tension: 0.18,
      pts: [
        [0, 0], [90, -2], [180, -6], [270, 4], [350, 40], [400, 100], [415, 175], [390, 250],
        [330, 300], [250, 325], [170, 318], [110, 280], [80, 220], [95, 160], [150, 130],
        [195, 100], [200, 70], [176, 44], [120, 36], [62, 48], [15, 80], [-20, 120], [-70, 165],
        [-140, 195], [-220, 200], [-290, 170], [-335, 110], [-350, 40], [-335, -35], [-290, -95],
        [-215, -130], [-130, -145], [-78, -130], [-50, -95], [-50, -50], [-34, -14],
        // 2.0: the old closing hairpin folded back over the start line and the esses ran
        // through the S/F wall; both now clear each other (same character, no overlaps)
      ],
      elev: null,
      theme: {
        scenery: 'park',
        sky: 0x6fa3c8, fog: 0x8eb6d0, fogNear: 140, fogFar: 520,
        hemiSky: 0xcfe6ff, hemiGround: 0x3d4a28, hemiI: 0.62,
        sunColor: 0xfff0d2, sunI: 0.95, sunDir: [120, 160, 60], ambient: 0.22,
        ground: '#3f8a38', groundTint: 0x5aa34a,
        runoff: '#c4a56a', runoffTint: 0xb8924e,
        asphalt: '#2a2d33', asphaltTint: 0x9a9da3,
        walls: [0xc4122f, 0xf4f4f0, 0x1c3a8a], wallH: 1.35,
        curb: [0xff2d2d, 0xf4f7ff], line: 0xf0e6a8,
        mini: '#5aa34a',
      },
    },
    {
      id: 'city',
      name: 'HARBOUR STREETS',
      sub: 'Tight 90° street corners, concrete walls an arm\u2019s length away and a chicane.',
      tag: 'STREET',
      half: 7.0,
      wall: 10.5,
      scale: 1.15,
      poly: [
        [260, 0], [260, 120], [170, 120], [170, 220], [320, 220], [320, 330],
        [150, 330], [128, 352], [62, 352], [40, 330],
        [-40, 330], [-40, 180], [-120, 180], [-120, 0],
      ],
      radii: [24, 22, 22, 22, 24, 26, 18, 18, 18, 18, 22, 22, 22, 26],
      elev: null,
      theme: {
        scenery: 'city',
        sky: 0x9cc4e4, fog: 0xb9cbd9, fogNear: 90, fogFar: 420,
        hemiSky: 0xdfeeff, hemiGround: 0x4a4a52, hemiI: 0.7,
        sunColor: 0xfff4e0, sunI: 0.9, sunDir: [-80, 170, 90], ambient: 0.25,
        ground: '#6a6d72', groundTint: 0x8a8d93,
        runoff: '#7b7e84', runoffTint: 0x9a9da2,
        asphalt: '#26282d', asphaltTint: 0x8c9098,
        walls: [0xd9d9d4, 0xd9d9d4, 0xc4122f, 0xd9d9d4, 0xd9d9d4, 0x1c3a8a], wallH: 1.25,
        curb: [0xffe14a, 0x111218], line: 0xf4f4f4,
        mini: '#8a8d93',
      },
    },
    {
      id: 'canyon',
      name: 'RED ROCK CANYON',
      sub: 'Desert sweepers between sandstone mesas. Rolling, fast, and one nasty hairpin.',
      tag: 'DESERT',
      half: 8.2,
      wall: 14,
      scale: 1.0,
      poly: [
        [300, 0], [430, 70], [440, 200], [340, 260], [260, 200], [190, 250],
        [175, 380], [40, 430], [-120, 390], [-205, 270], [-150, 160], [-260, 70], [-215, -40],
      ],
      radii: [70, 70, 60, 30, 34, 50, 70, 90, 80, 50, 40, 55, 60],
      elev: { a: [[4.5, 2, 0.4], [2.5, 3, 1.3]], base: 8 },
      theme: {
        scenery: 'canyon',
        sky: 0xf2b07a, fog: 0xe9b483, fogNear: 120, fogFar: 520,
        hemiSky: 0xffe2c0, hemiGround: 0x7a4020, hemiI: 0.7,
        sunColor: 0xffd7a0, sunI: 1.05, sunDir: [-140, 120, -40], ambient: 0.22,
        ground: '#c98a4b', groundTint: 0xd59a5c,
        runoff: '#b98257', runoffTint: 0xb07850,
        asphalt: '#33302e', asphaltTint: 0x9a948e,
        walls: [0xf4f4f0, 0xc4122f], wallH: 1.1,
        curb: [0xff2d2d, 0xf4f7ff], line: 0xf4e3b0,
        mini: '#d59a5c',
      },
    },
    {
      id: 'alpine',
      name: 'ALPINE SUMMIT',
      sub: 'Snowbound mountain pass. Big climbs, blind crests and a downhill switchback.',
      tag: 'SNOW',
      half: 7.8,
      wall: 13,
      scale: 1.0,
      poly: [
        [260, 0], [370, 60], [350, 170], [210, 175], [130, 245], [210, 320],
        [350, 330], [310, 450], [80, 470], [-60, 390], [-80, 220], [-165, 120], [-120, 10],
      ],
      radii: [60, 50, 40, 40, 36, 40, 50, 70, 60, 50, 60, 50, 50],
      elev: { a: [[16, 1, -1.5708], [5, 2, 0.2]], base: 18 },
      theme: {
        scenery: 'alpine',
        sky: 0xb9d0e6, fog: 0xdfe8f1, fogNear: 70, fogFar: 430,
        hemiSky: 0xf2f8ff, hemiGround: 0x8090a8, hemiI: 0.72,
        sunColor: 0xfff6ec, sunI: 0.85, sunDir: [100, 150, -120], ambient: 0.28,
        ground: '#e9eef4', groundTint: 0xf2f6fb,
        runoff: '#dfe7ef', runoffTint: 0xe8eef5,
        asphalt: '#2e3138', asphaltTint: 0x8e939c,
        walls: [0x1c4fa8, 0xf4f4f0], wallH: 1.25,
        curb: [0x1c4fa8, 0xf4f7ff], line: 0xf4f4f4,
        mini: '#e9eef4',
        bank: 0xe9eef5,
      },
    },
    {
      id: 'night',
      name: 'MIDNIGHT NEON',
      sub: 'Floodlit night race through a neon skyline. Technical, twisty, glowing walls.',
      tag: 'NIGHT',
      half: 7.6,
      wall: 12,
      scale: 1.2,
      poly: [
        [240, 0], [310, 60], [310, 160], [220, 205], [140, 160], [60, 205],
        [60, 300], [-80, 300], [-165, 220], [-165, 80], [-100, 30],
      ],
      radii: [40, 40, 36, 30, 30, 36, 40, 44, 40, 40, 40],
      elev: null,
      theme: {
        scenery: 'night',
        night: true,
        sky: 0x060a1a, fog: 0x0b1230, fogNear: 60, fogFar: 380,
        hemiSky: 0x5a6aa8, hemiGround: 0x101020, hemiI: 0.55,
        sunColor: 0x9fb2ff, sunI: 0.45, sunDir: [60, 160, 80], ambient: 0.35,
        ground: '#151a26', groundTint: 0x30384a,
        runoff: '#1d2230', runoffTint: 0x3a4256,
        asphalt: '#30333c', asphaltTint: 0x9298a8,
        walls: [0x00e8ff, 0xff2d9a], wallH: 1.3, wallGlow: true,
        curb: [0xff2d9a, 0xf4f7ff], line: 0x9ff6ff,
        mini: '#30384a',
      },
    },
    {
      id: 'coast',
      name: 'SUNSET COAST',
      sub: 'Flat-out seaside blast. Long straights, fast kinks, palm trees and the ocean.',
      tag: 'COAST',
      half: 8.6,
      wall: 16,
      scale: 1.0,
      poly: [
        [400, 0], [560, 120], [540, 280], [380, 360], [160, 340], [60, 260],
        [-100, 300], [-280, 220], [-320, 60], [-200, -40],
      ],
      radii: [110, 100, 90, 80, 60, 60, 90, 90, 70, 80],
      elev: { a: [[2.5, 1, 0.8]], base: 3 },
      theme: {
        scenery: 'coast',
        sky: 0xffb48a, fog: 0xffc9a8, fogNear: 140, fogFar: 600,
        hemiSky: 0xffe0c8, hemiGround: 0x6a5a40, hemiI: 0.7,
        sunColor: 0xffc890, sunI: 1.0, sunDir: [0, 60, 300], ambient: 0.24,
        ground: '#d9c08a', groundTint: 0xe3cc96,
        runoff: '#4d9a48', runoffTint: 0x5aa850,
        asphalt: '#2c2e33', asphaltTint: 0x9da0a8,
        walls: [0xf4f4f0, 0x00a39a], wallH: 1.2,
        curb: [0xff2d2d, 0xf4f7ff], line: 0xf0e6a8,
        mini: '#e3cc96',
        sea: 0x2a86c2,
      },
    },
  ];

  // elevation helper: y(t) = base + sum a*sin(TAU*k*t + phase); periodic so laps join.
  function elevAt(track, t) {
    const e = track.elev;
    if (!e) return 0;
    let y = e.base || 0;
    for (const [a, k, ph] of e.a) y += a * Math.sin(TAU * k * t + ph);
    return y;
  }

  // Control points for a track (array of [x,z]).
  function controlPoints(track) {
    if (track._cp) return track._cp;
    let pts;
    if (track.pts) pts = track.pts;
    else {
      const r = filletPath(track.poly, track.radii, 6);
      pts = r.pts;
      track._issues = r.issues;
    }
    track._cp = pts.map(([x, z]) => [x * track.scale, z * track.scale]);
    return track._cp;
  }

  root.GRID_TRACKS = { TRACKS, filletPath, elevAt, controlPoints };
})(typeof window !== 'undefined' ? window : globalThis);
