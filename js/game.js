'use strict';
// ====================== VERDENSMAKT 2026 – spillmotor ======================
const M = window.MAPDATA;
const PROV_GEO = M.provinces; // statisk geometri
const START_DATE = Date.UTC(2026, 0, 1);

const UNIT = {
  inf: { name: 'Infanteri', short: 'INF', atk: 10, def: 16, spd: 4, eq: { inf: 100 }, mp: 10, train: 30, up: 1 },
  mech: { name: 'Mekanisert', short: 'MEK', atk: 18, def: 18, spd: 6, eq: { inf: 60, arm: 30 }, mp: 9, train: 45, up: 1.6 },
  arm: { name: 'Panser', short: 'PNS', atk: 30, def: 12, spd: 6, eq: { inf: 30, arm: 70 }, mp: 8, train: 60, up: 2.2 },
};
const EQ_RATE = { inf: 0.8, arm: 0.25, air: 0.08 }; // per militærfabrikk per dag
const BUILD = {
  civ: { name: 'Sivil fabrikk', cost: 1000, money: 2, slot: 1, grp: 'Industri', d: 'Bygger nye bygninger og produserer konsumvarer.' },
  mil: { name: 'Militærfabrikk', cost: 850, money: 2, slot: 1, grp: 'Industri', d: 'Produserer utstyr til hæren og flyvåpenet.' },
  off: { name: 'Kontorbygg og finans', cost: 700, money: 3, slot: 1, grp: 'Næringsliv', d: 'Mer BNP og skatteinntekter. Næringslivet blir mer fornøyd.' },
  tech: { name: 'Teknologipark', cost: 900, money: 4, slot: 1, grp: 'Næringsliv', d: 'Flere forskningspoeng og litt mer BNP.' },
  port: { name: 'Havn og logistikksenter', cost: 800, money: 3, slot: 1, grp: 'Næringsliv', d: 'Høyere økonomisk vekst gjennom handel og logistikk.' },
  pwr: { name: 'Kraftverk', cost: 750, money: 3, slot: 1, grp: 'Næringsliv', d: 'Billig energi: raskere bygging og mer militærproduksjon.' },
  infra: { name: 'Infrastruktur', cost: 600, money: 1.5, grp: 'Infrastruktur og forsvar', d: 'Raskere bygging og forflytning, flere byggeplasser.' },
  fort: { name: 'Festningsverk', cost: 450, money: 1, grp: 'Infrastruktur og forsvar', d: '+12 % forsvar per nivå i provinsen.' },
};
const SLOT_TYPES = ['civ', 'mil', 'off', 'tech', 'port', 'pwr'];
const buildMoney = (n, t) => BUILD[t].money * (n.wage || 0.5);
const usedSlots = p => SLOT_TYPES.reduce((s, k) => s + (p[k] || 0), 0);
const LAWS = {
  cons: [
    { name: 'Frivillig hær', rate: 0.01, stab: 0 },
    { name: 'Begrenset verneplikt', rate: 0.025, stab: -2 },
    { name: 'Utvidet verneplikt', rate: 0.05, stab: -6, req: 'ws40' },
    { name: 'Total mobilisering', rate: 0.10, stab: -12, req: 'war' },
  ],
  econ: [
    { name: 'Sivil økonomi', cg: 0.35, prod: 0.8, stab: 0 },
    { name: 'Delvis mobilisering', cg: 0.25, prod: 1.0, stab: -4 },
    { name: 'Krigsøkonomi', cg: 0.15, prod: 1.25, stab: -10, req: 'tension60' },
  ],
};
const TERRITORY = { '304': '208', '238': '826', '630': '840', '540': '250', '260': '250' };

