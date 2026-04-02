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
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-[linear-gradient(145deg,#5cc8ff,#1f6bff)] text-sm font-bold text-white shadow-[0_18px_34px_-22px_rgba(92,200,255,0.7)]">
            PF
          </div>
          <div className="text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">PerFi</p>
            <p className="mt-1 text-[10px] text-muted-foreground/70">Wealth OS</p>
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
