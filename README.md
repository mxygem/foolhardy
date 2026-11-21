# Foolhardy

A poker roguelike for the browser. Play poker hands to beat a rising score target, and hire jokers that bend the scoring in your favour.

**Play it now: <https://mxygem.github.io/foolhardy/>** — works on phones and desktops.

- 8 antes, each with a Small, a Medium and a Boss blind. Bosses change the rules against you.
- 300 jokers, each with its own behaviour, art and flavor text.
- 12 hand types that can be levelled up.
- Cards can be enhanced, stamped and given finishes.
- Consumables that level hands (Decrees), modify selected cards (Charms) and reshape the deck (Rites).

Plain JavaScript, HTML and CSS. There is no build step and nothing to install.

## Run it locally

Clone the repo:

```bash
git clone https://github.com/mxygem/foolhardy.git
```

```bash
cd foolhardy
```

Then either open `index.html` in a browser, or serve the folder and visit the address it prints:

```bash
python3 -m http.server 8765
```

With the server running, the game is at <http://127.0.0.1:8765/>.

Notes:

- An internet connection is used for the web fonts, including a colour-emoji font that the joker art falls back to. Offline, the game still runs with system fonts, but joker art needs a colour-emoji font installed.
- Add `?seed=123` to the address to replay a specific shuffle.
- Progress is not saved. Reloading the page starts a new run.

## How to play

1. Choose a blind. It sets a score you must reach.
2. Select up to 5 cards from your hand and play them as a poker hand. The hand scores its Points multiplied by its Mult. Click or tap cards to select them, or press on one and sweep across others to select several at once. The line above your hand shows what you have made, and dims any selected card that will not score.
3. You have 4 hands and 3 discards per blind. Reach the target before you run out of hands.
4. After each blind, spend your winnings in the shop on jokers and consumables.
5. Beat the Boss blind of ante 8 to win. You can then continue in endless mode.

Jokers act from left to right, so order matters: put jokers that add Mult before jokers that multiply it. Drag them to reorder, or tap one and use Move left and Move right. Hover over or tap any card or joker to see what it does.

To make everything bigger or smaller, use the − and + next to Size in the menu. The game picks a size to fit your window the first time, and remembers your choice after that.

Once cards are selected, each joker shows a badge with what it adds to that hand, and the line above your hand shows what the hand would score. Hover over or tap a joker or card for the details, including what the hand would score without that joker. Luck-based effects show a range.

To rearrange your hand, hold a card for a moment (or drag it upward) and slide it into place. Right-click the hand, press `Esc` or use Clear to deselect everything.

Keys: `1` to `9` select cards, `Enter` plays, `Backspace` discards, `Esc` clears your selection or closes a dialog.

## Run the checks

Needs [Node.js](https://nodejs.org/) (any recent version). No packages to install.

```bash
node test/check.js
```

This confirms there are exactly 300 jokers with unique names, art emblems, flavor text and behaviour, checks hand evaluation, then plays several thousand rounds with random joker combinations to catch errors.

## Project layout

| Path | What it holds |
|---|---|
| `index.html` | The page |
| `css/style.css` | All styling |
| `js/core.js` | Rules engine: scoring, hand evaluation, rounds, shop. No DOM access, so it also runs under Node |
| `js/items.js` | Decrees, Charms, Rites and boss blinds |
| `js/jokers-a.js` to `jokers-d.js` | The 300 jokers, 75 per file |
| `js/art.js` | Generates each card's art as inline SVG |
| `js/ui.js` | Rendering, input and the scoring replay |
| `test/check.js` | Data checks and the play bot |
| `HANDOFF.md` | Engine reference, the full joker roster and the list of next steps |

## Status

Playable from start to finish, but difficulty has not been tuned by hand yet. Known gaps and planned work are listed under "Next steps" in [HANDOFF.md](HANDOFF.md).
