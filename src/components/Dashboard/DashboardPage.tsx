import { useState, useEffect, useCallback, useMemo } from "react";
import { subMonths, subWeeks, startOfMonth, format, endOfMonth, differenceInCalendarDays, parseISO } from "date-fns";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Flag,
  Lightbulb,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import DateRangePicker, { getRange, type DateRange } from "./DateRangePicker";
import CashFlowCards from "./CashFlowCards";
import SpendingPieChart from "./SpendingPieChart";
import TopMerchants from "./TopMerchants";
import TrendChart from "./TrendChart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import * as api from "@/lib/api";
import { cn, formatCurrency } from "@/lib/utils";
import type {
  CashFlowSummary,
  CategorySpending,
  ForecastPoint,
  GoalWithProgress,
  Insight,
  MerchantSpending,
  NetWorthSummary,
  TrendDataPoint,
  UpcomingBill,
} from "@/lib/types";

function getTrendRange(granularity: string): { start: string; end: string } {
  const now = new Date();
  const end = format(endOfMonth(now), "yyyy-MM-dd");
  let start: Date;
  switch (granularity) {
    case "weekly":
      start = subWeeks(now, 12);
      break;
    case "annual":
      start = startOfMonth(subMonths(now, 11));
      break;
    default:
      start = startOfMonth(subMonths(now, 2));
      break;
  }
  return { start: format(start, "yyyy-MM-dd"), end };
}

