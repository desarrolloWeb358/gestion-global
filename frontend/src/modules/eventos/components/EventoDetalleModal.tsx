import * as React from "react";
import {
  Ban,
  Bell,
  Building2,
  CalendarClock,
  Check,
  CircleCheck,
  Link2,
  MapPin,
  Pencil,
  UserCircle2,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Separator } from "@/shared/ui/separator";
import { Textarea } from "@/shared/ui/textarea";
import { cn } from "@/shared/lib/cn";

import {
  CANAL_LABELS,
  EVENTO_CATEGORIA_COLOR,
  EVENTO_CATEGORIA_LABELS,
  EVENTO_MODALIDAD_LABELS,
  RESPUESTA_BADGE_CLASS,
  RESPUESTA_LABELS,
  etiquetaAntelacion,
} from "../constants/eventoConstants";
import {
  aFecha,
  formatoFechaCorta,
  formatoHora,
  formatoRangoEvento,
  tiempoRestante,
} from "../lib/fechaEvento";
import { esDuenoEvento } from "../lib/permisosEvento";
import type { Evento } from "../models/evento.model";
import { cambiarAsistencia, cambiarEstadoEvento } from "../services/eventoService";

interface EventoDetalleModalProps {
  evento: Evento;
  uid: string;
  onEditar: () => void;
  onClose: () => void;
}

