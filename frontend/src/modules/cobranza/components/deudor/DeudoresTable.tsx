import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, Pencil, Search, X, Users, UserPlus, Filter, FileText, Trash2, CalendarIcon, Upload, Download, CheckCircle2, AlertCircle, AlertTriangle, MinusCircle } from "lucide-react";
import { createPortal } from "react-dom";

import { Deudor } from "../../models/deudores.model";
import {
  obtenerDeudorPorCliente,
  crearDeudor,
  actualizarDeudorDatos,
  borrarDeudorCompleto,
  mergeContactosDeudor,
  DeudorPatch,
} from "../../services/deudorService";

import { Cliente } from "@/modules/clientes/models/cliente.model";
import { getClienteById } from "@/modules/clientes/services/clienteService";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";

import { BadgeTipificacion } from "@/shared/components/BadgeTipificacion";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/shared/ui/dialog";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// 🔐 ACL
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { PERMS } from "@/shared/constants/acl";

// ✅ Historial tipificaciones
import type { HistorialTipificacion } from "../../models/historialTipificacion.model";
import { crearEstadoMensual, obtenerEstadosMensuales } from "../../services/estadoMensualService";

import { Timestamp } from "firebase/firestore";

import {
  obtenerHistorialTipificaciones,
  reemplazarHistorialTipificaciones,
  tipificacionActivaDesdeHistorial,
} from "../../services/historialTipificacionesService";

import {
  isFinalTip,
  inicioDentroDelAnio,
  getTipificacionEnFechaCorte,
} from "../../services/reportes/tipificacionService";

const ALL = "__ALL__";
const ALL_ANIO = "__ALL_ANIO__";
const CURRENT_YEAR = new Date().getFullYear();

function parseTipFilters(searchParams: URLSearchParams, savedFilter: URLSearchParams) {
  const rawTips = searchParams.get("tips") ?? savedFilter.get("tips");
  if (rawTips) {
    const values = rawTips.split(",").filter(Boolean);
    if (values.includes(ALL)) return [ALL];
    if (values.includes(ALL_ANIO)) return [ALL_ANIO];
    return values.length > 0 ? values : [ALL];
  }

  const legacyTip = searchParams.get("tip") ?? savedFilter.get("tip");
  return legacyTip ? [legacyTip] : [ALL];
}

/* =========================
   Utilidades de teléfonos
========================= */

function normalizarTelefono(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("57")) digits = digits.slice(2);
  else if (digits.length === 13 && digits.startsWith("057")) digits = digits.slice(3);
  return digits;
}

// Divide una cadena de dígitos larga en chunks válidos (057+10, 57+10, o 10 dígitos).
// Cada chunk luego pasa por normalizarTelefono que elimina el prefijo, quedando siempre en 10 dígitos.
function splitarNumerosLargos(digits: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < digits.length) {
    const rem = digits.length - i;
    if (digits.startsWith("057", i) && rem >= 13) {
      result.push(digits.slice(i, i + 13)); i += 13;
    } else if (digits.startsWith("57", i) && rem >= 12) {
      result.push(digits.slice(i, i + 12)); i += 12;
    } else if (rem >= 10) {
      result.push(digits.slice(i, i + 10)); i += 10;
    } else {
      result.push(digits.slice(i)); break;
    }
  }
  return result;
}

// Parsea uno o varios teléfonos desde un texto libre (separadores: coma, punto y coma, barra, salto de línea, o espacio cuando hay múltiples)
function parsearTelefonosDeTexto(texto: string): string[] {
  const phones: string[] = [];
  const tryAdd = (raw: string) => {
    const n = normalizarTelefono(raw);
    if (n && !phones.includes(n)) phones.push(n);
  };
  const assembleAndAdd = (segment: string) => {
    const tokens = segment.trim().split(/\s+/);
    let acc = "";
    for (const token of tokens) {
      acc += token.replace(/\D/g, "");
      if (
        acc.length === 10 ||
        (acc.length === 12 && acc.startsWith("57")) ||
        (acc.length === 13 && acc.startsWith("057"))
      ) { tryAdd(acc); acc = ""; }
    }
    if (acc) {
      if (acc.length > 13) splitarNumerosLargos(acc).forEach(tryAdd);
      else tryAdd(acc);
    }
  };
  for (const segment of texto.split(/[,;\/\n]+/)) {
    const digits = segment.replace(/\D/g, "");
    if (digits.length > 13) assembleAndAdd(segment);
    else tryAdd(segment);
  }
  return phones;
}

function parsearCorreosDeTexto(texto: string): string[] {
  const correos: string[] = [];
  for (const raw of texto.split(/[,;\/\n\s]+/)) {
    const e = raw.trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !correos.includes(e))
      correos.push(e);
  }
  return correos;
}

