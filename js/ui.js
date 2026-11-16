'use strict';
// ====================== VERDENSMAKT 2026 – grensesnitt ======================
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const SVGNS = 'http://www.w3.org/2000/svg';
const fmt = (v, d = 0) => (Math.round(v * 10 ** d) / 10 ** d).toLocaleString('nb-NO', { minimumFractionDigits: d, maximumFractionDigits: d });
const money = v => Math.abs(v) >= 1000 ? fmt(v / 1000, 2) + ' bill. $' : fmt(v, Math.abs(v) < 10 ? 1 : 0) + ' mrd $';
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const FLAG_URL = c => `https://flagcdn.com/w40/${c}.png`; // flagg hentes fra nettet (flagcdn.com)
function flag(t) { const c = window.FLAGS[t]; const n = (typeof G !== 'undefined' && G && G.nations && G.nations[t]) || null; const col = n ? n.color : ((window.NATIONS[t] || {}).col || hashColor(t)); return c ? `<img class="flag" src="${FLAG_URL(c)}" alt="" loading="lazy" style="background:${col}" onerror="this.removeAttribute('src')">` : `<span class="flag" style="background:${col}"></span>`; }
function govLabel(n) { const g = n.values?.gov ?? 0; return g < -50 ? 'Liberalt demokrati' : g < -15 ? 'Demokrati' : g <= 15 ? 'Hybridregime' : g <= 60 ? 'Autoritært' : 'Diktatur'; }
const SPEED_MS = [0, 700, 350, 160, 70, 22];