let G = null; // spilltilstand
const rnd = Math.random;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const key = (a, b) => a < b ? a + '|' + b : b + '|' + a;
const N = t => G.nations[t];
const P = id => G.prov[id];
const dateStr = (d = G.day) => { const dt = new Date(START_DATE + d * 864e5); return dt.getUTCDate() + '. ' + ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des'][dt.getUTCMonth()] + ' ' + dt.getUTCFullYear(); };
const fmtBn = v => (Math.round(v * 10) / 10).toLocaleString('nb-NO') + ' mrd $';
const dayOfMonth = () => new Date(START_DATE + G.day * 864e5).getUTCDate();

function hashColor(s) { let h = 0; for (const c of s) h = (h * 131 + c.charCodeAt(0)) % 9973; return `hsl(${h % 360},${35 + h % 25}%,${42 + (h >> 3) % 18}%)`; }
function llDist(a, b) { const dx = (a[0] - b[0]) * Math.cos((a[1] + b[1]) * Math.PI / 360); return Math.hypot(dx, a[1] - b[1]); }

// ---------------------- Oppsett ----------------------
function newGame(playerTag, opts = {}) {
  G = { day: 0, player: playerTag, nations: {}, prov: [], units: [], recruits: [], wars: [], rel: {}, relBase: {}, trade: {}, nap: {}, alliance: {}, guarantee: {}, sanction: {}, tension: 45, log: [], nextId: 1, over: false, seaExtra: [] };
  // provinser
  for (const g of PROV_GEO) {
    const owner = TERRITORY[g.c] || g.c;
    G.prov.push({ id: g.id, owner, ctrl: owner, core: owner, civ: 0, mil: 0, off: 0, tech: 0, port: 0, pwr: 0, infra: 2, fort: 0, gdp: 0, pop: 0 });
  }
  // havruter
  for (const [a, b] of window.SEA_LANES) {
    const pa = nearestProv(a), pb = nearestProv(b);
    if (pa != null && pb != null && pa !== pb) G.seaExtra.push([pa, pb]);
  }
  buildAdj();
  // nasjoner
  const tags = [...new Set(G.prov.map(p => p.owner))];
  for (const t of tags) {
    const d = window.NATIONS[t] || {};
    const gdp = d.gdp || 22, pop = d.pop || 8;
    const provs = G.prov.filter(p => p.owner === t);
    const gpc = gdp * 1000 / pop; // USD per innbygger
    const n = {
      tag: t, name: d.n || M.countries[t]?.name || t, color: d.col || hashColor(t),
      gdp, pop, nuke: !!d.nuke, aggr: d.aggr ?? 0.06, faction: null,
      treasury: gdp * 0.04, tax: 0.30, pp: 50, stab: 62, ws: 25, manpower: 0,
      equip: { inf: (d.div ?? 2) * 140 + 100, arm: (d.arm ?? 0) * 90 + 20, air: d.air ?? 4 },
      alloc: { inf: 0.6, arm: 0.3, air: 0.1 }, queue: [], laws: { cons: 1, econ: 0 },
      price: gdp / Math.max(2, (d.civ ?? Math.max(1, Math.round(gdp / 25))) + (d.mil ?? (gdp > 60 ? 1 : 0))), alive: true, justify: null, capital: null, aiTimer: Math.floor(rnd() * 3),
      infraLvl: clamp(Math.round(1 + gpc / 12000), 1, 5), lastWarDecl: -999,
    };
    if (t === '643' || t === '804') n.laws = { cons: 2, econ: 2 };
    if (t === '408') n.laws = { cons: 3, econ: 2 };
    G.nations[t] = n;
    // hovedstad
    let capP = provs[0];
    if (d.cap) { let bd = 1e9; for (const p of provs) { const dd = llDist(PROV_GEO[p.id].ll, d.cap); if (dd < bd) { bd = dd; capP = p; } } }
    else { capP = provs.reduce((a, b) => PROV_GEO[a.id].a > PROV_GEO[b.id].a ? a : b); }
    n.capital = capP.id;
    // fordel BNP/folk/fabrikker
    const w = provs.map(p => (Math.sqrt(PROV_GEO[p.id].a) + 2) * (p.id === capP.id ? 3 : 1) * (p.core === t ? 1 : 0.2));
    const ws = w.reduce((a, b) => a + b, 0);
    provs.forEach((p, i) => { p.gdp = gdp * w[i] / ws; p.pop = pop * w[i] / ws; p.infra = n.infraLvl; });
    distribute(provs, w, d.civ ?? Math.max(1, Math.round(gdp / 25)), 'civ');
    distribute(provs, w, d.mil ?? (gdp > 60 ? 1 : 0), 'mil');
    const civN = d.civ ?? Math.max(1, Math.round(gdp / 25)); const rich = gpc > 25000 ? 2 : gpc > 8000 ? 1 : 0;
    distribute(provs, w, Math.round(civN * [0.08, 0.2, 0.4][rich]), 'off');
    distribute(provs, w, Math.round(civN * [0, 0.05, 0.12][rich]), 'tech');
    distribute(provs, w, Math.round(civN * [0.04, 0.08, 0.1][rich]), 'port');
    distribute(provs, w, Math.round(civN * 0.1), 'pwr');
    n.manpower = pop * 1000 * LAWS.cons[n.laws.cons].rate * 0.35;
  }
  for (const [ter, own] of Object.entries(TERRITORY)) if (G.nations[own]) G.prov.filter(p => p.core === ter).forEach(p => p.core = own);
  // fraksjoner
  G.noBlocs = !!opts.noBlocs;
  if (!opts.noBlocs) for (const [fid, f] of Object.entries(window.FACTIONS)) for (const m of f.members) if (G.nations[m]) G.nations[m].faction = fid;
  for (const [a, b] of window.PACTS) if (G.nations[a] && G.nations[b]) G.alliance[key(a, b)] = true;
  G.guarantee['840>158'] = true;
  // relasjoner
  const all = Object.keys(G.nations);
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = N(all[i]), b = N(all[j]); let r = Math.round((rnd() - 0.5) * 20);
    if (a.faction && a.faction === b.faction) r = 70;
    else if (a.faction && b.faction) r = -45;
    if (G.alliance[key(a.tag, b.tag)]) r = Math.max(r, 70);
    G.rel[key(a.tag, b.tag)] = r;
  }
  for (const [a, b, r] of window.RIVALS) if (G.nations[a] && G.nations[b]) G.rel[key(a, b)] = r;
  G.relBase = { ...G.rel };
  // handelsavtaler mellom store økonomier i samme blokk
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) { const a = N(all[i]), b = N(all[j]); if (a.gdp > 300 && b.gdp > 300 && rel(a.tag, b.tag) > 30) G.trade[key(a.tag, b.tag)] = true; }
  // tropper
  for (const n of Object.values(G.nations)) {
    const d = window.NATIONS[n.tag] || {};
    const inf = d.div ?? (n.gdp > 15 ? 2 : 1), arm = d.arm ?? 0;
    const list = [];
    for (let i = 0; i < inf; i++) list.push('inf');
    for (let i = 0; i < arm; i++) list.push(i % 2 ? 'arm' : 'mech');
    placeUnits(n, list);
  }
  if (opts.ukraineWar && G.nations['643'] && G.nations['804']) setupUkraineWar();
  recalcAll();
  for (const n of Object.values(G.nations)) initEcon(n);
  addLog(`Velkommen, leder av ${N(playerTag).name}. Året er 2026.`, 'info');
  return G;
}
function distribute(provs, w, total, field) {
  const ws = w.reduce((a, b) => a + b, 0); let given = 0;
  const parts = provs.map((p, i) => { const v = total * w[i] / ws; const f = Math.floor(v); given += f; return { p, f, r: v - f }; });
  parts.sort((a, b) => b.r - a.r);
  for (let i = 0; i < total - given; i++) parts[i % parts.length].f++;
  for (const x of parts) x.p[field] = x.f;
}
function nearestProv(ll) { let best = null, bd = 1e9; for (const g of PROV_GEO) { const d = llDist(g.ll, ll); if (d < bd) { bd = d; best = g.id; } } return best; }
function buildAdj() {
  G.adj = PROV_GEO.map(g => g.n.map(j => ({ to: j, sea: false })).concat(g.s.map(j => ({ to: j, sea: true }))));
  for (const [a, b] of G.seaExtra) { G.adj[a].push({ to: b, sea: true }); G.adj[b].push({ to: a, sea: true }); }
}
function placeUnits(n, list) {
  const own = G.prov.filter(p => p.owner === n.tag);
  const border = own.filter(p => G.adj[p.id].some(e => !e.sea && P(e.to).owner !== n.tag));
  list.forEach((t, i) => {
    const p = (i % 5 < 2 || !border.length) ? n.capital : border[Math.floor(rnd() * border.length)].id;
    G.units.push(mkUnit(n.tag, t, p));
  });
}
function mkUnit(o, t, p) { return { id: G.nextId++, o, t, s: 100, p, path: [], prog: 0 }; }
function setupUkraineWar() {
  const east = G.prov.filter(p => p.owner === '804' && (PROV_GEO[p.id].ll[0] > 36));
  for (const p of east) { p.ctrl = '643'; p.fort = 2; }
  for (const p of G.prov) if (p.owner === '804' && p.ctrl === '804') p.fort = 3;
  const w = { id: G.nextId++, name: 'Krigen i Ukraina', att: ['643'], def: ['804'], start: -1400 };
  G.wars.push(w);
  // flytt enheter til fronten
  const front = G.prov.filter(p => p.owner === '804' && p.ctrl === '804' && G.adj[p.id].some(e => P(e.to).ctrl === '643'));
  const ru = G.prov.filter(p => p.ctrl === '643' && G.adj[p.id].some(e => P(e.to).ctrl === '804'));
  let i = 0;
  for (const u of G.units) {
    if (u.o === '804' && front.length && (i++ % 4 !== 0 || P(u.p).ctrl !== '804')) u.p = front[i % front.length].id;
    if (u.o === '643' && P(u.p).ctrl !== '643') u.p = N('643').capital;
    if (u.o === '643' && ru.length && rnd() < 0.55) u.p = ru[Math.floor(rnd() * ru.length)].id;
  }
  G.tension = 58;
  G.rel[key('643', '804')] = -100;
}

