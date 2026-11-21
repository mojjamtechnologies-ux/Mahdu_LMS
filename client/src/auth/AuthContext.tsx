import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  api,
  refreshSession,
  setAccessToken,
  setSessionLostHandler,
  type User,
} from "../lib/api";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  /** Re-reads the signed-in user, for example after a new profile picture, so the change shows everywhere without signing out. */
  refreshUser: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionLostHandler(() => setUser(null));
    refreshSession().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ user: User; accessToken: string }>("/auth/login", {
      body: { email, password },
      auth: false,
    });
    setAccessToken(data.accessToken);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", body: {}, auth: false });
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const d = await api<{ user: User }>("/auth/me");
      setUser(d.user);
    } catch {
      /* a failed refresh keeps the current user; the next normal request handles an expired session */
    }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshUser }),
    [user, loading, login, logout, refreshUser],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useAuth must be used inside AuthProvider");
  return v;
}
