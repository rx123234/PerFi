import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, percentChange } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus, Wallet } from "lucide-react";
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
        <ArrowUpRight className="h-3 w-3" />
        +{change.toFixed(1)}%
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <ArrowDownRight className="h-3 w-3" />
      {change.toFixed(1)}%
    </span>
  );
}

export default function CashFlowCards({ data }: Props) {
  if (!data) return null;

  const cards = [
    { title: "Income", value: data.income, prev: data.prev_income, color: "text-success", accent: "rgba(46,204,113,0.16)" },
    { title: "Spending", value: data.spending, prev: data.prev_spending, color: "text-destructive", accent: "rgba(220,38,38,0.16)" },
    { title: "Net Cash Flow", value: data.net, prev: data.prev_net, color: data.net >= 0 ? "text-success" : "text-destructive", accent: "rgba(92,200,255,0.18)" },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {cards.map(({ title, value, prev, color, accent }) => (
        <Card key={title} className="overflow-hidden">
          <CardContent className="relative p-6">
            <div className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${accent}, transparent)` }} />
            <div className="mb-6 flex items-start justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
                <div className={`mt-2 text-3xl font-semibold tabular-nums ${color}`}>{formatCurrency(value)}</div>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-surface/70 text-muted-foreground">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <ChangeIndicator current={value} previous={prev} />
              <span className="text-xs text-muted-foreground">vs previous period</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