// ---------------------- Diplomatiske hjelpere ----------------------
function rel(a, b) { return a === b ? 100 : (G.rel[key(a, b)] ?? 0); }
function addRel(a, b, v) { if (a === b) return; const k = key(a, b); G.rel[k] = clamp((G.rel[k] ?? 0) + v, -100, 100); }
function allied(a, b) {
  if (a === b) return true;
  const na = N(a), nb = N(b);
  if (na && nb && na.faction && na.faction === nb.faction) return true;
  return !!G.alliance[key(a, b)];
}
function guarantors(t) { return Object.keys(G.guarantee).filter(k => k.endsWith('>' + t)).map(k => k.split('>')[0]).filter(g => N(g)?.alive); }
function defenders(t) { // hvem forsvarer t hvis angrepet
  const s = new Set();
  for (const n of Object.values(G.nations)) if (n.alive && n.tag !== t && allied(n.tag, t)) s.add(n.tag);
  for (const g of guarantors(t)) s.add(g);
  return [...s];
}
function warsOf(t) { return G.wars.filter(w => w.att.includes(t) || w.def.includes(t)); }
function sideOf(w, t) { return w.att.includes(t) ? 'att' : w.def.includes(t) ? 'def' : null; }
function atWar(a, b) {
  if (a === b) return false;
  for (const w of G.wars) { const sa = sideOf(w, a), sb = sideOf(w, b); if (sa && sb && sa !== sb) return true; }
  return false;
}
function coBelligerent(a, b) { for (const w of G.wars) { const sa = sideOf(w, a); if (sa && sa === sideOf(w, b)) return true; } return false; }
function friendly(a, b) { return a === b || allied(a, b) || coBelligerent(a, b); }
function enemiesOf(t) { const s = new Set(); for (const w of warsOf(t)) for (const e of (sideOf(w, t) === 'att' ? w.def : w.att)) s.add(e); return [...s]; }
function canEnter(o, pid) { const c = P(pid).ctrl; return friendly(o, c) || atWar(o, c); }
function landNeighbors(t) { const s = new Set(); for (const p of G.prov) if (p.ctrl === t) for (const e of G.adj[p.id]) { const c = P(e.to).ctrl; if (c !== t && (!e.sea || PROV_GEO[p.id] && true)) s.add(c); } return [...s]; }

// ---------------------- Aggregater ----------------------
function recalcAll() {
  for (const n of Object.values(G.nations)) { n.civ = 0; n.mil = 0; n.off = 0; n.techP = 0; n.port = 0; n.pwr = 0; n.gdpNow = 0; n.provCount = 0; n.ownCount = 0; n.ownCtrl = 0; n.ownGdp = 0; n.ownCtrlGdp = 0; n.popNow = 0; n.divs = 0; n.power = 0; }
  for (const p of G.prov) {
    const c = N(p.ctrl), o = N(p.owner);
    const eff = p.ctrl === p.owner ? 1 : 0.4;
    c.civ += p.civ * eff; c.mil += p.mil * eff; c.off += (p.off || 0) * eff; c.techP += (p.tech || 0) * eff; c.port += (p.port || 0) * eff; c.pwr += (p.pwr || 0) * eff; c.gdpNow += p.gdp * eff; c.provCount++; c.popNow += p.pop * (p.ctrl === p.owner ? 1 : 0.5);
    o.ownCount++; o.ownGdp += p.gdp + 0.01; if (p.ctrl === p.owner) { o.ownCtrl++; o.ownCtrlGdp += p.gdp + 0.01; }
  }
  for (const n of Object.values(G.nations)) { n.upkeep = 0; n.nTrade = 0; n.nSanc = 0; }
  for (const u of G.units) { const n = N(u.o); n.divs++; n.upkeep += UNIT[u.t].up; n.power += (UNIT[u.t].atk + UNIT[u.t].def) * u.s / 100; }
  for (const r of G.recruits) { const n = N(r.o); if (n) n.upkeep += UNIT[r.t].up * 0.5; }
  for (const k in G.trade) for (const t of k.split('|')) if (N(t)) N(t).nTrade++;
  for (const k in G.sanction) { const t = k.split('>')[1]; if (N(t)) N(t).nSanc++; }
  for (const n of Object.values(G.nations)) {
    n.civ = Math.floor(n.civ); n.mil = Math.floor(n.mil);
    if (n.alive && n.provCount === 0) killNation(n.tag);
    n.mpMax = n.popNow * 1000 * LAWS.cons[n.laws.cons].rate;
    n.power += n.equip.air * 0.05;
  }
}
function killNation(t) {
  const n = N(t); if (!n.alive) return;
  n.alive = false; G.units = G.units.filter(u => u.o !== t); G.recruits = G.recruits.filter(r => r.o !== t);
  for (const w of G.wars) { w.att = w.att.filter(x => x !== t); w.def = w.def.filter(x => x !== t); }
  checkWarsEnd();
  addLog(`${n.name} har opphørt å eksistere.`, 'war');
  if (t === G.player) { G.over = true; UI.gameOver(false); }
}

// ---------------------- Økonomi ----------------------
// econDay, gdpGrowthYear m.m. ligger i economy.js
function monthly() {
  for (const n of Object.values(G.nations)) if (n.alive) {
    econMonthly(n);
    const g = n.growth / 12;
    for (const p of G.prov) if (p.owner === n.tag && p.ctrl === n.tag) p.gdp *= 1 + g;
  }
  // relasjoner glir mot utgangspunkt
  for (const k in G.rel) { const b = G.relBase[k] ?? 0; G.rel[k] += (b - G.rel[k]) * 0.03; }
  for (const k in G.trade) { const [a, b] = k.split('|'); addRel(a, b, 1); }
  for (const k in G.sanction) { const [a, b] = k.split('>'); addRel(a, b, -1); }
  G.tension = clamp(G.tension - 2 + Math.min(4, G.wars.length) * 0.25, 0, 100);
  aiMonthly();
  warPeaceCheck();
  Events.monthly();
}

