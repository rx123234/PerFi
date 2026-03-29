import { useState, useCallback } from "react";
import { usePlaidLink } from "react-plaid-link";
import { Button } from "@/components/ui/button";
import * as api from "@/lib/api";
import { Link } from "lucide-react";

interface Props {
  onSuccess: () => void;
}

export default function PlaidLinkButton({ onSuccess }: Props) {
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const token = await api.createLinkToken();
      setLinkToken(token);
    } catch (err) {
      alert(`Failed to create link token: ${err}\n\nMake sure Plaid credentials are configured in Settings.`);
    } finally {
      setLoading(false);
    }
  };

  const onPlaidSuccess = useCallback(
    async (publicToken: string) => {
      try {
        const accounts = await api.exchangePublicToken(publicToken);
        alert(`Linked ${accounts.length} account(s) successfully!`);
        setLinkToken(null);
        onSuccess();
      } catch (err) {
        alert(`Failed to link account: ${err}`);
      }
    },
    [onSuccess]
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => setLinkToken(null),
  });

  // Auto-open when link token is set
  if (linkToken && ready) {
    setTimeout(() => open(), 0);
  }

  return (
    <Button onClick={handleClick} disabled={loading} size="sm">
      <Link className="h-4 w-4" />
      {loading ? "Connecting..." : "Link Account"}
    </Button>
  );
}
