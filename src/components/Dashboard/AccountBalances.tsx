import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import type { AccountBalance } from "@/lib/types";
import { CreditCard, Landmark } from "lucide-react";

interface Props {
  data: AccountBalance[];
}

export default function AccountBalances({ data }: Props) {
  if (data.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      {data.map((acc) => (
        <Card key={acc.account_id}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {acc.account_type === "credit_card" ? (
                  <CreditCard className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Landmark className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium text-sm">{acc.account_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {acc.institution ?? acc.account_type}
                    {acc.mask ? ` ****${acc.mask}` : ""}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p
                  className={`text-lg font-bold ${
                    acc.balance >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {formatCurrency(Math.abs(acc.balance))}
                </p>
                {acc.account_type === "credit_card" && acc.balance < 0 && (
                  <Badge variant="secondary" className="text-xs">
                    owed
                  </Badge>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
