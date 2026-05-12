import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, UserCheck, FolderKanban, CreditCard } from "lucide-react";

const stats = [
  {
    label: "Leads activos",
    value: "—",
    icon: Users,
    description: "Pendientes de seguimiento",
  },
  {
    label: "Clientes",
    value: "—",
    icon: UserCheck,
    description: "Total registrados",
  },
  {
    label: "Proyectos en curso",
    value: "—",
    icon: FolderKanban,
    description: "En progreso actualmente",
  },
  {
    label: "Pagos pendientes",
    value: "—",
    icon: CreditCard,
    description: "Por cobrar",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Header de sección */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Resumen</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Vista general del CRM.
          </p>
        </div>
        <Badge variant="outline" className="text-xs text-gray-500">
          Fase 1 · Estructura lista
        </Badge>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, description }) => (
          <Card key={label} className="border border-gray-200 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {label}
              </CardTitle>
              <Icon className="h-4 w-4 text-gray-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <CardDescription className="text-xs text-gray-400 mt-1">
                {description}
              </CardDescription>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Placeholder próximas acciones */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">
            Próximas acciones
          </CardTitle>
          <CardDescription className="text-xs text-gray-400">
            Aquí aparecerán las tareas pendientes y seguimientos cuando se
            implementen los módulos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 italic">
            Sin datos aún. Completa la Fase 2 para ver el contenido.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
