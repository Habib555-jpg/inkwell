import type { CSSProperties } from 'react';

// Embers rise mostly along the edges, where the colour is. Fixed values (not random) so server and client agree.
const EMBERS: { left: string; d: string; delay: string; sway: string }[] = [
  { left: '4%', d: '26s', delay: '-3s', sway: '2vw' }, { left: '11%', d: '34s', delay: '-17s', sway: '-1.5vw' },
  { left: '17%', d: '29s', delay: '-9s', sway: '1vw' }, { left: '23%', d: '38s', delay: '-26s', sway: '-2vw' },
  { left: '71%', d: '31s', delay: '-12s', sway: '-1vw' }, { left: '78%', d: '27s', delay: '-21s', sway: '1.5vw' },
  { left: '84%', d: '36s', delay: '-5s', sway: '-2vw' }, { left: '91%', d: '30s', delay: '-15s', sway: '1vw' },
  { left: '96%', d: '40s', delay: '-31s', sway: '-1.5vw' },
];

/** Four-point star (the reference's sparkle glyph). */
const Star = ({ x, y, r, tw }: { x: number; y: number; r: number; tw: string }) => (
  <path className="ambient-star" style={{ '--tw': tw } as CSSProperties} fill="currentColor"
    d={`M${x} ${y - r} Q${x + r * 0.16} ${y - r * 0.16} ${x + r} ${y} Q${x + r * 0.16} ${y + r * 0.16} ${x} ${y + r} Q${x - r * 0.16} ${y + r * 0.16} ${x - r} ${y} Q${x - r * 0.16} ${y - r * 0.16} ${x} ${y - r}Z`} />
);

/**
 * The app's atmosphere, after the reference art: amber, violet, ember-red and dusk glows with a drifting nebula
 * texture, rising embers, faint gold linework and film grain. Pure CSS/SVG (`.ambient` in globals.css) — a server
 * component that ships no JavaScript. Rendered once in the root layout, fixed behind every page, never interactive.
 */
export function AmbientBackground() {
  return (
    <div className="ambient" aria-hidden>
      <span className="ambient-orb ambient-orb--amber" />
      <span className="ambient-orb ambient-orb--cream" />
      <span className="ambient-orb ambient-orb--violet" />
      <span className="ambient-orb ambient-orb--ember" />
      <span className="ambient-orb ambient-orb--dusk" />
      <span className="ambient-clouds" />
      <span className="ambient-calm" />
      <svg className="ambient-ornaments" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle cx="-40" cy="560" r="330" strokeOpacity="0.7" />
        <circle cx="70" cy="1020" r="260" strokeOpacity="0.5" />
        <circle cx="1620" cy="30" r="230" strokeOpacity="0.6" />
        <circle cx="1540" cy="930" r="150" strokeOpacity="0.45" />
        <path d="M55 70V360M55 420V520M1545 60V250M1545 640V820" strokeOpacity="0.55" />
        <g stroke="none">
          <Star x={55} y={42} r={16} tw="11s" />
          <Star x={55} y={392} r={6} tw="8s" />
          <Star x={1545} y={272} r={8} tw="13s" />
          <Star x={1545} y={30} r={5} tw="9s" />
          <Star x={55} y={760} r={7} tw="10s" />
          <Star x={1545} y={612} r={6} tw="12s" />
        </g>
      </svg>
      {EMBERS.map((e) => (
        <span key={e.left} className="ambient-ember" style={{ left: e.left, '--d': e.d, '--delay': e.delay, '--sway': e.sway } as CSSProperties} />
      ))}
      <span className="ambient-grain" />
    </div>
  );
}
