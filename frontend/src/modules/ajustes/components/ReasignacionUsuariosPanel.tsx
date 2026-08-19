// modules/ajustes/components/ReasignacionUsuariosPanel.tsx
//
// Reasignación de cartera cuando alguien del equipo se va y llega un reemplazo.
// La unidad de migración es la FUNCIÓN, no el usuario: un rol ocupa varios
// campos y una persona puede tener varios roles, así que se elige exactamente
// qué bloques se mueven. Ver reasignacionService.ts.
import * as React from "react";
import { toast } from "sonner";
import { ArrowRight, RefreshCw, Users, AlertTriangle, Check } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { cn } from "@/shared/lib/cn";

import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import {
  FUNCIONES_ASIGNABLES,
  FUNCION_POR_KEY,
  ROLES_GESTION,
  cargarIndiceAsignaciones,
  candidatosDestino,
  ejecutarReasignacion,
  obtenerNotificacionesSinVer,
  rolesRequeridos,
  totalAsignaciones,
  type FuncionKey,
  type IndiceAsignaciones,
  type ResultadoReasignacion,
} from "@/modules/usuarios/services/reasignacionService";

const nombreDe = (u: UsuarioSistema) => u.nombre?.trim() || u.email;

export default function ReasignacionUsuariosPanel() {
  const [usuarios, setUsuarios] = React.useState<UsuarioSistema[]>([]);
  const [indice, setIndice] = React.useState<IndiceAsignaciones | null>(null);
  const [cargando, setCargando] = React.useState(true);

  const [origenUid, setOrigenUid] = React.useState("");
  const [destinoUid, setDestinoUid] = React.useState("");
  const [verInactivos, setVerInactivos] = React.useState(false);
  const [seleccionadas, setSeleccionadas] = React.useState<Set<FuncionKey>>(new Set());
  const [incluirTareas, setIncluirTareas] = React.useState(true);
  const [incluirNotificaciones, setIncluirNotificaciones] = React.useState(true);
  const [notificacionesSinVer, setNotificacionesSinVer] = React.useState<number | null>(null);

  const [confirmando, setConfirmando] = React.useState(false);
  const [ejecutando, setEjecutando] = React.useState(false);
  const [resultado, setResultado] = React.useState<ResultadoReasignacion | null>(null);

  /* ── Carga ────────────────────────────────────────────────────────────── */

  const cargar = React.useCallback(async () => {
    try {
      setCargando(true);
      const [us, idx] = await Promise.all([obtenerUsuarios(), cargarIndiceAsignaciones()]);
      setUsuarios(us);
      setIndice(idx);
    } catch {
      toast.error("⚠️ No se pudieron cargar las asignaciones");
    } finally {
      setCargando(false);
    }
  }, []);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  /* ── Derivados ────────────────────────────────────────────────────────── */

  const usuariosPorUid = React.useMemo(
    () => new Map(usuarios.map((u) => [u.uid, u])),
    [usuarios]
  );

  // Usuarios ya desactivados que quedaron con cartera: arrastre a limpiar. Se
  // ocultan por defecto porque el flujo sano es reasignar ANTES de desactivar.
  const inactivosConCartera = React.useMemo(() => {
    if (!indice) return [];
    return usuarios.filter((u) => u.activo === false && totalAsignaciones(indice, u.uid) > 0);
  }, [usuarios, indice]);

  // Candidatos a salir: usuarios activos que hacen gestión o que conservan
  // asignaciones aunque ya les hayan quitado el rol (ese es justo el caso a
  // limpiar), más los inactivos con cartera si se pidió verlos.
  const candidatosOrigen = React.useMemo(() => {
    if (!indice) return [];
    return usuarios
      .filter((u) => {
        if (u.activo === false) return verInactivos && totalAsignaciones(indice, u.uid) > 0;
        const tieneRol = (u.roles ?? []).some((r) => ROLES_GESTION.includes(r));
        return tieneRol || totalAsignaciones(indice, u.uid) > 0;
      })
      .sort((a, b) => nombreDe(a).localeCompare(nombreDe(b), "es"));
  }, [usuarios, indice, verInactivos]);

  const origen = origenUid ? usuariosPorUid.get(origenUid) ?? null : null;
  const destino = destinoUid ? usuariosPorUid.get(destinoUid) ?? null : null;

  // Funciones con al menos un documento asignado al saliente.
  const funcionesConCarga = React.useMemo(() => {
    if (!indice || !origenUid) return [];
    const porFuncion = indice.porUsuario.get(origenUid) ?? {};
    return FUNCIONES_ASIGNABLES.map((f) => ({
      funcion: f,
      cantidad: porFuncion[f.key]?.length ?? 0,
    })).filter((f) => f.cantidad > 0);
  }, [indice, origenUid]);

  const tareasPendientes = indice && origenUid
    ? indice.tareasPorUsuario.get(origenUid)?.length ?? 0
    : 0;

  const funcionesMarcadas = React.useMemo(
    () => funcionesConCarga.filter((f) => seleccionadas.has(f.funcion.key)).map((f) => f.funcion.key),
    [funcionesConCarga, seleccionadas]
  );

  const requeridos = React.useMemo(() => rolesRequeridos(funcionesMarcadas), [funcionesMarcadas]);

  const candidatosEntrada = React.useMemo(() => {
    if (!origenUid) return [];
    return candidatosDestino(usuarios, origenUid, funcionesMarcadas).sort((a, b) =>
      nombreDe(a).localeCompare(nombreDe(b), "es")
    );
  }, [usuarios, origenUid, funcionesMarcadas]);

  const moverTareas = incluirTareas && tareasPendientes > 0;
  const moverNotificaciones = incluirNotificaciones && (notificacionesSinVer ?? 0) > 0;
  const hayAlgoQueMover = funcionesMarcadas.length > 0 || moverTareas || moverNotificaciones;
  const listoParaEjecutar = !!origen && !!destino && hayAlgoQueMover && !ejecutando;

  /* ── Efectos de selección ─────────────────────────────────────────────── */

  // Al cambiar de saliente: marcar todo lo que tenga y contar sus alertas.
  React.useEffect(() => {
    setDestinoUid("");
    setResultado(null);
    setNotificacionesSinVer(null);
    if (!indice || !origenUid) {
      setSeleccionadas(new Set());
      return;
    }
    const porFuncion = indice.porUsuario.get(origenUid) ?? {};
    setSeleccionadas(
      new Set(
        FUNCIONES_ASIGNABLES.filter((f) => (porFuncion[f.key]?.length ?? 0) > 0).map((f) => f.key)
      )
    );

    let vigente = true;
    obtenerNotificacionesSinVer(origenUid)
      .then((n) => {
        if (vigente) setNotificacionesSinVer(n.length);
      })
      .catch(() => {
        if (vigente) setNotificacionesSinVer(0);
      });
    return () => {
      vigente = false;
    };
  }, [origenUid, indice]);

  // Si al cambiar las funciones el entrante deja de cumplir los roles, se limpia.
  React.useEffect(() => {
    if (destinoUid && !candidatosEntrada.some((u) => u.uid === destinoUid)) setDestinoUid("");
  }, [candidatosEntrada, destinoUid]);

  /* ── Acciones ─────────────────────────────────────────────────────────── */

  const toggleFuncion = (key: FuncionKey) =>
    setSeleccionadas((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const reasignar = async () => {
    if (!origen || !destino || !indice) return;
    try {
      setEjecutando(true);
      const res = await ejecutarReasignacion(
        {
          origen,
          destino,
          funciones: funcionesMarcadas,
          incluirTareas: moverTareas,
          incluirNotificaciones: moverNotificaciones,
        },
        indice
      );
      setConfirmando(false);
      setResultado(res);
      toast.success(`✓ ${res.total} asignaciones movidas a ${nombreDe(destino)}`);
      setOrigenUid("");
      await cargar();
    } catch (e: any) {
      toast.error(`⚠️ La reasignación falló: ${e?.message ?? "error desconocido"}`);
    } finally {
      setEjecutando(false);
    }
  };

  /* ── Render ───────────────────────────────────────────────────────────── */

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary">Reasignar usuarios</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pasa la cartera de una persona que sale a quien la reemplaza. Se mueven los conjuntos, los
            clientes particulares, las tareas vivas y las alertas sin atender. El historial de quién
            hizo cada gestión no se toca.
          </p>
        </div>
        <Button onClick={cargar} disabled={cargando || ejecutando} variant="outline" className="gap-2 flex-shrink-0">
          <RefreshCw className={cn("h-4 w-4", cargando && "animate-spin")} />
          Actualizar
        </Button>
      </div>

      {resultado && (
        <div className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <p className="font-medium flex items-center gap-2">
            <Check className="h-4 w-4" />
            Reasignación completada — {resultado.total} registros actualizados.
          </p>
          <ul className="mt-2 space-y-0.5 text-xs">
            {Object.entries(resultado.porFuncion).map(([key, cantidad]) => (
              <li key={key}>
                {FUNCION_POR_KEY.get(key as FuncionKey)?.label ?? key}: {cantidad}
              </li>
            ))}
            {resultado.tareas > 0 && <li>Tareas reasignadas: {resultado.tareas}</li>}
            {resultado.notificaciones > 0 && (
              <li>Alertas copiadas al nuevo responsable: {resultado.notificaciones}</li>
            )}
          </ul>
        </div>
      )}

      {/* Paso 1 — quién sale */}
      <section className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
            1
          </span>
          <h2 className="text-sm font-semibold">Usuario que sale</h2>
        </div>

        <Select value={origenUid} onValueChange={setOrigenUid} disabled={cargando || ejecutando}>
          <SelectTrigger className="max-w-md">
            <SelectValue placeholder={cargando ? "Cargando..." : "Selecciona a quién se le quita la cartera"} />
          </SelectTrigger>
          <SelectContent>
            {candidatosOrigen.map((u) => (
              <SelectItem key={u.uid} value={u.uid}>
                {nombreDe(u)} — {indice ? totalAsignaciones(indice, u.uid) : 0} asignaciones
                {u.activo === false ? " ⛔ inactivo" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Arrastre histórico: alguien a quien desactivaron sin reasignar antes. */}
        {inactivosConCartera.length > 0 && (
          <label className="flex items-start gap-2 pt-1 cursor-pointer">
            <Checkbox
              checked={verInactivos}
              onCheckedChange={(v) => setVerInactivos(v === true)}
              className="mt-0.5"
            />
            <span className="text-xs text-muted-foreground">
              Ver usuarios inactivos con cartera —{" "}
              <strong className="text-amber-700">
                {inactivosConCartera.length}{" "}
                {inactivosConCartera.length === 1 ? "usuario desactivado conserva" : "usuarios desactivados conservan"}{" "}
                asignaciones
              </strong>{" "}
              ({inactivosConCartera.map(nombreDe).join(", ")}). Lo normal es reasignar antes de
              desactivar; esto sirve para limpiar lo que quedó pendiente.
            </span>
          </label>
        )}

        {!cargando && candidatosOrigen.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay usuarios con cartera asignada.</p>
        )}
      </section>

      {/* Paso 2 — qué se mueve */}
      {origen && (
        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
              2
            </span>
            <h2 className="text-sm font-semibold">Qué se le pasa al reemplazo</h2>
          </div>

          {funcionesConCarga.length === 0 && tareasPendientes === 0 && !notificacionesSinVer ? (
            <p className="text-sm text-muted-foreground">
              {nombreDe(origen)} no tiene ninguna asignación viva. No hay nada que migrar.
            </p>
          ) : (
            <div className="space-y-2">
              {funcionesConCarga.map(({ funcion, cantidad }) => (
                <label
                  key={funcion.key}
                  className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={seleccionadas.has(funcion.key)}
                    onCheckedChange={() => toggleFuncion(funcion.key)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">{funcion.label}</span>
                      <span className="text-xs font-medium text-brand-primary whitespace-nowrap">
                        {cantidad} {funcion.coleccion === "clientes" ? "conjuntos" : "clientes"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{funcion.detalle}</p>
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      Requiere rol <code className="font-mono">{funcion.rol}</code> ·{" "}
                      <code className="font-mono">
                        {funcion.coleccion}.{funcion.campo}
                      </code>
                    </p>
                  </div>
                </label>
              ))}

              {tareasPendientes > 0 && (
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox
                    checked={incluirTareas}
                    onCheckedChange={(v) => setIncluirTareas(v === true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">Tareas pendientes y en curso</span>
                      <span className="text-xs font-medium text-brand-primary whitespace-nowrap">
                        {tareasPendientes} tareas
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Las finalizadas se dejan como historial del saliente.
                    </p>
                  </div>
                </label>
              )}

              {(notificacionesSinVer ?? 0) > 0 && (
                <label className="flex items-start gap-3 rounded-md border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
                  <Checkbox
                    checked={incluirNotificaciones}
                    onCheckedChange={(v) => setIncluirNotificaciones(v === true)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm font-medium">Alertas sin atender</span>
                      <span className="text-xs font-medium text-brand-primary whitespace-nowrap">
                        {notificacionesSinVer} alertas
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Se copian al buzón del reemplazo; el saliente conserva las suyas.
                    </p>
                  </div>
                </label>
              )}
            </div>
          )}
        </section>
      )}

      {/* Paso 3 — quién entra */}
      {origen && hayAlgoQueMover && (
        <section className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary">
              3
            </span>
            <h2 className="text-sm font-semibold">Usuario que entra</h2>
          </div>

          {requeridos.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Solo se listan usuarios activos con {requeridos.length === 1 ? "el rol" : "los roles"}{" "}
              {requeridos.map((r) => (
                <code key={r} className="font-mono mx-0.5">
                  {r}
                </code>
              ))}
              .
            </p>
          )}

          <Select value={destinoUid} onValueChange={setDestinoUid} disabled={ejecutando}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="Selecciona quién recibe la cartera" />
            </SelectTrigger>
            <SelectContent>
              {candidatosEntrada.map((u) => (
                <SelectItem key={u.uid} value={u.uid}>
                  {nombreDe(u)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {candidatosEntrada.length === 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                Ningún usuario activo tiene {requeridos.length === 1 ? "el rol" : "todos los roles"}{" "}
                <strong>{requeridos.join(", ")}</strong>. Asígnaselos en <strong>Usuarios</strong> o
                desmarca funciones para reasignarlas por separado.
              </p>
            </div>
          )}
        </section>
      )}

      {/* Paso 4 — confirmar */}
      {origen && destino && hayAlgoQueMover && (
        <section className="rounded-lg border border-brand-primary/30 bg-brand-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-3 text-sm">
            <Users className="h-4 w-4 text-brand-primary flex-shrink-0" />
            <span className="font-medium">{nombreDe(origen)}</span>
            <ArrowRight className="h-4 w-4 text-brand-primary flex-shrink-0" />
            <span className="font-medium">{nombreDe(destino)}</span>
          </div>
          <Button onClick={() => setConfirmando(true)} disabled={!listoParaEjecutar} variant="brand" className="gap-2">
            Reasignar
          </Button>
        </section>
      )}

      {/* Confirmación */}
      <Dialog open={confirmando} onOpenChange={(open) => !ejecutando && setConfirmando(open)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-brand-primary">Confirmar reasignación</DialogTitle>
          </DialogHeader>

          {origen && destino && (
            <div className="space-y-3 py-2 text-sm">
              <p>
                Se moverá de <strong>{nombreDe(origen)}</strong> a <strong>{nombreDe(destino)}</strong>:
              </p>
              <ul className="space-y-1 rounded-md border bg-muted/20 p-3 text-sm">
                {funcionesConCarga
                  .filter((f) => seleccionadas.has(f.funcion.key))
                  .map(({ funcion, cantidad }) => (
                    <li key={funcion.key} className="flex justify-between gap-3">
                      <span>{funcion.label}</span>
                      <span className="font-medium">{cantidad}</span>
                    </li>
                  ))}
                {moverTareas && (
                  <li className="flex justify-between gap-3">
                    <span>Tareas pendientes y en curso</span>
                    <span className="font-medium">{tareasPendientes}</span>
                  </li>
                )}
                {moverNotificaciones && (
                  <li className="flex justify-between gap-3">
                    <span>Alertas sin atender (copia)</span>
                    <span className="font-medium">{notificacionesSinVer}</span>
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground">
                La acción no se deshace automáticamente: para revertirla habría que ejecutarla en
                sentido contrario. Queda registrada en la auditoría.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmando(false)} disabled={ejecutando}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={reasignar} disabled={ejecutando}>
              {ejecutando ? "Reasignando..." : "Sí, reasignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
