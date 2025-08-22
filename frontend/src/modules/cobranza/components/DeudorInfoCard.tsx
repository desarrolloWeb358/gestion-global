// src/modules/deudores/components/DeudorInfoCard.tsx
import { useNavigate } from "react-router-dom"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Deudor } from "../models/deudores.model"
import { Button } from "@/components/ui/button"
import { Eye, History } from "lucide-react"
import { calcularDeudaTotal } from "../services/deudorService"
import { EstadoMensual } from "../models/estadoMensual.model"

// ✅ Esto debe ir al inicio del archivo o exportarse si se usará en otro lugar
export interface DeudorInfoCardProps {
  deudor: Deudor;
  clienteId: string;
  abonos?: EstadoMensual[];
}

export default function DeudorInfoCard({ deudor, clienteId, abonos }: DeudorInfoCardProps) {
  const navigate = useNavigate();


  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Deudor</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-3 text-sm text-muted-foreground">
        <div><span className="font-medium text-foreground">Nombre del deudor:</span> {deudor.nombre}</div>
        <div><span className="font-medium text-foreground">Teléfonos:</span> {deudor.telefonos?.join(', ') || 'No registrados'}</div>
        <div><span className="font-medium text-foreground">Correos:</span> {deudor.correos?.join(', ') || 'No registrados'}</div>
        <div><span className="font-medium text-foreground">Tipificación:</span> {deudor.tipificacion}</div>

  

        {/* Acciones */}
        <div className="pt-4 flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/acuerdo`)}
          >
            <Eye className="w-4 h-4 mr-1" />
            Ver Acuerdo
          </Button>

          <Button
            variant="outline"
            onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/seguimiento`)}
          >
            <History className="w-4 h-4 mr-1" />
            Seguimiento
          </Button>
          <Button
            variant="outline"
            onClick={() => navigate(`/deudores/${clienteId}/${deudor.id}/estadosMensuales`)}
          >
            <History className="w-4 h-4 mr-1" />
            Abonos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
