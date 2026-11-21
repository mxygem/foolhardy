/* Data checks and a random-play bot. Run: node test/check.js */
'use strict';
const path = require('path');
for (const f of ['core', 'items', 'jokers-a', 'jokers-b', 'jokers-c', 'jokers-d']) require(path.join(__dirname, '..', 'js', f + '.js'));
const FH = globalThis.FH;
let failed = 0;
/* Preview checks, filled in by the bot: a preview must never change the real game, and must predict the real score when luck plays no part. */
const PV = { sims: 0, exact: 0, mismatch: [], mutated: [] };
const snap = g => JSON.stringify(g, (k, v) => (typeof v === 'function' ? undefined : v));
const fail = msg => { failed++; console.log('FAIL  ' + msg); };
const ok = msg => console.log('ok    ' + msg);

/* ---------- data ---------- */
const J = FH.JLIST;
J.length === 300 ? ok('300 jokers') : fail(`expected 300 jokers, found ${J.length}`);
const dupes = (label, key) => {
  const seen = new Map(); let n = 0;
  for (const d of J) { const k = key(d); if (seen.has(k)) { n++; fail(`${label} shared by "${seen.get(k)}" and "${d.name}": ${k}`); } else seen.set(k, d.name); }
  if (!n) ok(`every joker has a unique ${label}`);
};
dupes('name', d => d.name);
dupes('emoji', d => d.emoji);
dupes('flavor text', d => d.flavor);
const HANDS = Object.values(FH.HANDS).map(h => h.name).sort((a, b) => b.length - a.length);
const norm = s => {
  s = s.replace(/\(Now[^)]*\)|\(#[^)]*\)/g, '').replace(/#\w+#/g, 'VAR');
  for (const h of HANDS) s = s.split(h).join('HAND');
  return s.replace(/\b(Hearts?|Spades?|Diamonds?|Clubs?)\b/g, 'SUIT').replace(/\b(Aces?|Kings?|Queens?|Jacks?)\b/g, 'RANK').replace(/\d+(\.\d+)?/g, 'N').replace(/\s+/g, ' ').trim().toLowerCase();
};
dupes('behaviour (description with numbers, suits, ranks and hand names blanked out)', d => norm(d.desc));
const NEW = cp => cp === 0x200d || cp === 0x1fa74 || (cp >= 0x1fa83 && cp <= 0x1fa86) || (cp >= 0x1fa96 && cp <= 0x1faff) || [0x1f6d6, 0x1f6d7, 0x1f6fb, 0x1f6fc, 0x1f90c, 0x1f972, 0x1f977, 0x1f978, 0x1f9a3, 0x1f9a4, 0x1f9ab, 0x1f9ac, 0x1f9ad, 0x1f9cb, 0x1f7f0].includes(cp);
const risky = [...J, ...FH.CLIST, ...FH.BOSSLIST].filter(d => [...d.emoji].some(ch => NEW(ch.codePointAt(0))));
risky.length ? fail('emoji newer than Unicode 12 (may not render): ' + risky.map(d => `${d.name} ${d.emoji}`).join(', ')) : ok('all emoji are Unicode 12 or older, no joined sequences');
for (const d of J) {
  if (!d.desc || !d.flavor || !d.emoji) fail('missing text on ' + d.name);
  const hooks = ['before', 'retrigger', 'onScore', 'retriggerHeld', 'onHeld', 'main', 'final', 'scored', 'after', 'onDiscard', 'roll', 'roundStart', 'firstDraw', 'roundEnd', 'shopEnter', 'shopExit', 'reroll', 'buy', 'sell', 'sold', 'acquired', 'useCons', 'leveled', 'cardAdded', 'cardDestroyed', 'lucky', 'interest', 'rescue', 'mods', 'flags', 'copy', 'wing'];
  if (!hooks.some(h => d[h])) fail('joker has no behaviour: ' + d.name);
  const unknown = Object.keys(d).filter(k => !hooks.includes(k) && !['id', 'name', 'rarity', 'emoji', 'desc', 'flavor', 'cost', 'v'].includes(k));
  if (unknown.length) fail(`unknown field on ${d.name}: ${unknown}`);
  const missing = (d.desc.match(/#(\w+)#/g) || []).filter(t => !(d.v && t.slice(1, -1) in d.v));
  if (missing.length) fail(`description of ${d.name} uses unset value ${missing}`);
}
const rar = [0, 0, 0, 0, 0]; J.forEach(d => rar[d.rarity]++);
console.log(`      rarities: ${rar[1]} common, ${rar[2]} uncommon, ${rar[3]} rare, ${rar[4]} legendary`);
console.log(`      ${FH.CLIST.length} consumables (${['decree', 'charm', 'rite'].map(k => FH.CLIST.filter(d => d.kind === k).length + ' ' + k + 's').join(', ')}), ${FH.BOSSLIST.length} bosses`);

/* ---------- hand evaluation ---------- */
{
  const g = FH.newGame(1);
  const mk = str => str.split(' ').map(t => FH.makeCard({ A: 14, K: 13, Q: 12, J: 11, T: 10 }[t[0]] || Number(t[0]), t[1]));
  const cases = [['AS KS QS JS TS', 'sflush'], ['AS AH AD AC KS', 'four'], ['AS AH AD KC KS', 'full'], ['2S 5S 9S JS KS', 'flush'], ['AS 2H 3D 4C 5S', 'straight'], ['9S 9H 9D 4C 5S', 'three'], ['9S 9H 4D 4C 5S', 'twopair'], ['9S 9H 3D 4C 5S', 'pair'], ['9S 7H 3D 4C KS', 'high'], ['7S 7S 7S 7S 7S', 'ffive'], ['7S 7S 7S 8S 8S', 'fhouse'], ['7S 7H 7D 7C 7S', 'five'], ['KS AH 2D 3C 4S', 'high']];
  let bad = 0;
  for (const [h, want] of cases) { const got = FH.evaluate(g, mk(h)).type; if (got !== want) { bad++; fail(`evaluate ${h}: got ${got}, want ${want}`); } }
  g.jokers.push(FH.makeJoker('ouroboros'));
  if (FH.evaluate(g, mk('KS AH 2D 3C 4S')).type !== 'straight') { bad++; fail('wrap-around straight'); }
  g.jokers = [FH.makeJoker('corner_cutter')];
  if (FH.evaluate(g, mk('2S 5S 9S JS KH')).type !== 'flush') { bad++; fail('4-card flush'); }
  g.jokers = [FH.makeJoker('leapfrog')];
  if (FH.evaluate(g, mk('2S 4S 6H 8D TC')).type !== 'straight') { bad++; fail('gapped straight'); }
  if (!bad) ok('hand evaluation, including the rule-changing jokers');
}

/* ---------- bot ---------- */
const ORDER = FH.HAND_IDS;
const combos = (arr, max) => { const out = []; const rec = (i, cur) => { if (cur.length) out.push(cur); if (cur.length === max) return; for (let j = i; j < arr.length; j++) rec(j + 1, [...cur, arr[j]]); }; rec(0, []); return out; };
const bestPlay = g => {
  let best = null, score = -1;
  for (const cs of combos(g.hand, 5)) {
    const e = FH.evaluate(g, cs);
    const H = FH.HANDS[e.type], lvl = g.levels[e.type];
    const sc = (H.pts + H.lp * (lvl - 1) + e.scoring.reduce((n, k) => n + FH.rankPts(k.rank), 0)) * (H.mult + H.lm * (lvl - 1)) + cs.length * 0.01;
    if (sc > score) { score = sc; best = cs; }
  }
  return { cards: best, type: FH.evaluate(g, best).type };
};
const check = (g, where) => { if (!Number.isFinite(g.score) || !Number.isFinite(g.money)) throw new Error(`non-finite score or money after ${where}`); if (g.hand.some(k => !g.deck.includes(k))) throw new Error('card in hand that is not in deck after ' + where); };
const tryCons = g => {
  for (const inst of [...g.cons]) {
    if (g.rng() < 0.5) continue;
    const need = inst.def.need;
    const sel = need ? FH.sample(g, g.hand, need[0] + Math.floor(g.rng() * (need[1] - need[0] + 1))) : [];
    FH.useCons(g, inst, g.hand.filter(k => sel.includes(k)));
  }
};
const playRound = (g, smart) => {
  FH.startBlind(g); check(g, 'startBlind');
  let guard = 0;
  while (g.phase === 'play' && guard++ < 60) {
    tryCons(g);
    if (!g.hand.length) { g.phase = 'over'; break; }
    const b = bestPlay(g);
    const weak = ORDER.indexOf(b.type) < 2;
    if (FH.canDiscard(g) && (smart ? weak : g.rng() < 0.4)) {
      const keep = new Set(b.type === 'high' ? [] : FH.evaluate(g, b.cards).scoring);
      const toss = g.hand.filter(k => !keep.has(k)).sort((a, c) => a.rank - c.rank).slice(0, 5);
      if (toss.length) { const r = FH.discard(g, toss); if (r.error) throw new Error(r.error); check(g, 'discard'); continue; }
    }
    let cards = b.cards;
    if (FH.bossOn(g) && g.boss.validate && g.boss.validate(g, cards)) cards = g.hand.slice(0, 5);
    if (!(FH.bossOn(g) && g.boss.validate && g.boss.validate(g, cards))) {
      const before = snap(g), u = cards.map(k => k.uid);
      const sims = [0, 0.999999].map(l => FH.simulate(g, u, l));
      const wo = g.jokers.length ? FH.simulate(g, u, 0, g.jokers[0].uid) : null;
      PV.sims += 2 + (wo ? 1 : 0);
      if (snap(g) !== before) PV.mutated.push(g.jokers.map(s => s.def.name).join(', '));
      if (sims[0].total === sims[1].total) PV.pending = { total: sims[0].total, jokers: g.jokers.map(s => s.def.name).join(', ') + ' / ' + (FH.bossOn(g) ? g.boss.name : 'no boss') };
    }
    const r = FH.play(g, cards);
    if (PV.pending) { if (!r.error) { if (r.total === PV.pending.total) PV.exact++; else PV.mismatch.push(`predicted ${PV.pending.total}, got ${r.total} [${PV.pending.jokers}]`); } PV.pending = null; }
    if (r.error) { if (g.hand.length < 5) { g.phase = 'over'; break; } throw new Error(r.error); }
    if (!Number.isFinite(r.total)) throw new Error('hand total is not a number');
    FH.resolvePlay(g); check(g, 'play');
  }
  return g.phase === 'cashout';
};
const shopVisit = (g, buyJokers) => {
  FH.enterShop(g);
  for (let i = 0; i < 3; i++) {
    for (const it of [...g.shop.jokers, ...g.shop.cons]) {
      if (it.kind === 'joker' && !buyJokers) continue;
      if (g.rng() < 0.6) FH.buy(g, it, it.kind !== 'joker' && !it.def.need && !it.def.inRound && g.rng() < 0.5);
    }
    if (g.rng() < 0.3) FH.reroll(g);
    if (g.jokers.length && g.rng() < 0.1) FH.sellJoker(g, FH.pick(g, g.jokers));
    if (g.cons.length && g.rng() < 0.1) FH.sellCons(g, FH.pick(g, g.cons));
    tryCons(g);
  }
  FH.leaveShop(g); check(g, 'shop');
};

/* each joker alone, three rounds */
{
  let bad = 0;
  for (const d of J) {
    for (const seed of [11, 29]) {
      const g = FH.newGame(seed + FH.hash(d.id));
      try {
        g.money = 30;
        if (!FH.addJoker(g, d.id)) throw new Error('could not add');
        FH.descOf(d, g.jokers[0]);
        for (let r = 0; r < 4 && g.phase !== 'over'; r++) { g.target = 1; if (!playRound(g, r % 2 === 0)) break; shopVisit(g, false); }
      } catch (e) { bad++; fail(`joker "${d.name}" alone (seed ${seed}): ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
    }
  }
  if (!bad) ok('each of the 300 jokers survives several rounds on its own');
}
/* chaos runs: random jokers, random finishes, everything mixed */
{
  let bad = 0, rounds = 0;
  for (let seed = 1; seed <= 400 && bad < 8; seed++) {
    const g = FH.newGame(seed);
    let trail = '';
    try {
      for (let r = 0; r < 26 && g.phase !== 'over'; r++) {
        while (g.jokers.length < FH.jokerSlots(g) && g.rng() < 0.85) { const d = FH.pick(g, J); if (!g.jokers.some(s => s.id === d.id)) FH.addJoker(g, d.id, FH.pick(g, [null, null, 'sheen', 'lustre', 'opal', 'hollow'])); else break; }
        if (g.rng() < 0.3) FH.shuffle(g, g.jokers);
        trail = g.jokers.map(s => s.def.name).join(', ') + ' / boss ' + g.boss.name;
        g.money += 5;
        const won = playRound(g, true); rounds++;
        if (!won) { if (g.rng() < 0.7) { g.phase = 'cashout'; g.hand = []; g.draw = []; g.pile = []; g.pending = null; if (g.blindIdx === 2) { g.ante++; g.blindIdx = 0; g.boss = FH.pickBoss(g); } else g.blindIdx++; } else break; }
        shopVisit(g, true);
        if (g.jokers.length > 2 && g.rng() < 0.5) FH.sellJoker(g, FH.pick(g, g.jokers));
      }
    } catch (e) { bad++; fail(`chaos seed ${seed} [${trail}]: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); }
  }
  if (!bad) ok(`chaos runs: ${rounds} rounds with random joker mixes, no errors`);
}
/* honest runs: only what the shop sells, to see how far a simple bot gets */
{
  const reach = {}; let wins = 0; const N = 300;
  for (let seed = 1; seed <= N; seed++) {
    const g = FH.newGame(seed * 7919);
    try {
      while (g.phase !== 'over' && !g.won) { if (!playRound(g, true)) break; if (g.won) break; shopVisit(g, true); }
    } catch (e) { fail(`honest seed ${seed}: ${e.stack.split('\n').slice(0, 3).join(' | ')}`); break; }
    if (g.won) wins++;
    reach[g.ante] = (reach[g.ante] || 0) + 1;
  }
  console.log(`      simple bot over ${N} honest runs: ${wins} wins; runs ending on each ante: ${Object.keys(reach).sort((a, b) => a - b).map(a => `${a > 8 ? 'won' : 'ante ' + a}: ${reach[a]}`).join(', ')}`);
}
PV.mutated.length ? fail(`previews changed the real game ${PV.mutated.length} times, e.g. with ${PV.mutated[0]}`) : ok(`${PV.sims} preview simulations left the real game untouched`);
PV.mismatch.length ? fail(`${PV.mismatch.length} of ${PV.exact + PV.mismatch.length} luck-free previews missed the real score, e.g. ${PV.mismatch.slice(0, 3).join('; ')}`) : ok(`all ${PV.exact} luck-free previews matched the real score exactly`);
console.log(failed ? `\n${failed} check(s) failed` : '\nAll checks passed');
process.exit(failed ? 1 : 0);
