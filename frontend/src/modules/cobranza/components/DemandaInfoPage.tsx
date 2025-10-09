// src/modules/deudores/pages/DemandaInfoPage.tsx
import * as React from "react";
import { useParams, Link } from "react-router-dom";
import { doc, getDoc, updateDoc } from "firebase/firestore";

import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Skeleton } from "@/shared/ui/skeleton";
import { db } from "@/firebase";

import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";

import { Deudor } from "../models/deudores.model";

// 🔐 ACL
import {
  PERMS,
  sanitizeRoles,
  type Rol,
  type Perm,
} from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";

/** Helpers de fecha */
function toDateInputValue(anyDate: any): string {
  try {
    if (!anyDate) return "";
    if (typeof anyDate?.toDate === "function") {
      return anyDate.toDate().toISOString().slice(0, 10);
    }
    if (typeof anyDate?.seconds === "number") {
      return new Date(anyDate.seconds * 1000).toISOString().slice(0, 10);
    }
    if (anyDate instanceof Date) {
      return anyDate.toISOString().slice(0, 10);
    }
    const d = new Date(anyDate);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function parseLocalYmd(ymd: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return undefined;
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1); // local midnight
}

function formatEs(dateInput: string) {
  if (!dateInput) return "—";
  const d =
    parseLocalYmd(dateInput) ?? // <-- si viene como 'YYYY-MM-DD', parsea local
    new Date(dateInput);        // fallback
  return isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
}

export function DemandaInfoPage() {
  const { clienteId, deudorId } = useParams();

  // ACL
  const acl = useAcl() as {
    usuario: { roles?: Rol[] } | null;
    roles: Rol[];
    perms: Set<Perm>;
    can: (req: Perm | Perm[]) => boolean;
    loading: boolean;
  };
  const user = acl.usuario ? { roles: acl.usuario.roles } : undefined;
  const can = (p: Perm) => acl.can(p);
  const roles = sanitizeRoles(user?.roles ?? []);
  const aclLoading = acl.loading;
  const puedeEditar = can(PERMS.Deudores_Edit);
  const isCliente = roles.includes("cliente");

  const roDatosPrincipales = !puedeEditar;
  const roObsInternas = !puedeEditar;
  const roObsConjunto = !puedeEditar;

  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Datos originales
  const [deudor, setDeudor] = React.useState<Deudor | null>(null);

  // Form controlado
  const [form, setForm] = React.useState({
    demandados: "",
    juzgado: "",
    numeroRadicado: "",
    localidad: "",
    observacionesDemanda: "",
    observacionesDemandaCliente: "",
    fechaUltimaRevision: "", // YYYY-MM-DD
  });

  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        if (!clienteId || !deudorId) throw new Error("Faltan parámetros");
        const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);
        const snap = await getDoc(ref);
        if (!snap.exists()) throw new Error("El deudor no existe");

        const data = { id: deudorId, ...(snap.data() as Deudor) };
        setDeudor(data as Deudor);

        setForm({
          demandados: (data as any).demandados ?? "",
          juzgado: (data as any).juzgado ?? (data as any).juzgadoId ?? "",
          numeroRadicado:
            (data as any).numeroRadicado ?? (data as any).numeroProceso ?? "",
          localidad: (data as any).localidad ?? "",
          observacionesDemanda: (data as any).observacionesDemanda ?? "",
          observacionesDemandaCliente:
            (data as any).observacionesDemandaCliente ?? "",
          fechaUltimaRevision: toDateInputValue((data as any).fechaUltimaRevision),
        });
      } catch (e: any) {
        setError(e.message ?? "Error cargando la demanda");
      } finally {
        setLoading(false);
      }
    })();
  }, [clienteId, deudorId]);

  const onChange =
    (key: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value }));

  /** setea YYYY-MM-DD desde un Date del Calendar */
 const onChangeDate = (key: keyof typeof form) => (date?: Date) => {
  const val = date ? date.toISOString().slice(0, 10) : "";
  setForm((s) => ({ ...s, [key]: val }));
};

  const handleGuardar = async () => {
    if (!puedeEditar || !clienteId || !deudorId) return;
    try {
      setSaving(true);
      const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);

      const payload: Partial<Deudor> = {
        demandados: form.demandados || "",
        juzgado: form.juzgado || "",
        numeroRadicado: form.numeroRadicado || "",
        localidad: form.localidad || "",
        observacionesDemanda: form.observacionesDemanda || "",
        observacionesDemandaCliente: form.observacionesDemandaCliente || "",
      };

      if (form.fechaUltimaRevision) {
        payload.fechaUltimaRevision = new Date(form.fechaUltimaRevision);
      } else {
        payload.fechaUltimaRevision = null;
      }

      await updateDoc(ref, payload as any);
      setDeudor((prev) => (prev ? ({ ...prev, ...payload } as Deudor) : prev));
    } catch (e: any) {
      setError(e.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (aclLoading || loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Información de la demanda</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-red-600">{error}</p>
          <div className="flex gap-2">
            <Button asChild variant="secondary">
              <Link to={`/deudores/${clienteId}/${deudorId}`}>Volver</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const ro = !puedeEditar;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Información de la demanda</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to={`/clientes/${clienteId}/deudores/${deudorId}`}>Volver</Link>
          </Button>
          {puedeEditar && (
            <Button onClick={handleGuardar} disabled={saving}>
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Datos principales</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field
            label="Demandados"
            readOnly={roDatosPrincipales}
            value={form.demandados}
            onChange={onChange("demandados")}
          />
          <Field
            label="Juzgado"
            readOnly={roDatosPrincipales}
            value={form.juzgado}
            onChange={onChange("juzgado")}
          />
          <Field
            label="Número de radicado"
            readOnly={roDatosPrincipales}
            value={form.numeroRadicado}
            onChange={onChange("numeroRadicado")}
          />
          <Field
            label="Localidad"
            readOnly={roDatosPrincipales}
            value={form.localidad}
            onChange={onChange("localidad")}
          />

          {/* ✅ Calendar en vez de <input type="date" /> */}
          <DateField
            label="Fecha última revisión"
            readOnly={roDatosPrincipales}
            value={form.fechaUltimaRevision}         // YYYY-MM-DD
            onChangeDate={onChangeDate("fechaUltimaRevision")}
          />
        </CardContent>
      </Card>

      {!isCliente && (
        <Card>
          <CardHeader>
            <CardTitle>Observaciones (internas)</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.observacionesDemanda}
              onChange={onChange("observacionesDemanda")}
              readOnly={roObsInternas}
              className="min-h-36"
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Observaciones del Conjunto</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={form.observacionesDemandaCliente}
            onChange={onChange("observacionesDemandaCliente")}
            readOnly={roObsConjunto}
            className="min-h-36"
            placeholder={isCliente ? "Escribe tu observación para el ejecutivo…" : ""}
          />
          {!isCliente && (
            <small className="text-muted-foreground block text-right">
              {(() => {
                const ts = (deudor as any)?.observacionesDemandaClienteFecha;
                const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
                return d ? `Última actualización: ${d.toLocaleString("es-CO", { hour12: false })}` : "";
              })()}
            </small>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

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

/** ✅ Campo de fecha con Calendar (shadcn) */
function DateField({ label, value, readOnly, onChangeDate }: {
  label: string;
  value: string | null | undefined; // 'YYYY-MM-DD'
  readOnly?: boolean;
  onChangeDate?: (d?: Date) => void;
}) {
  const dateObj = React.useMemo(() => {
    if (!value) return undefined;
    return parseLocalYmd(value) ?? new Date(value); // <-- parsea local primero
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
            <Calendar
              mode="single"
              selected={dateObj}
              onSelect={onChangeDate}
              initialFocus
            />
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}

export default DemandaInfoPage;
