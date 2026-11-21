/* Foolhardy — rules engine. No DOM access in this file, so it also runs under Node for tests. */
(function () {
'use strict';
const FH = globalThis.FH = globalThis.FH || {};

/* ---------- basics ---------- */
FH.SUITS = ['S', 'H', 'D', 'C'];
FH.SUIT = {
  S: { name: 'Spades', sym: '♠', red: false },
  H: { name: 'Hearts', sym: '♥', red: true },
  D: { name: 'Diamonds', sym: '♦', red: true },
  C: { name: 'Clubs', sym: '♣', red: false },
};
FH.rankLabel = r => ({ 11: 'J', 12: 'Q', 13: 'K', 14: 'A' }[r] || String(r));
FH.rankName = r => ({ 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' }[r] || String(r));
FH.rankPts = r => (r === 14 ? 11 : r > 10 ? 10 : r);
FH.cardName = k => (k.enh === 'granite' ? 'Granite card' : `${FH.rankName(k.rank)} of ${FH.SUIT[k.suit].name}`);

FH.HANDS = {
  high: { name: 'High Card', pts: 6, mult: 1, lp: 8, lm: 1 },
  pair: { name: 'Pair', pts: 12, mult: 2, lp: 12, lm: 1 },
  twopair: { name: 'Two Pair', pts: 24, mult: 2, lp: 18, lm: 1 },
  three: { name: 'Three of a Kind', pts: 32, mult: 3, lp: 18, lm: 2 },
  straight: { name: 'Straight', pts: 34, mult: 4, lp: 28, lm: 2 },
  flush: { name: 'Flush', pts: 38, mult: 4, lp: 16, lm: 2 },
  full: { name: 'Full House', pts: 44, mult: 4, lp: 24, lm: 2 },
  four: { name: 'Four of a Kind', pts: 64, mult: 7, lp: 28, lm: 3 },
  sflush: { name: 'Straight Flush', pts: 110, mult: 8, lp: 40, lm: 4 },
  five: { name: 'Five of a Kind', pts: 125, mult: 12, lp: 34, lm: 3, secret: true },
  fhouse: { name: 'Flush House', pts: 145, mult: 13, lp: 38, lm: 4, secret: true },
  ffive: { name: 'Flush Five', pts: 170, mult: 15, lp: 48, lm: 3, secret: true },
};
FH.HAND_IDS = Object.keys(FH.HANDS);

FH.ENH = {
  heavy: { name: 'Heavy', desc: '+30 Points when scored' },
  keen: { name: 'Keen', desc: '+4 Mult when scored' },
  prism: { name: 'Prism', desc: 'Counts as every suit' },
  brittle: { name: 'Brittle', desc: '×2 Mult when scored. 1 in 4 chance to shatter afterwards' },
  iron: { name: 'Iron', desc: '×1.5 Mult while it stays in your hand' },
  gilt: { name: 'Gilt', desc: 'Earn $3 if it is in your hand at end of round' },
  charmed: { name: 'Charmed', desc: '1 in 5 chance of +20 Mult and 1 in 15 chance of $20 when scored' },
  granite: { name: 'Granite', desc: '+50 Points. Has no rank or suit and always scores' },
};
FH.STAMP = {
  crimson: { name: 'Crimson Stamp', desc: 'This card triggers one extra time' },
  azure: { name: 'Azure Stamp', desc: 'If in your hand at end of round, creates the Decree for the last hand you played' },
  gold: { name: 'Gold Stamp', desc: 'Earn $3 when scored' },
  violet: { name: 'Violet Stamp', desc: 'Creates a Charm when discarded' },
};
FH.FIN = {
  sheen: { name: 'Sheen', desc: '+50 Points' },
  lustre: { name: 'Lustre', desc: '+10 Mult' },
  opal: { name: 'Opal', desc: '×1.5 Mult' },
  hollow: { name: 'Hollow', desc: '+1 Joker slot' },
};
FH.RARITY = ['', 'Common', 'Uncommon', 'Rare', 'Legendary'];

let UID = 1;
FH.uid = () => UID++;
FH.hash = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
FH.mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
FH.pick = (g, arr) => arr[Math.floor(g.rng() * arr.length)];
FH.shuffle = (g, arr) => { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(g.rng() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; };
FH.sample = (g, arr, n) => FH.shuffle(g, [...arr]).slice(0, n);
FH.slug = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

FH.makeCard = (rank, suit, extra) => Object.assign({ uid: FH.uid(), rank, suit, enh: null, stamp: null, fin: null, bp: 0, bm: 0, debuffed: false, faceDown: false }, extra);
FH.cloneCard = k => Object.assign({}, k, { uid: FH.uid(), debuffed: false, faceDown: false });
FH.randomCard = (g, extra) => FH.makeCard(2 + Math.floor(g.rng() * 13), FH.pick(g, FH.SUITS), extra);

/* ---------- registries ---------- */
/* Definitions are shared and never copied when the game state is cloned for a preview. */
FH.KEEP = new WeakSet();
FH.JOKERS = {}; FH.JLIST = [];
const COST = [0, 4, 6, 8, 20];
FH.J = (name, rarity, emoji, desc, flavor, def) => {
  const id = FH.slug(name);
  if (FH.JOKERS[id]) throw new Error('Duplicate joker: ' + id);
  const d = Object.assign({ id, name, rarity, emoji, desc, flavor, cost: COST[rarity] + (rarity === 4 ? 0 : FH.hash(id) % 3) }, def);
  FH.JOKERS[id] = d; FH.JLIST.push(d); FH.KEEP.add(d);
  return d;
};
FH.CONS = {}; FH.CLIST = [];
FH.C = (kind, name, emoji, desc, flavor, def) => {
  const id = FH.slug(name);
  if (FH.CONS[id]) throw new Error('Duplicate consumable: ' + id);
  const d = Object.assign({ id, kind, name, emoji, desc, flavor, cost: kind === 'rite' ? 4 : 3 }, def);
  FH.CONS[id] = d; FH.CLIST.push(d); FH.KEEP.add(d);
  return d;
};
FH.BOSSES = {}; FH.BOSSLIST = [];
FH.B = (name, emoji, desc, def) => {
  const d = Object.assign({ id: FH.slug(name), name, emoji, desc }, def);
  FH.BOSSES[d.id] = d; FH.BOSSLIST.push(d); FH.KEEP.add(d);
  return d;
};

const fmtNum = n => (typeof n === 'number' ? String(Math.round(n * 100) / 100) : String(n));
FH.descOf = (def, s) => def.desc.replace(/#(\w+)#/g, (_, k) => fmtNum(((s && s.v) || def.v || {})[k]));

/* ---------- joker instances, flags and modifiers ---------- */
FH.makeJoker = (id, fin) => {
  const def = FH.JOKERS[id];
  return { uid: FH.uid(), id, def, v: def.v ? JSON.parse(JSON.stringify(def.v)) : {}, fin: fin || null, sellBonus: 0, rounds: 0, disabled: false, paid: def.cost };
};
FH.flag = (g, f) => g.jokers.some(s => !s.disabled && s.def.flags && s.def.flags.includes(f));
FH.bossOn = g => g.phase === 'play' && g.blindIdx === 2 && !g.bossOff && !FH.flag(g, 'noBoss');
const modsOf = (g, s) => (typeof s.def.mods === 'function' ? s.def.mods(g, s) : s.def.mods) || {};
FH.mod = (g, key) => {
  let n = 0;
  for (const s of g.jokers) if (!s.disabled) n += modsOf(g, s)[key] || 0;
  if (FH.bossOn(g) && g.boss.mods) n += g.boss.mods[key] || 0;
  return n;
};
FH.handSize = g => Math.max(1, 8 + FH.mod(g, 'handSize') + ((g.round && g.round.extraSize) || 0));
FH.maxHands = g => Math.max(1, 4 + FH.mod(g, 'hands'));
FH.maxDiscards = g => Math.max(0, 3 + FH.mod(g, 'discards'));
FH.jokerSlots = g => Math.max(1, 5 + FH.mod(g, 'jokerSlots') + g.jokers.filter(s => s.fin === 'hollow').length);
FH.consSlots = g => Math.max(1, 2 + FH.mod(g, 'consSlots'));
FH.canAddJoker = (g, def, fin) => {
  const own = (typeof def.mods === 'object' && def.mods && def.mods.jokerSlots) || 0;
  return g.jokers.length < FH.jokerSlots(g) + own + (fin === 'hollow' ? 1 : 0);
};
FH.sellValue = (g, s) => (FH.flag(g, 'fullSell') ? Math.max(1, s.paid) : Math.max(1, Math.floor(s.def.cost / 2))) + s.sellBonus;
FH.resolve = (g, s, depth = 0) => {
  if (!s.def.copy) return s;
  if (depth > 6) return null;
  const t = s.def.copy(g, s);
  if (!t || t === s || !t.def) return null;
  return FH.resolve(g, t, depth + 1);
};
FH.fire = (g, hook, c, ...a) => {
  const pc = c.cur, pk = c.curKind;
  for (const s of [...g.jokers]) {
    if (s.disabled || !g.jokers.includes(s)) continue;
    const t = FH.resolve(g, s);
    if (!t || !t.def[hook]) continue;
    c.cur = s; c.curKind = 'joker';
    t.def[hook](c, t, ...a);
  }
  c.cur = pc; c.curKind = pk;
};
FH.sum = (g, hook, c, ...a) => {
  let n = 0;
  for (const s of [...g.jokers]) {
    if (s.disabled) continue;
    const t = FH.resolve(g, s);
    if (!t || !t.def[hook]) continue;
    const v = Number(t.def[hook](c, t, ...a)) || 0;
    n += v;
    /* Record who caused each retrigger, so a preview can credit the joker. The replay ignores these. */
    if (v > 0 && hook.startsWith('retrigger')) c.ev.push({ src: s.uid, srcKind: 'joker', kind: 're', val: v });
  }
  return n;
};
FH.any = (g, hook, c, ...a) => {
  for (const s of [...g.jokers]) {
    if (s.disabled || !g.jokers.includes(s)) continue;
    const t = FH.resolve(g, s);
    if (t && t.def[hook]) { c.cur = s; c.curKind = 'joker'; if (t.def[hook](c, t, ...a)) return true; }
  }
  return false;
};
FH.chance = (g, n, d) => FH.flag(g, 'luckAll') || g.rng() < (n / d) * (FH.flag(g, 'luck2') ? 2 : 1);
FH.addMoney = (g, n) => {
  if (n < 0) g.money = Math.max(g.money + n, Math.min(g.money, -FH.mod(g, 'debt')));
  else g.money += n;
};

/* ---------- card predicates ---------- */
FH.isSuit = (g, k, suit) => {
  if (k.enh === 'granite') return false;
  if (k.enh === 'prism') return true;
  if (k.rank === 8 && FH.flag(g, 'crazy8')) return true;
  if (FH.flag(g, 'colorblind')) return FH.SUIT[k.suit].red === FH.SUIT[suit].red;
  return k.suit === suit;
};
FH.isFace = (g, k) => {
  if (k.enh === 'granite') return false;
  if (FH.flag(g, 'allFace')) return true;
  return (k.rank >= 11 && k.rank <= 13) || (k.rank === 10 && FH.flag(g, 'tenFace'));
};
FH.suitCounts = g => { const n = { S: 0, H: 0, D: 0, C: 0 }; g.deck.forEach(k => { if (k.enh !== 'granite') n[k.suit]++; }); return n; };
FH.mostPlayed = g => { let best = null, n = 0; for (const t of FH.HAND_IDS) if (g.typeCounts[t] >= n && g.typeCounts[t] > 0) { best = t; n = g.typeCounts[t]; } return best; };
FH.level = (g, type) => {
  if (FH.bossOn(g) && g.boss.id === 'the_censor') return 1;
  return g.levels[type] + (FH.flag(g, 'fav2') && FH.mostPlayed(g) === type ? 2 : 0);
};

/* ---------- hand evaluation ---------- */
FH.evaluate = (g, cards) => {
  const F = f => FH.flag(g, f);
  const real = cards.filter(k => k.enh !== 'granite');
  const need = F('four') ? 4 : 5;
  const six9 = F('sixNine');
  const key = k => (six9 && k.rank === 9 ? 6 : k.rank);
  const groups = {};
  real.forEach(k => (groups[key(k)] = groups[key(k)] || []).push(k));
  const gl = Object.values(groups).sort((a, b) => b.length - a.length || key(b[0]) - key(a[0]));
  let flush = null;
  for (const s of FH.SUITS) {
    const m = real.filter(k => FH.isSuit(g, k, s));
    if (m.length >= need && (!flush || m.length > flush.length)) flush = m;
  }
  let straight = null;
  {
    const vals = new Set();
    real.forEach(k => { vals.add(k.rank); if (k.rank === 14) vals.add(1); if (F('wrap') && k.rank <= 5) vals.add(k.rank + 13); });
    const gap = F('gap');
    let best = null;
    for (const v of vals) {
      const chain = [v]; let cur = v;
      for (;;) { if (vals.has(cur + 1)) cur += 1; else if (gap && vals.has(cur + 2)) cur += 2; else break; chain.push(cur); }
      const ranks = new Set(chain.map(x => (x === 1 ? 14 : x > 14 ? x - 13 : x)));
      if (ranks.size >= need && (!best || ranks.size > best.size.size || (ranks.size === best.size.size && cur > best.top))) best = { size: ranks, top: cur };
    }
    if (best) straight = real.filter(k => best.size.has(k.rank));
  }
  const n1 = gl[0] ? gl[0].length : 0, n2 = gl[1] ? gl[1].length : 0;
  const has = new Set(['high']);
  if (n1 >= 2) has.add('pair');
  if (n1 >= 2 && n2 >= 2) has.add('twopair');
  if (n1 >= 3) has.add('three');
  if (n1 >= 4) has.add('four');
  if (n1 >= 5) has.add('five');
  if (n1 >= 3 && n2 >= 2) has.add('full');
  if (straight) has.add('straight');
  if (flush) has.add('flush');
  const allFlush = flush && real.length === 5 && flush.length === 5;
  let type, sc;
  if (n1 >= 5 && allFlush) { type = 'ffive'; sc = real; }
  else if (n1 >= 3 && n2 >= 2 && allFlush) { type = 'fhouse'; sc = real; }
  else if (n1 >= 5) { type = 'five'; sc = gl[0]; }
  else if (straight && flush) { type = 'sflush'; sc = real.filter(k => straight.includes(k) || flush.includes(k)); }
  else if (n1 >= 4) { type = 'four'; sc = gl[0].slice(0, 4); }
  else if (n1 >= 3 && n2 >= 2) { type = 'full'; sc = gl[0].concat(gl[1].slice(0, 2)); }
  else if (flush) { type = 'flush'; sc = flush; }
  else if (straight) { type = 'straight'; sc = straight; }
  else if (n1 >= 3) { type = 'three'; sc = gl[0]; }
  else if (n1 >= 2 && n2 >= 2) { type = 'twopair'; sc = gl[0].concat(gl[1]); }
  else if (n1 >= 2) { type = 'pair'; sc = gl[0]; }
  else { type = 'high'; sc = real.length ? [real.reduce((a, b) => (b.rank > a.rank ? b : a))] : []; }
  has.add(type);
  const scoring = F('allScore') ? [...cards] : cards.filter(k => sc.includes(k) || k.enh === 'granite');
  return { type, scoring, has };
};

/* ---------- effect context ---------- */
class Ctx {
  constructor(g) { this.g = g; this.p = 0; this.m = 0; this.ev = []; this.cur = null; this.curKind = null; this.xcount = 0; this.lines = null; this.played = []; this.scoring = []; this.held = g.hand; }
  _e(kind, val) { this.ev.push({ src: this.cur ? this.cur.uid : null, srcKind: this.curKind, kind, val, p: this.p, m: this.m, money: this.g.money }); }
  pts(n) { if (!n) return; this.p += n; this._e('pts', n); }
  mult(n) { if (!n) return; this.m += n; this._e('mult', n); }
  x(n) { if (n == null || n === 1) return; this.m *= n; this.xcount++; this._e('x', n); }
  setPM(p, m, label) { const from = [this.p, this.m]; this.p = p; this.m = m; this._e('msg', label); this.ev[this.ev.length - 1].set = { from, to: [p, m] }; }
  money(n) {
    if (!n) return;
    FH.addMoney(this.g, n);
    if (this.lines) this.lines.push([this.cur && this.cur.def ? this.cur.def.name : 'Bonus', n]);
    this._e('money', n);
  }
  msg(t) { this._e('msg', t); }
  chance(n, d) { return FH.chance(this.g, n, d); }
  has(t) { return !!this.hasSet && this.hasSet.has(t); }
  level(type, n = 1) {
    this.g.levels[type] = Math.max(1, this.g.levels[type] + n);
    this._e('msg', `${FH.HANDS[type].name} → level ${this.g.levels[type]}`);
    if (n > 0) FH.fire(this.g, 'leveled', this, type);
  }
  create(kind, id) { return FH.createCons(this.g, kind, id, this); }
  destroy(card) { FH.destroyCard(this.g, card, this, false); }
  add(card, where) { FH.addCard(this.g, card, where, this); }
  kill(s, text) { this._e('msg', text || 'Gone!'); FH.removeJoker(this.g, s); }
}
FH.Ctx = Ctx;

/* ---------- deck and consumable changes ---------- */
FH.destroyCard = (g, card, c, shattered) => {
  if (!g.deck.includes(card)) return;
  for (const pile of ['deck', 'hand', 'draw', 'pile']) g[pile] = g[pile].filter(k => k !== card);
  if (c && c.held && c.held !== g.hand && c.held.includes && c.held.includes(card)) c.held = g.hand;
  g.stats.destroyed++;
  if (g.round) g.round.destroyed = (g.round.destroyed || 0) + 1;
  FH.fire(g, 'cardDestroyed', c || new Ctx(g), card, !!shattered);
};
FH.addCard = (g, card, where, c) => {
  g.deck.push(card);
  if (g.phase === 'play') {
    if (where === 'hand') g.hand.push(card);
    else g.draw.splice(Math.floor(g.rng() * (g.draw.length + 1)), 0, card);
  }
  g.stats.added++;
  FH.fire(g, 'cardAdded', c || new Ctx(g), card);
  FH.refreshDebuffs(g);
};
FH.createCons = (g, kind, id, c) => {
  if (g.cons.length >= FH.consSlots(g)) return null;
  let def = id ? FH.CONS[id] : null;
  if (!def) def = FH.pick(g, FH.consPool(g, kind));
  if (!def) return null;
  const inst = { uid: FH.uid(), def };
  g.cons.push(inst);
  if (c) c._e('msg', '+' + def.name);
  return inst;
};
FH.consPool = (g, kind) => FH.CLIST.filter(d => d.kind === kind && (!d.hand || !FH.HANDS[d.hand].secret || g.typeCounts[d.hand] > 0));
FH.removeJoker = (g, s) => { g.jokers = g.jokers.filter(x => x !== s); };
FH.addJoker = (g, id, fin, c) => {
  const def = FH.JOKERS[id];
  if (!def || !FH.canAddJoker(g, def, fin)) return null;
  const s = FH.makeJoker(id, fin);
  g.jokers.push(s);
  const cc = c || new Ctx(g);
  if (def.roll) def.roll(cc, s);
  if (def.acquired) def.acquired(cc, s);
  return s;
};
FH.refreshDebuffs = g => {
  const b = FH.bossOn(g) && !FH.flag(g, 'immune') ? g.boss : null;
  g.deck.forEach(k => { k.debuffed = !!(b && b.debuff && b.debuff(k, g)); });
};
FH.sortHand = g => {
  const so = { S: 0, H: 1, C: 2, D: 3 };
  const rk = k => (k.enh === 'granite' ? 0 : k.rank);
  if (g.sortMode === 'rank') g.hand.sort((a, b) => rk(b) - rk(a) || so[a.suit] - so[b.suit]);
  else if (g.sortMode === 'suit') g.hand.sort((a, b) => so[a.suit] - so[b.suit] || rk(b) - rk(a));
};
FH.drawHand = (g, extra = 0) => {
  const size = FH.handSize(g) + extra;
  const b = FH.bossOn(g) ? g.boss : null;
  while (g.hand.length < size && g.draw.length) {
    const k = g.draw.pop();
    k.faceDown = !!(b && b.faceDown && b.faceDown(g, k));
    g.hand.push(k);
  }
  FH.refreshDebuffs(g);
  FH.sortHand(g);
};

/* ---------- run setup ---------- */
FH.BLINDS = [
  { name: 'Small Blind', mult: 1, reward: 3 },
  { name: 'Medium Blind', mult: 1.5, reward: 4 },
  { name: 'Boss Blind', mult: 2, reward: 6 },
];
const ANTE_BASE = [0, 300, 800, 2200, 5200, 11000, 21000, 36000, 56000];
FH.anteBase = a => (a <= 8 ? ANTE_BASE[a] : Math.round((56000 * Math.pow(1.6, a - 8)) / 1000) * 1000);
FH.targetFor = (g, idx) => {
  let m = FH.BLINDS[idx].mult;
  if (idx === 2 && g.boss.targetMult && !g.bossOff && !FH.flag(g, 'noBoss')) m = g.boss.targetMult;
  return Math.max(1, Math.round(FH.anteBase(g.ante) * m * (1 + FH.mod(g, 'targetPct') / 100)));
};
FH.pickBoss = g => {
  const fin = g.ante % 8 === 0;
  let pool = FH.BOSSLIST.filter(b => !!b.finale === fin && (b.min || 1) <= g.ante && !g.usedBosses.includes(b.id));
  if (!pool.length) { g.usedBosses = []; pool = FH.BOSSLIST.filter(b => !!b.finale === fin); }
  const b = FH.pick(g, pool);
  g.usedBosses.push(b.id);
  return b;
};
FH.newGame = seed => {
  seed = (seed == null ? Math.floor(Math.random() * 2 ** 31) : seed) >>> 0;
  const g = {
    seed, rng: FH.mulberry(seed), ante: 1, blindIdx: 0, phase: 'blind', money: 4,
    deck: [], draw: [], hand: [], pile: [], jokers: [], cons: [], levels: {}, typeCounts: {},
    handsLeft: 0, discardsLeft: 0, score: 0, target: 0, boss: null, bossOff: false, usedBosses: [],
    round: { hands: 0, discards: 0, types: [], lastType: null, discarded: 0, extraSize: 0, flags: {}, destroyed: 0 },
    roundNum: 0, sortMode: 'rank', shop: null, payout: null, won: false, endless: false, lastHand: null,
    stats: { hands: 0, discards: 0, cardsDiscarded: 0, rerolls: 0, bought: 0, sold: 0, consUsed: 0, destroyed: 0, added: 0, bosses: 0, blinds: 0, best: 0 },
  };
  for (const s of FH.SUITS) for (let r = 2; r <= 14; r++) g.deck.push(FH.makeCard(r, s));
  for (const t of FH.HAND_IDS) { g.levels[t] = 1; g.typeCounts[t] = 0; }
  g.boss = FH.pickBoss(g);
  return g;
};

/* ---------- a round ---------- */
FH.startBlind = g => {
  g.phase = 'play'; g.roundNum++; g.bossOff = false;
  g.round = { hands: 0, discards: 0, types: [], lastType: null, discarded: 0, extraSize: 0, flags: {}, destroyed: 0 };
  g.score = 0; g.lastHand = null;
  g.jokers.forEach(s => { s.disabled = false; });
  g.target = FH.targetFor(g, g.blindIdx);
  g.deck.forEach(k => { k.debuffed = false; k.faceDown = false; });
  g.draw = FH.shuffle(g, [...g.deck]); g.hand = []; g.pile = [];
  const c = new Ctx(g);
  for (const s of [...g.jokers]) if (s.def.roll && g.jokers.includes(s)) { c.cur = s; c.curKind = 'joker'; s.def.roll(c, s); }
  c.cur = null;
  FH.fire(g, 'roundStart', c);
  if (FH.bossOn(g) && g.boss.onStart) g.boss.onStart(g, c);
  g.target = FH.targetFor(g, g.blindIdx);
  g.handsLeft = FH.maxHands(g); g.discardsLeft = FH.maxDiscards(g);
  FH.drawHand(g);
  FH.fire(g, 'firstDraw', c);
  FH.refreshDebuffs(g); FH.sortHand(g);
  return { ev: c.ev };
};

FH.scoreCard = (g, c, card) => {
  const me = () => { c.cur = card; c.curKind = 'card'; };
  me();
  c.pts((card.enh === 'granite' ? 50 : FH.rankPts(card.rank)) + card.bp);
  if (card.enh === 'heavy') c.pts(30);
  if (card.enh === 'keen') c.mult(FH.flag(g, 'keen2') ? 8 : 4);
  if (card.bm) c.mult(card.bm);
  if (card.enh === 'brittle') c.x(2);
  if (card.enh === 'charmed') {
    if (c.chance(1, 5)) { c.mult(20); FH.fire(g, 'lucky', c, card); }
    me();
    if (c.chance(1, 15)) { c.money(20); FH.fire(g, 'lucky', c, card); }
    me();
  }
  if (card.fin === 'sheen') c.pts(50);
  if (card.fin === 'lustre') c.mult(10);
  if (card.fin === 'opal') c.x(1.5);
  if (card.stamp === 'gold') c.money(3);
  FH.fire(g, 'onScore', c, card);
};

FH.canDiscard = g => g.phase === 'play' && !g.pending && (g.discardsLeft > 0 || (g.round.discards === 0 && FH.flag(g, 'freeFirst')));

FH.play = (g, cards) => {
  if (g.phase !== 'play' || g.pending || !cards.length || cards.length > 5 || g.handsLeft <= 0) return { error: 'You cannot play that' };
  cards = g.hand.filter(k => cards.includes(k));
  const boss = FH.bossOn(g) ? g.boss : null;
  if (boss && boss.validate) { const err = boss.validate(g, cards); if (err) return { error: err }; }
  const c = new Ctx(g);
  cards.forEach(k => { k.faceDown = false; });
  g.hand = g.hand.filter(k => !cards.includes(k));
  const ev = FH.evaluate(g, cards);
  Object.assign(c, { played: cards, scoring: ev.scoring, type: ev.type, hasSet: ev.has, held: g.hand });
  c.first = g.round.hands === 0;
  g.handsLeft--; c.last = g.handsLeft === 0;
  c.prevType = g.round.lastType;
  c.repeat = g.round.types.includes(ev.type);
  g.typeCounts[ev.type]++; g.stats.hands++;
  const lvl = FH.level(g, ev.type), H = FH.HANDS[ev.type];
  c.lvl = lvl; c.p = H.pts + H.lp * (lvl - 1); c.m = H.mult + H.lm * (lvl - 1);
  c.ev.push({ kind: 'start', type: ev.type, lvl, p: c.p, m: c.m, money: g.money, scoring: ev.scoring.map(k => k.uid) });
  if (boss && boss.onPlay) boss.onPlay(g, c);
  FH.fire(g, 'before', c);
  for (const card of [...c.scoring]) {
    if (card.debuffed) { c.cur = card; c.curKind = 'card'; c.msg('Debuffed'); continue; }
    const reps = 1 + (card.stamp === 'crimson' ? 1 : 0) + FH.sum(g, 'retrigger', c, card);
    for (let i = 0; i < reps; i++) {
      if (i > 0) { c.cur = card; c.curKind = 'card'; c.msg('Again!'); }
      FH.scoreCard(g, c, card);
    }
  }
  for (const card of [...g.hand]) {
    if (card.debuffed) continue;
    const reps = 1 + (card.stamp === 'crimson' ? 1 : 0) + FH.sum(g, 'retriggerHeld', c, card);
    for (let i = 0; i < reps; i++) {
      c.cur = card; c.curKind = 'card';
      if (card.enh === 'iron') c.x(1.5);
      FH.fire(g, 'onHeld', c, card);
    }
  }
  const row = [...g.jokers];
  for (const s of row) {
    if (s.disabled || !g.jokers.includes(s)) continue;
    c.cur = s; c.curKind = 'joker';
    if (s.fin === 'sheen') c.pts(50);
    if (s.fin === 'lustre') c.mult(10);
    const t = FH.resolve(g, s);
    if (t && t.def.main) {
      const i = g.jokers.indexOf(s);
      const wingmen = [g.jokers[i - 1], g.jokers[i + 1]].filter(w => w && !w.disabled && w.def.wing);
      const wings = wingmen.length;
      wingmen.forEach(w => c.ev.push({ src: w.uid, srcKind: 'joker', kind: 're', val: 1, joker: true }));
      for (let r = 0; r <= wings; r++) { c.cur = s; c.curKind = 'joker'; t.def.main(c, t); }
    }
    c.cur = s; c.curKind = 'joker';
    if (s.fin === 'opal') c.x(1.5);
  }
  c.cur = null; c.curKind = null;
  FH.fire(g, 'final', c);
  c.total = c.nulled ? 0 : Math.floor(c.p * c.m);
  FH.fire(g, 'scored', c);
  c.total = Math.max(0, Math.floor(c.total)) || 0;
  g.score += c.total;
  g.stats.best = Math.max(g.stats.best, c.total);
  c.ev.push({ kind: 'total', val: c.total, score: g.score, p: c.p, m: c.m, money: g.money });
  g.round.hands++; g.round.types.push(ev.type); g.round.lastType = ev.type;
  for (const card of [...c.scoring]) {
    if (card.enh === 'brittle' && !card.debuffed && !FH.flag(g, 'noShatter') && FH.chance(g, 1, 4)) {
      c.cur = card; c.curKind = 'card'; c.msg('Shattered!');
      FH.destroyCard(g, card, c, true);
    }
  }
  c.cur = null;
  FH.fire(g, 'after', c);
  cards.forEach(k => { if (g.deck.includes(k) && !g.hand.includes(k) && !g.draw.includes(k)) g.pile.push(k); });
  if (boss && FH.bossOn(g) && boss.afterPlay) boss.afterPlay(g, c);
  g.lastHand = { type: ev.type, total: c.total };
  if (g.score >= g.target) g.pending = 'win';
  else if (g.handsLeft <= 0) g.pending = FH.any(g, 'rescue', c) ? 'win' : 'lose';
  else g.pending = 'draw';
  if (c.ev.length && c.ev[c.ev.length - 1].kind !== 'total') c.ev.push({ kind: 'sync', money: g.money });
  return { ev: c.ev, total: c.total, type: ev.type, played: cards, outcome: g.pending };
};
/* ---------- previews ---------- */
/* Deep-copy the game so a hand can be scored without touching the real run. Definitions are shared, functions are kept as they are. */
FH.cloneGame = g => {
  const seen = new Map();
  const cp = v => {
    if (v === null || typeof v !== 'object' || FH.KEEP.has(v)) return v;
    if (seen.has(v)) return seen.get(v);
    if (v instanceof Set) { const o = new Set(); seen.set(v, o); v.forEach(x => o.add(cp(x))); return o; }
    if (v instanceof Map) { const o = new Map(); seen.set(v, o); v.forEach((x, k) => o.set(k, cp(x))); return o; }
    const o = Array.isArray(v) ? [] : Object.create(Object.getPrototypeOf(v));
    seen.set(v, o);
    for (const k of Object.keys(v)) o[k] = cp(v[k]);
    return o;
  };
  return cp(g);
};
/* Score the given hand cards on a copy of the game. luck is what every random roll returns:
   0 makes every listed chance succeed, just under 1 makes every one fail. without removes a joker first. */
FH.simulate = (g, uids, luck, without) => {
  const sim = FH.cloneGame(g);
  sim.rng = () => luck;
  if (without != null) sim.jokers = sim.jokers.filter(s => s.uid !== without);
  const want = new Set(uids);
  return FH.play(sim, sim.hand.filter(k => want.has(k.uid)));
};
FH.resolvePlay = g => {
  const p = g.pending; g.pending = null;
  if (p === 'win') return FH.winRound(g);
  if (p === 'lose') { g.phase = 'over'; return null; }
  if (p === 'draw') FH.drawHand(g);
  return null;
};

FH.discard = (g, cards) => {
  if (!FH.canDiscard(g) || !cards.length || cards.length > 5) return { error: 'You cannot discard that' };
  cards = g.hand.filter(k => cards.includes(k));
  const c = new Ctx(g);
  c.discarded = cards; c.firstDiscard = g.round.discards === 0;
  const free = c.firstDiscard && FH.flag(g, 'freeFirst');
  if (!free) g.discardsLeft--;
  g.round.discards++; g.stats.discards++;
  cards.forEach(k => { k.faceDown = false; });
  g.hand = g.hand.filter(k => !cards.includes(k));
  c.held = g.hand;
  FH.fire(g, 'onDiscard', c);
  for (const k of cards) {
    g.round.discarded++; g.stats.cardsDiscarded++;
    if (k.stamp === 'violet' && g.deck.includes(k)) { c.cur = k; c.curKind = 'card'; c.create('charm'); }
  }
  const left = cards.filter(k => g.deck.includes(k));
  if (c.returnToDraw) left.forEach(k => g.draw.splice(Math.floor(g.rng() * (g.draw.length + 1)), 0, k));
  else g.pile.push(...left);
  FH.drawHand(g);
  return { ev: c.ev };
};

FH.winRound = g => {
  const c = new Ctx(g);
  const idx = g.blindIdx, isBoss = idx === 2, boss = FH.bossOn(g) ? g.boss : null;
  c.boss = isBoss; c.held = g.hand;
  const lines = []; c.lines = lines;
  const before = g.money;
  const reward = boss && boss.noReward ? 0 : FH.BLINDS[idx].reward;
  if (reward) { lines.push([FH.BLINDS[idx].name + ' beaten', reward]); g.money += reward; }
  if (g.handsLeft > 0) { lines.push([`${g.handsLeft} unused hand${g.handsLeft > 1 ? 's' : ''}`, g.handsLeft]); g.money += g.handsLeft; }
  const gilt = g.hand.filter(k => k.enh === 'gilt' && !k.debuffed).length;
  if (gilt) { lines.push(['Gilt cards in hand', gilt * 3]); g.money += gilt * 3; }
  g.hand.forEach(k => { if (k.stamp === 'azure' && !k.debuffed && g.round.lastType) FH.createCons(g, 'decree', 'decree_' + g.round.lastType, c); });
  FH.fire(g, 'roundEnd', c);
  const rate = 1 + FH.mod(g, 'interestRate'), cap = 5 + FH.mod(g, 'interestCap');
  const interest = Math.min(cap, Math.floor(Math.max(0, before) / 5)) * rate;
  if (interest) { lines.push(['Interest', interest]); g.money += interest; FH.fire(g, 'interest', c, interest); }
  g.jokers.forEach(s => { s.rounds++; s.disabled = false; });
  g.stats.blinds++;
  g.phase = 'cashout';
  g.payout = { lines, name: isBoss ? g.boss.name : FH.BLINDS[idx].name, score: g.score, target: g.target };
  g.deck.forEach(k => { k.debuffed = false; k.faceDown = false; });
  g.hand = []; g.draw = []; g.pile = [];
  if (isBoss) {
    g.stats.bosses++; g.ante++; g.blindIdx = 0; g.bossOff = false;
    if (g.ante === 9 && !g.endless) g.won = true;
    g.boss = FH.pickBoss(g);
  } else g.blindIdx++;
  return { ev: c.ev };
};

/* ---------- shop ---------- */
const FIN_COST = { sheen: 2, lustre: 3, opal: 5, hollow: 5 };
FH.price = (g, item) => {
  const base = item.def.cost + (item.fin ? FIN_COST[item.fin] : 0);
  const disc = Math.min(100, FH.mod(g, 'discount'));
  return disc >= 100 ? 0 : Math.max(1, Math.round(base * (1 - disc / 100)));
};
FH.canAfford = (g, p) => g.money - p >= -FH.mod(g, 'debt');
FH.rerollCost = g => (FH.flag(g, 'freeReroll') && g.shop.rerolls === 0 ? 0 : Math.max(0, g.shop.rerollCost - FH.mod(g, 'rerollDiscount')));
FH.rollJoker = (g, exclude, minRarity) => {
  const r = g.rng(), rareW = FH.flag(g, 'moreRares') ? 0.15 : 0.05;
  let rarity = r < 0.006 ? 4 : r < 0.006 + rareW ? 3 : r < 0.006 + rareW + 0.27 ? 2 : 1;
  if (minRarity && rarity < minRarity) rarity = minRarity;
  const taken = new Set([...g.jokers.map(s => s.id), ...exclude]);
  let pool = FH.JLIST.filter(d => d.rarity === rarity && !taken.has(d.id));
  if (!pool.length) pool = FH.JLIST.filter(d => !taken.has(d.id));
  const def = FH.pick(g, pool);
  const f = g.rng();
  const fin = f < 0.035 ? 'sheen' : f < 0.06 ? 'lustre' : f < 0.072 ? 'opal' : f < 0.08 ? 'hollow' : null;
  return { uid: FH.uid(), kind: 'joker', def, fin };
};
FH.rollCons = (g, exclude) => {
  const wr = FH.flag(g, 'moreRites') ? 0.6 : 0.2;
  const r = g.rng() * (0.8 + wr);
  const kind = r < 0.45 ? 'decree' : r < 0.8 ? 'charm' : 'rite';
  let pool = FH.consPool(g, kind).filter(d => !exclude.includes(d.id));
  if (!pool.length) pool = FH.consPool(g, kind);
  const def = FH.pick(g, pool);
  return { uid: FH.uid(), kind: def.kind, def };
};
FH.rollShop = g => {
  const sh = g.shop; sh.jokers = []; sh.cons = [];
  const n = 3 + FH.mod(g, 'shopJokers');
  for (let i = 0; i < n; i++) sh.jokers.push(FH.rollJoker(g, sh.jokers.map(x => x.def.id), i === 0 && FH.flag(g, 'firstUncommon') ? 2 : 0));
  for (let i = 0; i < 3; i++) sh.cons.push(FH.rollCons(g, sh.cons.map(x => x.def.id)));
};
FH.enterShop = g => {
  g.phase = 'shop'; g.payout = null;
  g.shop = { jokers: [], cons: [], rerollCost: 5, rerolls: 0, bought: 0 };
  FH.rollShop(g);
  const c = new Ctx(g);
  FH.fire(g, 'shopEnter', c);
  return { ev: c.ev };
};
FH.reroll = g => {
  const cost = FH.rerollCost(g);
  if (g.phase !== 'shop' || !FH.canAfford(g, cost)) return { error: 'Not enough money to reroll' };
  g.money -= cost;
  if (cost > 0 || g.shop.rerolls > 0) g.shop.rerollCost++;
  g.shop.rerolls++; g.stats.rerolls++;
  FH.rollShop(g);
  const c = new Ctx(g);
  FH.fire(g, 'reroll', c);
  return { ev: c.ev };
};
FH.consError = (g, def, sel) => {
  if (def.need) {
    if (g.phase !== 'play') return 'Use this during a blind, on cards in your hand';
    if (sel.length < def.need[0] || sel.length > def.need[1]) return def.need[1] === 1 ? 'Select exactly 1 card in your hand first' : `Select ${def.need[0]} to ${def.need[1]} cards in your hand first`;
  }
  if (def.inRound && g.phase !== 'play') return 'Use this during a blind';
  if (g.pending) return 'Wait for the hand to finish';
  return (def.can && def.can(g, sel)) || null;
};
FH.applyCons = (g, def, sel, c) => {
  def.use(g, c, sel);
  g.stats.consUsed++;
  FH.fire(g, 'useCons', c, def);
  FH.refreshDebuffs(g);
  if (g.phase === 'play') FH.sortHand(g);
};
FH.useCons = (g, inst, sel) => {
  const err = FH.consError(g, inst.def, sel || []);
  if (err) return { error: err };
  const c = new Ctx(g);
  const keep = FH.flag(g, 'consKeep') && FH.chance(g, 1, 4);
  if (!keep) g.cons = g.cons.filter(x => x !== inst);
  FH.applyCons(g, inst.def, sel || [], c);
  if (keep) c.msg('Not used up!');
  return { ev: c.ev };
};
FH.buy = (g, item, useNow) => {
  if (g.phase !== 'shop') return { error: 'The shop is closed' };
  const p = FH.price(g, item);
  if (!FH.canAfford(g, p)) return { error: 'Not enough money' };
  if (item.kind === 'joker') { if (!FH.canAddJoker(g, item.def, item.fin)) return { error: 'No empty Joker slot. Sell a Joker first' }; }
  else if (useNow) { const e = FH.consError(g, item.def, []); if (e) return { error: e }; }
  else if (g.cons.length >= FH.consSlots(g)) return { error: 'No empty consumable slot. Use or sell one first' };
  const c = new Ctx(g);
  g.money -= p; g.stats.bought++; g.shop.bought++;
  FH.fire(g, 'buy', c, item);
  g.shop.jokers = g.shop.jokers.filter(x => x !== item);
  g.shop.cons = g.shop.cons.filter(x => x !== item);
  if (item.kind === 'joker') {
    const s = FH.makeJoker(item.def.id, item.fin);
    s.paid = p; g.jokers.push(s);
    if (s.def.roll) s.def.roll(c, s);
    if (s.def.acquired) s.def.acquired(c, s);
  } else if (useNow) FH.applyCons(g, item.def, [], c);
  else g.cons.push({ uid: FH.uid(), def: item.def });
  return { ev: c.ev };
};
FH.sellJoker = (g, s) => {
  if (!g.jokers.includes(s) || g.pending) return { error: 'You cannot sell that now' };
  const c = new Ctx(g);
  const v = FH.sellValue(g, s);
  FH.removeJoker(g, s);
  g.money += v; g.stats.sold++;
  if (s.def.sold) { c.cur = s; c.curKind = 'joker'; s.def.sold(c, s); c.cur = null; }
  FH.fire(g, 'sell', c, s);
  if (g.phase === 'play') { FH.refreshDebuffs(g); }
  return { ev: c.ev, value: v };
};
FH.sellCons = (g, inst) => {
  if (!g.cons.includes(inst)) return { error: 'You cannot sell that now' };
  const c = new Ctx(g);
  g.cons = g.cons.filter(x => x !== inst);
  const v = Math.max(1, Math.floor(inst.def.cost / 2));
  g.money += v; g.stats.sold++;
  FH.fire(g, 'sell', c, inst);
  return { ev: c.ev, value: v };
};
FH.leaveShop = g => {
  const c = new Ctx(g);
  FH.fire(g, 'shopExit', c);
  g.phase = 'blind'; g.shop = null;
  return { ev: c.ev };
};
})();
