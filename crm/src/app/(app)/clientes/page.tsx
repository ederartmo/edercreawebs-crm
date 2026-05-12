import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ClientesPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clientes</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Clientes convertidos y activos.
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
            El CRUD de clientes se implementará en la Fase 2.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
