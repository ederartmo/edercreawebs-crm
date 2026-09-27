"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type RecoveryState = "checking" | "ready" | "invalid" | "saving" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [state, setState] = useState<RecoveryState>("checking");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const url = new URL(window.location.href);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const errorDescription =
      url.searchParams.get("error_description") ?? hash.get("error_description");

    if (errorDescription) {
      setErrorMessage("El enlace de recuperación es inválido o ya expiró. Solicita uno nuevo.");
      setState("invalid");
      return;
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (cancelled) return;

        if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) {
          setState("ready");
          if (window.location.search || window.location.hash) {
            window.history.replaceState({}, "", "/reset-password");
          }
        }
      },
    );

    async function verifyRecoverySession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (cancelled) return;

      if (session && !error) {
        setState("ready");
        if (window.location.search || window.location.hash) {
          window.history.replaceState({}, "", "/reset-password");
        }
        return;
      }

      setErrorMessage("No hay una sesión de recuperación válida. Solicita un enlace nuevo.");
      setState("invalid");
    }

    void verifyRecoverySession();

    return () => {
      cancelled = true;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmPassword = String(form.get("confirmPassword") ?? "");

    if (password.length < 8) {
      setErrorMessage("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Las contraseñas no coinciden.");
      return;
    }

    setState("saving");
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setErrorMessage("No pude actualizar la contraseña. Solicita un enlace nuevo e intenta otra vez.");
      setState("ready");
      return;
    }

    setState("done");
    window.setTimeout(() => {
      router.replace("/hoy");
      router.refresh();
    }, 700);
  }

  return (
    <main className="min-h-screen px-5 py-10 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-gray-200 bg-white p-8 shadow-xl shadow-blue-950/5">
        <div className="mb-8">
          <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-xl font-black text-white">
            E
          </div>
          <p className="text-sm font-semibold text-blue-600">EDERCREAWEBS</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Crea una contraseña nueva
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Usa una contraseña nueva para volver a entrar a tu CRM.
          </p>
        </div>

        {state === "checking" ? (
          <p className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800">
            Validando enlace de recuperación…
          </p>
        ) : null}

        {state === "invalid" ? (
          <div className="space-y-5">
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {errorMessage}
            </p>
            <Link
              href="/forgot-password"
              className="block w-full rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white transition hover:bg-blue-700"
            >
              Pedir un enlace nuevo
            </Link>
            <Link
              href="/login"
              className="block text-center text-sm font-medium text-gray-600 hover:text-gray-800"
            >
              Volver al login
            </Link>
          </div>
        ) : null}

        {state === "ready" || state === "saving" ? (
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Nueva contraseña
              </span>
              <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Mínimo 8 caracteres"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Confirma la contraseña
              </span>
              <input
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                minLength={8}
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="Repite la contraseña"
              />
            </label>

            {errorMessage ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={state === "saving"}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {state === "saving" ? "Guardando…" : "Guardar contraseña nueva"}
            </button>
          </form>
        ) : null}

        {state === "done" ? (
          <p className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
            Contraseña actualizada. Entrando al CRM…
          </p>
        ) : null}
      </section>
    </main>
  );
}
