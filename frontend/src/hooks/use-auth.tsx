import { createContext, useContext, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const { data: user = null, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      try {
        return await api.auth.me();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) => api.auth.login(email, password),
    onSuccess: (u) => queryClient.setQueryData(["me"], u),
  });

  const logoutMutation = useMutation({
    mutationFn: () => api.auth.logout(),
    onSettled: () => {
      queryClient.setQueryData(["me"], null);
      queryClient.clear();
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login: (email, password) => loginMutation.mutateAsync({ email, password }),
        logout: async () => {
          await logoutMutation.mutateAsync();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
