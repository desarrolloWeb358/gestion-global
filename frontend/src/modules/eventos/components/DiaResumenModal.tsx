import * as React from "react";
import { Ban, CalendarPlus, CalendarX2, Clock, Link2, MapPin, Users } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

import {
  EVENTO_CATEGORIA_COLOR,
  EVENTO_CATEGORIA_LABELS,
  EVENTO_MODALIDAD_LABELS,
  ZONA_HORARIA,
} from "../constants/eventoConstants";
import { aFecha, formatoFechaCorta, formatoHora } from "../lib/fechaEvento";
import type { Evento, ParticipanteEvento } from "../models/evento.model";

interface DiaResumenModalProps {
  /** Día que se está mirando (cualquier hora de ese día). */
  dia: Date;
  /** Eventos ya filtrados por los controles del calendario. */
  eventos: Evento[];
  puedeCrear: boolean;
  onVerEvento: (evento: Evento) => void;
  onCrearEvento: (fecha: Date) => void;
  onClose: () => void;
}

const UN_DIA_MS = 24 * 60 * 60 * 1000;

/** Medianoche local del día de `fecha`. */
function inicioDelDia(fecha: Date): Date {
  const d = new Date(fecha);
  d.setHours(0, 0, 0, 0);
  return d;
}

function mismoDia(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Hora con la que se abre el formulario al crear desde este resumen. Un click
 * en el calendario entrega la medianoche del día, y proponer "12:00 a. m." no
 * le sirve a nadie: si el día es hoy se propone la próxima media hora; si es a
 * futuro, las 8:00 a. m.
 */
function horaSugeridaDelDia(dia: Date): Date {
  const ahora = new Date();
  const propuesta = inicioDelDia(dia);

  if (!mismoDia(dia, ahora)) {
    propuesta.setHours(8, 0, 0, 0);
    return propuesta;
  }

  propuesta.setHours(ahora.getHours(), ahora.getMinutes() > 30 ? 60 : 30, 0, 0);
  return propuesta;
}

interface EventoDelDia {
  evento: Evento;
  inicio: Date;
  fin: Date;
  /** Orden de la fila: los de todo el día arriba, el resto por hora. */
  orden: number;
}

/** Los eventos que tocan el día, ordenados como se van a pintar. */
function eventosDelDia(eventos: Evento[], dia: Date): EventoDelDia[] {
  const desde = inicioDelDia(dia);
  const hasta = new Date(desde.getTime() + UN_DIA_MS);

  return eventos
    .flatMap((evento) => {
      const inicio = aFecha(evento.inicio);
      const fin = aFecha(evento.fin);
      if (!inicio || !fin) return [];
      // Solapamiento con el día: entran también los que vienen de días
      // anteriores o siguen en los siguientes.
      if (inicio >= hasta || fin <= desde) return [];
      return [
        {
          evento,
          inicio,
          fin,
          orden: evento.todoElDia ? -1 : Math.max(inicio.getTime(), desde.getTime()),
        },
      ];
    })
    .sort((a, b) => a.orden - b.orden);
}

export function DiaResumenModal({
  dia,
  eventos,
  puedeCrear,
  onVerEvento,
  onCrearEvento,
  onClose,
}: DiaResumenModalProps) {
  const delDia = React.useMemo(() => eventosDelDia(eventos, dia), [eventos, dia]);

  const esHoy = mismoDia(dia, new Date());
  const cancelados = delDia.filter((e) => e.evento.estado === "cancelado").length;
  const activos = delDia.length - cancelados;

  const diaNumero = dia.toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "numeric",
  });
  const mesCorto = dia
    .toLocaleDateString("es-CO", { timeZone: ZONA_HORARIA, month: "short" })
    .replace(".", "")
    .toUpperCase();
  const diaSemana = dia.toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    weekday: "long",
  });
  const fechaLegible = dia.toLocaleDateString("es-CO", {
    timeZone: ZONA_HORARIA,
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="space-y-0 border-b bg-muted/40 px-5 py-4 pr-12">
          <div className="flex items-center gap-3.5">
            {/* Hoja de calendario: ubica el día de un vistazo. */}
            <div
              className={cn(
                "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border bg-background shadow-sm",
                esHoy && "border-primary/40 ring-2 ring-primary/20"
              )}
            >
              <span className="text-[10px] font-semibold tracking-widest text-muted-foreground">
                {mesCorto}
              </span>
              <span className="text-xl font-semibold leading-none tabular-nums">
                {diaNumero}
              </span>
            </div>

            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2 text-left text-lg capitalize">
                {diaSemana}
                {esHoy && (
                  <Badge className="h-5 px-2 text-[10px] uppercase tracking-wide">Hoy</Badge>
                )}
              </DialogTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {fechaLegible}
                <span className="mx-1.5 text-muted-foreground/50">·</span>
                {delDia.length === 0
                  ? "Sin eventos"
                  : `${activos} evento${activos === 1 ? "" : "s"}`}
                {cancelados > 0 && ` · ${cancelados} cancelado${cancelados === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {delDia.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed py-12 text-center">
              <CalendarX2 className="h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium">No hay nada agendado este día</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                {puedeCrear
                  ? "Puedes agendar el primer evento desde el botón de abajo."
                  : "Cuando alguien agende algo para este día, lo verás aquí."}
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {delDia.map((fila) => (
                <FilaEvento
                  key={fila.evento.id}
                  fila={fila}
                  dia={dia}
                  onVer={() => onVerEvento(fila.evento)}
                />
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="border-t bg-muted/30 px-5 py-3 sm:justify-between">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
          {puedeCrear && (
            <Button onClick={() => onCrearEvento(horaSugeridaDelDia(dia))}>
              <CalendarPlus className="mr-1 h-4 w-4" />
              Crear evento este día
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FilaEvento({
  fila,
  dia,
  onVer,
}: {
  fila: EventoDelDia;
  dia: Date;
  onVer: () => void;
}) {
  const { evento, inicio, fin } = fila;
  const cancelado = evento.estado === "cancelado";
  const ahora = Date.now();
  const enCurso = !cancelado && inicio.getTime() <= ahora && fin.getTime() > ahora;
  const yaPaso = !cancelado && fin.getTime() <= ahora;

  return (
    <li>
      <button
        type="button"
        onClick={onVer}
        className={cn(
          "flex w-full gap-3 rounded-lg border bg-card p-3 text-left transition-colors",
          "hover:border-primary/30 hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          cancelado && "opacity-60",
          yaPaso && !cancelado && "opacity-80"
        )}
      >
        {/* Franja del color de la categoría: el mismo código del calendario. */}
        <span
          aria-hidden
          className="w-1 shrink-0 rounded-full"
          style={{ backgroundColor: EVENTO_CATEGORIA_COLOR[evento.categoria] }}
        />

        <div className="w-[96px] shrink-0 pt-0.5">
          <HoraEvento fila={fila} dia={dia} />
        </div>

        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex items-start gap-2">
            <p
              className={cn(
                "min-w-0 flex-1 font-medium leading-tight",
                cancelado && "line-through"
              )}
            >
              {evento.titulo}
            </p>
            {enCurso && (
              <Badge className="shrink-0 bg-emerald-600 text-[10px] uppercase tracking-wide text-white">
                En curso
              </Badge>
            )}
            {cancelado && (
              <Badge variant="destructive" className="shrink-0 text-[10px]">
                <Ban className="mr-0.5 h-3 w-3" />
                Cancelado
              </Badge>
            )}
            {evento.estado === "realizado" && (
              <Badge
                variant="outline"
                className="shrink-0 border-emerald-200 bg-emerald-50 text-[10px] text-emerald-700"
              >
                Realizado
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px] font-normal">
              {EVENTO_CATEGORIA_LABELS[evento.categoria]}
            </Badge>
            <span className="inline-flex items-center gap-1">
              {evento.modalidad === "presencial" ? (
                <MapPin className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              {EVENTO_MODALIDAD_LABELS[evento.modalidad]}
            </span>
            {evento.ubicacion && (
              <span className="min-w-0 truncate" title={evento.ubicacion}>
                {evento.ubicacion}
              </span>
            )}
            {evento.clienteNombre && (
              <span className="min-w-0 truncate" title={evento.clienteNombre}>
                {evento.clienteNombre}
              </span>
            )}
          </div>

          {evento.participantes.length > 0 && (
            <ListaAsistentes
              participantes={evento.participantes}
              organizadorId={evento.organizadorId}
            />
          )}
        </div>
      </button>
    </li>
  );
}

/** Columna de la hora. Un evento que viene de otro día se marca como tal. */
function HoraEvento({ fila, dia }: { fila: EventoDelDia; dia: Date }) {
  const { evento, inicio, fin } = fila;

  if (evento.todoElDia) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <Clock className="h-3.5 w-3.5" />
        Todo el día
      </span>
    );
  }

  const empiezaHoy = mismoDia(inicio, dia);

  return (
    <div className="space-y-0.5">
      <p className="text-sm font-semibold leading-tight tabular-nums">
        {empiezaHoy ? formatoHora(inicio) : `Desde ${formatoFechaCorta(inicio)}`}
      </p>
      {evento.tieneHoraFin && (
        <p className="text-xs tabular-nums text-muted-foreground">
          {mismoDia(fin, dia) ? formatoHora(fin) : `hasta ${formatoFechaCorta(fin)}`}
        </p>
      )}
    </div>
  );
}

/** El organizador va de primero: es quien responde por el evento. */
function ordenarPorOrganizador(
  participantes: ParticipanteEvento[],
  organizadorId: string
): ParticipanteEvento[] {
  return [...participantes].sort((a, b) => {
    if (a.uid === organizadorId) return -1;
    if (b.uid === organizadorId) return 1;
    return 0;
  });
}

/**
 * Los asistentes con nombre completo, todos: en una agenda compartida saber
 * quién va es la mitad de la información, y un "+3 más" obliga a abrir el
 * evento para averiguarlo. La lista se envuelve en varias líneas si hace falta.
 */
function ListaAsistentes({
  participantes,
  organizadorId,
}: {
  participantes: ParticipanteEvento[];
  organizadorId: string;
}) {
  const ordenados = ordenarPorOrganizador(participantes, organizadorId);
  const noAsisten = ordenados.filter((p) => p.respuesta === "rechazo").length;

  return (
    <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <Users className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p className="min-w-0 flex-1 leading-relaxed">
        {ordenados.map((p, i) => (
          <React.Fragment key={p.uid}>
            {i > 0 && <span className="text-muted-foreground/50">, </span>}
            <span
              className={cn(
                "text-foreground/80",
                p.respuesta === "rechazo" && "text-rose-600 line-through decoration-rose-600/50"
              )}
              title={p.respuesta === "rechazo" ? p.motivoRechazo || "No asiste" : undefined}
            >
              {p.nombre}
            </span>
            {p.uid === organizadorId && <span className="text-muted-foreground"> (agendó)</span>}
          </React.Fragment>
        ))}
        {noAsisten > 0 && (
          <span className="text-rose-600">
            {" "}
            · {noAsisten} no asiste{noAsisten === 1 ? "" : "n"}
          </span>
        )}
      </p>
    </div>
  );
}
