/* Grok Grid - online racing for 2 players (3 max) through the Grok Arcade Multiplayer Antenna (grok-net.js).
   Each phone drives its own car with full physics and sends its state 20x a second. The host relays every car
   (plus the AI fillers it simulates) to everyone; remote cars are smoothed toward a short extrapolation.
   The host picks track / laps / AI fill, starts a synced countdown and decides the finish order. */
(function () {
  'use strict';
  var GN = window.GrokNet, prm = GN && GN.params(), Gd = window.__grid;
  var O = window.GridNet = { active: false };
  if (!GN || !prm || !Gd) return;
  O.active = true;
  var SEND_MS = 50, room = null, meta = {}, myPid = null, rid = 0, order = [], myG = -1, carOfG = [], gOfCar = new Map();
  var lastPkt = {}, finTable = {}, firstFinAt = 0, resultShown = 0, phase = 'connecting', hostName = '', tags = [], sendT = 0, stats = { sent: 0, recv: 0, maxGap: 0 };
  var cars = Gd.cars, player = Gd.player, state = Gd.state, THREE = Gd.THREE;
  function $(id) { return document.getElementById(id); }
  function esc(s) { return GN.esc(s); }
  function players() { return room ? room.players() : []; }
  function byPid(pid) { return room && room.player(pid); }
  function now() { return performance.now(); }
  function tracks() { return Gd.TRACKS; }
  function trackName(id) { var t = tracks().find(function (x) { return x.id === id; }); return t ? t.name : id; }

  /* ---------- overlay UI ---------- */
  function build() {
    var css = document.createElement('style');
    css.textContent =
      '#gol{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;background:rgba(6,8,18,.72);padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(44px,calc(env(safe-area-inset-bottom) + 38px)) max(8px,env(safe-area-inset-left));color:#fff;font-family:system-ui,"Segoe UI",sans-serif}' +
      '#gol.hidden{display:none}#gol .gBox{width:min(780px,100%);max-height:100%;overflow:auto;background:linear-gradient(180deg,rgba(24,28,48,.97),rgba(10,12,24,.97));border:2px solid #ff4a1c;border-radius:16px;padding:12px 14px;box-shadow:0 0 28px rgba(255,74,28,.35);text-align:center}' +
      '#gol h2{margin:0 0 6px;font-size:22px;letter-spacing:2px;font-style:italic}#gol .gTop{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:6px;font-size:14px}' +
      '#gol .gCode{border:2px solid #00e8ff;color:#00e8ff;border-radius:10px;padding:2px 10px;font-weight:900;letter-spacing:3px}#gol .gPl{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}' +
      '#gol .gChip{border:2px solid var(--c);border-radius:999px;padding:2px 10px;font-weight:800;background:rgba(0,0,0,.3)}#gol .gChip.empty{border-style:dashed;opacity:.6}' +
      '#gol .gLbl{font-size:12px;letter-spacing:2px;color:#9aa4c7;margin:6px 0 4px;text-align:left}' +
      '#gol .gTracks{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}#gol .gTr,#gol .gOpt{border:2px solid rgba(255,255,255,.25);background:#151a33;color:#fff;border-radius:10px;padding:8px 6px;font:800 14px system-ui,sans-serif;cursor:pointer;min-height:44px;touch-action:manipulation}' +
      '#gol .gTr small{display:block;font-weight:600;font-size:11px;color:#9aa4c7}#gol .gTr.on,#gol .gOpt.on{border-color:#ffd23b;background:#3a2c00;color:#ffe48a}#gol .gTr:disabled,#gol .gOpt:disabled{cursor:default}' +
      '#gol .gRow{display:flex;gap:6px;align-items:center;flex-wrap:wrap}#gol .gRow .gOpt{min-width:64px}' +
      '#gol .gBig{min-width:190px;min-height:52px;border:0;border-radius:14px;font:900 19px system-ui,sans-serif;color:#120a00;background:linear-gradient(180deg,#ffd23b,#ff8a00);margin:8px 4px 2px;cursor:pointer;padding:6px 18px;touch-action:manipulation}' +
      '#gol .gBig.alt{background:linear-gradient(180deg,#7df3ff,#2aa7c9)}#gol .gBig.dim{background:#3a4166;color:#ddd}#gol .gBig:disabled{opacity:.5;cursor:default}' +
      '#gol .gSt{min-height:20px;font-size:15px;color:#dfe6ff;margin-top:4px}#gol .spin{width:32px;height:32px;border:4px solid rgba(255,255,255,.2);border-top-color:#00e8ff;border-radius:50%;margin:10px auto;animation:gspin 1s linear infinite}@keyframes gspin{to{transform:rotate(360deg)}}' +
      '#gol table{width:100%;border-collapse:collapse;margin:4px 0;font-size:16px}#gol td{padding:6px 6px;border-bottom:1px solid rgba(255,255,255,.08);text-align:left}#gol td.p{font-weight:900;font-style:italic;color:#ffd23b;width:44px;font-size:20px}' +
      '#gol tr.me td{background:rgba(0,232,255,.12)}#gol .dot{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--c);margin-right:6px;vertical-align:-1px}#gol .tg{font-size:11px;border-radius:6px;padding:1px 5px;margin-left:6px;background:#2a3158;color:#cfd6ff;font-weight:800}#gol td.t{text-align:right;font-variant-numeric:tabular-nums}' +
      '#gol .gWin{font-size:30px;font-weight:900;font-style:italic;color:#ffd23b;text-shadow:0 0 14px rgba(255,210,59,.5)}' +
      '#gToast{position:fixed;left:50%;top:max(70px,env(safe-area-inset-top));transform:translateX(-50%);z-index:55;background:rgba(6,8,18,.85);border:2px solid #ffd23b;color:#ffe48a;font:900 15px system-ui,sans-serif;padding:6px 14px;border-radius:10px;pointer-events:none;transition:opacity .3s}#gToast.hidden{opacity:0}' +
      'body.gonline #pause{display:none!important}' +
      '@media (max-height:460px){#gol .gBox{padding:8px 10px}#gol h2{font-size:18px;margin:0 0 4px}#gol .gTr{padding:5px 4px;min-height:40px;font-size:13px}#gol .gBig{min-height:44px;font-size:17px;margin:5px 4px 0}#gol table{font-size:14px}#gol td{padding:3px 6px}#gol .gWin{font-size:24px}}';
    document.head.appendChild(css);
    var d = document.createElement('div'); d.id = 'gol'; d.innerHTML = '<div class="gBox" id="golBox"></div>'; document.body.appendChild(d);
    var t = document.createElement('div'); t.id = 'gToast'; t.className = 'hidden'; document.body.appendChild(t);
    document.body.classList.add('gonline');
  }
  function show(html) { $('golBox').innerHTML = html; $('gol').classList.remove('hidden'); }
  function hide() { $('gol').classList.add('hidden'); }
  var toastT = 0;
  function toast(msg) { var t = $('gToast'); t.textContent = msg; t.classList.remove('hidden'); clearTimeout(toastT); toastT = setTimeout(function () { t.classList.add('hidden'); }, 2600); }
  function btn(id, text, cls, dis) { return '<button id="' + id + '" class="gBig ' + (cls || '') + '"' + (dis ? ' disabled' : '') + '>' + text + '</button>'; }
  function on(id, fn) { var e = $(id); if (e) e.addEventListener('click', fn); }
  function top() {
    var l = players(), chips = l.map(function (p) { return '<span class="gChip" style="--c:' + GN.cleanColor(p.color) + '">' + esc(p.name) + (p.host ? ' \u2605' : '') + (p.pid === myPid ? ' (you)' : '') + '</span>'; });
    for (var i = l.length; i < 3; i++) chips.push('<span class="gChip empty" style="--c:#667">' + (i === 1 ? 'waiting for a friend\u2026' : 'open seat') + '</span>');
    return '<div class="gTop"><span class="gCode">' + esc(room.code) + '</span><div class="gPl">' + chips.join('') + '</div><span>' + l.length + '/3</span></div>';
  }
  function foot() { return room.isHost ? btn('gLobby', 'BACK TO LOBBY', 'alt') : btn('gLeave', 'LEAVE', 'dim'); }
  function bindFoot() { on('gLobby', backToLobby); on('gLeave', leave); }

  function renderWait(msg) {
    show('<h2>GROK GRID ONLINE</h2>' + (room && room.opened ? top() : '') + '<div class="spin"></div><div class="gSt">' + esc(msg) + '</div>' + (room && room.opened ? foot() : ''));
    if (room && room.opened) bindFoot();
  }
  function renderSetup() {
    phase = 'setup';
    var host = room.isHost, n = players().length, tr = meta.track || 'park', laps = meta.laps || 3, ai = meta.ai !== false;
    var list = tracks().map(function (t) { return '<button class="gTr' + (t.id === tr ? ' on' : '') + '" data-tr="' + t.id + '"' + (host ? '' : ' disabled') + '>' + esc(t.name) + '<small>' + esc(t.tag || '') + '</small></button>'; }).join('');
    var lp = [1, 3, 5].map(function (k) { return '<button class="gOpt' + (k === laps ? ' on' : '') + '" data-laps="' + k + '"' + (host ? '' : ' disabled') + '>' + k + (k === 1 ? ' LAP' : ' LAPS') + '</button>'; }).join('');
    var aiB = '<button class="gOpt' + (ai ? ' on' : '') + '" data-ai="1"' + (host ? '' : ' disabled') + '>AI CARS ON</button><button class="gOpt' + (!ai ? ' on' : '') + '" data-ai="0"' + (host ? '' : ' disabled') + '>OFF</button>';
    var st = n < 2 ? 'Waiting for a friend to join with code ' + room.code + '\u2026' : host ? 'Pick a track, then START RACE. ' + (ai ? 'AI cars fill the grid to 5.' : 'Just you humans on track.') : esc(hostName || 'The host') + ' is picking the track\u2026';
    show('<h2>GROK GRID ONLINE</h2>' + top() + '<div class="gLbl">TRACK ' + (host ? '(you pick)' : '(host picks)') + '</div><div class="gTracks">' + list + '</div>' +
      '<div class="gLbl">RACE</div><div class="gRow">' + lp + '<span style="width:10px"></span>' + aiB + '</div>' +
      '<div class="gSt" id="gSt">' + st + '</div>' + (host ? btn('gStart', 'START RACE \u25B6', '', n < 2) : '') + foot());
    if (host) {
      Array.prototype.forEach.call(document.querySelectorAll('#gol .gTr'), function (b) { b.addEventListener('click', function () { room.setMeta({ track: b.getAttribute('data-tr') }); Gd.loadTrack(b.getAttribute('data-tr')); }); });
      Array.prototype.forEach.call(document.querySelectorAll('#gol [data-laps]'), function (b) { b.addEventListener('click', function () { room.setMeta({ laps: +b.getAttribute('data-laps') }); }); });
      Array.prototype.forEach.call(document.querySelectorAll('#gol [data-ai]'), function (b) { b.addEventListener('click', function () { room.setMeta({ ai: b.getAttribute('data-ai') === '1' }); }); });
      on('gStart', hostStart);
    }
    bindFoot();
    if (Gd.track.id !== tr) Gd.loadTrack(tr);
  }
  function renderResults() {
    phase = 'result'; resultShown = meta.rid;
    var res = meta.results || [], mine = res.filter(function (r) { return r.g === myG; })[0], win = res[0];
    var bestT = res.length && res[0].time ? res[0].time : 0;
    var rows = res.map(function (r, i) {
      var t = r.left ? 'LEFT' : r.dnf ? 'DNF' : !r.fin ? 'NO TIME' : i === 0 ? Gd.fmtTime(r.time) : '+' + (r.time - bestT).toFixed(3);
      return '<tr class="' + (r.g === myG ? 'me' : '') + '"><td class="p">P' + (i + 1) + '</td><td><span class="dot" style="--c:' + r.color + '"></span>' + esc(r.name) + (r.g === myG ? '<span class="tg">YOU</span>' : '') + (r.ai ? '<span class="tg">AI</span>' : '') + '</td><td class="t">' + t + '</td><td class="t">' + (r.best ? Gd.fmtTime(r.best) : '\u2014') + '</td></tr>';
    }).join('');
    var title = win ? esc(win.name) + ' WINS!' : 'RACE OVER';
    var sub = mine ? (res.indexOf(mine) === 0 ? 'You win! \uD83C\uDFC6' : 'You finished P' + (res.indexOf(mine) + 1) + ' of ' + res.length) : '';
    show('<div class="gWin" id="gWin">' + title + '</div><div class="gSt">' + sub + ' \u00B7 ' + esc(trackName(meta.track)) + ' \u00B7 ' + (meta.laps || 3) + (meta.laps === 1 ? ' lap' : ' laps') + '</div>' + top() +
      '<table id="gRes"><tr><td></td><td class="gLbl">DRIVER</td><td class="t gLbl">TIME</td><td class="t gLbl">BEST LAP</td></tr>' + rows + '</table>' +
      (room.isHost ? btn('gAgain', 'RACE AGAIN', '', players().length < 2) + btn('gChange', 'CHANGE TRACK', 'alt') : '<div class="gSt">Waiting for ' + esc(hostName || 'the host') + ' to start the next race\u2026</div>') + foot());
    on('gAgain', hostStart);
    on('gChange', function () { room.setMeta({ phase: 'setup' }); });
    bindFoot();
  }
  function renderFinished(kind) {
    var ranked = Gd.rankCars(), p = player.place;
    show('<div class="gWin">' + (kind === 'dnf' ? 'TERMINAL DAMAGE' : 'FINISHED P' + p) + '</div><div class="gSt">' + (kind === 'dnf' ? 'Your car is out of the race.' : 'Race time ' + Gd.fmtTime(state.raceTime)) + '</div>' +
      '<div class="spin"></div><div class="gSt" id="gSt">Waiting for the others to finish\u2026</div>');
  }
  function render() {
    if (!room || !room.opened || phase === 'hostleft') return;
    var ph = meta.phase || 'setup';
    if (ph === 'race' && meta.rid !== rid) { beginRace(); return; }
    if (ph === 'result' && meta.rid === rid && resultShown !== meta.rid) { renderResults(); return; }
    if (phase === 'race' || phase === 'finished') return;
    if (ph === 'result' && resultShown === meta.rid) { renderResults(); return; }
    if (players().length < 2 && ph !== 'race') { phase = 'wait'; renderWait('Waiting for your friend to join room ' + room.code + '\u2026'); return; }
    renderSetup();
  }

  /* ---------- race setup on every phone ---------- */
  function hostStart() {
    if (!room.isHost || players().length < 2) return;
    var l = players(), r = (meta.rid || 0) + 1;
    room.setMeta({ phase: 'race', rid: r, order: l.map(function (p) { return p.pid; }), names: l.map(function (p) { return p.name; }), colors: l.map(function (p) { return GN.cleanColor(p.color); }),
      track: meta.track || 'park', laps: meta.laps || 3, ai: meta.ai !== false, results: null });
  }
  function paint(car, color, name, human) {
    var c = new THREE.Color(color);
    car.vis.baseColor.copy(c); car.vis.bodyMat.color.copy(c); car.css = color; car.name = name; car.human = !!human;
  }
  function nameTag(car, name, color) {
    var cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; var g = cv.getContext('2d');
    g.fillStyle = 'rgba(6,8,18,.78)'; g.beginPath(); if (g.roundRect) g.roundRect(4, 6, 248, 52, 14); else g.rect(4, 6, 248, 52); g.fill();
    g.fillStyle = color; g.fillRect(14, 50, 228, 5);
    g.font = '900 34px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.fillText(name, 128, 30);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
    sp.scale.set(3.2, 0.8, 1); sp.position.set(0, 2.4, 0); sp.renderOrder = 30; car.vis.root.add(sp); tags.push(sp); return sp;
  }
  var LIV = cars.map(function (c) { return { name: c.name, css: c.css, color: c.vis.baseColor.clone() }; });
  function beginRace() {
    rid = meta.rid; order = meta.order || []; myG = order.indexOf(myPid); phase = 'race';
    finTable = {}; firstFinAt = 0; lastPkt = {}; resultShown = 0; hostCheckEnd.doneAt = 0;
    tags.forEach(function (t) { if (t.parent) t.parent.remove(t); t.material.map.dispose(); t.material.dispose(); }); tags = [];
    var nH = order.length, ai = meta.ai !== false;
    // local car slots: cars[0] = me, cars[1..] = the other humans, then AI fillers (same car ids on every phone)
    carOfG = []; gOfCar = new Map();
    var k = 1;
    for (var g = 0; g < nH; g++) { var car = g === myG ? cars[0] : cars[k++]; carOfG[g] = car; }
    for (var j = 0; nH + j < cars.length; j++) carOfG[nH + j] = cars[nH + j];
    carOfG.forEach(function (c, g) { gOfCar.set(c, g); });
    var gridOrder = [];
    carOfG.forEach(function (c, g) {
      var human = g < nH;
      c.out = !human && !ai; c.vis.root.visible = !c.out; c.net = null;
      c.remote = c !== player && (human || !room.isHost);
      if (human) { paint(c, meta.colors[g], (meta.names[g] || 'P' + (g + 1)).toUpperCase(), true); if (c !== player) nameTag(c, (meta.names[g] || '').toUpperCase(), meta.colors[g]); }
      else { var lv = LIV[c.id]; c.vis.baseColor.copy(lv.color); c.vis.bodyMat.color.copy(lv.color); c.css = lv.css; c.name = lv.name; c.human = false; }
      gridOrder.push(c.id);
    });
    state.gridOrder = gridOrder; // humans start at the front, AI fillers behind
    Gd.settings.track = meta.track || 'park'; Gd.settings.laps = meta.laps || 3; Gd.settings.diff = Gd.settings.diff || 'normal'; state.inChamp = false; state.autopilot = false;
    hide();
    var go = function () { Gd.startRace(); state.gridOrder = null; };
    // the host starts a hair later so the countdowns line up with the friends who get this a little later
    if (room.isHost) { var pings = players().filter(function (p) { return !p.host; }).map(function (p) { return p.ping || 0; }); setTimeout(go, Math.min(150, Math.max.apply(null, pings.concat([0])) / 2)); } else go();
  }

  /* ---------- state sync ---------- */
  function pack(c) { return [+c.x.toFixed(2), +c.y.toFixed(2), +c.z.toFixed(2), +c.yaw.toFixed(3), +c.speed.toFixed(2), +(c.steerVis || 0).toFixed(2), c.lap, +c.progress.toFixed(4), c.finished ? 1 : 0, +(c.finishTime || 0).toFixed(3), c.dnf ? 1 : 0, Math.round(c.damage), isFinite(c.bestLap) ? +c.bestLap.toFixed(3) : 0]; }
  function apply(c, s) {
    if (!c || c === player || !s) return;
    var t = now(); if (c.net) stats.maxGap = Math.max(stats.maxGap, t - c.net.at);
    var dmgWas = c.damage;
    c.net = { x: s[0], y: s[1], z: s[2], yaw: s[3], speed: s[4], st: s[5], at: t };
    c.lap = s[6]; c.progress = s[7]; c.finished = !!s[8]; c.finishTime = s[9]; c.dnf = !!s[10]; c.damage = s[11]; c.bestLap = s[12] || Infinity;
    if (Math.abs(c.damage - dmgWas) >= 5) Gd.applyVisualDamage(c);
    stats.recv++;
  }
  // countdown time left (3 steps of 0.78 s); friends nudge theirs to the host's so lights go out together
  function cdLeft() { return state.mode === 'countdown' ? Math.max(0, state.countdown) + Math.max(0, 2 - state.cdStep) * 0.78 : 0; }
  function syncCountdown(hostLeft) {
    if (state.mode !== 'countdown') return;
    var target = hostLeft - Math.min(0.3, (room.ping || 0) / 2000), diff = cdLeft() - target;
    if (Math.abs(diff) > 0.02) { state.countdown = Math.max(0.001, state.countdown - diff); stats.cdFix = +(diff.toFixed(3)); }
  }
  function wrap(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
  O.stepRemote = function (c, dt) {
    var s = c.net; if (!s) { Gd.syncCarMesh(c); return; }
    var age = Math.min(0.25, (now() - s.at) / 1000);
    var tx = s.x + Math.sin(s.yaw) * s.speed * age, tz = s.z + Math.cos(s.yaw) * s.speed * age;
    var dx = tx - c.x, dz = tz - c.z;
    if (dx * dx + dz * dz > 30 * 30) { c.x = tx; c.z = tz; c.y = s.y; c.yaw = s.yaw; }
    else { var k = 1 - Math.exp(-dt * 12); c.x += dx * k; c.z += dz * k; c.y += (s.y - c.y) * k; c.yaw = wrap(c.yaw + wrap(s.yaw - c.yaw) * k); }
    c.speed = s.speed; c.steerVis = s.st;
    Gd.syncCarMesh(c);
  };
  function tick() {
    if (!room || !room.opened || (phase !== 'race' && phase !== 'finished' && phase !== 'result')) return;
    if (state.mode === 'title') return;
    if (room.isHost) {
      var list = [];
      carOfG.forEach(function (c, g) { if (c.out) return; if (c === player || !c.remote) list.push([g].concat(pack(c))); else if (lastPkt[g]) list.push([g].concat(lastPkt[g])); });
      room.broadcast({ t: 'cars', r: rid, c: list });
      if (state.mode === 'countdown') room.broadcast({ t: 'cd', r: rid, left: cdLeft() });
      hostCheckEnd();
    } else room.send({ t: 'me', r: rid, s: pack(player) });
    stats.sent++;
  }

  /* ---------- finish / results (host decides) ---------- */
  O.onLocalEnd = function (kind) {
    phase = 'finished';
    renderFinished(kind);
    var msg = { t: 'fin', r: rid, g: myG, time: state.raceTime, best: isFinite(player.bestLap) ? player.bestLap : 0, dnf: kind === 'dnf' };
    if (room.isHost) hostFin(msg); else room.send(msg);
  };
  function hostFin(m) { if (m.r !== rid || finTable[m.g]) return; finTable[m.g] = m; if (!firstFinAt && !m.dnf) firstFinAt = now(); }
  function hostCheckEnd() {
    if ((meta.phase || '') !== 'race' || meta.rid !== rid) return;
    var nH = order.length, humansDone = true;
    for (var g = 0; g < nH; g++) { var p = order[g]; if (!finTable[g] && byPid(p)) humansDone = false; }
    // AI fillers that crossed the line
    carOfG.forEach(function (c, g) { if (g >= nH && !c.out && (c.finished || c.dnf) && !finTable[g]) finTable[g] = { g: g, time: c.finished ? c.finishTime : 0, best: isFinite(c.bestLap) ? c.bestLap : 0, dnf: c.dnf }; });
    // once every human is done, give the AI fillers still on track up to 12 s to cross the line
    var aiLeft = carOfG.some(function (c, g) { return g >= nH && !c.out && !finTable[g]; });
    if (humansDone && !hostCheckEnd.doneAt) hostCheckEnd.doneAt = now();
    if (!humansDone) hostCheckEnd.doneAt = 0;
    var timeout = firstFinAt && now() - firstFinAt > 60000;
    if ((humansDone && (!aiLeft || now() - hostCheckEnd.doneAt > 12000)) || timeout) { if (!hostCheckEnd.t) hostCheckEnd.t = setTimeout(function () { hostCheckEnd.t = 0; finalize(); }, 1200); }
  }
  function finalize() {
    if ((meta.phase || '') !== 'race' || meta.rid !== rid) return;
    var nH = order.length, rows = [];
    carOfG.forEach(function (c, g) {
      if (c.out) return;
      var f = finTable[g], human = g < nH, left = human && !byPid(order[g]);
      rows.push({ g: g, name: human ? (meta.names[g] || 'P' + (g + 1)) : c.name, color: human ? meta.colors[g] : c.css, ai: !human, fin: !!(f && !f.dnf), dnf: !!(f && f.dnf) || left || c.dnf, left: left,
        time: f && !f.dnf ? f.time : 0, best: f ? f.best : (isFinite(c.bestLap) ? c.bestLap : 0), prog: c.progress });
    });
    rows.sort(function (a, b) { if (a.fin !== b.fin) return a.fin ? -1 : 1; if (a.fin) return a.time - b.time; if (a.dnf !== b.dnf) return a.dnf ? 1 : -1; return b.prog - a.prog; });
    room.setMeta({ phase: 'result', results: rows.map(function (r) { delete r.prog; return r; }) });
  }

  /* ---------- navigation ---------- */
  function backToLobby() { if (room.isHost) room.broadcast({ t: 'lobby' }, { self: true }); }
  function goLobby() {
    var me = room.me() || {}; room.markNavigating();
    location.href = GN.buildUrl(GN.hubUrl(), { mode: room.isHost ? 'host' : 'join', code: room.code, name: me.name || prm.name, color: me.color || prm.color, pid: room.pid, slot: me.slot });
  }
  function leave() { room.leave(); location.href = GN.soloUrl(); }
  function hostLeft() {
    if (phase === 'hostleft') return; phase = 'hostleft';
    show('<h2 id="gHostLeft">HOST LEFT</h2><div class="gSt">' + esc(hostName || 'The host') + ' closed the room, so this online race ended.</div><div class="gSt">You can race solo or start a new room from the arcade.</div>' + btn('gSolo', 'RACE SOLO') + btn('gHub', 'BACK TO ARCADE', 'alt'));
    on('gSolo', function () { location.href = GN.soloUrl(); }); on('gHub', function () { location.href = GN.hubUrl(); });
  }

  /* ---------- boot ---------- */
  function boot() {
    build();
    Gd.hideOverlay(); Gd.setRacingChrome(false);
    renderWait('Connecting to room ' + prm.code + '\u2026');
    room = GN.joinFromParams(prm, { max: 3 }); myPid = room.pid;
    function noteHost() { var hp = players().filter(function (p) { return p.host; })[0]; if (hp) hostName = hp.name; }
    room.on('open', function () {
      noteHost(); GN.ui.badge(room, { pos: 'bc', label: room.code });
      if (room.isHost) { var m0 = room.meta() || {}; if (!m0.phase || m0.phase === 'race') room.setMeta({ game: 'grid', phase: 'setup', track: m0.track || Gd.settings.track || 'park', laps: m0.laps || 3, ai: m0.ai !== false }); }
      meta = room.meta() || {}; phase = 'wait'; render();
    });
    room.on('players', function () {
      noteHost();
      if (phase === 'race' || phase === 'finished') {
        order.forEach(function (pid, g) { var c = carOfG[g]; if (c && c !== player && !byPid(pid) && !c.out) { c.out = true; c.vis.root.visible = false; toast((meta.names[g] || 'A player') + ' left the race'); } });
        if (players().length < 2 && room.isHost) { finalize(); }
        return;
      }
      render();
    });
    room.on('meta', function (m) { meta = m || {}; render(); });
    room.on('message', function (d, from) {
      if (!d) return;
      if (d.t === 'cars') { if (d.r !== rid) return; for (var i = 0; i < d.c.length; i++) { var e = d.c[i], g = e[0]; if (g !== myG) apply(carOfG[g], e.slice(1)); } return; }
      if (d.t === 'me') { if (!room.isHost || d.r !== rid) return; var gg = order.indexOf(from); if (gg >= 0) { lastPkt[gg] = d.s; apply(carOfG[gg], d.s); } return; }
      if (d.t === 'cd') { if (!room.isHost && d.r === rid) syncCountdown(d.left); return; }
      if (d.t === 'fin') { if (room.isHost) hostFin(d); return; }
      if (d.t === 'lobby') { goLobby(); return; }
    });
    room.on('error', function (e) {
      if (e && e.code === 'hostleft' && room && !room.isHost && room.opened) { hostLeft(); return; }
      GN.ui.error(e);
    });
    room.start();
    sendT = setInterval(tick, SEND_MS);
  }
  O._debug = function () {
    return { phase: phase, isHost: room && room.isHost, opened: !!(room && room.opened), rid: rid, myG: myG, order: order, meta: meta, stats: stats, mode: state.mode,
      cars: carOfG.map(function (c, g) { return c && { g: g, id: c.id, name: c.name, css: c.css, human: !!c.human, remote: !!c.remote, out: !!c.out, x: +c.x.toFixed(2), z: +c.z.toFixed(2), lap: c.lap, progress: +c.progress.toFixed(3), fin: c.finished, place: c.place }; }) };
  };
  O.room = function () { return room; };
  boot();
})();
