"use client";

import { usePathname, useRouter } from "next/navigation";
import { navItems } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();

  const current = navItems.find(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );
  const title = current?.label ?? "CRM";

  async function handleLogout() {
    const supabase = createClient();
    if (!supabase) {
      router.push("/login");
      return;
    }
    await supabase.auth.signOut();
    router.push("/login");
  }

  if (!user) return null;

  return (
    <header className="flex items-center justify-between h-14 px-6 bg-white border-b border-gray-200 sticky top-0 z-30">
      <h1 className="text-base font-semibold text-gray-800">{title}</h1>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        className="text-gray-500 hover:text-gray-800 gap-2"
      >
        <LogOut className="h-4 w-4" />
        Cerrar sesión
      </Button>
    </header>
  );
}
