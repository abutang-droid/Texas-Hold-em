import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import LoginPage from './pages/LoginPage';
import UsersPage from './pages/UsersPage';
import HandsPage from './pages/HandsPage';
import ConfigPage from './pages/ConfigPage';
import ReportsPage from './pages/ReportsPage';
import EconomyPage from './pages/EconomyPage';
import RiskPage from './pages/RiskPage';
import { getAdminKey } from './api/client';

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!getAdminKey()) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<UsersPage />} />
        <Route path="hands" element={<HandsPage />} />
        <Route path="config" element={<ConfigPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="economy" element={<EconomyPage />} />
        <Route path="risk" element={<RiskPage />} />
      </Route>
    </Routes>
  );
}
