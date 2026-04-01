import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { open } from "@tauri-apps/plugin-dialog";
import * as api from "@/lib/api";
import type { Account, CsvFormat, ImportResult } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { Upload, CheckCircle, AlertCircle } from "lucide-react";

export default function CsvImport() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [formats, setFormats] = useState<CsvFormat[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedFormat, setSelectedFormat] = useState("");
  const [filePath, setFilePath] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown>[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getAccounts(), api.getCsvFormats()]).then(([accs, fmts]) => {
      setAccounts(accs);
      setFormats(fmts);
    });
  }, []);

  const handleSelectFile = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    if (selected) {
      setFilePath(selected as string);
      setPreview(null);
      setResult(null);
      setError(null);
    }
  };

  const handlePreview = async () => {
    if (!filePath || !selectedFormat || !selectedAccount) return;
    try {
      setError(null);
      const data = await api.previewCsv(filePath, selectedFormat, selectedAccount);
      setPreview(data);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleImport = async () => {
    if (!filePath || !selectedFormat || !selectedAccount) return;
    setImporting(true);
    setError(null);
    try {
      const res = await api.importCsv(filePath, selectedAccount, selectedFormat);
      setResult(res);
      setPreview(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">1. Select Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground"
            >
              <option value="">Choose an account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">2. Select Bank Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground"
            >
              <option value="">Choose a format...</option>
              {formats.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">3. Select CSV File</label>
            <div className="flex gap-2">
              <Button onClick={handleSelectFile} variant="outline" className="flex-1">
                <Upload className="h-4 w-4" />
                {filePath ? filePath.split("/").pop() || filePath.split("\\").pop() : "Choose file..."}
              </Button>
              <Button
                onClick={handlePreview}
                disabled={!filePath || !selectedFormat || !selectedAccount}
                variant="secondary"
              >
                Preview
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {preview && (
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Preview (first 10 rows)</label>
              <div className="border border-border rounded-lg overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-secondary/50">
                      <th className="p-2 text-left text-xs font-medium text-muted-foreground">Date</th>
                      <th className="p-2 text-left text-xs font-medium text-muted-foreground">Description</th>
                      <th className="p-2 text-right text-xs font-medium text-muted-foreground">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b border-border">
                        <td className="p-2">{String(row.date)}</td>
                        <td className="p-2">{String(row.description)}</td>
                        <td className={`p-2 text-right ${(row.amount as number) >= 0 ? "text-success" : "text-destructive"}`}>
                          {formatCurrency(row.amount as number)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button onClick={handleImport} disabled={importing} className="mt-3 w-full">
                {importing ? "Importing..." : "Import All Transactions"}
              </Button>
            </div>
          )}

          {result && (
            <div className="flex items-start gap-2 text-sm bg-success/10 p-4 rounded-lg">
              <CheckCircle className="h-5 w-5 text-success mt-0.5" />
              <div>
                <p className="font-medium text-success">Import Complete</p>
                <p>{result.imported} transactions imported</p>
                <p>{result.duplicates} duplicates skipped</p>
                <p>{result.categorized} auto-categorized</p>
                {result.errors.length > 0 && (
                  <p className="text-destructive">{result.errors.length} errors</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
