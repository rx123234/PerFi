import { useState, useEffect, useCallback } from "react";
import DateRangePicker, { getRange, type DateRange } from "./DateRangePicker";
import SankeyFlow from "./SankeyFlow";
import * as api from "@/lib/api";
import type { SankeyData } from "@/lib/types";

export default function MoneyFlowPage() {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const sk = await api.getSankeyData(range.startDate, range.endDate);
      setSankeyData(sk);
    } catch (err) {
      console.error("Failed to load money flow data:", err);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Money Flow</h2>
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
        <SankeyFlow data={sankeyData} />
      )}
    </div>
  );
}
