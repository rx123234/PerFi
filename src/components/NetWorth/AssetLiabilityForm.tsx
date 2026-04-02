import { useState, useEffect } from "react";
import { Modal } from "@/components/ui/modal";
import type { Asset, Liability } from "@/lib/types";

// ── helpers ──────────────────────────────────────────────────────────────────

function centsToDisplay(cents: number | null | undefined): string {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function parseDollar(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? 0 : Math.round(n * 100);
}

const ASSET_TYPES = ["Cash", "Investment", "Retirement", "Property", "Vehicle", "Other"] as const;
const LIABILITY_TYPES = ["Mortgage", "Student Loan", "Auto Loan", "Credit Card", "HELOC", "Other"] as const;
const TAX_TREATMENTS = ["Taxable", "Traditional", "Roth", "HSA", "529"] as const;

// ── field components ──────────────────────────────────────────────────────────

function FormField({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

const selectClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-colors";

// ── asset form state ──────────────────────────────────────────────────────────

interface AssetFields {
  name: string;
  asset_type: string;
  institution: string;
  current_value: string;
  ticker: string;
  shares: string;
  cost_basis: string;
  purchase_price: string;
  purchase_date: string;
  tax_treatment: string;
  notes: string;
}

function defaultAssetFields(item?: Asset): AssetFields {
  if (!item) {
    return {
      name: "",
      asset_type: "Cash",
      institution: "",
      current_value: "",
      ticker: "",
      shares: "",
      cost_basis: "",
      purchase_price: "",
      purchase_date: "",
      tax_treatment: "",
      notes: "",
    };
  }
  return {
    name: item.name,
    asset_type: item.asset_type,
    institution: item.institution ?? "",
    current_value: centsToDisplay(item.current_value_cents),
    ticker: item.ticker ?? "",
    shares: item.shares != null ? String(item.shares) : "",
    cost_basis: centsToDisplay(item.cost_basis_cents),
    purchase_price: centsToDisplay(item.purchase_price_cents),
    purchase_date: item.purchase_date ?? "",
    tax_treatment: item.tax_treatment ?? "",
    notes: item.notes ?? "",
  };
}

// ── liability form state ──────────────────────────────────────────────────────

interface LiabilityFields {
  name: string;
  liability_type: string;
  institution: string;
  current_balance: string;
  original_balance: string;
  interest_rate: string;
  minimum_payment: string;
  monthly_payment: string;
  maturity_date: string;
  notes: string;
}

function defaultLiabilityFields(item?: Liability): LiabilityFields {
  if (!item) {
    return {
      name: "",
      liability_type: "Credit Card",
      institution: "",
      current_balance: "",
      original_balance: "",
      interest_rate: "",
      minimum_payment: "",
      monthly_payment: "",
      maturity_date: "",
      notes: "",
    };
  }
  return {
    name: item.name,
    liability_type: item.liability_type,
    institution: item.institution ?? "",
    current_balance: centsToDisplay(item.current_balance_cents),
    original_balance: centsToDisplay(item.original_balance_cents),
    interest_rate: item.interest_rate != null ? String(item.interest_rate * 100) : "",
    minimum_payment: centsToDisplay(item.minimum_payment_cents),
    monthly_payment: centsToDisplay(item.monthly_payment_cents),
    maturity_date: item.maturity_date ?? "",
    notes: item.notes ?? "",
  };
}

// ── asset save payload ────────────────────────────────────────────────────────

export interface AssetSavePayload {
  name: string;
  assetType: string;
  institution: string | null;
  currentValueCents: number;
  ticker: string | null;
  shares: number | null;
  costBasisCents: number | null;
  purchasePriceCents: number | null;
  purchaseDate: string | null;
  taxTreatment: string | null;
  notes: string | null;
}

export interface LiabilitySavePayload {
  name: string;
  liabilityType: string;
  institution: string | null;
  currentBalanceCents: number;
  originalBalanceCents: number | null;
  interestRate: number | null;
  minimumPaymentCents: number | null;
  monthlyPaymentCents: number | null;
  paymentDay: number | null;
  maturityDate: string | null;
  notes: string | null;
}

// ── main component ────────────────────────────────────────────────────────────

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: AssetSavePayload | LiabilitySavePayload) => Promise<void>;
  type: "asset" | "liability";
  editItem?: Asset | Liability;
}

export default function AssetLiabilityForm({ isOpen, onClose, onSave, type, editItem }: Props) {
  const [assetFields, setAssetFields] = useState<AssetFields>(() =>
    defaultAssetFields(type === "asset" ? (editItem as Asset | undefined) : undefined)
  );
  const [liabilityFields, setLiabilityFields] = useState<LiabilityFields>(() =>
    defaultLiabilityFields(type === "liability" ? (editItem as Liability | undefined) : undefined)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSaving(false);
      if (type === "asset") {
        setAssetFields(defaultAssetFields(editItem as Asset | undefined));
      } else {
        setLiabilityFields(defaultLiabilityFields(editItem as Liability | undefined));
      }
    }
  }, [isOpen, type, editItem]);

  const patchAsset = (k: keyof AssetFields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setAssetFields((prev) => ({ ...prev, [k]: e.target.value }));

  const patchLiability = (k: keyof LiabilityFields) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setLiabilityFields((prev) => ({ ...prev, [k]: e.target.value }));

  async function handleSave() {
    setError(null);
    try {
      setSaving(true);
      if (type === "asset") {
        if (!assetFields.name.trim()) throw new Error("Name is required");
        const payload: AssetSavePayload = {
          name: assetFields.name.trim(),
          assetType: assetFields.asset_type,
          institution: assetFields.institution.trim() || null,
          currentValueCents: parseDollar(assetFields.current_value),
          ticker: assetFields.ticker.trim() || null,
          shares: assetFields.shares ? parseFloat(assetFields.shares) : null,
          costBasisCents: assetFields.cost_basis ? parseDollar(assetFields.cost_basis) : null,
          purchasePriceCents: assetFields.purchase_price ? parseDollar(assetFields.purchase_price) : null,
          purchaseDate: assetFields.purchase_date || null,
          taxTreatment: assetFields.tax_treatment || null,
          notes: assetFields.notes.trim() || null,
        };
        await onSave(payload);
      } else {
        if (!liabilityFields.name.trim()) throw new Error("Name is required");
        const payload: LiabilitySavePayload = {
          name: liabilityFields.name.trim(),
          liabilityType: liabilityFields.liability_type,
          institution: liabilityFields.institution.trim() || null,
          currentBalanceCents: parseDollar(liabilityFields.current_balance),
          originalBalanceCents: liabilityFields.original_balance
            ? parseDollar(liabilityFields.original_balance)
            : null,
          interestRate: liabilityFields.interest_rate
            ? parseFloat(liabilityFields.interest_rate) / 100
            : null,
          minimumPaymentCents: liabilityFields.minimum_payment
            ? parseDollar(liabilityFields.minimum_payment)
            : null,
          monthlyPaymentCents: liabilityFields.monthly_payment
            ? parseDollar(liabilityFields.monthly_payment)
            : null,
          paymentDay: null,
          maturityDate: liabilityFields.maturity_date || null,
          notes: liabilityFields.notes.trim() || null,
        };
        await onSave(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  const isEdit = Boolean(editItem);
  const title = isEdit
    ? `Edit ${type === "asset" ? "Asset" : "Liability"}`
    : `Add ${type === "asset" ? "Asset" : "Liability"}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-xl">
      <div className="space-y-4">
        {type === "asset" ? (
          <>
            {/* Row 1: Name + Type */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Vanguard Total Market"
                  value={assetFields.name}
                  onChange={patchAsset("name")}
                />
              </FormField>
              <FormField label="Type">
                <select
                  className={selectClass}
                  value={assetFields.asset_type}
                  onChange={patchAsset("asset_type")}
                >
                  {ASSET_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Row 2: Institution + Current Value */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Institution">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Fidelity"
                  value={assetFields.institution}
                  onChange={patchAsset("institution")}
                />
              </FormField>
              <FormField label="Current Value">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={assetFields.current_value}
                    onChange={patchAsset("current_value")}
                  />
                </div>
              </FormField>
            </div>

            {/* Row 3: Ticker + Shares (investment-focused) */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Ticker Symbol" hint="Optional — for investment assets">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. VTI"
                  value={assetFields.ticker}
                  onChange={patchAsset("ticker")}
                />
              </FormField>
              <FormField label="Shares">
                <input
                  type="number"
                  min="0"
                  step="any"
                  className={inputClass}
                  placeholder="0"
                  value={assetFields.shares}
                  onChange={patchAsset("shares")}
                />
              </FormField>
            </div>

            {/* Row 4: Cost Basis + Purchase Price */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Cost Basis">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={assetFields.cost_basis}
                    onChange={patchAsset("cost_basis")}
                  />
                </div>
              </FormField>
              <FormField label="Purchase Price">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={assetFields.purchase_price}
                    onChange={patchAsset("purchase_price")}
                  />
                </div>
              </FormField>
            </div>

            {/* Row 5: Purchase Date + Tax Treatment */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Purchase Date">
                <input
                  type="date"
                  className={inputClass}
                  value={assetFields.purchase_date}
                  onChange={patchAsset("purchase_date")}
                />
              </FormField>
              <FormField label="Tax Treatment">
                <select
                  className={selectClass}
                  value={assetFields.tax_treatment}
                  onChange={patchAsset("tax_treatment")}
                >
                  <option value="">— Select —</option>
                  {TAX_TREATMENTS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Notes */}
            <FormField label="Notes">
              <textarea
                className={inputClass + " resize-none"}
                rows={2}
                placeholder="Optional notes…"
                value={assetFields.notes}
                onChange={patchAsset("notes")}
              />
            </FormField>
          </>
        ) : (
          <>
            {/* Row 1: Name + Type */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Home Mortgage"
                  value={liabilityFields.name}
                  onChange={patchLiability("name")}
                />
              </FormField>
              <FormField label="Type">
                <select
                  className={selectClass}
                  value={liabilityFields.liability_type}
                  onChange={patchLiability("liability_type")}
                >
                  {LIABILITY_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Row 2: Institution + Current Balance */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Institution">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="e.g. Chase"
                  value={liabilityFields.institution}
                  onChange={patchLiability("institution")}
                />
              </FormField>
              <FormField label="Current Balance">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={liabilityFields.current_balance}
                    onChange={patchLiability("current_balance")}
                  />
                </div>
              </FormField>
            </div>

            {/* Row 3: Original Balance + Interest Rate */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Original Balance">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={liabilityFields.original_balance}
                    onChange={patchLiability("original_balance")}
                  />
                </div>
              </FormField>
              <FormField label="Interest Rate">
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pr-7"}
                    placeholder="0.00"
                    value={liabilityFields.interest_rate}
                    onChange={patchLiability("interest_rate")}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                </div>
              </FormField>
            </div>

            {/* Row 4: Min Payment + Monthly Payment */}
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Minimum Payment">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={liabilityFields.minimum_payment}
                    onChange={patchLiability("minimum_payment")}
                  />
                </div>
              </FormField>
              <FormField label="Monthly Payment">
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className={inputClass + " pl-6"}
                    placeholder="0.00"
                    value={liabilityFields.monthly_payment}
                    onChange={patchLiability("monthly_payment")}
                  />
                </div>
              </FormField>
            </div>

            {/* Maturity Date */}
            <FormField label="Maturity Date" hint="Optional — when the loan is fully paid off">
              <input
                type="date"
                className={inputClass}
                value={liabilityFields.maturity_date}
                onChange={patchLiability("maturity_date")}
              />
            </FormField>

            {/* Notes */}
            <FormField label="Notes">
              <textarea
                className={inputClass + " resize-none"}
                rows={2}
                placeholder="Optional notes…"
                value={liabilityFields.notes}
                onChange={patchLiability("notes")}
              />
            </FormField>
          </>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-foreground text-background hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center gap-2"
          >
            {saving && (
              <span className="w-3.5 h-3.5 border-2 border-background border-t-transparent rounded-full animate-spin" />
            )}
            {isEdit ? "Save Changes" : "Add"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
