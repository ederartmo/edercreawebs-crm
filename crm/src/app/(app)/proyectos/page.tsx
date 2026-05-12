import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ProyectosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Proyectos</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Proyectos activos, en revisión y entregados.
          </p>
        </div>
        <Badge variant="outline" className="text-xs text-gray-500">
          Próximamente
        </Badge>
      </div>
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-gray-700">
            Módulo en construcción
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400 italic">
            El CRUD de proyectos con checklist y estados se implementará en la
            Fase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
