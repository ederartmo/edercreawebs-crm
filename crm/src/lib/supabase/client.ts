import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Durante build, si faltan vars de entorno, retorna stub
  if (!supabaseUrl || !supabaseKey) {
    if (typeof window === "undefined") {
      // SSR: retorna null durante build
      return null as any;
    }
    console.warn(
      "Supabase credentials not found. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
    return null as any;
  }

  return createBrowserClient(supabaseUrl, supabaseKey);
}