export function EventoDetalleModal({
  evento,
  uid,
  onEditar,
  onClose,
}: EventoDetalleModalProps) {
  const [procesando, setProcesando] = React.useState(false);
  const [mostrarMotivo, setMostrarMotivo] = React.useState(false);
  const [motivo, setMotivo] = React.useState("");

  const inicio = aFecha(evento.inicio);
  const fin = aFecha(evento.fin);
  // Editar, cancelar, reactivar y eliminar quedan reservados a quien creó el
  // evento. El resto del equipo solo lo consulta y responde su asistencia.
  const puedeEditar = esDuenoEvento(evento, uid);
  const cancelado = evento.estado === "cancelado";

  const creacion = aFecha(evento.fechaCreacion);
  const yo = evento.participantes.find((p) => p.uid === uid);
  const yaPaso = inicio ? inicio.getTime() < Date.now() : false;

  const conteo = React.useMemo(() => {
    const base = { asiste: 0, rechazo: 0 };
    evento.participantes.forEach((p) => {
      base[p.respuesta] = (base[p.respuesta] ?? 0) + 1;
    });
    return base;
  }, [evento.participantes]);

  // No hay que aceptar nada: estar en la lista significa asistir. Solo se
  // registra la excepcion, y esa si le llega al que agendo y al resto.
  async function marcarAsistencia(respuesta: "asiste" | "rechazo") {
    if (!evento.id) return;
    setProcesando(true);
    try {
      await cambiarAsistencia(evento.id, uid, respuesta, motivo);
      toast.success(
        respuesta === "rechazo"
          ? "Avisaste que no podras asistir. Se notifico a los demas."
          : "Confirmaste que si asistes."
      );
      setMostrarMotivo(false);
      setMotivo("");
    } catch (err) {
      console.error("[EventoDetalleModal] Error actualizando asistencia:", err);
      toast.error((err as any)?.message ?? "No se pudo registrar tu respuesta.");
    } finally {
      setProcesando(false);
    }
  }

  async function cambiarEstado(estado: "cancelado" | "programado" | "realizado") {
    if (!evento.id) return;
    setProcesando(true);
    try {
      await cambiarEstadoEvento(evento.id, estado);
      toast.success(
        estado === "cancelado"
          ? "Evento cancelado. Se avisara a los participantes."
          : "Evento actualizado."
      );
    } catch (err) {
      console.error("[EventoDetalleModal] Error cambiando estado:", err);
      toast.error("No se pudo actualizar el evento.");
    } finally {
      setProcesando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-start gap-2 pr-6">
            <span
              className="mt-1.5 h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: EVENTO_CATEGORIA_COLOR[evento.categoria] }}
            />
            <DialogTitle className={cn("text-left", cancelado && "line-through opacity-60")}>
              {evento.titulo}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{EVENTO_CATEGORIA_LABELS[evento.categoria]}</Badge>
            <Badge variant="outline">{EVENTO_MODALIDAD_LABELS[evento.modalidad]}</Badge>
            {evento.visibilidad === "privada" && (
              <Badge variant="outline">Privada</Badge>
            )}
            {cancelado && <Badge variant="destructive">Cancelado</Badge>}
            {evento.estado === "realizado" && (
              <Badge variant="outline" className="border-emerald-200 bg-emerald-100 text-emerald-700">
                Realizado
              </Badge>
            )}
          </div>

          {inicio && fin && (
            <div className="flex items-start gap-2">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">
                  {formatoRangoEvento(inicio, fin, evento.todoElDia, evento.tieneHoraFin)}
                </p>
                {!cancelado && (
                  <p className="text-xs text-muted-foreground">{tiempoRestante(inicio)}</p>
                )}
              </div>
            </div>
          )}

          {evento.ubicacion && (
            <div className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{evento.ubicacion}</span>
            </div>
          )}

          {evento.enlaceReunion ? (
            <div className="flex items-start gap-2">
              <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <a
                href={evento.enlaceReunion}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-primary underline underline-offset-2"
              >
                {evento.enlaceReunion}
              </a>
            </div>
          ) : (
            evento.modalidad !== "presencial" && (
              <div className="flex items-start gap-2 text-muted-foreground">
                <Link2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-xs">
                  Todavía no hay enlace de la reunión.
                  {puedeEditar && " Puedes agregarlo desde Editar."}
                </span>
              </div>
            )
          )}

          {evento.clienteNombre && (
            <div className="flex items-start gap-2">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span>{evento.clienteNombre}</span>
            </div>
          )}

          {evento.descripcion && (
            <>
              <Separator />
              <p className="whitespace-pre-wrap text-muted-foreground">
                {evento.descripcion}
              </p>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <div className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4 text-muted-foreground" />
              Asistentes ({evento.participantes.length})
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {conteo.asiste} asisten
                {conteo.rechazo > 0 && ` · ${conteo.rechazo} no podrá(n)`}
              </span>
            </div>
            <ul className="space-y-1">
              {evento.participantes.map((p) => (
                <li key={p.uid} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {p.nombre}
                    {p.uid === evento.organizadorId && (
                      <span className="ml-1 text-xs text-muted-foreground">(agendó)</span>
                    )}
                    {p.respuesta === "rechazo" && p.motivoRechazo && (
                      <span className="block text-xs text-muted-foreground">
                        {p.motivoRechazo}
                      </span>
                    )}
                  </span>
                  <Badge
                    variant="outline"
                    className={cn("shrink-0 text-xs", RESPUESTA_BADGE_CLASS[p.respuesta])}
                  >
                    {RESPUESTA_LABELS[p.respuesta]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>

          {evento.recordatorios.length > 0 && (
            <>
              <Separator />
              <div className="space-y-1">
                <div className="flex items-center gap-2 font-medium">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Recordatorios
                </div>
                <ul className="space-y-0.5 text-xs text-muted-foreground">
                  {evento.recordatorios.map((r, i) => (
                    <li key={i}>
                      {etiquetaAntelacion(r.minutosAntes)} ·{" "}
                      {r.canales.map((c) => CANAL_LABELS[c]).join(", ")}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          <Separator />

          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <UserCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <div className="space-y-0.5">
              <p>
                Creado por{" "}
                <span className="font-medium text-foreground">
                  {evento.creadoPorNombre || evento.organizadorNombre || "Sin definir"}
                </span>
                {creacion && ` · ${formatoFechaCorta(creacion)}, ${formatoHora(creacion)}`}
              </p>
              {!puedeEditar && (
                <p>Solo esa persona puede editar o eliminar este evento.</p>
              )}
            </div>
          </div>
        </div>

        {/* Estar en la lista ya significa asistir: solo se ofrece excusarse. */}
        {yo && !cancelado && !yaPaso && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            {yo.respuesta === "asiste" && !mostrarMotivo && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Estás agendado en este evento.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => setMostrarMotivo(true)}
                  disabled={procesando}
                >
                  <X className="mr-1 h-4 w-4" />
                  No podré asistir
                </Button>
              </div>
            )}

            {yo.respuesta === "asiste" && mostrarMotivo && (
              <div className="space-y-2">
                <Label htmlFor="motivo-inasistencia" className="text-sm">
                  ¿Por qué no podrás asistir? (opcional)
                </Label>
                <Textarea
                  id="motivo-inasistencia"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Ej: tengo audiencia a la misma hora"
                  rows={2}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setMostrarMotivo(false);
                      setMotivo("");
                    }}
                    disabled={procesando}
                  >
                    Volver
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => marcarAsistencia("rechazo")}
                    disabled={procesando}
                  >
                    Avisar que no asisto
                  </Button>
                </div>
              </div>
            )}

            {yo.respuesta === "rechazo" && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  Avisaste que no podrás asistir.
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="ml-auto"
                  onClick={() => marcarAsistencia("asiste")}
                  disabled={procesando}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Sí podré asistir
                </Button>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <div className="flex gap-2">
            {puedeEditar && !cancelado && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => cambiarEstado("cancelado")}
                disabled={procesando}
              >
                <Ban className="mr-1 h-4 w-4" />
                Cancelar evento
              </Button>
            )}
            {puedeEditar && cancelado && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cambiarEstado("programado")}
                disabled={procesando}
              >
                Reactivar
              </Button>
            )}
            {puedeEditar && !cancelado && yaPaso && evento.estado !== "realizado" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => cambiarEstado("realizado")}
                disabled={procesando}
              >
                <CircleCheck className="mr-1 h-4 w-4" />
                Marcar realizado
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            {puedeEditar && (
              <Button onClick={onEditar} disabled={procesando}>
                <Pencil className="mr-1 h-4 w-4" />
                Editar
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
