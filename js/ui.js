/* Foolhardy — interface. Reads state from the engine, redraws, and replays scoring events as pop-ups. */
(function () {
'use strict';
const FH = window.FH;
const $ = s => document.querySelector(s);
let g = null;
const UI = { sel: new Set(), busy: false, playing: null, focus: null, speed: 1, shown: { score: 0, money: 0 }, tips: {}, tipN: 0, modal: null, filter: { r: 0, q: '' }, drag: null };
window.FHUI = UI;

const SCALES = [0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.6, 1.8, 2, 2.25, 2.5];
/* With no saved choice, size the interface to the window: it was designed at 1440 by 900. */
const autoScale = () => (innerWidth <= 900 ? 1 : Math.max(1, Math.min(2.5, Math.round(Math.min(innerWidth / 1440, innerHeight / 900) * 20) / 20)));
const curScale = () => UI.scale || autoScale();
const applyScale = () => { document.documentElement.style.fontSize = 16 * curScale() + 'px'; };
const sizer = () => `<div class="sizer"><button data-act="smaller" aria-label="Make everything smaller">−</button><span>Size ${Math.round(curScale() * 100)}%</span><button data-act="bigger" aria-label="Make everything bigger">+</button></div>`;
function setScale(dir) {
  const cur = curScale();
  const next = dir > 0 ? SCALES.find(s => s > cur + 0.001) : [...SCALES].reverse().find(s => s < cur - 0.001);
  if (!next) return toast(dir > 0 ? 'That is the largest size' : 'That is the smallest size');
  UI.scale = next;
  try { localStorage.setItem('fh-scale', next); } catch (e) { /* storage unavailable */ }
  applyScale(); render();
}
const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
const cash = n => (n < 0 ? '−$' + -n : '$' + n);
const num = n => Math.round(n).toLocaleString('en-US');
const short = n => { n = Math.round(n * 100) / 100; return n >= 1e6 ? n.toExponential(2).replace('+', '') : n.toLocaleString('en-US'); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const RX = /(×[\d.]+(?: Mult)?)|([+−-]?[\d.]+ Mult\b|\bMult\b)|([+−-]?[\d.]+ Points?\b|\bPoints?\b)|(−?\$\d+)|\b(Hearts?|Diamonds?)\b|\b(Spades?|Clubs?)\b|(\d+ in \d+)/g;
const fmt = s => esc(s).replace(RX, (m, x, mu, p, gold, red, blk, odds) => `<b class="${x ? 't-x' : mu ? 't-m' : p ? 't-p' : gold ? 't-g' : red ? 't-red' : blk ? 't-blk' : 't-odds'}">${m}</b>`);
const tip = html => { const k = 't' + UI.tipN++; UI.tips[k] = html; return k; };

/* ---------- pieces ---------- */
const jokerTip = (def, s, extra) => `<div class="tp-head"><strong>${esc(def.name)}</strong><span class="rar r${def.rarity}">${FH.RARITY[def.rarity]}</span></div><p>${fmt(FH.descOf(def, s))}</p>${s && s.fin ? `<p class="tp-mod">${FH.FIN[s.fin].name}: ${fmt(FH.FIN[s.fin].desc)}</p>` : ''}${s && s.disabled ? '<p class="tp-warn">Silenced by the boss this hand</p>' : ''}<p class="tp-flavor">${esc(def.flavor)}</p>${extra || ''}`;
const jokerCard = (def, s, o = {}) => `<div class="jk r${def.rarity}${s && s.fin ? ' fin-' + s.fin : ''}${s && s.disabled ? ' off' : ''}${o.cls ? ' ' + o.cls : ''}"${s ? ` data-uid="${s.uid}"` : ''} data-tip="${tip(jokerTip(def, s, o.extra))}"${o.drag ? ' draggable="true" data-drag="joker"' : ''}${o.click ? ` data-act="${o.click}" data-id="${s.uid}"` : ''}><div class="jk-art">${FH.art(def)}</div><div class="jk-name">${esc(def.name)}</div></div>`;
const KIND_NAME = { decree: 'Decree', charm: 'Charm', rite: 'Rite' };
const handAt = (t, l) => { const H = FH.HANDS[t]; return `<b class="t-p">${H.pts + H.lp * (l - 1)}</b> × <b class="t-m">${H.mult + H.lm * (l - 1)}</b>`; };
const decreeLine = t => `<p class="tp-live">${FH.HANDS[t].name} is level ${g.levels[t]} now: ${handAt(t, g.levels[t])}. This makes it level ${g.levels[t] + 1}: ${handAt(t, g.levels[t] + 1)}.</p>`;
const consTip = (def, extra) => `<div class="tp-head"><strong>${esc(def.name)}</strong><span class="rar k-${def.kind}">${KIND_NAME[def.kind]}</span></div><p>${fmt(def.desc)}</p>${def.hand ? decreeLine(def.hand) : ''}<p class="tp-flavor">${esc(def.flavor)}</p>${extra || ''}`;
const consCard = (def, inst, o = {}) => `<div class="cn k-${def.kind}${o.cls ? ' ' + o.cls : ''}"${inst ? ` data-uid="${inst.uid}"` : ''} data-tip="${tip(consTip(def, o.extra))}"${o.click ? ` data-act="${o.click}" data-id="${inst.uid}"` : ''}><div class="cn-art">${FH.consArt(def)}</div><div class="cn-name">${esc(def.name)}</div></div>`;
const cardTip = k => {
  if (k.faceDown) return '<div class="tp-head"><strong>Face-down card</strong></div><p>You will find out what it is when you play or discard it.</p>';
  const base = k.enh === 'granite' ? 50 : FH.rankPts(k.rank);
  return `<div class="tp-head"><strong>${esc(FH.cardName(k))}</strong></div><p>${fmt(`+${base + k.bp} Points`)}${k.bm ? fmt(` and +${k.bm} Mult`) : ''} when scored</p>${k.enh ? `<p class="tp-mod">${FH.ENH[k.enh].name}: ${fmt(FH.ENH[k.enh].desc)}</p>` : ''}${k.stamp ? `<p class="tp-mod">${FH.STAMP[k.stamp].name}: ${fmt(FH.STAMP[k.stamp].desc)}</p>` : ''}${k.fin ? `<p class="tp-mod">${FH.FIN[k.fin].name}: ${fmt(FH.FIN[k.fin].desc)} when scored</p>` : ''}${k.debuffed ? '<p class="tp-warn">Debuffed by the boss: scores nothing and has no effects</p>' : ''}`;
};
const cardHTML = (k, o = {}) => {
  const base = `data-uid="${k.uid}" data-tip="${tip(cardTip(k))}"${k.faceDown || k.enh || k.stamp || k.fin || k.debuffed || k.bp || k.bm ? ' data-rich="1"' : ''}`;
  if (k.faceDown) return `<div class="pc down${UI.sel.has(k.uid) && o.hand ? ' sel' : ''}" ${base}></div>`;
  const su = FH.SUIT[k.suit], gr = k.enh === 'granite';
  const cls = ['pc', gr ? 'granite' : su.red ? 'red' : 'blk', k.enh ? 'enh-' + k.enh : '', k.fin ? 'fin-' + k.fin : '', k.debuffed ? 'debuffed' : '', UI.sel.has(k.uid) && o.hand ? 'sel' : '', o.dim ? 'dim' : '', o.small ? 'small' : ''].filter(Boolean).join(' ');
  const face = !gr && k.rank >= 11 && k.rank <= 13;
  return `<div class="${cls}" ${base}>${gr ? '<span class="cc">◆</span>' : `<span class="ci"><b>${FH.rankLabel(k.rank)}</b><i>${su.sym}</i></span><span class="cc${face ? ' face' : ''}">${face ? FH.rankLabel(k.rank) : su.sym}</span><span class="ci br"><b>${FH.rankLabel(k.rank)}</b><i>${su.sym}</i></span>`}${k.enh ? `<span class="eb">${FH.ENH[k.enh].name}</span>` : ''}${k.stamp ? `<span class="st st-${k.stamp}"></span>` : ''}</div>`;
};

/* ---------- regions ---------- */
function preview() {
  if (g.phase !== 'play' || UI.busy) return null;
  const cards = g.hand.filter(k => UI.sel.has(k.uid));
  if (!cards.length) return null;
  if (cards.some(k => k.faceDown)) return { name: 'Hidden hand', lvl: null, p: '?', m: '?' };
  const e = FH.evaluate(g, cards), H = FH.HANDS[e.type], lvl = FH.level(g, e.type);
  return { name: H.name, lvl, p: H.pts + H.lp * (lvl - 1), m: H.mult + H.lm * (lvl - 1) };
}
function sideHTML() {
  const boss = g.blindIdx === 2, inPlay = g.phase === 'play';
  let title, sub = '';
  if (inPlay) { title = boss ? g.boss.name : FH.BLINDS[g.blindIdx].name; sub = `Score at least <b>${num(g.target)}</b>`; }
  else if (g.phase === 'blind') { title = 'Choose a blind'; sub = `Ante ${g.ante}${g.ante <= 8 ? ' of 8' : ''}`; }
  else if (g.phase === 'shop') { title = 'The shop'; sub = 'Spend it or save it'; }
  else if (g.phase === 'cashout') { title = 'Blind beaten'; sub = esc(g.payout.name); }
  else { title = 'Curtain'; sub = 'The run is over'; }
  const pv = preview();
  const score = UI.busy ? UI.shown.score : g.score, money = UI.busy ? UI.shown.money : g.money;
  const pct = inPlay ? Math.min(100, (score / g.target) * 100) : 0;
  return `<h1 class="wordmark">Foolhardy</h1><button class="menu-btn" data-act="menu">Menu</button>
  <div class="bill${boss && inPlay ? ' bossbill' : ''}"><h2>${esc(title)}</h2><p class="bill-sub">${sub}</p>
    ${inPlay ? `<div class="meter"><i id="meterfill" style="width:${pct}%"></i></div><div class="rs"><span>Round score</span><b id="rs">${num(score)}</b></div>` : ''}</div>
  <div class="handbox"><div id="hname">${pv ? `${esc(pv.name)}${pv.lvl ? ` <small>level ${pv.lvl}</small>` : ''}` : '<span class="muted">No hand selected</span>'}</div>
    <div class="pm"><span id="pts" class="pts">${pv ? pv.p : 0}</span><i>×</i><span id="mult" class="mult">${pv ? pv.m : 0}</span></div></div>
  <dl class="stats"><div><dt>Hands</dt><dd class="c-p">${inPlay ? g.handsLeft : FH.maxHands(g)}</dd></div><div><dt>Discards</dt><dd class="c-m">${inPlay ? g.discardsLeft : FH.maxDiscards(g)}</dd></div>
    <div class="wide"><dt>Money</dt><dd class="c-g" id="money">${cash(money)}</dd></div>
    <div><dt>Ante</dt><dd>${g.ante}${g.ante <= 8 ? '<small> / 8</small>' : ''}</dd></div><div><dt>Round</dt><dd>${g.roundNum}</dd></div></dl>
  <nav class="menu"><button data-act="levels">Hand levels</button><button data-act="deck">Your deck</button><button data-act="collection">All 300 jokers</button><button data-act="speed">Speed ${UI.speed}×</button><button data-act="help">How to play</button><button data-act="new">New run</button>${sizer()}</nav>`;
}
function topHTML() {
  const js = g.jokers.map(s => {
    const f = UI.focus === s.uid;
    return `<div class="slot${f ? ' focus' : ''}">${jokerCard(s.def, s, { drag: true, click: 'focus' })}${f ? `<div class="acts"><button data-act="sellj" data-id="${s.uid}">Sell for ${cash(FH.sellValue(g, s))}</button>${g.jokers.length > 1 ? `<button data-act="movel" data-id="${s.uid}">Move left</button><button data-act="mover" data-id="${s.uid}">Move right</button>` : ''}</div>` : ''}</div>`;
  }).join('');
  const cs = g.cons.map(i => {
    const f = UI.focus === i.uid;
    return `<div class="slot${f ? ' focus' : ''}">${consCard(i.def, i, { click: 'focus' })}${f ? `<div class="acts"><button class="go" data-act="usec" data-id="${i.uid}">Use</button><button data-act="sellc" data-id="${i.uid}">Sell for ${cash(Math.max(1, Math.floor(i.def.cost / 2)))}</button></div>` : ''}</div>`;
  }).join('');
  return `<div class="shelf jokers"><div class="shelf-label">Jokers <b>${g.jokers.length}/${FH.jokerSlots(g)}</b></div><div class="row" id="jokers">${js || '<p class="empty">No jokers yet. Buy some in the shop after your first blind.</p>'}</div></div>
  <div class="shelf cons"><div class="shelf-label">Consumables <b>${g.cons.length}/${FH.consSlots(g)}</b></div><div class="row" id="cons">${cs || '<p class="empty">Empty</p>'}</div></div>`;
}
function stageBlind() {
  return `<div class="blinds">${[0, 1, 2].map(i => {
    const b = FH.BLINDS[i], boss = i === 2, state = i < g.blindIdx ? 'done' : i === g.blindIdx ? 'now' : 'next';
    const reward = boss && g.boss.noReward ? 0 : b.reward;
    return `<div class="blind ${state}${boss ? ' boss' : ''}"><p class="b-state">${state === 'done' ? 'Beaten' : state === 'now' ? 'Up now' : 'Still to come'}</p><div class="b-emoji">${boss ? g.boss.emoji : i ? '🎭' : '🎟'}</div><h3>${boss ? esc(g.boss.name) : b.name}</h3><p class="b-desc">${boss ? fmt(g.boss.desc) : 'No special rules.'}</p><p class="b-target">Score at least <b>${num(FH.targetFor(g, i))}</b></p><p class="b-reward">Pays <b class="t-g">${cash(reward)}</b> plus $1 per unused hand</p>${state === 'now' ? '<button class="btn go big" data-act="start">Play this blind</button>' : ''}</div>`;
  }).join('')}</div>`;
}
function stagePlay() {
  const boss = FH.bossOn(g) ? `<div class="bossbar"><span>${g.boss.emoji}</span><b>${esc(g.boss.name)}</b> ${fmt(g.boss.desc)}</div>` : g.blindIdx === 2 ? '<div class="bossbar quiet">The boss has no ability this time.</div>' : '';
  let mid;
  if (UI.playing) mid = `<div class="played">${UI.playing.map(k => cardHTML(k)).join('')}</div><div id="total" class="total"></div>`;
  else mid = `<p class="hint">${g.lastHand ? `Last hand: ${FH.HANDS[g.lastHand.type].name} for <b>${num(g.lastHand.total)}</b>` : `Score ${num(g.target)} to beat the ${g.blindIdx === 2 ? esc(g.boss.name) : FH.BLINDS[g.blindIdx].name}.`}</p>`;
  const peek = FH.flag(g, 'peek') && g.draw.length ? `<div class="peek"><span>Next from the deck</span>${g.draw.slice(-3).reverse().map(k => cardHTML(k, { small: true })).join('')}</div>` : '';
  return boss + mid + peek;
}
function stageCashout() {
  if (g.won && !g.endless) return `<div class="panel win"><div class="b-emoji">🏆</div><h2>You brought the house down</h2><p>All eight antes beaten. Best single hand: <b>${num(g.stats.best)}</b>.</p><div class="btnrow"><button class="btn go big" data-act="endless">Keep going in endless mode</button><button class="btn" data-act="new">Start a new run</button></div></div>`;
  const p = g.payout, total = p.lines.reduce((n, l) => n + l[1], 0);
  return `<div class="panel cashout"><h2>${esc(p.name)} beaten</h2><p class="muted">You scored ${num(p.score)} against a target of ${num(p.target)}.</p><table>${p.lines.map(l => `<tr><td>${esc(l[0])}</td><td class="t-g">${cash(l[1])}</td></tr>`).join('')}<tr class="sum"><td>Total</td><td class="t-g">${cash(total)}</td></tr></table><button class="btn go big" data-act="shop">Collect and go to the shop</button></div>`;
}
function stageShop() {
  const sh = g.shop;
  const item = it => {
    const p = FH.price(g, it), can = FH.canAfford(g, p);
    const price = `<div class="price${can ? '' : ' no'}">${p === 0 ? 'Free' : cash(p)}</div>`;
    if (it.kind === 'joker') return `<div class="item">${jokerCard(it.def, { fin: it.fin, v: it.def.v || {}, uid: it.uid })}${price}<button class="btn" data-act="buy" data-id="${it.uid}"${can ? '' : ' disabled'}>Buy</button></div>`;
    const instant = !it.def.need && !it.def.inRound;
    return `<div class="item">${consCard(it.def, { uid: it.uid })}${price}<button class="btn" data-act="buy" data-id="${it.uid}"${can ? '' : ' disabled'}>Buy</button>${instant ? `<button class="btn ghost" data-act="buyuse" data-id="${it.uid}"${can ? '' : ' disabled'}>Buy and use</button>` : ''}</div>`;
  };
  const rc = FH.rerollCost(g);
  return `<div class="shop"><div class="shop-row"><h3>Jokers for hire</h3><div class="row">${sh.jokers.map(item).join('') || '<p class="empty">Sold out. Reroll for more.</p>'}</div></div>
  <div class="shop-row"><h3>Decrees, Charms and Rites</h3><div class="row">${sh.cons.map(item).join('') || '<p class="empty">Sold out. Reroll for more.</p>'}</div></div>
  <div class="btnrow"><button class="btn" data-act="reroll"${FH.canAfford(g, rc) ? '' : ' disabled'}>Reroll the shop (${rc === 0 ? 'free' : cash(rc)})</button><button class="btn go big" data-act="leave">Go to the next blind</button></div></div>`;
}
function stageOver() {
  const s = g.stats;
  return `<div class="panel over"><div class="b-emoji">🥀</div><h2>The curtain falls</h2><p>You needed ${num(g.target)} and reached ${num(g.score)} on ${g.blindIdx === 2 ? esc(g.boss.name) : FH.BLINDS[g.blindIdx].name}, ante ${g.ante}.</p><table><tr><td>Blinds beaten</td><td>${s.blinds}</td></tr><tr><td>Hands played</td><td>${s.hands}</td></tr><tr><td>Best single hand</td><td>${num(s.best)}</td></tr></table><button class="btn go big" data-act="new">Start a new run</button></div>`;
}
function bottomHTML() {
  if (g.phase !== 'play') return '';
  const n = g.hand.filter(k => UI.sel.has(k.uid)).length;
  const canD = FH.canDiscard(g) && !UI.busy;
  return `<div class="hpv" id="hpv">${hpvHTML()}</div>
  <div class="hand" id="hand">${g.hand.map(k => `<div class="hc" data-hc="${k.uid}">${cardHTML(k, { hand: true })}</div>`).join('')}</div>
  <div class="controls"><button class="btn go big" data-act="play"${n && !UI.busy ? '' : ' disabled'}>Play hand</button><button class="btn rose big" data-act="discard"${n && canD ? '' : ' disabled'}>Discard</button>
  <span class="sorts">Sort by <button class="link${g.sortMode === 'rank' ? ' on' : ''}" data-act="sort" data-id="rank">rank</button> <button class="link${g.sortMode === 'suit' ? ' on' : ''}" data-act="sort" data-id="suit">suit</button></span>
  <button class="deckpile" data-act="deck" title="See your deck"><b>${g.draw.length}</b><span>of ${g.deck.length} left</span></button></div>`;
}
function render() {
  if (!UI.modal) { UI.tips = {}; UI.tipN = 0; }
  hideTip();
  $('#side').innerHTML = sideHTML();
  $('#top').innerHTML = topHTML();
  const st = g.phase === 'blind' ? stageBlind() : g.phase === 'play' ? stagePlay() : g.phase === 'cashout' ? stageCashout() : g.phase === 'shop' ? stageShop() : stageOver();
  const stage = $('#stage'); stage.className = 'stage ph-' + g.phase; stage.innerHTML = st;
  $('#bottom').innerHTML = bottomHTML();
  fitHand();
  if ($('#hand')) refreshSelection();
  if (UI.modal) openModal(UI.modal, true);
}
/* The line just above the hand: what the selected cards make, what they would score, or how to select. */
function hpvHTML() {
  const pv = preview();
  if (!pv) return '<span class="muted">Select up to 5 cards. Press and sweep across cards to select several.</span>';
  const n = g.hand.filter(k => UI.sel.has(k.uid)).length, fc = UI.fc;
  let sc = '';
  if (fc && fc.error) sc = `<span class="hpv-err">${esc(fc.error)}</span>`;
  else if (fc && fc.totals) {
    const lo = Math.min(...fc.totals), hi = Math.max(...fc.totals);
    sc = `<span class="hpv-sc${g.score + lo >= g.target ? ' win' : ''}" title="${g.score + lo >= g.target ? 'This hand beats the blind' : ''}">scores <b>${lo === hi ? num(lo) : `${num(lo)} to ${num(hi)}`}</b></span>`;
  }
  return `<b class="hpv-name">${esc(pv.name)}</b>${pv.lvl ? `<small>level ${pv.lvl}</small>` : ''}<span class="hpv-pm"><b class="t-p">${pv.p}</b> × <b class="t-m">${pv.m}</b></span>${sc}<span class="hpv-n">${n} of 5</span><button class="link" data-act="clear">Clear</button>`;
}

/* ---------- live contributions ----------
   The selected hand is scored on a copy of the game twice: once with every chance succeeding and once with every chance
   failing, so luck-based effects show as a range. Every Points, Mult, ×Mult and $ effect is credited to the joker or card
   that caused it, and each joker's worth is also measured by scoring the hand again without it. */
const LUCK = [0, 0.999999];
const blankFx = () => ({ p: 0, m: 0, x: 1, $: 0, rc: 0, rj: 0, set: null });
function forecast() {
  if (g.phase !== 'play' || UI.busy || g.pending) return null;
  const chosen = g.hand.filter(k => UI.sel.has(k.uid));
  if (!chosen.length) return { none: true };
  if (chosen.some(k => k.faceDown)) return { hidden: true };
  const uids = chosen.map(k => k.uid);
  try {
    const runs = LUCK.map(l => FH.simulate(g, uids, l));
    if (runs[0].error) return { error: runs[0].error };
    const per = new Map();
    runs.forEach((r, i) => r.ev.forEach(e => {
      if (!e.src) return;
      if (!per.has(e.src)) per.set(e.src, [blankFx(), blankFx()]);
      const b = per.get(e.src)[i];
      if (e.kind === 'pts') b.p += e.val;
      else if (e.kind === 'mult') b.m += e.val;
      else if (e.kind === 'x') b.x *= e.val;
      else if (e.kind === 'money') b.$ += e.val;
      else if (e.kind === 're') { if (e.joker) b.rj += e.val; else b.rc += e.val; }
      else if (e.set) b.set = e.set.to;
    }));
    const without = new Map(g.jokers.map(s => [s.uid, LUCK.map(l => FH.simulate(g, uids, l, s.uid).total)]));
    return { per, totals: runs.map(r => r.total), without, scoring: new Set(runs[0].ev.find(e => e.kind === 'start').scoring) };
  } catch (err) {
    console.warn('Preview failed', err);
    return null;
  }
}
const r2 = n => Math.round(n * 100) / 100;
/* Each effect as [long text, short badge text, colour class], with a range when luck changes it. */
function fxParts(a) {
  const out = [], [A, B] = a;
  /* t: kind of effect; n: how one value reads; unit: added once after a value or range; brief: badge text for one value */
  const rng = (t, u, v, n, unit, brief, cls, idle) => {
    if (u === idle && v === idle) return;
    const lo = Math.min(u, v), hi = Math.max(u, v), un = typeof unit === 'function' ? unit(hi) : unit;
    out.push({ t, lo, hi, cls, long: lo === hi ? n(lo) + un : `${n(lo)} to ${n(hi)}${un}`, brief: lo === hi ? brief(lo) : `${brief(lo)}–${brief(hi).replace(/^[+×$−]+/, '')}` });
  };
  const signed = x => (x < 0 ? '−' : '+') + short(Math.abs(x));
  rng('add', A.p, B.p, signed, ' Points', signed, 't-p', 0);
  rng('add', A.m, B.m, signed, ' Mult', signed, 't-m', 0);
  rng('x', r2(A.x), r2(B.x), x => '×' + x, ' Mult', x => '×' + x, 't-x', 1);
  rng('money', A.$, B.$, x => (x < 0 ? '−$' : '+$') + Math.abs(x), '', x => (x < 0 ? '−$' : '$') + Math.abs(x), 't-g', 0);
  rng('re', A.rc, B.rc, x => String(x), x => ` extra card trigger${x === 1 ? '' : 's'}`, x => '↻' + x, 't-re', 0);
  rng('nb', A.rj, B.rj, x => String(x), x => ` neighbour${x === 1 ? '' : 's'}`, x => '↻' + x, 't-re', 0);
  const sets = [A.set, B.set].filter(Boolean).sort((x, y) => x[0] * x[1] - y[0] * y[1]);
  if (sets.length) {
    const [s0, s1] = [sets[0], sets[sets.length - 1]], same = s0[0] === s1[0] && s0[1] === s1[1], one = s => `${short(s[0])} × ${short(s[1])}`;
    out.push({ t: 'set', cls: 't-re', long: same ? one(s0) : `${one(s0)} to ${one(s1)}`, brief: same ? `=${compact(s0[0])}×${compact(s0[1])}` : `=${compact(s0[0])}–${compact(s1[0])}` });
  }
  return out;
}
const rangeText = arr => { const lo = Math.min(...arr), hi = Math.max(...arr); return lo === hi ? num(lo) : `${num(lo)} to ${num(hi)}`; };
const compact = n => { const a = Math.abs(n); return (a >= 1e6 ? r2(a / 1e6) + 'M' : a >= 1e4 ? Math.round(a / 1e3) + 'k' : a >= 1e3 ? Math.round(a / 100) / 10 + 'k' : String(Math.round(a))); };
const hl = p => `<b class="${p.cls}">${p.long}</b>`;
const andList = xs => (xs.length < 2 ? xs.join('') : xs.slice(0, -1).join(', ') + ' and ' + xs[xs.length - 1]);
/* Turn a joker's effects into plain sentences. */
function fxSentences(parts) {
  const s = [], of = t => parts.filter(p => p.t === t);
  if (of('add').length) s.push(`Adds ${andList(of('add').map(hl))}`);
  of('x').forEach(p => s.push(`Multiplies Mult by <b class="t-x">${p.lo === p.hi ? '×' + p.lo : `×${p.lo} to ×${p.hi}`}</b>`));
  of('money').forEach(p => { const amt = (x, y) => (x === y ? '$' + Math.abs(x) : `$${Math.abs(x)} to $${Math.abs(y)}`); s.push(p.hi <= 0 ? `Costs <b class="t-g">${amt(p.hi, p.lo)}</b>` : p.lo >= 0 ? `Earns <b class="t-g">${amt(p.lo, p.hi)}</b>` : `Changes your money by <b class="t-g">${p.long}</b>`); });
  of('re').forEach(p => s.push(`Gives <b class="t-re">${p.long}</b>`));
  of('nb').forEach(p => s.push(`Makes <b class="t-re">${p.long}</b> trigger again`));
  of('set').forEach(p => s.push(`Sets Points and Mult to <b class="t-re">${p.long}</b>`));
  return s.map(x => x + '.').join(' ');
}
function jokerLive(uid) {
  const fc = UI.fc;
  if (!fc || fc.none) return '<p class="tp-live muted">Select cards to see what this adds to that hand.</p>';
  if (fc.hidden || fc.error || !fc.per) return '';
  const parts = fc.per.has(uid) ? fxParts(fc.per.get(uid)) : [];
  const wo = fc.without.get(uid) || fc.totals;
  const changed = wo.some((w, i) => w !== fc.totals[i]);
  const sent = fxSentences(parts);
  const what = parts.length ? 'In this hand it ' + sent.charAt(0).toLowerCase() + sent.slice(1) : 'Adds nothing directly to this hand.';
  const worth = changed ? ` The hand scores <b>${rangeText(fc.totals)}</b> with it and <b>${rangeText(wo)}</b> without it.` : parts.length ? '' : ' Removing it would not change the score.';
  return `<p class="tp-live">${what}${worth}</p>`;
}
function jokerBadge(uid) {
  const fc = UI.fc;
  if (!fc || !fc.per) return '';
  const parts = fc.per.has(uid) ? fxParts(fc.per.get(uid)) : [];
  if (parts.length) return parts.slice(0, 3).map(p => `<b class="${p.cls}">${p.brief}</b>`).join('');
  const wo = fc.without.get(uid);
  if (!wo) return '';
  const d = fc.totals.map((t, i) => t - wo[i]), lo = Math.min(...d), hi = Math.max(...d);
  if (!lo && !hi) return '';
  const sg = x => (x < 0 ? '−' : '+') + compact(x);
  return `<b class="t-sc" title="Change to the hand's score">${lo === hi ? sg(lo) + ' score' : `${sg(lo)}–${compact(hi)}`}</b>`;
}
function cardLive(uid) {
  const fc = UI.fc;
  if (!fc || !fc.per) return '';
  const parts = fc.per.has(uid) ? fxParts(fc.per.get(uid)) : [];
  const selected = UI.sel.has(uid);
  if (selected && !fc.scoring.has(uid) && !parts.length) return '<p class="tp-live">Won’t score in this hand.</p>';
  if (!parts.length) return '';
  return `<p class="tp-live">${selected ? 'In this hand' : 'Held in your hand'}: ${andList(parts.map(hl))}.</p>`;
}
function liveTip(el) {
  if (g.phase !== 'play' || UI.busy || !el.dataset.uid) return '';
  const uid = Number(el.dataset.uid);
  if (el.closest('#jokers') && g.jokers.some(s => s.uid === uid)) return jokerLive(uid);
  if (el.closest('#hand')) return cardLive(uid);
  return '';
}
function paintBadges() {
  document.querySelectorAll('#jokers .jk').forEach(el => {
    const html = jokerBadge(Number(el.dataset.uid));
    let b = el.querySelector('.jfc');
    if (!html) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.className = 'jfc'; el.querySelector('.jk-art').appendChild(b); }
    b.innerHTML = html;
  });
}
function fitHand() {
  const h = $('#hand');
  if (!h || h.children.length < 2) return;
  const n = h.children.length, cw = h.children[0].offsetWidth, room = h.parentElement.clientWidth;
  const gap = parseFloat(getComputedStyle(document.documentElement).fontSize) / 2;
  h.style.setProperty('--ov', (n * cw + (n - 1) * gap > room ? Math.floor((room - n * cw) / (n - 1)) : gap) + 'px');
}
function refreshSelection() {
  UI.fc = forecast();
  const cards = g.hand.filter(k => UI.sel.has(k.uid));
  const scoring = UI.fc && UI.fc.scoring ? UI.fc.scoring : cards.length && !UI.busy && !cards.some(k => k.faceDown) ? new Set(FH.evaluate(g, cards).scoring.map(k => k.uid)) : null;
  paintBadges();
  if (UI.tipEl && UI.tipEl.isConnected && $('#tip').classList.contains('show')) showTip(UI.tipEl);
  document.querySelectorAll('#hand .pc').forEach(el => {
    const u = Number(el.dataset.uid), s = UI.sel.has(u);
    el.classList.toggle('sel', s);
    el.classList.toggle('ns', s && !!scoring && !scoring.has(u));
  });
  const hpv = $('#hpv'); if (hpv) hpv.innerHTML = hpvHTML();
  const pv = preview();
  $('#hname').innerHTML = pv ? `${esc(pv.name)}${pv.lvl ? ` <small>level ${pv.lvl}</small>` : ''}` : '<span class="muted">No hand selected</span>';
  $('#pts').textContent = pv ? pv.p : 0; $('#mult').textContent = pv ? pv.m : 0;
  const n = UI.sel.size;
  const pb = $('[data-act="play"]'), db = $('[data-act="discard"]');
  if (pb) pb.disabled = !n || UI.busy;
  if (db) db.disabled = !n || UI.busy || !FH.canDiscard(g);
}

/* ---------- pop-ups and replay ---------- */
function pop(el, text, cls) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  const p = document.createElement('div');
  p.className = 'pop ' + cls; p.textContent = text;
  p.style.left = r.left + r.width / 2 + 'px'; p.style.top = r.top + 'px';
  document.body.appendChild(p);
  el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump');
  setTimeout(() => p.remove(), 900);
}
function toast(text) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = text;
  $('#toasts').appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
const setTick = (sel, text) => { const el = $(sel); if (!el || el.textContent === text) return; el.textContent = text; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick'); };
const evText = e => (e.kind === 'pts' ? [(e.val > 0 ? '+' : '') + short(e.val), 'p-pts'] : e.kind === 'mult' ? [(e.val > 0 ? '+' : '') + short(e.val) + ' Mult', 'p-mult'] : e.kind === 'x' ? ['×' + short(e.val), 'p-x'] : e.kind === 'money' ? [(e.val > 0 ? '+' : '−') + '$' + Math.abs(e.val), 'p-gold'] : [String(e.val), 'p-msg']);
async function replay(evs) {
  const beats = evs.filter(e => e.src && e.kind !== 're').length;
  const beat = Math.max(55, Math.min(300, 4800 / Math.max(1, beats))) / UI.speed;
  for (const e of evs) {
    if (e.kind === 'start') {
      $('#hname').innerHTML = `${esc(FH.HANDS[e.type].name)} <small>level ${e.lvl}</small>`;
      setTick('#pts', short(e.p)); setTick('#mult', short(e.m));
      e.scoring.forEach(u => { const el = $(`.played [data-uid="${u}"]`); if (el) el.classList.add('scoring'); });
      await sleep(beat * 1.6); continue;
    }
    if (e.kind === 'total') {
      setTick('#pts', short(e.p)); setTick('#mult', short(e.m));
      const t = $('#total'); if (t) { t.textContent = num(e.val); t.classList.add('show'); }
      await sleep(420 / UI.speed);
      UI.shown.score = e.score; UI.shown.money = e.money;
      setTick('#rs', num(e.score)); setTick('#money', cash(e.money));
      const mf = $('#meterfill'); if (mf) mf.style.width = Math.min(100, (e.score / g.target) * 100) + '%';
      await sleep(520 / UI.speed); continue;
    }
    if (e.kind === 'sync') { UI.shown.money = e.money; setTick('#money', cash(e.money)); continue; }
    if (e.kind === 're') continue;
    const [text, cls] = evText(e);
    const el = e.src ? $(`[data-uid="${e.src}"]`) : null;
    if (el) pop(el, text, cls); else if (e.kind === 'msg') toast(text);
    if (UI.busy) { setTick('#pts', short(e.p)); setTick('#mult', short(e.m)); }
    if (e.money != null) { UI.shown.money = e.money; setTick('#money', cash(e.money)); }
    if (el) await sleep(beat);
  }
}
function flash(res) {
  if (!res || !res.ev) return;
  for (const e of res.ev) {
    if (!['pts', 'mult', 'x', 'money', 'msg'].includes(e.kind)) continue;
    const [text, cls] = evText(e);
    const el = e.src ? $(`[data-uid="${e.src}"]`) : null;
    if (el) pop(el, text, cls); else if (e.kind === 'msg') toast(text); else if (e.kind === 'money') pop($('#money'), text, cls);
  }
}
const act = res => { if (res && res.error) { toast(res.error); return false; } render(); flash(res); return true; };

/* ---------- actions ---------- */
async function doPlay() {
  if (UI.busy || g.phase !== 'play') return;
  const cards = g.hand.filter(k => UI.sel.has(k.uid));
  if (!cards.length) return;
  UI.shown = { score: g.score, money: g.money };
  const res = FH.play(g, cards);
  if (res.error) return toast(res.error);
  UI.busy = true; UI.sel.clear(); UI.playing = res.played; UI.focus = null;
  render();
  await replay(res.ev);
  UI.playing = null; UI.busy = false;
  const end = FH.resolvePlay(g);
  render(); flash(end);
}
function doDiscard() {
  if (UI.busy || !FH.canDiscard(g)) return;
  const cards = g.hand.filter(k => UI.sel.has(k.uid));
  if (!cards.length) return;
  UI.sel.clear();
  act(FH.discard(g, cards));
}
const find = (arr, id) => arr.find(x => x.uid === Number(id));
/* Select or deselect one hand card. A sixth card shakes instead of being selected. Returns whether the selection changed. */
function setCard(uid, want) {
  if (want === UI.sel.has(uid)) return false;
  if (want && g.hand.filter(k => UI.sel.has(k.uid)).length >= 5) {
    const el = $(`#hand [data-uid="${uid}"]`);
    if (el) { el.classList.remove('nope'); void el.offsetWidth; el.classList.add('nope'); }
    return false;
  }
  if (want) UI.sel.add(uid); else UI.sel.delete(uid);
  return true;
}
function clearSelection() {
  if (UI.busy || !UI.sel.size) return;
  UI.sel.clear();
  refreshSelection();
}
function moveJoker(id, d) {
  if (UI.busy) return;
  const i = g.jokers.findIndex(x => x.uid === Number(id)), j = i + d;
  if (i < 0 || j < 0 || j >= g.jokers.length) return;
  [g.jokers[i], g.jokers[j]] = [g.jokers[j], g.jokers[i]];
  render();
}
const ACTIONS = {
  start: () => { UI.sel.clear(); UI.focus = null; act(FH.startBlind(g)); },
  card: id => { if (UI.busy || g.phase !== 'play') return; id = Number(id); setCard(id, !UI.sel.has(id)); refreshSelection(); },
  clear: () => clearSelection(),
  play: doPlay, discard: doDiscard,
  sort: id => { g.sortMode = id; FH.sortHand(g); render(); },
  focus: id => { UI.focus = UI.focus === Number(id) ? null : Number(id); render(); const el = UI.focus && $(`#top [data-uid="${UI.focus}"]`); if (el) showTip(el); },
  movel: id => moveJoker(id, -1), mover: id => moveJoker(id, 1),
  menu: () => openModal('menu'),
  sellj: id => { if (UI.busy) return; const s = find(g.jokers, id); if (s) { UI.focus = null; act(FH.sellJoker(g, s)); } },
  sellc: id => { const i = find(g.cons, id); if (i) { UI.focus = null; act(FH.sellCons(g, i)); } },
  usec: id => { if (UI.busy) return; const i = find(g.cons, id); if (!i) return; const sel = g.hand.filter(k => UI.sel.has(k.uid)); const res = FH.useCons(g, i, sel); if (res.error) return toast(res.error); UI.focus = null; UI.sel.forEach(u => { if (!g.hand.some(k => k.uid === u)) UI.sel.delete(u); }); act(res); },
  shop: () => act(FH.enterShop(g)),
  buy: id => { const it = find([...g.shop.jokers, ...g.shop.cons], id); if (it) act(FH.buy(g, it, false)); },
  buyuse: id => { const it = find(g.shop.cons, id); if (it) act(FH.buy(g, it, true)); },
  reroll: () => act(FH.reroll(g)),
  leave: () => { UI.focus = null; act(FH.leaveShop(g)); },
  endless: () => { g.endless = true; g.won = false; act(FH.enterShop(g)); },
  new: () => { if (g.phase !== 'over' && g.roundNum > 0 && !(g.won && !g.endless) && !confirm('Abandon this run and start a new one?')) return; closeModal(); newRun(); },
  speed: () => { UI.speed = UI.speed === 1 ? 2 : UI.speed === 2 ? 4 : 1; try { localStorage.setItem('fh-speed', UI.speed); } catch (e) { /* storage unavailable */ } render(); },
  bigger: () => setScale(1), smaller: () => setScale(-1),
  levels: () => openModal('levels'), deck: () => openModal('deck'), collection: () => openModal('collection'), help: () => openModal('help'),
  close: () => closeModal(),
  rar: id => { UI.filter.r = Number(id); openModal('collection', true); },
};

/* ---------- modals ---------- */
const MODALS = {
  menu: () => `<h2>Menu</h2><div class="menu-list"><button data-act="levels">Hand levels</button><button data-act="deck">Your deck</button><button data-act="collection">All 300 jokers</button><button data-act="speed">Speed ${UI.speed}×</button><button data-act="help">How to play</button><button data-act="new">New run</button>${sizer()}</div>`,
  levels: () => `<h2>Hand levels</h2><p class="muted">Decrees raise a hand type’s level. Each level adds to its starting Points and Mult.</p><table class="levels"><tr><th>Hand</th><th>Level</th><th>Starts at</th><th>Played</th></tr>${[...FH.HAND_IDS].reverse().filter(t => !FH.HANDS[t].secret || g.typeCounts[t] > 0).map(t => { const H = FH.HANDS[t], l = g.levels[t]; return `<tr><td>${H.name}</td><td>${l}</td><td><b class="t-p">${H.pts + H.lp * (l - 1)}</b> × <b class="t-m">${H.mult + H.lm * (l - 1)}</b></td><td>${g.typeCounts[t]}</td></tr>`; }).join('')}</table>`,
  deck: () => {
    const live = g.phase === 'play';
    const rows = FH.SUITS.map(s => { const cs = g.deck.filter(k => k.enh !== 'granite' && k.suit === s).sort((a, b) => b.rank - a.rank); return `<div class="deckrow"><span class="t-${FH.SUIT[s].red ? 'red' : 'blk'}">${FH.SUIT[s].sym} ${cs.length}</span>${cs.map(k => cardHTML(Object.assign({}, k, { faceDown: false }), { small: true, dim: live && !g.draw.includes(k) })).join('')}</div>`; }).join('');
    const stone = g.deck.filter(k => k.enh === 'granite');
    return `<h2>Your deck</h2><p class="muted">${g.deck.length} cards${live ? `. ${g.draw.length} still in the draw pile; faded cards have already been drawn` : ''}.</p>${rows}${stone.length ? `<div class="deckrow"><span>◆ ${stone.length}</span>${stone.map(k => cardHTML(k, { small: true, dim: live && !g.draw.includes(k) })).join('')}</div>` : ''}`;
  },
  collection: () => {
    const f = UI.filter, q = f.q.toLowerCase();
    const list = FH.JLIST.filter(d => (!f.r || d.rarity === f.r) && (!q || d.name.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q)));
    return `<h2>All 300 jokers</h2><div class="filters"><input id="jq" type="search" placeholder="Search by name or effect" value="${esc(f.q)}" aria-label="Search jokers">${[0, 1, 2, 3, 4].map(r => `<button class="chip${f.r === r ? ' on' : ''}" data-act="rar" data-id="${r}">${r ? FH.RARITY[r] : 'All'}</button>`).join('')}<span class="muted">${list.length} shown</span></div><div class="grid">${list.map(d => jokerCard(d, null, { cls: g.jokers.some(s => s.id === d.id) ? 'owned' : '' })).join('') || '<p class="empty">No joker matches that search.</p>'}</div>`;
  },
  help: () => `<h2>How to play</h2><div class="help">
    <p>Each <b>blind</b> sets a score to beat. Pick up to 5 cards and play them as a poker hand. A hand scores its <b class="t-p">Points</b> multiplied by its <b class="t-m">Mult</b>, and you have a limited number of hands and discards to reach the target.</p>
    <p>There are 8 <b>antes</b>, each with a Small, a Medium and a Boss blind. Bosses bend the rules against you. Beat the ante 8 boss to win.</p>
    <p>After every blind you visit the shop. <b>Jokers</b> sit above the table and change how hands score. Their order matters: they act from left to right, so put jokers that add Mult before jokers that multiply it. Drag them to reorder, or tap one and use Move left and Move right.</p>
    <p><b>Decrees</b> raise the level of a hand type. <b>Charms</b> change cards you have selected in your hand: enhancements, stamps, finishes, suit and rank. <b>Rites</b> reshape your deck by destroying, adding or converting cards. Click a consumable you own to use or sell it.</p>
    <p>You earn $1 of interest for every $5 you hold at the end of a round, up to $5, so saving pays.</p>
    <p><b>Choosing cards:</b> click or tap a card to select it, or press on one and sweep across others to select several at once. To move a card in your hand, hold it for a moment (or drag it upward) and slide it into place. Right-click the hand, press Esc, or use Clear to deselect everything.</p>
    <p><b>Previews:</b> once you select cards, each joker shows what it adds to that hand, and the line above your hand shows what it would score. Hover over or tap a joker or card for the details, including what the hand would score without that joker. Effects that depend on luck show a range.</p>
    <p class="muted">Hover over or tap anything to see what it does. Use the − and + next to Size in the menu to make everything bigger or smaller. Keys: 1 to 9 select cards, Enter plays, Backspace discards, Esc clears your selection.</p></div>`,
};
function openModal(name, keep) {
  UI.modal = name;
  const m = $('#modal');
  const scroll = keep && m.querySelector('.modal-body') ? m.querySelector('.modal-body').scrollTop : 0;
  m.innerHTML = `<div class="modal-box m-${name}" role="dialog" aria-modal="true"><button class="x" data-act="close" aria-label="Close">×</button><div class="modal-body">${MODALS[name]()}</div></div>`;
  m.classList.add('open');
  m.querySelector('.modal-body').scrollTop = scroll;
  const jq = $('#jq');
  if (jq) {
    if (keep && UI.typing) { jq.focus(); jq.setSelectionRange(jq.value.length, jq.value.length); }
    jq.addEventListener('input', () => { UI.filter.q = jq.value; UI.typing = true; openModal('collection', true); UI.typing = false; });
  }
}
function closeModal() { UI.modal = null; const m = $('#modal'); m.classList.remove('open'); m.innerHTML = ''; hideTip(); }

/* ---------- tooltips ---------- */
const TOUCH = window.matchMedia && window.matchMedia('(hover: none)').matches;
function showTip(el) {
  let html = UI.tips[el.dataset.tip];
  if (!html) return;
  html += liveTip(el);
  UI.tipEl = el;
  if (TOUCH && el.closest('#hand') && !el.dataset.rich) return hideTip();
  if (press && (press.swept || press.lifted)) return;
  const t = $('#tip'); t.innerHTML = html; t.classList.add('show');
  const r = el.getBoundingClientRect(), w = t.offsetWidth, h = t.offsetHeight;
  let x = r.left + r.width / 2 - w / 2, y = r.top - h - 10;
  if (y < 8) y = r.bottom + 10;
  if (y + h > innerHeight - 8) y = Math.max(8, innerHeight - h - 8);
  t.style.left = Math.max(8, Math.min(innerWidth - w - 8, x)) + 'px'; t.style.top = y + 'px';
}
function hideTip() { const t = $('#tip'); if (t) t.classList.remove('show'); }

/* ---------- events ---------- */
document.addEventListener('click', e => {
  const m = $('#modal');
  if (e.target === m) return closeModal();
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el.dataset.id);
});
document.addEventListener('mouseover', e => { const el = e.target.closest('[data-tip]'); if (el) showTip(el); });
document.addEventListener('mouseout', e => { const el = e.target.closest('[data-tip]'); if (el && !el.contains(e.relatedTarget)) hideTip(); });
document.addEventListener('focusin', e => { const el = e.target.closest && e.target.closest('[data-tip]'); if (el) showTip(el); });
document.addEventListener('touchstart', e => { if (!e.target.closest('[data-tip]')) hideTip(); }, { passive: true });

