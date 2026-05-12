import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Proteger todas menos:
     * - /login y rutas públicas
     * - /auth/* (callbacks)
     * - API routes, assets, etc.
     */
    "/((?!login|auth|_next/static|_next/image|favicon.ico|public).*)",
  ],
};
