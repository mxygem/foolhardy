/* Foolhardy — card art. Every joker gets its own picture: its own emblem on a backdrop, halo and palette derived from its name. */
(function () {
'use strict';
const FH = globalThis.FH;
const EMOJI_FONT = "'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji','Twemoji Mozilla',sans-serif";

const backdrops = [
  (c, id) => { let s = ''; for (let i = 0; i < 12; i++) { const a = (i * Math.PI) / 6, b = a + Math.PI / 12; s += `<path d="M50 56L${50 + 90 * Math.cos(a)} ${56 + 90 * Math.sin(a)}L${50 + 90 * Math.cos(b)} ${56 + 90 * Math.sin(b)}Z" fill="${c}"/>`; } return s; },
  (c, id) => `<pattern id="p${id}" width="20" height="28" patternUnits="userSpaceOnUse"><path d="M10 0L20 14L10 28L0 14Z" fill="${c}"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  (c, id) => `<pattern id="p${id}" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(38)"><rect width="7" height="14" fill="${c}"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  (c, id) => `<pattern id="p${id}" width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="6" cy="6" r="2.6" fill="${c}"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  (c, id) => `<pattern id="p${id}" width="24" height="24" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="${c}"/><rect x="12" y="12" width="12" height="12" fill="${c}"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  c => [46, 36, 26, 16].map(r => `<circle cx="50" cy="52" r="${r + 22}" fill="none" stroke="${c}" stroke-width="5"/>`).join(''),
  (c, id) => `<pattern id="p${id}" width="20" height="12" patternUnits="userSpaceOnUse"><path d="M0 9L10 3L20 9" fill="none" stroke="${c}" stroke-width="3"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  (c, id) => `<pattern id="p${id}" width="20" height="14" patternUnits="userSpaceOnUse"><circle cx="10" cy="14" r="9" fill="none" stroke="${c}" stroke-width="2.5"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  (c, id) => `<pattern id="p${id}" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0H12M0 0V12" stroke="${c}" stroke-width="2.4"/></pattern><rect width="100" height="100" fill="url(#p${id})"/>`,
  (c, id, h) => { let s = ''; for (let i = 0; i < 14; i++) { const x = (h >> (i % 13)) % 100, y = ((h >> ((i + 5) % 17)) * 7) % 100, r = 1.5 + (i % 3); s += `<path d="M${x} ${y - r * 2}L${x + r * 0.6} ${y - r * 0.6}L${x + r * 2} ${y}L${x + r * 0.6} ${y + r * 0.6}L${x} ${y + r * 2}L${x - r * 0.6} ${y + r * 0.6}L${x - r * 2} ${y}L${x - r * 0.6} ${y - r * 0.6}Z" fill="${c}"/>`; } return s; },
];
const halos = [
  () => '<circle cx="50" cy="52" r="33"/>',
  () => '<path d="M50 14L86 52L50 90L14 52Z"/>',
  () => '<path d="M20 90V46a30 30 0 0 1 60 0V90Z"/>',
  () => { let d = ''; for (let i = 0; i < 32; i++) { const a = (i * Math.PI) / 16, r = i % 2 ? 29 : 38; d += `${i ? 'L' : 'M'}${50 + r * Math.cos(a)} ${52 + r * Math.sin(a)}`; } return `<path d="${d}Z"/>`; },
  () => '<path d="M50 15L82 33.5V70.5L50 89L18 70.5V33.5Z"/>',
  () => '<path d="M18 20H82V56C82 74 66 86 50 91C34 86 18 74 18 56Z"/>',
  () => '<ellipse cx="50" cy="52" rx="38" ry="30"/>',
  () => '<path d="M14 26H86V42a10 10 0 0 0 0 20V78H14V62a10 10 0 0 0 0-20Z"/>',
];

FH.art = def => {
  const h = FH.hash(def.id), hue = h % 360, id = def.id;
  const bg1 = `hsl(${hue} 52% 20%)`, bg2 = `hsl(${(hue + 38) % 360} 58% 38%)`, pat = `hsl(${(hue + 38) % 360} 65% 58%)`;
  const hf = `hsl(${(hue + 180) % 360} 78% 82%)`, hs = `hsl(${(hue + 180) % 360} 55% 42%)`;
  const back = backdrops[(h >>> 4) % backdrops.length](pat, id, h);
  const halo = halos[(h >>> 9) % halos.length]();
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${def.name}"><defs><linearGradient id="g${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${bg2}"/><stop offset="1" stop-color="${bg1}"/></linearGradient></defs><rect width="100" height="100" fill="url(#g${id})"/><g opacity=".34">${back}</g><g fill="${hf}" stroke="${hs}" stroke-width="2.5" stroke-linejoin="round">${halo}</g><ellipse cx="50" cy="80" rx="19" ry="3.5" fill="${hs}" opacity=".45"/><text x="50" y="54" font-size="42" text-anchor="middle" dominant-baseline="central" font-family="${EMOJI_FONT}">${def.emoji}</text></svg>`;
};

const KIND = {
  decree: { bg: '#F1DFA9', ink: '#8C2F39', draw: '<path d="M12 18H88V82H12Z" fill="#FBF3DC" stroke="#8C2F39" stroke-width="2"/><path d="M12 26H88M12 74H88" stroke="#8C2F39" stroke-width="1.2"/><circle cx="74" cy="76" r="9" fill="#8C2F39"/>' },
  charm: { bg: '#1F6F78', ink: '#BDF2E4', draw: '<circle cx="50" cy="52" r="34" fill="#134E57" stroke="#BDF2E4" stroke-width="2" stroke-dasharray="3 4"/><circle cx="50" cy="52" r="26" fill="#2A8C93"/>' },
  rite: { bg: '#1B1030', ink: '#C7A6FF', draw: '<path d="M50 12L84 76H16Z" fill="#33205C" stroke="#C7A6FF" stroke-width="2"/><circle cx="50" cy="56" r="20" fill="#1B1030" stroke="#C7A6FF" stroke-width="1.5"/><circle cx="20" cy="20" r="1.6" fill="#C7A6FF"/><circle cx="82" cy="28" r="1.2" fill="#C7A6FF"/><circle cx="76" cy="90" r="1.6" fill="#C7A6FF"/><circle cx="12" cy="60" r="1.2" fill="#C7A6FF"/>' },
};
FH.consArt = def => {
  const k = KIND[def.kind];
  return `<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${def.name}"><rect width="100" height="100" fill="${k.bg}"/>${k.draw}<text x="50" y="${def.kind === 'rite' ? 58 : 53}" font-size="${def.kind === 'rite' ? 24 : 34}" text-anchor="middle" dominant-baseline="central" font-family="${EMOJI_FONT}">${def.emoji}</text></svg>`;
};
})();
