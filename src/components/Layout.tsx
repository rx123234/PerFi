import { Outlet, NavLink } from "react-router-dom";
import {
  PieChart,
  CreditCard,
  GitBranch,
  Landmark,
  Settings,
  Sun,
  Moon,
  BarChart3,
  CalendarClock,
  Target,
  TrendingUp,
  Flag,
  Sunset,
  Lightbulb,
  CalendarRange,
} from "lucide-react";
import { Tooltip } from "./ui/tooltip";
import { useState } from "react";
import { getTheme, toggleTheme } from "@/lib/theme";

const navItems = [
  { to: "/", icon: PieChart, label: "Home" },
  { to: "/transactions", icon: CreditCard, label: "Transactions" },
  { to: "/spending", icon: BarChart3, label: "Spending" },
  { to: "/budget", icon: Target, label: "Budget" },
  { to: "/fixed-costs", icon: CalendarClock, label: "Fixed Costs" },
  { to: "/money-flow", icon: GitBranch, label: "Money Flow" },
  { to: "/net-worth", icon: TrendingUp, label: "Net Worth" },
  { to: "/goals", icon: Flag, label: "Goals" },
  { to: "/retirement", icon: Sunset, label: "Retirement" },
  { to: "/forecast", icon: CalendarRange, label: "Forecast" },
  { to: "/insights", icon: Lightbulb, label: "Insights" },
  { to: "/accounts", icon: Landmark, label: "Accounts" },
];

function PerFiMark({ className = "" }: { className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-[1.15rem] border border-white/12 bg-[linear-gradient(180deg,#0d2339_0%,#153455_100%)] shadow-[0_18px_38px_-24px_rgba(10,24,45,0.9)] ${className}`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_18%,rgba(245,196,92,0.65),transparent_18%),radial-gradient(circle_at_28%_26%,rgba(41,211,145,0.18),transparent_34%)]" />
      <div className="absolute inset-x-3 bottom-3 top-3 rounded-[0.9rem] border border-white/10 bg-white/3" />
      <div className="absolute inset-x-5 bottom-[14px] h-[3px] rounded-full bg-white/10" />
      <div className="absolute inset-x-5 bottom-[26px] h-[3px] rounded-full bg-white/8" />
      <div className="absolute inset-x-5 bottom-[38px] h-[3px] rounded-full bg-white/7" />
      <div className="absolute bottom-[14px] left-[18px] w-[9px] rounded-full bg-[var(--chart-2)] h-[16px]" />
      <div className="absolute bottom-[14px] left-[31px] w-[9px] rounded-full bg-[color:rgba(73,223,182,0.95)] h-[25px]" />
      <div className="absolute bottom-[14px] left-[44px] w-[9px] rounded-full bg-[color:rgba(121,233,203,0.98)] h-[36px]" />
      <svg
        viewBox="0 0 64 64"
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      >
        <path
          d="M16 43 C24 39, 30 36, 36 31 C41 27, 46 22, 52 16"
          fill="none"
          stroke="rgba(255,248,240,0.98)"
          strokeWidth="4.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M51 16 L46 18 L48.5 23 Z" fill="rgba(255,248,240,0.98)" />
      </svg>
    </div>
  );
}

export default function Layout() {
  const [theme, setTheme] = useState(getTheme);

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Icon Nav Rail */}
      <nav className="sticky top-0 flex h-screen w-[86px] shrink-0 flex-col items-center border-r border-border/80 bg-nav/90 px-3 py-5 backdrop-blur-2xl">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <PerFiMark className="h-11 w-11" />
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">PerFi</p>
            <p className="mt-1 text-[10px] text-muted-foreground/70">Money clarity</p>
          </div>
        </div>

        {/* Main nav items */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Tooltip key={to} content={label} side="right">
              <NavLink
                to={to}
                end={to === "/"}
                aria-label={label}
                className={({ isActive }) =>
                  `relative flex items-center justify-center h-11 w-11 rounded-2xl border transition-[background-color,color,border-color,transform] duration-200 ${
                    isActive
                      ? "border-[rgba(92,200,255,0.18)] bg-nav-active text-foreground shadow-[0_14px_30px_-24px_var(--glow)]"
                      : "border-transparent text-muted-foreground hover:-translate-y-px hover:border-border hover:bg-nav-active/70 hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[linear-gradient(180deg,#5cc8ff,#1f6bff)]" />
                    )}
                    <Icon className="h-[18px] w-[18px]" />
                  </>
                )}
              </NavLink>
            </Tooltip>
          ))}
        </div>

        {/* Bottom actions */}
        <div className="flex flex-col items-center gap-1">
          <Tooltip content={theme === "dark" ? "Light mode" : "Dark mode"} side="right">
            <button
              onClick={handleThemeToggle}
              aria-label={theme === "dark" ? "Light mode" : "Dark mode"}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-transparent text-muted-foreground transition-[background-color,color,border-color] hover:border-border hover:bg-nav-active/70 hover:text-foreground"
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          </Tooltip>
          <Tooltip content="Settings" side="right">
            <NavLink
              to="/settings"
              aria-label="Settings"
              className={({ isActive }) =>
                `relative flex items-center justify-center h-11 w-11 rounded-2xl border transition-[background-color,color,border-color] ${
                  isActive
                    ? "border-[rgba(92,200,255,0.18)] bg-nav-active text-foreground"
                    : "border-transparent text-muted-foreground hover:border-border hover:bg-nav-active/70 hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-[linear-gradient(180deg,#5cc8ff,#1f6bff)]" />
                  )}
                  <Settings className="h-[18px] w-[18px]" />
                </>
              )}
            </NavLink>
          </Tooltip>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-[1380px] px-5 py-5 sm:px-6 lg:px-8">
          <div className="mb-5 flex items-center justify-between rounded-[1.4rem] border border-border/80 bg-container/80 px-5 py-3 backdrop-blur-xl">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">Personal Finance</p>
            <h1 className="mt-1 text-xl font-semibold">Decision workspace</h1>
          </div>
          <div className="hidden items-center gap-3 md:flex">
            <div className="rounded-full border border-border/80 bg-surface/70 px-3 py-1 text-xs text-muted-foreground">
              Local-first
            </div>
            <div className="rounded-full border border-border/80 bg-surface/70 px-3 py-1 text-xs text-muted-foreground">
              No subscription required
            </div>
            <div className="rounded-full border border-border/80 bg-surface/70 px-3 py-1 text-xs text-muted-foreground">
              Tauri + SQLite
            </div>
          </div>
        </div>
          <Outlet />
        </div>
      </main>
    </div>
  );
}