const UI = {
  speed: 0, tab: 'overview', mode: 'pol', selProv: null, selUnits: new Set(), moveMode: false, focusNation: null,
  vb: { x: 0, y: 0, w: 2000, h: 1000 }, pathEls: [], lastUi: 0, acc: 0,

  // ---------- Start ----------
  initStart() {
    const list = Object.entries(window.NATIONS).filter(([t]) => M.countries[t] || t === '304')
      .map(([t, d]) => ({ t, n: d.n || M.countries[t]?.name || t, gdp: d.gdp || 22, d })).filter(x => !TERRITORY[x.t]).sort((a, b) => b.gdp - a.gdp);
    const render = q => {
      $('#nationList').innerHTML = list.filter(x => x.n.toLowerCase().includes(q.toLowerCase())).map(x =>
        `<div class="nrow" data-t="${x.t}">${flag(x.t)}${esc(x.n)}<span class="g">${money(x.gdp)}</span></div>`).join('');
    };
    render('');
    $('#nationSearch').oninput = e => render(e.target.value);
    $('#nationList').onclick = e => {
      const r = e.target.closest('.nrow'); if (!r) return;
      $$('.nrow').forEach(x => x.classList.toggle('on', x === r));
      this.pick = r.dataset.t; const d = window.NATIONS[this.pick];
      const f = Object.values(window.FACTIONS).find(f => f.members.includes(this.pick));
      const diff = (d.gdp || 22) > 3000 ? 'Lett' : (d.gdp || 22) > 400 ? 'Middels' : 'Krevende';
      $('#nationPreview').innerHTML = `<h3>${flag(this.pick)}${esc(d.n)}</h3>
        <table><tr><td>BNP</td><td>${money(d.gdp || 22)}</td></tr><tr><td>Befolkning</td><td>${fmt(d.pop || 8, 1)} mill.</td></tr>
        <tr><td>Sivile / militære fabrikker</td><td>${d.civ ?? '–'} / ${d.mil ?? '–'}</td></tr><tr><td>Divisjoner</td><td>${(d.div ?? 2) + (d.arm ?? 0)}</td></tr>
        <tr><td>Atomvåpen</td><td>${d.nuke ? 'Ja' : 'Nei'}</td></tr><tr><td>Blokk</td><td>${f ? f.name : 'Ingen'}</td></tr><tr><td>Vanskelighetsgrad</td><td>${diff}</td></tr></table>`;
      $('#btnStart').disabled = false;
    };
    $('#btnStart').onclick = () => { newGame(this.pick, { ukraineWar: $('#optUkraine').checked }); this.enterGame(); };
    if (localStorage.getItem('vm2026_save')) { $('#btnContinue').hidden = false; $('#btnContinue').onclick = () => { if (loadGame()) this.enterGame(); }; }
  },
  enterGame() {
    $('#start').hidden = true; $('#game').hidden = false;
    this.buildMap();
    this.bindInput();
    const cap = PROV_GEO[N(G.player).capital]; this.zoomTo(cap.x, cap.y, 700);
    this.selectProv(N(G.player).capital);
    this.setSpeed(0); this.renderAll();
    requestAnimationFrame(t => this.loop(t));
  },

  // ---------- Kart ----------
  buildMap() {
    const svg = $('#map'); svg.innerHTML = '';
    svg.insertAdjacentHTML('beforeend', `<defs><pattern id="hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.2" height="5" fill="#000" fill-opacity=".45"/></pattern>
      <radialGradient id="seaG" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#16324a"/><stop offset="1" stop-color="#0a1824"/></radialGradient></defs>
      <rect x="-3000" y="-3000" width="8000" height="7000" fill="url(#seaG)"/>`);
    const lanes = document.createElementNS(SVGNS, 'g'); svg.appendChild(lanes);
    for (const [a, b] of G.seaExtra) { const l = document.createElementNS(SVGNS, 'path'); const A = PROV_GEO[a], B = PROV_GEO[b]; l.setAttribute('d', `M${A.x},${A.y}L${B.x},${B.y}`); l.setAttribute('class', 'lane'); lanes.appendChild(l); }
    const gp = document.createElementNS(SVGNS, 'g'); gp.id = 'gProv'; svg.appendChild(gp);
    this.pathEls = PROV_GEO.map(g => { const p = document.createElementNS(SVGNS, 'path'); p.setAttribute('d', g.d); p.setAttribute('class', 'pv'); p.dataset.id = g.id; gp.appendChild(p); return p; });
    for (const id of ['gOcc', 'gBorder', 'gLbl', 'gArrow', 'gUnits', 'gFx']) { const g = document.createElementNS(SVGNS, 'g'); g.id = id; svg.appendChild(g); }
    $('#gOcc').style.pointerEvents = 'none'; $('#gBorder').style.pointerEvents = 'none'; $('#gArrow').style.pointerEvents = 'none'; $('#gFx').style.pointerEvents = 'none';
    G.dirtyMap = true; this.applyVB();
  },
  provFill(p) {
    const me = G.player;
    switch (this.mode) {
      case 'pol': return N(p.ctrl).color;
      case 'dip': {
        const c = p.ctrl; if (c === me) return '#d6b23a';
        if (atWar(me, c)) return '#b8322a'; if (allied(me, c) || coBelligerent(me, c)) return '#3f78c4';
        const r = rel(me, c); const t = (r + 100) / 200;
        return `hsl(${Math.round(t * 120)},${30 + Math.abs(r) / 3}%,${32 + t * 10}%)`;
      }
      case 'ind': { const v = p.civ + p.mil * 1.5; const t = Math.min(1, v / 25); return `hsl(${45 - t * 45},${40 + t * 50}%,${18 + t * 42}%)`; }
      case 'blk': { const n = N(p.ctrl); const f = n.faction && window.FACTIONS[n.faction]; return f ? f.color : '#4a5058'; }
    }
  },
  updateMap() {
    for (const p of G.prov) this.pathEls[p.id].setAttribute('fill', this.provFill(p));
    // okkuperte
    const go = $('#gOcc'); go.innerHTML = '';
    for (const p of G.prov) if (p.ctrl !== p.owner) { const e = document.createElementNS(SVGNS, 'path'); e.setAttribute('d', PROV_GEO[p.id].d); e.setAttribute('fill', 'url(#hatch)'); go.appendChild(e); }
    // landegrenser: tegn omriss med tykkere strek rundt land via filter
    this.drawLabels();
    G.dirtyMap = false;
  },
  drawLabels() {
    const gl = $('#gLbl'); gl.innerHTML = '';
    const acc = {};
    for (const p of G.prov) { const g = PROV_GEO[p.id]; const a = acc[p.owner] || (acc[p.owner] = { x: 0, y: 0, a: 0, pts: [] }); acc[p.owner].x += g.x * g.a; acc[p.owner].y += g.y * g.a; acc[p.owner].a += g.a; acc[p.owner].pts.push(g); }
    for (const [t, a] of Object.entries(acc)) {
      if (a.a < 120) continue;
      const n = N(t); let x = a.x / a.a, y = a.y / a.a;
      // flytt til nærmeste egen provins hvis tyngdepunktet havner utenfor
      let best = a.pts[0], bd = 1e9; for (const g of a.pts) { const d = Math.hypot(g.x - x, g.y - y); if (d < bd) { bd = d; best = g; } }
      if (bd > Math.sqrt(a.a) * 0.35) { x = best.x; y = best.y; }
      const size = Math.max(5, Math.min(34, Math.sqrt(a.a) / (n.name.length * 0.33 + 2.5)));
      const tx = document.createElementNS(SVGNS, 'text'); tx.setAttribute('x', x); tx.setAttribute('y', y); tx.setAttribute('class', 'lbl'); tx.setAttribute('font-size', size); tx.textContent = n.name; gl.appendChild(tx);
    }
  },
  unitScale() { const r = $('#map').getBoundingClientRect(); return this.vb.w / Math.max(300, r.width); },
  drawUnits() {
    const gu = $('#gUnits'); gu.innerHTML = '';
    const k = this.unitScale(); const showAll = k < 1.4;
    const by = new Map();
    for (const u of G.units) { const key = u.p + ':' + u.o; if (!by.has(key)) by.set(key, []); by.get(key).push(u); }
    const perProv = new Map();
    for (const [kk, us] of by) {
      const [pid, o] = kk.split(':'); const mine = o === G.player;
      if (!showAll && !mine && !atWar(o, G.player)) continue;
      const i = perProv.get(pid) || 0; perProv.set(pid, i + 1);
      const g = PROV_GEO[pid]; const w = 36 * k, h = 15 * k; const fc = window.FLAGS[o];
      const OFF = [[0, 0], [1.08, 0], [-1.08, 0], [0, 1.2], [1.08, 1.2], [-1.08, 1.2], [0, -1.2], [1.08, -1.2], [-1.08, -1.2]][i % 9];
      const x = g.x - w / 2 + OFF[0] * w, y = g.y - h / 2 + OFF[1] * h;
      const sel = mine && us.some(u => this.selUnits.has(u.id));
      const avg = us.reduce((s, u) => s + u.s, 0) / us.length;
      const grp = document.createElementNS(SVGNS, 'g'); grp.setAttribute('class', 'ctr'); grp.dataset.p = pid; grp.dataset.o = o;
      grp.innerHTML = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${2 * k}" fill="${N(o).color}" stroke="${sel ? '#fff' : mine ? '#f0d060' : '#000'}" stroke-width="${(sel ? 1.8 : 1) * k}"/>
        <rect x="${x + 2 * k}" y="${y + h - 3 * k}" width="${(w - 4 * k) * avg / 100}" height="${1.6 * k}" fill="${avg > 60 ? '#7fe08a' : avg > 30 ? '#e8c04a' : '#e05a4f'}"/>
        ${fc ? `<image href="${FLAG_URL(fc)}" x="${x + 2 * k}" y="${y + 2 * k}" width="${14 * k}" height="${9.5 * k}" preserveAspectRatio="none"/>` : ''}
        <text x="${x + (fc ? 16 * k + (w - 16 * k) / 2 : w / 2)}" y="${y + h * 0.68}" font-size="${10 * k}" text-anchor="middle" fill="#fff" stroke="#000" stroke-width="${2 * k}" paint-order="stroke" font-weight="700">${us.length}</text>`;
      gu.appendChild(grp);
    }
    // piler for egne enheter
    const ga = $('#gArrow'); ga.innerHTML = '';
    const seen = new Set();
    for (const u of G.units) {
      if (u.o !== G.player || !u.path.length) continue;
      const sig = u.p + '>' + u.path.join(','); if (seen.has(sig)) continue; seen.add(sig);
      const pts = [u.p, ...u.path].map(id => PROV_GEO[id]);
      const d = 'M' + pts.map(g => g.x + ',' + g.y).join('L');
      const e = document.createElementNS(SVGNS, 'path'); e.setAttribute('d', d); e.setAttribute('fill', 'none');
      e.setAttribute('stroke', atWar(G.player, P(u.path[u.path.length - 1]).ctrl) ? '#ff6a4a' : '#f0d060'); e.setAttribute('stroke-width', 2.2 * k); e.setAttribute('stroke-dasharray', `${5 * k} ${3 * k}`); e.setAttribute('stroke-opacity', .9);
      ga.appendChild(e);
      const last = pts[pts.length - 1]; const c = document.createElementNS(SVGNS, 'circle'); c.setAttribute('cx', last.x); c.setAttribute('cy', last.y); c.setAttribute('r', 3 * k); c.setAttribute('fill', e.getAttribute('stroke')); ga.appendChild(c);
    }
    // kamper
    const gf = $('#gFx'); gf.innerHTML = '';
    for (const b of G.battles || []) {
      if (!showAll && b.att !== G.player && b.def !== G.player && !atWar(b.att, G.player) && !atWar(b.def, G.player)) continue;
      const g = PROV_GEO[b.p]; const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', g.x); t.setAttribute('y', g.y - 12 * k); t.setAttribute('font-size', 13 * k); t.setAttribute('text-anchor', 'middle'); t.textContent = '💥'; gf.appendChild(t);
    }
    // valgt provins
    this.pathEls.forEach(e => e.classList.remove('sel'));
    if (this.selProv != null) this.pathEls[this.selProv].classList.add('sel');
  },
  applyVB() { const v = this.vb; $('#map').setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`); },
  fitAspect() { const r = $('#map').getBoundingClientRect(); this.vb.h = this.vb.w * r.height / Math.max(1, r.width); },
  zoomTo(x, y, w) { this.fitAspect(); const ar = this.vb.h / this.vb.w; this.vb.w = w; this.vb.h = w * ar; this.vb.x = x - w / 2; this.vb.y = y - this.vb.h / 2; this.applyVB(); this.drawUnits(); },
  svgPoint(ev) { const r = $('#map').getBoundingClientRect(); return { x: this.vb.x + (ev.clientX - r.left) / r.width * this.vb.w, y: this.vb.y + (ev.clientY - r.top) / r.height * this.vb.h }; },

  bindInput() {
    const svg = $('#map');
    this.fitAspect(); this.applyVB();
    window.addEventListener('resize', () => { const cx = this.vb.x + this.vb.w / 2, cy = this.vb.y + this.vb.h / 2; this.zoomTo(cx, cy, this.vb.w); });
    let drag = null; const pointers = new Map(); let pinch = null;
    svg.addEventListener('pointerdown', e => {
      pointers.set(e.pointerId, e);
      if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY), w: this.vb.w }; drag = null; return; }
      drag = { x: e.clientX, y: e.clientY, vx: this.vb.x, vy: this.vb.y, moved: false, btn: e.button, target: e.target };
      svg.setPointerCapture(e.pointerId);
    });
    svg.addEventListener('pointermove', e => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, e);
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()]; const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const cx = this.vb.x + this.vb.w / 2, cy = this.vb.y + this.vb.h / 2; this.zoomTo(cx, cy, Math.max(80, Math.min(2600, pinch.w * pinch.d / d))); return;
      }
      if (drag) {
        const r = svg.getBoundingClientRect(); const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 5) { drag.moved = true; svg.classList.add('drag'); }
        if (drag.moved) { this.vb.x = drag.vx - dx / r.width * this.vb.w; this.vb.y = drag.vy - dy / r.height * this.vb.h; this.applyVB(); }
      } else this.hover(e);
    });
    const up = e => {
      pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
      if (!drag) return; svg.classList.remove('drag');
      if (!drag.moved) this.click(e, drag.btn === 2 || (e.pointerType === 'mouse' && e.button === 2));
      drag = null;
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', e => { pointers.delete(e.pointerId); drag = null; pinch = null; });
    svg.addEventListener('contextmenu', e => e.preventDefault());
    svg.addEventListener('wheel', e => {
      e.preventDefault(); const pt = this.svgPoint(e); const f = e.deltaY > 0 ? 1.18 : 1 / 1.18;
      const nw = Math.max(80, Math.min(2600, this.vb.w * f)); const s = nw / this.vb.w;
      this.vb.x = pt.x - (pt.x - this.vb.x) * s; this.vb.y = pt.y - (pt.y - this.vb.y) * s; this.vb.w = nw; this.vb.h *= s; this.applyVB(); this.drawUnits();
    }, { passive: false });
    svg.addEventListener('pointerleave', () => $('#tooltip').hidden = true);
    $$('.spd').forEach(b => b.onclick = () => this.setSpeed(+b.dataset.s));
    $$('#tabs button').forEach(b => b.onclick = () => { this.tab = b.dataset.tab; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b)); this.renderPanel(); });
    $$('#mapmodes button').forEach(b => b.onclick = () => { this.mode = b.dataset.mode; $$('#mapmodes button').forEach(x => x.classList.toggle('on', x === b)); this.updateMap(); });
    $('#btnMenu').onclick = () => this.menu();
    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); this.setSpeed(this.speed ? 0 : (this.lastSpeed || 2)); }
      if (/^Digit[1-5]$/.test(e.code)) this.setSpeed(+e.code.slice(5));
      if (e.code === 'Escape') { this.moveMode = false; $('#moveHint').hidden = true; this.closeModal(); }
    });
    document.addEventListener('pointerdown', () => this.md = true, true); document.addEventListener('pointerup', () => setTimeout(() => this.md = false, 50), true);
    // panel-handlinger (delegert)
    document.addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b && !b.disabled) this.action(b.dataset.act, b.dataset); });
    document.addEventListener('input', e => { const s = e.target.closest('[data-slider]'); if (s) this.slider(s.dataset.slider, +s.value); });
  },
  provAt(e) { const el = document.elementFromPoint(e.clientX, e.clientY); if (!el) return null; const c = el.closest('.ctr'); if (c) return +c.dataset.p; if (el.dataset && el.dataset.id != null) return +el.dataset.id; return null; },
  click(e, right) {
    const pid = this.provAt(e); if (pid == null) return;
    if (right || this.moveMode) { this.moveSelected(pid); this.moveMode = false; $('#moveHint').hidden = true; return; }
    this.selectProv(pid, e.shiftKey);
  },
  selectProv(pid, add) {
    this.selProv = pid; if (!add) this.selUnits.clear();
    for (const u of G.units) if (u.p === pid && u.o === G.player) this.selUnits.add(u.id);
    this.focusNation = P(pid).ctrl;
    this.drawUnits(); this.renderInfo(); if (this.tab === 'military' || this.tab === 'industry') this.renderPanel();
  },
  moveSelected(pid) {
    let ok = 0, fail = 0;
    for (const u of G.units) if (this.selUnits.has(u.id)) { if (orderMove(u, pid)) ok++; else fail++; }
    if (!ok && fail) this.toast('Enhetene kan ikke nå dit (nøytralt land eller ingen rute). Krev militær tilgang via allianse eller erklær krig.', 'bad');
    else if (ok) { const tgt = P(pid).ctrl; this.toast(`${ok} divisjon(er) sendt mot ${provName(pid)}${atWar(G.player, tgt) ? ' – angrep!' : '.'}`, 'info'); }
    this.drawUnits(); this.renderInfo();
  },
  hover(e) {
    const pid = this.provAt(e); const tt = $('#tooltip');
    if (pid == null) { tt.hidden = true; return; }
    const p = P(pid); const us = G.units.filter(u => u.p === pid);
    const byO = {}; us.forEach(u => byO[u.o] = (byO[u.o] || 0) + 1);
    tt.innerHTML = `<b>${esc(provName(pid))}</b><br>Eier: ${flag(p.owner)}${esc(N(p.owner).name)}${p.ctrl !== p.owner ? `<br><span class="bad">Okkupert av ${flag(p.ctrl)}${esc(N(p.ctrl).name)}</span>` : ''}
      <br><span class="mut">BNP ${money(p.gdp)} · ${fmt(p.civ)} sivile / ${fmt(p.mil)} mil. fabrikker</span>${Object.entries(byO).map(([o, c]) => `<br>${esc(N(o).name)}: ${c} div.`).join('')}`;
    const r = $('#mapwrap').getBoundingClientRect();
    tt.style.left = Math.min(e.clientX - r.left + 14, r.width - 270) + 'px'; tt.style.top = (e.clientY - r.top + 14) + 'px'; tt.hidden = false;
  },

  // ---------- Løkke ----------
  setSpeed(s) { if (s) this.lastSpeed = s; this.speed = s; $$('.spd').forEach(b => b.classList.toggle('on', +b.dataset.s === s)); },
  loop(t) {
    const dt = Math.min(500, t - (this.lt || t)); this.lt = t;
    if (this.speed && !G.over && $('#modal').hidden) {
      this.acc += dt; const ms = SPEED_MS[this.speed]; let n = 0;
      while (this.acc >= ms && n < 6) { this.acc -= ms; tick(); n++; if (dayOfMonth() === 1 && G.day % 1 === 0 && n) this.monthTick(); }
      if (n >= 6) this.acc = 0;
    }
    if (t - this.lastUi > 250) { this.lastUi = t; if (G.dirtyMap) this.updateMap(); this.drawUnits(); this.renderTop(); if (t - (this.lastPanel || 0) > 700) { this.lastPanel = t; this.renderPanel(true); this.renderInfo(true); } }
    requestAnimationFrame(tt => this.loop(tt));
  },
  monthTick() {
    if (this.mode !== 'pol') G.dirtyMap = true;
    try { saveGame(); } catch (e) { }
    const me = N(G.player); let tot = 0; for (const n of Object.values(G.nations)) if (n.alive) tot += n.gdpNow;
    if (!this.wonShown && me.gdpNow / tot > 0.4) { this.wonShown = true; this.modal(`<h2>Verdensmakt!</h2><p>${esc(me.name)} kontrollerer nå over 40 % av verdens økonomi. Du har vunnet – men du kan fortsette å spille.</p><div class="acts"><button class="btn" data-act="close">Fortsett</button></div>`); }
  },
  renderAll() { this.updateMap(); this.drawUnits(); this.renderTop(); this.renderPanel(); this.renderInfo(); },

  // ---------- Toppfelt ----------
  renderTop() {
    const n = N(G.player); if (!n) return;
    if ($('#tbFlag').dataset.t !== n.tag) { $('#tbFlag').outerHTML = flag(n.tag).replace('class="flag"', 'id="tbFlag" data-t="' + n.tag + '" class="flag"'); } $('#tbName').textContent = n.name; $('#tbDate').textContent = dateStr();
    const bal = n.balance || 0;
    $('#tbStats').innerHTML = `
      <span title="Bruttonasjonalprodukt">📈 <b>${money(n.gdpNow)}</b></span>
      <span title="Årlig vekst">${(n.growth ?? 0) >= 0 ? '▲' : '▼'} <b class="${(n.growth ?? 0) < 0 ? 'bad' : 'good'}">${fmt((n.growth ?? 0) * 100, 1)} %</b></span>
      <span title="${n.treasury < 0 ? 'Statsgjeld' : 'Statsfond'} – kredittvurdering og budsjettbalanse per år">💰 <b class="${n.treasury < 0 && -n.treasury / n.gdpNow > 1 ? 'bad' : ''}">${n.treasury < 0 ? 'Gjeld ' + fmt(-n.treasury / n.gdpNow * 100) + ' %' : 'Fond ' + money(n.treasury)}</b> <b>${ratingOf(n).r}</b> <span class="${bal < 0 ? 'bad' : 'good'}">${bal >= 0 ? '+' : ''}${money(bal * 365)}/år</span></span>
      <span title="Politisk kapital">🏛 <b>${fmt(n.pp)}</b></span>
      <span title="Stabilitet">⚖ <b class="${n.stab < 35 ? 'bad' : ''}">${fmt(n.stab)}%</b></span>
      <span title="Krigsstøtte">🎖 <b>${fmt(n.ws)}%</b></span>
      <span title="Tilgjengelig arbeidskraft">👥 <b>${fmt(n.manpower)}k</b></span>
      <span title="Fabrikker: sivile / militære">🏭 <b>${n.civ}</b> / <b>${n.mil}</b></span>
      <span title="Divisjoner">🪖 <b>${n.divs}</b></span>
      <span title="Global spenning">🌐 <b class="${G.tension > 70 ? 'bad' : G.tension > 50 ? 'warn' : ''}">${fmt(G.tension)}%</b></span>`;
  },

  // ---------- Venstrepanel ----------
  renderPanel(soft) {
    if (soft && (this.md || (document.activeElement?.closest('#panel') && document.activeElement.tagName === 'INPUT' && document.activeElement.type !== 'range'))) return;
    const n = N(G.player); if (!n) return;
    const el = $('#panel'); const st = el.scrollTop;
    const h = this['panel_' + this.tab](n); if (soft && h === this._panelHtml) return; this._panelHtml = h;
    el.innerHTML = h;
    el.scrollTop = st;
  },
  panel_overview(n) {
    const g = (n.growth ?? gdpGrowthYear(n)) * 100;
    const fac = n.faction ? window.FACTIONS[n.faction]?.name : 'Ingen';
    const lawRow = (k, label) => {
      const L = LAWS[k]; const cur = n.laws[k];
      return `<h4>${label}</h4>` + L.map((l, i) => {
        const req = l.req === 'war' ? !warsOf(n.tag).length : l.req === 'ws40' ? (n.ws < 40 && !warsOf(n.tag).length) : l.req === 'tension60' ? (G.tension < 60 && !warsOf(n.tag).length) : false;
        return `<div class="row"><span>${i === cur ? '▶ <b>' + l.name + '</b>' : l.name} <span class="mut">${k === 'cons' ? '(' + l.rate * 100 + ' % av bef.)' : '(' + Math.round(l.cg * 100) + ' % konsumvarer, prod. ×' + l.prod + ')'}</span></span>
        ${i === cur ? '' : `<button class="btn sm" data-act="law" data-k="${k}" data-i="${i}" ${req || n.pp < 75 ? 'disabled' : ''} title="${req ? 'Krav ikke oppfylt' : '75 politisk kapital'}">75 🏛</button>`}</div>`;
      }).join('');
    };
    const wars = warsOf(n.tag);
    return `<div class="card"><h3>${esc(n.name)}</h3><table>
      <tr><td>BNP</td><td>${money(n.gdpNow)}</td></tr>
      <tr><td>Vekst (årlig)</td><td class="${g < 0 ? 'bad' : 'good'}">${fmt(g, 1)} %</td></tr>
      <tr><td>Befolkning</td><td>${fmt(n.popNow, 1)} mill.</td></tr>
      <tr><td>${n.treasury < 0 ? 'Statsgjeld' : 'Statsfond'}</td><td class="${n.treasury < 0 ? 'bad' : 'good'}">${money(Math.abs(n.treasury))} (${fmt(Math.abs(n.treasury) / n.gdpNow * 100)} %)</td></tr>
      <tr><td>Budsjettbalanse</td><td class="${n.balance < 0 ? 'bad' : 'good'}">${money((n.balance || 0) * 365)}/år</td></tr>
      <tr><td>Kredittvurdering</td><td>${ratingOf(n).r}</td></tr>
      <tr><td>Styreform</td><td>${govLabel(n)}</td></tr>
      <tr><td>Stabilitet / krigsstøtte</td><td>${fmt(n.stab)} % / ${fmt(n.ws)} %</td></tr>
      <tr><td>Politisk kapital</td><td>${fmt(n.pp)} (${(n.ppGain ?? 1) >= 0 ? '+' : ''}${fmt(n.ppGain ?? 1, 2)}/d)</td></tr>
      <tr><td>Blokk</td><td>${esc(fac)}</td></tr>
      <tr><td>Atommakt</td><td>${n.nuke ? 'Ja' : 'Nei'}</td></tr>
      <tr><td>Global spenning</td><td>${fmt(G.tension)} %</td></tr></table></div>
      <div class="card"><h3>Lover</h3>${lawRow('econ', 'Økonomi')}${lawRow('cons', 'Verneplikt')}</div>
      ${wars.length ? `<div class="card"><h3>Kriger</h3>${wars.map(w => `<div>${esc(w.name)} – krigsscore <b>${warScore(w, sideOf(w, n.tag))}</b></div>`).join('')}<div class="legend">Se fanen Militær for fredsforhandlinger.</div></div>` : ''}`;
  },
  panel_economy(n) {
    const t = n.budgetInfo || budgetTotals(n); const rt = ratingOf(n);
    const gp = growthParts(n).filter(p => Math.abs(p[1]) >= 0.0005);
    const pct = v => fmt(v * 100, 1) + ' %';
    const rows = Object.entries(BUDGET).map(([k, b]) => {
      const v = n.budget[k];
      let extra = '';
      if (k === 'def') extra = `<div class="legend">Behov for å drifte hæren: <b>${pct(t.need / t.gdp)}</b> av BNP (${money(t.need)}/år) · finansiering <b class="${t.funding < 0.95 ? 'bad' : 'good'}">${fmt(t.funding * 100)} %</b>${t.funding < 0.95 ? ' – lavere produksjon, forsterkning og kampkraft!' : t.funding > 1.05 ? ' – overskudd gir opptil +20 % produksjon' : ''}</div>`;
      return `<div class="row"><span>${b.name}: <b id="bv_${k}">${pct(v)}</b> <span class="mut" id="bm_${k}">${money(v * t.gdp)}/år</span></span></div>
        <input type="range" min="${Math.round(b.min * 1000)}" max="${Math.round(b.max * 1000)}" value="${Math.round(v * 1000)}" data-slider="bud_${k}">
        <div class="legend">${b.desc}</div>${extra}`;
    }).join('<div style="height:6px"></div>');
    return `<div class="card"><h3>Statsbudsjett</h3><table>
      <tr><td>BNP</td><td>${money(t.gdp)}</td></tr>
      <tr><td>Skatteinntekter</td><td class="good">${money(t.rev)}/år</td></tr>
      <tr><td>Offentlige utgifter</td><td class="bad">${money(t.spendShare * t.gdp)}/år (${pct(t.spendShare)})</td></tr>
      <tr><td>${t.interest >= 0 ? 'Renteutgifter' : 'Avkastning statsfond'}</td><td class="${t.interest >= 0 ? 'bad' : 'good'}">${money(Math.abs(t.interest))}/år</td></tr>
      <tr><td><b>Balanse</b></td><td class="${t.balance < 0 ? 'bad' : 'good'}"><b>${t.balance >= 0 ? '+' : ''}${money(t.balance)}/år</b> (${pct(t.balance / t.gdp)})</td></tr>
      <tr><td>${n.treasury < 0 ? 'Statsgjeld' : 'Statsfond'}</td><td>${money(Math.abs(n.treasury))} (${pct(Math.abs(n.treasury) / t.gdp)} av BNP)</td></tr>
      <tr><td>Kredittvurdering</td><td><b class="${'AAAA'.includes(rt.r) ? 'good' : rt.r.startsWith('B') && rt.r !== 'BBB' ? 'warn' : rt.r === 'BBB' || rt.r.startsWith('A') ? '' : 'bad'}">${rt.r}</b> · rente ${pct(rt.rate)}</td></tr>
      ${n.crisis ? '<tr><td colspan="2" class="bad">STATSBANKEROTT: −4 % vekst, −25 stabilitet, −40 % bygging og produksjon</td></tr>' : ''}</table>
      <div class="legend">Underskudd øker gjelden. Høy gjeld gir dårligere kredittvurdering, høyere rente og til slutt statsbankerott.</div></div>
      <div class="card"><h3>Skatt</h3>
      <div class="row"><span>Skattenivå: <b id="taxv">${Math.round(n.tax * 100)} %</b> <span class="mut">· skatteeffektivitet ${fmt(taxEff(n) * 100)} %</span></span></div>
      <input type="range" min="10" max="55" value="${Math.round(n.tax * 100)}" data-slider="tax">
      <div class="legend">Høyere skatt gir mer inntekt, men lavere vekst og misfornøyd næringsliv og folk.</div></div>
      <div class="card"><h3>Utgifter (% av BNP)</h3>${rows}</div>
      <div class="card"><h3>Økonomisk vekst: ${pct(n.growth ?? gdpGrowthYear(n))}</h3><table>${gp.map(p => `<tr><td>${p[0]}</td><td class="${p[1] < 0 ? 'bad' : 'good'}">${p[1] > 0 ? '+' : ''}${fmt(p[1] * 100, 2)} %</td></tr>`).join('')}</table></div>`;
  },
  panel_society(n) {
    const parts = stabilityParts(n); const tgt = stabilityTarget(n); const pw = n.grpPower || groupPower(n);
    const grp = Object.entries(GROUPS).map(([g, d]) => {
      const s = n.grp[g]; const col = s > 60 ? 'var(--good)' : s > 35 ? 'var(--warn)' : 'var(--bad)';
      return `<div class="q" style="display:block"><div class="row" style="margin:0"><span>${d.icon} <b>${d.name}</b> <span class="mut">makt ${fmt(pw[g] * 100)} %</span></span><span>${fmt(s)} %</span></div>
        <div class="bar"><i style="width:${s}%;background:${col}"></i></div>
        <div class="legend">Ønsker: ${d.wants}.</div>${groupCrisis(n, g) ? `<div class="bad" style="font-size:12px">⚠ ${GROUP_CRISIS[g]}</div>` : ''}
        <button class="btn sm" style="margin-top:4px" data-act="conc" data-g="${g}" ${n.pp < 30 ? 'disabled' : ''}>Gi innrømmelser (30 🏛)</button></div>`;
    }).join('');
    const vals = VALUES.map(x => {
      const v = n.values[x.k]; const p = n.push[x.k];
      return `<div style="margin:10px 0 4px"><div class="row" style="margin:0"><span class="${v < 0 ? '' : 'mut'}">${x.l}</span><span class="mut" style="flex:0">${fmt(Math.abs(v))}</span><span style="flex:1;text-align:right" class="${v > 0 ? '' : 'mut'}">${x.r}</span></div>
        <div class="vbar"><i style="left:calc(${(v + 100) / 2}% - 2px)"></i></div>
        <div class="row" style="margin-top:4px"><span class="legend">${v < 0 ? x.el : v > 0 ? x.er : 'Nøytral'}</span>
        <button class="btn sm ${p < 0 ? 'green' : ''}" data-act="push" data-k="${x.k}" data-d="-1" title="Dra mot ${x.l}">◀</button>
        <button class="btn sm ${p === 0 ? 'on' : ''}" data-act="push" data-k="${x.k}" data-d="0" title="Stopp">■</button>
        <button class="btn sm ${p > 0 ? 'green' : ''}" data-act="push" data-k="${x.k}" data-d="1" title="Dra mot ${x.r}">▶</button></div></div>`;
    }).join('');
    return `<div class="card"><h3>Stabilitet: ${fmt(n.stab)} %</h3><div class="mut">Beveger seg mot ${fmt(tgt)} %</div><table>${parts.filter(p => Math.abs(p[1]) >= 0.5).map(p => `<tr><td>${p[0]}</td><td class="${p[1] < 0 ? 'bad' : 'good'}">${p[1] > 0 ? '+' : ''}${fmt(p[1], 1)}</td></tr>`).join('')}</table>
      <div class="legend">Under 30 %: −25 % produksjon og bygging. Over 75 %: +10 %.</div></div>
      <div class="card"><h3>Interessegrupper</h3><div class="legend" style="margin-bottom:6px">Stabiliteten avhenger av hvor fornøyde de mektigste gruppene er. Budsjett, skatt, samfunnsverdier og kriger påvirker dem.</div>${grp}</div>
      <div class="card"><h3>Samfunnsverdier</h3><div class="legend">Verdiene flyttes sakte (2 poeng per måned). Hver verdi du flytter koster 0,25 politisk kapital per dag. De endrer også hvor mektige interessegruppene er.</div>${vals}</div>`;
  },
  panel_research(n) {
    const cur = n.tech.cur ? TECH_BY[n.tech.cur] : null; const prog = cur ? (n.tech.p?.[cur.id] || 0) : 0;
    const cats = [...new Set(TECH.map(t => t.cat))];
    return `<div class="card"><h3>Forskning</h3><table><tr><td>Forskningspoeng</td><td>${fmt(n.rp ?? rpPerDay(n), 2)}/dag</td></tr></table>
      ${cur ? `<div style="margin-top:6px">Forsker nå: <b>${cur.name}</b><div class="bar"><i style="width:${prog / cur.cost * 100}%"></i></div><div class="mut">${fmt(prog)} / ${cur.cost} · ca. ${fmt(Math.max(0, cur.cost - prog) / Math.max(0.01, n.rp ?? 1))} dager</div></div>` : '<div class="warn" style="margin-top:6px">Ingen aktiv forskning – velg en teknologi!</div>'}
      <div class="legend">Mer penger til forskning og utdanning og verdien «Innovasjon» gir flere poeng.</div></div>
      ${cats.map(c => `<div class="card"><h3>${c}</h3>${TECH.filter(t => t.cat === c).map(t => {
        const done = n.tech.done[t.id], av = techAvailable(n, t), isCur = n.tech.cur === t.id; const pp = n.tech.p?.[t.id] || 0;
        return `<div class="q"><span class="nm"><b class="${done ? 'good' : ''}">${done ? '✓ ' : ''}${t.name}</b><br><span class="mut">${t.d} · ${t.cost} poeng${pp && !done ? ' · ' + fmt(pp / t.cost * 100) + ' % ferdig' : ''}${!done && !av ? ' · krever ' + TECH_BY[t.req].name : ''}</span></span>
          ${done ? '' : isCur ? '<span class="good">Pågår</span>' : `<button class="btn sm" data-act="research" data-id="${t.id}" ${av ? '' : 'disabled'}>Forsk</button>`}</div>`;
      }).join('')}</div>`).join('')}`;
  },
  panel_industry(n) {
    const law = LAWS.econ[n.laws.econ]; const cg = Math.round(n.civ * law.cg);
    const p = this.selProv != null ? P(this.selProv) : null; const mine = p && p.ctrl === G.player;
    const q = n.queue.map((it, i) => `<div class="q"><span class="nm">${BUILD[it.t].name}<br><span class="mut">${esc(provName(it.p))}</span><div class="bar"><i style="width:${Math.min(100, it.prog / BUILD[it.t].cost * 100)}%"></i></div></span>
      ${i ? `<button class="x" data-act="qup" data-i="${i}" title="Flytt opp">▲</button>` : ''}<button class="x" data-act="qdel" data-i="${i}" title="Fjern">✕</button></div>`).join('');
    return `<div class="card"><h3>Industri</h3><table>
      <tr><td>Sivile fabrikker</td><td>${n.civ}</td></tr><tr><td>– til konsumvarer</td><td>${cg}</td></tr>
      <tr><td>– tilgjengelig for bygging</td><td>${n.civ - cg}</td></tr><tr><td>Militærfabrikker</td><td>${n.mil}</td></tr>
      <tr><td>Byggeplasser i bruk</td><td>${Math.ceil((n.civ - cg) / 15)} linjer á maks 15 fabrikker</td></tr></table></div>
      <div class="card"><h3>Bygg</h3>
      ${mine ? `<div class="mut">I: <b>${esc(provName(p.id))}</b> (plass: ${p.civ + p.mil}/${maxSlots(p)}, infra ${p.infra}/5, festning ${p.fort}/5)</div>` : '<div class="mut">Velg en av dine provinser på kartet for å bygge der – eller bruk «Auto».</div>'}
      <div class="grid2" style="margin-top:6px">${Object.entries(BUILD).map(([k, b]) => `<button class="btn sm" data-act="build" data-t="${k}" ${mine ? '' : 'disabled'}>${b.name}</button>`).join('')}</div>
      <div class="grid2" style="margin-top:6px"><button class="btn sm" data-act="autobuild" data-t="civ">Auto: sivil fabrikk</button><button class="btn sm" data-act="autobuild" data-t="mil">Auto: militærfabrikk</button></div></div>
      <div class="card"><h3>Byggekø (${n.queue.length})</h3>${q || '<div class="mut">Tom kø.</div>'}</div>`;
  },
  panel_production(n) {
    const law = LAWS.econ[n.laws.econ]; const prod = n.mil * law.prod; const a = n.alloc; const s = a.inf + a.arm + a.air || 1;
    const rec = Object.entries(UNIT).map(([k, u]) => {
      const why = canRecruit(G.player, k);
      return `<div class="q"><span class="nm"><b>${u.name}</b><br><span class="mut">Angrep ${u.atk} · forsvar ${u.def} · fart ${u.spd}<br>${Object.entries(u.eq).map(([e, v]) => v + (e === 'inf' ? ' inf.utstyr' : ' panser')).join(' + ')} + ${u.mp}k mann · ${u.train} d</span></span>
      <button class="btn sm green" data-act="recruit" data-t="${k}" ${why ? `disabled title="${why}"` : ''}>Tren</button></div>`;
    }).join('');
    const tr = G.recruits.filter(r => r.o === G.player).map(r => `<div class="q"><span class="nm">${UNIT[r.t].name}</span><span class="mut">${r.days} d igjen</span></div>`).join('');
    return `<div class="card"><h3>Militærproduksjon</h3>
      <div class="mut">${n.mil} militærfabrikker × ${law.prod} (${esc(law.name)})</div>
      ${[['inf', 'Infanteriutstyr'], ['arm', 'Pansrede kjøretøy'], ['air', 'Kampfly']].map(([k, l]) => `
        <div class="row"><span>${l}: <b>${Math.round(a[k] / s * 100)} %</b></span><span class="mut">+${fmt(prod * a[k] / s * EQ_RATE[k], 1)}/d</span></div>
        <input type="range" min="0" max="100" value="${Math.round(a[k] / s * 100)}" data-slider="alloc_${k}">`).join('')}
      <h4>Lager</h4><table><tr><td>Infanteriutstyr</td><td>${fmt(n.equip.inf)}</td></tr><tr><td>Pansrede kjøretøy</td><td>${fmt(n.equip.arm)}</td></tr><tr><td>Kampfly</td><td>${fmt(n.equip.air)}</td></tr><tr><td>Arbeidskraft</td><td>${fmt(n.manpower)}k / ${fmt(n.mpMax)}k</td></tr></table>
      <div class="legend">Fly gir luftoverlegenhet i alle kamper landet ditt deltar i.</div></div>
      <div class="card"><h3>Tren divisjoner</h3><div class="mut" style="margin-bottom:4px">Nye divisjoner møter opp i ${esc(provName(this.recruitProv()))}.</div>${rec}</div>
      <div class="card"><h3>Under trening (${G.recruits.filter(r => r.o === G.player).length})</h3>${tr || '<div class="mut">Ingen.</div>'}</div>`;
  },
  recruitProv() { const p = this.selProv; return p != null && P(p).ctrl === G.player ? p : N(G.player).capital; },
  panel_military(n) {
    const my = G.units.filter(u => u.o === G.player);
    const by = {}; for (const u of my) (by[u.p] = by[u.p] || []).push(u);
    const rows = Object.entries(by).sort((a, b) => b[1].length - a[1].length).map(([pid, us]) => {
      const c = { inf: 0, mech: 0, arm: 0 }; us.forEach(u => c[u.t]++); const avg = us.reduce((s, u) => s + u.s, 0) / us.length; const moving = us.filter(u => u.path.length).length;
      return `<div class="unitrow" data-act="goto" data-p="${pid}"><span>${esc(provName(+pid))}<br><span class="mut">${c.inf ? c.inf + ' INF ' : ''}${c.mech ? c.mech + ' MEK ' : ''}${c.arm ? c.arm + ' PNS' : ''}${moving ? ' · ' + moving + ' i bevegelse' : ''}</span></span><span><b>${us.length}</b><br><span class="${avg < 50 ? 'bad' : 'mut'}">${fmt(avg)} %</span></span></div>`;
    }).join('');
    const wars = warsOf(G.player).map(w => {
      const side = sideOf(w, G.player); const sc = warScore(w, side); const leader = w[side][0] === G.player; const other = side === 'att' ? 'def' : 'att';
      return `<div class="card"><b>${esc(w.name)}</b><div class="mut">Vår side: ${w[side].map(t => flag(t) + esc(N(t).name)).join(', ')}<br>Fiender: ${w[other].map(t => flag(t) + esc(N(t).name)).join(', ')}</div>
        <div>Krigsscore: <b class="${sc < 0 ? 'bad' : 'good'}">${sc}</b> · ${G.day - w.start} dager</div>
        <div class="grid2" style="margin-top:6px">${leader ? `<button class="btn sm" data-act="peace" data-w="${w.id}" data-m="white">Tilby hvit fred</button><button class="btn sm" data-act="peace" data-w="${w.id}" data-m="statusquo">Krev status quo</button>` : `<button class="btn sm" data-act="leave" data-w="${w.id}">Separatfred</button>`}</div>
        <div class="legend">Status quo: alle beholder områdene de kontrollerer.</div></div>`;
    }).join('');
    return `<div class="card"><h3>Hæren</h3><div class="row"><span>${my.length} divisjoner</span><button class="btn sm" data-act="selall">Velg alle</button></div>
      <div class="legend">Klikk en gruppe for å velge den. Høyreklikk på kartet for å flytte. Enheter forsterkes automatisk på vennligsinnet territorium.</div>${rows || '<div class="mut">Ingen enheter.</div>'}</div>
      ${wars || '<div class="card mut">Vi er ikke i krig.</div>'}`;
  },
  panel_diplomacy(n) {
    const list = Object.values(G.nations).filter(o => o.alive && o.tag !== G.player).sort((a, b) => b.gdpNow - a.gdpNow);
    const status = o => [atWar(G.player, o.tag) ? '<span class="tag war">Krig</span>' : '', allied(G.player, o.tag) ? '<span class="tag ally">Alliert</span>' : '', G.trade[key(G.player, o.tag)] ? '<span class="tag trade">Handel</span>' : '', G.nap[key(G.player, o.tag)] ? '<span class="tag">Pakt</span>' : '', G.sanction[G.player + '>' + o.tag] ? '<span class="tag war">Sanksjonert</span>' : ''].join('');
    const q = (this.dipFilter || '').toLowerCase();
    return `<div class="card"><h3>Verden</h3><input id="dipSearch" placeholder="Søk land …" value="${esc(this.dipFilter || '')}" style="width:100%;padding:6px;border-radius:5px;border:1px solid var(--line);background:var(--panel2);color:var(--txt)" oninput="UI.dipFilter=this.value;UI.renderPanel();this.focus&&setTimeout(()=>{const e=document.getElementById('dipSearch');e.focus();e.setSelectionRange(e.value.length,e.value.length)},0)">
      <div class="nlist">${list.filter(o => o.name.toLowerCase().includes(q)).map(o => `<div class="unitrow" data-act="focus" data-t="${o.tag}"><span>${flag(o.tag)}${esc(o.name)} ${status(o)}</span><span class="${rel(G.player, o.tag) < 0 ? 'bad' : 'good'}">${fmt(rel(G.player, o.tag))}</span></div>`).join('')}</div></div>
      <div class="card"><h3>Blokker</h3>${Object.entries(window.FACTIONS).map(([id, f]) => { const m = Object.values(G.nations).filter(x => x.alive && x.faction === id); return m.length ? `<div><span class="flag" style="background:${f.color}"></span><b>${esc(f.name)}</b> <span class="mut">(${m.length} land)</span></div>` : ''; }).join('')}</div>
      <div class="legend">Velg et land i listen eller på kartet. Handlingene vises i høyre panel.</div>`;
  },
  panel_log() { return `<div class="card"><h3>Hendelseslogg</h3>${G.log.slice(0, 120).map(l => `<div class="q"><span class="nm ${l.type === 'war' || l.type === 'bad' ? 'bad' : l.type === 'good' ? 'good' : l.type === 'warn' ? 'warn' : ''}">${esc(l.msg)}</span><span class="mut" style="white-space:nowrap">${dateStr(l.d)}</span></div>`).join('')}</div>`; },

  // ---------- Høyrepanel ----------
  renderInfo(soft) {
    const el = $('#info'); const st = el.scrollTop; let h = '';
    if (this.selProv != null) {
      const p = P(this.selProv); const own = p.ctrl === G.player;
      const us = G.units.filter(u => u.p === p.id); const mine = us.filter(u => u.o === G.player);
      h += `<div class="card"><h3>${esc(provName(p.id))}</h3><table>
        <tr><td>Eier</td><td>${esc(N(p.owner).name)}</td></tr>${p.ctrl !== p.owner ? `<tr><td>Kontrollert av</td><td class="bad">${esc(N(p.ctrl).name)}</td></tr>` : ''}
        <tr><td>BNP</td><td>${money(p.gdp)}</td></tr><tr><td>Befolkning</td><td>${fmt(p.pop, 1)} mill.</td></tr>
        <tr><td>Sivile / militære fabrikker</td><td>${p.civ} / ${p.mil}</td></tr><tr><td>Infrastruktur</td><td>${p.infra}/5</td></tr><tr><td>Festning</td><td>${p.fort}/5</td></tr></table>
        ${own ? `<div class="grid2" style="margin-top:6px">${Object.entries(BUILD).map(([k, b]) => `<button class="btn sm" data-act="build" data-t="${k}">+ ${b.name}</button>`).join('')}</div>` : ''}</div>`;
      if (us.length) {
        const byO = {}; us.forEach(u => (byO[u.o] = byO[u.o] || []).push(u));
        h += `<div class="card"><h3>Enheter</h3>${Object.entries(byO).map(([o, l]) => `<div>${flag(o)}${esc(N(o).name)}: <b>${l.length}</b> <span class="mut">(${fmt(l.reduce((s, u) => s + u.s, 0) / l.length)} %)</span></div>`).join('')}
        ${mine.length ? `<div class="mut" style="margin-top:6px">${this.selUnits.size} egne divisjoner valgt.</div><div class="grid2" style="margin-top:6px"><button class="btn sm" data-act="movemode">Flytt …</button><button class="btn sm" data-act="halt">Stopp</button></div>` : ''}</div>`;
      } else if (this.selUnits.size) h += `<div class="card"><div class="mut">${this.selUnits.size} divisjoner valgt.</div><button class="btn sm" data-act="movemode">Flytt …</button></div>`;
    }
    const t = this.focusNation;
    if (t && N(t)?.alive) h += this.nationCard(N(t));
    if (soft && (this.md || h === this._infoHtml)) return;
    this._infoHtml = h; el.innerHTML = h; el.scrollTop = st;
  },
  nationCard(o) {
    const me = N(G.player); const isMe = o.tag === G.player;
    let h = `<div class="card"><h3>${flag(o.tag)}${esc(o.name)}</h3><table>
      <tr><td>BNP</td><td>${money(o.gdpNow)}</td></tr><tr><td>Befolkning</td><td>${fmt(o.popNow, 1)} mill.</td></tr>
      <tr><td>Fabrikker (siv./mil.)</td><td>${o.civ} / ${o.mil}</td></tr><tr><td>Divisjoner</td><td>${o.divs}</td></tr><tr><td>Kampfly</td><td>${fmt(o.equip.air)}</td></tr>
      <tr><td>Stabilitet</td><td>${fmt(o.stab)} %</td></tr><tr><td>Vekst</td><td>${fmt((o.growth ?? 0) * 100, 1)} %</td></tr><tr><td>Kredittvurdering</td><td>${ratingOf(o).r}</td></tr><tr><td>Styreform</td><td>${govLabel(o)}</td></tr><tr><td>Blokk</td><td>${o.faction ? esc(window.FACTIONS[o.faction]?.name || '') : 'Ingen'}</td></tr><tr><td>Atommakt</td><td>${o.nuke ? '☢ Ja' : 'Nei'}</td></tr>
      ${isMe ? '' : `<tr><td>Relasjon</td><td class="${rel(G.player, o.tag) < 0 ? 'bad' : 'good'}">${fmt(rel(G.player, o.tag))}</td></tr>`}</table>`;
    if (!isMe) {
      const wars = enemiesOf(o.tag); if (wars.length) h += `<div class="warn" style="margin-top:4px">I krig med: ${wars.map(t => flag(t) + esc(N(t).name)).join(', ')}</div>`;
      const k = key(G.player, o.tag); const w = atWar(G.player, o.tag); const al = allied(G.player, o.tag);
      const acts = [];
      const A = (a, extra = '') => acts.push(`<div class="dact"><button class="btn sm ${a === 'war' ? 'red' : ''}" data-act="dip" data-a="${a}" data-t="${o.tag}" ${me.pp < DIPLO[a].pp ? 'disabled' : ''}>${DIPLO[a].name}${extra}</button><span class="mut">${DIPLO[a].pp ? DIPLO[a].pp + ' 🏛' : ''}</span></div>`);
      if (!w) {
        A('improve');
        if (!G.trade[k] && !G.sanction[G.player + '>' + o.tag]) A('trade');
        if (!G.nap[k] && !al) A('nap');
        if (!al) A('alliance');
        if (o.faction && !me.faction && window.FACTIONS[o.faction]?.leader === o.tag) A('faction', ` (${window.FACTIONS[o.faction].name})`);
        if (!o.faction && (!me.faction || window.FACTIONS[me.faction]?.leader === G.player)) A('invite');
        A('aid');
        if (!G.guarantee[G.player + '>' + o.tag]) A('guarantee');
        if (G.sanction[G.player + '>' + o.tag]) A('unsanction'); else A('sanction');
        if (!al) {
          const j = me.justify;
          if (j && j.target === o.tag) acts.push(`<div class="mut">${j.days > 0 ? `Rettferdiggjør krig: ${j.days} dager igjen` : '<span class="good">Krigsmål klart!</span>'}</div>`);
          else if (!j) A('justify');
          A('war', j && j.target === o.tag && j.days <= 0 ? '' : ' (urettferdiggjort)');
        }
      } else acts.push('<div class="bad">Vi er i krig. Se fanen Militær for fred.</div>');
      h += `<h4>Diplomati</h4>${acts.join('')}`;
    }
    return h + '</div>';
  },

  // ---------- Handlinger ----------
  action(a, d) {
    const n = N(G.player);
    switch (a) {
      case 'close': this.closeModal(); break;
      case 'push': n.push[d.k] = +d.d; break;
      case 'conc': if (concession(n, d.g)) this.toast(`Innrømmelser gitt til ${GROUPS[d.g].name.toLowerCase()}.`, 'good'); break;
      case 'research': n.tech.cur = d.id; this.toast(`Forsker nå på ${TECH_BY[d.id].name}.`, 'build'); break;
      case 'law': { n.pp -= 75; n.laws[d.k] = +d.i; recalcAll(); this.toast(`Ny lov: ${LAWS[d.k][d.i].name}`, 'good'); break; }
      case 'build': { if (this.selProv == null) return; const err = queueBuild(G.player, d.t, this.selProv); this.toast(err || `${BUILD[d.t].name} lagt i byggekøen.`, err ? 'bad' : 'build'); break; }
      case 'autobuild': {
        const cands = G.prov.filter(p => p.ctrl === G.player && p.owner === G.player).sort((a, b) => (b.infra * 3 - (b.civ + b.mil) / maxSlots(b) * 10) - (a.infra * 3 - (a.civ + a.mil) / maxSlots(a) * 10));
        let err = 'Ingen ledige provinser'; for (const p of cands) { err = queueBuild(G.player, d.t, p.id); if (!err) { this.toast(`${BUILD[d.t].name} lagt i kø i ${provName(p.id)}.`, 'build'); break; } }
        if (err) this.toast(err, 'bad'); break;
      }
      case 'qdel': n.queue.splice(+d.i, 1); break;
      case 'qup': { const i = +d.i; [n.queue[i - 1], n.queue[i]] = [n.queue[i], n.queue[i - 1]]; break; }
      case 'recruit': if (recruit(G.player, d.t, this.recruitProv())) this.toast(`${UNIT[d.t].name}divisjon under trening.`, 'build'); break;
      case 'goto': { const g = PROV_GEO[+d.p]; this.zoomTo(g.x, g.y, Math.min(this.vb.w, 600)); this.selectProv(+d.p); break; }
      case 'selall': this.selUnits = new Set(G.units.filter(u => u.o === G.player).map(u => u.id)); this.toast(`${this.selUnits.size} divisjoner valgt – høyreklikk på målet.`); break;
      case 'movemode': this.moveMode = true; $('#moveHint').hidden = false; break;
      case 'halt': for (const u of G.units) if (this.selUnits.has(u.id)) { u.path = []; u.prog = 0; } break;
      case 'focus': { this.focusNation = d.t; const c = PROV_GEO[N(d.t).capital]; if (P(N(d.t).capital).owner === d.t) this.zoomTo(c.x, c.y, Math.max(300, Math.min(this.vb.w, 900))); this.renderInfo(); break; }
      case 'dip': {
        if (d.a === 'war' && !(n.justify && n.justify.target === d.t && n.justify.days <= 0)) {
          this.modal(`<h2>Erklære krig?</h2><p>Du har ikke rettferdiggjort krig mot ${esc(N(d.t).name)}. Det gir stort stabilitetstap, høyere global spenning og dårligere relasjoner med hele verden.</p>
            ${defenders(d.t).length ? `<p class="warn">Disse vil forsvare dem: ${defenders(d.t).map(t => flag(t) + esc(N(t).name)).join(', ')}</p>` : ''}
            <div class="acts"><button class="btn red" data-act="dipconfirm" data-a="war" data-t="${d.t}">Erklær krig</button><button class="btn" data-act="close">Avbryt</button></div>`);
          return;
        }
        if (d.a === 'war' && defenders(d.t).length) {
          this.modal(`<h2>Erklære krig mot ${esc(N(d.t).name)}?</h2><p class="warn">Disse vil gå inn i krigen på deres side: ${defenders(d.t).map(t => esc(N(t).name)).join(', ')}</p>
            <div class="acts"><button class="btn red" data-act="dipconfirm" data-a="war" data-t="${d.t}">Erklær krig</button><button class="btn" data-act="close">Avbryt</button></div>`); return;
        }
        const r = diplo(d.a, d.t); this.toast(r.msg, r.ok ? 'good' : 'bad'); G.dirtyMap = true; break;
      }
      case 'dipconfirm': { this.closeModal(); const r = diplo(d.a, d.t); this.toast(r.msg, r.ok ? 'war' : 'bad'); G.dirtyMap = true; break; }
      case 'peace': { const w = G.wars.find(x => x.id === +d.w); if (!w) return; const r = peaceOffer(w, d.m); this.toast(r.msg, r.ok ? 'good' : 'bad'); break; }
      case 'leave': { const w = G.wars.find(x => x.id === +d.w); if (!w) return; const r = leaveWar(w); this.toast(r.msg, r.ok ? 'good' : 'bad'); break; }
      case 'joinwar': { const w = G.wars.find(x => x.id === +d.w); if (w) joinWar(w, G.player, 'att'); this.closeModal(); G.dirtyMap = true; break; }
      case 'event': { Events.resolve(+d.i); this.closeModal(); break; }
      case 'save': saveGame(); this.toast('Spillet er lagret i nettleseren.', 'good'); this.closeModal(); break;
      case 'quit': location.reload(); break;
      case 'new': localStorage.removeItem('vm2026_save'); location.reload(); break;
    }
    this.renderPanel(); this.renderInfo(); this.renderTop(); this.drawUnits();
  },
  slider(name, v) {
    const n = N(G.player);
    if (name === 'tax') { n.tax = v / 100; const e = $('#taxv'); if (e) e.textContent = v + ' %'; }
    if (name.startsWith('bud_')) {
      const k = name.slice(4); n.budget[k] = v / 1000; const t = budgetTotals(n); n.budgetInfo = t;
      const e = $('#bv_' + k); if (e) e.textContent = fmt(v / 10, 1) + ' %';
      const m = $('#bm_' + k); if (m) m.textContent = money(n.budget[k] * t.gdp) + '/år';
    }
    if (name.startsWith('alloc_')) {
      const k = name.slice(6); const others = ['inf', 'arm', 'air'].filter(x => x !== k); const rest = 1 - v / 100;
      const os = others.reduce((s, x) => s + n.alloc[x], 0) || 1;
      n.alloc[k] = v / 100; for (const x of others) n.alloc[x] = rest * (os ? n.alloc[x] / os : 0.5);
    }
  },
  askJoin(w, ally) { this.setSpeed(0); this.modal(`<h2>Allianseforpliktelse</h2><p>${esc(N(ally).name)} har gått til krig («${esc(w.name)}») og ber oss om å slutte oss til.</p><div class="acts"><button class="btn red" data-act="joinwar" data-w="${w.id}">Gå inn i krigen</button><button class="btn" data-act="close">Avslå</button></div>`); },
  menu() {
    this.setSpeed(0);
    this.modal(`<h2>Meny</h2><p class="mut">Spillet lagres automatisk hver måned i denne nettleseren.</p><div class="acts"><button class="btn" data-act="save">Lagre nå</button><button class="btn" data-act="quit">Til startskjermen</button><button class="btn red" data-act="new">Slett lagring og start nytt</button><button class="btn" data-act="close">Lukk</button></div>`);
  },
  gameOver() { this.setSpeed(0); this.modal(`<h2>Nasjonen har falt</h2><p>${esc(N(G.player).name)} eksisterer ikke lenger. Spillet er over.</p><div class="acts"><button class="btn big" data-act="new">Nytt spill</button></div>`); },
  modal(html) { $('#modalBox').innerHTML = html; $('#modal').hidden = false; },
  closeModal() { $('#modal').hidden = true; },
  toast(msg, type = 'info', important) {
    if (!$('#toasts')) return;
    if (!important && (type === 'war' || type === 'info') && !msg.includes(N(G.player)?.name || '###') && this.speed >= 4 && !['good', 'bad', 'build'].includes(type)) { /* mindre støy i høy fart */ }
    const t = document.createElement('div'); t.className = 'toast ' + type; t.textContent = msg; $('#toasts').prepend(t);
    while ($('#toasts').children.length > 5) $('#toasts').lastChild.remove();
    setTimeout(() => t.remove(), important ? 9000 : 5000);
    if (important && type === 'war' && this.speed > 2) this.setSpeed(2);
  },
};

