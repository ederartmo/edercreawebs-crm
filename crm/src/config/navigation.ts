import {
  LayoutDashboard,
  Users,
  UserCheck,
  FolderKanban,
  CreditCard,
  FileText,
} from "lucide-react";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/clientes", label: "Clientes", icon: UserCheck },
  { href: "/proyectos", label: "Proyectos", icon: FolderKanban },
  { href: "/pagos", label: "Pagos", icon: CreditCard },
  { href: "/cotizaciones/nueva", label: "Cotizaciones", icon: FileText },
];
