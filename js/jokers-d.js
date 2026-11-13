/* Foolhardy — jokers, part D: rule changes, deck-altering jokers, creation, joker interplay, legendaries. */
(function () {
'use strict';
const FH = globalThis.FH;
const { J } = FH;
const rk = k => (k.enh === 'granite' ? 0 : k.rank);
const idx = (c, s) => c.g.jokers.findIndex(x => x.uid === s.uid);
const once = (c, s, key) => { const f = c.g.round.flags, k = key + s.uid; if (f[k]) return false; f[k] = true; return true; };
const ENHS = ['heavy', 'keen', 'prism', 'brittle', 'iron', 'gilt', 'charmed'];

/* ---------- hands, discards, slots ---------- */
J('Long Arms', 1, '🦒', '+1 hand size.', 'Can hold one more than seems polite.', { mods: { handSize: 1 } });
J('Spare Tire', 1, '🍩', '+1 discard every round.', 'Always carries one more than he needs.', { mods: { discards: 1 } });
J('Second Wind', 2, '🌬', '+1 hand every round.', 'Just when they thought the show was over.', { mods: { hands: 1 } });
J('Glutton', 2, '🐷', '+3 hand size, but 1 fewer hand every round.', 'Fills his plate so high he only gets up three times.', { mods: { handSize: 3, hands: -1 } });
J('Twitchy', 1, '🐿', '+3 discards every round, but −1 hand size.', 'Cannot hold much, cannot hold still.', { mods: { discards: 3, handSize: -1 } });
J('Daredevil', 2, '🏍', '+200 Points, but −2 hand size.', 'Fewer cards, further to fall.', { mods: { handSize: -2 }, main: c => c.pts(200) });
J('All In', 3, '🎇', '×4 Mult, but you only get 1 hand every round.', 'One push of everything, then silence.', { mods: { hands: -99 }, main: c => c.x(4) });
J('Deep Pockets', 1, '🎒', '+1 consumable slot.', 'There is always room for one more secret.', { mods: { consSlots: 1 } });
J('Window Shopper', 1, '🏬', 'The shop offers 1 more Joker.', 'Presses his nose to the glass until they bring out more.', { mods: { shopJokers: 1 } });
J('Soft Touch', 2, '🧸', 'Every blind’s target is 15% lower.', 'The bosses go easy on him. Nobody knows why.', { mods: { targetPct: -15 } });
J('Wide Load', 3, '🐘', '×3.5 Mult, but takes up 2 Joker slots.', 'Needs two chairs and earns both.', { mods: { jokerSlots: -1 }, main: c => c.x(3.5) });

/* ---------- rule changes ---------- */
J('Corner Cutter', 2, '📐', 'Straights and Flushes can be made with 4 cards.', 'Near enough is good enough if you say it fast.', { flags: ['four'] });
J('Leapfrog', 2, '🐸', 'Straights may skip over one missing rank at each step.', 'What is one little gap between friends?', { flags: ['gap'] });
J('Ouroboros', 2, '🐍', 'Straights can wrap around from King through Ace to 2.', 'The end is just the beginning with its mouth full.', { flags: ['wrap'] });
J('Colorblind', 2, '🕶', 'Hearts and Diamonds count as the same suit. Spades and Clubs count as the same suit.', 'Red is red. Black is black. Why complicate things?', { flags: ['colorblind'] });
J('Everybody In', 1, '🤗', 'Every card you play scores.', 'Nobody gets left in the lobby.', { flags: ['allScore'] });
J('Immunity', 3, '💉', 'Your cards cannot be debuffed.', 'Had all his shots before the tour.', { flags: ['immune'] });
J('Cold Reader', 1, '👁', 'You can see the next 3 cards of the draw pile.', 'You are thinking of a card. It is the next one.', { flags: ['peek'] });
J('Stacked Deck', 2, '🥞', 'The first hand you are dealt each round always includes an Ace, if you own one.', 'A fair shuffle, give or take one card.', { roundStart: c => { const d = c.g.draw; const i = d.findIndex(k => rk(k) === 14); if (i >= 0) d.push(d.splice(i, 1)[0]); } });
J('Head Start', 1, '🐢', 'You begin every blind already holding 10% of its target.', 'Set off yesterday. Still counts.', { roundStart: c => { c.g.score = Math.floor(c.g.target * 0.1); } });
J('Warm-Up', 1, '🧣', 'The first hand you are dealt each round has 2 extra cards.', 'Stretches first. Arrives with more than everyone else.', { firstDraw: c => FH.drawHand(c.g, 2) });
J('Extra Innings', 2, '⚾', 'Once per round, reaching half the target without beating it gives you +1 hand.', 'Tied at the half. Play on.', { after: (c, s) => { const g = c.g; if (g.score >= g.target / 2 && g.score < g.target && once(c, s, 'xi')) { g.handsLeft++; c.msg('+1 hand'); } } });
J('Refund', 1, '↩', 'Your first discard of every round is free.', 'Did not like it. Sent it back. Kept the money.', { flags: ['freeFirst'] });
J('Overdraw', 2, '🏧', 'Each discard gives +1 hand size for the rest of the round, up to +2.', 'Takes out slightly more than he put in.', { onDiscard: c => { if (c.g.round.extraSize < 2) c.g.round.extraSize++; } });
J('Smoke Bomb', 1, '💣', 'Sell this during a Boss Blind to cancel the boss’s ability.', 'Drop it, cough once, and be somewhere else.', { sold: c => { const g = c.g; if (g.phase === 'play' && g.blindIdx === 2) { g.bossOff = true; g.jokers.forEach(x => { x.disabled = false; }); g.hand.forEach(k => { k.faceDown = false; }); c.msg('Boss cancelled'); } } });
J('Safety Net', 2, '🕸', 'If you fail a blind with at least half its target, you survive. The net is then destroyed.', 'It only has to work once.', { rescue: (c, s) => { if (c.g.score >= c.g.target / 2) { c.kill(s, 'Caught you!'); return true; } return false; } });
J('Favoritism', 2, '🥰', 'Your most played hand type counts as 2 levels higher.', 'Everyone has a favourite. He is just honest about it.', { flags: ['fav2'] });
J('Tutor', 2, '🍏', 'After each hand, 1 in 4 chance to raise the level of the hand type you played.', 'An apple a day, and occasionally a breakthrough.', { after: c => { if (c.chance(1, 4)) c.level(c.type); } });
J("Devil's Advocate", 2, '😈', 'Your first discard each round raises the level of the hand type it contains.', 'Argues for the cards you threw away.', { onDiscard: c => { if (c.firstDiscard) c.level(FH.evaluate(c.g, c.discarded).type); } });
J('Equalizer', 2, '🎚', 'When you beat a Boss Blind, your lowest-level hand type gains 3 levels.', 'Turns up whatever nobody has been listening to.', { roundEnd: c => { if (!c.boss) return; const g = c.g; const t = FH.HAND_IDS.filter(h => !FH.HANDS[h].secret || g.typeCounts[h] > 0).sort((a, b) => g.levels[a] - g.levels[b])[0]; c.level(t, 3); } });

/* ---------- making consumables ---------- */
J('Fortune Cookie', 1, '🥠', 'Creates a random Charm when you start a blind. Needs an empty slot.', 'You will come into a small and specific blessing.', { roundStart: c => { c.create('charm'); } });
J('Lobbyist', 2, '💼', 'Beat a blind without discarding and he creates the Decree for your most played hand. Needs an empty slot.', 'Knows which door to knock on and what to bring.', { roundEnd: c => { const t = FH.mostPlayed(c.g); if (c.g.round.discards === 0 && t) c.create('decree', 'decree_' + t); } });
J('Cultist', 2, '🐐', 'Creates a random Rite when you beat a Boss Blind. Needs an empty slot.', 'The big ones always leave something behind.', { roundEnd: c => { if (c.boss) c.create('rite'); } });
J('Table-Rapper', 2, '👻', 'Creates a random Rite when you play a hand containing Four of a Kind. Needs an empty slot.', 'Four knocks. Something knocks back.', { after: c => { if (c.has('four')) c.create('rite'); } });
J('Hat Trick', 1, '⚽', 'When you play a hand containing Three of a Kind, 1 in 2 chance to create a random Charm. Needs an empty slot.', 'Three in a row and the crowd throws things. Nice things.', { after: c => { if (c.has('three') && c.chance(1, 2)) c.create('charm'); } });
J('Souvenir', 1, '🎁', 'Selling a Joker creates a random Charm. Needs an empty slot.', 'Something to remember them by.', { sell: (c, s, x) => { if (x.def && x.def.rarity) c.create('charm'); } });
J('Perpetual Motion', 2, '♻', 'Each consumable you use has a 1 in 4 chance not to be used up.', 'It should not work. Do not look at it too closely.', { flags: ['consKeep'] });
J('Sommelier', 2, '🍷', 'Creates a random Decree each time you enter the shop. Needs an empty slot.', 'Recommends something from the cellar, already opened.', { shopEnter: c => { c.create('decree'); } });
J('Black Market', 2, '🏴', 'Rites turn up in the shop three times as often.', 'Round the back. Ask for nobody.', { flags: ['moreRites'] });
J('Connoisseur', 2, '🧐', 'Rare Jokers turn up in the shop three times as often.', 'Only the good ones, and only the ones nobody has heard of.', { flags: ['moreRares'] });
J('Regular', 1, '☕', 'The first Joker on the shop shelf is always Uncommon or better.', 'They start making his order when he walks in.', { flags: ['firstUncommon'] });

/* ---------- changing the deck ---------- */
J('Marble Run', 1, '🔘', 'Adds a Granite card to your deck when you start a blind.', 'Another one rolls down the chute every night.', { roundStart: c => c.add(FH.makeCard(2, 'S', { enh: 'granite' }), 'draw') });
J('Mirror Twin', 3, '👭', 'If the first hand of a round is a single card, a permanent copy of it is added to your hand.', 'Step up alone and there are suddenly two of you.', { before: c => { if (c.first && c.played.length === 1) { c.add(FH.cloneCard(c.played[0]), 'hand'); c.msg('Copied'); } } });
J('Printer', 3, '🖨', 'Playing a hand containing Four of a Kind adds a copy of one of the four to your deck.', 'Four was already suspicious. Now there are five.', { after: c => { if (c.has('four') && c.scoring[0]) c.add(FH.cloneCard(c.scoring[0]), 'draw'); } });
J('Trim', 2, '💈', 'At end of round, destroys the lowest-ranked card left in your hand.', 'Just a little off the bottom.', { roundEnd: c => { const low = c.g.hand.filter(k => rk(k)).sort((a, b) => a.rank - b.rank)[0]; if (low) c.destroy(low); } });
J('Stowaway', 2, '🚢', 'Adds a random card with a random stamp to your hand when you start a blind.', 'Found in the luggage with papers nobody can read.', { firstDraw: c => c.add(FH.randomCard(c.g, { stamp: FH.pick(c.g, Object.keys(FH.STAMP)) }), 'hand') });
J('Dyer', 1, '🧶', 'On your first discard each round, every discarded card takes the suit of the leftmost one.', 'One vat, one colour, everything in.', { onDiscard: c => { const d = c.discarded.filter(k => rk(k)); if (c.firstDiscard && d.length > 1) d.forEach(k => { k.suit = d[0].suit; }); } });
J('Glazier', 1, '🔎', 'A random plain card in your deck becomes Brittle when you start a blind.', 'Replaces things with glass and calls it an improvement.', { roundStart: c => { const p = c.g.deck.filter(k => !k.enh); if (p.length) FH.pick(c.g, p).enh = 'brittle'; } });
J('Anvil', 2, '🛠', 'When you play a hand containing a Full House, a random plain card left in your hand becomes Iron.', 'A full house makes a lot of noise. Something gets forged.', { after: c => { const p = c.g.hand.filter(k => !k.enh); if (c.has('full') && p.length) { FH.pick(c.g, p).enh = 'iron'; c.msg('Forged'); } } });
J('Burn Notice', 2, '📄', 'Each card you discard has a 1 in 8 chance to be destroyed.', 'Officially, that card never existed.', { onDiscard: c => c.discarded.forEach(k => { if (c.chance(1, 8)) c.destroy(k); }) });
J('Recycler', 1, '🚮', 'The cards from your first discard each round are shuffled back into the draw pile.', 'It is not rubbish if you fully intend to use it.', { onDiscard: c => { if (c.firstDiscard) c.returnToDraw = true; } });
J('Cuckoo', 1, '🐦', 'At end of round, one random card in your deck becomes a copy of another random card.', 'Lays its egg in somebody else’s rank and suit.', { roundEnd: c => { const d = c.g.deck; if (d.length < 2) return; const [a, b] = FH.sample(c.g, d, 2); Object.assign(a, { rank: b.rank, suit: b.suit, enh: b.enh, stamp: b.stamp, fin: b.fin }); } });
J('Phoenix', 3, '🐓', 'The first card destroyed each round returns to your deck with a random enhancement.', 'Burns down nightly. Reopens under new management.', { cardDestroyed: (c, s, k) => { if (c.g.phase === 'play' && once(c, s, 'px')) { const n = FH.cloneCard(k); n.enh = FH.pick(c.g, ENHS); c.add(n, 'draw'); c.msg('Reborn'); } } });

/* ---------- jokers that act on other jokers ---------- */
J('Understudy', 3, '🎙', 'Copies the ability of the Joker to its right.', 'Knows every line of the part next door.', { copy: (g, s) => g.jokers[g.jokers.indexOf(s) + 1] || null });
J('Method Actor', 2, '🎞', 'Each round, becomes a copy of a random Common Joker. (Now playing: #sn#)', 'Has not been himself in years.', {
  v: { id: '', sv: {}, sn: 'nobody yet' },
  roll: (c, s) => { const pool = FH.JLIST.filter(d => d.rarity === 1 && !d.mods && !d.flags && !d.copy && d.id !== 'method_actor'); const d = FH.pick(c.g, pool); s.v.id = d.id; s.v.sn = d.name; s.v.sv = d.v ? JSON.parse(JSON.stringify(d.v)) : {}; s.sub = null; },
  copy: (g, s) => { if (!s.v.id) return null; if (!s.sub || s.sub.id !== s.v.id) s.sub = { id: s.v.id, def: FH.JOKERS[s.v.id], v: s.v.sv, uid: s.uid, sellBonus: 0, rounds: 0, fin: null }; return s.sub; },
});
J('Wingman', 3, '🦜', 'The Jokers on either side of this one trigger their end-of-hand effect 1 extra time.', 'Makes whoever he is standing next to look good.', { wing: true });
J('Usurper', 3, '🗡', 'When you start a blind, destroys the Joker to its right and permanently gains ×0.5 Mult. (Now ×#x# Mult)', 'There is only ever room for one on the throne.', { v: { x: 1 }, roundStart: (c, s) => { const t = c.g.jokers[idx(c, s) + 1]; if (t) { FH.removeJoker(c.g, t); s.v.x += 0.5; c.msg('Deposed ' + t.def.name); } }, main: (c, s) => c.x(s.v.x) });
J('Polish', 1, '🧼', 'At end of round, every other Joker gains $1 of sell value.', 'A quick buff and they all go for more.', { roundEnd: (c, s) => c.g.jokers.forEach(x => { if (x.uid !== s.uid) x.sellBonus += 1; }) });
J('Cocoon', 2, '🐛', 'After 3 rounds, sell this to duplicate one of your other Jokers at random. (#n#/3 rounds)', 'Give it time. Something else entirely comes out.', { v: { n: 0 }, roundEnd: (c, s) => { s.v.n = Math.min(3, s.v.n + 1); }, sold: (c, s) => { const g = c.g; if (s.v.n < 3 || !g.jokers.length) return; const t = FH.pick(g, g.jokers); const d = FH.makeJoker(t.id, t.fin === 'hollow' ? null : t.fin); d.v = JSON.parse(JSON.stringify(t.v)); if (g.jokers.length < FH.jokerSlots(g)) { g.jokers.push(d); c.msg('Hatched ' + t.def.name); } } });
J('Recruiter', 2, '📢', 'When you start a blind, 1 in 3 chance to create a random Common Joker. Needs an empty slot.', 'Will sign anyone who can juggle. Or says they can.', { roundStart: c => { const g = c.g; if (g.jokers.length < FH.jokerSlots(g) && c.chance(1, 3)) { const own = g.jokers.map(x => x.id); const d = FH.pick(g, FH.JLIST.filter(x => x.rarity === 1 && !own.includes(x.id))); if (FH.addJoker(g, d.id, null, c)) c.msg('Hired ' + d.name); } } });
J('Soap Bubble', 2, '🛁', '×2.5 Mult. 1 in 6 chance to pop at the end of every round.', 'Enjoy it. Do not get attached.', { main: c => c.x(2.5), roundEnd: (c, s) => { if (c.chance(1, 6)) c.kill(s, 'Pop!'); } });
J('Chain Gang', 2, '🔗', '+8 Mult for each Joker to the left of this one.', 'Pulls harder the more there are in front.', { main: (c, s) => c.mult(8 * Math.max(0, idx(c, s))) });
J('Motley Crew', 3, '🎏', '×3 Mult if you own a Common, an Uncommon and a Rare Joker.', 'One of every sort, and they somehow get along.', { main: c => { const r = new Set(c.g.jokers.map(x => x.def.rarity)); if (r.has(1) && r.has(2) && r.has(3)) c.x(3); } });
J('Talent Scout', 2, '🔭', 'Each Joker you buy has a 1 in 3 chance to gain Sheen, Lustre or Opal.', 'Sees the shine before anyone has polished it.', { buy: (c, s, item) => { if (item.kind === 'joker' && !item.fin && c.chance(1, 3)) { item.fin = FH.pick(c.g, ['sheen', 'lustre', 'opal']); c.msg(FH.FIN[item.fin].name + '!'); } } });
J('Hype Man', 2, '🔊', '+8 Mult for each time Mult has already been multiplied this hand.', 'Louder every time something big happens.', { main: c => c.mult(8 * c.xcount) });
J('Sidekick', 2, '🦸', 'Depends on the Joker to its left: +15 Mult if it is Common, ×1.5 Mult if Uncommon, ×2 Mult if Rare or Legendary.', 'Only as good as the hero he is standing behind.', { main: (c, s) => { const t = c.g.jokers[idx(c, s) - 1]; if (!t) return; if (t.def.rarity === 1) c.mult(15); else c.x(t.def.rarity === 2 ? 1.5 : 2); } });
J('Swap Meet', 1, '🔄', 'Once per round, playing a High Card gives you +1 discard.', 'Trade one bad card for the chance at a better one.', { after: (c, s) => { if (c.type === 'high' && once(c, s, 'sm')) { c.g.discardsLeft++; c.msg('+1 discard'); } } });
J('Scrapper', 2, '🐕', 'Once per round, discarding 5 cards at once gives you +1 hand.', 'Throws everything away and comes back swinging.', { onDiscard: (c, s) => { if (c.discarded.length === 5 && once(c, s, 'sc')) { c.g.handsLeft++; c.msg('+1 hand'); } } });

/* ---------- legendaries ---------- */
J('Heckler', 4, '🍅', 'Boss Blinds have no ability.', 'No boss has ever finished a sentence with him in the room.', { flags: ['noBoss'] });
J('Lady Fortuna', 4, '🧚', 'Every listed chance always succeeds.', 'She does not roll dice. She tells them.', { flags: ['luckAll'] });
J('The Last Laugh', 4, '😂', '×Mult equal to the Ante you are on, and never less than ×2.', 'Funnier the closer you get to the end.', { main: c => c.x(Math.max(2, c.g.ante)) });
J('The Archivist', 4, '🗄', 'When you leave the shop, duplicates one of your consumables at random. Needs an empty slot.', 'Files everything in triplicate, then files the files.', { shopExit: c => { const g = c.g; if (g.cons.length && g.cons.length < FH.consSlots(g)) g.cons.push({ uid: FH.uid(), def: FH.pick(g, g.cons).def }); } });
J('Grand Fool', 4, '🃏', 'Every scored card triggers 1 extra time.', 'Tells every joke twice and both times it kills.', { retrigger: () => 1 });
J('The Mint', 4, '👑', '×1 Mult, plus ×0.2 for every $5 you hold.', 'Does not count money. Weighs it.', { main: c => c.x(1 + 0.2 * Math.floor(Math.max(0, c.g.money) / 5)) });
J('Father Time', 4, '⏳', '+1 hand, +1 discard and +1 hand size.', 'He has all the time in the world, and lends you some.', { mods: { hands: 1, discards: 1, handSize: 1 } });
})();
