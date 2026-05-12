import React from "react";

// Inline SVG version of the Scopic crosshair. Drawn from scratch so it
// renders crisp at any size and follows currentColor.
//
// Composition (viewBox 0 0 100 100, center 50,50):
//   - Outer dashed ring, broken into four 60° arcs at the compass quadrants
//   - Center solid dot
//   - Vertical reticle line with pointed tips
//   - One short inner arc indicator (top-right quadrant)
export default function ScopicLogo({ size = 32, className = "", color = "currentColor", title }) {
  const stroke = color;
  const r = 36; // outer ring radius
  const ri = 22; // inner ring radius
  const cx = 50;
  const cy = 50;

  // Four arcs of the outer ring (skipping the cross-quadrant gaps).
  // Each arc spans ~60° centered between quadrants.
  const arcs = [
    [195, 255], // bottom-left
    [285, 345], // bottom-right
    [15, 75],   // top-right
    [105, 165], // top-left
  ];

  const toXY = (rad, angleDeg) => {
    const a = (angleDeg * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };

  const arcPath = (rad, a1, a2) => {
    const [x1, y1] = toXY(rad, a1);
    const [x2, y2] = toXY(rad, a2);
    const large = a2 - a1 > 180 ? 1 : 0;
    return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${rad} ${rad} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };

  const strokeW = 5.5;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      stroke={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
    >
      {title ? <title>{title}</title> : null}
      {/* Outer ring as four arcs */}
      {arcs.map(([a, b], i) => (
        <path key={i} d={arcPath(r, a, b)} strokeWidth={strokeW} />
      ))}
      {/* Inner indicator arc (upper-right) */}
      <path d={arcPath(ri, 305, 35)} strokeWidth={strokeW * 0.7} />
      {/* Vertical reticle, with pointed tips */}
      <line x1={cx} y1={10} x2={cx} y2={36} strokeWidth={strokeW} />
      <line x1={cx} y1={64} x2={cx} y2={90} strokeWidth={strokeW} />
      <polyline points={`${cx - 3},14 ${cx},9 ${cx + 3},14`} strokeWidth={strokeW * 0.7} />
      <polyline points={`${cx - 3},86 ${cx},91 ${cx + 3},86`} strokeWidth={strokeW * 0.7} />
      {/* Center dot */}
      <circle cx={cx} cy={cy} r={5.5} fill={stroke} stroke="none" />
    </svg>
  );
}
