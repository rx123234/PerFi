import { useState, useEffect, useCallback, useMemo } from "react";
import { subMonths, subWeeks, startOfMonth, format, endOfMonth } from "date-fns";
import DateRangePicker, { getRange, type DateRange } from "./DateRangePicker";
import CashFlowCards from "./CashFlowCards";
import SpendingPieChart from "./SpendingPieChart";
import TopMerchants from "./TopMerchants";
import TrendChart from "./TrendChart";
import * as api from "@/lib/api";
import type {
  CashFlowSummary,
  CategorySpending,
  MerchantSpending,
  TrendDataPoint,
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

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [granularity, setGranularity] = useState("monthly");
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [merchants, setMerchants] = useState<MerchantSpending[]>([]);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const trendRange = useMemo(() => getTrendRange(granularity), [granularity]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cf, cs, mc] = await Promise.all([
        api.getCashFlowSummary(range.startDate, range.endDate, range.prevStartDate, range.prevEndDate),
        api.getSpendingByCategory(range.startDate, range.endDate),
        api.getTopMerchants(range.startDate, range.endDate),
      ]);
      setCashFlow(cf);
      setCategorySpending(cs);
      setMerchants(mc);
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

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { loadTrends(); }, [loadTrends]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[1.8rem] border border-border/80 bg-[linear-gradient(135deg,rgba(92,200,255,0.18),rgba(9,17,29,0.08)_38%,rgba(240,180,41,0.1)_100%)] px-6 py-6 shadow-[0_20px_50px_-34px_rgba(0,0,0,0.7)] backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-muted-foreground">Overview</p>
          <h2 className="mt-3 max-w-2xl text-3xl font-semibold">Your money picture, not just your ledger.</h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            Track inflow, outflow, merchant concentration, and savings behavior from one working surface.
          </p>
        </div>
        <div className="rounded-[1.8rem] border border-border/80 bg-panel/80 px-5 py-5 backdrop-blur-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Range</p>
          <p className="mt-1 text-sm text-muted-foreground">Filter the dashboard by reporting window.</p>
          <div className="mt-4">
            <DateRangePicker selected={range.label} onChange={setRange} />
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
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Cash Flow Summary Cards */}
          <CashFlowCards data={cashFlow} />

          {/* Spending + Merchants side by side */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SpendingPieChart data={categorySpending} />
            <TopMerchants data={merchants} />
          </div>

          {/* Spending Trends */}
          <TrendChart
            data={trends}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
        </>
      )}
    </div>
  );
}
