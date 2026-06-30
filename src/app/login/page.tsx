import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/hoy");
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
            Entra a tu CRM
          </h1>
          <p className="mt-2 text-sm leading-6 text-gray-500">
            Prospectos, tareas, cotizaciones y seguimientos en un mismo lugar.
          </p>
        </div>

        <LoginForm />
      </section>
    </main>
  );
}
