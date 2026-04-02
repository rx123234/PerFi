import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TellerSettings from "./TellerSettings";
import CategoryManager from "../Categories/CategoryManager";
import CsvImport from "../Import/CsvImport";
import { Sun, Moon, Database, ShieldCheck, Tags, Upload } from "lucide-react";
import { getTheme, toggleTheme } from "@/lib/theme";
import * as api from "@/lib/api";
import type { Account, TellerConfigMeta, Category, CategoryRule } from "@/lib/types";

export default function SettingsPage() {
  const [tab, setTab] = useState("general");
  const [theme, setTheme] = useState(getTheme);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [teller, setTeller] = useState<TellerConfigMeta | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [rules, setRules] = useState<CategoryRule[]>([]);

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  useEffect(() => {
    Promise.all([
      api.getAccounts(),
      api.getTellerConfig(),
      api.getCategories(),
      api.getCategoryRules(),
    ])
      .then(([loadedAccounts, tellerMeta, loadedCategories, loadedRules]) => {
        setAccounts(loadedAccounts);
        setTeller(tellerMeta);
        setCategories(loadedCategories);
        setRules(loadedRules);
      })
      .catch((err) => {
        console.error("Failed to load settings summary:", err);
      });
  }, []);

  const connectedAccounts = accounts.filter((account) => account.source === "teller").length;
  const manualAccounts = accounts.length - connectedAccounts;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Settings</h2>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-[1.8rem] border border-border/80 bg-panel/80 px-6 py-5 backdrop-blur-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Control Center
            </p>
            <h3 className="mt-2 text-xl font-semibold">Connection, import, and categorization trust live here.</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Use Settings to verify live data is configured, manual imports are mapped correctly, and your categories
              stay clean enough for forecasts and insights to be credible.
            </p>
          </div>
          <div className="rounded-[1.8rem] border border-border/80 bg-background/60 px-5 py-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Recommended Next
            </p>
            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
              <p>{accounts.length === 0 ? "Add your first account to unlock dashboard insights." : "Review account coverage and sync paths."}</p>
              <p>{teller?.is_configured ? "Teller is configured. Connect live accounts when you want refreshable data." : "Configure Teller if you want live transaction sync."}</p>
              <p>{rules.length > 0 ? "Your categorization rules are active. Revisit them after large imports." : "Add a few categorization rules after your first import to keep data clean."}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Database className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Accounts</p>
            </div>
            <p className="mt-3 text-2xl font-semibold">{accounts.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{connectedAccounts} live, {manualAccounts} manual</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Teller</p>
            </div>
            <p className="mt-3 text-2xl font-semibold">{teller?.is_configured ? "Ready" : "Setup"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {teller?.is_configured ? `${teller.environment} environment configured` : "No live sync configured yet"}
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Tags className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Categories</p>
            </div>
            <p className="mt-3 text-2xl font-semibold">{categories.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">{rules.length} auto-categorization rules</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-card px-4 py-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Upload className="h-4 w-4" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">Imports</p>
            </div>
            <p className="mt-3 text-2xl font-semibold">{accounts.length > 0 ? "Ready" : "Blocked"}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {accounts.length > 0 ? "CSV import can target any existing account." : "Create an account before importing files."}
            </p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="teller">Teller</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
          <TabsTrigger value="import">Import</TabsTrigger>
        </TabsList>

        <TabsContent value="general" activeValue={tab}>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-card">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">
                  Switch between dark and light mode
                </p>
              </div>
              <button
                onClick={handleThemeToggle}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-accent transition-colors text-sm"
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="h-4 w-4" /> Light Mode
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4" /> Dark Mode
                  </>
                )}
              </button>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="font-medium">What to configure first</p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p className="text-sm font-medium">1. Accounts</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Add at least one checking or credit-card account so Home can show cash flow and spending patterns.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p className="text-sm font-medium">2. Teller or CSV</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Choose live sync for refreshable data or import CSVs when you want a local-only workflow.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-background/60 p-3">
                  <p className="text-sm font-medium">3. Categories</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Tight categories and rules make budgets, forecasts, and insights much more believable.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="teller" activeValue={tab}>
          <TellerSettings />
        </TabsContent>

        <TabsContent value="categories" activeValue={tab}>
          <CategoryManager />
        </TabsContent>

        <TabsContent value="import" activeValue={tab}>
          <CsvImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}