// ---------------------- Krig ----------------------
function provName(id) { const g = PROV_GEO[id]; const p = P(id); const n = N(p.core) || N(p.owner); const base = n ? n.name : '?'; if (p.id === N(p.owner)?.capital && p.owner === p.core) return base + ' (hovedstad)'; return g.dir ? `${base} – ${g.dir}` : base; }
function declareWar(a, t, opts = {}) {
  if (atWar(a, t) || a === t) return;
  const na = N(a), nt = N(t);
  const justified = na.justify && na.justify.target === t && na.justify.days <= 0;
  if (!justified) { na.stab -= 15; G.tension += 10; for (const n of Object.values(G.nations)) if (n.alive && n.tag !== a) addRel(n.tag, a, -10); }
  if (G.nap[key(a, t)]) { na.stab -= 10; delete G.nap[key(a, t)]; }
  delete G.trade[key(a, t)];
  na.justify = null; na.lastWarDecl = G.day;
  const w = { id: G.nextId++, name: `${na.name}s angrep på ${nt.name}`, att: [a], def: [t], start: G.day };
  G.wars.push(w); G.dirtyMap = true;
  addRel(a, t, -60);
  G.tension = clamp(G.tension + 8 + Math.sqrt(nt.gdp) / 10, 0, 100);
  addLog(`⚔ ${na.name} har erklært krig mot ${nt.name}!`, 'war', true);
  // forsvarere
  for (const d of defenders(t)) {
    if (d === a || atWar(d, a) || allied(d, a)) continue;
    if (d === G.player) { joinWar(w, d, 'def'); addLog(`Vi er forpliktet til å forsvare ${nt.name} og er nå i krig med ${na.name}.`, 'war', true); }
    else if (rel(d, a) < 50) joinWar(w, d, 'def');
  }
  // angriperens allierte
  for (const al of Object.values(G.nations)) {
    if (!al.alive || al.tag === a || !allied(al.tag, a) || sideOf(w, al.tag)) continue;
    if (allied(al.tag, t)) continue;
    if (al.tag === G.player) { UI.askJoin(w, a); continue; }
    if (rel(al.tag, a) >= 65 && rel(al.tag, t) <= -10 && rnd() < 0.7) joinWar(w, al.tag, 'att');
  }
}
function joinWar(w, t, side) {
  if (sideOf(w, t)) return;
  w[side].push(t);
  const nm = N(t).name;
  addLog(`${nm} går inn i «${w.name}» på ${side === 'att' ? 'angripersiden' : 'forsvarersiden'}.`, 'war');
}
function warScore(w, side) { // fra side sitt perspektiv, -100..100
  const mine = w[side], theirs = w[side === 'att' ? 'def' : 'att'];
  let took = 0, theirTot = 0, lost = 0, myTot = 0;
  for (const p of G.prov) {
    if (theirs.includes(p.owner)) { theirTot += p.gdp; if (mine.includes(p.ctrl)) took += p.gdp; }
    if (mine.includes(p.owner)) { myTot += p.gdp; if (theirs.includes(p.ctrl)) lost += p.gdp; }
  }
  return Math.round(100 * (took / (theirTot || 1) - lost / (myTot || 1)));
}
function capture(pid, by) {
  const p = P(pid); const old = p.ctrl;
  let nc = by;
  if (p.owner !== by && coBelligerent(p.owner, by) && N(p.owner).alive) nc = p.owner; // frigjøring av alliert
  p.ctrl = nc;
  p.civ = Math.max(0, p.civ - (rnd() < 0.3 ? 1 : 0));
  if (old === G.player || by === G.player || p.owner === G.player) addLog(`${N(nc).name} har tatt kontroll over ${provName(pid)}.`, by === G.player || nc === G.player ? 'good' : 'bad');
  // fiendtlige enheter fanget i provinsen flyttes ut
  for (const u of G.units) if (u.p === pid && atWar(u.o, nc)) retreat(u);
  G.dirtyMap = true;
  recalcAll();
  checkCapitulation(old);
}
function checkCapitulation(t) {
  const n = N(t); if (!n || !n.alive || !warsOf(t).length) return;
  const ratio = n.ownCtrlGdp / (n.ownGdp || 1);
  const capLost = P(n.capital).ctrl !== t;
  if (ratio < 0.22 || (capLost && ratio < 0.5) || (n.ownCount === 1 && capLost)) capitulate(t);
}
function capitulate(t) {
  const n = N(t);
  const enemies = enemiesOf(t);
  addLog(`🏳 ${n.name} har kapitulert!`, 'war', true);
  // hvem tok mest
  const cnt = {}; for (const p of G.prov) if (p.owner === t && enemies.includes(p.ctrl)) cnt[p.ctrl] = (cnt[p.ctrl] || 0) + p.gdp;
  let winner = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || enemies[0];
  for (const p of G.prov) {
    if (p.owner === t) { if (enemies.includes(p.ctrl)) p.owner = p.ctrl; else if (winner) { p.owner = winner; p.ctrl = winner; } }
    else if (p.ctrl === t) p.ctrl = N(p.owner).alive ? p.owner : winner;
  }
  for (const p of G.prov) if (p.owner === t) { p.owner = winner; p.ctrl = winner; }
  // lager overføres delvis
  if (winner) { const w = N(winner); w.equip.inf += n.equip.inf * 0.3; w.equip.arm += n.equip.arm * 0.3; }
  G.tension = clamp(G.tension + 5, 0, 100);
  for (const k of Object.keys(G.alliance)) if (k.split('|').includes(t)) delete G.alliance[k];
  G.dirtyMap = true;
  recalcAll();
  killNation(t);
  if (winner === G.player) { N(G.player).pp += 50; addLog(`Vi har annektert ${n.name}.`, 'good'); }
}
function checkWarsEnd() {
  for (const w of [...G.wars]) {
    if (!w.att.length || !w.def.length) endWar(w, 'statusquo');
  }
}
function endWar(w, mode) {
  G.wars = G.wars.filter(x => x !== w);
  const parties = [...w.att, ...w.def];
  for (const p of G.prov) {
    if (p.owner === p.ctrl) continue;
    const o = p.owner, c = p.ctrl;
    if (!(parties.includes(o) && parties.includes(c) && sideOf(w, o) !== sideOf(w, c))) continue;
    if (atWar(o, c)) continue; // fortsatt i annen krig
    if (mode === 'white') p.ctrl = o; else { p.owner = c; }
  }
  // enheter i fiendeland flyttes hjem
  for (const u of G.units) { if (!parties.includes(u.o)) continue; u.path = []; u.prog = 0; if (!friendly(u.o, P(u.p).ctrl)) { u.p = N(u.o).capital; } }
  G.dirtyMap = true;
  recalcAll();
  addLog(`☮ Fred: «${w.name}» er over (${mode === 'white' ? 'hvit fred' : 'status quo'}).`, 'info', parties.includes(G.player));
}
function warPeaceCheck() { // AI-AI kriger som står fast avsluttes
  for (const w of [...G.wars]) {
    if (w.att.includes(G.player) || w.def.includes(G.player)) continue;
    const dur = G.day - w.start; const s = warScore(w, 'att');
    if (dur > 360 && Math.abs(s) < 12 && rnd() < 0.12) endWar(w, 'white');
    else if (dur > 200 && s > 35 && rnd() < 0.08) endWar(w, 'statusquo');
  }
}
function peaceOffer(w, mode) { // spilleren tilbyr fred
  const pside = sideOf(w, G.player); if (!pside) return { ok: false, msg: 'Ikke i krigen.' };
  const eside = pside === 'att' ? 'def' : 'att';
  const es = warScore(w, eside); const dur = G.day - w.start;
  let ok;
  if (mode === 'white') ok = (es <= 8 && dur > 45) || es < -5 || (dur > 720 && es < 20);
  else ok = es <= -12 || (es <= -4 && dur > 365);
  const leader = N(w[eside][0]);
  if (ok) { endWar(w, mode); return { ok: true, msg: `${leader.name} godtok fredsavtalen.` }; }
  return { ok: false, msg: `${leader.name} avviste tilbudet (deres krigsscore: ${es}).` };
}
function leaveWar(w) { // separat fred for spilleren
  const pside = sideOf(w, G.player); const eside = pside === 'att' ? 'def' : 'att';
  const es = warScore(w, eside);
  if (es > 10) return { ok: false, msg: 'Fienden krever mer – de vinner krigen.' };
  w[pside] = w[pside].filter(x => x !== G.player);
  for (const p of G.prov) {
    if (p.owner === G.player && w[eside].includes(p.ctrl)) p.ctrl = p.owner;
    if (p.ctrl === G.player && w[eside].includes(p.owner)) p.ctrl = p.owner;
  }
  for (const u of G.units) if (u.o === G.player) { u.path = []; if (!friendly(u.o, P(u.p).ctrl)) u.p = N(u.o).capital; }
  if (!w[pside].length) endWar(w, 'white');
  G.dirtyMap = true; recalcAll();
  N(G.player).stab -= 5;
  return { ok: true, msg: 'Vi har inngått separatfred.' };
}

