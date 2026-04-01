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
} from "lucide-react";
import { Tooltip } from "./ui/tooltip";
import { useState } from "react";
import { getTheme, toggleTheme } from "@/lib/theme";

const navItems = [
  { to: "/", icon: PieChart, label: "Home" },
  { to: "/transactions", icon: CreditCard, label: "Transactions" },
  { to: "/spending", icon: BarChart3, label: "Spending" },
  { to: "/fixed-costs", icon: CalendarClock, label: "Fixed Costs" },
  { to: "/money-flow", icon: GitBranch, label: "Money Flow" },
  { to: "/accounts", icon: Landmark, label: "Accounts" },
];

export default function Layout() {
  const [theme, setTheme] = useState(getTheme);

  const handleThemeToggle = () => {
    const next = toggleTheme();
    setTheme(next);
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Icon Nav Rail */}
      <nav className="flex flex-col items-center w-[68px] bg-nav border-r border-border py-4 shrink-0">
        {/* Logo */}
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm mb-6">
          P
        </div>

        {/* Main nav items */}
        <div className="flex flex-col items-center gap-1 flex-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <Tooltip key={to} content={label} side="right">
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  `relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                    isActive
                      ? "bg-nav-active text-foreground"
                      : "text-muted-foreground hover:bg-nav-active hover:text-foreground"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-foreground rounded-r-full" />
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
              className="flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:bg-nav-active hover:text-foreground transition-colors"
            >
              {theme === "dark" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          </Tooltip>
          <Tooltip content="Settings" side="right">
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `relative flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                  isActive
                    ? "bg-nav-active text-foreground"
                    : "text-muted-foreground hover:bg-nav-active hover:text-foreground"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-foreground rounded-r-full" />
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
        <div className="max-w-6xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
