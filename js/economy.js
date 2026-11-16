'use strict';
// ====================== VERDENSMAKT 2026 – økonomi, samfunn og forskning ======================
// Statsbudsjett (Millennium Dawn-inspirert), interessegrupper og samfunnsverdier (EU5-inspirert), teknologi.

const BUDGET = {
  def: { name: 'Forsvar', min: 0.003, max: 0.30, desc: 'Betaler for hæren og militærfabrikkene. Underfinansiering gir lavere produksjon og kampkraft.' },
  wel: { name: 'Helse og velferd', min: 0.01, max: 0.22, desc: 'Gjør folket fornøyd og øker tilgjengelig arbeidskraft.' },
  edu: { name: 'Utdanning', min: 0.01, max: 0.09, desc: 'Gir langsiktig økonomisk vekst og forskningspoeng.' },
  pol: { name: 'Politi og sikkerhet', min: 0.003, max: 0.05, desc: 'Øker stabiliteten og holder statsapparatet fornøyd.' },
  inf: { name: 'Infrastruktur og investeringer', min: 0.005, max: 0.09, desc: 'Raskere bygging og høyere vekst. Næringslivet liker det.' },
  res: { name: 'Forskning og utvikling', min: 0, max: 0.05, desc: 'Gir forskningspoeng til nye teknologier.' },
  adm: { name: 'Administrasjon', min: 0.01, max: 0.06, desc: 'Bedre skatteinngang og mer politisk kapital.' },
};
const GROUPS = {
  bus: { name: 'Næringslivet', icon: '💼', wants: 'lav skatt, frimarked, investeringer, handel og fred' },
  wrk: { name: 'Folket', icon: '👷', wants: 'velferd, utdanning, vekst og demokrati' },
  mil: { name: 'Militæret', icon: '🎖', wants: 'fullfinansiert forsvar, militarisme og seire' },
  sec: { name: 'Statsapparatet', icon: '🏛', wants: 'politi, administrasjon og en sterk stat' },
};
const GROUP_CRISIS = {
  bus: 'Kapitalflukt: −1,5 % årlig vekst',
  wrk: 'Streiker: −15 % bygging og produksjon',
  mil: 'Uro i forsvaret: −10 % kampkraft og fare for kupp',
  sec: 'Korrupsjon: −10 % skatteinngang og −0,5 politisk kapital/dag',
};
const VALUES = [
  { k: 'eco', l: 'Frimarked', r: 'Statsstyrt', el: '+vekst, mektigere næringsliv', er: '+bygging, +militærproduksjon' },
  { k: 'gov', l: 'Demokrati', r: 'Autoritært', el: '+stabilitet, mektigere folk', er: '+politisk kapital, +krigsstøtte' },
  { k: 'for', l: 'Globalisme', r: 'Isolasjonisme', el: 'handelsavtaler gir mer', er: 'sanksjoner biter mindre' },
  { k: 'mil', l: 'Sivilsamfunn', r: 'Militarisme', el: '+vekst', er: '+arbeidskraft, +kampkraft, +krigsstøtte' },
  { k: 'tech', l: 'Tradisjon', r: 'Innovasjon', el: '+stabilitet', er: '+forskning' },
];
const TECH = [
  { id: 'digi', cat: 'Økonomi', name: 'Digital økonomi', cost: 400, eff: { growth: 0.004 }, d: '+0,4 % årlig vekst' },
  { id: 'fin', cat: 'Økonomi', name: 'Fintech og digital skatt', cost: 700, req: 'digi', eff: { taxEff: 0.05 }, d: '+5 % skatteinngang' },
  { id: 'ai', cat: 'Økonomi', name: 'KI-automatisering', cost: 1400, req: 'fin', eff: { growth: 0.008, build: 0.1 }, d: '+0,8 % vekst, +10 % bygging' },
  { id: 'green', cat: 'Energi', name: 'Fornybar energi', cost: 500, eff: { growth: 0.002, stab: 2 }, d: '+0,2 % vekst, +2 stabilitet' },
  { id: 'smr', cat: 'Energi', name: 'Små modulære reaktorer', cost: 1000, req: 'green', eff: { milProd: 0.05, build: 0.05, growth: 0.002 }, d: '+5 % produksjon og bygging' },
  { id: 'adv', cat: 'Industri', name: 'Avansert produksjon', cost: 400, eff: { milProd: 0.1 }, d: '+10 % militærproduksjon' },
  { id: 'robot', cat: 'Industri', name: 'Robotisering', cost: 750, req: 'adv', eff: { build: 0.15 }, d: '+15 % byggehastighet' },
  { id: 'print', cat: 'Industri', name: '3D-printet forsvarsmateriell', cost: 1200, req: 'robot', eff: { milProd: 0.15 }, d: '+15 % militærproduksjon' },
  { id: 'inf2', cat: 'Militær', name: 'Moderne soldatsystemer', cost: 400, eff: { atk: 0.05, def: 0.08 }, d: '+5 % angrep, +8 % forsvar' },
  { id: 'drone', cat: 'Militær', name: 'Dronekrigføring', cost: 850, req: 'inf2', eff: { atk: 0.15 }, d: '+15 % angrep' },
  { id: 'ew', cat: 'Militær', name: 'Elektronisk krigføring', cost: 900, req: 'inf2', eff: { def: 0.12 }, d: '+12 % forsvar' },
  { id: 'hyper', cat: 'Militær', name: 'Hypersoniske missiler', cost: 1500, req: 'drone', eff: { atk: 0.12 }, d: '+12 % angrep' },
  { id: 'stealth', cat: 'Luftmakt', name: '5. generasjons kampfly', cost: 1000, eff: { air: 0.3 }, d: '+30 % luftmakt' },
  { id: 'swarm', cat: 'Luftmakt', name: 'Autonome dronesvermer', cost: 1600, req: 'stealth', eff: { air: 0.3, atk: 0.05 }, d: '+30 % luftmakt, +5 % angrep' },
  { id: 'egov', cat: 'Samfunn', name: 'E-forvaltning', cost: 500, eff: { pp: 0.3 }, d: '+0,3 politisk kapital/dag' },
  { id: 'cyber', cat: 'Samfunn', name: 'Cybersikkerhet', cost: 650, req: 'egov', eff: { stab: 4 }, d: '+4 stabilitet' },
  { id: 'bio', cat: 'Samfunn', name: 'Bioteknologi og helse', cost: 1100, req: 'cyber', eff: { mp: 0.15, growth: 0.003 }, d: '+15 % arbeidskraft, +0,3 % vekst' },
];
const TECH_BY = Object.fromEntries(TECH.map(t => [t.id, t]));
const RATINGS = [['AAA', 0.4, 0.015], ['AA', 0.7, 0.02], ['A', 1.0, 0.025], ['BBB', 1.3, 0.035], ['BB', 1.7, 0.05], ['B', 2.2, 0.07], ['CCC', 2.8, 0.10], ['D', 1e9, 0.18]];

