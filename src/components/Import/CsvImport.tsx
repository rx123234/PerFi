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
      <h2 className="text-2xl font-bold">Import CSV</h2>

      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Step 1: Select Account */}
          <div>
            <label className="text-sm font-medium mb-1 block">1. Select Account</label>
            <select
              value={selectedAccount}
              onChange={(e) => setSelectedAccount(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose an account...</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {/* Step 2: Select Format */}
          <div>
            <label className="text-sm font-medium mb-1 block">2. Select Bank Format</label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Choose a format...</option>
              {formats.map((f) => (
                <option key={f.name} value={f.name}>{f.name}</option>
              ))}
            </select>
          </div>

          {/* Step 3: Select File */}
          <div>
            <label className="text-sm font-medium mb-1 block">3. Select CSV File</label>
            <div className="flex gap-2">
              <Button onClick={handleSelectFile} variant="outline" className="flex-1">
                <Upload className="h-4 w-4" />
                {filePath ? filePath.split("/").pop() : "Choose file..."}
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
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Preview */}
          {preview && (
            <div>
              <label className="text-sm font-medium mb-1 block">Preview (first 10 rows)</label>
              <div className="border rounded overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Description</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-b">
                        <td className="p-2">{String(row.date)}</td>
                        <td className="p-2">{String(row.description)}</td>
                        <td className={`p-2 text-right ${(row.amount as number) >= 0 ? "text-green-600" : "text-red-600"}`}>
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

          {/* Result */}
          {result && (
            <div className="flex items-start gap-2 text-sm bg-green-50 p-4 rounded">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">Import Complete</p>
                <p>{result.imported} transactions imported</p>
                <p>{result.duplicates} duplicates skipped</p>
                <p>{result.categorized} auto-categorized</p>
                {result.errors.length > 0 && (
                  <p className="text-red-600">{result.errors.length} errors</p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
