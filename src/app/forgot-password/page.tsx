"use client";

import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { FormEvent, useState } from "react";

export default function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") ?? "").trim();

    if (!email) {
      setErrorMessage("Escribe tu correo.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      setErrorMessage("No pude enviar el correo de recuperación. Intenta otra vez.");
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
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
            Recupera tu contraseña
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Te enviaremos un enlace seguro para crear una contraseña nueva.
          </p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <p className="rounded-xl bg-green-50 px-4 py-3 text-sm leading-6 text-green-800">
              Si el correo está registrado, recibirás un enlace de recuperación. Usa el enlace más reciente que llegue a tu bandeja.
            </p>
            <Link
              href="/login"
              className="block w-full rounded-xl border border-gray-300 px-4 py-3 text-center font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Volver al login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-gray-700">
                Correo
              </span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                placeholder="correo@ejemplo.com"
              />
            </label>

            {errorMessage ? (
              <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                {errorMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Enviando…" : "Enviar enlace de recuperación"}
            </button>

            <Link
              href="/login"
              className="block text-center text-sm font-medium text-blue-600 hover:text-blue-700"
            >
              Volver al login
            </Link>
          </form>
        )}
      </section>
    </main>
  );
}
