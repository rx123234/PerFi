import { useState, useEffect, useCallback } from "react";
import { Sparkles, Copy, Check, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import * as api from "@/lib/api";
import type { Insight } from "@/lib/types";
import InsightCard from "./InsightCard";

// ─── Filter Tabs ──────────────────────────────────────────────────────────────

type FilterKey = "all" | "spending" | "savings" | "milestones" | "alerts";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "spending", label: "Spending" },
  { key: "savings", label: "Savings" },
  { key: "milestones", label: "Milestones" },
  { key: "alerts", label: "Alerts" },
];

const FILTER_COPY: Record<FilterKey, { title: string; description: string; button: string; copyHint: string }> = {
  all: {
    title: "AI Overview Export",
    description: "Export a full finance snapshot with saved insights, spending patterns, savings context, and net worth summary.",
    button: "Prepare Overview for AI",
    copyHint: "Copy this overview and paste it into your AI assistant for a full-picture review of your finances.",
  },
  spending: {
    title: "AI Spending Export",
    description: "Export spending-specific data including category concentration, recent trends, anomalies, and saved spending insights.",
    button: "Prepare Spending Data",
    copyHint: "Copy this spending snapshot and ask your AI assistant to analyze overspending, merchant concentration, or cleanup opportunities.",
  },
  savings: {
    title: "AI Savings Export",
    description: "Export savings-specific context including income, spending, savings rate, budget pressure, goal progress, and saved savings insights.",
    button: "Prepare Savings Data",
    copyHint: "Copy this savings snapshot and ask your AI assistant to evaluate savings rate, budget leakage, and surplus allocation.",
  },
  milestones: {
    title: "AI Milestones Export",
    description: "Export milestone-specific context including net worth, goal progress, and saved milestone signals.",
    button: "Prepare Milestone Data",
    copyHint: "Copy this milestone snapshot and ask your AI assistant to review progress toward major financial targets.",
  },
  alerts: {
    title: "AI Alerts Export",
    description: "Export alert-focused data including active warning signals, anomalies, budget pressure, and saved alert insights.",
    button: "Prepare Alert Data",
    copyHint: "Copy this alert snapshot and ask your AI assistant what needs attention first and what corrective actions matter most.",
  },
};

function matchesFilter(insight: Insight, filter: FilterKey): boolean {
  switch (filter) {
    case "all":
      return true;
    case "spending":
      return ["spending_alert", "anomaly"].includes(insight.insight_type);
    case "savings":
      return ["savings_trend", "lifestyle_inflation"].includes(insight.insight_type);
    case "milestones":
      return insight.insight_type === "milestone";
    case "alerts":
      return ["warning", "action_needed"].includes(insight.severity);
  }
}

function countUnread(insights: Insight[], filter: FilterKey): number {
  return insights.filter((i) => !i.is_read && !i.is_dismissed && matchesFilter(i, filter)).length;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function InsightsPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [aiData, setAiData] = useState<string | null>(null);
  const [loadingAiData, setLoadingAiData] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadInsights = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getInsights(false);
      // Sort newest first
      const sorted = [...result].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setInsights(sorted.filter((i) => !i.is_dismissed));
    } catch (err) {
      console.error("Failed to load insights:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  useEffect(() => {
    setAiData(null);
    setCopied(false);
  }, [activeFilter]);

  const handleDismiss = async (id: string) => {
    try {
      await api.dismissInsight(id);
      setInsights((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      console.error("Failed to dismiss insight:", err);
    }
  };

  const handleMarkRead = async (id: string) => {
    try {
      await api.markInsightRead(id);
      setInsights((prev) =>
        prev.map((i) => (i.id === id ? { ...i, is_read: true } : i))
      );
    } catch (err) {
      console.error("Failed to mark insight as read:", err);
    }
  };

  const handlePrepareAiData = async () => {
    setLoadingAiData(true);
    try {
      const data = await api.getInsightDataForAi(activeFilter);
      setAiData(data);
    } catch (err) {
      console.error("Failed to get AI data:", err);
    } finally {
      setLoadingAiData(false);
    }
  };

  const handleCopy = async () => {
    if (!aiData) return;
    try {
      await navigator.clipboard.writeText(aiData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback — silently ignore
    }
  };

  const filteredInsights = insights.filter((i) => matchesFilter(i, activeFilter));
  const aiCopy = FILTER_COPY[activeFilter];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Insights</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Review saved signals and export structured data for deeper AI analysis.
        </p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 rounded-lg bg-secondary p-1 w-fit">
        {FILTERS.map(({ key, label }) => {
          const unread = countUnread(insights, key);
          const isActive = activeFilter === key;
          return (
            <button
              key={key}
              onClick={() => setActiveFilter(key)}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {unread > 0 && (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            <p className="text-sm text-muted-foreground">Loading insights…</p>
          </div>
        </div>
      ) : filteredInsights.length === 0 ? (
        <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border">
          <Sparkles className="h-8 w-8 text-muted-foreground/40" />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInsights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={handleDismiss}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}

      {/* AI Analysis Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">{aiCopy.title}</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {aiCopy.description}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!aiData ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground leading-relaxed">
                Prepare a structured snapshot tailored to the section you are viewing. Your data stays local unless you choose to paste it into an external AI tool.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrepareAiData}
                disabled={loadingAiData}
                className="w-fit"
              >
                {loadingAiData ? (
                  <>
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Preparing…
                  </>
                ) : (
                  aiCopy.button
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Code block */}
              <div className="relative">
                <pre className="overflow-auto rounded-lg bg-secondary/60 p-4 text-xs text-foreground/80 leading-relaxed max-h-64 font-mono">
                  {aiData}
                </pre>
                <button
                  onClick={handleCopy}
                  className="absolute right-2 top-2 flex items-center gap-1.5 rounded-md bg-background/80 px-2.5 py-1.5 text-xs font-medium text-foreground/70 backdrop-blur-sm transition-colors hover:bg-background hover:text-foreground border border-border"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed border-l-2 border-border pl-3">
                {aiCopy.copyHint}
              </p>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Copied!" : "Copy to Clipboard"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAiData(null)}
                  className="text-muted-foreground"
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
