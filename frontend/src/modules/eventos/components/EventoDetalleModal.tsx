import * as React from "react";
import {
  Ban,
  Bell,
  CalendarClock,
  Check,
  CircleCheck,
  Link2,
  MapPin,
  Pencil,
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
import { Separator } from "@/shared/ui/separator";
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
import { aFecha, formatoRangoEvento, tiempoRestante } from "../lib/fechaEvento";
import type { Evento } from "../models/evento.model";
import { cambiarEstadoEvento, responderInvitacion } from "../services/eventoService";

interface EventoDetalleModalProps {
  evento: Evento;
  uid: string;
  canManage: boolean;
  onEditar: () => void;
  onClose: () => void;
}

export function EventoDetalleModal({
  evento,
  uid,
  canManage,
  onEditar,
  onClose,
}: EventoDetalleModalProps) {
  const [procesando, setProcesando] = React.useState(false);

  const inicio = aFecha(evento.inicio);
  const fin = aFecha(evento.fin);
  const esOrganizador = evento.organizadorId === uid;
  const puedeEditar = canManage || esOrganizador;
  const cancelado = evento.estado === "cancelado";

  const yo = evento.participantes.find((p) => p.uid === uid);
  const yaPaso = inicio ? inicio.getTime() < Date.now() : false;

  const conteo = React.useMemo(() => {
    const base = { acepto: 0, rechazo: 0, pendiente: 0 };
    evento.participantes.forEach((p) => {
      base[p.respuesta] = (base[p.respuesta] ?? 0) + 1;
    });
    return base;
  }, [evento.participantes]);

  async function responder(respuesta: "acepto" | "rechazo") {
    if (!evento.id) return;
    setProcesando(true);
    try {
      await responderInvitacion(evento.id, uid, respuesta);
      toast.success(respuesta === "acepto" ? "Confirmaste tu asistencia." : "Marcaste que no asistes.");
    } catch (err) {
      console.error("[EventoDetalleModal] Error respondiendo:", err);
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
                  {formatoRangoEvento(inicio, fin, evento.todoElDia)}
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

          {evento.enlaceReunion && (
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
              Participantes ({evento.participantes.length})
              <span className="ml-auto text-xs font-normal text-muted-foreground">
                {conteo.acepto} asisten · {conteo.rechazo} no · {conteo.pendiente} sin responder
              </span>
            </div>
            <ul className="space-y-1">
              {evento.participantes.map((p) => (
                <li key={p.uid} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    {p.nombre}
                    {p.uid === evento.organizadorId && (
                      <span className="ml-1 text-xs text-muted-foreground">(organiza)</span>
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

          <p className="text-xs text-muted-foreground">
            Organiza: {evento.organizadorNombre || "Sin definir"}
          </p>
        </div>

        {/* RSVP: solo si estoy invitado, el evento sigue vigente y no ha pasado */}
        {yo && !cancelado && !yaPaso && (
          <div className="flex gap-2 rounded-md border bg-muted/40 p-2">
            <span className="self-center text-sm text-muted-foreground">
              ¿Asistes?
            </span>
            <Button
              size="sm"
              variant={yo.respuesta === "acepto" ? "default" : "outline"}
              onClick={() => responder("acepto")}
              disabled={procesando}
            >
              <Check className="mr-1 h-4 w-4" />
              Si
            </Button>
            <Button
              size="sm"
              variant={yo.respuesta === "rechazo" ? "default" : "outline"}
              onClick={() => responder("rechazo")}
              disabled={procesando}
            >
              <X className="mr-1 h-4 w-4" />
              No
            </Button>
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