function normalizarEncabezado(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function PhoneTagInput({
  value,
  onChange,
  readOnly,
  disabled,
}: {
  value: string[];
  onChange: (phones: string[]) => void;
  readOnly?: boolean;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");

  const addPhone = (raw: string) => {
    const normalized = normalizarTelefono(raw.trim());
    if (!normalized || value.includes(normalized)) return;
    onChange([...value, normalized]);
  };

  const removePhone = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      e.preventDefault();
      addPhone(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      removePhone(value.length - 1);
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const parsed = parsearTelefonosDeTexto(pasted);
    const toAdd = parsed.filter((p) => !value.includes(p));
    onChange([...value, ...toAdd]);
    setInput("");
  };

  return (
    <div className="mt-1.5 min-h-[42px] flex flex-wrap gap-1.5 rounded-md border border-brand-secondary/30 bg-white px-2 py-1.5 focus-within:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary/20 transition-colors">
      {value.map((phone, idx) => (
        <span
          key={idx}
          className="inline-flex items-center gap-1 rounded-full bg-brand-primary/10 px-2.5 py-0.5 text-sm font-medium text-brand-secondary"
        >
          {phone}
          {!readOnly && !disabled && (
            <button
              type="button"
              onClick={() => removePhone(idx)}
              className="rounded-full hover:bg-brand-primary/20 p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      {!readOnly && !disabled && (
        <input
          type="text"
          inputMode="numeric"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onBlur={() => { if (input.trim()) { addPhone(input); setInput(""); } }}
          placeholder={value.length === 0 ? "3001234567 — Enter o coma para agregar" : ""}
          className="flex-1 min-w-[200px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      )}
    </div>
  );
}

/** Timestamp-like -> Date */
const toDateSafe = (v: any): Date | undefined => {
  if (!v) return undefined;
  if (v instanceof Date) return v;
  if (typeof v?.toDate === "function") return v.toDate(); // Firestore Timestamp
  if (typeof v?.seconds === "number") return new Date(v.seconds * 1000);
  return undefined;
};

function applyHonorariosDefaultByTip(tip: TipificacionDeuda, prev?: number | string) {
  const esDemanda =
    tip === TipificacionDeuda.DEMANDA ||
    tip === TipificacionDeuda.DEMANDA_ACUERDO ||
    tip === TipificacionDeuda.DEMANDA_TERMINADO ||
    tip === TipificacionDeuda.DEMANDA_INSOLVENCIA;

  const esGestionando = tip === TipificacionDeuda.GESTIONANDO;

  if (esDemanda) return 20;
  if (esGestionando) return 15;

  const current = prev === "" || prev === undefined || prev === null ? undefined : Number(prev);
  return Number.isFinite(current as any) ? Number(current) : 15;
}

/* =========================
   Popup: Editor Historial
========================= */

function HistorialTipificacionesDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  readOnly: boolean;
  saving: boolean;
  clienteId: string;
  deudorId: string;
  onSaved: (historialOrdenado: Array<{ fecha: Date; tipificacion: TipificacionDeuda }>) => void;
}) {
  const { open, onOpenChange, readOnly, saving, clienteId, deudorId, onSaved } = props;

  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id?: string; fecha: Date; tipificacion: TipificacionDeuda }>>([]);
  const [busy, setBusy] = useState(false);

  const cargar = async () => {
    setLoading(true);
    try {
      const raw = await obtenerHistorialTipificaciones(clienteId, deudorId);
      const mapped = raw
        .map((x) => ({
          id: x.id,
          fecha: toDateSafe(x.fecha) ?? new Date(),
          tipificacion: (x.tipificacion ?? TipificacionDeuda.GESTIONANDO) as TipificacionDeuda,
        }))
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
      setItems(mapped);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error cargando historial");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open && clienteId && deudorId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clienteId, deudorId]);

  const addRow = () => {
    setItems((prev) => [
      ...prev,
      {
        fecha: new Date(),
        tipificacion: TipificacionDeuda.GESTIONANDO,
      },
    ]);
  };

  const updateRow = (idx: number, patch: Partial<{ fecha: Date; tipificacion: TipificacionDeuda }>) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );
  };

  const removeRow = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const guardar = async () => {
    if (readOnly) return;

    // Validación mínima
    if (items.length === 0) {
      toast.error("Debes tener al menos 1 registro de tipificación.");
      return;
    }
    for (const it of items) {
      if (!it.fecha || isNaN(it.fecha.getTime())) {
        toast.error("Hay un registro con fecha inválida.");
        return;
      }
      if (!it.tipificacion) {
        toast.error("Hay un registro sin tipificación.");
        return;
      }
    }

    // Ordenar por fecha asc
    const ordenado = [...items].sort((a, b) => a.fecha.getTime() - b.fecha.getTime());

    setBusy(true);
    try {
      // Reemplazar el historial completo
      await reemplazarHistorialTipificaciones(
        clienteId,
        deudorId,
        ordenado.map((x) => ({
          fecha: Timestamp.fromDate(x.fecha),
          tipificacion: x.tipificacion
        }))

      );

      toast.success("Historial de tipificaciones guardado.");
      onSaved(ordenado);
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Error guardando historial");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && !busy && onOpenChange(v)}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold">
            Historial de tipificaciones
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-10 text-center">
            <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-3" />
            <Typography variant="body">Cargando historial...</Typography>
          </div>
        ) : (
          <div className="space-y-4">


            <div className="overflow-x-auto rounded-lg border border-brand-secondary/10">
              <Table>
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold w-56">Fecha inicio</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipificación</TableHead>
                    <TableHead className="text-brand-secondary font-semibold text-center w-24">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it, idx) => (
                    <TableRow key={it.id ?? idx} className="border-brand-secondary/5">
                      <TableCell className="align-top">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal border-brand-secondary/30",
                                !it.fecha && "text-muted-foreground"
                              )}
                              disabled={readOnly || busy || saving}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {it.fecha ? format(it.fecha, "PPP", { locale: es }) : "Selecciona fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={it.fecha}
                              defaultMonth={it.fecha ?? new Date()}
                              onSelect={(date) => updateRow(idx, { fecha: date ?? new Date() })}
                              initialFocus
                              captionLayout="dropdown"
                              fromYear={new Date().getFullYear() - 20}
                              toYear={new Date().getFullYear() + 20}
                            />
                          </PopoverContent>
                        </Popover>
                      </TableCell>

                      <TableCell className="align-top">
                        <Select
                          disabled={readOnly || busy || saving}
                          value={it.tipificacion}
                          onValueChange={(v) => updateRow(idx, { tipificacion: v as TipificacionDeuda })}
                        >
                          <SelectTrigger className="border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20">
                            <SelectValue placeholder="Selecciona una tipificación" />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.values(TipificacionDeuda).map((t) => (
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>


                      </TableCell>

                      <TableCell className="text-center align-top">
                        {!readOnly && (
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="hover:bg-red-50"
                            onClick={() => removeRow(idx)}
                            disabled={busy || saving}
                            title="Eliminar fila"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {items.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                        No hay historial. Agrega el primer registro.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {!readOnly && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addRow}
                  disabled={busy || saving}
                  className="border-brand-secondary/30"
                >
                  + Agregar registro
                </Button>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={busy || saving}
                    className="border-brand-secondary/30"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="button"
                    variant="brand"
                    onClick={guardar}
                    disabled={busy || saving}
                  >
                    Guardar historial
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {readOnly && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   Importación desde Excel
========================= */

interface ImportRow {
  inmueble: string;
  deudorNombre?: string;
  status: "updated" | "created" | "not_found" | "no_data" | "no_nombre" | "error";
  phonesAdded: string[];
  emailsAdded: string[];
  message?: string;
}

interface ImportReport {
  totalRows: number;
  updated: number;
  created: number;
  notFound: number;
  errors: number;
  missingColumns: string[];
  rows: ImportRow[];
  mode: "actualizar" | "crear";
}

interface ImportPreview {
  file: File;
  totalRows: number;
  hasInmueble: boolean;
  hasNombre: boolean;
  hasCedula: boolean;
  hasContacto: boolean;
  hasCorreo: boolean;
  hasDeuda: boolean;
  canImport: boolean;
  mode: "actualizar" | "crear";
}

interface ImportOpts {
  modo: "crear_y_actualizar" | "solo_actualizar";
  mesDeuda?: string;
}

const STATUS_LABEL: Record<ImportRow["status"], string> = {
  updated: "Actualizado",
  created: "Creado",
  not_found: "No encontrado",
  no_data: "Sin datos",
  no_nombre: "Sin nombre",
  error: "Error",
};

const STATUS_ICON: Record<ImportRow["status"], React.ReactNode> = {
  updated: <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />,
  created: <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />,
  not_found: <AlertTriangle className="w-3.5 h-3.5 text-yellow-600" />,
  no_data: <MinusCircle className="w-3.5 h-3.5 text-gray-400" />,
  no_nombre: <AlertCircle className="w-3.5 h-3.5 text-orange-500" />,
  error: <AlertCircle className="w-3.5 h-3.5 text-red-600" />,
};

const STATUS_CLASS: Record<ImportRow["status"], string> = {
  updated: "bg-green-50 text-green-700 border-green-200",
  created: "bg-blue-50 text-blue-700 border-blue-200",
  not_found: "bg-yellow-50 text-yellow-700 border-yellow-200",
  no_data: "bg-gray-50 text-gray-500 border-gray-200",
  no_nombre: "bg-orange-50 text-orange-700 border-orange-200",
  error: "bg-red-50 text-red-700 border-red-200",
};

function ColStatus({ ok, label, required = true }: { ok: boolean; label: string; required?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border ${ok ? "bg-green-50 border-green-200 text-green-700" : required ? "bg-red-50 border-red-200 text-red-600" : "bg-gray-50 border-gray-200 text-gray-500"}`}>
      {ok
        ? <CheckCircle2 className="w-4 h-4 shrink-0" />
        : required ? <AlertCircle className="w-4 h-4 shrink-0" /> : <MinusCircle className="w-4 h-4 shrink-0" />}
      <span className="font-medium">{label}</span>
      <span className="ml-auto text-xs">{ok ? "Encontrada" : required ? "No encontrada" : "No se importará"}</span>
    </div>
  );
}

function ImportPreviewDialog({
  preview,
  open,
  onCancel,
  onImport,
  importing,
}: {
  preview: ImportPreview;
  open: boolean;
  onCancel: () => void;
  onImport: (opts: ImportOpts) => void;
  importing: boolean;
}) {
  const esCrear = preview.mode === "crear";

  const [modo, setModo] = React.useState<"crear_y_actualizar" | "solo_actualizar">("crear_y_actualizar");
  const [mesDeuda, setMesDeuda] = React.useState<string>(() => new Date().toISOString().slice(0, 7));

  const missingRequired = esCrear && modo === "crear_y_actualizar"
    ? [!preview.hasInmueble && "INMUEBLE", !preview.hasNombre && "NOMBRE"].filter(Boolean) as string[]
    : (!preview.hasInmueble ? ["INMUEBLE"] : []);

  const canImport = preview.hasInmueble && (modo === "solo_actualizar" || preview.hasNombre);
  const mostrarMes = esCrear && preview.hasDeuda;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !importing) onCancel(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold">
            Vista previa del archivo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Selector de modo — solo en flujo "crear" */}
          {esCrear && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
              <p className="text-sm font-medium text-gray-700">¿Qué hacer con los registros del archivo?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modoImport"
                  value="crear_y_actualizar"
                  checked={modo === "crear_y_actualizar"}
                  onChange={() => setModo("crear_y_actualizar")}
                  className="accent-brand-primary"
                />
                <span className="text-sm text-gray-700">
                  <strong>Crear y actualizar</strong> — crea los nuevos y actualiza los existentes
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="modoImport"
                  value="solo_actualizar"
                  checked={modo === "solo_actualizar"}
                  onChange={() => setModo("solo_actualizar")}
                  className="accent-brand-primary"
                />
                <span className="text-sm text-gray-700">
                  <strong>Solo actualizar</strong> — solo actualiza los que ya existen, ignora los nuevos
                </span>
              </label>
            </div>
          )}

          <p className="text-sm text-gray-500">Columnas detectadas en el archivo:</p>
          <ColStatus ok={preview.hasInmueble} label="INMUEBLE" required />
          {esCrear && modo === "crear_y_actualizar" && <ColStatus ok={preview.hasNombre} label="NOMBRE" required />}
          {esCrear && <ColStatus ok={preview.hasCedula} label="CÉDULA" required={false} />}
          <ColStatus ok={preview.hasContacto} label={esCrear ? "CONTACTO / TELÉFONO" : "CONTACTO"} required={false} />
          <ColStatus ok={preview.hasCorreo} label="CORREO ELECTRÓNICO" required={false} />
          {esCrear && <ColStatus ok={preview.hasDeuda} label="DEUDA" required={false} />}

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-gray-600">Registros en el archivo</span>
            <span className="text-xl font-bold text-brand-primary">{preview.totalRows}</span>
          </div>

          {/* Selector de mes — si viene columna DEUDA (deudores nuevos y existentes sin historial) */}
          {mostrarMes && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <p className="text-sm font-medium text-blue-800">
                Se detectó la columna <strong>DEUDA</strong>. Selecciona el mes para registrar la deuda en deudores nuevos y en deudores existentes sin estados mensuales:
              </p>
              <input
                type="month"
                value={mesDeuda}
                onChange={(e) => setMesDeuda(e.target.value)}
                className="w-full rounded-md border border-blue-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={importing}
              />
            </div>
          )}

          {canImport ? (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                El archivo está listo. Se procesarán <strong>{preview.totalRows}</strong> registros.
                {(!preview.hasContacto || !preview.hasCorreo) && (
                  <span className="block text-xs text-green-600 mt-1">
                    Las columnas faltantes no serán procesadas.
                  </span>
                )}
              </span>
            </div>
          ) : (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                {missingRequired.length === 1
                  ? <>Falta la columna obligatoria <strong>{missingRequired[0]}</strong>.</>
                  : <>Faltan las columnas obligatorias <strong>{missingRequired.join(" y ")}</strong>.</>}
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancel} disabled={importing}>
            Cancelar
          </Button>
          {canImport && (
            <Button
              variant="brand"
              onClick={() => onImport({ modo, mesDeuda: mostrarMes ? mesDeuda : undefined })}
              disabled={importing}
            >
              {importing ? "Procesando..." : esCrear ? "Procesar" : "Importar"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ImportReportDialog({ report, open, onClose }: { report: ImportReport; open: boolean; onClose: () => void }) {
  const esCrear = report.mode === "crear";

  const stats = esCrear
    ? [
        { label: "Creados", value: report.created, cls: "bg-blue-50 border-blue-200 text-blue-700" },
        { label: "Actualizados", value: report.updated, cls: "bg-green-50 border-green-200 text-green-700" },
        { label: "Errores", value: report.errors, cls: "bg-red-50 border-red-200 text-red-700" },
        { label: "Total filas", value: report.totalRows, cls: "bg-gray-50 border-gray-200 text-gray-700" },
      ]
    : [
        { label: "Actualizados", value: report.updated, cls: "bg-green-50 border-green-200 text-green-700" },
        { label: "No encontrados", value: report.notFound, cls: "bg-yellow-50 border-yellow-200 text-yellow-700" },
        { label: "Errores", value: report.errors, cls: "bg-red-50 border-red-200 text-red-700" },
        { label: "Total filas", value: report.totalRows, cls: "bg-gray-50 border-gray-200 text-gray-700" },
      ];

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto [&>button.absolute]:hidden">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold">
            {esCrear ? "Resultado de creación de deudores" : "Resultado de importación"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {stats.map(({ label, value, cls }) => (
            <div key={label} className={`rounded-lg border p-3 text-center ${cls}`}>
              <p className="text-2xl font-bold">{value}</p>
              <p className="text-xs mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {report.missingColumns.length > 0 && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
            <span className="font-semibold">Columnas no encontradas en el archivo: </span>
            {report.missingColumns.join(", ")} — esos datos no fueron procesados.
          </div>
        )}

        {report.rows.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-brand-secondary/10">
            <Table>
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="text-brand-secondary font-semibold">Inmueble</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Deudor</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Estado</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Datos</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, i) => (
                  <TableRow key={i} className="border-brand-secondary/5">
                    <TableCell className="text-sm font-medium">{row.inmueble}</TableCell>
                    <TableCell className="text-sm text-gray-600">{row.deudorNombre ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_CLASS[row.status]}`}>
                        {STATUS_ICON[row.status]}
                        {STATUS_LABEL[row.status]}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 space-y-0.5">
                      {(row.status === "updated" || row.status === "created") && (
                        <>
                          {row.phonesAdded.length > 0 && <p>Tel: {row.phonesAdded.join(", ")}</p>}
                          {row.emailsAdded.length > 0 && <p>Correo: {row.emailsAdded.join(", ")}</p>}
                        </>
                      )}
                      {row.status === "error" && <p className="text-red-600">{row.message}</p>}
                      {row.status === "no_nombre" && <p className="text-orange-600">Falta el nombre para crear el deudor</p>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   Página principal
========================= */

export default function DeudoresTable() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { clienteId } = useParams<{ clienteId: string }>();

  const { can, roles, loading: aclLoading } = useAcl();
  const { usuarioSistema } = useUsuarioActual();
  const esDeudor = roles.includes("deudor");
  const esEjecutivoAdmin = roles.includes("ejecutivoAdmin");
  const esSupervisor = roles.includes("supervisor");
  const canView = esDeudor ? true : can(PERMS.Deudores_Read);
  const canEdit = !esDeudor && can(PERMS.Deudores_Edit);
  const readOnly = !canEdit && canView;

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deudorAEliminar, setDeudorAEliminar] = useState<Deudor | null>(null);
  const [busyAction, setBusyAction] = useState<"save" | "delete" | null>(null);

  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDatesAnio, setStartDatesAnio] = useState<Map<string, Date | null>>(new Map());
  const [loadingAnio, setLoadingAnio] = useState(false);

  const [open, setOpen] = useState(false);
  const [deudorEditando, setDeudorEditando] = useState<Deudor | null>(null);
  const [formData, setFormData] = useState<Partial<Deudor> & { porcentajeHonorarios?: number | string }>({});

  // ✅ BLOQUEO GLOBAL
  const [saving, setSaving] = useState(false);

  // cliente / usuarios
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [nombreCliente, setNombreCliente] = useState<string>("Cargando...");

  const savedFilter = new URLSearchParams(
    sessionStorage.getItem(`deudores_filter_${clienteId}`) ?? ""
  );
  const [search, setSearch] = useState(
    searchParams.get("q") ?? savedFilter.get("q") ?? ""
  );
  const [tipFilters, setTipFilters] = useState<string[]>(() =>
    parseTipFilters(searchParams, savedFilter)
  );
  const [currentPage, setCurrentPage] = useState(
    Number(searchParams.get("page") ?? savedFilter.get("page") ?? 1)
  );

  const itemsPerPage = 300;

  // ✅ Popup historial tipificaciones
  const [histOpen, setHistOpen] = useState(false);
  const [deudorHistId, setDeudorHistId] = useState<string | null>(null);

  // ── Importación desde Excel ────────────────────────────────────────────
  const [importando, setImportando] = useState(false);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const crearInputRef = useRef<HTMLInputElement>(null);

  const validarExcel = async (file: File, mode: "actualizar" | "crear") => {
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (rows.length === 0) { toast.error("El archivo no tiene datos"); return; }

      const nh = Object.keys(rows[0]).map((h) => ({ original: h, n: normalizarEncabezado(h) }));
      const hasInmueble = !!nh.find((h) => h.n.includes("inmueble"));
      const hasNombre   = !!nh.find((h) => h.n.includes("nombre"));
      const hasCedula   = !!nh.find((h) => h.n.includes("cedula"));
      const hasContacto = !!nh.find((h) => h.n.includes("contacto") || h.n.includes("telefono"));
      const hasCorreo   = !!nh.find((h) => h.n.includes("correo"));
      const hasDeuda    = !!nh.find((h) => h.n.includes("deuda"));

      setImportPreview({
        file,
        totalRows: rows.length,
        hasInmueble,
        hasNombre,
        hasCedula,
        hasContacto,
        hasCorreo,
        hasDeuda,
        canImport: mode === "actualizar" ? hasInmueble : (hasInmueble && hasNombre),
        mode,
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Error al leer el archivo Excel");
    } finally {
      if (crearInputRef.current) crearInputRef.current.value = "";
    }
  };

  const ejecutarImportacion = async (opts: ImportOpts) => {
    if (!clienteId || !importPreview) return;
    setImportando(true);
    try {
      const buffer = await importPreview.file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "" });

      const nh = Object.keys(rows[0]).map((h) => ({ original: h, n: normalizarEncabezado(h) }));
      const colInmueble = nh.find((h) => h.n.includes("inmueble"))?.original!;
      const colNombre   = nh.find((h) => h.n.includes("nombre"))?.original;
      const colCedula   = nh.find((h) => h.n.includes("cedula"))?.original;
      const colContacto = nh.find((h) => h.n.includes("contacto") || h.n.includes("telefono"))?.original;
      const colCorreo   = nh.find((h) => h.n.includes("correo"))?.original;
      const colDeuda    = nh.find((h) => h.n.includes("deuda"))?.original;

      const deudorMap = new Map<string, Deudor>();
      for (const d of deudores) {
        const key = (d.ubicacion ?? "").trim().toLowerCase();
        if (key) deudorMap.set(key, d);
      }

      const reportRows: ImportRow[] = [];
      let updated = 0, created = 0, notFound = 0, errors = 0;
      const missingColumns: string[] = [];

      if (importPreview.mode === "actualizar") {
        if (!colContacto) missingColumns.push("CONTACTO / TELÉFONO");
        if (!colCorreo)   missingColumns.push("CORREO ELECTRÓNICO");

        for (const row of rows) {
          const inmuebleRaw = String(row[colInmueble] ?? "").trim();
          if (!inmuebleRaw) continue;

          const deudor = deudorMap.get(inmuebleRaw.toLowerCase());
          if (!deudor?.id) {
            reportRows.push({ inmueble: inmuebleRaw, status: "not_found", phonesAdded: [], emailsAdded: [] });
            notFound++;
            continue;
          }

          const telefonosNuevos = colContacto ? parsearTelefonosDeTexto(String(row[colContacto] ?? "")) : [];
          const correosNuevos   = colCorreo   ? parsearCorreosDeTexto(String(row[colCorreo]   ?? "")) : [];
          const cedulaRaw       = colCedula   ? String(row[colCedula] ?? "").trim() : "";

          if (telefonosNuevos.length === 0 && correosNuevos.length === 0 && !cedulaRaw) {
            reportRows.push({ inmueble: inmuebleRaw, deudorNombre: deudor.nombre, status: "no_data", phonesAdded: [], emailsAdded: [] });
            continue;
          }

          const patch: DeudorPatch = {};
          if (colContacto) {
            const existentesNorm = (deudor.telefonos ?? [])
              .flatMap(t => parsearTelefonosDeTexto(t))
              .filter(Boolean);
            patch.telefonos = [...new Set([...existentesNorm, ...telefonosNuevos])];
          }
          if (colCorreo) {
            const correosExistNorm = (deudor.correos ?? [])
              .flatMap(c => parsearCorreosDeTexto(c))
              .filter(Boolean);
            patch.correos = [...new Set([...correosExistNorm, ...correosNuevos])];
          }
          if (cedulaRaw) patch.cedula = cedulaRaw;

          try {
            await actualizarDeudorDatos(clienteId, deudor.id!, patch);
            reportRows.push({ inmueble: inmuebleRaw, deudorNombre: deudor.nombre, status: "updated", phonesAdded: telefonosNuevos, emailsAdded: correosNuevos });
            updated++;
          } catch (e: any) {
            reportRows.push({ inmueble: inmuebleRaw, deudorNombre: deudor.nombre, status: "error", phonesAdded: [], emailsAdded: [], message: e?.message });
            errors++;
          }
        }
      } else {
        if (!colContacto) missingColumns.push("CONTACTO / TELÉFONO");
        if (!colCorreo)   missingColumns.push("CORREO ELECTRÓNICO");

        const createdInBatch = new Set<string>();

        for (const row of rows) {
          const inmuebleRaw = String(row[colInmueble] ?? "").trim();
          if (!inmuebleRaw) continue;

          const keyLower = inmuebleRaw.toLowerCase();
          const deudorExistente = deudorMap.get(keyLower);

          if (deudorExistente) {
            // Ya existe: si el modo es "solo_actualizar" o "crear_y_actualizar", hacer merge
            const telefonosNuevos = colContacto ? parsearTelefonosDeTexto(String(row[colContacto] ?? "")) : [];
            const correosNuevos   = colCorreo   ? parsearCorreosDeTexto(String(row[colCorreo]   ?? "")) : [];
            const cedulaRaw       = colCedula   ? String(row[colCedula] ?? "").trim() : "";
            const nombreRaw       = colNombre   ? String(row[colNombre] ?? "").trim() : "";
            const deudaRawExist   = colDeuda    ? String(row[colDeuda]  ?? "").trim() : "";
            const deudaNumExist   = deudaRawExist ? Number(deudaRawExist.replace(/[^0-9]/g, "")) : NaN;
            const tieneDeudaValida = !!(colDeuda && opts.mesDeuda && !isNaN(deudaNumExist) && deudaNumExist > 0);

            if (telefonosNuevos.length === 0 && correosNuevos.length === 0 && !cedulaRaw && !nombreRaw && !tieneDeudaValida) {
              reportRows.push({ inmueble: inmuebleRaw, deudorNombre: deudorExistente.nombre, status: "no_data", phonesAdded: [], emailsAdded: [] });
              continue;
            }

            const patch: DeudorPatch = {};
            if (colContacto) {
              const existentesNorm = (deudorExistente.telefonos ?? [])
                .flatMap(t => parsearTelefonosDeTexto(t))
                .filter(Boolean);
              patch.telefonos = [...new Set([...existentesNorm, ...telefonosNuevos])];
            }
            if (colCorreo) {
              const correosExistNorm = (deudorExistente.correos ?? [])
                .flatMap(c => parsearCorreosDeTexto(c))
                .filter(Boolean);
              patch.correos = [...new Set([...correosExistNorm, ...correosNuevos])];
            }
            if (cedulaRaw) patch.cedula = cedulaRaw;
            if (nombreRaw) patch.nombre = nombreRaw;

            try {
              if (Object.keys(patch).length > 0) {
                await actualizarDeudorDatos(clienteId, deudorExistente.id!, patch);
              }

              if (tieneDeudaValida) {
                const estadosExistentes = await obtenerEstadosMensuales(clienteId, deudorExistente.id!);
                if (!estadosExistentes.some(e => e.mes === opts.mesDeuda)) {
                  const pct = deudorExistente.porcentajeHonorarios ?? 15;
                  await crearEstadoMensual(clienteId, deudorExistente.id!, {
                    clienteUID: clienteId,
                    mes: opts.mesDeuda,
                    deuda: deudaNumExist,
                    recaudo: 0,
                    porcentajeHonorarios: pct,
                    honorariosDeuda: Math.round(deudaNumExist * (pct / 100) * 100) / 100,
                    honorariosRecaudo: 0,
                  });
                }
              }

              reportRows.push({ inmueble: inmuebleRaw, deudorNombre: deudorExistente.nombre, status: "updated", phonesAdded: telefonosNuevos, emailsAdded: correosNuevos });
              updated++;
            } catch (e: any) {
              reportRows.push({ inmueble: inmuebleRaw, deudorNombre: deudorExistente.nombre, status: "error", phonesAdded: [], emailsAdded: [], message: e?.message });
              errors++;
            }
          } else if (opts.modo === "solo_actualizar") {
            // Solo actualizar: ignorar filas sin deudor existente
            reportRows.push({ inmueble: inmuebleRaw, status: "not_found", phonesAdded: [], emailsAdded: [] });
            notFound++;
          } else if (createdInBatch.has(keyLower)) {
            // Duplicado dentro del mismo archivo, ignorar
            reportRows.push({ inmueble: inmuebleRaw, status: "no_data", phonesAdded: [], emailsAdded: [], message: "Duplicado en el archivo" });
          } else {
            // No existe: crear nuevo deudor
            const nombreRaw = colNombre ? String(row[colNombre] ?? "").trim() : "";
            if (!nombreRaw) {
              reportRows.push({ inmueble: inmuebleRaw, status: "no_nombre", phonesAdded: [], emailsAdded: [] });
              continue;
            }

            const cedulaRaw = colCedula ? String(row[colCedula] ?? "").trim() : "";
            const telefonosNuevos = colContacto ? parsearTelefonosDeTexto(String(row[colContacto] ?? "")) : [];
            const correosNuevos   = colCorreo   ? parsearCorreosDeTexto(String(row[colCorreo]   ?? "")) : [];

            try {
              const nuevoDeudorId = await crearDeudor(clienteId, {
                nombre: nombreRaw,
                cedula: cedulaRaw || undefined,
                ubicacion: inmuebleRaw,
                correos: correosNuevos,
                telefonos: telefonosNuevos,
                tipificacion: TipificacionDeuda.GESTIONANDO,
                porcentajeHonorarios: 15,
              });
              createdInBatch.add(keyLower);

              // Si hay columna DEUDA y el usuario seleccionó un mes, crear estado mensual
              if (colDeuda && opts.mesDeuda && nuevoDeudorId) {
                const deudaRaw = String(row[colDeuda] ?? "").trim();
                const deudaNum = Number(deudaRaw.replace(/[^0-9]/g, ""));
                if (!isNaN(deudaNum) && deudaNum > 0) {
                  await crearEstadoMensual(clienteId, nuevoDeudorId, {
                    clienteUID: clienteId,
                    mes: opts.mesDeuda,
                    deuda: deudaNum,
                    recaudo: 0,
                    porcentajeHonorarios: 15,
                    honorariosDeuda: Math.round(deudaNum * 0.15 * 100) / 100,
                    honorariosRecaudo: 0,
                  });
                }
              }

              reportRows.push({ inmueble: inmuebleRaw, deudorNombre: nombreRaw, status: "created", phonesAdded: telefonosNuevos, emailsAdded: correosNuevos });
              created++;
            } catch (e: any) {
              reportRows.push({ inmueble: inmuebleRaw, deudorNombre: nombreRaw, status: "error", phonesAdded: [], emailsAdded: [], message: e?.message });
              errors++;
            }
          }
        }
      }

      setImportPreview(null);
      setImportReport({ totalRows: rows.length, updated, created, notFound, errors, missingColumns, rows: reportRows, mode: importPreview.mode });
      if (updated > 0 || created > 0) await fetchDeudores();

    } catch (e: any) {
      toast.error(e?.message ?? "Error al procesar el archivo Excel");
    } finally {
      setImportando(false);
    }
  };

  const fetchDeudores = async () => {
    if (!clienteId) return;
    setLoading(true);
    try {
      const data = await obtenerDeudorPorCliente(clienteId);
      setDeudores(data);
    } finally {
      setLoading(false);
    }
  };

  const fetchCliente = async () => {
    if (!clienteId) return;
    try {
      const clienteData = await getClienteById(clienteId);
      setCliente(clienteData);

      if (clienteData) {
        if ((clienteData as any).nombre) {
          setNombreCliente((clienteData as any).nombre);
        } else {
          const todosUsuarios = await obtenerUsuarios();
          setUsuarios(todosUsuarios);

          const usuarioEncontrado = todosUsuarios.find(u => u.uid === clienteId);
          if (usuarioEncontrado) {
            setNombreCliente(
              usuarioEncontrado.nombre ??
              (usuarioEncontrado as any).displayName ??
              usuarioEncontrado.email ??
              "Cliente"
            );
          } else {
            setNombreCliente("Cliente");
          }
        }
      } else {
        setNombreCliente("Cliente");
      }
    } catch (error) {
      console.error("Error al cargar cliente:", error);
      setNombreCliente("Cliente");
    }
  };

  useEffect(() => {
    const params: any = {};

    if (search) params.q = search;
    if (tipFilters.length === 1 && tipFilters[0] !== ALL) {
      params.tip = tipFilters[0];
    } else if (tipFilters.length > 1) {
      params.tips = tipFilters.join(",");
    }
    if (currentPage > 1) params.page = String(currentPage);

    setSearchParams(params, { replace: true });

    // Persiste el filtro para que las subpáginas puedan volver con él
    const qs = new URLSearchParams();
    if (search) qs.set("q", search);
    if (tipFilters.length === 1 && tipFilters[0] !== ALL) {
      qs.set("tip", tipFilters[0]);
    } else if (tipFilters.length > 1) {
      qs.set("tips", tipFilters.join(","));
    }
    if (currentPage > 1) qs.set("page", String(currentPage));
    sessionStorage.setItem(`deudores_filter_${clienteId}`, qs.toString());
  }, [search, tipFilters, currentPage, clienteId]);

  useEffect(() => {
    if (aclLoading) return;
    if (!canView) return;
    fetchDeudores();
    fetchCliente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId, aclLoading, canView]);

  useEffect(() => {
    if (!loading && deudores.length > 0) {
      const savedScroll = sessionStorage.getItem("deudoresScroll");

      if (savedScroll) {
        window.scrollTo({
          top: Number(savedScroll),
          behavior: "auto",
        });

        sessionStorage.removeItem("deudoresScroll");
      }
    }
  }, [loading, deudores]);

  // Carga las fechas de inicio de tipificaciones finales cuando se activa el filtro "Todos (año)"
  useEffect(() => {
    if (!tipFilters.includes(ALL_ANIO) || !clienteId || deudores.length === 0) return;

    const finales = deudores.filter((d) => isFinalTip(d.tipificacion as TipificacionDeuda));
    if (finales.length === 0) {
      setStartDatesAnio(new Map());
      return;
    }

    setLoadingAnio(true);
    Promise.all(
      finales.map(async (d) => {
        const { startDate } = await getTipificacionEnFechaCorte(
          clienteId,
          d.id!,
          new Date(),
          d.tipificacion as TipificacionDeuda
        );
        return [d.id!, startDate] as [string, Date | null];
      })
    )
      .then((entries) => setStartDatesAnio(new Map(entries)))
      .catch((e) => console.error("Error cargando fechas de tipificación:", e))
      .finally(() => setLoadingAnio(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tipFilters, clienteId, deudores]);

  const normalizedQ = search.trim().toLowerCase();
  const tipFilterSet = new Set(tipFilters);
  const isAllActiveFilter = tipFilters.length === 1 && tipFilters[0] === ALL;
  const isAllYearFilter = tipFilters.length === 1 && tipFilters[0] === ALL_ANIO;
  const tipFilterLabel = isAllActiveFilter
    ? "Todos (Activos)"
    : isAllYearFilter
      ? `Todos (${CURRENT_YEAR})`
      : tipFilters.length === 1
        ? tipFilters[0]
        : `${tipFilters.length} tipificaciones`;

  function toggleTipFilter(value: string) {
    setTipFilters((prev) => {
      if (value === ALL || value === ALL_ANIO) return [value];

      const withoutGroups = prev.filter((v) => v !== ALL && v !== ALL_ANIO);
      const next = withoutGroups.includes(value)
        ? withoutGroups.filter((v) => v !== value)
        : [...withoutGroups, value];

      return next.length > 0 ? next : [ALL];
    });
    setCurrentPage(1);
  }

  const EXCLUIR_EN_ACTIVOS = new Set<TipificacionDeuda>([
    TipificacionDeuda.INACTIVO,
    TipificacionDeuda.TERMINADO,
    TipificacionDeuda.DEMANDA_TERMINADO,
    TipificacionDeuda.DEVUELTO,
  ]);

  const filteredDeudores = deudores
    .filter((d) => {
      // Si el usuario logueado es deudor, solo mostrar su propio registro
      if (esDeudor) {
        return d.id === usuarioSistema?.deudorIdAsociado;
      }

      if (normalizedQ) {
        const hay = `${d.nombre ?? ""} ${d.cedula ?? ""} ${d.ubicacion ?? ""}`.toLowerCase();
        if (!hay.includes(normalizedQ)) return false;
      }

      const tip = d.tipificacion as TipificacionDeuda;
      if (isAllActiveFilter) {
        if (EXCLUIR_EN_ACTIVOS.has(tip)) return false;
      } else if (isAllYearFilter) {
        if (tip === TipificacionDeuda.INACTIVO) return false;
        if (isFinalTip(tip)) {
          const startDate = startDatesAnio.get(d.id!);
          // Si aún no cargó la fecha (undefined), excluir hasta que esté disponible
          if (startDate === undefined) return false;
          if (!inicioDentroDelAnio(startDate, CURRENT_YEAR)) return false;
        }
      } else {
        if (!tipFilterSet.has(String(tip))) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const ua = (a.ubicacion ?? "").trim();
      const ub = (b.ubicacion ?? "").trim();

      if (!ua && ub) return 1;
      if (ua && !ub) return -1;
      if (!ua && !ub) return 0;

      return ua.localeCompare(ub, "es", { sensitivity: "base", numeric: true });
    });

  const totalPages = Math.ceil(filteredDeudores.length / itemsPerPage) || 1;
  const paginatedDeudores = filteredDeudores.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const iniciarCrear = () => {
    if (!canEdit) return;
    setDeudorEditando(null);
    setFormData({
      tipificacion: TipificacionDeuda.GESTIONANDO,
      porcentajeHonorarios: 15,
    });
    setOpen(true);
  };

  const iniciarEditar = (deudor: Deudor) => {
    if (!canEdit) return;
    setDeudorEditando(deudor);

    const porcentaje =
      deudor.porcentajeHonorarios !== undefined && deudor.porcentajeHonorarios !== null
        ? Number(deudor.porcentajeHonorarios)
        : 15;

    setFormData({
      ...deudor,
      porcentajeHonorarios: porcentaje,
    });

    setOpen(true);
  };

  const abrirHistorial = async () => {
    if (!clienteId) return;

    // ✅ si es crear (aún no existe deudor), primero obligamos a guardar el deudor
    if (!deudorEditando?.id) {
      toast.error("Primero crea el deudor para poder editar su historial de tipificaciones.");
      return;
    }

    setDeudorHistId(deudorEditando.id);
    setHistOpen(true);
  };

  const eliminarDeudor = async () => {
    if (!clienteId || !deudorAEliminar?.id) return;
    if (!canEdit) return;

    setBusyAction("delete");
    setSaving(true);

    try {
      await borrarDeudorCompleto(clienteId, deudorAEliminar.id);
      toast.success("✓ Deudor eliminado junto con toda su información asociada.");
      setConfirmDeleteOpen(false);
      setDeudorAEliminar(null);
      await fetchDeudores();
    } catch (e: any) {
      console.error("Eliminar deudor error:", e);
      const code = e?.code;
      const msg = e?.message;
      toast.error(code ? `${code}: ${msg}` : (msg ?? "Error interno"));
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  };

  const guardarDeudor = async () => {
    if (!clienteId) return;
    if (!canEdit) return;

    const valorActual = formData.porcentajeHonorarios as number | string | undefined;
    const porcentajeFinal =
      valorActual === undefined || valorActual === null || valorActual === ""
        ? 15
        : Number(valorActual);

    setBusyAction("save");
    setSaving(true);

    try {
      // ✅ tipificacion se guarda como la que esté actualmente en formData
      // (y el historial dialog se encarga de actualizarla al guardar historial)
      const t = (v?: string) => v?.trim() ?? "";

      if (deudorEditando) {
        await actualizarDeudorDatos(clienteId, deudorEditando.id!, {
          nombre: t(formData.nombre),
          cedula: t(formData.cedula),
          ubicacion: t(formData.ubicacion),
          correos: formData.correos ?? [],
          telefonos: formData.telefonos ?? [],
          tipificacion: formData.tipificacion as TipificacionDeuda,
          porcentajeHonorarios: porcentajeFinal,
        });
        toast.success("Deudor actualizado correctamente");
      } else {
        await crearDeudor(clienteId, {
          nombre: t(formData.nombre),
          cedula: t(formData.cedula),
          ubicacion: t(formData.ubicacion),
          porcentajeHonorarios: porcentajeFinal,
          correos: formData.correos ?? [],
          telefonos: formData.telefonos ?? [],
          tipificacion: (formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO,
        });
        toast.success("Deudor creado correctamente");
      }

      setOpen(false);
      await fetchDeudores();
    } catch (error: any) {
      console.error(error);
      toast.error(error?.message ?? "Error al guardar el deudor");
    } finally {
      setSaving(false);
      setBusyAction(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === "porcentajeHonorarios") {
      setFormData((prev) => ({
        ...prev,
        porcentajeHonorarios: value === "" ? undefined : Number(value),
      }));
      return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // ✅ Overlay global (portal)
  const GlobalBlockingOverlay = saving
    ? createPortal(
      <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
        <div className="rounded-xl bg-white shadow-xl px-6 py-5 flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          <Typography variant="body" className="font-medium">
            {busyAction === "delete"
              ? "Eliminando deudor y toda su información..."
              : deudorEditando
                ? "Guardando cambios..."
                : "Creando deudor..."}
          </Typography>
        </div>
      </div>,
      document.body
    )
    : null;

  if (aclLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body">Cargando permisos...</Typography>
        </div>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <Typography variant="h2" className="text-brand-secondary mb-2">
            Acceso denegado
          </Typography>
          <Typography variant="body">No tienes permisos para ver esta sección.</Typography>
        </div>
      </div>
    );
  }

  const [exportando, setExportando] = useState(false);

  async function exportarExcel() {
    if (!clienteId || exportando) return;
    setExportando(true);
    try {
      const fmt = (n: number | null | undefined) =>
        n != null ? `$${Math.round(n).toLocaleString("es-CO")}` : "";

      const deudoresConFinanzas = await Promise.all(
        filteredDeudores.map(async (d) => {
          const estados = await obtenerEstadosMensuales(clienteId, d.id!);
          const ultimo = estados[0] ?? null;
          const deuda = ultimo?.deuda ?? null;
          const honorarios = ultimo?.honorariosDeuda ?? null;
          const total = deuda != null ? deuda + (honorarios ?? 0) : null;
          return {
            Nombre: d.nombre ?? "",
            Cédula: d.cedula ?? "",
            Teléfonos: (d.telefonos ?? []).join(", "),
            "Ubicación / Apto": d.ubicacion ?? "",
            Dirección: (d as any).direccion ?? "",
            Tipificación: d.tipificacion ?? "",
            "Deuda (último mes)": fmt(deuda),
            "Honorarios (último mes)": fmt(honorarios),
            "Total con honorarios": fmt(total),
          };
        })
      );

      const ws = XLSX.utils.json_to_sheet(deudoresConFinanzas);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Deudores");
      XLSX.writeFile(wb, `Deudores_${nombreCliente || clienteId}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Error al exportar el archivo");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      {GlobalBlockingOverlay}

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        {/* HEADER */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <BackButton
              variant="ghost"
              size="sm"
              to={esDeudor
                ? `/clientes/${clienteId}/deudores/${usuarioSistema?.deudorIdAsociado}`
                : `/clientes/${clienteId}`
              }
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-primary/10">
                  <Users className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <Typography variant="h2" className="!text-brand-primary font-bold">
                    Deudores de {nombreCliente}
                  </Typography>
                  <Typography variant="small" className="mt-0.5">
                    {filteredDeudores.length}{" "}
                    {filteredDeudores.length === 1 ? "deudor encontrado" : "deudores encontrados"}
                  </Typography>
                </div>
              </div>
            </div>

            {canEdit && (esEjecutivoAdmin || esSupervisor) && (
              <div className="flex flex-wrap gap-2">
                <input
                  ref={crearInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) validarExcel(file, "crear");
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => crearInputRef.current?.click()}
                  className="gap-2 border-brand-secondary/30 shadow-sm"
                  disabled={saving || importando}
                >
                  <Upload className="h-4 w-4" />
                  Crear deudores
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              onClick={exportarExcel}
              className="gap-2 border-brand-secondary/30 shadow-sm"
              disabled={filteredDeudores.length === 0 || exportando}
            >
              <Download className={`h-4 w-4 ${exportando ? "animate-pulse" : ""}`} />
              {exportando ? "Exportando..." : "Exportar Excel"}
            </Button>

            {canEdit && (
              <>
                <Button
                  variant="brand"
                  onClick={iniciarCrear}
                  className="gap-2 shadow-md hover:shadow-lg transition-all"
                  disabled={saving}
                >
                  <UserPlus className="h-4 w-4" />
                  Crear Deudor
                </Button>

                <Dialog open={open} onOpenChange={(v) => !saving && setOpen(v)}>
                <DialogContent
                  className="max-w-2xl max-h-[90vh] overflow-y-auto"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <DialogHeader>
                    <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                      {deudorEditando ? (
                        <Pencil className="h-5 w-5" />
                      ) : (
                        <Users className="h-5 w-5" />
                      )}
                      {deudorEditando ? (readOnly ? "Ver deudor" : "Editar deudor") : "Crear nuevo deudor"}
                    </DialogTitle>
                  </DialogHeader>

                  <form
                    className="space-y-6 py-4"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!readOnly) await guardarDeudor();
                    }}
                  >
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-brand-secondary font-medium">Nombre completo</Label>
                          <Input
                            name="nombre"
                            value={formData.nombre ?? ""}
                            onChange={handleChange}
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                            placeholder="Ej: Juan Pérez"
                          />
                        </div>
                        <div>
                          <Label className="text-brand-secondary font-medium">Cédula</Label>
                          <Input
                            name="cedula"
                            value={formData.cedula ?? ""}
                            onChange={handleChange}
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                            placeholder="1234567890"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label className="text-brand-secondary font-medium">Inmueble</Label>
                          <Input
                            name="ubicacion"
                            value={formData.ubicacion ?? ""}
                            onChange={handleChange}
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                            placeholder="Ej: Apto 101"
                          />
                        </div>

                        {/* ✅ TIPIFICACIÓN (solo lectura) + botón editar historial */}
                        <div>
                          <Label className="text-brand-secondary font-medium">Tipificación</Label>

                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 rounded-md border border-brand-secondary/30 bg-white px-3 py-2">
                              <div className="flex items-center gap-2">

                                <span className="text-sm text-brand-secondary font-medium">
                                  {(formData.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO}
                                </span>
                              </div>

                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              className="border-brand-secondary/30"
                              onClick={abrirHistorial}
                              disabled={readOnly || saving || !deudorEditando?.id}
                              title={!deudorEditando?.id ? "Primero guarda el deudor" : "Editar historial de tipificaciones"}
                            >
                              Editar
                            </Button>
                          </div>

                          {!deudorEditando?.id && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Para editar el historial, primero debes crear el deudor.
                            </p>
                          )}
                        </div>
                      </div>

                      <div>
                        <Label className="text-brand-secondary font-medium">Porcentaje de honorarios (%)</Label>
                        <Input
                          type="number"
                          name="porcentajeHonorarios"
                          value={formData.porcentajeHonorarios ?? ""}
                          readOnly={readOnly || saving}
                          onChange={handleChange}
                        />
                        <p className="text-xs text-muted-foreground mt-1">
                          Tipificaciones de DEMANDA suelen usar 20%.
                        </p>
                      </div>

                      <div className="space-y-3 pt-4 border-t border-brand-secondary/10">
                        <div>
                          <Label className="text-brand-secondary font-medium">Correos electrónicos</Label>
                          <Input
                            placeholder="correo1@example.com, correo2@example.com"
                            value={formData.correos?.join(", ") ?? ""}
                            onChange={(e) =>
                              setFormData((prev) => ({
                                ...prev,
                                correos: e.target.value.split(",").map((c) => c.trim()).filter(Boolean),
                              }))
                            }
                            readOnly={readOnly || saving}
                            className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                          />
                          <p className="text-xs mt-1">Separa múltiples correos con comas</p>
                        </div>

                        <div>
                          <Label className="text-brand-secondary font-medium">Teléfonos</Label>
                          <PhoneTagInput
                            value={formData.telefonos ?? []}
                            onChange={(phones) => setFormData((prev) => ({ ...prev, telefonos: phones }))}
                            readOnly={readOnly}
                            disabled={saving}
                          />
                          <p className="text-xs mt-1 text-muted-foreground">
                            Escribe un número y presiona <kbd className="px-1 rounded bg-gray-100 text-xs">Enter</kbd>, coma o Tab para agregarlo. El prefijo +57 se elimina automáticamente.
                          </p>
                        </div>
                      </div>
                    </div>

                    <DialogFooter className="gap-2">
                      {!readOnly && (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => !saving && setOpen(false)}
                            className="border-brand-secondary/30"
                            disabled={saving}
                          >
                            Cancelar
                          </Button>
                          <Button
                            type="submit"
                            variant="brand"
                            disabled={saving}
                          >
                            {deudorEditando ? "Guardar cambios" : "Crear deudor"}
                          </Button>
                        </>
                      )}
                    </DialogFooter>
                  </form>

                  {/* ✅ Popup historial */}
                  {clienteId && deudorEditando?.id && (
                    <HistorialTipificacionesDialog
                      open={histOpen}
                      onOpenChange={setHistOpen}
                      readOnly={readOnly}
                      saving={saving}
                      clienteId={clienteId}
                      deudorId={deudorEditando.id}
                      onSaved={async (historialOrdenado) => {
                        // 1) calcular tipificación activa (última)
                        const tipActiva = tipificacionActivaDesdeHistorial(
                          historialOrdenado.map((h) => ({
                            fecha: Timestamp.fromDate(h.fecha),
                            tipificacion: h.tipificacion
                          }))
                        );

                        // 2) reflejar en el form
                        setFormData((p) => ({
                          ...p,
                          tipificacion: tipActiva,
                          porcentajeHonorarios: applyHonorariosDefaultByTip(tipActiva, p.porcentajeHonorarios),
                        }));

                        // 3) persistir la tipificación activa en el documento deudor
                        try {
                          await actualizarDeudorDatos(clienteId, deudorEditando.id!, {
                            tipificacion: tipActiva,
                            porcentajeHonorarios: applyHonorariosDefaultByTip(tipActiva, formData.porcentajeHonorarios),
                          });
                          await fetchDeudores();
                        } catch (e: any) {
                          console.error(e);
                          toast.error(e?.message ?? "No se pudo actualizar la tipificación del deudor.");
                        }
                      }}
                    />
                  )}

                </DialogContent>
              </Dialog>
              </>
            )}
          </div>
        </header>

        {/* FILTROS */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-brand-primary/10">
                <Filter className="h-4 w-4 text-brand-primary" />
              </div>
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Filtros de búsqueda
              </Typography>
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label className="mb-2 block text-brand-secondary font-medium">Búsqueda</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/60" />
                  <Input
                    type="text"
                    placeholder="Buscar por nombre, cédula o inmueble..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-9 border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                  />
                  {search && (
                    <Button
                      type="button"
                      onClick={() => setSearch("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              <div>
                <Label className="mb-2 block text-brand-secondary font-medium">Tipificación</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-between border-brand-secondary/30 bg-white font-normal text-brand-secondary hover:bg-brand-primary/5"
                    >
                      <span className="truncate">{tipFilterLabel}</span>
                      <Filter className="ml-2 h-4 w-4 shrink-0 text-brand-secondary/60" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-2">
                    <div className="space-y-1">
                      <div
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-brand-primary/5"
                      >
                        <Checkbox
                          id="tip-filter-all"
                          checked={isAllActiveFilter}
                          onCheckedChange={() => toggleTipFilter(ALL)}
                        />
                        <label htmlFor="tip-filter-all" className="flex-1 cursor-pointer">
                          Todos (Activos)
                        </label>
                      </div>
                      <div
                        className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-brand-primary/5"
                      >
                        <Checkbox
                          id="tip-filter-all-year"
                          checked={isAllYearFilter}
                          onCheckedChange={() => toggleTipFilter(ALL_ANIO)}
                        />
                        <label htmlFor="tip-filter-all-year" className="flex-1 cursor-pointer">
                          Todos ({CURRENT_YEAR})
                        </label>
                      </div>

                      <div className="my-2 border-t border-brand-secondary/10" />

                      {Object.values(TipificacionDeuda).map((t) => (
                        <div
                          key={t}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-brand-primary/5"
                        >
                          <Checkbox
                            id={`tip-filter-${t}`}
                            checked={tipFilterSet.has(t)}
                            onCheckedChange={() => toggleTipFilter(t)}
                          />
                          <label htmlFor={`tip-filter-${t}`} className="flex-1 cursor-pointer">
                            {t}
                          </label>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className={cn(
                    "w-full border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary/5",
                    (!search && isAllActiveFilter) && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => {
                    setSearch("");
                    setTipFilters([ALL]);
                    setCurrentPage(1);
                  }}
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* TABLA */}
        {loading || (isAllYearFilter && loadingAnio) ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body">Cargando deudores...</Typography>
            </div>
          </div>
        ) : filteredDeudores.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-brand-primary/10">
                <Users className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                No hay resultados
              </Typography>
              <Typography variant="small" className="max-w-md">
                {search || !isAllActiveFilter
                  ? "No se encontraron deudores que coincidan con los filtros aplicados."
                  : "Aún no hay deudores registrados para este cliente."}
              </Typography>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Nombre</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Inmueble</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Tipificación</TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedDeudores.map((deudor, index) => (
                    <TableRow
                      key={deudor.id}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-brand-secondary">
                        {deudor.nombre}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {deudor.ubicacion || "—"}
                      </TableCell>
                      <TableCell>
                        <BadgeTipificacion
                          value={deudor.tipificacion}
                          suffix={
                            deudor.demandaSustituto === true &&
                            String(deudor.tipificacion).toLowerCase().includes("demanda")
                              ? "sust"
                              : undefined
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => {
                                    sessionStorage.setItem("deudoresScroll", String(window.scrollY));

                                    navigate(`/clientes/${clienteId}/deudores/${deudor.id}`);
                                  }}
                                  className="hover:bg-blue-50 transition-colors"
                                >
                                  <Eye className="h-4 w-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white">
                                Ver deudor
                              </TooltipContent>
                            </Tooltip>

                            {canEdit && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => iniciarEditar(deudor)}
                                      className="hover:bg-brand-primary/10 transition-colors"
                                      disabled={saving}
                                    >
                                      <Pencil className="h-4 w-4 text-brand-primary" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-brand-secondary text-white">
                                    Editar deudor
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudor.id}/AcuerdoPago`)}
                                      className="hover:bg-green-50 transition-colors"
                                      disabled={saving}
                                    >
                                      <FileText className="h-4 w-4 text-green-600" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-brand-secondary text-white">
                                    Acuerdo de pago
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      onClick={() => {
                                        setDeudorAEliminar(deudor);
                                        setConfirmDeleteOpen(true);
                                      }}
                                      className="hover:bg-red-50 transition-colors"
                                      disabled={saving}
                                    >
                                      <Trash2 className="h-4 w-4 text-red-600" />
                                    </Button>

                                  </TooltipTrigger>
                                  <TooltipContent className="bg-brand-secondary text-white">
                                    Eliminar
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <Dialog
                open={confirmDeleteOpen}
                onOpenChange={(v) => !saving && setConfirmDeleteOpen(v)}
              >
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="text-red-700 text-lg font-bold">
                      Confirmar eliminación definitiva
                    </DialogTitle>
                  </DialogHeader>

                  <div className="space-y-3 text-sm">
                    <p>
                      Vas a eliminar el deudor{" "}
                      <span className="font-semibold">
                        {deudorAEliminar?.nombre ?? "—"}
                      </span>.
                    </p>

                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-800">
                      <p className="font-semibold">Atención:</p>
                      <p>Esta acción eliminará definitivamente:</p>
                      <ul className="list-disc ml-5 mt-2 space-y-1">
                        <li>El deudor</li>
                        <li>Todo el seguimiento</li>
                        <li>Estados mensuales</li>
                        <li>Acuerdos de pago</li>
                        <li>Cualquier subcolección asociada</li>
                      </ul>
                      <p className="mt-2 font-semibold">
                        Esta acción no se puede deshacer.
                      </p>
                    </div>
                  </div>

                  <DialogFooter className="gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setConfirmDeleteOpen(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>

                    <Button
                      className="text-white bg-red-600 hover:bg-red-700"
                      onClick={eliminarDeudor}
                      disabled={saving || !deudorAEliminar?.id}
                    >
                      Sí, borrar definitivamente
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>

            </div>
          </div>
        )}
      </div>

      {importPreview && (
        <ImportPreviewDialog
          preview={importPreview}
          open={!!importPreview}
          onCancel={() => setImportPreview(null)}
          onImport={ejecutarImportacion}
          importing={importando}
        />
      )}

      {importReport && (
        <ImportReportDialog
          report={importReport}
          open={!!importReport}
          onClose={() => setImportReport(null)}
        />
      )}
    </div>
  );
}
