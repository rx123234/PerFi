import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";

const DashboardPage = lazy(() => import("./components/Dashboard/DashboardPage"));
const MoneyFlowPage = lazy(() => import("./components/Dashboard/MoneyFlowPage"));
const TransactionList = lazy(() => import("./components/Transactions/TransactionList"));
const AccountList = lazy(() => import("./components/Accounts/AccountList"));
const SpendingPage = lazy(() => import("./components/Spending/SpendingPage"));
const FixedCostsPage = lazy(() => import("./components/FixedCosts/FixedCostsPage"));
const SettingsPage = lazy(() => import("./components/Settings/SettingsPage"));
const NetWorthPage = lazy(() => import("./components/NetWorth/NetWorthPage"));
const BudgetPage = lazy(() => import("./components/Budget/BudgetPage"));
const GoalsPage = lazy(() => import("./components/Goals/GoalsPage"));
const RetirementPage = lazy(() => import("./components/Retirement/RetirementPage"));
const ForecastPage = lazy(() => import("./components/Forecasting/ForecastPage"));
const InsightsPage = lazy(() => import("./components/Insights/InsightsPage"));

function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <div className="flex flex-col items-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/transactions" element={<TransactionList />} />
          <Route path="/spending" element={<SpendingPage />} />
          <Route path="/budget" element={<BudgetPage />} />
          <Route path="/fixed-costs" element={<FixedCostsPage />} />
          <Route path="/money-flow" element={<MoneyFlowPage />} />
          <Route path="/net-worth" element={<NetWorthPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/retirement" element={<RetirementPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/accounts" element={<AccountList />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
