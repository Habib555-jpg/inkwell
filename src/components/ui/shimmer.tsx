/**
 * A light that travels around the edge of a gradient button or link
 * (adapted from 21st.dev "Shimmer Button" by dillionverma / Magic UI).
 * Drop it inside any `relative z-0 overflow-hidden bg-brand` element: the blurred conic spark runs behind an
 * inset copy of the brand gradient, so only a hairline of it shows at the perimeter.
 */
export function Shimmer({ duration = '3s' }: { duration?: string }) {
  return (
    <>
      <span aria-hidden className="absolute inset-0 -z-30 overflow-visible blur-[2px] [container-type:size]" style={{ ['--speed' as string]: duration }}>
        <span className="absolute inset-0 aspect-square h-[100cqh] animate-shimmer-slide">
          <span className="absolute -inset-full animate-spin-around [background:conic-gradient(from_calc(270deg-45deg),transparent_0,rgb(255_255_255/0.95)_90deg,transparent_90deg)]" />
        </span>
      </span>
      <span aria-hidden className="bg-brand absolute inset-[1.5px] -z-20 rounded-[inherit]" />
    </>
  );
}
