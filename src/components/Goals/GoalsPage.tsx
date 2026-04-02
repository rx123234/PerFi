import { useState, useEffect, useCallback } from "react";
import { Plus, Target, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import * as api from "@/lib/api";
import type { GoalWithProgress } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import GoalCard from "./GoalCard";
import GoalForm from "./GoalForm";

function Spinner() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16">
      <div className="w-6 h-6 border-2 border-muted-foreground border-t-primary rounded-full animate-spin" />
      <p className="text-sm text-muted-foreground">Loading goals…</p>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editGoal, setEditGoal] = useState<GoalWithProgress | undefined>(undefined);
  const [showCompleted, setShowCompleted] = useState(false);

  const loadGoals = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getGoals();
      setGoals(data);
    } catch (err) {
      console.error("Failed to load goals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  const handleEdit = (goal: GoalWithProgress) => {
    setEditGoal(goal);
    setFormOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this goal? This action cannot be undone.")) return;
    try {
      await api.deleteGoal(id);
      await loadGoals();
    } catch (err) {
      console.error("Failed to delete goal:", err);
    }
  };

  const handleUpdateProgress = async (id: string, currentCents: number) => {
    try {
      await api.updateGoalProgress(id, currentCents);
      await loadGoals();
    } catch (err) {
      console.error("Failed to update progress:", err);
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
    setEditGoal(undefined);
  };

  const activeGoals = goals
    .filter((g) => g.goal.status !== "completed")
    .sort((a, b) => b.goal.priority - a.goal.priority);

  const completedGoals = goals.filter((g) => g.goal.status === "completed");

  const onTrackCount = activeGoals.filter((g) => g.on_track).length;
  const totalCurrentCents = goals.reduce((sum, g) => sum + g.goal.current_cents, 0);
  const totalTargetCents = goals.reduce((sum, g) => sum + g.goal.target_cents, 0);
  const totalProgress = totalTargetCents > 0
    ? (totalCurrentCents / totalTargetCents) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-foreground">Goals</h2>
        <button
          onClick={() => {
            setEditGoal(undefined);
            setFormOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Goal
        </button>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {goals.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Target className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">No goals yet</h3>
              <p className="text-sm text-muted-foreground mb-6 max-w-sm">
                Create your first financial goal and start tracking progress toward what matters most.
              </p>
              <button
                onClick={() => {
                  setEditGoal(undefined);
                  setFormOpen(true);
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Create your first goal
              </button>
            </div>
          ) : (
            <>
              {/* Summary row */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Goals</p>
                  <p className="text-2xl font-bold text-foreground">{goals.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground mb-1">On Track</p>
                  <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                    {onTrackCount}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground mb-1">Completed</p>
                  <p className="text-2xl font-bold text-foreground">{completedGoals.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-surface p-4">
                  <p className="text-xs text-muted-foreground mb-1">Total Saved</p>
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(totalCurrentCents / 100)}
                  </p>
                </div>
              </div>

              {/* Overall progress bar */}
              {totalTargetCents > 0 && (
                <div className="rounded-xl border border-border bg-surface p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Overall Progress</span>
                    <span className="text-sm font-semibold text-foreground">
                      {Math.round(totalProgress)}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, totalProgress)}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5 text-xs text-muted-foreground">
                    <span>{formatCurrency(totalCurrentCents / 100)} saved</span>
                    <span>{formatCurrency(totalTargetCents / 100)} target</span>
                  </div>
                </div>
              )}

              {/* Active goals grid */}
              {activeGoals.length > 0 && (
                <div>
                  {activeGoals.length > 0 && (
                    <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                      Active Goals
                    </p>
                  )}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {activeGoals.map((g) => (
                      <GoalCard
                        key={g.goal.id}
                        goal={g}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onUpdateProgress={handleUpdateProgress}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completed section */}
              {completedGoals.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowCompleted((v) => !v)}
                    className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-3 group"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Completed ({completedGoals.length})
                    {showCompleted ? (
                      <ChevronUp className="h-3.5 w-3.5 group-hover:translate-y-px transition-transform" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 group-hover:translate-y-px transition-transform" />
                    )}
                  </button>
                  {showCompleted && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 opacity-75">
                      {completedGoals.map((g) => (
                        <GoalCard
                          key={g.goal.id}
                          goal={g}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onUpdateProgress={handleUpdateProgress}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Goal form modal */}
      <GoalForm
        isOpen={formOpen}
        onClose={handleFormClose}
        onSave={loadGoals}
        editGoal={editGoal}
      />
    </div>
  );
}
