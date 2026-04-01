import { useState, useEffect, useCallback, useMemo } from "react";
import { subMonths, subWeeks, startOfMonth, format, endOfMonth } from "date-fns";
import DateRangePicker, { getRange, type DateRange } from "./DateRangePicker";
import CashFlowCards from "./CashFlowCards";
import TrendChart from "./TrendChart";
import * as api from "@/lib/api";
import type {
  CashFlowSummary,
  TrendDataPoint,
} from "@/lib/types";

/** Compute a trailing date range for the trend chart based on granularity. */
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
    default: // monthly
      start = startOfMonth(subMonths(now, 2));
      break;
  }
  return { start: format(start, "yyyy-MM-dd"), end };
}

export default function CashFlowPage() {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [granularity, setGranularity] = useState("monthly");
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const trendRange = useMemo(() => getTrendRange(granularity), [granularity]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const cf = await api.getCashFlowSummary(range.startDate, range.endDate, range.prevStartDate, range.prevEndDate);
      setCashFlow(cf);
    } catch (err) {
      console.error("Failed to load cash flow data:", err);
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
        <h2 className="text-2xl font-bold">Cash Flow</h2>
        <DateRangePicker selected={range.label} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <>
          <CashFlowCards data={cashFlow} />
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
