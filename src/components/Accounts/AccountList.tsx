import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import * as api from "@/lib/api";
import type { Account, AccountBalance } from "@/lib/types";
import { Plus, Trash2, CreditCard, Landmark, RefreshCw, Link, DollarSign } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import TellerConnectButton from "./TellerConnect";

export default function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [balances, setBalances] = useState<Map<string, AccountBalance>>(new Map());
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncingBalances, setSyncingBalances] = useState(false);

  const loadAccounts = useCallback(async () => {
    try {
      const [accs, bals] = await Promise.all([
        api.getAccounts(),
        api.getAccountBalances(),
      ]);
      setAccounts(accs);
      const balMap = new Map<string, AccountBalance>();
      for (const b of bals) balMap.set(b.account_id, b);
      setBalances(balMap);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const connectedCount = accounts.filter((account) => account.source === "teller").length;
  const balanceCoverage = accounts.length > 0 ? Math.round((balances.size / accounts.length) * 100) : 0;

  const handleCreate = async () => {
    if (!name.trim()) return;
    await api.createAccount(name, institution || null, accountType);
    setName("");
    setInstitution("");
    setShowAdd(false);
    loadAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this account and all its transactions?")) return;
    await api.deleteAccount(id);
    loadAccounts();
  };

  const handleSync = async (id: string) => {
    setSyncing(id);
    try {
      const result = await api.syncTransactions(id);
      alert(`Synced: ${result.added} added, ${result.modified} modified, ${result.removed} removed`);
      loadAccounts();
    } catch (err) {
      alert(`Sync failed: ${err}`);
    } finally {
      setSyncing(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Accounts</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={syncingBalances}
            onClick={async () => {
              setSyncingBalances(true);
              try {
                const count = await api.syncBalancesOnly();
                alert(`Updated balances for ${count} accounts`);
                loadAccounts();
              } catch (err) {
                alert(`Balance sync failed: ${err}`);
              } finally {
                setSyncingBalances(false);
              }
            }}
          >
            <DollarSign className={`h-4 w-4 ${syncingBalances ? "animate-spin" : ""}`} />
            {syncingBalances ? "Syncing..." : "Sync Balances"}
          </Button>
          <TellerConnectButton onSuccess={loadAccounts} />
          <Button onClick={() => setShowAdd(!showAdd)} size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Manual
          </Button>
        </div>
      </div>

      <Card className="border-border/80 bg-panel/80 backdrop-blur-xl">
        <CardContent className="grid gap-4 p-5 md:grid-cols-[1.3fr_repeat(3,0.7fr)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Account Health
            </p>
            <h3 className="mt-2 text-lg font-semibold">Connect live accounts or keep manual balances current.</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Teller-backed accounts are best for ongoing transaction sync. Manual accounts work well for tracking
              net worth, cash reserves, and balances you update yourself.
            </p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total</p>
            <p className="mt-2 text-2xl font-semibold">{accounts.length}</p>
            <p className="mt-1 text-xs text-muted-foreground">Tracked accounts</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Live Sync</p>
            <p className="mt-2 text-2xl font-semibold">{connectedCount}</p>
            <p className="mt-1 text-xs text-muted-foreground">Connected through Teller</p>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Balance Coverage</p>
            <p className="mt-2 text-2xl font-semibold">{balanceCoverage}%</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {balances.size} of {accounts.length || 0} accounts showing balances
            </p>
          </div>
        </CardContent>
      </Card>

      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Chase Checking" />
              </div>
              <div className="w-40">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Institution</label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g., Chase" />
              </div>
              <div className="w-36">
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="h-9 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="credit_card">Credit Card</option>
                </select>
              </div>
              <Button onClick={handleCreate}>Add</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Account Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {accounts.map((acc) => (
          <Card key={acc.id} className="hover:border-foreground/20 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                    {acc.account_type === "credit_card" ? (
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Landmark className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{acc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {acc.institution ?? acc.account_type}
                      {acc.mask ? ` ····${acc.mask}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {balances.has(acc.id) && (() => {
                    const bal = balances.get(acc.id)!;
                    return (
                      <div className="text-right">
                        <p className={`text-lg font-bold ${bal.balance >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(Math.abs(bal.balance))}
                        </p>
                      </div>
                    );
                  })()}
                  <Badge variant={acc.source === "teller" ? "default" : "secondary"} className="text-xs">
                    {acc.source === "teller" ? (
                      <><Link className="h-3 w-3 mr-1" /> Live sync</>
                    ) : (
                      "Manual"
                    )}
                  </Badge>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  {acc.source === "teller" ? "Transactions can be refreshed" : "Balances maintained manually"}
                </Badge>
                <Badge variant={balances.has(acc.id) ? "secondary" : "outline"} className="text-xs">
                  {balances.has(acc.id) ? "Balance available" : "Balance not synced yet"}
                </Badge>
              </div>
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                {acc.source === "teller" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSync(acc.id)}
                    disabled={syncing === acc.id}
                    className="text-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${syncing === acc.id ? "animate-spin" : ""}`} />
                    Sync
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)} className="text-xs text-destructive hover:text-destructive ml-auto">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {accounts.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <Landmark className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <h3 className="text-lg font-semibold">Start by adding the accounts you rely on most.</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Link a checking or credit-card account for live transaction sync, or add a manual account if you want to
              start with balances only.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <Badge variant="secondary" className="text-xs">1. Connect Teller for live data</Badge>
              <Badge variant="secondary" className="text-xs">2. Add manual balances if needed</Badge>
              <Badge variant="secondary" className="text-xs">3. Return to Home to review cash flow</Badge>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