// ---------------------- Militær ----------------------
function travelDays(a, b, t, sea) {
  const ga = PROV_GEO[a], gb = PROV_GEO[b];
  const d = Math.hypot(ga.x - gb.x, ga.y - gb.y);
  if (sea) return 6 + d / 10;
  return Math.max(2, d / (UNIT[t].spd * (0.7 + 0.12 * P(b).infra)));
}
function findPath(u, dest) {
  if (dest === u.p) return [];
  const dist = new Map([[u.p, 0]]), prev = new Map(); const open = [[0, u.p]];
  while (open.length) {
    open.sort((a, b) => a[0] - b[0]); const [d, c] = open.shift();
    if (c === dest) break;
    if (d > dist.get(c)) continue;
    if (c !== u.p && atWar(u.o, P(c).ctrl) && c !== dest) { /* kan gå gjennom fiendeland */ }
    for (const e of G.adj[c]) {
      if (!canEnter(u.o, e.to)) continue;
      const nd = d + travelDays(c, e.to, u.t, e.sea) + (atWar(u.o, P(e.to).ctrl) ? 15 : 0);
      if (nd < (dist.get(e.to) ?? 1e9)) { dist.set(e.to, nd); prev.set(e.to, c); open.push([nd, e.to]); }
    }
  }
  if (!prev.has(dest)) return null;
  const path = []; let c = dest; while (c !== u.p) { path.unshift(c); c = prev.get(c); }
  return path;
}
function orderMove(u, dest) { const p = findPath(u, dest); if (!p) return false; u.path = p; u.prog = 0; return true; }
function isSea(a, b) { return G.adj[a].some(e => e.to === b && e.sea); }
function retreat(u) {
  const opts = G.adj[u.p].map(e => e.to).filter(pid => friendly(u.o, P(pid).ctrl) && !G.units.some(v => v.p === pid && atWar(v.o, u.o)));
  u.path = []; u.prog = 0;
  if (!opts.length) { u.dead = true; if (u.o === G.player) addLog(`En ${UNIT[u.t].name.toLowerCase()}divisjon ble omringet og tilintetgjort.`, 'bad'); return; }
  u.p = opts[Math.floor(rnd() * opts.length)]; u.s = Math.max(u.s, 8);
}
function militaryDay() {
  const battles = new Map();
  const unitsAt = new Map(); for (const u of G.units) { if (!unitsAt.has(u.p)) unitsAt.set(u.p, []); unitsAt.get(u.p).push(u); }
  for (const u of G.units) {
    if (!u.path.length) continue;
    const nx = u.path[0];
    if (!canEnter(u.o, nx)) { u.path = []; u.prog = 0; continue; }
    const defs = (unitsAt.get(nx) || []).filter(v => atWar(v.o, u.o));
    if (defs.length) { if (!battles.has(nx)) battles.set(nx, { att: [], def: defs }); battles.get(nx).att.push(u); continue; }
    u.prog += 1;
    const need = travelDays(u.p, nx, u.t, isSea(u.p, nx));
    if (u.prog >= need) {
      u.p = nx; u.path.shift(); u.prog = 0;
      if (atWar(u.o, P(nx).ctrl)) { capture(nx, u.o); if (u.o !== G.player) u.path = []; }
    }
  }
  // kamper
  G.battles = [];
  for (const [pid, b] of battles) {
    const p = P(pid);
    const atkSide = b.att[0].o, defSide = b.def[0].o;
    const airA = sideAir(atkSide), airD = sideAir(defSide);
    const airMod = 0.35 * (airA - airD) / (airA + airD + 1);
    const sea = b.att.every(u => isSea(u.p, pid));
    let A = b.att.reduce((s, u) => s + UNIT[u.t].atk * u.s / 100, 0) * (1 + airMod) * (sea ? 0.5 : 1) * (0.85 + rnd() * 0.3) * stabFactor(atkSide, 'atk');
    let D = b.def.reduce((s, u) => s + UNIT[u.t].def * u.s / 100, 0) * (1 - airMod) * (1 + p.fort * 0.12) * (p.core === defSide ? 1.1 : 1) * (0.85 + rnd() * 0.3) * stabFactor(defSide, 'def');
    const tot = A + D + 0.01;
    for (const u of b.def) { u.s -= 9 * A / tot * (b.att.length / Math.max(1, b.def.length)) ** 0.3; }
    for (const u of b.att) { u.s -= 8 * D / tot * (b.def.length / Math.max(1, b.att.length)) ** 0.3; }
    for (const u of b.def) if (u.s < 20) retreat(u);
    for (const u of b.att) if (u.s < 22) { u.path = []; u.prog = 0; }
    G.battles.push({ p: pid, A, D, att: atkSide, def: defSide });
  }
  for (const b of battles.values()) for (const u of [...b.att, ...b.def]) u.fight = G.day;
  for (const u of G.units) if (!u.path.length && !u.dead && (u.fight ?? -9) < G.day - 1) reinforce(u);
  for (const u of G.units) if (u.s <= 0) u.dead = true;
  G.units = G.units.filter(u => !u.dead);
  // rekruttering
  for (const r of G.recruits) r.days--;
  for (const r of G.recruits.filter(r => r.days <= 0)) {
    let sp = r.p; if (P(sp).ctrl !== r.o) sp = N(r.o).capital;
    if (P(sp).ctrl !== r.o) { const own = G.prov.find(p => p.ctrl === r.o); if (!own) continue; sp = own.id; }
    G.units.push(mkUnit(r.o, r.t, sp));
    if (r.o === G.player) addLog(`Ny ${UNIT[r.t].name.toLowerCase()}divisjon klar i ${provName(sp)}.`, 'build');
  }
  G.recruits = G.recruits.filter(r => r.days > 0);
}
function sideAir(t) { let s = N(t).equip.air * (1 + mods(N(t)).air); for (const e of Object.values(G.nations)) if (e.alive && e.tag !== t && coBelligerent(e.tag, t)) s += e.equip.air * (1 + mods(e).air) * 0.5; return s; }
function stabFactor(t, kind) { const n = N(t); const m = mods(n); const f = Math.min(1, n.funding ?? 1); return (0.85 + n.stab / 400 + n.ws / 600) * (0.7 + 0.3 * f) * (1 + (kind === 'atk' ? m.atk : m.def)) * (1 + Math.max(0, n.values?.mil || 0) * 0.0008) * (groupCrisis(n, 'mil') ? 0.9 : 1); }
function reinforce(u) {
  if (u.s >= 100) return;
  if (!friendly(u.o, P(u.p).ctrl)) return;
  const n = N(u.o); const tpl = UNIT[u.t]; const step = 3;
  if (rnd() > Math.min(1, n.funding ?? 1)) return;
  for (const [k, v] of Object.entries(tpl.eq)) if (n.equip[k] < v * step / 100) return;
  if (n.manpower < tpl.mp * step / 100) return;
  for (const [k, v] of Object.entries(tpl.eq)) n.equip[k] -= v * step / 100;
  n.manpower -= tpl.mp * step / 100;
  u.s = Math.min(100, u.s + step);
}
function canRecruit(t, type) {
  const n = N(t), tpl = UNIT[type];
  for (const [k, v] of Object.entries(tpl.eq)) if (n.equip[k] < v) return `Mangler utstyr (${k === 'inf' ? 'infanteriutstyr' : 'pansret materiell'})`;
  if (n.manpower < tpl.mp) return 'Mangler arbeidskraft';
  return null;
}
function recruit(t, type, p) {
  if (canRecruit(t, type)) return false;
  const n = N(t), tpl = UNIT[type];
  for (const [k, v] of Object.entries(tpl.eq)) n.equip[k] -= v;
  n.manpower -= tpl.mp;
  G.recruits.push({ o: t, t: type, p: p ?? n.capital, days: tpl.train });
  return true;
}
function queueBuild(t, type, pid) {
  const n = N(t), p = P(pid);
  if (p.ctrl !== t) return 'Provinsen er ikke under din kontroll';
  if (SLOT_TYPES.includes(type) && usedSlots(p) + n.queue.filter(i => i.p === pid && SLOT_TYPES.includes(i.t)).length >= maxSlots(p)) return 'Ingen ledige byggeplasser (bygg infrastruktur)';
  const cost = buildMoney(n, type);
  if (n.crisis) return 'Statsbankerott – ingen penger til nye prosjekter';
  if (type === 'infra' && p.infra + n.queue.filter(i => i.p === pid && i.t === 'infra').length >= 5) return 'Maks infrastruktur';
  if (type === 'fort' && p.fort + n.queue.filter(i => i.p === pid && i.t === 'fort').length >= 5) return 'Maks festningsnivå';
  n.treasury -= cost;
  n.queue.push({ t: type, p: pid, prog: 0, paid: cost });
  return null;
}
function maxSlots(p) { return 8 + p.infra * 6 + Math.round(Math.sqrt(p.pop) * 2); }

