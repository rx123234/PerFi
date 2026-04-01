import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, percentChange } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { CashFlowSummary } from "@/lib/types";

interface Props {
  data: CashFlowSummary | null;
}

function ChangeIndicator({ current, previous }: { current: number; previous: number }) {
  const change = percentChange(current, previous);
  if (Math.abs(change) < 0.5) return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  if (change > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <TrendingUp className="h-3 w-3" />
        +{change.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <TrendingDown className="h-3 w-3" />
      {change.toFixed(1)}%
    </span>
  );
}

export default function CashFlowCards({ data }: Props) {
  if (!data) return null;

  const cards = [
    { title: "Income", value: data.income, prev: data.prev_income, color: "text-success" },
    { title: "Spending", value: data.spending, prev: data.prev_spending, color: "text-destructive" },
    { title: "Net Cash Flow", value: data.net, prev: data.prev_net, color: data.net >= 0 ? "text-success" : "text-destructive" },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map(({ title, value, prev, color }) => (
        <Card key={title}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground mb-1">{title}</p>
            <div className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</div>
            <div className="mt-2">
              <ChangeIndicator current={value} previous={prev} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
