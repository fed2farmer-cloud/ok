/** Pure-SVG portfolio charts — no external charting library required */

interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  slices: DonutSlice[];
  title?: string;
  centerLabel?: string;
  centerValue?: string;
  size?: number;
}

export function DonutChart({
  slices,
  title,
  centerLabel,
  centerValue,
  size = 180,
}: DonutChartProps) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-2">
        {title && <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>}
        <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-slate-100">
          <p className="text-sm text-slate-400">No data</p>
        </div>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.38;
  const inner = size * 0.22;

  let cumulativeAngle = -90;
  const paths: { d: string; color: string; label: string; value: number }[] = [];

  for (const slice of slices) {
    const pct = slice.value / total;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + pct * 360;
    cumulativeAngle = endAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1 = cx + radius * Math.cos(startRad);
    const y1 = cy + radius * Math.sin(startRad);
    const x2 = cx + radius * Math.cos(endRad);
    const y2 = cy + radius * Math.sin(endRad);
    const xi1 = cx + inner * Math.cos(startRad);
    const yi1 = cy + inner * Math.sin(startRad);
    const xi2 = cx + inner * Math.cos(endRad);
    const yi2 = cy + inner * Math.sin(endRad);

    const largeArc = pct > 0.5 ? 1 : 0;

    const d = [
      `M ${x1} ${y1}`,
      `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${xi2} ${yi2}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${xi1} ${yi1}`,
      "Z",
    ].join(" ");

    paths.push({ d, color: slice.color, label: slice.label, value: slice.value });
  }

  const fmt = (n: number) =>
    n >= 1_000_000
      ? `$${(n / 1_000_000).toFixed(1)}M`
      : n >= 1_000
      ? `$${(n / 1_000).toFixed(0)}K`
      : `$${n.toFixed(0)}`;

  return (
    <div className="flex flex-col items-center gap-4">
      {title && (
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size}>
          {paths.map((p, i) => (
            <path key={i} d={p.d} fill={p.color} opacity={0.9} />
          ))}
          {/* Center text */}
          {centerValue && (
            <text
              x={cx}
              y={cy - 6}
              textAnchor="middle"
              className="font-black"
              fill="#0f172a"
              fontSize={size * 0.1}
              fontWeight="900"
            >
              {centerValue}
            </text>
          )}
          {centerLabel && (
            <text
              x={cx}
              y={cy + size * 0.075}
              textAnchor="middle"
              fill="#64748b"
              fontSize={size * 0.07}
            >
              {centerLabel}
            </text>
          )}
        </svg>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-3">
        {slices.map((sl) => (
          <div key={sl.label} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full" style={{ background: sl.color }} />
            <span className="text-xs text-slate-600">
              {sl.label} <span className="font-semibold text-slate-800">{fmt(sl.value)}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarDataPoint[];
  title?: string;
  height?: number;
  valueFormatter?: (v: number) => string;
}

export function BarChart({
  data,
  title,
  height = 160,
  valueFormatter,
}: BarChartProps) {
  const fmt =
    valueFormatter ??
    ((n: number) =>
      n >= 1_000_000
        ? `$${(n / 1_000_000).toFixed(1)}M`
        : n >= 1_000
        ? `$${(n / 1_000).toFixed(0)}K`
        : `$${n.toFixed(0)}`);

  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="w-full">
      {title && (
        <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      )}
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((d, i) => {
          const pct = (d.value / max) * 100;
          return (
            <div key={i} className="group relative flex flex-1 flex-col items-center gap-1">
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden rounded bg-slate-900 px-2 py-1 text-xs text-white group-hover:block">
                {fmt(d.value)}
              </div>
              <div
                className="w-full rounded-t-md transition-all"
                style={{
                  height: `${Math.max(pct, 3)}%`,
                  background: d.color ?? "#4da855",
                  opacity: 0.85,
                }}
              />
              <span className="mt-1 text-center text-[10px] text-slate-500 leading-tight">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface SparklineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

export function Sparkline({ data, color = "#4da855", width = 120, height = 40 }: SparklineProps) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data
    .map((v, i) => {
      const x = i * stepX;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
