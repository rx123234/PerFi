import { useState, useEffect, useCallback } from "react";
import DateRangePicker, { getRange, type DateRange } from "./DateRangePicker";
import CashFlowCards from "./CashFlowCards";
import SpendingPieChart from "./SpendingPieChart";
import TrendChart from "./TrendChart";
import SankeyFlow from "./SankeyFlow";
import TopMerchants from "./TopMerchants";
import AccountBalances from "./AccountBalances";
import * as api from "@/lib/api";
import type {
  CashFlowSummary,
  CategorySpending,
  TrendDataPoint,
  SankeyData,
  MerchantSpending,
  AccountBalance,
} from "@/lib/types";

export default function DashboardPage() {
  const [range, setRange] = useState<DateRange>(() => getRange("month"));
  const [granularity, setGranularity] = useState("monthly");
  const [cashFlow, setCashFlow] = useState<CashFlowSummary | null>(null);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [trends, setTrends] = useState<TrendDataPoint[]>([]);
  const [sankeyData, setSankeyData] = useState<SankeyData | null>(null);
  const [merchants, setMerchants] = useState<MerchantSpending[]>([]);
  const [balances, setBalances] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [cf, cs, tr, sk, mc, bl] = await Promise.all([
        api.getCashFlowSummary(range.startDate, range.endDate, range.prevStartDate, range.prevEndDate),
        api.getSpendingByCategory(range.startDate, range.endDate),
        api.getSpendingTrends(range.startDate, range.endDate, granularity),
        api.getSankeyData(range.startDate, range.endDate),
        api.getTopMerchants(range.startDate, range.endDate),
        api.getAccountBalances(),
      ]);
      setCashFlow(cf);
      setCategorySpending(cs);
      setTrends(tr);
      setSankeyData(sk);
      setMerchants(mc);
      setBalances(bl);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, [range, granularity]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <DateRangePicker selected={range.label} onChange={setRange} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : (
        <>
          <CashFlowCards data={cashFlow} />

          <AccountBalances data={balances} />

          <div className="grid grid-cols-2 gap-4">
            <SpendingPieChart data={categorySpending} />
            <TopMerchants data={merchants} />
          </div>

          <TrendChart
            data={trends}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />

          <SankeyFlow data={sankeyData} />
        </>
      )}
    </div>
  );
}
