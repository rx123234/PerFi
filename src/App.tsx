import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./components/Dashboard/DashboardPage";
import MoneyFlowPage from "./components/Dashboard/MoneyFlowPage";
import TransactionList from "./components/Transactions/TransactionList";
import AccountList from "./components/Accounts/AccountList";
import SpendingPage from "./components/Spending/SpendingPage";
import FixedCostsPage from "./components/FixedCosts/FixedCostsPage";
import SettingsPage from "./components/Settings/SettingsPage";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionList />} />
        <Route path="/spending" element={<SpendingPage />} />
        <Route path="/fixed-costs" element={<FixedCostsPage />} />
        <Route path="/money-flow" element={<MoneyFlowPage />} />
        <Route path="/accounts" element={<AccountList />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
