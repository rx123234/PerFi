import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import type { YearlyProjection } from "@/lib/types";

interface ProjectionChartProps {
  data: YearlyProjection[];
  retirementAge: number;
}

function formatYAxis(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  if (value === 0) return "$0";
  return `$${value}`;
}

function formatTooltipCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// ComposedChart strategy: use Area components with the same stackId
// to build fan bands from p10 upward, then overlay a Line for the median.
// Each "area" dataKey represents the increment over the previous percentile.

interface BandRow {
  age: number;
  p10: number;
  inc_p25: number; // p25 - p10
  inc_p50: number; // p50 - p25
  inc_p75: number; // p75 - p50
  inc_p90: number; // p90 - p75
  // Raw values for tooltip
  _p10: number;
  _p25: number;
  _p50: number;
  _p75: number;
  _p90: number;
}

function buildBands(data: YearlyProjection[]): BandRow[] {
  return data.map((d) => ({
    age: d.age,
    p10: d.p10,
    inc_p25: Math.max(0, d.p25 - d.p10),
    inc_p50: Math.max(0, d.p50 - d.p25),
    inc_p75: Math.max(0, d.p75 - d.p50),
    inc_p90: Math.max(0, d.p90 - d.p75),
    _p10: d.p10,
    _p25: d.p25,
    _p50: d.p50,
    _p75: d.p75,
    _p90: d.p90,
  }));
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: BandRow }>;
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;

  const rows = [
    { label: "90th percentile", value: d._p90, color: "#6EE7B7" },
    { label: "75th percentile", value: d._p75, color: "#A7F3D0" },
    { label: "Median (p50)", value: d._p50, color: "#6366F1", bold: true },
    { label: "25th percentile", value: d._p25, color: "#FDE68A" },
    { label: "10th percentile", value: d._p10, color: "#FECACA" },
  ];

  return (
    <div className="rounded-xl border border-border bg-card shadow-xl p-3 min-w-[190px]">
      <p className="text-sm font-semibold text-foreground mb-2">Age {label}</p>
      <div className="space-y-1.5">
        {rows.map(({ label: l, value, color, bold }) => (
          <div key={l} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: color }}
              />
              <span className={bold ? "font-semibold text-foreground" : "text-muted-foreground"}>
                {l}
              </span>
            </span>
            <span className={bold ? "font-bold text-foreground" : "text-foreground"}>
              {formatTooltipCurrency(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main chart ───────────────────────────────────────────────────────────────

export default function ProjectionChart({ data, retirementAge }: ProjectionChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No projection data available
      </div>
    );
  }

  const bands = buildBands(data);

  // Domain for Y axis: span from 0 to max p90
  const maxVal = Math.max(...data.map((d) => d.p90));
  const yDomain = [0, Math.ceil(maxVal * 1.05)];

  return (
    <div className="w-full space-y-3">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-0.5 bg-[#6366F1]" style={{ height: 2 }} />
          Median (p50)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 h-3 rounded-sm" style={{ background: "linear-gradient(135deg, #FECACA 0%, #A7F3D0 50%, #6EE7B7 100%)", opacity: 0.8 }} />
          Percentile bands (p10–p90)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-5 border-t-2 border-dashed border-[#6366F1] opacity-60" />
          Retirement age
        </span>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={bands} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
          <defs>
            {/* Subtle gradient fills for each band */}
            <linearGradient id="fillP10" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FECACA" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#FEE2E2" stopOpacity={0.15} />
            </linearGradient>
            <linearGradient id="fillInc25" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FDE68A" stopOpacity={0.55} />
              <stop offset="95%" stopColor="#FEF3C7" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="fillInc50" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#A7F3D0" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#D1FAE5" stopOpacity={0.25} />
            </linearGradient>
            <linearGradient id="fillInc75" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6EE7B7" stopOpacity={0.65} />
              <stop offset="95%" stopColor="#A7F3D0" stopOpacity={0.3} />
            </linearGradient>
            <linearGradient id="fillInc90" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#34D399" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#6EE7B7" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            strokeOpacity={0.4}
            vertical={false}
          />

          <XAxis
            dataKey="age"
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--color-border)", strokeOpacity: 0.5 }}
          />

          <YAxis
            tickFormatter={formatYAxis}
            tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            domain={yDomain}
            width={58}
          />

          <Tooltip
            content={<CustomTooltip />}
            cursor={{ stroke: "var(--color-border)", strokeWidth: 1, strokeDasharray: "3 3" }}
          />

          {/* Retirement age vertical reference */}
          <ReferenceLine
            x={retirementAge}
            stroke="#6366F1"
            strokeDasharray="5 3"
            strokeWidth={1.5}
            strokeOpacity={0.7}
            label={{
              value: "Retire",
              position: "insideTopRight",
              fontSize: 10,
              fill: "#6366F1",
              fontWeight: 600,
              dy: -4,
            }}
          />

          {/* Zero baseline */}
          <ReferenceLine y={0} stroke="var(--color-border)" strokeOpacity={0.6} />

          {/* Stacked fan bands — bottom layer first */}
          <Area
            type="monotone"
            dataKey="p10"
            stackId="fan"
            stroke="none"
            fill="url(#fillP10)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={600}
          />
          <Area
            type="monotone"
            dataKey="inc_p25"
            stackId="fan"
            stroke="none"
            fill="url(#fillInc25)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={700}
          />
          <Area
            type="monotone"
            dataKey="inc_p50"
            stackId="fan"
            stroke="none"
            fill="url(#fillInc50)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={800}
          />
          <Area
            type="monotone"
            dataKey="inc_p75"
            stackId="fan"
            stroke="none"
            fill="url(#fillInc75)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={900}
          />
          <Area
            type="monotone"
            dataKey="inc_p90"
            stackId="fan"
            stroke="none"
            fill="url(#fillInc90)"
            fillOpacity={1}
            isAnimationActive
            animationDuration={1000}
          />

          {/* Median line — drawn on top of the fan */}
          <Line
            type="monotone"
            dataKey="_p50"
            stroke="#6366F1"
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4, fill: "#6366F1", stroke: "var(--color-background)", strokeWidth: 2 }}
            isAnimationActive
            animationDuration={1000}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
