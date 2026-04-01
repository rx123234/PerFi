import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import * as api from "@/lib/api";
import type { FixedCostsAnalysis, FixedCostItem } from "@/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";

// ─── Constants ──────────────────────────────────────────────────────────────

const CORE_FIXED_CATEGORIES = ["Housing", "Groceries", "Childcare", "Utilities"];
const CORE_FIXED_LABEL = "Core Fixed";
const CORE_FIXED_COLOR = "var(--chart-1)";

// ─── Helpers ────────────────────────────────────────────────────────────────

function shortMonth(isoMonth: string): string {
  const date = new Date(`${isoMonth}-01T00:00:00`);
  return date.toLocaleString("en-US", { month: "short" });
}

function isHighVariance(amount: number, avg: number): boolean {
  if (avg === 0) return false;
  return amount > avg * 1.2;
}

// ─── Data Structures ────────────────────────────────────────────────────────

interface CategoryGroup {
  category: string;
  color: string;
  items: FixedCostItem[];
  monthlyTotals: (number | null)[];
  avgAmount: number;
  totalAvg: number;
}

interface MegaGroup {
  label: string;
  color: string;
  categories: CategoryGroup[];
  monthlyTotals: number[];
  avgAmount: number;
  isMega: true;
}

type TableSection = MegaGroup | (CategoryGroup & { isMega?: false });

function buildCategoryGroups(items: FixedCostItem[], monthCount: number): CategoryGroup[] {
  const map = new Map<string, FixedCostItem[]>();
  for (const item of items) {
    const key = item.category || "Uncategorized";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }

  const groups: CategoryGroup[] = [];
  for (const [category, catItems] of map) {
    const color = catItems[0]?.color || "var(--chart-1)";
    const monthlyTotals: (number | null)[] = [];
    for (let i = 0; i < monthCount; i++) {
      let sum = 0;
      let hasAny = false;
      for (const item of catItems) {
        const amt = item.amounts[i];
        if (amt !== null && amt !== undefined) {
          sum += amt;
          hasAny = true;
        }
      }
      monthlyTotals.push(hasAny ? sum : null);
    }
    const totalAvg = catItems.reduce((s, it) => s + it.avg_amount, 0);
    catItems.sort((a, b) => b.avg_amount - a.avg_amount);
    groups.push({ category, color, items: catItems, monthlyTotals, avgAmount: totalAvg, totalAvg });
  }

  groups.sort((a, b) => b.totalAvg - a.totalAvg);
  return groups;
}