// ---------- Oppsett ----------
function initEcon(n) {
  const e = (window.ECON || {})[n.tag] || {};
  const gpc = n.gdp * 1000 / Math.max(0.05, n.pop);
  n.wage = clamp(Math.sqrt(gpc / 40000), 0.12, 1.6);
  const dev = gpc > 25000 ? 2 : gpc > 8000 ? 1 : 0;
  n.dev = dev;
  n.budget = {
    def: 0, wel: [0.05, 0.09, 0.13][dev], edu: [0.035, 0.045, 0.05][dev], pol: 0.015, inf: [0.035, 0.035, 0.03][dev],
    res: [0.004, 0.012, 0.024][dev], adm: 0.03,
  };
  if (e.def) n.budget.def = e.def / 100;
  if (n.budget.def > 0.08) { n.budget.wel = Math.min(n.budget.wel, 0.05); n.budget.edu = 0.03; n.budget.inf = 0.02; n.budget.res = Math.min(n.budget.res, 0.005); }
  const need = defNeed(n) / n.gdp;
  n.budget.def = clamp(Math.max(n.budget.def, need * 1.05), BUDGET.def.min, BUDGET.def.max);
  const fac = n.faction;
  n.values = {
    eco: e.val?.[0] ?? 0, gov: e.val?.[1] ?? (fac === 'NATO' ? -70 : gpc > 25000 ? -60 : 0),
    for: e.val?.[2] ?? (gpc > 25000 ? -30 : 0), mil: e.val?.[3] ?? 0, tech: e.val?.[4] ?? (gpc > 30000 ? 40 : gpc > 10000 ? 10 : -10),
  };
  n.push = { eco: 0, gov: 0, for: 0, mil: 0, tech: 0 };
  n.treasury = -(e.debt ?? 0.5) * n.gdp;
  const t = budgetTotals(n, true);
  n.tax = clamp((t.spendShare + t.interest / n.gdp) / taxEff(n) - 0.004, 0.10, 0.42);
  n.grp = {}; n.grpBonus = {};
  for (const g of Object.keys(GROUPS)) { n.grp[g] = 55; n.grpBonus[g] = 0; }
  n.tech = { cur: null, p: {}, done: {} };
  if (gpc > 30000) for (const id of ['digi', 'adv', 'inf2']) n.tech.done[id] = true;
  if (['840', '156'].includes(n.tag)) for (const id of ['digi', 'adv', 'inf2', 'drone', 'stealth', 'green']) n.tech.done[id] = true;
  if (['643', '804', '376'].includes(n.tag)) for (const id of ['inf2', 'drone']) n.tech.done[id] = true;
  // regn første interessegruppe-tilfredshet rett på målet
  const tg = groupTargets(n); for (const g in tg) n.grp[g] = tg[g];
  n.stab = stabilityTarget(n);
  n.growth = gdpGrowthYear(n);
}
function ensureEcon(n) { if (!n.budget) { const tr = n.treasury; initEcon(n); } }

