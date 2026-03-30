import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { Link } from "lucide-react";

// Teller Connect JS widget type declarations
declare global {
  interface Window {
    TellerConnect: {
      setup: (config: {
        appId: string;
        environment: string;
        onSuccess: (enrollment: TellerEnrollment) => void;
        onExit: () => void;
      }) => { open: () => void };
    };
  }
}

interface TellerEnrollment {
  accessToken: string;
  enrollment: { id: string; institution: { name: string } };
  user: { id: string };
}

interface Props {
  onSuccess: () => void;
}

function loadTellerScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.TellerConnect) { resolve(); return; }
    const existing = document.getElementById("teller-connect-script");
    if (existing) { existing.addEventListener("load", () => resolve()); return; }
    const script = document.createElement("script");
    script.id = "teller-connect-script";
    script.src = "https://cdn.teller.io/connect/connect.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Teller Connect script"));
    document.head.appendChild(script);
  });
}

export default function TellerConnectButton({ onSuccess }: Props) {
  const [loading, setLoading] = useState(false);

  const handleClick = useCallback(async () => {
    setLoading(true);
    try {
      const config = await api.getTellerConfig();
      if (!config.is_configured) {
        alert("Teller is not configured. Go to Settings to add your Application ID and certificates.");
        return;
      }

      await loadTellerScript();

      const tellerConnect = window.TellerConnect.setup({
        appId: config.app_id,
        environment: config.environment,
        onSuccess: async (enrollment: TellerEnrollment) => {
          try {
            const accounts = await api.tellerConnectSuccess(
              enrollment.accessToken,
              enrollment.enrollment.id
            );
            alert(`Linked ${accounts.length} account(s) successfully!`);
            onSuccess();
          } catch (err) {
            alert(`Failed to link account: ${err}`);
          }
        },
        onExit: () => setLoading(false),
      });

      tellerConnect.open();
    } catch (err) {
      alert(`Failed to open Teller Connect: ${err}`);
      setLoading(false);
    }
  }, [onSuccess]);

  return (
    <Button onClick={handleClick} disabled={loading} size="sm">
      <Link className="h-4 w-4" />
      {loading ? "Connecting..." : "Link Account"}
    </Button>
  );
}
