// src/modules/deudores/components/DemandaDatosPrincipalesCard.tsx
import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Loader2 } from "lucide-react";

/* ===== Helpers fecha ===== */
function parseLocalYmd(ymd: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}
function formatEs(dateInput: string) {
  if (!dateInput) return "—";
  const d = parseLocalYmd(dateInput) ?? new Date(dateInput);
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

/* ===== Subcomponentes de campo ===== */
function Field({
  label,
  value,
  readOnly,
  onChange,
  type = "text",
}: {
  label: string;
  value: string | number | null | undefined;
  readOnly?: boolean;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: React.HTMLInputTypeAttribute;
}) {
  const display = value === null || value === undefined ? "" : String(value);
  const isDate = type === "date";
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      {readOnly ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
          {isDate ? formatEs(display) : display.trim() ? display : "—"}
        </div>
      ) : (
        <Input value={display} onChange={onChange} type={type} />
      )}
    </div>
  );
}

function DateField({
  label,
  value,
  readOnly,
  onChangeDate,
}: {
  label: string;
  value: string | null | undefined; // 'YYYY-MM-DD'
  readOnly?: boolean;
  onChangeDate?: (d?: Date) => void;
}) {
  const dateObj = React.useMemo(() => {
    if (!value) return undefined;
    return parseLocalYmd(value) ?? new Date(value);
  }, [value]);

  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground">{label}</Label>
      {readOnly ? (
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-sm">
          {value ? formatEs(value) : "—"}
        </div>
      ) : (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-left font-normal">
              {dateObj ? formatEs(value!) : "Selecciona una fecha"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={dateObj} onSelect={onChangeDate} initialFocus />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

/* ===== Props del Card ===== */
export interface DemandaDatosPrincipalesProps {
  readOnly?: boolean;
  values: {
    demandados: string;
    juzgado: string;
    numeroRadicado: string;
    localidad: string;
    fechaUltimaRevision: string | null | undefined; // 'YYYY-MM-DD'
  };
  onChange: (key: keyof DemandaDatosPrincipalesProps["values"]) =>
    (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeDate: (key: keyof DemandaDatosPrincipalesProps["values"]) =>
    (d?: Date) => void;

  /** Nuevo: control del botón Guardar */
  canSave?: boolean;                 // equivalente a puedeEditar
  saving?: boolean;                  // estado de guardado
  onSave?: () => void;               // handler para guardar
  saveText?: string;                 // texto del botón (opcional)
}

/* ===== Componente exportable ===== */
export default function DemandaDatosPrincipalesCard({
  readOnly,
  values,
  onChange,
  onChangeDate,
  canSave = false,
  saving = false,
  onSave,
  saveText = "Guardar cambios",
}: DemandaDatosPrincipalesProps) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label="Demandados" readOnly={readOnly} value={values.demandados} onChange={onChange("demandados")} />
        <Field label="Juzgado" readOnly={readOnly} value={values.juzgado} onChange={onChange("juzgado")} />
        <Field label="Número de radicado" readOnly={readOnly} value={values.numeroRadicado} onChange={onChange("numeroRadicado")} />
        <Field label="Localidad" readOnly={readOnly} value={values.localidad} onChange={onChange("localidad")} />
        <DateField
          label="Fecha última revisión"
          readOnly={readOnly}
          value={values.fechaUltimaRevision}
          onChangeDate={onChangeDate("fechaUltimaRevision")}
        />

        {/* ===== Fila de acciones (ancho completo) ===== */}
        {canSave && (
          <div className="md:col-span-2 flex justify-end pt-2">
            <Button
              type="button"
              onClick={onSave}
              disabled={saving}
              aria-busy={saving}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Guardando…</span>
                </span>
              ) : (
                saveText
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