// ---------------------- Diplomati (spillerhandlinger) ----------------------
const DIPLO = {
  improve: { name: 'Forbedre relasjoner', pp: 25 },
  trade: { name: 'Foreslå handelsavtale', pp: 40 },
  nap: { name: 'Ikke-angrepspakt', pp: 40 },
  alliance: { name: 'Forsvarsallianse', pp: 100 },
  faction: { name: 'Søk medlemskap i blokk', pp: 80 },
  invite: { name: 'Inviter til vår blokk', pp: 80 },
  guarantee: { name: 'Garanter uavhengighet', pp: 50 },
  aid: { name: 'Gi økonomisk bistand', pp: 10 },
  sanction: { name: 'Innfør sanksjoner', pp: 25 },
  unsanction: { name: 'Opphev sanksjoner', pp: 10 },
  justify: { name: 'Rettferdiggjør krigsmål', pp: 75 },
  war: { name: 'Erklær krig', pp: 0 },
};
function diplo(action, t) {
  const me = G.player, n = N(me), o = N(t); const a = DIPLO[action]; const r = rel(me, t);
  if (n.pp < a.pp) return { ok: false, msg: 'Ikke nok politisk kapital.' };
  const pay = () => { n.pp -= a.pp; };
  const k = key(me, t);
  switch (action) {
    case 'improve': pay(); addRel(me, t, 12); return { ok: true, msg: `Relasjonene med ${o.name} er forbedret.` };
    case 'trade':
      if (G.trade[k]) return { ok: false, msg: 'Dere har allerede handelsavtale.' };
      if (atWar(me, t) || G.sanction[me + '>' + t] || G.sanction[t + '>' + me]) return { ok: false, msg: 'Ikke mulig nå.' };
      pay(); if (r >= 5 || (r >= -20 && rnd() < 0.5)) { G.trade[k] = true; addRel(me, t, 10); return { ok: true, msg: `${o.name} har signert en handelsavtale.` }; }
      return { ok: false, msg: `${o.name} avslo handelsavtalen.` };
    case 'nap':
      if (G.nap[k]) return { ok: false, msg: 'Pakt finnes allerede.' };
      pay(); if (r >= 10 && !atWar(me, t)) { G.nap[k] = true; addRel(me, t, 10); return { ok: true, msg: `Ikke-angrepspakt med ${o.name} er inngått.` }; }
      return { ok: false, msg: `${o.name} avslo pakten.` };
    case 'alliance':
      if (allied(me, t)) return { ok: false, msg: 'Dere er allerede allierte.' };
      if (o.faction && n.faction !== o.faction && enemiesFaction(n, o)) return { ok: false, msg: 'De tilhører en fiendtlig blokk.' };
      pay(); if (r >= 60 && !enemiesOf(me).some(e => rel(t, e) > 40)) { G.alliance[k] = true; addRel(me, t, 15); addLog(`🤝 Forsvarsallianse med ${o.name}.`, 'good'); return { ok: true, msg: `${o.name} har gått med på en forsvarsallianse.` }; }
      return { ok: false, msg: `${o.name} er ikke klar for en allianse (krever relasjon ≥ 60).` };
    case 'faction': {
      const f = o.faction; if (!f) return { ok: false, msg: 'Landet leder ingen blokk.' };
      if (n.faction) return { ok: false, msg: 'Du må først forlate din nåværende blokk.' };
      pay(); if (r >= 55 && n.stab > 40) { n.faction = f; addLog(`Vi er tatt opp som medlem av ${window.FACTIONS[f]?.name || f}.`, 'good', true); return { ok: true, msg: 'Søknaden ble godkjent!' }; }
      return { ok: false, msg: 'Søknaden ble avslått (krever relasjon ≥ 55 med blokkens leder).' };
    }
    case 'invite': {
      if (!n.faction) { n.faction = 'P' + me; window.FACTIONS[n.faction] = { name: `${n.name}-pakten`, leader: me, color: n.color, members: [me] }; }
      if (o.faction) return { ok: false, msg: 'De er allerede med i en blokk.' };
      pay(); if (r >= 60) { o.faction = n.faction; addLog(`${o.name} har sluttet seg til ${window.FACTIONS[n.faction].name}.`, 'good', true); return { ok: true, msg: 'Invitasjonen ble akseptert.' }; }
      return { ok: false, msg: 'De takket nei (krever relasjon ≥ 60).' };
    }
    case 'aid': {
      const amt = Math.max(0.2, Math.min(n.gdpNow * 0.002, o.gdpNow * 0.03));
      pay(); n.treasury -= amt; o.treasury += amt; addRel(me, t, 15);
      return { ok: true, msg: `Vi ga ${o.name} ${fmtBn(amt)} i bistand. Relasjonene er bedret.` };
    }
    case 'guarantee': pay(); G.guarantee[me + '>' + t] = true; addRel(me, t, 15); return { ok: true, msg: `Vi garanterer nå ${o.name}s uavhengighet.` };
    case 'sanction': pay(); G.sanction[me + '>' + t] = true; delete G.trade[k]; addRel(me, t, -30); G.relBase[k] = (G.relBase[k] ?? 0) - 15; return { ok: true, msg: `Sanksjoner innført mot ${o.name}.` };
    case 'unsanction': pay(); delete G.sanction[me + '>' + t]; addRel(me, t, 10); return { ok: true, msg: 'Sanksjonene er opphevet.' };
    case 'justify':
      if (n.justify) return { ok: false, msg: 'Du rettferdiggjør allerede et krigsmål.' };
      pay(); n.justify = { target: t, days: 45 }; G.tension = clamp(G.tension + 3, 0, 100); addRel(me, t, -15);
      return { ok: true, msg: `Vi begynner å rettferdiggjøre krig mot ${o.name} (45 dager).` };
    case 'war': {
      const justified = n.justify && n.justify.target === t && n.justify.days <= 0;
      if (allied(me, t)) return { ok: false, msg: 'Du kan ikke angripe en alliert.' };
      declareWar(me, t);
      return { ok: true, msg: justified ? 'Krig erklært.' : 'Krig erklært uten rettferdiggjøring – stabiliteten faller og verden reagerer!' };
    }
  }
}
function enemiesFaction(a, b) { return a.faction && b.faction && a.faction !== b.faction; }

