import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import * as api from "@/lib/api";
import type { Account } from "@/lib/types";
import { Plus, Trash2, CreditCard, Landmark, RefreshCw, Link } from "lucide-react";
import PlaidLinkButton from "./PlaidLink";

export default function AccountList() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [accountType, setAccountType] = useState("checking");
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadAccounts = useCallback(async () => {
    try {
      const accs = await api.getAccounts();
      setAccounts(accs);
    } catch (err) {
      console.error("Failed to load accounts:", err);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

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
          <PlaidLinkButton onSuccess={loadAccounts} />
          <Button onClick={() => setShowAdd(!showAdd)} size="sm" variant="outline">
            <Plus className="h-4 w-4" />
            Manual
          </Button>
        </div>
      </div>

      {showAdd && (
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-2 items-end">
              <div className="flex-1">
                <label className="text-sm font-medium">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Chase Checking" />
              </div>
              <div className="w-40">
                <label className="text-sm font-medium">Institution</label>
                <Input value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g., Chase" />
              </div>
              <div className="w-36">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={accountType}
                  onChange={(e) => setAccountType(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
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

      <div className="space-y-2">
        {accounts.map((acc) => (
          <Card key={acc.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {acc.account_type === "credit_card" ? (
                    <CreditCard className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Landmark className="h-5 w-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">{acc.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {acc.institution ?? acc.account_type}
                      {acc.mask ? ` ****${acc.mask}` : ""}
                    </p>
                  </div>
                  <Badge variant={acc.source === "plaid" ? "default" : "secondary"}>
                    {acc.source === "plaid" ? (
                      <><Link className="h-3 w-3 mr-1" /> Plaid</>
                    ) : (
                      "Manual"
                    )}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  {acc.source === "plaid" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleSync(acc.id)}
                      disabled={syncing === acc.id}
                    >
                      <RefreshCw className={`h-4 w-4 ${syncing === acc.id ? "animate-spin" : ""}`} />
                      Sync
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(acc.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {accounts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              No accounts yet. Link a bank via Plaid or add a manual account.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
