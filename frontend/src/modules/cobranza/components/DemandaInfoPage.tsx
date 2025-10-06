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
    // Firestore Timestamp
    if (typeof anyDate?.toDate === "function") {
      return anyDate.toDate().toISOString().slice(0, 10);
    }
    // { seconds, nanoseconds }
    if (typeof anyDate?.seconds === "number") {
      return new Date(anyDate.seconds * 1000).toISOString().slice(0, 10);
    }
    // Date
    if (anyDate instanceof Date) {
      return anyDate.toISOString().slice(0, 10);
    }
    // string ISO/fecha
    const d = new Date(anyDate);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  } catch {
    return "";
  }
}

function formatEs(dateInput: string) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
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
  const hasRole = (r: Rol) => roles.includes(r);
  const aclLoading = acl.loading;
  const puedeEditar = can(PERMS.Deudores_Edit); // ejecutivos/admin (según tu ACL) pueden editar
  const isCliente = roles.includes("cliente");

  const roDatosPrincipales = !puedeEditar; // Demandados/Juzgado/Radicado/Localidad/Fecha revisión
  const roObsInternas = !puedeEditar;      // Solo ejecutivos/admin editan
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
    fechaUltimaRevision: "", // 👈 NUEVO
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
          fechaUltimaRevision: toDateInputValue((data as any).fechaUltimaRevision), // 👈 mapear al input date
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

  const handleGuardar = async () => {
    if (!puedeEditar || !clienteId || !deudorId) return;
    try {
      setSaving(true);
      const ref = doc(db, `clientes/${clienteId}/deudores/${deudorId}`);

      // Solo persistimos campos explícitos de la demanda
      const payload: Partial<Deudor> = {
        demandados: form.demandados || "",
        juzgado: form.juzgado || "",
        numeroRadicado: form.numeroRadicado || "",
        localidad: form.localidad || "",
        observacionesDemanda: form.observacionesDemanda || "",
        observacionesDemandaCliente: form.observacionesDemandaCliente || "",
      };

      if (form.fechaUltimaRevision) {
        payload.fechaUltimaRevision = new Date(form.fechaUltimaRevision); // Firestore lo guarda como Timestamp
      } else {
        payload.fechaUltimaRevision = null; // opcional: limpiar si la borran
      }

      await updateDoc(ref, payload as any);

      // Refresca estado base (opcional)
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

  const ro = !puedeEditar; // readOnly global si no puede editar

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Información de la demanda</h1>
        <div className="flex gap-2">
          <Button asChild variant="secondary">
            <Link to={`/deudores/${clienteId}/${deudorId}`}>Volver</Link>
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

          {/* 👇 NUEVO CAMPO */}
          <Field
            label="Fecha última revisión"
            readOnly={roDatosPrincipales}
            value={form.fechaUltimaRevision}
            onChange={onChange("fechaUltimaRevision")}
            type="date"
          />
        </CardContent>
      </Card>

      {/* Observaciones internas: se OCULTA para rol cliente en solo lectura */}
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

          {/* Botón solo para CLIENTE (si se habilita en el futuro) */}
          {false && isCliente && (
            <div className="flex items-center justify-between">
              {/* Fecha de última actualización si existe */}
              <small className="text-muted-foreground">
                {(() => {
                  const ts = (deudor as any)?.observacionesDemandaClienteFecha;
                  const d = ts && typeof ts.toDate === "function" ? ts.toDate() : null;
                  return d ? `Última actualización: ${d.toLocaleString("es-CO", { hour12: false })}` : "";
                })()}
              </small>
            </div>
          )}

          {/* Si NO es cliente, igual mostramos la fecha si existe */}
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

export default DemandaInfoPage;
