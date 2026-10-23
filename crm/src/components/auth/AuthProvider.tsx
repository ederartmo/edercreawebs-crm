"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { Session, AuthChangeEvent } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { AuthSession, AuthUser } from "@/types";

const AuthContext = createContext<AuthSession | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession>({
    user: null,
    loading: true,
    error: null,
  });

  const supabase = createClient();

  useEffect(() => {
    // Si no hay cliente (faltan variables de entorno), terminar loading sin sesión
    if (!supabase) {
      setSession({ user: null, loading: false, error: null });
      return;
    }

    // Obtener sesión inicial
    supabase.auth
      .getSession()
      .then((result: { data: { session: Session | null } }) => {
        const sb_session: Session | null = result.data.session;
        if (sb_session?.user) {
          setSession({
            user: {
              id: sb_session.user.id,
              email: sb_session.user.email || "",
              role: "editor", // Por defecto, se puede cambiar con RLS policy
              created_at: sb_session.user.created_at || new Date().toISOString(),
            },
            loading: false,
            error: null,
          });
        } else {
          setSession({ user: null, loading: false, error: null });
        }
      });

    // Escuchar cambios de autenticación
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, sb_session: Session | null) => {
        if (sb_session?.user) {
          setSession({
            user: {
              id: sb_session.user.id,
              email: sb_session.user.email || "",
              role: "editor",
              created_at: sb_session.user.created_at || new Date().toISOString(),
            },
            loading: false,
            error: null,
          });
        } else {
          setSession({ user: null, loading: false, error: null });
        }
      }
    );

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={session}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return context;
}
