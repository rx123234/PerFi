interface Props {
  categoryName: string;
  categoryColor: string | null;
  spent: number;
  limit: number;
  percentage: number;
}

const fmtWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function BudgetProgressBar({
  categoryName,
  categoryColor,
  spent,
  limit,
  percentage,
}: Props) {
  const isOver = percentage > 100;
  const isWarning = percentage >= 80 && percentage <= 100;

  // Determine bar color
  let barColor: string;
  if (isOver) {
    barColor = "#ef4444"; // red
  } else if (isWarning) {
    barColor = "#f59e0b"; // amber
  } else {
    barColor = "#22c55e"; // green
  }

  // Clamp visual fill — allow slight overflow for over-budget visual
  const visualPct = isOver ? Math.min(percentage, 115) : percentage;
  const clampedPct = Math.min(visualPct, 115);

  return (
    <div className="flex flex-col gap-1.5">
      {/* Top row: name + amounts */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: categoryColor ?? "#94a3b8" }}
          />
          <span className="text-sm font-medium truncate">{categoryName}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOver && (
            <span className="text-xs font-medium text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
              Over
            </span>
          )}
          <span className="text-xs tabular-nums text-muted-foreground">
            <span style={{ color: isOver ? "#ef4444" : isWarning ? "#f59e0b" : "var(--foreground)" }} className="font-semibold">
              {fmtWhole.format(spent)}
            </span>
            {" / "}
            {fmtWhole.format(limit)}
          </span>
          <span
            className="text-xs tabular-nums font-medium w-10 text-right"
            style={{ color: barColor }}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 rounded-full overflow-hidden bg-muted">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${clampedPct}%`,
            backgroundColor: barColor,
            boxShadow: isOver ? `0 0 6px ${barColor}60` : undefined,
          }}
        />
      </div>
    </div>
  );
}
