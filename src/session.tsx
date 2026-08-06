import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import { ApiError, api } from "./api";

type Session = {
  ready: boolean;
  authenticated: boolean;
  login(password: string): Promise<void>;
  logout(): Promise<void>;
  expire(): void;
};
const SessionContext = createContext<Session | null>(null);
export function SessionProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  useEffect(() => {
    api
      .session()
      .then(() => setAuthenticated(true))
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));
  }, []);
  const value = useMemo<Session>(
    () => ({
      ready,
      authenticated,
      async login(password) {
        await api.login(password);
        setAuthenticated(true);
      },
      async logout() {
        try {
          await api.logout();
        } finally {
          setAuthenticated(false);
        }
      },
      expire() {
        setAuthenticated(false);
      },
    }),
    [ready, authenticated],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error("SessionProvider missing");
  return session;
}
export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}
