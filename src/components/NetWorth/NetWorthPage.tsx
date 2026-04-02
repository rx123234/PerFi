import { useState, useEffect, useCallback } from "react";
import { TrendingUp, TrendingDown, Minus, Plus, Camera, ChevronDown, ChevronRight, Pencil, Trash2, Upload } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import NetWorthChart from "./NetWorthChart";
import AssetLiabilityForm, {
  type AssetSavePayload,
  type LiabilitySavePayload,
} from "./AssetLiabilityForm";
import * as api from "@/lib/api";
import { open } from "@tauri-apps/plugin-dialog";
import type { Asset, Liability, NetWorthSummary, NetWorthSnapshot } from "@/lib/types";

// ── formatting ─────────────────────────────────────────────────────────────────

const fmtWhole = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function fmt(cents: number) {
  return fmtWhole.format(cents / 100);
}

function fmtApr(rate: number | null | undefined) {
  if (rate == null) return null;
  return `${(rate * 100).toFixed(rate * 100 >= 10 ? 1 : 2).replace(/\.0$/, "")}% APR`;
}

function getAssetGroupLabel(asset: Asset) {
  const note = asset.notes || "";
  if (note.startsWith("Imported from Fidelity - ")) {
    return note.replace("Imported from Fidelity - ", "");
  }
  if (asset.tax_treatment === "roth") {
    return asset.institution ? `Roth IRA (${asset.institution})` : "Roth Accounts";
  }
  if (asset.tax_treatment === "traditional") {
    return asset.institution ? `Traditional IRA (${asset.institution})` : "Traditional Accounts";
  }
  if (asset.tax_treatment === "hsa") {
    return asset.institution ? `HSA (${asset.institution})` : "HSA";
  }
  if (asset.tax_treatment === "529") {
    return asset.institution ? `529 Plan (${asset.institution})` : "529 Plan";
  }
  if (asset.institution) {
    return asset.institution;
  }
  return asset.asset_type || "Other Assets";
}

// ── asset type config ──────────────────────────────────────────────────────────

const ASSET_TYPE_COLORS: Record<string, string> = {
  Cash: "#22c55e",
  Investment: "#6366f1",
  Retirement: "#f59e0b",
  Property: "#14b8a6",
  Vehicle: "#8b5cf6",
  Other: "#94a3b8",
};

const LIABILITY_TYPE_COLORS: Record<string, string> = {
  Mortgage: "#ef4444",
  "Student Loan": "#f97316",
  "Auto Loan": "#ec4899",
  "Credit Card": "#f43f5e",
  HELOC: "#a855f7",
  Other: "#94a3b8",
};

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

// ── summary card ───────────────────────────────────────────────────────────────

interface SummaryCardProps {
  title: string;
  valueCents: number;
  prevValueCents?: number | null;
  accentColor: string;
  gradient?: boolean;
}

