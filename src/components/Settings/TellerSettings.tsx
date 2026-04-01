import { useState, useEffect } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as api from "@/lib/api";
import { CheckCircle, AlertCircle, ShieldCheck, FolderOpen } from "lucide-react";

export default function TellerSettings() {
  const [appId, setAppId] = useState("");
  const [environment, setEnvironment] = useState("development");
  const [certPath, setCertPath] = useState("");
  const [keyPath, setKeyPath] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isConfigured, setIsConfigured] = useState(false);
  const [configuredEnv, setConfiguredEnv] = useState("");

  useEffect(() => {
    api.getTellerConfig().then((meta) => {
      setIsConfigured(meta.is_configured);
      setEnvironment(meta.environment);
      setConfiguredEnv(meta.environment);
      if (meta.app_id) setAppId(meta.app_id);
    });
  }, []);

  const browseCert = async () => {
    const path = await open({ multiple: false, title: "Select Certificate File" });
    if (typeof path === "string") setCertPath(path);
  };

  const browseKey = async () => {
    const path = await open({ multiple: false, title: "Select Private Key File" });
    if (typeof path === "string") setKeyPath(path);
  };

  const handleSave = async () => {
    if (!appId.trim()) { setError("App ID is required"); return; }
    if (!certPath.trim()) { setError("Certificate file is required"); return; }
    if (!keyPath.trim()) { setError("Private key file is required"); return; }
    try {
      setError(null);
      await api.saveTellerConfig(appId, environment, certPath, keyPath);
      setSaved(true);
      setIsConfigured(true);
      setConfiguredEnv(environment);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(String(err));
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Teller API Configuration</CardTitle>
          <CardDescription>
            Sign up at teller.io to get your Application ID and download your certificate files.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConfigured && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success text-sm">
              <ShieldCheck className="h-4 w-4" />
              Teller configured (Environment: {configuredEnv})
            </div>
          )}

          <div>
            <label className="text-sm font-medium mb-1 block">Application ID</label>
            <Input
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              placeholder="app_..."
              autoComplete="off"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="h-9 w-full rounded-lg border border-border bg-secondary/50 px-3 text-sm text-foreground"
            >
              <option value="sandbox">Sandbox (test data)</option>
              <option value="development">Development (real banks)</option>
              <option value="production">Production</option>
            </select>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Certificate File</label>
            <div className="flex gap-2">
              <Input
                value={certPath}
                onChange={(e) => setCertPath(e.target.value)}
                placeholder="Path to certificate.pem"
                readOnly
              />
              <Button variant="outline" size="sm" onClick={browseCert}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1 block">Private Key File</label>
            <div className="flex gap-2">
              <Input
                value={keyPath}
                onChange={(e) => setKeyPath(e.target.value)}
                placeholder="Path to private_key.pem"
                readOnly
              />
              <Button variant="outline" size="sm" onClick={browseKey}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
          {saved && (
            <div className="flex items-center gap-2 text-sm text-success">
              <CheckCircle className="h-4 w-4" />
              Configuration saved successfully
            </div>
          )}

          <Button onClick={handleSave}>
            {isConfigured ? "Update Configuration" : "Save Configuration"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