function buildTableSections(items: FixedCostItem[], monthCount: number): TableSection[] {
  const allGroups = buildCategoryGroups(items, monthCount);

  const coreGroups: CategoryGroup[] = [];
  const otherGroups: CategoryGroup[] = [];

  for (const g of allGroups) {
    if (CORE_FIXED_CATEGORIES.includes(g.category)) {
      coreGroups.push(g);
    } else {
      otherGroups.push(g);
    }
  }

  const sections: TableSection[] = [];

  if (coreGroups.length > 0) {
    // Build mega-group monthly totals
    const megaMonthly: number[] = [];
    for (let i = 0; i < monthCount; i++) {
      let sum = 0;
      for (const g of coreGroups) {
        const v = g.monthlyTotals[i];
        if (v !== null && v !== undefined) sum += v;
      }
      megaMonthly.push(sum);
    }
    const megaAvg = coreGroups.reduce((s, g) => s + g.totalAvg, 0);
    // Sort core groups by total descending
    coreGroups.sort((a, b) => b.totalAvg - a.totalAvg);

    sections.push({
      label: CORE_FIXED_LABEL,
      color: CORE_FIXED_COLOR,
      categories: coreGroups,
      monthlyTotals: megaMonthly,
      avgAmount: megaAvg,
      isMega: true,
    });
  }

  if (otherGroups.length > 0) {
    const otherMonthly: number[] = [];
    for (let i = 0; i < monthCount; i++) {
      let sum = 0;
      for (const g of otherGroups) {
        const v = g.monthlyTotals[i];
        if (v !== null && v !== undefined) sum += v;
      }
      otherMonthly.push(sum);
    }
    const otherAvg = otherGroups.reduce((s, g) => s + g.totalAvg, 0);
    otherGroups.sort((a, b) => b.totalAvg - a.totalAvg);

    sections.push({
      label: "Other",
      color: "var(--muted-foreground)",
      categories: otherGroups,
      monthlyTotals: otherMonthly,
      avgAmount: otherAvg,
      isMega: true,
    });
  }

  return sections;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function SummaryCards({ data, trailingMonths }: { data: FixedCostsAnalysis; trailingMonths: number }) {
  const avgFrequency =
    data.items.length > 0
      ? data.items.reduce((sum, item) => sum + item.frequency, 0) / data.items.length
      : 0;
  const coveragePct =
    trailingMonths > 0 ? Math.round((avgFrequency / trailingMonths) * 100) : 0;

  // Core fixed monthly avg
  const coreItems = data.items.filter((i) => CORE_FIXED_CATEGORIES.includes(i.category));
  const coreMonthlyAvg = coreItems.reduce((s, it) => s + it.avg_amount, 0);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Monthly Average</p>
          <p className="text-2xl font-bold">{formatCurrency(data.total_monthly_avg)}</p>
          <p className="text-xs text-muted-foreground mt-1">all fixed costs</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Core Fixed</p>
          <p className="text-2xl font-bold">{formatCurrency(coreMonthlyAvg)}</p>
          <p className="text-xs text-muted-foreground mt-1">housing + groceries + childcare + utilities</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Fixed Items</p>
          <p className="text-2xl font-bold">{data.items.length}</p>
          <p className="text-xs text-muted-foreground mt-1">recurring merchants</p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground mb-1">Coverage</p>
          <p className="text-2xl font-bold">{coveragePct}%</p>
          <p className="text-xs text-muted-foreground mt-1">avg months present out of {trailingMonths}</p>
        </CardContent>
      </Card>
    </div>
  );
}

function TrendChart({ months, monthly_totals }: { months: string[]; monthly_totals: number[] }) {
  const chartData = months.map((m, i) => ({
    month: shortMonth(m),
    total: monthly_totals[i] ?? 0,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Monthly Fixed Costs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value)), "Total"]}
                contentStyle={{
                  backgroundColor: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--popover-foreground)",
                  fontSize: "13px",
                }}
                labelStyle={{ color: "var(--popover-foreground)" }}
                itemStyle={{ color: "var(--popover-foreground)" }}
                cursor={{ fill: "var(--muted-foreground)", opacity: 0.08 }}
              />
              <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function AmountCell({ amount, avg }: { amount: number | null | undefined; avg: number }) {
  const isNull = amount === null || amount === undefined;
  const highlight = !isNull && isHighVariance(amount!, avg);
  return (
    <td
      className="text-right px-3 py-2.5 whitespace-nowrap"
      style={highlight ? { backgroundColor: "color-mix(in srgb, var(--warning) 12%, transparent)" } : undefined}
    >
      {isNull ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className={highlight ? "text-warning font-medium" : ""}>
          {formatCurrency(amount!)}
        </span>
      )}
    </td>
  );
}

// ─── Table ──────────────────────────────────────────────────────────────────

