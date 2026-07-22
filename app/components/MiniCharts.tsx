// Self-contained, dependency-free SVG charts for the analytics page. They read the
// explorer's CSS design tokens (var(--color-primary), gray/ink tokens) so they follow
// light/dark mode automatically. One sequential hue (primary) per the house style.
import React, { useId, useState } from "react";

const PRIMARY = "var(--color-primary)";
const INK = "var(--color-gray-500)";
const GRID = "var(--color-gray-100)";

export interface Pt {
  x: number;
  y: number;
}

interface Annotation {
  x: number;
  y: number;
  text: string;
  align?: "start" | "middle" | "end";
  dy?: number;
}

interface AreaChartProps {
  data: Pt[];
  height?: number;
  yTicks?: number;
  xTicks?: number[];
  formatX?: (x: number) => string;
  formatY?: (y: number) => string;
  yMax?: number;
  annotations?: Annotation[];
  marker?: { x: number; y: number; label: string };
  ariaLabel: string;
}

// Line + soft area fill with a hover crosshair + tooltip. viewBox-scaled so it is
// fully responsive; the parent just needs a width.
export function AreaChart({
  data,
  height = 300,
  yTicks = 4,
  xTicks,
  formatX = (x) => String(x),
  formatY = (y) => String(y),
  yMax,
  annotations = [],
  marker,
  ariaLabel,
}: AreaChartProps) {
  const gid = useId().replace(/:/g, "");
  const W = 760;
  const H = height;
  const m = { top: 22, right: 26, bottom: 34, left: 56 };
  const iw = W - m.left - m.right;
  const ih = H - m.top - m.bottom;

  const xs = data.map((d) => d.x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  const yTop = yMax ?? Math.max(...data.map((d) => d.y)) * 1.08;

  const sx = (x: number) => m.left + ((x - xMin) / (xMax - xMin || 1)) * iw;
  const sy = (y: number) => m.top + ih - (y / (yTop || 1)) * ih;

  const line = data.map((d, i) => `${i ? "L" : "M"}${sx(d.x).toFixed(1)},${sy(d.y).toFixed(1)}`).join(" ");
  const area = `${line} L${sx(xMax).toFixed(1)},${sy(0).toFixed(1)} L${sx(xMin).toFixed(1)},${sy(0).toFixed(1)} Z`;

  const yGrid = Array.from({ length: yTicks + 1 }, (_, i) => (yTop / yTicks) * i);
  const xt = xTicks ?? Array.from({ length: 5 }, (_, i) => xMin + ((xMax - xMin) / 4) * i);

  const [hover, setHover] = useState<number | null>(null);
  const onMove = (e: React.MouseEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const xv = xMin + ((px - m.left) / iw) * (xMax - xMin);
    let idx = 0;
    let best = Infinity;
    data.forEach((d, i) => {
      const dd = Math.abs(d.x - xv);
      if (dd < best) {
        best = dd;
        idx = i;
      }
    });
    setHover(idx);
  };

  const hp = hover != null ? data[hover] : null;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={ariaLabel}>
      <defs>
        <linearGradient id={`fill-${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PRIMARY} stopOpacity="0.28" />
          <stop offset="100%" stopColor={PRIMARY} stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* horizontal gridlines + y labels */}
      {yGrid.map((gy, i) => (
        <g key={i}>
          <line x1={m.left} x2={W - m.right} y1={sy(gy)} y2={sy(gy)} stroke={GRID} strokeWidth={1} />
          <text x={m.left - 8} y={sy(gy) + 4} textAnchor="end" fontSize="13" fill={INK}>
            {formatY(gy)}
          </text>
        </g>
      ))}

      {/* x ticks */}
      {xt.map((tx, i) => (
        <text key={i} x={sx(tx)} y={H - 10} textAnchor="middle" fontSize="13" fill={INK}>
          {formatX(tx)}
        </text>
      ))}

      <path d={area} fill={`url(#fill-${gid})`} />
      <path d={line} fill="none" stroke={PRIMARY} strokeWidth={2.5} strokeLinejoin="round" />

      {/* annotations (direct labels for key points) */}
      {annotations.map((a, i) => (
        <g key={i}>
          <circle cx={sx(a.x)} cy={sy(a.y)} r={3.5} fill={PRIMARY} stroke="var(--color-white)" strokeWidth={1.5} />
          <text
            x={sx(a.x)}
            y={sy(a.y) + (a.dy ?? -10)}
            textAnchor={a.align ?? "middle"}
            fontSize="13"
            fontWeight={600}
            fill="var(--color-black)"
          >
            {a.text}
          </text>
        </g>
      ))}

      {/* "you are here" marker */}
      {marker && (
        <g>
          <circle cx={sx(marker.x)} cy={sy(marker.y)} r={5} fill={PRIMARY} stroke="var(--color-white)" strokeWidth={2} />
          <text x={sx(marker.x) + 8} y={sy(marker.y) - 8} fontSize="13" fontWeight={600} fill="var(--color-black)">
            {marker.label}
          </text>
        </g>
      )}

      {/* hover crosshair + tooltip */}
      {hp && (
        <g pointerEvents="none">
          <line x1={sx(hp.x)} x2={sx(hp.x)} y1={m.top} y2={m.top + ih} stroke={INK} strokeDasharray="3 3" strokeWidth={1} />
          <circle cx={sx(hp.x)} cy={sy(hp.y)} r={4} fill={PRIMARY} stroke="var(--color-white)" strokeWidth={2} />
          <g transform={`translate(${Math.min(sx(hp.x) + 10, W - 160)},${m.top + 6})`}>
            <rect width="150" height="40" rx="8" fill="var(--color-black)" opacity="0.9" />
            <text x="10" y="16" fontSize="13" fill="var(--color-white)">
              {formatX(hp.x)}
            </text>
            <text x="10" y="30" fontSize="14" fontWeight={700} fill="var(--color-white)">
              {formatY(hp.y)}
            </text>
          </g>
        </g>
      )}

      <rect
        x={m.left}
        y={m.top}
        width={iw}
        height={ih}
        fill="transparent"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      />
    </svg>
  );
}

// A single-value donut used for the "share shielded" gauge. value in [0,1].
export function Donut({ value, centerTop, centerBottom }: { value: number; centerTop: string; centerBottom: string }) {
  const size = 200;
  const r = 78;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  const filled = Math.max(0, Math.min(1, value)) * circ;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-44 h-44" role="img" aria-label={`${centerTop} ${centerBottom}`}>
      <circle cx={c} cy={c} r={r} fill="none" stroke={GRID} strokeWidth={16} />
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke={PRIMARY}
        strokeWidth={16}
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circ - filled}`}
        transform={`rotate(-90 ${c} ${c})`}
      />
      <text x={c} y={c - 4} textAnchor="middle" fontSize="30" fontWeight={700} fill="var(--color-black)">
        {centerTop}
      </text>
      <text x={c} y={c + 18} textAnchor="middle" fontSize="14" fill={INK}>
        {centerBottom}
      </text>
    </svg>
  );
}

// Two labelled horizontal bars sharing one scale (turnstile in vs out).
export function DualBar({ rows }: { rows: { label: string; value: number; display: string }[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="flex w-full flex-col gap-y-4">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-y-1">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-gray-500">{r.label}</span>
            <span className="text-black">{r.display}</span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full" style={{ background: GRID }}>
            <div
              className="h-3 rounded-full"
              style={{ width: `${(r.value / max) * 100}%`, minWidth: r.value > 0 ? 8 : 0, background: PRIMARY }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
