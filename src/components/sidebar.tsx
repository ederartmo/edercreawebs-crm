import {
  CalendarCheck2,
  FileArchive,
  KanbanSquare,
  LayoutDashboard,
  LogOut,
  MessageSquareText,
  Users,
} from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/(crm)/actions";

const links = [
  { href: "/hoy", label: "Hoy", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: KanbanSquare },
  { href: "/conversaciones", label: "Conversaciones", icon: MessageSquareText },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/tareas", label: "Tareas", icon: CalendarCheck2 },
  { href: "/importar-whatsapp", label: "Importar", icon: FileArchive },
];

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="border-b border-gray-200 bg-white px-4 py-4 lg:fixed lg:inset-y-0 lg:left-0 lg:w-72 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
      <div className="flex items-center justify-between lg:block">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 font-black text-white">
            E
          </div>
          <div>
            <p className="font-bold tracking-tight">Eder CRM</p>
            <p className="text-xs text-gray-500">Sistema comercial</p>
          </div>
        </div>
      </div>

      <nav className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:mt-8 lg:grid-cols-1">
        {links.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-blue-50 hover:text-blue-700"
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      <div className="mt-6 hidden border-t border-gray-100 pt-5 lg:block">
        <p className="truncate text-xs text-gray-500">{email}</p>
        <form action={signOut} className="mt-3">
          <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
            <LogOut size={18} />
            Cerrar sesión
          </button>
        </form>
      </div>
    </aside>
  );
}
