import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { TrendDataPoint } from "@/lib/types";

interface TrendWithNet extends TrendDataPoint {
  net: number;
}

interface Props {
  data: TrendDataPoint[];
  onGranularityChange: (granularity: string) => void;
  granularity: string;
}

export default function TrendChart({ data, onGranularityChange, granularity }: Props) {
  const dataWithNet: TrendWithNet[] = data.map((d) => ({
    ...d,
    net: d.income - d.spending,
  }));
  return (
    <Card>
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <CardTitle className="text-base font-semibold">Cash Flow Trends</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">Income, spending, and what you kept over time.</p>
        </div>
        <div className="flex gap-1">
          {(["weekly", "monthly", "annual"] as const).map((g) => (
            <Button
              key={g}
              variant={granularity === g ? "default" : "ghost"}
              size="sm"
              onClick={() => onGranularityChange(g)}
            >
              {g.charAt(0).toUpperCase() + g.slice(1)}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-muted-foreground text-sm leading-6">
            Trend data needs multiple periods of history. Once enough activity is loaded, this chart will show whether
            income and spending are stabilizing or drifting.
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={dataWithNet}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value))}
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    color: "var(--popover-foreground)",
                    fontSize: "13px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="spending"
                  stroke="var(--destructive)"
                  fill="var(--destructive)"
                  fillOpacity={0.12}
                  strokeWidth={2}
                  name="Spending"
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="var(--success)"
                  fill="var(--success)"
                  fillOpacity={0.08}
                  strokeWidth={0}
                  name="Income Range"
                />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="var(--success)"
                  strokeWidth={2.5}
                  name="Income"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Line
                  type="monotone"
                  dataKey="net"
                  stroke="var(--chart-1)"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  name="Net (Saved)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
