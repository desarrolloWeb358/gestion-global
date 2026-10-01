import * as React from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { normalizeToE164 } from "@/shared/phoneUtils";
import type { ExternoEvento } from "../models/evento.model";

const MAX_EXTERNOS = 10;

/** El teléfono tal como se escribe; se normaliza a E.164 al guardar. */
export function telefonoExternoValido(telefono: string): string | undefined {
  return normalizeToE164(telefono, { defaultCountry: "CO" });
}

function nuevoId(): string {
  return crypto.randomUUID().slice(0, 8);
}

interface ExternosEditorProps {
  externos: ExternoEvento[];
  onChange: (externos: ExternoEvento[]) => void;
  disabled?: boolean;
}

/**
 * Asistentes que no tienen cuenta en la plataforma. Solo piden nombre y
 * WhatsApp porque es el único canal por el que se les puede avisar.
 */
export function ExternosEditor({ externos, onChange, disabled }: ExternosEditorProps) {
  function actualizar(id: string, patch: Partial<ExternoEvento>) {
    onChange(externos.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  }

  return (
    <div className="space-y-2">
      {externos.map((externo) => {
        const telefonoMalo =
          externo.telefono.trim() !== "" && !telefonoExternoValido(externo.telefono);
        return (
          <div key={externo.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Input
                value={externo.nombre}
                onChange={(e) => actualizar(externo.id, { nombre: e.target.value })}
                placeholder="Nombre"
                aria-label="Nombre del asistente externo"
                className="flex-1"
                disabled={disabled}
              />
              <Input
                value={externo.telefono}
                onChange={(e) => actualizar(externo.id, { telefono: e.target.value })}
                placeholder="WhatsApp, ej: 300 123 4567"
                aria-label="WhatsApp del asistente externo"
                inputMode="tel"
                className="flex-1"
                disabled={disabled}
              />
              {!disabled && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onChange(externos.filter((e) => e.id !== externo.id))}
                  aria-label="Quitar asistente externo"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            {telefonoMalo && (
              <p className="text-xs text-destructive">Número de WhatsApp no válido.</p>
            )}
          </div>
        );
      })}

      {!disabled && externos.length < MAX_EXTERNOS && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...externos, { id: nuevoId(), nombre: "", telefono: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" />
          Agregar asistente externo
        </Button>
      )}
    </div>
  );
}