// ====================== Hendelser ======================
const Events = {
  pending: null,
  list: [
    { t: 'Teknologisk gjennombrudd', d: 'Et nasjonalt forskningsprogram har gitt resultater innen halvledere.', o: [['Invester i sivil industri (+1 sivil fabrikk)', n => addFactory(n, 'civ')], ['Gi til forsvarsindustrien (+1 militærfabrikk)', n => addFactory(n, 'mil')]] },
    { t: 'Energikrise', d: 'Prisene på olje og gass har skutt i været.', o: [['Subsidier strømregningen (−2 % av BNP i statskassen)', n => { n.treasury -= n.gdpNow * 0.02; }], ['La markedet styre (−8 stabilitet)', n => { n.stab -= 8; }]] },
    { t: 'Massedemonstrasjoner', d: 'Tusenvis protesterer mot regjeringen i hovedstaden.', o: [['Kom med innrømmelser (−40 politisk kapital)', n => { n.pp = Math.max(0, n.pp - 40); n.stab += 3; }], ['Ignorer dem (−10 stabilitet)', n => { n.stab -= 10; }]] },
    { t: 'Handelsboom', d: 'Eksporten har økt kraftig dette kvartalet.', o: [['Fyll statskassen (+1,5 % av BNP)', n => { n.treasury += n.gdpNow * 0.015; }], ['Senk skattene midlertidig (+6 stabilitet)', n => { n.stabBonus = (n.stabBonus || 0) + 6; }]] },
    { t: 'Cyberangrep', d: 'Statlige hackere har lammet deler av forsvarets logistikksystemer.', o: [['Gjengjeld digitalt (+5 krigsstøtte, +3 spenning)', n => { n.wsBonus = (n.wsBonus || 0) + 5; G.tension += 3; }], ['Styrk forsvaret i stillhet (−20 politisk kapital)', n => { n.pp = Math.max(0, n.pp - 20); }]] },
    { t: 'Rekrutteringskampanje', d: 'En populær kampanje gjør militærtjeneste attraktivt.', o: [['Utnytt den (+15 % arbeidskraft)', n => { n.manpower += n.mpMax * 0.15; }], ['Bruk den politisk (+30 politisk kapital)', n => { n.pp += 30; }]] },
    { t: 'Naturkatastrofe', d: 'Flom og storm har rammet en industriregion.', o: [['Gjenoppbygg straks (−1 % av BNP)', n => { n.treasury -= n.gdpNow * 0.01; }], ['Gjenoppbygg sakte (−5 stabilitet)', n => { n.stab -= 5; }]] },
    { t: 'Utenlandsinvestering', d: 'Et stort internasjonalt selskap vil etablere seg i landet.', o: [['Ønsk dem velkommen (+1 sivil fabrikk)', n => addFactory(n, 'civ')], ['Krev lokal kontroll (+25 politisk kapital)', n => { n.pp += 25; }]] },
  ],
  monthly() {
    // vestlig støtte til Ukraina
    const ua = N('804'); if (ua?.alive && atWar('804', '643')) { ua.equip.inf += 400; ua.equip.arm += 40; ua.equip.air += 4; ua.treasury += ua.gdpNow * 0.03; }
    if (G.player && N(G.player)?.alive && Math.random() < 0.28 && UI.speed) {
      const i = Math.floor(Math.random() * this.list.length); const ev = this.list[i]; this.pending = ev;
      UI.modal(`<h2>${ev.t}</h2><p>${ev.d}</p><div class="acts" style="flex-direction:column">${ev.o.map((o, j) => `<button class="btn" data-act="event" data-i="${j}">${o[0]}</button>`).join('')}</div>`);
    }
  },
  resolve(j) { const ev = this.pending; if (!ev) return; ev.o[j][1](N(G.player)); addLog(`${ev.t}: ${ev.o[j][0]}`, 'info'); this.pending = null; },
};
function addFactory(n, t) { const p = P(n.capital); if (p.ctrl === n.tag) p[t]++; else { const q = G.prov.find(x => x.ctrl === n.tag); if (q) q[t]++; } recalcAll(); }

window.UI = UI;
UI.initStart();
