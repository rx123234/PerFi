import {
  Area,
  Line,
  ComposedChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { NetWorthSnapshot } from "@/lib/types";

interface Props {
  data: NetWorthSnapshot[];
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "10px",
  color: "var(--popover-foreground)",
  fontSize: "13px",
  padding: "10px 14px",
  boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
} as const;

const fmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatYAxis(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${value}`;
}

interface TooltipPayload {
  name: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  label?: string;
  payload?: TooltipPayload[];
}

function CustomTooltip({ active, label, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const order = ["Net Worth", "Assets", "Liabilities"];
  const sorted = [...payload].sort(
    (a, b) => order.indexOf(a.name) - order.indexOf(b.name)
  );

  return (
    <div style={TOOLTIP_STYLE}>
      <p className="font-semibold text-foreground mb-2 text-xs uppercase tracking-wide opacity-60">
        {label}
      </p>
      {sorted.map((item) => (
        <div key={item.name} className="flex items-center justify-between gap-6 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {item.name}
          </span>
          <span className="font-semibold tabular-nums" style={{ color: item.color }}>
            {fmt.format(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function NetWorthChart({ data }: Props) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center"
          style={{ background: "var(--muted)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--muted-foreground)" strokeWidth="1.5">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p className="text-muted-foreground text-sm">No history yet</p>
        <p className="text-muted-foreground text-xs opacity-60">Take a snapshot to start tracking your net worth over time</p>
      </div>
    );
  }

  const chartData = data.map((snap) => ({
    date: format(parseISO(snap.snapshot_date), "MMM yyyy"),
    assets: snap.total_assets_cents / 100,
    liabilities: snap.total_liabilities_cents / 100,
    netWorth: snap.net_worth_cents / 100,
  }));

  const hasNegative = chartData.some((d) => d.netWorth < 0);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="assetGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4CAF50" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#4CAF50" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="liabilityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#F44336" stopOpacity={0.12} />
            <stop offset="95%" stopColor="#F44336" stopOpacity={0.02} />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="var(--border)"
          vertical={false}
          opacity={0.5}
        />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          tickFormatter={formatYAxis}
          axisLine={false}
          tickLine={false}
          width={56}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "var(--border)", strokeWidth: 1 }} />

        {hasNegative && (
          <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 4" />
        )}

        <Area
          type="monotone"
          dataKey="assets"
          name="Assets"
          stroke="#4CAF50"
          strokeWidth={1.5}
          fill="url(#assetGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#4CAF50", stroke: "var(--background)", strokeWidth: 2 }}
        />
        <Area
          type="monotone"
          dataKey="liabilities"
          name="Liabilities"
          stroke="#F44336"
          strokeWidth={1.5}
          fill="url(#liabilityGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#F44336", stroke: "var(--background)", strokeWidth: 2 }}
        />
        <Line
          type="monotone"
          dataKey="netWorth"
          name="Net Worth"
          stroke="#6366F1"
          strokeWidth={2.5}
          dot={false}
          activeDot={{ r: 5, fill: "#6366F1", stroke: "var(--background)", strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
