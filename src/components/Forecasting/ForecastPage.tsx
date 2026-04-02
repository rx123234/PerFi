import React, { useState, useEffect, useCallback } from "react";
import {
  Area,
  Bar,
  Cell,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  ReferenceLine,
} from "recharts";
import { CalendarDays, CreditCard } from "lucide-react";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { formatCurrency, cn } from "@/lib/utils";
import * as api from "@/lib/api";
import type {
  ForecastPoint,
  UpcomingBill,
  SeasonalPattern,
  DebtPayoffPlan,
  Liability,
} from "@/lib/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMonthLabel(monthStr: string): string {
  try {
    return format(parseISO(monthStr + "-01"), "MMM");
  } catch {
    return monthStr;
  }
}

function daysUntil(dateStr: string): number {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return differenceInCalendarDays(parseISO(dateStr), today);
  } catch {
    return 999;
  }
}

function formatShortDate(dateStr: string): string {
  try {
    return format(parseISO(dateStr), "MMM d");
  } catch {
    return dateStr;
  }
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

interface ForecastTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
    payload?: {
      NetLow?: number;
      NetHigh?: number;
      confidence?: number;
    };
  }>;
  label?: string;
}

function ForecastTooltip({ active, payload, label }: ForecastTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const net = payload.find((p) => p.name === "Net");
  const income = payload.find((p) => p.name === "Income");
  const spending = payload.find((p) => p.name === "Spending");
  const rangeSource = payload.find(
    (p) => p.payload?.NetLow !== undefined || p.payload?.NetHigh !== undefined
  )?.payload;
  const netLow = rangeSource?.NetLow;
  const netHigh = rangeSource?.NetHigh;
  const confidence = rangeSource?.confidence;

  return (
    <div className="rounded-xl border border-border bg-popover p-3 shadow-lg text-xs space-y-1.5 min-w-36">
      <p className="font-semibold text-foreground text-sm">{label}</p>
      {income && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Income</span>
          <span className="font-medium text-emerald-500">{formatCurrency(income.value)}</span>
        </div>
      )}
      {spending && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Spending</span>
          <span className="font-medium text-red-500">{formatCurrency(Math.abs(spending.value))}</span>
        </div>
      )}
      {net && (
        <div className="flex justify-between gap-4 border-t border-border pt-1.5 mt-1.5">
          <span className="text-muted-foreground">Net</span>
          <span className={cn("font-semibold", net.value >= 0 ? "text-emerald-500" : "text-red-500")}>
            {formatCurrency(net.value)}
          </span>
        </div>
      )}
      {netLow !== undefined && netHigh !== undefined && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Range</span>
          <span className="font-medium text-foreground">
            {formatCurrency(netLow)} to {formatCurrency(netHigh)}
          </span>
        </div>
      )}
      {confidence !== undefined && (
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Confidence</span>
          <span className="font-medium text-foreground">{Math.round(confidence * 100)}%</span>
        </div>
      )}
    </div>
  );
}

// ─── Cash Flow Chart ──────────────────────────────────────────────────────────

