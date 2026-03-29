import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, percentChange } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CashFlowSummary } from "@/lib/types";

interface Props {
  data: CashFlowSummary | null;
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous);
  if (Math.abs(change) < 0.5) return <Minus className="h-4 w-4 text-muted-foreground" />;
  if (change > 0) {
    return (
      <span className="flex items-center text-xs text-green-600">
        <TrendingUp className="h-3 w-3 mr-1" />
        +{change.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="flex items-center text-xs text-red-600">
      <TrendingDown className="h-3 w-3 mr-1" />
      {change.toFixed(1)}%
    </span>
  );
}

export default function CashFlowCards({ data }: Props) {
  if (!data) return null;

  const cards = [
    { title: "Income", value: data.income, prev: data.prev_income, color: "text-green-600" },
    { title: "Spending", value: data.spending, prev: data.prev_spending, color: "text-red-600" },
    { title: "Net Cash Flow", value: data.net, prev: data.prev_net, color: data.net >= 0 ? "text-green-600" : "text-red-600" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(({ title, value, prev, color }) => (
        <Card key={title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</div>
            <div className="mt-1">
              <ChangeIndicator current={value} previous={prev} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