// ---------- Hjelpere ----------
function mods(n) {
  const cnt = Object.keys(n.tech?.done || {}).length;
  if (n._m && n._mc === cnt) return n._m;
  const m = { growth: 0, taxEff: 0, build: 0, milProd: 0, atk: 0, def: 0, air: 0, pp: 0, stab: 0, mp: 0 };
  for (const id in n.tech?.done || {}) { const t = TECH_BY[id]; if (t) for (const k in t.eff) m[k] += t.eff[k]; }
  Object.defineProperty(n, '_m', { value: m, writable: true, configurable: true, enumerable: false }); n._mc = cnt;
  return m;
}
function defNeed(n) { // mrd $ per år for å drifte hæren og militærindustrien
  let units = n.upkeep;
  if (units == null) { units = 0; for (const u of G.units) if (u.o === n.tag) units += UNIT[u.t].up; for (const r of G.recruits) if (r.o === n.tag) units += UNIT[r.t].up * 0.5; }
  const law = LAWS.econ[n.laws.econ];
  const mil = n.mil ?? 0;
  return (units * 2.5 + mil * 2 * law.prod + n.equip.air * 0.01) * n.wage + 0.05;
}
function taxEff(n) {
  let e = 0.85 + n.budget.adm * 5 + mods(n).taxEff;
  if (groupCrisis(n, 'sec')) e -= 0.1;
  return clamp(e, 0.7, 1.15);
}
function ratingOf(n) {
  const gdp = n.gdpNow || n.gdp;
  const ratio = Math.max(0, -n.treasury) / gdp;
  const adj = ratio / (0.7 + 0.5 * Math.min(1, n.wage));
  for (const r of RATINGS) if (adj < r[1]) return { r: r[0], rate: r[2] + (warsOf(n.tag).length ? 0.01 : 0) + (n.stab < 30 ? 0.01 : 0), ratio };
}
function budgetTotals(n, init) {
  const gdp = init ? n.gdp : (n.gdpNow || n.gdp);
  const spend = {}; let spendShare = 0;
  for (const k in BUDGET) { spend[k] = n.budget[k] * gdp; spendShare += n.budget[k]; }
  const rt = ratingOf(n);
  const interest = n.treasury < 0 ? -n.treasury * rt.rate : n.treasury * -0.035; // fond gir avkastning (negativ utgift)
  const rev = gdp * (n.tax || 0) * (init ? 1 : taxEff(n));
  const need = defNeed(n);
  const funding = spend.def / Math.max(0.01, need);
  return { gdp, spend, spendShare, interest, rev, balance: rev - spendShare * gdp - interest, need, funding, rating: rt.r, rate: rt.rate, ratio: rt.ratio };
}
function factoriesPerLine(n) {
  if (n.lines) {
    const sum = n.lines.inf + n.lines.arm + n.lines.air;
    const prev = n.linesMil ?? n.mil;
    if (n.autoAssign && n.mil > prev) { // bare nye fabrikker fordeles automatisk
      const free = Math.min(n.mil - prev, n.mil - sum);
      if (free > 0) {
        const base = sum ? { ...n.lines } : { inf: 3, arm: 2, air: 1 }; const bs = base.inf + base.arm + base.air; let given = 0;
        for (const k of ['inf', 'arm', 'air']) { const add = Math.floor(free * base[k] / bs); n.lines[k] += add; given += add; }
        n.lines.inf += free - given;
      }
    }
    n.linesMil = n.mil;
    const s2 = n.lines.inf + n.lines.arm + n.lines.air; const sc = s2 > n.mil ? n.mil / s2 : 1;
    return { inf: n.lines.inf * sc, arm: n.lines.arm * sc, air: n.lines.air * sc };
  }
  const a = n.alloc, sum = a.inf + a.arm + a.air || 1;
  return { inf: n.mil * a.inf / sum, arm: n.mil * a.arm / sum, air: n.mil * a.air / sum };
}
function bizBonus(n) {
  const base = Math.max(5, n.civ || 0);
  return {
    off: Math.min(0.012, (n.off || 0) / base * 0.012), offSat: Math.min(10, (n.off || 0) / base * 40),
    tech: Math.min(0.6, (n.techP || 0) / base * 2),
    port: Math.min(0.01, (n.port || 0) / base * 0.02),
    pwr: Math.min(0.2, (n.pwr || 0) / base * 0.6),
  };
}
function fundingMod(n) { const f = n.funding ?? 1; return f < 1 ? Math.max(0.2, f) : 1 + Math.min(0.2, (f - 1) * 0.25); }
function groupCrisis(n, g) { return n.grp && n.grp[g] < 25 && (n.grpPower?.[g] ?? 0) > 0.2; }
function groupPower(n) {
  const v = n.values;
  const p = {
    bus: 25 - v.eco * 0.12 + (n.dev === 2 ? 5 : 0),
    wrk: 25 - v.gov * 0.15,
    mil: 18 + v.mil * 0.15 + v.gov * 0.08 + (warsOf(n.tag).length ? 8 : 0),
    sec: 18 + v.gov * 0.12 + v.eco * 0.05,
  };
  let s = 0; for (const k in p) { p[k] = Math.max(5, p[k]); s += p[k]; }
  for (const k in p) p[k] /= s;
  return p;
}
function warMood(n) { // -1..1 hvordan krigene går
  const ws = warsOf(n.tag); if (!ws.length) return 0;
  return clamp(ws.reduce((s, w) => s + warScore(w, sideOf(w, n.tag)), 0) / ws.length / 30, -1, 1);
}
function groupTargets(n) {
  const b = n.budget, v = n.values; const g = n.growth ?? 0.02;
  const welNorm = [0.05, 0.09, 0.13][n.dev ?? 1];
  const wars = warsOf(n.tag); const defensive = wars.some(w => w.def.includes(n.tag)); const offensive = wars.some(w => w.att.includes(n.tag));
  const trades = n.nTrade || 0, sanc = n.nSanc || 0;
  const funding = n.funding ?? 1;
  const t = {
    bus: 50 + bizBonus(n).offSat - (n.tax - 0.28) * 220 + (b.inf - 0.03) * 450 - v.eco * 0.15 - v.for * 0.08 + Math.min(10, trades * 1.2) - sanc * 5 - (offensive ? 12 : wars.length ? 6 : 0) + (g - 0.02) * 400,
    wrk: 50 + (b.wel - welNorm) * 320 + (b.edu - 0.045) * 300 - (n.tax - 0.30) * 70 - v.gov * 0.12 - (offensive ? 15 : 0) + (g - 0.02) * 300 - (n.laws.cons >= 2 && !defensive ? 10 : 0) + (defensive ? 20 : 0),
    mil: 50 + clamp((funding - 1) * 45, -35, 20) + v.mil * 0.2 + v.gov * 0.05 + warMood(n) * 15 - (n.laws.cons === 0 ? 5 : 0),
    sec: 50 + (b.pol - 0.015) * 1500 + (b.adm - 0.03) * 700 + v.gov * 0.15 + v.eco * 0.05,
  };
  for (const k in t) t[k] = clamp(t[k] + (n.grpBonus?.[k] || 0), 0, 100);
  return t;
}
function stabilityParts(n) {
  const pw = n.grpPower || groupPower(n);
  let S = 0; for (const g in pw) S += pw[g] * (n.grp?.[g] ?? 50);
  const m = mods(n);
  const parts = [
    ['Interessegruppenes tilfredshet', 12 + S * 0.7],
    ['Politi og sikkerhet', (n.budget.pol - 0.015) * 500],
    ['Styreform', n.values.gov < 0 ? -n.values.gov * 0.06 : -n.values.gov * 0.02],
    ['Tradisjon', Math.max(0, -n.values.tech) * 0.05],
    ['Lover', LAWS.econ[n.laws.econ].stab + LAWS.cons[n.laws.cons].stab],
    ['Teknologi', m.stab],
  ];
  const occ = n.ownCount ? 1 - n.ownCtrl / n.ownCount : 0; if (occ > 0.01) parts.push(['Okkuperte områder', -occ * 25]);
  const offensive = warsOf(n.tag).some(w => w.att.includes(n.tag)); if (offensive && n.ws < 50) parts.push(['Upopulær angrepskrig', -10]);
  if (warsOf(n.tag).some(w => w.def.includes(n.tag))) parts.push(['Samling rundt flagget', 10]);
  if (n.crisis) parts.push(['Statsbankerott', -25]);
  if (n.stabBonus) parts.push(['Hendelser', n.stabBonus]);
  return parts;
}
function stabilityTarget(n) { return clamp(stabilityParts(n).reduce((s, p) => s + p[1], 0), 0, 100); }
function growthParts(n) {
  const b = n.budget, v = n.values, m = mods(n);
  const trades = n.nTrade || 0, sanc = n.nSanc || 0;
  const gpc = (n.gdpNow || n.gdp) * 1000 / Math.max(0.05, n.popNow || n.pop);
  const p = [
    ['Grunnvekst', 0.002],
    ['Innhentingseffekt', gpc < 10000 ? 0.02 : gpc < 25000 ? 0.01 : 0],
    ['Utdanning', (b.edu - 0.045) * 0.5],
    ['Infrastruktur', (b.inf - 0.03) * 0.4],
    ['Forskning', b.res * 0.15],
    ['Kontorbygg og finans', bizBonus(n).off],
    ['Havner og logistikk', bizBonus(n).port],
    ['Skattenivå', -(n.tax - 0.30) * 0.08],
    ['Handelsavtaler', Math.min(10, trades) * 0.0006 * (1 - v.for * 0.005)],
    ['Sanksjoner mot oss', -sanc * 0.012 * (1 - Math.max(0, v.for) * 0.005)],
    ['Samfunnsverdier', -v.eco * 0.00005 - Math.max(0, v.for) * 0.00005 - Math.max(0, v.mil) * 0.00005 + Math.max(0, -v.mil) * 0.00003],
    ['Stabilitet', (n.stab - 55) / 4000],
    ['Teknologi', m.growth],
  ];
  if (warsOf(n.tag).length) p.push(['Krig', -0.03]);
  const rt = ratingOf(n); if (rt.ratio > 1.2) p.push(['Høy statsgjeld', -(rt.ratio - 1.2) * 0.02]);
  if (n.crisis) p.push(['Statsbankerott', -0.04]);
  if (groupCrisis(n, 'bus')) p.push(['Kapitalflukt', -0.015]);
  return p;
}
function gdpGrowthYear(n) { return clamp(growthParts(n).reduce((s, p) => s + p[1], 0), -0.12, 0.10); }
function rpPerDay(n) {
  const b = n.budget;
  return (b.res * 100 * 0.6 + b.edu * 100 * 0.25) * Math.sqrt(n.gdpNow || n.gdp) / 40 * (1 + n.values.tech * 0.003) * (1 + bizBonus(n).tech);
}
function techAvailable(n, t) { return !n.tech.done[t.id] && (!t.req || n.tech.done[t.req]); }

