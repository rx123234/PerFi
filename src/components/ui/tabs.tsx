import { cn } from "@/lib/utils";

interface TabsProps {
  value: string;
  onValueChange: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

interface TabsListProps {
  children: React.ReactNode;
  className?: string;
}

interface TabsTriggerProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  activeValue?: string;
  onSelect?: (value: string) => void;
}

interface TabsContentProps {
  value: string;
  activeValue?: string;
  children: React.ReactNode;
  className?: string;
}

export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  return (
    <div className={cn("w-full", className)}>
      {Array.isArray(children)
        ? children.map((child) => {
            if (!child || typeof child !== "object") return child;
            const c = child as React.ReactElement<TabsListProps | TabsContentProps>;
            return { ...c, props: { ...c.props, activeValue: value, onSelect: onValueChange } };
          })
        : children}
    </div>
  );
}

export function TabsList({ children, className, ...props }: TabsListProps & { activeValue?: string; onSelect?: (v: string) => void }) {
  const { activeValue, onSelect } = props as { activeValue?: string; onSelect?: (v: string) => void };
  return (
    <div className={cn("inline-flex items-center gap-1 rounded-lg bg-secondary p-1", className)}>
      {Array.isArray(children)
        ? children.map((child) => {
            if (!child || typeof child !== "object") return child;
            const c = child as React.ReactElement<TabsTriggerProps>;
            return { ...c, props: { ...c.props, activeValue, onSelect } };
          })
        : children}
    </div>
  );
}

export function TabsTrigger({ value, children, className, activeValue, onSelect }: TabsTriggerProps) {
  const isActive = value === activeValue;
  return (
    <button
      onClick={() => onSelect?.(value)}
      className={cn(
        "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
        isActive
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, activeValue, children, className }: TabsContentProps) {
  if (value !== activeValue) return null;
  return <div className={cn("mt-4", className)}>{children}</div>;
}
