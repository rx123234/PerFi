import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import * as api from "@/lib/api";
import type { Category, CategoryRule } from "@/lib/types";
import { Plus, Trash2, RefreshCw } from "lucide-react";

export default function CategoryManager() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState("#6366f1");
  const [newRulePattern, setNewRulePattern] = useState("");
  const [newRuleCategoryId, setNewRuleCategoryId] = useState("");
  const [recatCount, setRecatCount] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    const [cats, rs] = await Promise.all([api.getCategories(), api.getCategoryRules()]);
    setCategories(cats);
    setRules(rs);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    await api.createCategory(newCatName, newCatColor, null);
    setNewCatName("");
    loadData();
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Delete this category? Transactions will become uncategorized.")) return;
    await api.deleteCategory(id);
    loadData();
  };

  const handleCreateRule = async () => {
    if (!newRulePattern.trim() || !newRuleCategoryId) return;
    await api.createCategoryRule(newRulePattern, newRuleCategoryId, 10);
    setNewRulePattern("");
    setNewRuleCategoryId("");
    loadData();
  };

  const handleDeleteRule = async (id: string) => {
    await api.deleteCategoryRule(id);
    loadData();
  };

  const handleRecategorize = async () => {
    const count = await api.recategorizeTransactions();
    setRecatCount(count);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Categories & Rules</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Categories */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Categories</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="New category name"
                className="flex-1"
              />
              <input
                type="color"
                value={newCatColor}
                onChange={(e) => setNewCatColor(e.target.value)}
                className="h-9 w-9 rounded border cursor-pointer"
              />
              <Button onClick={handleCreateCategory} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-96 overflow-auto">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color || "#ccc" }} />
                    <span className="text-sm">{cat.name}</span>
                  </div>
                  {!cat.id.startsWith("cat-") && (
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Rules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Categorization Rules</CardTitle>
            <Button variant="outline" size="sm" onClick={handleRecategorize}>
              <RefreshCw className="h-4 w-4" />
              Re-categorize
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {recatCount !== null && (
              <p className="text-sm text-green-600">{recatCount} transactions re-categorized</p>
            )}
            <div className="flex gap-2">
              <Input
                value={newRulePattern}
                onChange={(e) => setNewRulePattern(e.target.value)}
                placeholder="Match pattern (e.g., STARBUCKS)"
                className="flex-1"
              />
              <select
                value={newRuleCategoryId}
                onChange={(e) => setNewRuleCategoryId(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                <option value="">Category...</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <Button onClick={handleCreateRule} size="sm">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-1 max-h-96 overflow-auto">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs">{rule.pattern}</code>
                    <span className="text-muted-foreground">→</span>
                    <Badge variant="secondary">{rule.category_name || rule.category_id}</Badge>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleDeleteRule(rule.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