// ---------- Daglig ----------
function econDay(n) {
  ensureEcon(n);
  const law = LAWS.econ[n.laws.econ]; const m = mods(n); const v = n.values;
  const stabMod = n.stab < 30 ? 0.75 : n.stab > 75 ? 1.1 : 1;
  const strike = groupCrisis(n, 'wrk') ? 0.85 : 1;
  // budsjett
  const t = budgetTotals(n);
  n.funding = t.funding; n.balance = t.balance / 365; n.budgetInfo = t;
  n.treasury += n.balance;
  // politisk kapital
  let ppGain = 1 + (n.stab - 50) / 100 + (n.budget.adm - 0.03) * 20 + Math.max(0, v.gov) * 0.004 + m.pp;
  if (groupCrisis(n, 'sec')) ppGain -= 0.5;
  for (const k in n.push) if (n.push[k]) ppGain -= 0.25;
  n.ppGain = ppGain;
  n.pp = clamp(n.pp + ppGain, 0, 999);
  for (const k in n.push) if (n.push[k] && n.pp <= 0) n.push[k] = 0;
  // bygging
  let avail = n.civ * (1 - law.cg) * stabMod * strike * (0.7 + n.budget.inf * 10) * (1 + m.build) * (1 + Math.max(0, v.eco) * 0.002) * (1 + bizBonus(n).pwr);
  if (n.crisis) avail *= 0.6;
  n.cpUsed = 0;
  for (const it of n.queue) {
    if (avail <= 0) break;
    const use = Math.min(15, avail); avail -= use; n.cpUsed += use;
    it.prog += use * (0.8 + 0.08 * P(it.p).infra);
    if (it.prog >= BUILD[it.t].cost) it.done = true;
  }
  for (const it of n.queue.filter(i => i.done)) {
    const p = P(it.p);
    if (p.ctrl !== n.tag) continue;
    const gpf = n.gdpNow / Math.max(20, n.civ);
    if (it.t === 'civ') { p.civ++; p.gdp += gpf * 0.12; }
    else if (it.t === 'mil') p.mil++;
    else if (it.t === 'off') { p.off = (p.off || 0) + 1; p.gdp += gpf * 0.3; }
    else if (it.t === 'tech') { p.tech = (p.tech || 0) + 1; p.gdp += gpf * 0.15; }
    else if (it.t === 'port') { p.port = (p.port || 0) + 1; p.gdp += gpf * 0.2; }
    else if (it.t === 'pwr') { p.pwr = (p.pwr || 0) + 1; p.gdp += gpf * 0.05; }
    else if (it.t === 'infra') p.infra = Math.min(5, p.infra + 1);
    else if (it.t === 'fort') p.fort = Math.min(5, p.fort + 1);
    if (n.tag === G.player) addLog(`${BUILD[it.t].name} ferdigstilt i ${provName(p.id)}.`, 'build');
  }
  n.queue = n.queue.filter(i => !i.done && P(i.p).ctrl === n.tag);
  // militærproduksjon
  const eff = law.prod * stabMod * strike * fundingMod(n) * (1 + m.milProd) * (1 + Math.max(0, v.eco) * 0.001) * (n.crisis ? 0.6 : 1) * (1 + bizBonus(n).pwr);
  n.prodEff = eff;
  const fac = factoriesPerLine(n);
  n.prodOut = {};
  for (const k of ['inf', 'arm', 'air']) { n.prodOut[k] = fac[k] * eff * EQ_RATE[k]; n.equip[k] += n.prodOut[k]; }
  // arbeidskraft
  n.mpMax = n.popNow * 1000 * LAWS.cons[n.laws.cons].rate * (1 + Math.max(0, v.mil) * 0.004 + m.mp + (n.budget.wel - 0.09) * 1.5);
  n.manpower = Math.min(n.mpMax, n.manpower + n.mpMax * 0.002);
  // interessegrupper og stabilitet
  n.grpPower = groupPower(n);
  const tg = groupTargets(n);
  for (const g in tg) n.grp[g] += (tg[g] - n.grp[g]) * 0.02;
  for (const g in n.grpBonus) n.grpBonus[g] *= 0.99;
  n.stab = clamp(n.stab + (stabilityTarget(n) - n.stab) * 0.012, 0, 100);
  const wars = warsOf(n.tag);
  const defensive = wars.some(w => w.def.includes(n.tag)); const offensive = wars.some(w => w.att.includes(n.tag));
  const wsT = 22 + (defensive ? 45 : 0) + (offensive ? 12 : 0) + G.tension / 5 + v.mil * 0.15 + Math.max(0, v.gov) * 0.05 + (n.wsBonus || 0);
  n.ws = clamp(n.ws + (wsT - n.ws) * 0.01, 0, 100);
  if (n.stabBonus) n.stabBonus *= 0.995; if (n.wsBonus) n.wsBonus *= 0.995;
  if (wars.length) n.equip.air *= 0.9995;
  // forskning
  n.rp = rpPerDay(n);
  if (n.tech.cur) {
    const p = n.tech.p || (n.tech.p = {});
    p[n.tech.cur] = (p[n.tech.cur] || 0) + n.rp;
    const tt = TECH_BY[n.tech.cur];
    if (p[tt.id] >= tt.cost) {
      n.tech.done[tt.id] = true; delete p[tt.id]; n.tech.cur = null;
      if (n.tag === G.player) addLog(`🔬 Ny teknologi: ${tt.name} (${tt.d}).`, 'good', true);
    }
  } else if (n.tag !== G.player) aiResearch(n);
}
function aiResearch(n) {
  const av = TECH.filter(t => techAvailable(n, t)).sort((a, b) => a.cost - b.cost);
  if (av.length) { n.tech.cur = av[Math.floor(rnd() * Math.min(3, av.length))].id; }
}

