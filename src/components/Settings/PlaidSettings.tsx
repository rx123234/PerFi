import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { CheckCircle, AlertCircle, ShieldCheck } from "lucide-react";

export default function PlaidSettings() {
  const [clientId, setClientId] = useState("");
  const [secret, setSecret] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [clientIdHint, setClientIdHint] = useState("");

  useEffect(() => {
    api.getPlaidCredentials().then((meta) => {
      setIsConfigured(meta.is_configured);
      setEnvironment(meta.environment);
      setClientIdHint(meta.client_id_hint);
    });
  }, []);

  const handleSave = async () => {
    if (!clientId.trim() || !secret.trim()) {
      setError("Both Client ID and Secret are required");
      return;
    }
    try {
      setError(null);
      await api.savePlaidCredentials(clientId, secret, environment);
      setSaved(true);
      setIsConfigured(true);
      setClientIdHint(clientId.length > 4 ? `...${clientId.slice(-4)}` : "****");
      setClientId("");
      setSecret("");
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Plaid API Credentials</CardTitle>
          <CardDescription>
            Sign up for a free Plaid developer account at plaid.com/docs to get your Client ID and Secret.
            The Development environment allows up to 100 linked accounts for free.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfigured && (
            <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
              <ShieldCheck className="h-4 w-4" />
              Credentials configured (Client ID: {clientIdHint}, Environment: {environment})
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            {isConfigured ? "Enter new credentials to replace the existing ones:" : "Enter your Plaid credentials:"}
          </p>

          <div>
            <label className="text-sm font-medium mb-1 block">Client ID</label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Enter your Plaid Client ID"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Secret</label>
            <Input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="Enter your Plaid Secret"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="sandbox">Sandbox (test data only)</option>
              <option value="development">Development (real banks, free tier)</option>
              <option value="production">Production (paid)</option>
            </select>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-green-600">
              <CheckCircle className="h-4 w-4" />
              Credentials saved successfully
            </div>
          )}

          <Button onClick={handleSave}>
            {isConfigured ? "Update Credentials" : "Save Credentials"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
