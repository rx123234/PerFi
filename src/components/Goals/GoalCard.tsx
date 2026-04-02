import { useState } from "react";
import { Pencil, Trash2, CheckCircle2, TrendingUp, TrendingDown, Minus, ChevronDown } from "lucide-react";
import { format, parseISO } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress-ring";
import { formatCurrency } from "@/lib/utils";
import type { GoalWithProgress } from "@/lib/types";

const GOAL_TYPE_LABELS: Record<string, string> = {
  emergency_fund: "Emergency Fund",
  house_down_payment: "House Down Payment",
  debt_payoff: "Debt Payoff",
  retirement: "Retirement",
  college_529: "College 529",
  custom: "Custom",
};

const GOAL_TYPE_COLORS: Record<string, string> = {
  emergency_fund: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  house_down_payment: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  debt_payoff: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  retirement: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400",
  college_529: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  custom: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
};

function getStatusInfo(gwp: GoalWithProgress): {
  label: string;
  className: string;
  icon: React.ReactNode;
} {
  const { goal, on_track, projected_completion_date } = gwp;

  if (goal.status === "completed") {
    return {
      label: "Completed",
      className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
      icon: <CheckCircle2 className="h-3 w-3" />,
    };
  }

  if (!projected_completion_date) {
    return {
      label: "No contributions",
      className: "bg-muted text-muted-foreground",
      icon: <Minus className="h-3 w-3" />,
    };
  }

  if (!goal.target_date) {
    return {
      label: "In progress",
      className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
      icon: <TrendingUp className="h-3 w-3" />,
    };
  }

  if (on_track) {
    const projDate = parseISO(projected_completion_date);
    const targetDate = parseISO(goal.target_date);
    const isAhead = projDate < targetDate;
    return isAhead
      ? {
          label: "Ahead",
          className: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
          icon: <TrendingUp className="h-3 w-3" />,
        }
      : {
          label: "On Track",
          className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
          icon: <TrendingUp className="h-3 w-3" />,
        };
  }

  return {
    label: "Behind",
    className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    icon: <TrendingDown className="h-3 w-3" />,
  };
}

function getRingColor(gwp: GoalWithProgress): string {
  const { goal, on_track } = gwp;
  if (goal.color) return goal.color;
  if (goal.status === "completed") return "#10b981";
  if (!on_track) return "#ef4444";
  return "#6366f1";
}

interface GoalCardProps {
  goal: GoalWithProgress;
  onEdit: (goal: GoalWithProgress) => void;
  onDelete: (id: string) => void;
  onUpdateProgress: (id: string, currentCents: number) => void;
}

export default function GoalCard({ goal: gwp, onEdit, onDelete, onUpdateProgress }: GoalCardProps) {
  const { goal, percentage, projected_completion_date, months_remaining } = gwp;
  const [showProgressInput, setShowProgressInput] = useState(false);
  const [progressValue, setProgressValue] = useState(
    (goal.current_cents / 100).toFixed(2)
  );
  const [saving, setSaving] = useState(false);

  const status = getStatusInfo(gwp);
  const ringColor = getRingColor(gwp);
  const isCompleted = goal.status === "completed";

  const handleProgressSave = async () => {
    setSaving(true);
    try {
      const cents = Math.round(parseFloat(progressValue) * 100);
      if (!isNaN(cents)) {
        await onUpdateProgress(goal.id, cents);
      }
    } finally {
      setSaving(false);
      setShowProgressInput(false);
    }
  };

  const formattedProjected = projected_completion_date
    ? format(parseISO(projected_completion_date), "MMM yyyy")
    : null;

  const formattedCompleted = goal.completed_at
    ? format(parseISO(goal.completed_at), "MMM d, yyyy")
    : null;

  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md bg-surface">
      {/* Completed overlay stripe */}
      {isCompleted && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-emerald-500" />
      )}

      <CardContent className="p-5">
        <div className="flex gap-4">
          {/* Progress ring */}
          <div className="relative shrink-0">
            <ProgressRing
              percentage={percentage}
              size={80}
              strokeWidth={7}
              color={ringColor}
              label={`${Math.round(percentage)}%`}
            />
            {isCompleted && (
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              </div>
            )}
          </div>

          {/* Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="font-semibold text-foreground truncate leading-tight">{goal.name}</h3>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      GOAL_TYPE_COLORS[goal.goal_type] ?? GOAL_TYPE_COLORS.custom
                    }`}
                  >
                    {GOAL_TYPE_LABELS[goal.goal_type] ?? goal.goal_type}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}
                  >
                    {status.icon}
                    {status.label}
                  </span>
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => onEdit(gwp)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                  aria-label="Edit goal"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(goal.id)}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Delete goal"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Amounts */}
            <div className="mt-2.5 flex items-baseline gap-1.5">
              <span className="text-base font-bold text-foreground">
                {formatCurrency(goal.current_cents / 100)}
              </span>
              <span className="text-xs text-muted-foreground">of</span>
              <span className="text-sm font-medium text-muted-foreground">
                {formatCurrency(goal.target_cents / 100)}
              </span>
            </div>

            {/* Progress bar */}
            <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, percentage)}%`,
                  backgroundColor: ringColor,
                }}
              />
            </div>

            {/* Footer info */}
            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
              {isCompleted ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                  Completed on {formattedCompleted}
                </span>
              ) : formattedProjected ? (
                <span>
                  Estimated:{" "}
                  <span className="font-medium text-foreground">{formattedProjected}</span>
                  {months_remaining !== null && (
                    <span className="ml-1 text-muted-foreground">
                      ({months_remaining} mo)
                    </span>
                  )}
                </span>
              ) : (
                <span className="italic">No contributions set</span>
              )}
              {goal.monthly_contribution_cents > 0 && (
                <span>
                  {formatCurrency(goal.monthly_contribution_cents / 100)}/mo
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Update progress section */}
        {!isCompleted && (
          <div className="mt-3 pt-3 border-t border-border">
            {showProgressInput ? (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    value={progressValue}
                    onChange={(e) => setProgressValue(e.target.value)}
                    className="w-full pl-6 pr-3 py-1.5 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder="0.00"
                    step="0.01"
                    min="0"
                    autoFocus
                  />
                </div>
                <button
                  onClick={handleProgressSave}
                  disabled={saving}
                  className="px-3 py-1.5 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => {
                    setShowProgressInput(false);
                    setProgressValue((goal.current_cents / 100).toFixed(2));
                  }}
                  className="px-3 py-1.5 text-sm rounded-md text-muted-foreground hover:bg-accent transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowProgressInput(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
              >
                <ChevronDown className="h-3 w-3 group-hover:translate-y-0.5 transition-transform" />
                Update Progress
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
