// src/modules/cobranza/components/seguimiento/SeguimientoMasivoPage.tsx
//
// Registra una misma gestión en varios deudores de un conjunto de una sola vez.
// Solo supervisor y admin (PERMS.Seguimientos_Masivo_Create).

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import {
  MessageSquarePlus,
  Search,
  X,
  CalendarIcon,
  AlertCircle,
  CheckCircle2,
  Paperclip,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

import { Deudor } from "../../models/deudores.model";
import { obtenerDeudorPorCliente } from "../../services/deudorService";
import {
  addSeguimientoMasivo,
  DestinoSeguimiento,
  ResultadoSeguimientoMasivo,
} from "../../services/seguimientoService";
import { getClienteById } from "@/modules/clientes/services/clienteService";

import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { TIPO_SEGUIMIENTO, TipoSeguimientoCode } from "@/shared/constants/tipoSeguimiento";
import { BadgeTipificacion } from "@/shared/components/BadgeTipificacion";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import { Checkbox } from "@/shared/ui/checkbox";
import { Separator } from "@/shared/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

import { auth } from "@/firebase";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { PERMS } from "@/shared/constants/acl";

const TIPIFICACIONES = Object.values(TipificacionDeuda);

// Tipificaciones sin gestión pendiente: quedan por fuera de la preselección
// inicial, pero el usuario puede marcarlas a mano.
const TIPIFICACIONES_CERRADAS = new Set<TipificacionDeuda>([
  TipificacionDeuda.TERMINADO,
  TipificacionDeuda.DEMANDA_TERMINADO,
  TipificacionDeuda.DEVUELTO,
  TipificacionDeuda.INACTIVO,
]);

function tipDe(d: Deudor): TipificacionDeuda {
  return (d.tipificacion as TipificacionDeuda) ?? TipificacionDeuda.GESTIONANDO;
}

export default function SeguimientoMasivoPage() {
  const { clienteId } = useParams<{ clienteId: string }>();
  const navigate = useNavigate();

  const { can, loading: aclLoading } = useAcl();
  const { usuarioSistema } = useUsuarioActual();
  const puedeUsar = can(PERMS.Seguimientos_Masivo_Create);

  const [deudores, setDeudores] = useState<Deudor[]>([]);
  const [nombreCliente, setNombreCliente] = useState("Cargando...");
  const [loading, setLoading] = useState(true);

  // ── Filtros de la lista ──────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [tipFilters, setTipFilters] = useState<TipificacionDeuda[]>([]);

  // ── Selección ────────────────────────────────────────────────────────
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set());

  // ── Datos del seguimiento ────────────────────────────────────────────
  const [fecha, setFecha] = useState<Date>(new Date());
  const [destino, setDestino] = useState<DestinoSeguimiento>("seguimiento");
  const [tipoSeguimiento, setTipoSeguimiento] = useState<TipoSeguimientoCode>("otro");
  const [descripcion, setDescripcion] = useState("");
  const [archivos, setArchivos] = useState<File[]>([]);

  // ── Ejecución ────────────────────────────────────────────────────────
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [progreso, setProgreso] = useState({ hechos: 0, total: 0 });
  const [resultado, setResultado] = useState<ResultadoSeguimientoMasivo | null>(null);

  useEffect(() => {
    if (!clienteId) return;
    let vivo = true;

    (async () => {
      setLoading(true);
      try {
        const [lista, cliente] = await Promise.all([
          obtenerDeudorPorCliente(clienteId),
          getClienteById(clienteId),
        ]);
        if (!vivo) return;
        setDeudores(lista);
        setNombreCliente(cliente?.nombre ?? "Cliente");
        // Preselección: todos menos los cerrados.
        setSeleccionados(
          new Set(lista.filter((d) => !TIPIFICACIONES_CERRADAS.has(tipDe(d))).map((d) => d.id!))
        );
      } catch (e: any) {
        toast.error(e?.message ?? "Error al cargar los deudores");
      } finally {
        if (vivo) setLoading(false);
      }
    })();

    return () => {
      vivo = false;
    };
  }, [clienteId]);

  const deudoresFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    return deudores.filter((d) => {
      if (tipFilters.length > 0 && !tipFilters.includes(tipDe(d))) return false;
      if (!q) return true;
      return (
        (d.nombre ?? "").toLowerCase().includes(q) ||
        (d.ubicacion ?? "").toLowerCase().includes(q) ||
        (d.cedula ?? "").toLowerCase().includes(q)
      );
    });
  }, [deudores, search, tipFilters]);

  // Cuántos de los que se ven ahora están marcados (para el "seleccionar todos").
  const visiblesSeleccionados = useMemo(
    () => deudoresFiltrados.filter((d) => seleccionados.has(d.id!)).length,
    [deudoresFiltrados, seleccionados]
  );
  const todosVisiblesMarcados =
    deudoresFiltrados.length > 0 && visiblesSeleccionados === deudoresFiltrados.length;

  function toggleDeudor(id: string) {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodosVisibles() {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (todosVisiblesMarcados) deudoresFiltrados.forEach((d) => next.delete(d.id!));
      else deudoresFiltrados.forEach((d) => next.add(d.id!));
      return next;
    });
  }

  function toggleTipFilter(t: TipificacionDeuda) {
    setTipFilters((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const descripcionValida = descripcion.trim().length > 0;
  const puedeGuardar = seleccionados.size > 0 && descripcionValida && !guardando;

  async function ejecutar() {
    if (!clienteId || !puedeGuardar) return;

    const uidUsuario = usuarioSistema?.uid ?? auth.currentUser?.uid ?? "";
    if (!uidUsuario) {
      toast.error("No se pudo identificar el usuario. Vuelve a iniciar sesión.");
      return;
    }

    const ids = deudores.filter((d) => seleccionados.has(d.id!)).map((d) => d.id!);

    setConfirmOpen(false);
    setGuardando(true);
    setProgreso({ hechos: 0, total: ids.length });

    try {
      const res = await addSeguimientoMasivo({
        clienteId,
        ejecutivoUID: uidUsuario,
        deudorIds: ids,
        destino,
        data: { fecha, tipoSeguimiento, descripcion: descripcion.trim() },
        archivos: archivos.length > 0 ? archivos : undefined,
        onProgress: (hechos, total) => setProgreso({ hechos, total }),
      });
      setResultado(res);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al registrar los seguimientos");
    } finally {
      setGuardando(false);
    }
  }

  // Tras un lote exitoso: limpiar el formulario para poder hacer otro.
  function cerrarResultado() {
    setResultado(null);
    setDescripcion("");
    setArchivos([]);
  }

  const nombrePorId = useMemo(() => {
    const m = new Map<string, string>();
    deudores.forEach((d) => m.set(d.id!, d.ubicacion || d.nombre || d.id!));
    return m;
  }, [deudores]);

  if (aclLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
      </div>
    );
  }

  if (!puedeUsar) {
    return (
      <div className="min-h-screen grid place-items-center p-6">
        <div className="max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center space-y-3">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
          <Typography variant="h3" className="!text-red-700">
            Sin acceso
          </Typography>
          <Typography variant="small" className="!text-red-600">
            El seguimiento masivo está disponible solo para supervisores.
          </Typography>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Volver
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      {guardando &&
        createPortal(
          <div className="fixed inset-0 z-[99999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
            <div className="w-80 rounded-xl bg-white shadow-xl px-6 py-5 space-y-3">
              <div className="flex items-center gap-3">
                <Loader2 className="h-5 w-5 animate-spin text-brand-primary" />
                <span className="text-sm font-medium">Registrando seguimientos…</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full bg-brand-primary transition-all"
                  style={{
                    width: `${progreso.total ? (progreso.hechos / progreso.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <p className="text-xs text-gray-500 text-center">
                {progreso.hechos} de {progreso.total} deudores
              </p>
            </div>
          </div>,
          document.body
        )}

      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* HEADER */}
        <header className="space-y-4">
          <BackButton variant="ghost" size="sm" to={`/clientes/${clienteId}`} />

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/10">
              <MessageSquarePlus className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <Typography variant="h2" className="!text-brand-primary font-bold">
                Seguimiento masivo — {nombreCliente}
              </Typography>
              <Typography variant="small" className="mt-0.5">
                Registra la misma gestión en varios deudores a la vez
              </Typography>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] items-start">
          {/* ── COLUMNA IZQUIERDA: selección de deudores ───────────────── */}
          <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 border-b border-brand-secondary/10 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Deudores
                </Typography>
                <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-sm font-semibold text-brand-primary">
                  {seleccionados.size} seleccionado{seleccionados.size === 1 ? "" : "s"}
                </span>
              </div>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por nombre, inmueble o cédula…"
                  className="pl-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-500">Filtrar por tipificación</p>
                <div className="flex flex-wrap gap-1.5">
                  {TIPIFICACIONES.map((t) => {
                    const activo = tipFilters.includes(t);
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => toggleTipFilter(t)}
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                          activo
                            ? "border-brand-primary bg-brand-primary text-white"
                            : "border-gray-200 bg-white text-gray-600 hover:border-brand-primary/40"
                        )}
                      >
                        {t}
                      </button>
                    );
                  })}
                  {tipFilters.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setTipFilters([])}
                      className="rounded-full border border-gray-200 px-2.5 py-0.5 text-xs text-gray-500 hover:text-gray-700"
                    >
                      Limpiar
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="p-10 grid place-items-center">
                  <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
                </div>
              ) : deudoresFiltrados.length === 0 ? (
                <div className="p-10 text-center text-sm text-gray-500">
                  Ningún deudor coincide con el filtro.
                </div>
              ) : (
                <Table>
                  <TableHeader className="sticky top-0 bg-white z-10">
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox
                          checked={todosVisiblesMarcados}
                          onCheckedChange={toggleTodosVisibles}
                          aria-label="Seleccionar todos los visibles"
                        />
                      </TableHead>
                      <TableHead>Inmueble</TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Tipificación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deudoresFiltrados.map((d) => {
                      const marcado = seleccionados.has(d.id!);
                      return (
                        <TableRow
                          key={d.id}
                          className={cn("cursor-pointer", marcado && "bg-brand-primary/5")}
                          onClick={() => toggleDeudor(d.id!)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={marcado}
                              onCheckedChange={() => toggleDeudor(d.id!)}
                              aria-label={`Seleccionar ${d.ubicacion}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium uppercase">{d.ubicacion}</TableCell>
                          <TableCell>{d.nombre}</TableCell>
                          <TableCell>
                            <BadgeTipificacion value={tipDe(d)} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>

            {!loading && deudoresFiltrados.length > 0 && (
              <div className="border-t border-gray-100 px-4 py-2 text-xs text-gray-500">
                Mostrando {deudoresFiltrados.length} de {deudores.length} deudores ·{" "}
                {visiblesSeleccionados} marcados en esta vista
              </div>
            )}
          </section>

          {/* ── COLUMNA DERECHA: la gestión a registrar ────────────────── */}
          <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden lg:sticky lg:top-6">
            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 border-b border-brand-secondary/10">
              <Typography variant="h3" className="!text-brand-secondary font-semibold">
                Gestión a registrar
              </Typography>
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm">Fecha</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start font-normal h-10"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fecha.toLocaleDateString("es-CO", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={fecha}
                      defaultMonth={fecha}
                      onSelect={(d) => d && setFecha(d)}
                      initialFocus
                      captionLayout="dropdown"
                      fromYear={new Date().getFullYear() - 10}
                      toYear={new Date().getFullYear() + 1}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Destino</Label>
                  <Select
                    value={destino}
                    onValueChange={(v: string) => setDestino(v as DestinoSeguimiento)}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="seguimiento">Prejurídico</SelectItem>
                      <SelectItem value="seguimientoJuridico">Jurídico</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm">Tipo</Label>
                  <Select
                    value={tipoSeguimiento}
                    onValueChange={(v: string) => setTipoSeguimiento(v as TipoSeguimientoCode)}
                  >
                    <SelectTrigger className="h-10 w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPO_SEGUIMIENTO.map((o) => (
                        <SelectItem key={o.code} value={o.code}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="text-xs text-gray-500">
                Todos los seguimientos se guardan en el destino elegido, sin importar la
                tipificación de cada deudor.
              </p>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="descripcion-masiva" className="text-sm">
                  Descripción
                </Label>
                <Textarea
                  id="descripcion-masiva"
                  className="min-h-[160px] leading-relaxed resize-y"
                  placeholder="Escribe la gestión realizada…"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  El mismo texto se registrará en cada deudor seleccionado.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="text-sm">Archivos (opcional)</Label>
                <Input
                  type="file"
                  multiple
                  onChange={(e) => setArchivos(Array.from(e.target.files ?? []))}
                />
                {archivos.length > 0 && (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-2 space-y-1">
                    {archivos.map((a) => (
                      <div key={a.name} className="flex items-center gap-2 text-xs text-gray-600">
                        <Paperclip className="h-3 w-3 shrink-0" />
                        <span className="truncate">{a.name}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-gray-500 pt-1">
                      Se suben una sola vez y se adjuntan a todos los seguimientos.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              <Button
                variant="brand"
                className="w-full gap-2"
                disabled={!puedeGuardar}
                onClick={() => setConfirmOpen(true)}
              >
                <MessageSquarePlus className="h-4 w-4" />
                Registrar en {seleccionados.size} deudor{seleccionados.size === 1 ? "" : "es"}
              </Button>

              {seleccionados.size === 0 && (
                <p className="text-xs text-red-600 text-center">
                  Selecciona al menos un deudor.
                </p>
              )}
              {seleccionados.size > 0 && !descripcionValida && (
                <p className="text-xs text-red-600 text-center">La descripción es obligatoria.</p>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* CONFIRMACIÓN */}
      <Dialog open={confirmOpen} onOpenChange={(v) => !guardando && setConfirmOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-brand-primary text-xl font-bold">
              Confirmar seguimiento masivo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-gray-600">
              Se creará un seguimiento en{" "}
              <strong className="text-brand-primary">{seleccionados.size}</strong> deudor
              {seleccionados.size === 1 ? "" : "es"} de <strong>{nombreCliente}</strong>.
            </p>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-1.5 text-xs">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Fecha</span>
                <span className="font-medium">{fecha.toLocaleDateString("es-CO")}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Destino</span>
                <span className="font-medium">
                  {destino === "seguimiento" ? "Prejurídico" : "Jurídico"}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Tipo</span>
                <span className="font-medium">
                  {TIPO_SEGUIMIENTO.find((o) => o.code === tipoSeguimiento)?.label}
                </span>
              </div>
              {archivos.length > 0 && (
                <div className="flex justify-between gap-3">
                  <span className="text-gray-500">Adjuntos</span>
                  <span className="font-medium">{archivos.length}</span>
                </div>
              )}
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Esta acción no se puede deshacer en bloque: para revertirla habría que
                borrar el seguimiento deudor por deudor.</span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={ejecutar} disabled={guardando}>
              Sí, registrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RESULTADO */}
      <Dialog open={!!resultado} onOpenChange={(v) => !v && cerrarResultado()}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-brand-primary text-xl font-bold">
              Resultado
            </DialogTitle>
          </DialogHeader>

          {resultado && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{resultado.exitosos}</div>
                  <div className="text-xs text-green-600">Registrados</div>
                </div>
                <div
                  className={cn(
                    "rounded-lg border p-3 text-center",
                    resultado.fallidos.length > 0
                      ? "border-red-200 bg-red-50"
                      : "border-gray-200 bg-gray-50"
                  )}
                >
                  <div
                    className={cn(
                      "text-2xl font-bold",
                      resultado.fallidos.length > 0 ? "text-red-700" : "text-gray-400"
                    )}
                  >
                    {resultado.fallidos.length}
                  </div>
                  <div
                    className={cn(
                      "text-xs",
                      resultado.fallidos.length > 0 ? "text-red-600" : "text-gray-400"
                    )}
                  >
                    Con error
                  </div>
                </div>
              </div>

              {resultado.fallidos.length === 0 ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>El seguimiento quedó registrado en todos los deudores seleccionados.</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-gray-500">
                    No se pudo registrar en:
                  </p>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 divide-y">
                    {resultado.fallidos.map((f) => (
                      <div key={f.deudorId} className="px-3 py-2 text-xs">
                        <div className="font-medium uppercase">
                          {nombrePorId.get(f.deudorId) ?? f.deudorId}
                        </div>
                        <div className="text-red-600">{f.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="brand" onClick={cerrarResultado}>
              Entendido
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
