import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import {
  DashboardPage,
  DashboardShell,
  ServersPage,
  StatisticsPage,
} from "@/features/dashboard/components/DashboardPage";
import { LoginScreen } from "@/features/auth/components/LoginScreen";
import { useSession } from "@/features/auth/session-context";
import { CategoriesView } from "@/features/categories/components/CategoriesView";
import { KadView } from "@/features/kad/components/KadView";
import { LogsView } from "@/features/logs/components/LogsView";
import { PeersView } from "@/features/peers/components/PeersView";
import { PreferencesView } from "@/features/preferences/components/PreferencesView";
import { SearchView } from "@/features/search/components/SearchView";
import { SharedFilesView } from "@/features/shared/components/SharedFilesView";

export function App() {
  const { ready, authenticated } = useSession();

  if (!ready) return <main className="loading">Checking session…</main>;

  if (!authenticated) return <LoginScreen />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<DashboardShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="search" element={<SearchView />} />
          <Route path="servers" element={<ServersPage />} />
          <Route path="categories" element={<CategoriesView />} />
          <Route path="shared" element={<SharedFilesView />} />
          <Route path="kad" element={<KadView />} />
          <Route path="logs" element={<LogsView />} />
          <Route path="statistics" element={<StatisticsPage />} />
          <Route path="peers" element={<PeersView />} />
          <Route path="preferences" element={<PreferencesView />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
