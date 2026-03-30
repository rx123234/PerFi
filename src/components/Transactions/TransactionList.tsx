import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as api from "@/lib/api";
import type { Transaction, Category, Account, TransactionFilter } from "@/lib/types";
import { Search, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

export default function TransactionList() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Debounce search input
  useEffect(() => {
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  const buildFilter = useCallback((): TransactionFilter => ({
    account_id: accountFilter || null,
    category_id: categoryFilter || null,
    start_date: null,
    end_date: null,
    search: debouncedSearch || null,
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }), [accountFilter, categoryFilter, debouncedSearch, page]);

  const loadData = useCallback(async () => {
    try {
      const filter = buildFilter();
      const [txs, count, cats, accs] = await Promise.all([
        api.getTransactions(filter),
        api.getTransactionCount(filter),
        api.getCategories(),
        api.getAccounts(),
      ]);
      setTransactions(txs);
      setTotalCount(count);
      setCategories(cats);
      setAccounts(accs);
    } catch (err) {
      console.error("Failed to load transactions:", err);
    }
  }, [buildFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCategoryChange = async (txId: string, categoryId: string) => {
    await api.updateTransactionCategory(txId, categoryId || null);
    setEditingTxId(null);
    loadData();
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await api.syncAllAccounts();
      await loadData();
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setSyncing(false);
    }
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Transactions</h2>
        <Button onClick={handleSync} disabled={syncing} size="sm">
          <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Syncing..." : "Sync"}
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <select
          value={accountFilter}
          onChange={(e) => { setAccountFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Accounts</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} {a.mask ? `****${a.mask}` : ""}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => { setCategoryFilter(e.target.value); setPage(0); }}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Date</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Description</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Category</th>
                <th className="text-right p-3 text-sm font-medium text-muted-foreground">Amount</th>
                <th className="text-left p-3 text-sm font-medium text-muted-foreground">Source</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => (
                <tr key={tx.id} className="border-b hover:bg-muted/50">
                  <td className="p-3 text-sm">{formatDate(tx.date)}</td>
                  <td className="p-3 text-sm">
                    <div>{tx.merchant || tx.description}</div>
                    {tx.merchant && tx.description !== tx.merchant && (
                      <div className="text-xs text-muted-foreground">{tx.description}</div>
                    )}
                    {tx.pending && <Badge variant="outline" className="ml-2 text-xs">Pending</Badge>}
                  </td>
                  <td className="p-3 text-sm">
                    {editingTxId === tx.id ? (
                      <select
                        value={tx.category_id || ""}
                        onChange={(e) => handleCategoryChange(tx.id, e.target.value)}
                        onBlur={() => setEditingTxId(null)}
                        autoFocus
                        className="h-7 rounded border border-input bg-background px-2 text-xs"
                      >
                        <option value="">Uncategorized</option>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    ) : (
                      <button
                        onClick={() => setEditingTxId(tx.id)}
                        className="text-left hover:underline"
                      >
                        {tx.category_name ? (
                          <Badge variant="secondary">{tx.category_name}</Badge>
                        ) : (
                          <span className="text-muted-foreground italic">Uncategorized</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className={`p-3 text-sm text-right font-medium ${tx.amount >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="p-3 text-sm">
                    <Badge variant="outline" className="text-xs">{tx.source}</Badge>
                  </td>
                </tr>
              ))}
              {transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No transactions found. Link an account or import a CSV to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {totalCount} transactions
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
