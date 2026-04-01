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
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Home</h2>
        <DateRangePicker selected={range.label} onChange={setRange} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
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