// ---------- Månedlig ----------
function econMonthly(n) {
  ensureEcon(n);
  n.growth = gdpGrowthYear(n);
  n.wage = clamp(Math.sqrt((n.gdpNow * 1000 / Math.max(0.05, n.popNow)) / 40000), 0.12, 1.6);
  // samfunnsverdier flyttes
  for (const k in n.push) if (n.push[k]) n.values[k] = clamp(n.values[k] + n.push[k] * 2, -100, 100);
  // statsbankerott
  const rt = ratingOf(n);
  const wasCrisis = n.crisis; n.crisis = rt.r === 'D';
  if (n.crisis && !wasCrisis) addLog(`💸 ${n.name} har gått statsbankerott!`, n.tag === G.player ? 'bad' : 'warn', n.tag === G.player);
  // kupp
  if (groupCrisis(n, 'mil') && rnd() < 0.05) {
    n.stab -= 20; n.values.gov = clamp(n.values.gov + 30, -100, 100); n.grpBonus.mil = 30;
    addLog(`🪖 Militærkupp i ${n.name}! Regimet blir mer autoritært.`, n.tag === G.player ? 'bad' : 'warn', true);
  }
  if (n.tag === G.player) {
    for (const g in GROUPS) if (groupCrisis(n, g) && rnd() < 0.5) addLog(`${GROUPS[g].icon} ${GROUPS[g].name} er i opprør – ${GROUP_CRISIS[g]}.`, 'bad', true);
  } else aiBudget(n);
}
function aiBudget(n) {
  const t = budgetTotals(n); const war = warsOf(n.tag).length > 0;
  const target = t.need * (war ? 1.3 : (G.tension > 65 || n.aggr > 0.3) ? 1.15 : 1.03) / t.gdp;
  n.budget.def = clamp(n.budget.def + clamp(target - n.budget.def, -0.003, 0.004), BUDGET.def.min, BUDGET.def.max);
  const bal = t.balance / t.gdp;
  if (bal < -0.005 && t.ratio > 0.6) {
    if (n.tax < 0.48 && n.grp.bus > 35) n.tax += 0.005;
    else { n.budget.wel = Math.max(BUDGET.wel.min, n.budget.wel - 0.003); n.budget.inf = Math.max(0.01, n.budget.inf - 0.002); }
  } else if (bal > 0.01 && t.ratio < 0.5) {
    if (n.grp.wrk < n.grp.bus) n.budget.wel = Math.min(0.18, n.budget.wel + 0.002); else n.tax = Math.max(0.12, n.tax - 0.004);
  }
  if (n.grp.sec < 35) n.budget.pol = Math.min(0.04, n.budget.pol + 0.001);
  if (n.grp.wrk < 30) n.budget.wel = Math.min(0.2, n.budget.wel + 0.003);
  // innrømmelser til misfornøyde grupper
  for (const g in n.grp) if (n.grp[g] < 30 && n.pp > 60) { n.pp -= 30; n.grpBonus[g] += 15; }
}
function concession(n, g) {
  if (n.pp < 30) return false;
  n.pp -= 30; n.grpBonus[g] = (n.grpBonus[g] || 0) + 15; return true;
}
