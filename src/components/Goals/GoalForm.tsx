import { useState, useEffect, useCallback } from "react";
import { Modal } from "@/components/ui/modal";
import * as api from "@/lib/api";
import type { GoalWithProgress } from "@/lib/types";

const GOAL_TYPES = [
  { value: "emergency_fund", label: "Emergency Fund" },
  { value: "house_down_payment", label: "House Down Payment" },
  { value: "debt_payoff", label: "Debt Payoff" },
  { value: "retirement", label: "Retirement" },
  { value: "college_529", label: "College 529" },
  { value: "custom", label: "Custom" },
];

const PRESET_COLORS = [
  "#6366f1", // indigo
  "#10b981", // emerald
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
];

function parseDollars(val: string): number {
  const n = parseFloat(val.replace(/[^0-9.]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2);
}

function projectedMonths(targetCents: number, currentCents: number, monthlyContribCents: number): number | null {
  if (monthlyContribCents <= 0) return null;
  const remaining = targetCents - currentCents;
  if (remaining <= 0) return 0;
  return Math.ceil(remaining / monthlyContribCents);
}

interface GoalFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  editGoal?: GoalWithProgress;
}

export default function GoalForm({ isOpen, onClose, onSave, editGoal }: GoalFormProps) {
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState("custom");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [monthlyContrib, setMonthlyContrib] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [priority, setPriority] = useState(3);
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [calcLoading, setCalcLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Populate form when editing
  useEffect(() => {
    if (!isOpen) return;
    if (editGoal) {
      const g = editGoal.goal;
      setName(g.name);
      setGoalType(g.goal_type);
      setTargetAmount(centsToDisplay(g.target_cents));
      setCurrentAmount(centsToDisplay(g.current_cents));
      setMonthlyContrib(centsToDisplay(g.monthly_contribution_cents));
      setTargetDate(g.target_date ?? "");
      setPriority(g.priority);
      setColor(g.color ?? PRESET_COLORS[0]);
      setNotes(g.notes ?? "");
    } else {
      setName("");
      setGoalType("custom");
      setTargetAmount("");
      setCurrentAmount("0.00");
      setMonthlyContrib("0.00");
      setTargetDate("");
      setPriority(3);
      setColor(PRESET_COLORS[0]);
      setNotes("");
    }
    setError(null);
  }, [isOpen, editGoal]);

  const handleCalcEmergencyFund = useCallback(async () => {
    setCalcLoading(true);
    try {
      const targetCents = await api.getEmergencyFundTarget();
      setTargetAmount(centsToDisplay(targetCents));
    } catch {
      // silently fail
    } finally {
      setCalcLoading(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const targetCents = parseDollars(targetAmount);
    const currentCents = parseDollars(currentAmount);
    const monthlyContribCents = parseDollars(monthlyContrib);

    if (!name.trim()) {
      setError("Goal name is required.");
      return;
    }
    if (targetCents <= 0) {
      setError("Target amount must be greater than $0.");
      return;
    }

    setSaving(true);
    try {
      if (editGoal) {
        await api.updateGoal(
          editGoal.goal.id,
          name.trim(),
          goalType,
          targetCents,
          currentCents,
          monthlyContribCents,
          targetDate || null,
          priority,
          null,
          color,
          notes || null,
          editGoal.goal.status
        );
      } else {
        await api.createGoal(
          name.trim(),
          goalType,
          targetCents,
          currentCents,
          monthlyContribCents,
          targetDate || null,
          priority,
          null,
          null,
          color,
          notes || null
        );
      }
      onSave();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save goal.");
    } finally {
      setSaving(false);
    }
  };

  // Computed projection
  const targetCents = parseDollars(targetAmount);
  const currentCents = parseDollars(currentAmount);
  const monthlyContribCents = parseDollars(monthlyContrib);
  const projMonths = projectedMonths(targetCents, currentCents, monthlyContribCents);

  const inputClass =
    "w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors";
  const labelClass = "block text-sm font-medium text-foreground mb-1";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={editGoal ? "Edit Goal" : "Create New Goal"}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Name */}
        <div>
          <label className={labelClass}>Goal Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
            placeholder="e.g. House down payment"
            required
          />
        </div>

        {/* Goal Type */}
        <div>
          <label className={labelClass}>Goal Type</label>
          <select
            value={goalType}
            onChange={(e) => setGoalType(e.target.value)}
            className={inputClass}
          >
            {GOAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* Target Amount */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className={labelClass.replace("mb-1", "")}>Target Amount</label>
            {goalType === "emergency_fund" && (
              <button
                type="button"
                onClick={handleCalcEmergencyFund}
                disabled={calcLoading}
                className="text-xs text-primary hover:text-primary/80 font-medium transition-colors disabled:opacity-50"
              >
                {calcLoading ? "Calculating…" : "Auto-calculate"}
              </button>
            )}
          </div>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className={`${inputClass} pl-6`}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>
        </div>

        {/* Current Amount */}
        <div>
          <label className={labelClass}>Current Amount</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number"
              value={currentAmount}
              onChange={(e) => setCurrentAmount(e.target.value)}
              className={`${inputClass} pl-6`}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        {/* Monthly Contribution */}
        <div>
          <label className={labelClass}>Monthly Contribution</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              type="number"
              value={monthlyContrib}
              onChange={(e) => setMonthlyContrib(e.target.value)}
              className={`${inputClass} pl-6`}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>
          {projMonths !== null && projMonths > 0 && (
            <p className="mt-1.5 text-xs text-muted-foreground">
              Projected completion:{" "}
              <span className="font-medium text-foreground">
                {projMonths} month{projMonths !== 1 ? "s" : ""}
              </span>
            </p>
          )}
          {projMonths === 0 && (
            <p className="mt-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
              Goal already reached!
            </p>
          )}
        </div>

        {/* Two-column row: Target Date + Priority */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Target Date (optional)</label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Priority</label>
            <select
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value))}
              className={inputClass}
            >
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  {p} — {p === 1 ? "Lowest" : p === 5 ? "Highest" : p === 3 ? "Medium" : p < 3 ? "Low" : "High"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Color Picker */}
        <div>
          <label className={labelClass}>Color</label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="w-7 h-7 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
                style={{
                  backgroundColor: c,
                  borderColor: color === c ? "var(--color-foreground)" : "transparent",
                  boxShadow: color === c ? `0 0 0 2px var(--color-background), 0 0 0 4px ${c}` : "none",
                }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className={labelClass}>Notes (optional)</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`${inputClass} resize-none`}
            rows={2}
            placeholder="Any additional details…"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg text-muted-foreground hover:bg-accent transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving…" : editGoal ? "Save Changes" : "Create Goal"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