function CashFlowSection({ data }: { data: ForecastPoint[] }) {
  const chartData = data.map((p) => ({
    month: formatMonthLabel(p.month),
    Income: p.projected_income,
    Spending: -p.projected_spending,
    Net: p.projected_net,
    NetLow: p.net_p10,
    NetHigh: p.net_p90,
    NetBand: Math.max(0, p.net_p90 - p.net_p10),
    confidence: p.confidence,
  }));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Cash Flow Projection</CardTitle>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />
              Income
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-500" />
              Spending
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-px w-4 bg-foreground/60" style={{ borderTop: "2px dashed currentColor" }} />
              Net
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm bg-sky-500/25" />
              Forecast band
            </span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Next 6 months — bar opacity reflects forecast confidence
        </p>
        <p className="text-xs text-muted-foreground">
          The shaded band shows the likely net range from the forecast scenarios.
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} barGap={4} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) => `$${Math.abs(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
              <Tooltip content={<ForecastTooltip />} cursor={{ fill: "var(--muted-foreground)", opacity: 0.06 }} />
              <Area
                type="monotone"
                dataKey="NetLow"
                stackId="net-band"
                stroke="none"
                fill="transparent"
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                type="monotone"
                dataKey="NetBand"
                stackId="net-band"
                stroke="none"
                fill="rgb(14 165 233 / 0.16)"
                activeDot={false}
              />
              <Bar dataKey="Income" fill="var(--color-emerald-500, #10b981)" radius={[3, 3, 0, 0]}>
                {chartData.map((point, index) => (
                  <Cell
                    key={`income-${point.month}-${index}`}
                    opacity={0.35 + Math.max(0, Math.min(1, point.confidence)) * 0.55}
                  />
                ))}
              </Bar>
              <Bar dataKey="Spending" fill="var(--color-red-500, #ef4444)" radius={[3, 3, 0, 0]}>
                {chartData.map((point, index) => (
                  <Cell
                    key={`spend-${point.month}-${index}`}
                    opacity={0.35 + Math.max(0, Math.min(1, point.confidence)) * 0.55}
                  />
                ))}
              </Bar>
              <Line
                type="monotone"
                dataKey="Net"
                stroke="var(--foreground)"
                strokeWidth={2}
                strokeDasharray="4 3"
                dot={{ fill: "var(--foreground)", r: 3, strokeWidth: 0 }}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Upcoming Bills ───────────────────────────────────────────────────────────

function DueBadge({ days }: { days: number }) {
  if (days < 0) {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-600">
        Overdue
      </span>
    );
  }
  if (days === 0) {
    return (
      <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-600">
        Due today
      </span>
    );
  }
  if (days < 3) {
    return (
      <span className="rounded-full bg-red-500/12 px-2 py-0.5 text-[11px] font-semibold text-red-500">
        {days}d
      </span>
    );
  }
  if (days < 7) {
    return (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-600">
        {days}d
      </span>
    );
  }
  return (
    <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
      {days}d
    </span>
  );
}

function UpcomingBillsSection({ bills }: { bills: UpcomingBill[] }) {
  const sorted = [...bills].sort(
    (a, b) => new Date(a.expected_date).getTime() - new Date(b.expected_date).getTime()
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Upcoming Bills</CardTitle>
        </div>
        <p className="text-xs text-muted-foreground">Next 30 days</p>
      </CardHeader>
      <CardContent className="p-0">
        {sorted.length === 0 ? (
          <div className="flex h-32 items-center justify-center px-5 pb-5">
            <p className="text-sm text-muted-foreground text-center">No upcoming bills detected.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {sorted.map((bill, i) => {
              const days = daysUntil(bill.expected_date);
              return (
                <div key={i} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-secondary/30 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{bill.merchant}</p>
                    <p className="text-xs text-muted-foreground">
                      {bill.category} · {formatShortDate(bill.expected_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-sm font-semibold tabular-nums">
                      {formatCurrency(bill.expected_amount)}
                    </span>
                    <DueBadge days={days} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Seasonal Patterns ────────────────────────────────────────────────────────

const MONTH_ABBREVS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function SeasonalPatternsSection({ patterns }: { patterns: SeasonalPattern[] }) {
  // Sort by month number
  const sorted = [...patterns].sort((a, b) => a.month - b.month);

  // Compute max deviation for normalization
  const maxAbsDev = Math.max(...sorted.map((p) => Math.abs(p.vs_annual_avg)), 0.01);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Seasonal Spending Patterns</CardTitle>
        <p className="text-xs text-muted-foreground">Monthly spending vs. annual average</p>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="flex h-32 items-center justify-center">
            <p className="text-sm text-muted-foreground">Not enough data yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {(sorted.length === 12 ? sorted : MONTH_ABBREVS.map((_, idx) => {
              return sorted.find((p) => p.month === idx + 1) ?? {
                month: idx + 1,
                month_name: MONTH_ABBREVS[idx],
                avg_spending: 0,
                vs_annual_avg: 0,
              };
            })).map((pattern) => {
              const dev = pattern.vs_annual_avg; // positive = above avg, negative = below
              const intensity = Math.min(Math.abs(dev) / maxAbsDev, 1);
              const isAbove = dev > 0.02;
              const isBelow = dev < -0.02;
              const abbrev = MONTH_ABBREVS[pattern.month - 1] ?? pattern.month_name;

              // Build background style
              let bgStyle: React.CSSProperties = {};
              if (isAbove) {
                bgStyle = { backgroundColor: `rgba(239, 68, 68, ${0.08 + intensity * 0.22})` };
              } else if (isBelow) {
                bgStyle = { backgroundColor: `rgba(16, 185, 129, ${0.08 + intensity * 0.2})` };
              } else {
                bgStyle = { backgroundColor: "var(--secondary)" };
              }

              const pctStr = dev === 0 ? "—"
                : `${dev > 0 ? "+" : ""}${(dev * 100).toFixed(0)}%`;

              return (
                <div
                  key={pattern.month}
                  style={bgStyle}
                  title={`${abbrev}: ${formatCurrency(pattern.avg_spending)} avg · ${pctStr} vs annual avg`}
                  className="group relative flex flex-col items-center justify-center rounded-lg px-2 py-3 transition-all cursor-default hover:ring-1 hover:ring-border"
                >
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {abbrev}
                  </span>
                  <span className="mt-1 text-xs font-bold tabular-nums text-foreground/90 leading-none">
                    {pattern.avg_spending > 0 ? `$${(pattern.avg_spending / 1000).toFixed(1)}k` : "—"}
                  </span>
                  <span
                    className={cn(
                      "mt-1 text-[10px] font-medium",
                      isAbove ? "text-red-500" : isBelow ? "text-emerald-600" : "text-muted-foreground/60"
                    )}
                  >
                    {pctStr}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Debt Payoff ──────────────────────────────────────────────────────────────

type Strategy = "avalanche" | "snowball";

function DebtPayoffSection({ liabilities }: { liabilities: Liability[] }) {
  const [strategy, setStrategy] = useState<Strategy>("avalanche");
  const [extraDollars, setExtraDollars] = useState(0);
  const [plan, setPlan] = useState<DebtPayoffPlan | null>(null);
  const [baselinePlan, setBaselinePlan] = useState<DebtPayoffPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const activeLiabilities = liabilities.filter((l) => l.current_balance_cents > 0);

  const loadPlan = useCallback(async () => {
    setLoading(true);
    try {
      const extraCents = extraDollars * 100;
      const [result, baseline] = await Promise.all([
        api.calculateDebtPayoff(strategy, extraCents),
        extraDollars > 0 ? api.calculateDebtPayoff(strategy, 0) : Promise.resolve(null),
      ]);
      setPlan(result);
      setBaselinePlan(baseline);
    } catch (err) {
      console.error("Failed to calculate debt payoff:", err);
    } finally {
      setLoading(false);
    }
  }, [strategy, extraDollars]);

  useEffect(() => {
    if (activeLiabilities.length > 0) {
      loadPlan();
    }
  }, [strategy, extraDollars, loadPlan, activeLiabilities.length]);

  if (activeLiabilities.length === 0) return null;

  const maxBalance = plan
    ? Math.max(...plan.debts.map((d) => d.current_balance), 1)
    : 1;

  const payoffDate = plan?.payoff_date
    ? (() => {
        try {
          return format(parseISO(plan.payoff_date), "MMMM yyyy");
        } catch {
          return plan.payoff_date;
        }
      })()
    : null;

  const interestSaved =
    baselinePlan && plan ? baselinePlan.total_interest - plan.total_interest : 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">Debt Payoff Planner</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strategy Toggle */}
        <div className="flex gap-2">
          {(
            [
              { key: "avalanche", label: "Avalanche", sub: "Highest Rate First" },
              { key: "snowball", label: "Snowball", sub: "Lowest Balance First" },
            ] as { key: Strategy; label: string; sub: string }[]
          ).map(({ key, label, sub }) => (
            <button
              key={key}
              onClick={() => setStrategy(key)}
              className={cn(
                "flex-1 rounded-lg border px-4 py-3 text-left transition-all",
                strategy === key
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border bg-secondary/30 hover:bg-secondary/60"
              )}
            >
              <p className={cn("text-sm font-semibold", strategy === key ? "text-primary" : "text-foreground")}>
                {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </button>
          ))}
        </div>

        {/* Extra payment slider */}
        <Slider
          min={0}
          max={1000}
          step={50}
          value={extraDollars}
          onChange={setExtraDollars}
          label="Extra Monthly Payment"
          formatValue={(v) => (v === 0 ? "None" : `+$${v}/mo`)}
        />

        {loading ? (
          <div className="flex h-24 items-center justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        ) : plan ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">Debt-free by</p>
                <p className="mt-0.5 text-sm font-bold text-foreground">{payoffDate ?? "—"}</p>
              </div>
              <div className="rounded-lg bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">Total Interest</p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {formatCurrency(plan.total_interest)}
                </p>
              </div>
              <div className="rounded-lg bg-secondary/40 px-4 py-3">
                <p className="text-xs text-muted-foreground">Monthly Payment</p>
                <p className="mt-0.5 text-sm font-bold text-foreground">
                  {formatCurrency(plan.monthly_payment)}
                </p>
              </div>
              {extraDollars > 0 && interestSaved > 0 ? (
                <div className="rounded-lg bg-emerald-500/10 px-4 py-3 border border-emerald-500/20">
                  <p className="text-xs text-emerald-700 dark:text-emerald-400">Interest Saved</p>
                  <p className="mt-0.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(interestSaved)}
                  </p>
                </div>
              ) : (
                <div className="rounded-lg bg-secondary/40 px-4 py-3">
                  <p className="text-xs text-muted-foreground">Debts</p>
                  <p className="mt-0.5 text-sm font-bold text-foreground">{plan.debts.length}</p>
                </div>
              )}
            </div>

            {/* Debt timeline bars */}
            <div className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Payoff Timeline
              </p>
              {plan.debts.map((debt) => {
                const pct = Math.min((debt.current_balance / maxBalance) * 100, 100);
                const debtPayoffDate = (() => {
                  try {
                    return format(parseISO(debt.payoff_date), "MMM yyyy");
                  } catch {
                    return debt.payoff_date;
                  }
                })();
                return (
                  <div key={debt.liability_id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium text-foreground truncate">{debt.name}</span>
                        <span className="text-muted-foreground shrink-0">
                          {debt.interest_rate > 0 ? `${(debt.interest_rate * 100).toFixed(1)}% APR` : ""}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 ml-2">
                        <span className="font-medium tabular-nums">{formatCurrency(debt.current_balance)}</span>
                        <span className="text-muted-foreground">{debtPayoffDate}</span>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 to-amber-400 transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ForecastPage() {
  const [forecastData, setForecastData] = useState<ForecastPoint[]>([]);
  const [bills, setBills] = useState<UpcomingBill[]>([]);
  const [seasonal, setSeasonal] = useState<SeasonalPattern[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        const [forecast, upcomingBills, patterns, liabs] = await Promise.all([
          api.getCashFlowForecast(6),
          api.getUpcomingBills(30),
          api.getSeasonalPatterns(),
          api.getLiabilities(),
        ]);
        setForecastData(forecast);
        setBills(upcomingBills);
        setSeasonal(patterns);
        setLiabilities(liabs);
      } catch (err) {
        console.error("Failed to load forecast data:", err);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Forecast</h2>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading forecast…</p>
          </div>
        </div>
      ) : (
        <>
          {/* Section 1: Cash Flow Projection */}
          <CashFlowSection data={forecastData} />

          {/* Section 2+3: Bills + Seasonal side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UpcomingBillsSection bills={bills} />
            <SeasonalPatternsSection patterns={seasonal} />
          </div>

          {/* Section 4: Debt Payoff (conditional) */}
          <DebtPayoffSection liabilities={liabilities} />
        </>
      )}
    </div>
  );
}
