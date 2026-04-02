import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";
import type { MerchantSpending } from "@/lib/types";

interface Props {
  data: MerchantSpending[];
}

export default function TopMerchants({ data }: Props) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Top Merchants</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm leading-6">
            Merchant concentration appears after transactions are imported and grouped. This is useful for spotting
            subscriptions, rent, and spend concentration fast.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.slice(0, 8).map((m) => ({
    name: m.merchant.length > 18 ? `${m.merchant.slice(0, 18)}…` : m.merchant,
    amount: m.amount,
    count: m.count,
  }));

  return (
    <Card className="h-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-base font-semibold">Top Merchants</CardTitle>
        <p className="text-sm text-muted-foreground">Largest counterparties by spend for the selected period.</p>
      </CardHeader>
      <CardContent>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" barCategoryGap={12} margin={{ top: 6, right: 8, bottom: 6, left: 8 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => `$${v}`}
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                width={120}
                axisLine={false}
                tickLine={false}
                interval={0}
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
              <Bar dataKey="amount" fill="var(--chart-1)" radius={[0, 10, 10, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