function daysUntil(date: string) {
  try {
    return differenceInCalendarDays(parseISO(date), new Date());
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function getSeverityTone(severity: string) {
  switch (severity) {
    case "high":
      return "border-red-500/25 bg-red-500/10 text-red-600";
    case "medium":
      return "border-amber-500/25 bg-amber-500/10 text-amber-600";
    default:
      return "border-sky-500/25 bg-sky-500/10 text-sky-600";
  }
}

function EmptyStatePanel() {
  const steps = [
    "Connect an account or import a statement.",
    "Review top merchants and categories for the last month.",
    "Use Forecast and Insights once the first data sync lands.",
  ];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-6">
        <div className="rounded-[1.5rem] border border-border/80 bg-[linear-gradient(135deg,rgba(92,200,255,0.16),rgba(8,18,30,0.04)_42%,rgba(240,180,41,0.08)_100%)] p-6">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
            First value
          </div>
          <h3 className="mt-3 text-2xl font-semibold">Start with one month of clean data.</h3>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            PerFi becomes useful as soon as it can classify inflow, outflow, and recurring obligations. You do not
            need perfect history to get a useful dashboard.
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-2xl border border-border/80 bg-panel/75 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Step {index + 1}
                </p>
                <p className="mt-2 text-sm font-medium">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CommandCenter({
  insights,
  bills,
  forecast,
}: {
  insights: Insight[];
  bills: UpcomingBill[];
  forecast: ForecastPoint[];
}) {
  const unreadInsights = insights.filter((insight) => !insight.is_read && !insight.is_dismissed);
  const urgentBills = bills
    .map((bill) => ({ ...bill, daysAway: daysUntil(bill.expected_date) }))
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, 3);
  const nextMonth = forecast[0] ?? null;
  const nextMonthRange = nextMonth ? nextMonth.net_p90 - nextMonth.net_p10 : 0;

  const alerts = [
    nextMonth && nextMonth.projected_net < 0
      ? {
          title: "Projected cash squeeze next month",
          body: `Net is tracking at ${formatCurrency(nextMonth.projected_net)} with a likely range of ${formatCurrency(nextMonth.net_p10)} to ${formatCurrency(nextMonth.net_p90)}.`,
          tone: "critical" as const,
        }
      : null,
    nextMonth && nextMonth.net_p10 < 0 && nextMonth.projected_net >= 0
      ? {
          title: "Forecast range still dips below zero",
          body: `Expected net is positive, but downside risk reaches ${formatCurrency(nextMonth.net_p10)}.`,
          tone: "watch" as const,
        }
      : null,
    urgentBills[0] && urgentBills[0].daysAway <= 3
      ? {
          title: "Bills need attention this week",
          body: `${urgentBills.filter((bill) => bill.daysAway <= 7).length} recurring bill${urgentBills.filter((bill) => bill.daysAway <= 7).length === 1 ? "" : "s"} expected within 7 days.`,
          tone: "watch" as const,
        }
      : null,
    unreadInsights[0]
      ? {
          title: unreadInsights[0].title,
          body: unreadInsights[0].body,
          tone: unreadInsights[0].severity === "high" ? ("critical" as const) : ("info" as const),
        }
      : null,
  ].filter(Boolean) as Array<{ title: string; body: string; tone: "critical" | "watch" | "info" }>;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/70 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Command center
            </p>
            <CardTitle className="mt-2 text-xl font-semibold">What needs attention next</CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Use this surface to decide whether cash flow is healthy, which bills are near, and what the app thinks
              matters most.
            </p>
          </div>
          <div className="rounded-full border border-border/80 bg-surface/70 px-3 py-1 text-xs text-muted-foreground">
            {alerts.length} live signal{alerts.length === 1 ? "" : "s"}
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-5 p-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-3">
          {alerts.length === 0 ? (
            <div className="rounded-2xl border border-border/80 bg-surface/65 p-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-sky-500" />
                No acute issues detected
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Cash flow and upcoming obligations look stable right now. Use this quieter window to refine budgets,
                review merchants, or check forecast assumptions.
              </p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div
                key={alert.title}
                className={cn(
                  "rounded-2xl border p-4",
                  alert.tone === "critical" && "border-red-500/20 bg-red-500/8",
                  alert.tone === "watch" && "border-amber-500/20 bg-amber-500/8",
                  alert.tone === "info" && "border-sky-500/20 bg-sky-500/8"
                )}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                      alert.tone === "critical" && "border-red-500/25 bg-red-500/10 text-red-600",
                      alert.tone === "watch" && "border-amber-500/25 bg-amber-500/10 text-amber-600",
                      alert.tone === "info" && "border-sky-500/25 bg-sky-500/10 text-sky-600"
                    )}
                  >
                    {alert.tone === "critical" ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : alert.tone === "watch" ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : (
                      <Lightbulb className="h-4 w-4" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted-foreground">{alert.body}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-border/80 bg-panel/75 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Forecast monitor
                </p>
                <p className="mt-1 text-sm font-medium">Next month</p>
              </div>
              <div
                className={cn(
                  "rounded-full px-2.5 py-1 text-[11px] font-semibold",
                  nextMonth && nextMonth.projected_net >= 0
                    ? "bg-emerald-500/12 text-emerald-600"
                    : "bg-red-500/12 text-red-600"
                )}
              >
                {nextMonth ? `${Math.round(nextMonth.confidence * 100)}% confidence` : "No forecast"}
              </div>
            </div>
            {nextMonth ? (
              <>
                <div className="mt-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/80 bg-surface/70">
                    {nextMonth.projected_net >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-xl font-semibold tabular-nums">{formatCurrency(nextMonth.projected_net)}</p>
                    <p className="text-xs text-muted-foreground">
                      Range width {formatCurrency(nextMonthRange)} across forecast scenarios
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Likely floor</span>
                    <span className="font-medium text-foreground">{formatCurrency(nextMonth.net_p10)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Likely ceiling</span>
                    <span className="font-medium text-foreground">{formatCurrency(nextMonth.net_p90)}</span>
                  </div>
                </div>
              </>
            ) : (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Forecast needs recurring income or spending history before it can become a useful operating signal.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-border/80 bg-panel/75 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                  Upcoming bills
                </p>
                <p className="mt-1 text-sm font-medium">Next 30 days</p>
              </div>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </div>
            {urgentBills.length === 0 ? (
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                No recurring bills detected yet. Once imports or account history settle, this card will track the next
                obligations automatically.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {urgentBills.map((bill) => (
                  <div key={`${bill.merchant}-${bill.expected_date}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{bill.merchant}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(parseISO(bill.expected_date), "MMM d")} · {bill.category}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(bill.expected_amount)}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.daysAway <= 0 ? "Due now" : `${bill.daysAway}d away`}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function NetWorthSnapshotCard({ summary }: { summary: NetWorthSummary | null }) {
  if (!summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Net Worth Snapshot</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-6 text-muted-foreground">
            Add assets or liabilities to start tracking overall balance-sheet movement.
          </p>
        </CardContent>
      </Card>
    );
  }

  const delta =
    summary.prev_net_worth === null ? null : summary.net_worth - summary.prev_net_worth;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Net Worth Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Current</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums">{formatCurrency(summary.net_worth)}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border/70 bg-surface/65 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Assets</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-emerald-600">
              {formatCurrency(summary.total_assets)}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-surface/65 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Liabilities</p>
            <p className="mt-2 text-lg font-semibold tabular-nums text-red-600">
              {formatCurrency(summary.total_liabilities)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl border border-border/70 bg-surface/65 px-3 py-2.5">
          <span className="text-sm text-muted-foreground">Since prior snapshot</span>
          <span className={cn("text-sm font-semibold", delta !== null && delta >= 0 ? "text-emerald-600" : "text-red-600")}>
            {delta === null ? "No prior snapshot" : formatCurrency(delta)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function GoalsSnapshotCard({ goals }: { goals: GoalWithProgress[] }) {
  const topGoals = [...goals]
    .filter((item) => item.goal.status === "active")
    .sort((a, b) => a.goal.priority - b.goal.priority)
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Goals in Motion</CardTitle>
      </CardHeader>
      <CardContent>
        {topGoals.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Goals turn the rest of the app into a plan. Add one active target to track whether current savings pace is
            enough.
          </p>
        ) : (
          <div className="space-y-3">
            {topGoals.map((item) => (
              <div key={item.goal.id} className="rounded-2xl border border-border/70 bg-surface/65 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{item.goal.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.months_remaining !== null
                        ? `${item.months_remaining} month${item.months_remaining === 1 ? "" : "s"} remaining`
                        : "No projected completion date"}
                    </p>
                  </div>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-panel/80">
                    <Flag className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-border/70">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      item.on_track ? "bg-emerald-500" : "bg-amber-500"
                    )}
                    style={{ width: `${Math.min(100, Math.max(6, item.percentage))}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{Math.round(item.percentage)}% funded</span>
                  <span className={cn("font-semibold", item.on_track ? "text-emerald-600" : "text-amber-600")}>
                    {item.on_track ? "On track" : "Needs attention"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InsightsPreview({ insights }: { insights: Insight[] }) {
  const visibleInsights = insights
    .filter((insight) => !insight.is_dismissed)
    .sort((a, b) => Number(a.is_read) - Number(b.is_read))
    .slice(0, 3);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Insight Feed</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">What the app has noticed recently.</p>
          </div>
          <div className="rounded-full border border-border/70 bg-surface/70 px-3 py-1 text-xs text-muted-foreground">
            {visibleInsights.length} surfaced
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {visibleInsights.length === 0 ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Insight generation works best once spending categories and recurring flows are established.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleInsights.map((insight) => (
              <div key={insight.id} className="rounded-2xl border border-border/70 bg-surface/65 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold", getSeverityTone(insight.severity))}>
                        {insight.severity}
                      </span>
                      {!insight.is_read && (
                        <span className="rounded-full bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-600">
                          Unread
                        </span>
                      )}
                    </div>
                    <p className="mt-3 text-sm font-semibold">{insight.title}</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{insight.body}</p>
                  </div>
                  <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [granularity, setGranularity] = useState("monthly");
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [merchants, setMerchants] = useState<MerchantSpending[]>([]);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [netWorthSummary, setNetWorthSummary] = useState<NetWorthSummary | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[]>([]);
  const [upcomingBills, setUpcomingBills] = useState<UpcomingBill[]>([]);
  const [loading, setLoading] = useState(true);

  const trendRange = useMemo(() => getTrendRange(granularity), [granularity]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cf, cs, mc, insightFeed, goalList, netWorth, forecastData, bills] = await Promise.all([
        api.getCashFlowSummary(range.startDate, range.endDate, range.prevStartDate, range.prevEndDate),
        api.getSpendingByCategory(range.startDate, range.endDate),
        api.getTopMerchants(range.startDate, range.endDate),
        api.getInsights(false),
        api.getGoals(),
        api.getNetWorthSummary(),
        api.getCashFlowForecast(3),
        api.getUpcomingBills(30),
      ]);
      setCashFlow(cf);
      setCategorySpending(cs);
      setMerchants(mc);
      setInsights(insightFeed);
      setGoals(goalList);
      setNetWorthSummary(netWorth);
      setForecast(forecastData);
      setUpcomingBills(bills);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  const loadTrends = useCallback(async () => {
    try {
      const tr = await api.getSpendingTrends(trendRange.start, trendRange.end, granularity);
      setTrends(tr);
    } catch (err) {
      console.error("Failed to load trends:", err);
    }
  }, [trendRange, granularity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const topCategory = categorySpending[0];
  const unreadCount = insights.filter((insight) => !insight.is_read && !insight.is_dismissed).length;
  const activeGoals = goals.filter((goal) => goal.goal.status === "active").length;
  const hasCoreData =
    Boolean(cashFlow) ||
    categorySpending.length > 0 ||
    merchants.length > 0 ||
    trends.length > 0 ||
    insights.length > 0 ||
    goals.length > 0 ||
    netWorthSummary !== null;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.8rem] border border-border/80 bg-[linear-gradient(135deg,rgba(92,200,255,0.18),rgba(9,17,29,0.08)_38%,rgba(240,180,41,0.1)_100%)] px-6 py-6 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Overview</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold">Your financial control panel, not just a ledger.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            Watch liquidity, upcoming obligations, recurring patterns, and longer-term progress from one working
            surface.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-border/80 bg-panel/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Unread insights</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{unreadCount}</p>
              <p className="mt-1 text-xs text-muted-foreground">Signals waiting for review</p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-panel/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Top spend driver</p>
              <p className="mt-2 text-lg font-semibold">{topCategory?.category_name ?? "Not enough data"}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {topCategory ? formatCurrency(topCategory.amount) : "Categorized spending will appear here"}
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-panel/70 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">Active goals</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{activeGoals}</p>
              <p className="mt-1 text-xs text-muted-foreground">Savings targets currently in motion</p>
            </div>
          </div>
        </div>
        <div className="rounded-[1.8rem] border border-border/80 bg-panel/80 px-5 py-5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Range</p>
          <p className="mt-1 text-sm text-muted-foreground">Filter the dashboard by reporting window.</p>
          <div className="mt-4">
            <DateRangePicker selected={range.label} onChange={setRange} />
          </div>
          <div className="mt-5 rounded-2xl border border-border/70 bg-surface/65 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              Weekly operating question
            </div>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Are recurring obligations covered, is net cash flow stable, and are the biggest categories aligned with
              the plan?
            </p>
            <div className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
              Review the command center below
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Workspace</p>
          <h3 className="mt-1 text-xl font-semibold">Home</h3>
        </div>
        <div className="rounded-full border border-border/80 bg-surface/65 px-3 py-1 text-xs text-muted-foreground">
          {range.label}
        </div>
      </div>

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading your control panel...</p>
          </div>
        </div>
      ) : !hasCoreData ? (
        <EmptyStatePanel />
      ) : (
        <>
          <CashFlowCards data={cashFlow} />

          <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
            <CommandCenter insights={insights} bills={upcomingBills} forecast={forecast} />
            <div className="space-y-4">
              <NetWorthSnapshotCard summary={netWorthSummary} />
              <GoalsSnapshotCard goals={goals} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <InsightsPreview insights={insights} />
            <TopMerchants data={merchants} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SpendingPieChart data={categorySpending} />
            <TrendChart data={trends} granularity={granularity} onGranularityChange={setGranularity} />
          </div>
        </>
      )}
    </div>
  );
}
