import { useState, useEffect, useCallback, useRef } from "react";
import { format, addMonths, subMonths, parseISO, startOfMonth, endOfMonth } from "date-fns";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { ChevronLeft, ChevronRight, Sparkles, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import BudgetProgressBar from "./BudgetProgressBar";
import * as api from "@/lib/api";
import type {
  BudgetWithSpending,
  BudgetStatus,
  SavingsRatePoint,
  Category,
  CategorySpending,
} from "@/lib/types";

// ── formatting ─────────────────────────────────────────────────────────────────

const fmtWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const fmtCents = (cents: number) => fmtWhole.format(cents / 100);

// ── spinner ────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-2">
        <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}

// ── savings rate sparkline ─────────────────────────────────────────────────────

interface SparklineProps {
  data: SavingsRatePoint[];
}

function SavingsSparkline({ data }: SparklineProps) {
  if (!data || data.length === 0) return null;

  const chartData = data.map((pt) => ({
    month: pt.month,
    rate: Math.max(-100, Math.min(100, pt.savings_rate)),
  }));

  return (
    <div style={{ width: 80, height: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <Line
            type="monotone"
            dataKey="rate"
            stroke="currentColor"
            strokeWidth={1.5}
            dot={false}
          />
          <Tooltip
            formatter={(v) => [`${Number(v).toFixed(1)}%`, "Savings Rate"]}
            contentStyle={{
              backgroundColor: "var(--popover)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontSize: "11px",
              padding: "4px 8px",
            }}
            labelFormatter={(label) => {
              try {
                return format(parseISO(String(label) + "-01"), "MMM yyyy");
              } catch {
                return String(label);
              }
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── inline limit editor ────────────────────────────────────────────────────────

interface InlineLimitEditorProps {
  budgetItem: BudgetWithSpending;
  onSave: (categoryId: string, newLimitCents: number) => Promise<void>;
}

function InlineLimitEditor({ budgetItem, onSave }: InlineLimitEditorProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    (budgetItem.budget.monthly_limit_cents / 100).toFixed(0)
  );
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  async function handleSave() {
    const dollars = parseFloat(value);
    if (isNaN(dollars) || dollars < 0) return;
    setSaving(true);
    try {
      await onSave(budgetItem.budget.category_id, Math.round(dollars * 100));
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") setEditing(false);
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground hover:text-foreground underline decoration-dashed underline-offset-2 transition-colors cursor-pointer"
        title="Click to edit limit"
      >
        Edit limit
      </button>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKey}
          className="w-24 pl-5 pr-2 py-1 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving}
        className="p-1 rounded text-success hover:bg-success/10 transition-colors"
      >
        <Check className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => setEditing(false)}
        className="p-1 rounded text-muted-foreground hover:bg-muted transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// ── suggestion row ─────────────────────────────────────────────────────────────

interface SuggestionRowProps {
  suggestion: BudgetWithSpending;
  onApply: (categoryId: string, limitCents: number) => Promise<void>;
}

function SuggestionRow({ suggestion, onApply }: SuggestionRowProps) {
  const [applying, setApplying] = useState(false);

  async function handleApply() {
    setApplying(true);
    try {
      await onApply(suggestion.budget.category_id, suggestion.budget.monthly_limit_cents);
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: suggestion.budget.category_color ?? "#94a3b8" }}
        />
        <span className="text-sm font-medium truncate">
          {suggestion.budget.category_name}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold tabular-nums">
          {fmtCents(suggestion.budget.monthly_limit_cents)}/mo
        </span>
        <button
          onClick={handleApply}
          disabled={applying}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-80 disabled:opacity-50 transition-opacity"
        >
          {applying ? (
            <span className="w-3 h-3 border border-background border-t-transparent rounded-full animate-spin" />
          ) : (
            <Check className="h-3 w-3" />
          )}
          Apply
        </button>
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function BudgetPage() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()));
  const [budgets, setBudgets] = useState<BudgetWithSpending[]>([]);
  const [status, setStatus] = useState<BudgetStatus | null>(null);
  const [savingsHistory, setSavingsHistory] = useState<SavingsRatePoint[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spendingByCategory, setSpendingByCategory] = useState<CategorySpending[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] = useState<BudgetWithSpending[] | null>(null);
  const [suggesting, setSuggesting] = useState(false);

  const monthStr = format(currentMonth, "yyyy-MM");
  const monthStart = format(startOfMonth(currentMonth), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(currentMonth), "yyyy-MM-dd");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [b, s, sh, cats, spending] = await Promise.all([
        api.getBudgets(),
        api.getBudgetStatus(monthStr),
        api.getSavingsRateHistory(6),
        api.getCategories(),
        api.getSpendingByCategory(monthStart, monthEnd),
      ]);
      setBudgets(b);
      setStatus(s);
      setSavingsHistory(sh);
      setCategories(cats);
      setSpendingByCategory(spending);
    } catch (err) {
      console.error("Failed to load budget data:", err);
    } finally {
      setLoading(false);
    }
  }, [monthEnd, monthStart, monthStr]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleSetBudget(categoryId: string, limitCents: number) {
    await api.setBudget(categoryId, limitCents);
    await loadData();
    setSuggestions(null);
  }

  async function handleSuggest() {
    setSuggesting(true);
    try {
      const s = await api.suggestBudgets();
      setSuggestions(s);
    } catch (err) {
      console.error("Failed to suggest budgets:", err);
    } finally {
      setSuggesting(false);
    }
  }

  // Sort budgets by percentage descending (most overspent first)
  const sortedBudgets = status
    ? [...status.budgets].sort((a, b) => b.percentage - a.percentage)
    : [];

  // Unbudgeted categories: categories with spending but no budget
  const budgetedCategoryIds = new Set(budgets.map((b) => b.budget.category_id));
  const unbudgetedSpending = spendingByCategory
    .filter((item) => item.amount > 0 && !budgetedCategoryIds.has(item.category_id))
    .map((item) => {
      const category = categories.find((cat) => cat.id === item.category_id);
      return {
        categoryId: item.category_id,
        categoryName: category?.name ?? item.category_name,
        categoryColor: category?.color ?? item.color,
        spendingCents: Math.round(item.amount * 100),
        isBudgetable: item.category_id !== "cat-uncategorized",
      };
    })
    .sort((a, b) => b.spendingCents - a.spendingCents);

  // Savings rate color
  const savingsRate = status?.savings_rate ?? 0;
  let savingsColor: string;
  if (savingsRate >= 20) savingsColor = "#22c55e";
  else if (savingsRate >= 10) savingsColor = "#f59e0b";
  else savingsColor = "#ef4444";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Budget</h2>

        {/* Month navigation */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setCurrentMonth((m) => subMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium w-28 text-center">
            {format(currentMonth, "MMMM yyyy")}
          </span>
          <button
            onClick={() => setCurrentMonth((m) => addMonths(m, 1))}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Total Budgeted */}
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Total Budgeted</p>
                <div className="text-2xl font-bold tabular-nums">
                  {fmtCents(status?.total_budgeted ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">per month</p>
              </CardContent>
            </Card>

            {/* Total Spent */}
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Total Spent</p>
                <div className="text-2xl font-bold tabular-nums">
                  {fmtCents(status?.total_spent ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {status && status.total_budgeted > 0
                    ? `${Math.round((status.total_spent / status.total_budgeted) * 100)}% of budget`
                    : "this month"}
                </p>
              </CardContent>
            </Card>

            {/* Savings Rate */}
            <Card>
              <CardContent className="p-5">
                <p className="text-sm text-muted-foreground mb-1">Savings Rate</p>
                <div className="flex items-end gap-3">
                  <div
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: savingsColor }}
                  >
                    {savingsRate.toFixed(1)}%
                  </div>
                  <div style={{ color: savingsColor }} className="mb-0.5">
                    <SavingsSparkline data={savingsHistory} />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {savingsRate >= 20
                    ? "Great savings pace"
                    : savingsRate >= 10
                    ? "On track"
                    : "Below target"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Budget list */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Budget Breakdown</CardTitle>
              <button
                onClick={handleSuggest}
                disabled={suggesting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50"
              >
                {suggesting ? (
                  <span className="w-3.5 h-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Auto-Suggest Budgets
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedBudgets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-2">
                  <p className="text-muted-foreground text-sm">No budgets set yet</p>
                  <p className="text-xs text-muted-foreground opacity-60">
                    Use "Auto-Suggest Budgets" to get started
                  </p>
                </div>
              ) : (
                sortedBudgets.map((item) => (
                  <div key={item.budget.id} className="space-y-1">
                    <BudgetProgressBar
                      categoryName={item.budget.category_name ?? "Unnamed"}
                      categoryColor={item.budget.category_color}
                      spent={item.spent_cents / 100}
                      limit={item.budget.monthly_limit_cents / 100}
                      percentage={item.percentage}
                    />
                    <div className="flex justify-end">
                      <InlineLimitEditor budgetItem={item} onSave={handleSetBudget} />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Auto-Suggest Results */}
          {suggestions !== null && (
            <Card>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    Suggested Budgets
                  </CardTitle>
                  <button
                    onClick={() => setSuggestions(null)}
                    className="p-1 rounded-md text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on your spending history. Click Apply to set a budget.
                </p>
              </CardHeader>
              <CardContent>
                {suggestions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Not enough spending history to make suggestions.
                  </p>
                ) : (
                  <div>
                    {suggestions.map((s) => (
                      <SuggestionRow
                        key={s.budget.category_id}
                        suggestion={s}
                        onApply={handleSetBudget}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Unbudgeted Categories */}
          {status && status.unbudgeted_spending > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Unbudgeted Spending</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {fmtCents(status.unbudgeted_spending)} spent on categories without budgets
                </p>
              </CardHeader>
              <CardContent>
                {unbudgetedSpending.length > 0 ? (
                  <div className="space-y-2">
                    {unbudgetedSpending.map((item) => (
                      <div
                        key={item.categoryId}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.categoryColor ?? "#94a3b8" }}
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{item.categoryName}</div>
                            <div className="text-xs text-muted-foreground">
                              {fmtCents(item.spendingCents)} this month
                            </div>
                          </div>
                        </div>
                        {item.isBudgetable ? (
                          <button
                            onClick={() =>
                              api
                                .setBudget(item.categoryId, item.spendingCents)
                                .then(() => loadData())
                            }
                            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors shrink-0"
                          >
                            Set budget to {fmtCents(item.spendingCents)}
                          </button>
                        ) : (
                          <span className="text-xs text-muted-foreground shrink-0">
                            Categorize transactions first
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Spending is distributed across {fmtCents(status.unbudgeted_spending)} in untracked categories.
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
