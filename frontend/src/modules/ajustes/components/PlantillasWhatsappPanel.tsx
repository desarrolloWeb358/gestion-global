// Ajustes > Plantillas WhatsApp. Las plantillas se guardan por número
// (numbers/{id}/templates), así que primero se elige la línea.
import React from "react";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { listenNumbers } from "@/modules/whatsapp/services/numbersService";
import type { WaNumber } from "@/modules/whatsapp/models/waNumber.model";
import TemplatesManager from "@/modules/whatsapp/components/TemplatesManager";

export default function PlantillasWhatsappPanel() {
  const [numeros, setNumeros] = React.useState<WaNumber[] | null>(null);
  const [numberId, setNumberId] = React.useState<string | null>(null);

  React.useEffect(() => listenNumbers(setNumeros), []);

  // Con una sola línea (lo normal) no hay nada que elegir.
  React.useEffect(() => {
    if (!numberId && numeros && numeros.length > 0) setNumberId(numeros[0].id);
  }, [numeros, numberId]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Plantillas WhatsApp</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plantillas aprobadas en Meta Business Suite. Registra aquí las que ya aprobó Meta
          para poder usarlas en los envíos.
        </p>
      </div>

      {numeros && numeros.length > 1 && (
        <div className="max-w-xs space-y-1.5">
          <Label>Línea de WhatsApp</Label>
          <Select value={numberId ?? undefined} onValueChange={setNumberId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona una línea" />
            </SelectTrigger>
            <SelectContent>
              {numeros.map((n) => (
                <SelectItem key={n.id} value={n.id}>
                  {n.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {numberId ? (
        <TemplatesManager key={numberId} numberId={numberId} />
      ) : numeros === null ? (
        <p className="text-sm text-muted-foreground">Cargando líneas...</p>
      ) : (
        <p className="text-sm text-muted-foreground">No hay líneas de WhatsApp configuradas.</p>
      )}
    </div>
  );
}
