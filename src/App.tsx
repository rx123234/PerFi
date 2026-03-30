import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import DashboardPage from "./components/Dashboard/DashboardPage";
import TransactionList from "./components/Transactions/TransactionList";
import AccountList from "./components/Accounts/AccountList";
import CategoryManager from "./components/Categories/CategoryManager";
import CsvImport from "./components/Import/CsvImport";
import PlaidSettings from "./components/Settings/PlaidSettings";

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/transactions" element={<TransactionList />} />
        <Route path="/accounts" element={<AccountList />} />
        <Route path="/categories" element={<CategoryManager />} />
        <Route path="/import" element={<CsvImport />} />
        <Route path="/settings" element={<PlaidSettings />} />
      </Route>
    </Routes>
  );
}

export default App;
