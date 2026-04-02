import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { CategorySpending } from "@/lib/types";

interface Props {
  data: CategorySpending[];
}

const CHART_COLORS = [
  "var(--chart-1)", "var(--chart-2)", "var(--chart-3)",
  "var(--chart-4)", "var(--chart-5)", "var(--chart-6)",
];

export default function SpendingPieChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Spending by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No spending data for this period</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Spending by Category</CardTitle>
        <p className="text-sm text-muted-foreground">Where your outflow is concentrating this period.</p>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-6 xl:flex-row">
          <div className="h-56 w-full xl:w-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="amount"
                  nameKey="category_name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={88}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={index} fill={entry.color || CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
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
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2 overflow-auto max-h-56">
            {data.map((cat) => (
              <div key={cat.category_id} className="flex items-center justify-between rounded-xl border border-border/70 bg-surface/40 px-3 py-2.5 text-sm">
                <div className="flex min-w-0 items-center gap-3">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="truncate text-secondary-foreground">{cat.category_name}</span>
                </div>
                <div className="flex items-center gap-3 pl-3">
                  <span className="font-medium tabular-nums">{formatCurrency(cat.amount)}</span>
                  <span className="text-muted-foreground text-xs w-12 text-right tabular-nums">
                    {cat.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
