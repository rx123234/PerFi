import { useState, useEffect, useCallback } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import * as api from "@/lib/api";
import type { SpendingBreakdown, SpendingCategoryData } from "@/lib/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Format "2026-01" → "Jan '26" for the header, or "Jan" when space is tight. */
function formatMonth(ym: string, short = false): string {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  const mon = date.toLocaleString("en-US", { month: "short" });
  return short ? mon : `${mon} '${String(year).slice(2)}`;
}

function formatYAxis(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}k`;
  return `$${value}`;
}

const TOOLTIP_STYLE = {
  backgroundColor: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  color: "var(--popover-foreground)",
  fontSize: "13px",
} as const;

const TOOLTIP_LABEL_STYLE = { color: "var(--popover-foreground)" } as const;
const TOOLTIP_ITEM_STYLE = { color: "var(--popover-foreground)" } as const;

const TRAILING_OPTIONS: { label: string; months: number }[] = [
  { label: "3M", months: 3 },
  { label: "6M", months: 6 },
  { label: "12M", months: 12 },
  { label: "24M", months: 24 },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface OverviewChartProps {
  breakdown: SpendingBreakdown;
}

function OverviewChart({ breakdown }: OverviewChartProps) {
  // Build recharts data: one entry per month
  const chartData = breakdown.months.map((month, idx) => {
    const entry: Record<string, string | number> = { month: formatMonth(month, true) };
    for (const cat of breakdown.categories) {
      entry[cat.name] = cat.amounts[idx] ?? 0;
    }
    return entry;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium">Spending Overview</CardTitle>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 justify-end">
          {breakdown.categories.map((cat) => (
            <div key={cat.name} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: cat.color || "var(--chart-1)" }}
              />
              <span className="text-xs text-muted-foreground">{cat.name}</span>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barSize={breakdown.months.length > 12 ? 16 : 28}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickFormatter={formatYAxis}
                axisLine={false}
                tickLine={false}
                width={52}
              />
              <Tooltip
                formatter={(value, name) => [formatCurrency(Number(value)), name]}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={TOOLTIP_LABEL_STYLE}
                itemStyle={TOOLTIP_ITEM_STYLE}
                cursor={{ fill: "var(--muted-foreground)", opacity: 0.08 }}
              />
              {breakdown.categories.map((cat) => (
                <Bar
                  key={cat.name}
                  dataKey={cat.name}
                  stackId="spending"
                  fill={cat.color || "var(--chart-1)"}
                  radius={
                    breakdown.categories.indexOf(cat) === breakdown.categories.length - 1
                      ? [4, 4, 0, 0]
                      : [0, 0, 0, 0]
                  }
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

interface CategoryTrendsProps {
  breakdown: SpendingBreakdown;
}

function CategoryTrends({ breakdown }: CategoryTrendsProps) {
  const sorted = [...breakdown.categories].sort((a, b) => b.total - a.total);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {sorted.map((cat) => {
        const chartData = breakdown.months.map((month, idx) => ({
          month: formatMonth(month, true),
          amount: cat.amounts[idx] ?? 0,
        }));

        return (
          <Card key={cat.name}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || "var(--chart-1)" }}
                  />
                  <CardTitle className="text-sm font-medium">{cat.name}</CardTitle>
                </div>
                <span className="text-sm font-semibold tabular-nums">
                  {formatCurrency(cat.total)}
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={breakdown.months.length > 12 ? 10 : 18}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis
                      dataKey="month"
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
                      width={44}
                    />
                    <Tooltip
                      formatter={(value) => [formatCurrency(Number(value)), cat.name]}
                      contentStyle={TOOLTIP_STYLE}
                      cursor={{ fill: "var(--muted-foreground)", opacity: 0.08 }}
                    />
                    <Bar dataKey="amount" radius={[3, 3, 0, 0]}>
                      {chartData.map((_, i) => (
                        <Cell key={i} fill={cat.color || "var(--chart-1)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

interface DetailsTableProps {
  breakdown: SpendingBreakdown;
}

function DetailsTable({ breakdown }: DetailsTableProps) {
  const sorted = [...breakdown.categories].sort((a, b) => b.total - a.total);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Details</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Category
                </th>
                {breakdown.months.map((m) => (
                  <th
                    key={m}
                    className="text-right px-4 py-3 font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {formatMonth(m)}
                  </th>
                ))}
                <th className="text-right px-6 py-3 font-medium text-muted-foreground whitespace-nowrap">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((cat: SpendingCategoryData, rowIdx) => (
                <tr
                  key={cat.name}
                  className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${
                    rowIdx % 2 === 0 ? "" : "bg-muted/10"
                  }`}
                >
                  <td className="px-6 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color || "var(--chart-1)" }}
                      />
                      <span className="font-medium">{cat.name}</span>
                    </div>
                  </td>
                  {cat.amounts.map((amount, idx) => (
                    <td
                      key={breakdown.months[idx]}
                      className="text-right px-4 py-3 text-muted-foreground whitespace-nowrap"
                    >
                      {amount > 0 ? formatCurrency(amount) : "—"}
                    </td>
                  ))}
                  <td className="text-right px-6 py-3 font-semibold whitespace-nowrap">
                    {formatCurrency(cat.total)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border bg-muted/20">
                <td className="px-6 py-3 font-semibold text-muted-foreground whitespace-nowrap">
                  Monthly Total
                </td>
                {breakdown.monthly_totals.map((total, idx) => (
                  <td
                    key={breakdown.months[idx]}
                    className="text-right px-4 py-3 font-semibold whitespace-nowrap"
                  >
                    {formatCurrency(total)}
                  </td>
                ))}
                <td className="text-right px-6 py-3 font-bold whitespace-nowrap">
                  {formatCurrency(breakdown.grand_total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SpendingPage() {
  const [trailingMonths, setTrailingMonths] = useState(6);
  const [breakdown, setBreakdown] = useState<SpendingBreakdown | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getSpendingBreakdown(trailingMonths);
      setBreakdown(data);
    } catch (err) {
      console.error("Failed to load spending breakdown:", err);
    } finally {
      setLoading(false);
    }
  }, [trailingMonths]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const isEmpty =
    !breakdown ||
    breakdown.categories.length === 0 ||
    breakdown.grand_total === 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Spending</h2>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {TRAILING_OPTIONS.map((opt) => (
            <button
              key={opt.months}
              onClick={() => setTrailingMonths(opt.months)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                trailingMonths === opt.months
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : isEmpty ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">No spending data for this period.</p>
        </div>
      ) : (
        <>
          {/* Stacked Bar Overview */}
          <OverviewChart breakdown={breakdown!} />

          {/* Per-category trend grids */}
          <CategoryTrends breakdown={breakdown!} />

          {/* Details Table */}
          <DetailsTable breakdown={breakdown!} />
        </>
      )}
    </div>
  );
}