function SummaryCard({ title, valueCents, prevValueCents, accentColor, gradient }: SummaryCardProps) {
  const value = valueCents / 100;
  const prev = prevValueCents != null ? prevValueCents / 100 : null;
  const change = prev != null && prev !== 0 ? ((value - prev) / Math.abs(prev)) * 100 : null;

  return (
    <Card
      className={gradient ? "relative overflow-hidden" : ""}
      style={gradient ? { background: `linear-gradient(135deg, var(--card) 0%, ${accentColor}18 100%)` } : undefined}
    >
      {gradient && (
        <div
          className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 -translate-y-1/2 translate-x-1/2"
          style={{ background: accentColor }}
        />
      )}
      <CardContent className="p-5 relative">
        <p className="text-sm text-muted-foreground mb-1">{title}</p>
        <div
          className="text-2xl font-bold tabular-nums"
          style={{ color: gradient ? accentColor : accentColor }}
        >
          {fmt(valueCents)}
        </div>
        <div className="mt-2 h-5">
          {change != null ? (
            change > 0.05 ? (
              <span className="flex items-center gap-1 text-xs text-success">
                <TrendingUp className="h-3 w-3" />
                +{change.toFixed(1)}% vs last snapshot
              </span>
            ) : change < -0.05 ? (
              <span className="flex items-center gap-1 text-xs text-destructive">
                <TrendingDown className="h-3 w-3" />
                {change.toFixed(1)}% vs last snapshot
              </span>
            ) : (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Minus className="h-3 w-3" />
                No change
              </span>
            )
          ) : (
            <span className="text-xs text-muted-foreground opacity-50">No previous snapshot</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ── collapsible asset group ────────────────────────────────────────────────────

interface AssetGroupProps {
  type: string;
  assets: Asset[];
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
}

function AssetGroup({ type, assets, onEdit, onDelete }: AssetGroupProps) {
  const [open, setOpen] = useState(true);
  const total = assets.reduce((s, a) => s + a.current_value_cents, 0);
  // Color based on tax treatment of first asset in group
  const treatment = assets[0]?.tax_treatment || "";
  const color = treatment === "roth" ? "#6366f1"
    : treatment === "traditional" ? "#f59e0b"
    : treatment === "hsa" ? "#14b8a6"
    : treatment === "529" ? "#8b5cf6"
    : ASSET_TYPE_COLORS[assets[0]?.asset_type] ?? "#94a3b8";

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
          <span className="font-medium text-sm">{type}</span>
          <span className="text-xs text-muted-foreground">({assets.length})</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold tabular-nums">{fmt(total)}</span>
          {open ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {open && (
        <div className="divide-y divide-border">
          {assets.map((asset) => (
            <div
              key={asset.id}
              className="flex items-center px-4 py-3 hover:bg-muted/20 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{asset.name}</p>
                {asset.institution && (
                  <p className="text-xs text-muted-foreground truncate">{asset.institution}</p>
                )}
              </div>
              {asset.ticker && (
                <span className="text-xs font-mono text-muted-foreground mr-4">{asset.ticker}</span>
              )}
              <span className="text-sm font-semibold tabular-nums mr-3">
                {fmt(asset.current_value_cents)}
              </span>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => onEdit(asset)}
                  className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Edit"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(asset.id)}
                  className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                  title="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── liability row ──────────────────────────────────────────────────────────────

interface LiabilityRowProps {
  liability: Liability;
  onEdit: (liability: Liability) => void;
  onDelete: (id: string) => void;
}

function LiabilityRow({ liability, onEdit, onDelete }: LiabilityRowProps) {
  const color = LIABILITY_TYPE_COLORS[liability.liability_type] ?? "#94a3b8";
  return (
    <div className="flex items-center px-4 py-3 hover:bg-muted/20 transition-colors group border-b border-border last:border-0">
      <span className="w-2 h-2 rounded-full mr-3 shrink-0" style={{ backgroundColor: color }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{liability.name}</p>
        <div className="flex items-center gap-2">
          {liability.institution && (
            <p className="text-xs text-muted-foreground truncate">{liability.institution}</p>
          )}
          <span className="text-xs text-muted-foreground opacity-60">
            {liability.liability_type}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-end mr-3">
        <span className="text-sm font-semibold tabular-nums text-destructive">
          {fmt(liability.current_balance_cents)}
        </span>
        {liability.interest_rate != null && (
          <span className="text-xs text-muted-foreground">{fmtApr(liability.interest_rate)}</span>
        )}
      </div>
      {liability.monthly_payment_cents != null && (
        <span className="text-xs text-muted-foreground mr-3">
          {fmt(liability.monthly_payment_cents)}/mo
        </span>
      )}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onEdit(liability)}
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Edit"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => onDelete(liability.id)}
          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
          title="Delete"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── main page ──────────────────────────────────────────────────────────────────

export default function NetWorthPage() {
  const [summary, setSummary] = useState<NetWorthSummary | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [history, setHistory] = useState<NetWorthSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotting, setSnapshotting] = useState(false);

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [formType, setFormType] = useState<"asset" | "liability">("asset");
  const [editItem, setEditItem] = useState<Asset | Liability | undefined>(undefined);
  const [importing, setImporting] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sum, a, l, h] = await Promise.all([
        api.getNetWorthSummary(),
        api.getAssets(),
        api.getLiabilities(),
        api.getNetWorthHistory(24),
      ]);
      setSummary(sum);
      setAssets(a);
      setLiabilities(l);
      setHistory(h);
    } catch (err) {
      console.error("Failed to load net worth data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function handleSnapshot() {
    setSnapshotting(true);
    try {
      await api.takeNetWorthSnapshot();
      await loadAll();
    } catch (err) {
      console.error("Snapshot failed:", err);
    } finally {
      setSnapshotting(false);
    }
  }

  async function handleImportStatement() {
    try {
      const filePath = await open({
        multiple: false,
        filters: [{ name: "Statements", extensions: ["csv", "pdf"] }],
      });
      if (!filePath) return;
      setImporting(true);
      const result = await api.importInvestmentCsv(filePath as string);
      alert(`Imported: ${result.created} created, ${result.updated} updated`);
      await loadAll();
    } catch (err) {
      alert(`Import failed: ${err}`);
    } finally {
      setImporting(false);
    }
  }

  function openAddAsset() {
    setFormType("asset");
    setEditItem(undefined);
    setFormOpen(true);
  }

  function openAddLiability() {
    setFormType("liability");
    setEditItem(undefined);
    setFormOpen(true);
  }

  function openEditAsset(asset: Asset) {
    setFormType("asset");
    setEditItem(asset);
    setFormOpen(true);
  }

  function openEditLiability(liability: Liability) {
    setFormType("liability");
    setEditItem(liability);
    setFormOpen(true);
  }

  async function handleSave(payload: AssetSavePayload | LiabilitySavePayload) {
    if (formType === "asset") {
      const p = payload as AssetSavePayload;
      if (editItem) {
        await api.updateAsset(
          editItem.id,
          p.name,
          p.assetType,
          p.institution,
          p.currentValueCents,
          p.ticker,
          p.shares,
          p.costBasisCents,
          p.purchasePriceCents,
          p.purchaseDate,
          p.taxTreatment,
          "contribution_ytd_cents" in editItem ? editItem.contribution_ytd_cents : 0,
          "contribution_limit_cents" in editItem ? editItem.contribution_limit_cents : null,
          p.notes,
          "linked_account_id" in editItem ? editItem.linked_account_id : null
        );
      } else {
        await api.createAsset(
          p.name,
          p.assetType,
          p.institution,
          p.currentValueCents,
          p.ticker,
          p.shares,
          p.costBasisCents,
          p.purchasePriceCents,
          p.purchaseDate,
          p.taxTreatment,
          0,
          null,
          p.notes,
          null
        );
      }
    } else {
      const p = payload as LiabilitySavePayload;
      if (editItem) {
        await api.updateLiability(
          editItem.id,
          p.name,
          p.liabilityType,
          p.institution,
          p.currentBalanceCents,
          p.originalBalanceCents,
          p.interestRate,
          p.minimumPaymentCents,
          p.monthlyPaymentCents,
          "payment_day" in editItem ? editItem.payment_day : p.paymentDay,
          p.maturityDate,
          "linked_account_id" in editItem ? editItem.linked_account_id : null,
          p.notes
        );
      } else {
        await api.createLiability(
          p.name,
          p.liabilityType,
          p.institution,
          p.currentBalanceCents,
          p.originalBalanceCents,
          p.interestRate,
          p.minimumPaymentCents,
          p.monthlyPaymentCents,
          null,
          p.maturityDate,
          null,
          p.notes
        );
      }
    }
    await loadAll();
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm("Delete this asset?")) return;
    await api.deleteAsset(id);
    await loadAll();
  }

  async function handleDeleteLiability(id: string) {
    if (!confirm("Delete this liability?")) return;
    await api.deleteLiability(id);
    await loadAll();
  }

  const assetsByAccount: Record<string, Asset[]> = {};
  for (const a of assets) {
    const key = getAssetGroupLabel(a);
    if (!assetsByAccount[key]) assetsByAccount[key] = [];
    assetsByAccount[key].push(a);
  }

  // Sort accounts: retirement/tax-advantaged first, then taxable
  const taxAdvantaged = ["traditional", "roth", "hsa", "529"];
  const sortedAccountKeys = Object.keys(assetsByAccount).sort((a, b) => {
    const aIsAdv = assetsByAccount[a].some(x => taxAdvantaged.includes(x.tax_treatment || ""));
    const bIsAdv = assetsByAccount[b].some(x => taxAdvantaged.includes(x.tax_treatment || ""));
    if (aIsAdv && !bIsAdv) return -1;
    if (!aIsAdv && bIsAdv) return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Net Worth</h2>
        <div className="flex items-center gap-2">
        <button
          onClick={handleImportStatement}
          disabled={importing}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {importing ? (
            <span className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          Import Statement
        </button>
        <button
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {snapshotting ? (
            <span className="w-4 h-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          Take Snapshot
        </button>
        </div>
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              title="Total Assets"
              valueCents={(summary?.total_assets ?? 0) * 100}
              accentColor="#22c55e"
            />
            <SummaryCard
              title="Total Liabilities"
              valueCents={(summary?.total_liabilities ?? 0) * 100}
              accentColor="#ef4444"
            />
            <SummaryCard
              title="Net Worth"
              valueCents={(summary?.net_worth ?? 0) * 100}
              prevValueCents={summary?.prev_net_worth != null ? summary.prev_net_worth * 100 : null}
              accentColor="#6366f1"
              gradient
            />
          </div>

          {/* Chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Net Worth History</CardTitle>
              <div className="flex items-center gap-4 mt-1">
                {[
                  { label: "Assets", color: "#4CAF50" },
                  { label: "Liabilities", color: "#F44336" },
                  { label: "Net Worth", color: "#6366F1" },
                ].map(({ label, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-xs text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                <NetWorthChart data={history} />
              </div>
            </CardContent>
          </Card>

          {/* Assets + Liabilities columns */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Assets */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Assets</h3>
                <button
                  onClick={openAddAsset}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-success/10 text-success hover:bg-success/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Asset
                </button>
              </div>

              {sortedAccountKeys.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-xl gap-2">
                  <p className="text-muted-foreground text-sm">No assets yet</p>
                  <button
                    onClick={openAddAsset}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Add your first asset
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {sortedAccountKeys.map((key) => (
                    <AssetGroup
                      key={key}
                      type={key}
                      assets={assetsByAccount[key]}
                      onEdit={openEditAsset}
                      onDelete={handleDeleteAsset}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Liabilities */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-foreground">Liabilities</h3>
                <button
                  onClick={openAddLiability}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Liability
                </button>
              </div>

              {liabilities.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-border rounded-xl gap-2">
                  <p className="text-muted-foreground text-sm">No liabilities</p>
                  <button
                    onClick={openAddLiability}
                    className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Add a liability
                  </button>
                </div>
              ) : (
                <Card className="overflow-hidden p-0">
                  <CardContent className="p-0">
                    {liabilities.map((liability) => (
                      <LiabilityRow
                        key={liability.id}
                        liability={liability}
                        onEdit={openEditLiability}
                        onDelete={handleDeleteLiability}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}

      {/* Form Modal */}
      <AssetLiabilityForm
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        onSave={handleSave}
        type={formType}
        editItem={editItem}
      />
    </div>
  );
}