function FixedCostsTable({ months, items, monthly_totals }: { months: string[]; items: FixedCostItem[]; monthly_totals: number[] }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const shortMonths = months.map(shortMonth);
  const sections = useMemo(() => buildTableSections(items, months.length), [items, months.length]);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Fixed Cost Breakdown</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium min-w-[240px]">Category / Merchant</th>
                {shortMonths.map((m, i) => (
                  <th key={i} className="text-right px-3 py-3 font-medium whitespace-nowrap">{m}</th>
                ))}
                <th className="text-right px-3 py-3 font-medium">Avg</th>
                <th className="text-right px-4 py-3 font-medium">Freq</th>
              </tr>
            </thead>
            <tbody>
              {sections.map((section) =>
                section.isMega ? (
                  <MegaGroupRows
                    key={section.label}
                    mega={section}
                    months={months}
                    expanded={expanded}
                    onToggle={toggle}
                  />
                ) : (
                  <CategoryRows
                    key={section.category}
                    group={section}
                    months={months}
                    isOpen={expanded.has(`cat:${section.category}`)}
                    onToggle={() => toggle(`cat:${section.category}`)}
                    indent={0}
                  />
                )
              )}
            </tbody>
            <tfoot>
              <tr className="border-t border-border bg-secondary/30">
                <td className="px-4 py-3 font-semibold text-muted-foreground">Total</td>
                {monthly_totals.map((total, i) => (
                  <td key={i} className="text-right px-3 py-3 font-semibold whitespace-nowrap">
                    {total > 0 ? formatCurrency(total) : <span className="text-muted-foreground">—</span>}
                  </td>
                ))}
                <td className="text-right px-3 py-3 font-semibold whitespace-nowrap">
                  {formatCurrency(
                    monthly_totals.length > 0
                      ? monthly_totals.reduce((a, b) => a + b, 0) / monthly_totals.length
                      : 0
                  )}
                </td>
                <td className="px-4 py-3" />
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function MegaGroupRows({
  mega,
  months,
  expanded,
  onToggle,
}: {
  mega: MegaGroup;
  months: string[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  const megaKey = `mega:${mega.label}`;
  const isOpen = expanded.has(megaKey);
  const megaAvg = mega.monthlyTotals.length > 0
    ? mega.monthlyTotals.reduce((a, b) => a + b, 0) / mega.monthlyTotals.length
    : 0;

  return (
    <>
      {/* Mega header row */}
      <tr
        className="border-b border-border bg-secondary/20 hover:bg-secondary/40 transition-colors cursor-pointer"
        onClick={() => onToggle(megaKey)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            )}
            <span className="w-3 h-3 rounded-sm shrink-0 bg-gradient-to-br from-indigo-500 to-purple-600" />
            <span className="font-bold text-sm">{mega.label}</span>
            <span className="text-muted-foreground text-xs">({mega.categories.length} categories)</span>
          </div>
        </td>
        {mega.monthlyTotals.map((total, i) => (
          <td key={i} className="text-right px-3 py-3 font-bold whitespace-nowrap">
            {formatCurrency(total)}
          </td>
        ))}
        <td className="text-right px-3 py-3 font-bold whitespace-nowrap">
          {formatCurrency(megaAvg)}
        </td>
        <td className="px-4 py-3" />
      </tr>

      {/* Expanded: show each category inside the mega group */}
      {isOpen &&
        mega.categories.map((group) => (
          <CategoryRows
            key={group.category}
            group={group}
            months={months}
            isOpen={expanded.has(`cat:${group.category}`)}
            onToggle={() => onToggle(`cat:${group.category}`)}
            indent={1}
          />
        ))}
    </>
  );
}

function CategoryRows({
  group,
  months,
  isOpen,
  onToggle,
  indent,
}: {
  group: CategoryGroup;
  months: string[];
  isOpen: boolean;
  onToggle: () => void;
  indent: number;
}) {
  const hasManyItems = group.items.length > 1;
  const catAvg = group.monthlyTotals.filter((v): v is number => v !== null).length > 0
    ? group.monthlyTotals.filter((v): v is number => v !== null).reduce((a, b) => a + b, 0) /
      group.monthlyTotals.filter((v) => v !== null).length
    : 0;

  const padLeft = indent === 0 ? "px-4" : "pl-10 pr-4";

  // Single item — show inline
  if (!hasManyItems) {
    const item = group.items[0];
    return (
      <tr className="border-b border-border hover:bg-secondary/40 transition-colors">
        <td className={`${padLeft} py-2.5`}>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            <span className="font-medium">{group.category}</span>
            <span className="text-muted-foreground text-xs">· {item.merchant}</span>
          </div>
        </td>
        {item.amounts.map((amount, i) => (
          <AmountCell key={i} amount={amount} avg={item.avg_amount} />
        ))}
        <td className="text-right px-3 py-2.5 font-medium whitespace-nowrap">
          {formatCurrency(item.avg_amount)}
        </td>
        <td className="text-right px-4 py-2.5 text-muted-foreground whitespace-nowrap">
          {item.frequency}/{months.length}
        </td>
      </tr>
    );
  }

  return (
    <>
      {/* Category summary row */}
      <tr
        className="border-b border-border hover:bg-secondary/40 transition-colors cursor-pointer"
        onClick={onToggle}
      >
        <td className={`${padLeft} py-2.5`}>
          <div className="flex items-center gap-2">
            {isOpen ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            <span className="font-medium">{group.category}</span>
            <span className="text-muted-foreground text-xs">({group.items.length})</span>
          </div>
        </td>
        {group.monthlyTotals.map((total, i) => (
          <td key={i} className="text-right px-3 py-2.5 font-medium whitespace-nowrap">
            {total !== null ? formatCurrency(total) : <span className="text-muted-foreground">—</span>}
          </td>
        ))}
        <td className="text-right px-3 py-2.5 font-medium whitespace-nowrap">
          {formatCurrency(catAvg)}
        </td>
        <td className="text-right px-4 py-2.5 text-muted-foreground whitespace-nowrap" />
      </tr>

      {/* Expanded merchant rows */}
      {isOpen &&
        group.items.map((item) => {
          const merchantPad = indent === 0 ? "pl-12 pr-4" : "pl-[72px] pr-4";
          return (
            <tr
              key={item.merchant}
              className="border-b border-border hover:bg-secondary/20 transition-colors"
            >
              <td className={`${merchantPad} py-2`}>
                <span className="text-secondary-foreground" title={item.merchant}>
                  {item.merchant.length > 30 ? item.merchant.slice(0, 30) + "…" : item.merchant}
                </span>
              </td>
              {item.amounts.map((amount, i) => (
                <AmountCell key={i} amount={amount} avg={item.avg_amount} />
              ))}
              <td className="text-right px-3 py-2 text-muted-foreground whitespace-nowrap">
                {formatCurrency(item.avg_amount)}
              </td>
              <td className="text-right px-4 py-2 text-muted-foreground whitespace-nowrap">
                {item.frequency}/{months.length}
              </td>
            </tr>
          );
        })}
    </>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

const TRAILING_OPTIONS = [3, 6, 12] as const;
type TrailingMonths = (typeof TRAILING_OPTIONS)[number];

export default function FixedCostsPage() {
  const [trailingMonths, setTrailingMonths] = useState<TrailingMonths>(6);
  const [data, setData] = useState<FixedCostsAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getFixedCosts(trailingMonths);
      setData(result);
    } catch (err) {
      console.error("Failed to load fixed costs:", err);
      setError("Failed to load fixed costs data.");
    } finally {
      setLoading(false);
    }
  }, [trailingMonths]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Fixed Costs</h2>
        <div className="flex gap-1 rounded-lg bg-secondary p-1">
          {TRAILING_OPTIONS.map((m) => (
            <button
              key={m}
              onClick={() => setTrailingMonths(m)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                trailingMonths === m
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m}M
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing recurring costs...</p>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center justify-center h-32">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground text-sm max-w-sm text-center leading-relaxed">
            No recurring costs detected yet. Fixed costs are identified by merchants
            that charge you regularly across multiple months.
          </p>
        </div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <SummaryCards data={data} trailingMonths={trailingMonths} />
          <TrendChart months={data.months} monthly_totals={data.monthly_totals} />
          <FixedCostsTable months={data.months} items={data.items} monthly_totals={data.monthly_totals} />
        </>
      )}
    </div>
  );
}