// ---------------------- AI ----------------------
function aiDay(n) {
  if (n.tag === G.player || !n.alive) return;
  if (--n.aiTimer > 0) return; n.aiTimer = 3;
  const wars = warsOf(n.tag);
  const myUnits = G.units.filter(u => u.o === n.tag);
  if (wars.length) aiWar(n, myUnits);
  if (!wars.length && rnd() < 0.15) {
    // fredstid: plasser noen enheter ved grensen mot rivaler
    const rivals = landNeighbors(n.tag).filter(t => rel(n.tag, t) < -30);
    if (rivals.length) {
      const border = G.prov.filter(p => p.ctrl === n.tag && G.adj[p.id].some(e => rivals.includes(P(e.to).ctrl)));
      for (const u of myUnits) if (!u.path.length && rnd() < 0.3 && border.length) orderMove(u, border[Math.floor(rnd() * border.length)].id);
    }
  }
  // rekruttering
  const cap = 4 + n.mil * 1.0 + Math.sqrt(n.gdpNow) * 0.3;
  if (myUnits.length + G.recruits.filter(r => r.o === n.tag).length < cap && (n.funding ?? 1) > 0.95 && !n.crisis) {
    const type = n.equip.arm > 140 ? (rnd() < 0.5 ? 'arm' : 'mech') : 'inf';
    if (!recruit(n.tag, type)) recruit(n.tag, 'inf');
  }
  // rettferdiggjøring ferdig → krig
  if (n.justify && n.justify.days <= 0 && !atWar(n.tag, n.justify.target) && N(n.justify.target)?.alive) declareWar(n.tag, n.justify.target);
}
function aiWar(n, myUnits) {
  const enemySet = new Set(enemiesOf(n.tag));
  const at = new Map(); for (const v of G.units) { if (!at.has(v.p)) at.set(v.p, []); at.get(v.p).push(v); }
  const enemyUnits = pid => (at.get(pid) || []).filter(v => enemySet.has(v.o));
  const pw = (us, f) => us.reduce((s, v) => s + UNIT[v.t][f] * v.s / 100, 0);
  const front = new Map();
  for (const p of G.prov) {
    if (p.ctrl !== n.tag) continue;
    let threat = 0, isFront = false;
    for (const e of G.adj[p.id]) {
      const eu = enemyUnits(e.to);
      if (enemySet.has(P(e.to).ctrl) || eu.length) { isFront = true; threat += pw(eu, 'atk') * (e.sea ? 0.4 : 1); }
    }
    if (isFront) front.set(p.id, threat);
  }
  const busy = new Set(myUnits.filter(u => u.path.length).map(u => u.id));
  const incoming = new Map(); for (const u of myUnits) if (u.path.length) { const d = u.path[u.path.length - 1]; incoming.set(d, (incoming.get(d) || 0) + 1); }
  const need = pid => Math.max(1, Math.ceil(front.get(pid) / 15));
  // fronten: hold stillingen, angrip med overskudd
  for (const pid of front.keys()) {
    const here = (at.get(pid) || []).filter(u => u.o === n.tag && !busy.has(u.id)).sort((a, b) => b.s - a.s);
    let surplus = here.length - need(pid);
    if (surplus <= 0) continue;
    const strike = here.filter(u => u.s >= 50).slice(0, surplus);
    if (!strike.length) continue;
    let best = null, bs = 0;
    for (const e of G.adj[pid]) {
      const t = e.to; const c = P(t).ctrl; const eu = enemyUnits(t);
      if (!enemySet.has(c) && !eu.length) continue;
      if (!canEnter(n.tag, t)) continue;
      const def = pw(eu, 'def') * (1 + P(t).fort * 0.12) + 0.5;
      const att = pw(strike, 'atk') * (e.sea ? 0.5 : 1);
      const ratio = att / def;
      const score = ratio * (1 + P(t).gdp / (N(c)?.gdpNow || 1) * 3 + (t === N(P(t).owner)?.capital ? 1 : 0));
      if (ratio > 1.25 && score > bs) { bs = score; best = t; }
    }
    if (best != null) for (const u of strike) { u.path = [best]; u.prog = 0; busy.add(u.id); }
  }
  // reserver: flytt til front med underskudd
  let orders = 0;
  const deficits = [...front.keys()].map(pid => ({ pid, d: need(pid) + 1 - (at.get(pid) || []).filter(u => u.o === n.tag).length - (incoming.get(pid) || 0) })).filter(x => x.d > 0).sort((a, b) => b.d - a.d);
  for (const u of myUnits) {
    if (busy.has(u.id) || front.has(u.p) || orders > 20) continue;
    let goal = null;
    if (deficits.length) {
      let bd = 1e9; const g0 = PROV_GEO[u.p];
      for (const x of deficits) { if (x.d <= 0) continue; const g = PROV_GEO[x.pid]; const d = Math.hypot(g.x - g0.x, g.y - g0.y) / (1 + x.d * 0.2); if (d < bd) { bd = d; goal = x; } }
      if (goal) { if (orderMove(u, goal.pid)) { goal.d--; orders++; continue; } }
    }
    if (!front.size || rnd() < 0.3) { const g = nearestEnemyProv(u, [...enemySet]); if (g != null && orderMove(u, g)) orders++; }
    else if (front.size) { const ks = [...front.keys()]; if (orderMove(u, ks[Math.floor(rnd() * ks.length)])) orders++; }
  }
}
function nearestEnemyProv(u, enemies) {
  const seen = new Set([u.p]); const q = [u.p]; let steps = 0;
  while (q.length && steps++ < 600) {
    const c = q.shift();
    for (const e of G.adj[c]) {
      if (seen.has(e.to)) continue; seen.add(e.to);
      const ctrl = P(e.to).ctrl;
      if (enemies.includes(ctrl)) return c === u.p ? e.to : c;
      if (friendly(u.o, ctrl)) q.push(e.to);
    }
  }
  return null;
}
function aiMonthly() {
  for (const n of Object.values(G.nations)) {
    if (!n.alive || n.tag === G.player) continue;
    const war = warsOf(n.tag).length > 0;
    // økonomi
    if (war && n.laws.econ < 2 && n.pp > 75) { n.laws.econ++; n.pp -= 75; }
    if (war && n.laws.cons < 2 && n.pp > 75) { n.laws.cons++; n.pp -= 75; }
    n.alloc = war ? { inf: 0.55, arm: 0.33, air: 0.12 } : { inf: 0.55, arm: 0.3, air: 0.15 };
    // bygging
    if (n.queue.length < Math.max(1, n.civ / 15)) {
      const provs = G.prov.filter(p => p.ctrl === n.tag && p.owner === n.tag);
      if (provs.length) {
        const p = provs[Math.floor(rnd() * provs.length)];
        const milShare = war || n.aggr > 0.3 || G.tension > 65 ? 0.6 : 0.3;
        let t = rnd() < milShare ? 'mil' : 'civ';
        const r = rnd();
        if (!war && r < 0.35) t = ['off', 'off', 'tech', 'port', 'pwr'][Math.floor(rnd() * 5)];
        if (p.infra < 3 && rnd() < 0.3) t = 'infra';
        if (queueBuild(n.tag, t, p.id)) queueBuild(n.tag, 'infra', p.id);
      }
    }
    // diplomati: krigsplaner
    if (!war && !n.justify && n.stab > 40 && G.day - n.lastWarDecl > 365 && n.aggr > 0.1) {
      const cands = landNeighbors(n.tag).filter(t => {
        const o = N(t); if (!o?.alive || allied(n.tag, t) || G.nap[key(n.tag, t)]) return false;
        if (rel(n.tag, t) > -25) return false;
        const protectors = defenders(t).concat(t);
        const nuclear = protectors.some(x => N(x).nuke);
        if (nuclear && !(n.nuke && G.tension > 85)) return false;
        const theirPower = protectors.reduce((s, x) => s + N(x).power * (x === t ? 1 : 0.5), 0);
        return n.power > theirPower * 1.6;
      });
      if (cands.length && rnd() < n.aggr * 0.12 * (0.5 + G.tension / 100)) {
        const t = cands[Math.floor(rnd() * cands.length)];
        n.justify = { target: t, days: 45 }; G.tension = clamp(G.tension + 3, 0, 100);
        addLog(`${n.name} forbereder krigsmål mot ${N(t).name}.`, 'warn', t === G.player);
      }
    }
    // relasjonsforbedring med venner
    if (rnd() < 0.2) { const t = Object.keys(G.nations)[Math.floor(rnd() * Object.keys(G.nations).length)]; if (t !== n.tag && rel(n.tag, t) > 20) addRel(n.tag, t, 3); }
  }
}

