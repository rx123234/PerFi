import { useState, useEffect, useCallback, useRef } from "react";
import { TrendingUp, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Save, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import * as api from "@/lib/api";
import type { RetirementProfile, RetirementProjection, RetirementScenario } from "@/lib/types";
import ScenarioSliders from "./ScenarioSliders";
import ProjectionChart from "./ProjectionChart";

// ─── Formatting helpers ────────────────────────────────────────────────────────

function formatCurrencyFull(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function formatCurrencyCompact(cents: number): string {
  const dollars = cents / 100;
  if (dollars >= 1_000_000) {
    return `$${(dollars / 1_000_000).toFixed(1)}M`;
  }
  if (dollars >= 1_000) {
    return `$${(dollars / 1_000).toFixed(0)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}

// ─── Setup form ───────────────────────────────────────────────────────────────

interface SetupFormProps {
  onComplete: () => void;
}

function SetupForm({ onComplete }: SetupFormProps) {
  const [currentAge, setCurrentAge] = useState(35);
  const [retirementAge, setRetirementAge] = useState(65);
  const [annualIncome, setAnnualIncome] = useState("");
  const [monthlySS, setMonthlySS] = useState("");
  const [filingStatus, setFilingStatus] = useState("married_filing_jointly");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const incomeCents = Math.round(parseFloat(annualIncome.replace(/[^0-9.]/g, "") || "0") * 100);
      const ssCents = monthlySS ? Math.round(parseFloat(monthlySS.replace(/[^0-9.]/g, "")) * 100) : null;
      await api.saveRetirementProfile(
        currentAge,
        retirementAge,
        90,
        incomeCents || null,
        0.03,
        ssCents,
        67,
        0.80,
        0.03,
        0.07,
        0.05,
        0.04,
        0.22,
        null,
        filingStatus
      );
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full px-3 py-2.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-xl font-bold text-foreground mb-2">Retirement Planner</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Answer a few questions and we'll run 1,000 simulated market scenarios to estimate
            your probability of a comfortable retirement.
          </p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Your Age</label>
                  <input
                    type="number"
                    value={currentAge}
                    onChange={(e) => setCurrentAge(Number(e.target.value))}
                    className={inputClass}
                    min={18}
                    max={80}
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">Target Retirement Age</label>
                  <input
                    type="number"
                    value={retirementAge}
                    onChange={(e) => setRetirementAge(Number(e.target.value))}
                    className={inputClass}
                    min={50}
                    max={80}
                    required
                  />
                  <p className="text-xs text-muted-foreground mt-1">You can adjust this later with a slider</p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Annual Household Income</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={annualIncome}
                    onChange={(e) => setAnnualIncome(e.target.value)}
                    className={`${inputClass} pl-6`}
                    placeholder="150,000"
                    step="1000"
                    min="0"
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Used to estimate tax impact and savings rate</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">
                  Expected Social Security (monthly)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={monthlySS}
                    onChange={(e) => setMonthlySS(e.target.value)}
                    className={`${inputClass} pl-6`}
                    placeholder="2,500"
                    step="100"
                    min="0"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Check <a href="https://www.ssa.gov/myaccount/" target="_blank" rel="noreferrer" className="underline">ssa.gov/myaccount</a> for your estimate. Leave blank if unsure.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1">Tax Filing Status</label>
                <select
                  value={filingStatus}
                  onChange={(e) => setFilingStatus(e.target.value)}
                  className={inputClass}
                >
                  <option value="single">Single</option>
                  <option value="married_filing_jointly">Married Filing Jointly</option>
                  <option value="married_filing_separately">Married Filing Separately</option>
                  <option value="head_of_household">Head of Household</option>
                </select>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground space-y-1">
                <p><strong>What happens next:</strong></p>
                <p>We'll pull your retirement account balances from Net Worth and run a Monte Carlo simulation &mdash; 1,000 randomized market scenarios with varying stock returns, inflation, and sequence-of-returns risk. You'll see your probability of not running out of money, and can adjust assumptions with sliders in real-time.</p>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 px-4 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Running simulation…
                  </>
                ) : (
                  "Run My Projection"
                )}
              </button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Success probability indicator ───────────────────────────────────────────

function SuccessIndicator({ probability }: { probability: number }) {
  // probability comes as 0.0–1.0 fraction, convert to percentage
  const pct = probability <= 1.0 ? probability * 100 : probability;
  const isGreen = pct >= 80;
  const isYellow = pct >= 60 && pct < 80;

  return (
    <div
      className={`text-3xl font-bold ${
        isGreen
          ? "text-emerald-600 dark:text-emerald-400"
          : isYellow
          ? "text-amber-600 dark:text-amber-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {Math.round(pct)}%
    </div>
  );
}

// ─── Metric card ─────────────────────────────────────────────────────────────

interface MetricCardProps {
  label: string;
  value: React.ReactNode;
  sublabel?: string;
  icon?: React.ReactNode;
}

function MetricCard({ label, value, sublabel, icon }: MetricCardProps) {
  return (
    <Card className="bg-surface">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-1.5">{label}</p>
            <div>{value}</div>
            {sublabel && <p className="text-xs text-muted-foreground mt-1">{sublabel}</p>}
          </div>
          {icon && (
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              {icon}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Spinner ─────────────────────────────────────────────────────────────────

function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16">
      <div className="w-6 h-6 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
      {label && <p className="text-sm text-muted-foreground">{label}</p>}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function RetirementPage() {
  const [profile, setProfile] = useState<RetirementProfile | null>(null);
  const [projection, setProjection] = useState<RetirementProjection | null>(null);
  const [ssComparison, setSsComparison] = useState<[number, number, number][]>([]);
  const [scenarios, setScenarios] = useState<RetirementScenario[]>([]);
  const [overrides, setOverrides] = useState<Partial<RetirementProfile>>({});
  const [loading, setLoading] = useState(true);
  const [projecting, setProjecting] = useState(false);
  const [showScenarios, setShowScenarios] = useState(false);
  const [scenarioName, setScenarioName] = useState("");
  const [savingScenario, setSavingScenario] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const state = await api.getRetirementProfileState();
      setProfile(state.profile);
      setNeedsSetup(!state.has_saved_profile);
    } catch {
      setNeedsSetup(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const runProjection = useCallback(
    async (currentProfile: RetirementProfile, currentOverrides: Partial<RetirementProfile>) => {
      setProjecting(true);
      try {
        const merged = { ...currentProfile, ...currentOverrides };
        const overridesJson =
          Object.keys(currentOverrides).length > 0
            ? JSON.stringify(currentOverrides)
            : undefined;
        const [proj, ss, scens] = await Promise.all([
          api.runRetirementProjection(overridesJson),
          api.getSsComparison(),
          api.getRetirementScenarios(),
        ]);
        setProjection(proj);
        setSsComparison(ss);
        setScenarios(scens);
        // Keep profile in sync with merged values for display
        setProfile(merged as RetirementProfile);
      } catch (err) {
        console.error("Projection failed:", err);
      } finally {
        setProjecting(false);
      }
    },
    []
  );

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile) return;
    runProjection(profile, overrides);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.current_age]); // Only run on initial profile load

  const handleOverrideUpdate = useCallback(
    (updates: Partial<RetirementProfile>) => {
      setOverrides((prev) => {
        const next = { ...prev, ...updates };

        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          if (profile) runProjection(profile, next);
        }, 500);

        return next;
      });
    },
    [profile, runProjection]
  );

  const handleSetupComplete = useCallback(async () => {
    setNeedsSetup(false);
    setLoading(true);
    try {
      const state = await api.getRetirementProfileState();
      setProfile(state.profile);
      await runProjection(state.profile, {});
    } finally {
      setLoading(false);
    }
  }, [runProjection]);

  const handleSaveScenario = async () => {
    if (!scenarioName.trim()) return;
    setSavingScenario(true);
    try {
      await api.saveRetirementScenario(
        scenarioName.trim(),
        null,
        JSON.stringify(overrides)
      );
      const scens = await api.getRetirementScenarios();
      setScenarios(scens);
      setScenarioName("");
      setShowSaveInput(false);
    } catch (err) {
      console.error("Failed to save scenario:", err);
    } finally {
      setSavingScenario(false);
    }
  };

  if (loading) return <Spinner label="Loading retirement profile…" />;
  if (needsSetup) return <SetupForm onComplete={handleSetupComplete} />;
  if (!profile) return null;

  const effectiveProfile = { ...profile, ...overrides } as RetirementProfile;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Retirement</h2>
        <div className="flex items-center gap-2">
          {projecting && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Recalculating…
            </span>
          )}
          <button
            onClick={() => setShowSaveInput((v) => !v)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-border text-foreground hover:bg-accent transition-colors"
          >
            <Save className="h-3.5 w-3.5" />
            Save Scenario
          </button>
        </div>
      </div>

      {/* Save scenario input */}
      {showSaveInput && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-border bg-surface">
          <input
            type="text"
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
            placeholder="Scenario name (e.g. Retire at 60)"
            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleSaveScenario()}
            autoFocus
          />
          <button
            onClick={handleSaveScenario}
            disabled={savingScenario || !scenarioName.trim()}
            className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {savingScenario ? "Saving…" : "Save"}
          </button>
          <button
            onClick={() => setShowSaveInput(false)}
            className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Explainer */}
      <div className="bg-muted/40 rounded-lg px-4 py-3 text-xs text-muted-foreground leading-relaxed">
        <strong className="text-foreground">How to read this:</strong> We simulated 1,000 possible futures for your portfolio
        using randomized market returns. The <strong>Success Probability</strong> is the % of those futures where your money lasts
        through retirement. The chart shows the range of outcomes. Use the sliders on the left to see how changing
        your retirement age, savings rate, or assumptions affects your odds.
      </div>

      {/* Metric cards */}
      {projection && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard
            label="Success Probability"
            value={<SuccessIndicator probability={projection.success_probability} />}
            sublabel="of 1,000 simulated futures"
            icon={
              projection.success_probability * 100 >= 80 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-amber-500" />
              )
            }
          />
          <MetricCard
            label="Portfolio at Retirement"
            value={
              <div className="text-2xl font-bold text-foreground">
                {formatCurrencyCompact(projection.median_portfolio_at_retirement * 100)}
              </div>
            }
            sublabel="median estimate"
          />
          <MetricCard
            label="Monthly Income"
            value={
              <div className="text-2xl font-bold text-foreground">
                {formatCurrencyFull(projection.monthly_retirement_income * 100)}
              </div>
            }
            sublabel="estimated monthly"
          />
          <MetricCard
            label="Years Funded"
            value={
              <div className="text-2xl font-bold text-foreground">
                {Math.round(projection.years_funded_median)}
                <span className="text-base font-normal text-muted-foreground ml-1">yrs</span>
              </div>
            }
            sublabel={`to age ${Math.round(effectiveProfile.retirement_age + projection.years_funded_median)}`}
          />
        </div>
      )}

      {/* Main content: sliders + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sliders sidebar */}
        <Card className="bg-surface">
          <CardContent className="p-5">
            <ScenarioSliders
              profile={effectiveProfile}
              onUpdate={handleOverrideUpdate}
            />
          </CardContent>
        </Card>

        {/* Projection chart */}
        <Card className="lg:col-span-2 bg-surface">
          <CardContent className="p-5">
            {projecting && !projection ? (
              <Spinner label="Running Monte Carlo projection…" />
            ) : projection ? (
              <ProjectionChart
                data={projection.yearly_data}
                retirementAge={effectiveProfile.retirement_age}
              />
            ) : (
              <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                Projection data unavailable
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Social Security Comparison */}
      {ssComparison.length > 0 && (
        <Card className="bg-surface">
          <CardContent className="p-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-4">
              Social Security Comparison
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 pr-4 font-medium text-muted-foreground">
                      Claiming Age
                    </th>
                    <th className="text-right py-2 px-4 font-medium text-muted-foreground">
                      Monthly Benefit
                    </th>
                    <th className="text-right py-2 pl-4 font-medium text-muted-foreground">
                      Annual Benefit
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ssComparison.map(([age, monthly, annual]) => {
                    const isSelected = age === effectiveProfile.ss_claiming_age;
                    return (
                      <tr
                        key={age}
                        className={`border-b border-border/50 last:border-0 transition-colors ${
                          isSelected ? "bg-primary/5" : ""
                        }`}
                      >
                        <td className="py-3 pr-4 font-medium text-foreground">
                          Age {age}
                          {isSelected && (
                            <span className="ml-2 text-xs text-primary font-medium">(selected)</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right text-foreground">
                          {formatCurrencyFull(monthly * 100)}/mo
                        </td>
                        <td className="py-3 pl-4 text-right text-foreground">
                          {formatCurrencyFull(annual * 100)}/yr
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Saved Scenarios */}
      <div>
        <button
          onClick={() => setShowScenarios((v) => !v)}
          className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-3 group"
        >
          Saved Scenarios ({scenarios.length})
          {showScenarios ? (
            <ChevronUp className="h-3.5 w-3.5 group-hover:-translate-y-px transition-transform" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 group-hover:translate-y-px transition-transform" />
          )}
        </button>

        {showScenarios && (
          <Card className="bg-surface">
            <CardContent className="p-5">
              {scenarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No saved scenarios yet. Adjust the sliders and save a scenario to compare later.
                </p>
              ) : (
                <div className="divide-y divide-border">
                  {scenarios.map((s) => {
                    let overridesDisplay: string[] = [];
                    try {
                      const parsed = JSON.parse(s.overrides_json) as Record<string, unknown>;
                      overridesDisplay = Object.entries(parsed).map(
                        ([k, v]) => `${k.replace(/_/g, " ")}: ${v}`
                      );
                    } catch {
                      // ignore parse errors
                    }
                    return (
                      <div key={s.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-medium text-foreground">{s.name}</p>
                            {s.description && (
                              <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                            )}
                            {overridesDisplay.length > 0 && (
                              <p className="text-xs text-muted-foreground mt-1 font-mono">
                                {overridesDisplay.slice(0, 3).join(" · ")}
                                {overridesDisplay.length > 3 && ` +${overridesDisplay.length - 3} more`}
                              </p>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {new Date(s.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
