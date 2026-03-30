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
          <p className="text-muted-foreground text-sm">No merchant data for this period</p>
        </CardContent>
      </Card>
    );
  }

  const chartData = data.slice(0, 10).map((m) => ({
    name: m.merchant.length > 20 ? m.merchant.slice(0, 20) + "..." : m.merchant,
    amount: m.amount,
    count: m.count,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Top Merchants</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 80 }}>
              <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={80} />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
              />
              <Bar dataKey="amount" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