// ---------------------- Hovedløkke ----------------------
function tick() {
  if (G.over) return;
  G.day++;
  for (const n of Object.values(G.nations)) if (n.alive) { econDay(n); if (n.justify && n.justify.days > 0) { n.justify.days--; if (n.justify.days === 0 && n.tag === G.player) addLog(`Krigsmålet mot ${N(n.justify.target).name} er klart. Du kan nå erklære krig uten straff.`, 'warn', true); } }
  militaryDay();
  for (const n of Object.values(G.nations)) aiDay(n);
  recalcAll();
  if (dayOfMonth() === 1) monthly();
  G.tension = clamp(G.tension - 0.01, 0, 100);
}
function addLog(msg, type = 'info', popup = false) {
  G.log.unshift({ d: G.day, msg, type });
  if (G.log.length > 300) G.log.length = 300;
  if (window.UI && (popup || ['good', 'bad', 'build', 'warn'].includes(type))) UI.toast(msg, type, popup);
}
// ---------------------- Lagring ----------------------
function saveGame(slot = 'vm2026_save') {
  const data = { ...G, adj: undefined, battles: undefined, factions: window.FACTIONS };
  localStorage.setItem(slot, JSON.stringify(data));
}
function loadGame(slot = 'vm2026_save') {
  const s = localStorage.getItem(slot); if (!s) return false;
  G = JSON.parse(s); if (G.factions) window.FACTIONS = G.factions; delete G.factions;
  buildAdj(); recalcAll(); for (const n of Object.values(G.nations)) ensureEcon(n); return true;
}
