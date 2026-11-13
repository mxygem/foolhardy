/* Foolhardy — consumables (Decrees, Charms, Rites) and boss blinds. */
(function () {
'use strict';
const FH = globalThis.FH;
const { C, B } = FH;
const plural = n => (n > 1 ? 's' : '');
const real = g => g.deck.filter(k => k.enh !== 'granite');

/* ---------- Decrees: raise a hand type's level ---------- */
const DECREES = {
  high: ['🕯', 'Even the smallest candle is granted a taller flame.'],
  pair: ['👯', 'By order of the court, two is now officially company.'],
  twopair: ['🧤', 'Both gloves found. The crown is pleased.'],
  three: ['🎪', 'Three rings, one tent, all applause.'],
  straight: ['🚂', 'The line shall run on time, and in order.'],
  flush: ['🌊', 'Let everything in the river be the same colour.'],
  full: ['🏠', 'Every room occupied. Raise the rent.'],
  four: ['🍀', 'One leaf per corner of the kingdom.'],
  sflush: ['🌈', 'In order, and in colour. The court weeps.'],
  five: ['🖐', 'A full hand of the very same finger.'],
  fhouse: ['🏰', 'A full house, flying a single flag.'],
  ffive: ['🌋', 'Five of one thing, in one colour. Stand back.'],
};
for (const id of FH.HAND_IDS) {
  const H = FH.HANDS[id];
  C('decree', 'Decree ' + id, DECREES[id][0], `Raise ${H.name} by one level: +${H.lp} Points and +${H.lm} Mult.`, DECREES[id][1], { hand: id, title: 'Decree: ' + H.name, use: (g, c) => c.level(id) });
}
FH.CLIST.forEach(d => { if (d.title) d.name = d.title; });

/* ---------- Charms: change the cards you select ---------- */
const enhCharm = (name, emoji, enh, max, flavor) => C('charm', name, emoji, `Make ${max > 1 ? 'up to ' + max + ' selected cards' : '1 selected card'} ${FH.ENH[enh].name}. ${FH.ENH[enh].desc}.`, flavor, { need: [1, max], use: (g, c, sel) => sel.forEach(k => { k.enh = enh; }) });
enhCharm('Lead Weight', '⚓', 'heavy', 2, 'Sewn into the hem so the card lands with a thud.');
enhCharm('Whet Charm', '🔪', 'keen', 2, 'An edge you could shave a punchline with.');
enhCharm('Prism Shard', '🔷', 'prism', 1, 'Hold it to the footlights and it is every suit at once.');
enhCharm('Glass Bead', '🔮', 'brittle', 1, 'Beautiful, loud, and not long for this world.');
enhCharm('Iron Nail', '🔩', 'iron', 1, 'Does its best work by staying exactly where it is.');
enhCharm('Gold Leaf', '🍂', 'gilt', 1, 'Thin enough to breathe on, rich enough to keep.');
enhCharm('Clover Pin', '☘', 'charmed', 2, 'Pinned inside the lapel, where luck cannot see it coming.');
enhCharm('River Stone', '🗿', 'granite', 1, 'It forgot its rank and suit a thousand years ago.');
const stampCharm = (name, emoji, st, flavor) => C('charm', name, emoji, `Press a ${FH.STAMP[st].name} onto 1 selected card. ${FH.STAMP[st].desc}.`, flavor, { need: [1, 1], use: (g, c, sel) => { sel[0].stamp = st; } });
stampCharm('Crimson Wax', '🔴', 'crimson', 'Sealed twice, for emphasis.');
stampCharm('Azure Wax', '🔵', 'azure', 'A letter to the court, answered by morning.');
stampCharm('Gold Wax', '🟡', 'gold', 'Postage paid, with change.');
stampCharm('Violet Wax', '🟣', 'violet', 'Return to sender. The sender is delighted.');
const finCharm = (name, emoji, fin, flavor, cost) => C('charm', name, emoji, `Coat 1 selected card in ${FH.FIN[fin].name}: ${FH.FIN[fin].desc} when scored.`, flavor, { need: [1, 1], cost, use: (g, c, sel) => { sel[0].fin = fin; } });
finCharm('Sheen Varnish', '🧴', 'sheen', 'One coat. Mind the wet edge.', 4);
finCharm('Lustre Varnish', '🧪', 'lustre', 'Catches the light, then keeps it.', 4);
finCharm('Opal Varnish', '🐚', 'opal', 'Every colour the sea ever tried on.', 6);
C('charm', 'Stepladder', '🧗', 'Raise the rank of up to 2 selected cards by 1. Aces climb back down to 2.', 'One rung at a time, and do not look down.', { need: [1, 2], use: (g, c, sel) => sel.forEach(k => { if (k.enh !== 'granite') k.rank = k.rank === 14 ? 2 : k.rank + 1; }) });
C('charm', 'Engraver', '🖋', '1 selected card permanently gains +25 Points.', 'A small flourish in the corner that adds up.', { need: [1, 1], use: (g, c, sel) => { sel[0].bp += 25; } });
C('charm', 'Doppel Charm', '👥', 'Select 2 cards. The left one becomes an exact copy of the right one.', 'One of them was always the understudy.', { need: [2, 2], use: (g, c, sel) => { const [a, b] = sel; Object.assign(a, { rank: b.rank, suit: b.suit, enh: b.enh, stamp: b.stamp, fin: b.fin, bp: b.bp, bm: b.bm }); } });
const dye = (name, emoji, s, flavor) => C('charm', name, emoji, `Turn up to 3 selected cards into ${FH.SUIT[s].name}.`, flavor, { need: [1, 3], use: (g, c, sel) => sel.forEach(k => { k.suit = s; }) });
dye('Heart Dye', '🌹', 'H', 'Steeped overnight in something sentimental.');
dye('Spade Dye', '🖤', 'S', 'Black as the wings between acts.');
dye('Diamond Dye', '🧡', 'D', 'The exact orange-red of a rented jewel.');
dye('Club Dye', '🌿', 'C', 'Boiled clover. It smells better than it sounds.');
C('charm', 'Fat Purse', '👛', 'Double your money, up to +$20.', 'It was thin this morning. Nobody is asking questions.', { use: (g, c) => c.money(Math.min(20, Math.max(0, g.money))) });

/* ---------- Rites: reshape the deck itself ---------- */
C('rite', 'Culling Rite', '🗡', 'Destroy up to 2 selected cards.', 'The troupe is smaller now, and better for it.', { need: [1, 2], use: (g, c, sel) => sel.forEach(k => c.destroy(k)) });
C('rite', 'Winnowing', '🌾', 'Destroy the 3 lowest-ranked cards in your deck.', 'Toss it to the wind and keep what falls back.', { can: g => (real(g).length < 4 ? 'Your deck is too small' : null), use: (g, c) => real(g).sort((a, b) => a.rank - b.rank).slice(0, 3).forEach(k => c.destroy(k)) });
C('rite', 'Decimation', '💀', 'Destroy 1 card in every 10 in your deck, chosen at random. Earn $1 for each.', 'An old and unpopular tradition.', { can: g => (g.deck.length < 10 ? 'Your deck is too small' : null), use: (g, c) => { const n = Math.floor(g.deck.length / 10); FH.sample(g, g.deck, n).forEach(k => c.destroy(k)); c.money(n); } });
C('rite', 'Rite of Plenty', '🌽', 'Add 3 random cards with random enhancements to your deck.', 'The harvest came in strange this year.', { use: (g, c) => { for (let i = 0; i < 3; i++) c.add(FH.randomCard(g, { enh: FH.pick(g, ['heavy', 'keen', 'prism', 'brittle', 'iron', 'gilt', 'charmed']) }), 'draw'); } });
C('rite', 'Court Summons', '📯', 'Add 2 random face cards to your deck.', 'Attendance is not optional.', { use: (g, c) => { for (let i = 0; i < 2; i++) c.add(FH.makeCard(11 + Math.floor(g.rng() * 3), FH.pick(g, FH.SUITS)), 'draw'); } });
C('rite', 'Ace Offering', '🎖', 'Add 2 Aces of random suits to your deck.', 'Left on the altar. Gone by morning. Then, somehow, in your sleeve.', { use: (g, c) => { for (let i = 0; i < 2; i++) c.add(FH.makeCard(14, FH.pick(g, FH.SUITS)), 'draw'); } });
C('rite', 'Mirror Rite', '🎭', 'Add 2 copies of 1 selected card to your deck.', 'Step through the glass twice and count who comes back.', { need: [1, 1], use: (g, c, sel) => { for (let i = 0; i < 2; i++) c.add(FH.cloneCard(sel[0]), 'draw'); } });
const tide = (name, emoji, s, flavor) => C('rite', name, emoji, `5 random cards in your deck become ${FH.SUIT[s].name}.`, flavor, { use: (g, c) => { FH.sample(g, real(g).filter(k => k.suit !== s), 5).forEach(k => { k.suit = s; }); c.msg(FH.SUIT[s].name + ' rise'); } });
tide('Tide of Hearts', '💗', 'H', 'It comes in warm and takes five with it.');
tide('Tide of Spades', '🌑', 'S', 'A black tide under a blacker moon.');
tide('Tide of Diamonds', '💠', 'D', 'The shallows glitter and five cards do not come back the same.');
tide('Tide of Clubs', '🌲', 'C', 'The forest walks down to the waterline.');
C('rite', 'Convergence', '🧲', '5 random cards in your deck all become one random rank.', 'Five strangers agree on something. It is unsettling.', { use: (g, c) => { const pool = real(g); if (!pool.length) return; const r = FH.pick(g, pool).rank; FH.sample(g, pool.filter(k => k.rank !== r), 5).forEach(k => { k.rank = r; }); c.msg('All ' + FH.rankName(r) + 's'); } });
C('rite', 'Coronation', '👑', '4 random number cards in your deck become random face cards.', 'Four commoners wake up with titles and no idea why.', { use: (g, c) => FH.sample(g, real(g).filter(k => k.rank <= 10), 4).forEach(k => { k.rank = 11 + Math.floor(g.rng() * 3); }) });
C('rite', 'Blood Moon', '🌕', 'Every card in your hand becomes one random suit.', 'Everything looks the same colour in this light.', { inRound: true, use: (g, c) => { const s = FH.pick(g, FH.SUITS); g.hand.forEach(k => { k.suit = s; }); c.msg('All ' + FH.SUIT[s].name); } });
C('rite', 'Levelling Wind', '🌪', '4 random cards in your hand become the same random rank.', 'It blows the hats off the tall and the short alike.', { inRound: true, cost: 6, use: (g, c) => { const pool = g.hand.filter(k => k.enh !== 'granite'); if (!pool.length) return; const r = FH.pick(g, pool).rank; FH.sample(g, pool, 4).forEach(k => { k.rank = r; }); c.msg('All ' + FH.rankName(r) + 's'); } });
C('rite', 'Wax Seance', '🕯', '3 random cards in your deck gain a random stamp.', 'The candles drip upward. Best not to ask.', { title: 'Wax Séance', use: (g, c) => FH.sample(g, g.deck.filter(k => !k.stamp), 3).forEach(k => { k.stamp = FH.pick(g, Object.keys(FH.STAMP)); }) });
C('rite', 'Gilding Rite', '🏺', '4 random plain cards in your deck gain a random enhancement.', 'Dip, lift, and hope it was the right vat.', { use: (g, c) => FH.sample(g, g.deck.filter(k => !k.enh), 4).forEach(k => { k.enh = FH.pick(g, ['heavy', 'keen', 'prism', 'brittle', 'iron', 'gilt', 'charmed']); }) });
C('rite', 'Burnish', '🧽', 'A random Joker without a finish gains Sheen, Lustre or Opal.', 'Rub until you can see your own doubts in it.', { can: g => (g.jokers.some(s => !s.fin) ? null : 'You have no Joker without a finish'), use: (g, c) => { const s = FH.pick(g, g.jokers.filter(x => !x.fin)); s.fin = FH.pick(g, ['sheen', 'sheen', 'lustre', 'lustre', 'opal']); c.msg(s.def.name + ': ' + FH.FIN[s.fin].name); } });
C('rite', 'Genesis', '🥚', 'Create a random Joker. Needs an empty Joker slot.', 'It hatches already telling a joke.', { cost: 6, can: g => (g.jokers.length < FH.jokerSlots(g) ? null : 'No empty Joker slot'), use: (g, c) => { const it = FH.rollJoker(g, []); FH.addJoker(g, it.def.id, null, c); c.msg('+' + it.def.name); } });
C('rite', 'Tithe', '⚱', 'Destroy 2 random cards in your deck and earn $8.', 'The collection plate does not make change.', { can: g => (g.deck.length < 3 ? 'Your deck is too small' : null), use: (g, c) => { FH.sample(g, g.deck, 2).forEach(k => c.destroy(k)); c.money(8); } });
FH.CLIST.forEach(d => { if (d.title) d.name = d.title; });

/* ---------- Boss blinds ---------- */
const suitBoss = (name, emoji, s) => B(name, emoji, `All ${FH.SUIT[s].name} are debuffed.`, { debuff: k => k.suit === s && k.enh !== 'granite' && k.enh !== 'prism' });
suitBoss('The Frost', '❄', 'S');
suitBoss('The Blight', '🍄', 'C');
suitBoss('The Heartbreak', '💔', 'H');
suitBoss('The Tarnish', '🌫', 'D');
B('The Usher', '🚪', 'All face cards are debuffed.', { debuff: (k, g) => FH.isFace(g, k) });
B('The Sieve', '🕳', 'Your hand holds 1 fewer card.', { mods: { handSize: -1 } });
B('The Warden', '🔒', 'You have no discards.', { mods: { discards: -99 }, min: 2 });
B('The Glutton', '🍖', 'You have 1 fewer hand.', { mods: { hands: -1 } });
B('The Bore', '🥱', 'A hand type you have already played this blind scores nothing.', { onPlay: (g, c) => { if (g.round.types.includes(c.type)) { c.nulled = true; c.msg('Heard it before'); } } });
B('The Typecast', '🎬', 'Only the first hand type you play counts. Any other type scores nothing.', { min: 2, onPlay: (g, c) => { if (g.round.types.length && g.round.types[0] !== c.type) { c.nulled = true; c.msg('Not your role'); } } });
B('The Taxman', '🧾', 'Lose $1 for every card you play.', { onPlay: (g, c) => { c.money(-Math.min(Math.max(0, g.money), c.played.length)); } });
B('The Fog', '🌁', '1 in 3 cards are drawn face down.', { faceDown: g => g.rng() < 1 / 3 });
B('The Glare', '🔦', 'Your first hand is dealt face down.', { faceDown: g => g.round.hands === 0 && g.round.discards === 0 });
B('The Vise', '🗜', 'You must play exactly 5 cards.', { validate: (g, cards) => (cards.length === 5 ? null : 'The Vise: you must play exactly 5 cards') });
B('The Thief', '🦝', 'After each hand, 2 random cards in your hand are discarded.', { afterPlay: (g, c) => { FH.sample(g, g.hand, 2).forEach(k => { g.hand = g.hand.filter(x => x !== k); g.pile.push(k); }); } });
B('The Leveler', '⚖', 'Base Points and Mult of every hand are halved.', { min: 2, onPlay: (g, c) => c.setPM(Math.ceil(c.p / 2), Math.ceil(c.m / 2), 'Halved') });
const mute = (g, c) => { g.jokers.forEach(s => { s.disabled = false; }); if (g.jokers.length) { const s = FH.pick(g, g.jokers); s.disabled = true; } };
B('The Mute', '🤐', 'One random Joker is silenced each hand.', { min: 2, onStart: mute, afterPlay: mute });
B('The Censor', '✂', 'Every hand type counts as level 1.', { min: 3 });
B('The Colossus', '🗼', 'The target is three times the ante base instead of twice.', { targetMult: 3, min: 2 });
B('The Odd One', '🦄', 'All even-ranked cards (2, 4, 6, 8, 10) are debuffed.', { debuff: k => k.enh !== 'granite' && k.rank <= 10 && k.rank % 2 === 0 });
B('The Even Hand', '🤝', 'All odd-ranked cards (A, 3, 5, 7, 9) are debuffed.', { debuff: k => k.enh !== 'granite' && (k.rank === 14 || (k.rank < 10 && k.rank % 2 === 1)) });
B('The Miser', '🦀', 'Beating this blind pays no reward.', { noReward: true });
B('The Critic', '🧐', 'Each hand you play loses one level afterwards.', { min: 2, afterPlay: (g, c) => { if (g.levels[c.type] > 1) c.level(c.type, -1); } });
B('The Crownless King', '🤴', 'All face cards and Aces are debuffed.', { finale: true, debuff: (k, g) => FH.isFace(g, k) || (k.rank === 14 && k.enh !== 'granite') });
B('The Long Night', '🌃', 'The target is three times the ante base, but you get 1 extra hand.', { finale: true, targetMult: 3, mods: { hands: 1 } });
B("The Jester's Shadow", '🦇', 'One random Joker is silenced each hand, and your hand holds 1 fewer card.', { finale: true, mods: { handSize: -1 }, onStart: mute, afterPlay: mute });
})();
