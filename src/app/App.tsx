import { DashboardPage } from "@/features/dashboard/components/DashboardPage";
import { LoginScreen } from "@/features/auth/components/LoginScreen";
import { useSession } from "@/features/auth/session-context";

export function App() {
  const { ready, authenticated } = useSession();

  if (!ready) return <main className="loading">Checking session…</main>;

  return authenticated ? <DashboardPage /> : <LoginScreen />;
}
