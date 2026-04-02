import { formatDistanceToNow } from "date-fns";
import { Info, TrendingUp, AlertTriangle, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Insight } from "@/lib/types";

interface InsightCardProps {
  insight: Insight;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
}

const severityConfig = {
  info: {
    icon: Info,
    borderColor: "border-l-blue-500",
    iconColor: "text-blue-500",
    iconBg: "bg-blue-500/10",
  },
  positive: {
    icon: TrendingUp,
    borderColor: "border-l-emerald-500",
    iconColor: "text-emerald-500",
    iconBg: "bg-emerald-500/10",
  },
  warning: {
    icon: AlertTriangle,
    borderColor: "border-l-amber-500",
    iconColor: "text-amber-500",
    iconBg: "bg-amber-500/10",
  },
  action_needed: {
    icon: AlertCircle,
    borderColor: "border-l-red-500",
    iconColor: "text-red-500",
    iconBg: "bg-red-500/10",
  },
} as const;

export default function InsightCard({ insight, onDismiss, onMarkRead }: InsightCardProps) {
  const severity = (insight.severity as keyof typeof severityConfig) in severityConfig
    ? (insight.severity as keyof typeof severityConfig)
    : "info";

  const config = severityConfig[severity];
  const Icon = config.icon;

  const timeAgo = (() => {
    try {
      return formatDistanceToNow(new Date(insight.created_at), { addSuffix: true });
    } catch {
      return "";
    }
  })();

  const handleCardClick = () => {
    if (!insight.is_read) {
      onMarkRead(insight.id);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "group relative flex items-start gap-4 rounded-xl border border-border bg-card",
        "border-l-4 px-4 py-4 transition-all duration-150",
        "hover:shadow-md hover:shadow-black/5 cursor-pointer",
        config.borderColor,
        !insight.is_read && "bg-card"
      )}
    >
      {/* Unread indicator */}
      {!insight.is_read && (
        <span className="absolute top-3.5 right-10 h-2 w-2 rounded-full bg-blue-500 shrink-0" />
      )}

      {/* Icon */}
      <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", config.iconBg)}>
        <Icon className={cn("h-4 w-4", config.iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pr-2">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("text-sm font-semibold leading-snug", !insight.is_read ? "text-foreground" : "text-foreground/80")}>
            {insight.title}
          </p>
        </div>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{insight.body}</p>
        {timeAgo && (
          <p className="mt-2 text-xs text-muted-foreground/60">{timeAgo}</p>
        )}
      </div>

      {/* Dismiss */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(insight.id);
        }}
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/40 opacity-0 transition-all hover:bg-secondary hover:text-muted-foreground group-hover:opacity-100"
        aria-label="Dismiss insight"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
