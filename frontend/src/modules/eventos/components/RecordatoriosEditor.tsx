import * as React from "react";
import { Bell, Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { CANAL_LABELS, OPCIONES_ANTELACION } from "../constants/eventoConstants";
import type { CanalAviso, RecordatorioEvento } from "../models/evento.model";

const CANALES: CanalAviso[] = ["app", "email", "whatsapp"];
const MAX_RECORDATORIOS = 4;

interface RecordatoriosEditorProps {
  recordatorios: RecordatorioEvento[];
  onChange: (recordatorios: RecordatorioEvento[]) => void;
  disabled?: boolean;
  /** Se muestra un aviso si nadie del evento tiene telefono. */
  whatsappDisponible?: boolean;
}

export function RecordatoriosEditor({
  recordatorios,
  onChange,
  disabled,
  whatsappDisponible = true,
}: RecordatoriosEditorProps) {
  function actualizar(indice: number, patch: Partial<RecordatorioEvento>) {
    onChange(
      recordatorios.map((r, i) => (i === indice ? { ...r, ...patch } : r))
    );
  }

  function alternarCanal(indice: number, canal: CanalAviso) {
    const actual = recordatorios[indice];
    const canales = actual.canales.includes(canal)
      ? actual.canales.filter((c) => c !== canal)
      : [...actual.canales, canal];
    actualizar(indice, { canales });
  }

  function agregar() {
    // Sugiere una antelacion que todavia no este usada, para no duplicar avisos.
    const usadas = new Set(recordatorios.map((r) => r.minutosAntes));
    const libre = OPCIONES_ANTELACION.find((o) => !usadas.has(o.minutos));
    onChange([
      ...recordatorios,
      { minutosAntes: libre?.minutos ?? 60, canales: ["app"] },
    ]);
  }

  return (
    <div className="space-y-2">
      {recordatorios.length === 0 && (
        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
          Sin recordatorios. Agrega uno si quieres que se avise antes del evento.
        </p>
      )}

      {recordatorios.map((recordatorio, indice) => {
        // Un recordatorio sin canales no genera ningun aviso: se marca en rojo.
        const sinCanales = recordatorio.canales.length === 0;
        return (
          <div
            key={indice}
            className="flex flex-wrap items-center gap-2 rounded-md border p-2"
          >
            <Bell className="h-4 w-4 shrink-0 text-muted-foreground" />

            <Select
              value={String(recordatorio.minutosAntes)}
              onValueChange={(v) =>
                actualizar(indice, { minutosAntes: Number.parseInt(v, 10) })
              }
              disabled={disabled}
            >
              <SelectTrigger className="h-8 w-[170px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPCIONES_ANTELACION.map((o) => (
                  <SelectItem key={o.minutos} value={String(o.minutos)}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-wrap items-center gap-3">
              {CANALES.map((canal) => {
                const deshabilitado =
                  disabled || (canal === "whatsapp" && !whatsappDisponible);
                return (
                  <label
                    key={canal}
                    className="flex items-center gap-1.5 text-sm data-[off=true]:opacity-50"
                    data-off={deshabilitado}
                  >
                    <Checkbox
                      checked={recordatorio.canales.includes(canal)}
                      onCheckedChange={() => alternarCanal(indice, canal)}
                      disabled={deshabilitado}
                    />
                    {CANAL_LABELS[canal]}
                  </label>
                );
              })}
            </div>

            {sinCanales && (
              <span className="text-xs text-destructive">Elige al menos un canal</span>
            )}

            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="ml-auto h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => onChange(recordatorios.filter((_, i) => i !== indice))}
                aria-label="Quitar recordatorio"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
      })}

      {!disabled && recordatorios.length < MAX_RECORDATORIOS && (
        <Button type="button" variant="outline" size="sm" onClick={agregar}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar recordatorio
        </Button>
      )}

      {!whatsappDisponible && (
        <p className="text-xs text-muted-foreground">
          El canal de WhatsApp se activa cuando al menos un participante tiene
          telefono registrado.
        </p>
      )}
    </div>
  );
}
