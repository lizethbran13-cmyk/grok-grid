'use strict';
/* Super Grid Expansion - title screen car picker, ITEMS switch, hub button, item slot, prompts,
 * hub map, and the glue between game.js and the expansion. */
(function () {
  const EXT = window.GRID_EXT;
  const LS_SET = 'grokgrid2_settings';
  const ui = (EXT.ui = {});
  let api = null, tAcc = 0, lodT = 0;
  const $ = (id) => document.getElementById(id);
  const online = () => !!(window.GridNet && window.GridNet.active);
  function save() { try { localStorage.setItem(LS_SET, JSON.stringify(api.settings)); } catch (e) {} }
  const GOLD = 0xffc83a;
  function carColor(id) { return api.settings.gold && EXT.hub.goldUnlocked() ? GOLD : EXT.vehById(id).color; }

  ui.pickCar = function (id) {
    const v = EXT.vehById(id);
    if (v.dlc && !EXT.owned()) {
      ui.say('\uD83D\uDD12 The ' + v.name + ' is in the SUPER GRID EXPANSION. Unlock it with tickets in the Grok Arcade DLC Shop.', 5);
      return false;
    }
    api.settings.car = v.id;
    save();
    api.setVehicle(api.player, v.id, carColor(v.id));
    renderCar();
    if (EXT.hub.active) ui.hubHud(true);
    return true;
  };
  function renderCar() {
    const id = api.settings.car || 'f1';
    const show = ui._view || id;
    const v = EXT.vehById(show);
    const locked = v.dlc && !EXT.owned();
    $('sg-car-name').innerHTML = (locked ? '\uD83D\uDD12 ' : '') + v.name + (show === id ? '' : ' <small>(tap to drive)</small>');
    const bar = (lab, n) => '<span class="sgb"><i>' + lab + '</i>' + '<b class="on"></b>'.repeat(n) + '<b></b>'.repeat(5 - n) + '</span>';
    $('sg-car-info').innerHTML = '<div class="sgblurb">' + (v.dlc ? '<span class="sgnew">SUPER GRID</span> ' : '') + v.blurb + '</div>' + bar('SPEED', v.bars[0]) + bar('ACCEL', v.bars[1]) + bar('GRIP', v.bars[2]) + bar('OFF-ROAD', v.bars[3]);
    const gb = $('sg-gold');
    if (gb) { gb.style.display = EXT.hub.goldUnlocked() ? '' : 'none'; gb.classList.toggle('on', !!api.settings.gold); }
  }
  function cycle(d) {
    const list = EXT.VEHICLES;
    const cur = list.findIndex((v) => v.id === (ui._view || api.settings.car || 'f1'));
    const nv = list[(cur + d + list.length) % list.length];
    ui._view = null;
    if (!ui.pickCar(nv.id)) { ui._view = nv.id; renderCar(); }
  }

  function buildUI() {
    const own = EXT.owned();
    const title = $('title-card');
    const rows = title.querySelectorAll('.opt-row');
    const last = rows[rows.length - 1];
    const carRow = document.createElement('div');
    carRow.className = 'opt-row sg-car-row';
    carRow.innerHTML = '<span class="opt-label">CAR</span><div class="sg-car"><button type="button" id="sg-prev" aria-label="Previous car">\u25C0</button><div id="sg-car-name"></div><button type="button" id="sg-next" aria-label="Next car">\u25B6</button><button type="button" id="sg-gold" class="sg-goldbtn" style="display:none">\uD83C\uDFC6 GOLD</button></div>';
    last.after(carRow);
    const info = document.createElement('div');
    info.id = 'sg-car-info';
    carRow.after(info);
    let after = info;
    if (own) {
      const ir = document.createElement('div');
      ir.className = 'opt-row';
      ir.innerHTML = '<span class="opt-label">ITEMS</span><div class="seg" id="seg-items"><button type="button" data-v="true">ON</button><button type="button" data-v="false">OFF</button></div>';
      info.after(ir);
      after = ir;
      const sync = () => ir.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(api.settings.items !== false) === b.dataset.v));
      ir.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { api.settings.items = b.dataset.v === 'true'; save(); sync(); }));
      sync();
      const tag = title.querySelector('.tag');
      if (tag) tag.textContent = '11 TRACKS \u00b7 5 CARS \u00b7 ITEMS \u00b7 SUPER GRID HUB';
    }
    const hb = document.createElement('button');
    hb.type = 'button';
    hb.id = 'hub-btn';
    hb.className = 'btn sg-hub' + (own ? '' : ' locked');
    hb.innerHTML = own ? '\uD83C\uDFC1 SUPER GRID HUB' : '\uD83D\uDD12 SUPER GRID EXPANSION';
    title.querySelector('.btn-row').prepend(hb);
    hb.addEventListener('click', () => {
      if (!EXT.owned()) { ui.say('\uD83D\uDD12 SUPER GRID EXPANSION: 3 new tracks, 4 new cars, items + boosts and the Super Grid Hub. Unlock it in the Grok Arcade DLC Shop (DLC Machine 3000).', 6); return; }
      EXT.hub.enter();
    });
    if (own) {
      const rib = document.createElement('div');
      rib.className = 'sg-ribbon';
      rib.textContent = '\uD83C\uDFC1 SUPER GRID EXPANSION';
      title.querySelector('.kicker').before(rib);
    }
    $('sg-prev').addEventListener('click', () => cycle(-1));
    $('sg-next').addEventListener('click', () => cycle(1));
    $('sg-gold').addEventListener('click', () => { api.settings.gold = !api.settings.gold; save(); api.setVehicle(api.player, api.settings.car || 'f1', carColor(api.settings.car || 'f1')); renderCar(); });
    // HUB buttons on the result cards
    ['finish-card', 'dnf-card'].forEach((cid) => {
      const row = $(cid).querySelector('.btn-row');
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ghost sg-hubbtn';
      b.textContent = '\uD83C\uDFC1 HUB';
      b.style.display = own ? '' : 'none';
      b.addEventListener('click', () => { api.goTitle(); EXT.hub.enter(); });
      row.appendChild(b);
    });
    // floating bits
    const add = (html) => { const d = document.createElement('div'); d.innerHTML = html; document.body.appendChild(d.firstChild); };
    add('<button type="button" id="sg-item" class="hidden" aria-label="Use item"><span id="sg-item-ico"></span><span id="sg-item-lab">ITEM</span></button>');
    add('<div id="sg-flash"></div>');
    add('<div id="sg-say" class="hidden"></div>');
    add('<div id="sg-prompt" class="hidden"><div id="sg-prompt-txt"></div><button type="button" id="sg-prompt-btn" class="btn primary"></button></div>');
    add('<div id="sg-hubhud" class="hidden"></div>');
    const itemBtn = $('sg-item');
    const useItem = (e) => { if (e) { e.preventDefault(); e.stopPropagation(); } EXT.items.use(api.player); };
    itemBtn.addEventListener('pointerdown', useItem);
    window.addEventListener('keydown', (e) => {
      if ((e.code === 'KeyE' || e.code === 'KeyQ') && api.state.mode === 'race' && !api.state.paused) useItem();
      if ((e.code === 'Enter' || e.code === 'KeyE') && api.state.mode === 'hub' && ui._promptFn) { const f = ui._promptFn; f(); }
    });
    $('sg-prompt-btn').addEventListener('click', () => { if (ui._promptFn) ui._promptFn(); });
    renderCar();
  }

  ui.itemSlot = function (item, uses) {
    const b = $('sg-item');
    if (!b) return;
    const it = item && EXT.items.ITEMS[item];
    b.classList.toggle('full', !!it);
    $('sg-item-ico').textContent = it ? (item === 'turbo3' ? '\uD83D\uDD25' : it.icon) : '\u2753';
    $('sg-item-lab').textContent = it ? (item === 'turbo3' ? 'TURBO \u00d7' + (uses || 3) : it.name) : (api && api.isTouch ? 'ITEM' : 'ITEM (E)');
  };
  let flashT = 0;
  ui.flash = function (txt) {
    const f = $('sg-flash');
    if (!f) return;
    f.textContent = txt;
    f.classList.remove('go');
    void f.offsetWidth;
    f.classList.add('go');
    clearTimeout(flashT);
    flashT = setTimeout(() => f.classList.remove('go'), 900);
  };
  let sayT = 0;
  ui.say = function (txt, sec) {
    const s = $('sg-say');
    if (!s) return;
    s.textContent = txt;
    s.classList.remove('hidden');
    clearTimeout(sayT);
    sayT = setTimeout(() => s.classList.add('hidden'), (sec || 4) * 1000);
  };
  ui.prompt = function (txt, btn, fn) {
    const p = $('sg-prompt');
    if (!p) return;
    const key = txt + '|' + btn;
    if (!txt) { if (ui._pk) { p.classList.add('hidden'); ui._pk = ''; ui._promptFn = null; } return; }
    if (ui._pk === key) { ui._promptFn = btn ? fn : null; return; }
    ui._pk = key;
    $('sg-prompt-txt').textContent = txt;
    const b = $('sg-prompt-btn');
    b.textContent = btn || '';
    b.style.display = btn ? '' : 'none';
    ui._promptFn = btn ? fn : null;
    p.classList.remove('hidden');
  };
  ui.hubHud = function (on) {
    const h = $('sg-hubhud');
    if (!h) return;
    h.classList.toggle('hidden', !on);
    if (on) h.innerHTML = '<b>\uD83C\uDFC1 SUPER GRID HUB</b><span>\uD83D\uDD29 ' + EXT.hub.nutCount() + '/12</span><span>' + EXT.vehById(api.settings.car || 'f1').name + '</span>';
  };
  ui.drawHubMap = function (c, gates, nuts, rooms) {
    const cv = $('minimap');
    if (!cv) return;
    const g = cv.getContext('2d'), w = cv.width, h = cv.height, sc = (Math.min(w, h) / 2 - 6) / 152;
    const X = (x) => w / 2 - x * sc, Z = (z) => h / 2 - z * sc; // map north = garage at the top, matches driving south at start
    g.clearRect(0, 0, w, h);
    g.fillStyle = 'rgba(40,120,50,0.55)';
    g.beginPath(); g.arc(w / 2, h / 2, 150 * sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(232,220,200,0.7)';
    g.beginPath(); g.arc(w / 2, h / 2, 62 * sc, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a3550';
    rooms.forEach((r) => g.fillRect(X(r.x1), Z(r.z1), (r.x1 - r.x0) * sc, (r.z1 - r.z0) * sc));
    const gc = ['#3fa9ff', '#ff3f8a', '#ff8a00', '#2fc46a'];
    gates.forEach((gt, k) => { g.fillStyle = gc[k]; g.fillRect(X(gt.x) - 5, Z(gt.z) - 2, 10, 4); });
    g.fillStyle = '#ffc83a';
    nuts.forEach((n) => { if (!n.got) { g.beginPath(); g.arc(X(n.x), Z(n.z), 2, 0, Math.PI * 2); g.fill(); } });
    g.save();
    g.translate(X(c.x), Z(c.z));
    g.rotate(-c.yaw + Math.PI);
    g.fillStyle = '#00e8ff'; g.strokeStyle = '#fff'; g.lineWidth = 1.2;
    g.beginPath(); g.moveTo(0, -6); g.lineTo(4.5, 5); g.lineTo(-4.5, 5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  };

  /* ---------- hooks called by game.js ---------- */
  EXT.boot = function (a) {
    api = EXT.api = a;
    const s = api.settings;
    if (!EXT.VEHICLES.some((v) => v.id === s.car) || (EXT.vehById(s.car).dlc && !EXT.owned())) s.car = 'f1';
    if (s.gold && !EXT.hub.goldUnlocked()) s.gold = false;
    if (s.car !== 'f1' || s.gold) api.setVehicle(api.player, s.car, carColor(s.car));
    buildUI();
  };
  EXT.onTrackBuilt = function (G, track, H) {
    if (!track.dlc) EXT.anim = [];
    if (EXT.owned() || track.dlc) EXT.items.build(G, H);
    else EXT.items.group = null;
  };
  EXT.onRaceStart = function (TR) {
    const itemsOn = online() ? !!TR.dlc : EXT.owned() && api.settings.items !== false;
    EXT.items.reset(itemsOn && !!EXT.items.group);
    const kinds = ['f1', 'rocket', 'gt', 'buggy', 'hover'];
    api.cars.forEach((c) => {
      if (c.isPlayer || c.human) return;
      const want = TR.dlc ? kinds[c.id % 5] : 'f1';
      if (c.vis.kind !== want) api.setVehicle(c, want, api.LIVERY[c.id].color);
    });
    const ib = $('sg-item');
    if (ib) ib.classList.toggle('hidden', !EXT.items.active);
    ui.itemSlot(null);
    document.querySelectorAll('.sg-hubbtn').forEach((b) => (b.style.display = EXT.owned() && !online() ? '' : 'none'));
  };
  EXT.raceUpdate = function (dt, racing) { EXT.items.update(dt, racing); };
  EXT.hubUpdate = function (dt, inp) { EXT.hub.update(dt, inp); };
  EXT.onTitle = function () {
    EXT.hub.exit();
    const ib = $('sg-item');
    if (ib) ib.classList.add('hidden');
    ui._view = null;
    if ($('sg-car-name')) renderCar();
  };
  EXT.frame = function (dt, paused) {
    if (!api) return;
    if (!paused) tAcc += dt;
    if (EXT.hub.active) EXT.hub.frame(tAcc, paused ? 0 : dt);
    else EXT.tickAnim(tAcc, paused ? 0 : dt);
    EXT.items.frame(tAcc, dt);
    lodT -= dt;
    if (lodT <= 0) { lodT = 0.3; EXT.updateLod(api.camera); }
    const ib = $('sg-item');
    if (ib && api.state.mode !== 'race' && api.state.mode !== 'countdown' && !ib.classList.contains('hidden')) ib.classList.add('hidden');
  };
  EXT.onShieldHit = function (car) { if (car.isPlayer) ui.flash('\uD83D\uDEE1\uFE0F BLOCKED!'); };
})();