/* ---------- hand cards: press to select, sweep to select several, hold (or drag upward) to move ---------- */
let press = null;
const HOLD_MS = { mouse: 380, pen: 380, touch: 340 };
const slotAt = (x, y) => { const el = document.elementFromPoint(x, y); return el && el.closest('#hand .hc'); };
document.addEventListener('pointerdown', e => {
  const slot = e.target.closest && e.target.closest('#hand .hc');
  if (!slot || e.button !== 0 || UI.busy || UI.modal || g.phase !== 'play' || press) return;
  const uid = Number(slot.dataset.hc), want = !UI.sel.has(uid);
  press = { id: e.pointerId, type: e.pointerType || 'mouse', uid, want, slot, x: e.clientX, y: e.clientY, touched: new Set([uid]), swept: false, lifted: false };
  press.changed = setCard(uid, want);
  press.timer = setTimeout(() => liftCard(), HOLD_MS[press.type] || 380);
  refreshSelection();
});
document.addEventListener('pointermove', e => {
  if (!press || e.pointerId !== press.id) return;
  if (press.lifted) return dragTo(e.clientX, e.clientY);
  const dx = e.clientX - press.x, dy = e.clientY - press.y;
  if (Math.hypot(dx, dy) > (press.type === 'touch' ? 10 : 6)) clearTimeout(press.timer);
  if (!press.swept && press.type !== 'touch' && -dy > 24 && Math.abs(dx) < -dy) return liftCard(e.clientX, e.clientY);
  const s = slotAt(e.clientX, e.clientY);
  if (!s) return;
  const u = Number(s.dataset.hc);
  if (press.touched.has(u)) return;
  press.touched.add(u);
  if (!press.swept) { press.swept = true; hideTip(); }
  setCard(u, press.want);
  refreshSelection();
});
function liftCard(x, y) {
  const p = press;
  if (!p || p.lifted || p.swept || !p.slot.isConnected) return;
  clearTimeout(p.timer);
  /* The player meant to move this card, not select it, so undo the press. */
  if (p.changed) { if (p.want) UI.sel.delete(p.uid); else UI.sel.add(p.uid); refreshSelection(); }
  hideTip();
  p.slots = [...document.querySelectorAll('#hand .hc')];
  p.from = p.to = p.slots.indexOf(p.slot);
  p.lefts = p.slots.map(s => s.getBoundingClientRect().left);
  p.step = p.slots.length > 1 ? p.lefts[1] - p.lefts[0] : 1;
  p.lifted = true;
  p.slot.classList.add('lifted');
  $('#hand').classList.add('moving');
  if (navigator.vibrate && p.type === 'touch') try { navigator.vibrate(12); } catch (err) { /* not allowed */ }
  if (x != null) dragTo(x, y);
}
function dragTo(x, y) {
  const p = press, dx = x - p.x, dy = Math.max(-80, Math.min(16, y - p.y));
  p.slot.style.transform = `translate(${dx}px, ${dy}px)`;
  const to = Math.max(0, Math.min(p.slots.length - 1, Math.round((p.lefts[p.from] + dx - p.lefts[0]) / p.step)));
  if (to === p.to) return;
  p.to = to;
  p.slots.forEach((s, i) => {
    if (i === p.from) return;
    const shift = p.from < to && i > p.from && i <= to ? -p.step : p.from > to && i >= to && i < p.from ? p.step : 0;
    s.style.transform = shift ? `translateX(${shift}px)` : '';
  });
}
function endPress(e, cancelled) {
  const p = press;
  if (!p || (e && e.pointerId !== p.id)) return;
  press = null;
  clearTimeout(p.timer);
  if (p.lifted) {
    if (!cancelled && p.to !== p.from && g.hand[p.from] && g.hand[p.from].uid === p.uid) {
      g.hand.splice(p.to, 0, g.hand.splice(p.from, 1)[0]);
      g.sortMode = null;
    }
    render();
    return;
  }
  /* A touch that turned into a page scroll should not leave the card selected. */
  if (cancelled && !p.swept && p.changed) { if (p.want) UI.sel.delete(p.uid); else UI.sel.add(p.uid); refreshSelection(); }
}
document.addEventListener('pointerup', e => endPress(e, false));
document.addEventListener('pointercancel', e => endPress(e, true));
window.addEventListener('blur', () => endPress(null, true));
/* Right-click on the hand clears the selection. A long touch also raises this event, so ignore it mid-press. */
document.addEventListener('contextmenu', e => {
  if (!e.target.closest('#bottom')) return;
  e.preventDefault();
  if (!press) clearSelection();
});
window.addEventListener('resize', () => { if (!UI.scale) applyScale(); fitHand(); });
document.addEventListener('dragstart', e => {
  const el = e.target.closest('[data-drag]');
  if (!el || UI.busy) return e.preventDefault();
  UI.drag = { kind: el.dataset.drag, uid: Number(el.dataset.uid) };
  e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(UI.drag.uid));
  hideTip();
});
document.addEventListener('dragover', e => { const el = e.target.closest('[data-drag]'); if (el && UI.drag && el.dataset.drag === UI.drag.kind) e.preventDefault(); });
document.addEventListener('drop', e => {
  const el = e.target.closest('[data-drag]');
  if (!el || !UI.drag || el.dataset.drag !== UI.drag.kind) return;
  e.preventDefault();
  const arr = UI.drag.kind === 'joker' ? g.jokers : g.hand;
  const from = arr.findIndex(x => x.uid === UI.drag.uid), to = arr.findIndex(x => x.uid === Number(el.dataset.uid));
  UI.drag = null;
  if (from < 0 || to < 0 || from === to) return;
  arr.splice(to, 0, arr.splice(from, 1)[0]);
  if (arr === g.hand) g.sortMode = null;
  render();
});
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'Escape') { if (UI.modal) closeModal(); else if (UI.focus) { UI.focus = null; render(); } else clearSelection(); return; }
  if (UI.modal || g.phase !== 'play') return;
  if (e.key >= '1' && e.key <= '9') { const k = g.hand[Number(e.key) - 1]; if (k) ACTIONS.card(k.uid); }
  else if (e.key === 'Enter') { e.preventDefault(); doPlay(); }
  else if (e.key === 'Backspace') { e.preventDefault(); doDiscard(); }
});

function newRun(seed) {
  g = FH.newGame(seed);
  window.FHGAME = g;
  UI.sel.clear(); UI.focus = null; UI.busy = false; UI.playing = null;
  render();
}
window.addEventListener('DOMContentLoaded', () => {
  try { UI.speed = Number(localStorage.getItem('fh-speed')) || 1; UI.scale = Number(localStorage.getItem('fh-scale')) || 0; } catch (e) { /* storage unavailable */ }
  applyScale();
  const seed = new URLSearchParams(location.search).get('seed');
  newRun(seed ? Number(seed) : undefined);
  let seen = false;
  try { seen = localStorage.getItem('fh-seen') === '1'; localStorage.setItem('fh-seen', '1'); } catch (e) { /* storage unavailable */ }
  if (!seen) openModal('help');
});
window.FHRENDER = () => render();
})();
