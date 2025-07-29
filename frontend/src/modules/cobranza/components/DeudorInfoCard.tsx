// src/modules/deudores/components/DeudorInfoCard.tsx
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Deudor } from "../models/deudores.model"

export default function DeudorInfoCard({ deudor }: { deudor: Deudor }) {


  return (
    <Card>
      <CardHeader>
        <CardTitle>Información del Deudor</CardTitle>
      </CardHeader>

      <CardContent className="grid gap-2 text-sm text-muted-foreground">
        <div><span className="font-medium text-foreground">Nombre del deudor:</span> {deudor.nombre}</div>
        <div><span className="font-medium text-foreground">Teléfonos:</span> {deudor.telefonos?.join(', ') || 'No registrados'}</div>
        <div><span className="font-medium text-foreground">Correos:</span> {deudor.correos?.join(', ') || 'No registrados'}</div>
        <div><span className="font-medium text-foreground">Tipificación:</span> {deudor.tipificacion}</div>
        <div><span className="font-medium text-foreground">Deuda total:</span> ${deudor.deuda_total.toLocaleString()}</div>
      </CardContent>
    </Card>
  )
}
