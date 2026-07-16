import { useCallback, useSyncExternalStore } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (returnTo?: string) => void;
  logout: () => void;
}

type AuthSnapshot = Pick<AuthState, "user" | "isLoading" | "isAuthenticated">;

let snapshot: AuthSnapshot = {
  user: null,
  isLoading: true,
  isAuthenticated: false,
};
let logoutToken: string | null = null;
let authLoadStarted = false;
const listeners = new Set<() => void>();

function emit(next: Omit<AuthSnapshot, "isAuthenticated">) {
  snapshot = {
    ...next,
    isAuthenticated: !!next.user,
  };
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  ensureAuthLoaded();
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureAuthLoaded();
  return snapshot;
}

function getServerSnapshot() {
  return snapshot;
}

function ensureAuthLoaded() {
  if (authLoadStarted) return;
  authLoadStarted = true;
  void loadAuth();
}

async function loadAuth() {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch("/api/auth/user", {
        credentials: "include",
        headers: { accept: "application/json" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null; logoutToken?: string | null };
      logoutToken = data.logoutToken ?? null;
      emit({ user: data.user ?? null, isLoading: false });
      return;
    } catch {
      if (attempt === 0) {
        await new Promise((resolve) => setTimeout(resolve, 250));
        continue;
      }
      emit({ user: null, isLoading: false });
    }
  }
}

export function useAuth(): AuthState {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((returnTo?: string) => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
    const target = returnTo
      ? (returnTo.startsWith("/") ? `${base === "/" ? "" : base}${returnTo}` : returnTo)
      : base;
    window.location.href = `/api/login?returnTo=${encodeURIComponent(target)}`;
  }, []);

  const logout = useCallback(() => {
    if (!logoutToken) return;
    window.location.href = `/api/logout?token=${encodeURIComponent(logoutToken)}`;
  }, []);

  return {
    ...state,
    login,
    logout,
  };
}
