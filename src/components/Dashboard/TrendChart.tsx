import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Bar,
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

interface Props {
  data: TrendDataPoint[];
  onGranularityChange: (granularity: string) => void;
  granularity: string;
}

export default function TrendChart({ data, onGranularityChange, granularity }: Props) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Spending Trends</CardTitle>
        <div className="flex gap-1">
          {(["weekly", "monthly", "annual"] as const).map((g) => (
            <Button
              key={g}
              variant={granularity === g ? "default" : "outline"}
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
          <p className="text-muted-foreground text-sm">No trend data for this period</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="spending" fill="#ef4444" name="Spending" opacity={0.8} />
                <Line
                  type="monotone"
                  dataKey="income"
                  stroke="#22c55e"
                  strokeWidth={2}
                  name="Income"
                  dot={false}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
