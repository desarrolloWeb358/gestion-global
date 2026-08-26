import * as React from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import esLocale from "@fullcalendar/core/locales/es";
import type {
  DateSelectArg,
  EventClickArg,
  EventDropArg,
  EventInput,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import { useSearchParams } from "react-router-dom";
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { PERMS } from "@/shared/constants/acl";
import { normalizeToE164 } from "@/shared/phoneUtils";
import { suscribirUsuariosEquipoInterno } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

import { useEventos } from "../hooks/useEventos";
import { EVENTO_CATEGORIAS, PASO_HORA_FULLCALENDAR } from "../constants/eventoConstants";
import { aFecha } from "../lib/fechaEvento";
import type { Evento, EventoCategoria } from "../models/evento.model";
import { reprogramarEvento, suscribirEvento, type RangoFechas } from "../services/eventoService";
import { EventoDetalleModal } from "./EventoDetalleModal";
import { EventoFormModal } from "./EventoFormModal";

const TODOS = "__TODOS__";

/** Categoría → clase de color del tema TailAdmin (ver index.css). */
const CLASE_CATEGORIA: Record<EventoCategoria, string> = {
  reunion: "fc-bg-primary",
  capacitacion: "fc-bg-warning",
  audiencia: "fc-bg-danger",
  visita: "fc-bg-success",
  otro: "fc-bg-neutral",
};

export default function CalendarioPage() {
  const { can, roles, loading: aclLoading } = useAcl();
  const { usuario, usuarioSistema } = useUsuarioActual();

  const canRead = can(PERMS.Eventos_Read);
  const canCreate = can(PERMS.Eventos_Create);
  const canManage = can(PERMS.Eventos_Manage);

  const uid = usuario?.uid;
  const puedeVerTodo = canManage || roles.includes("admin");

  // El organizador se autoañade al evento con sus propios datos de contacto.
  const actor = React.useMemo(
    () => ({
      uid: uid ?? "",
      nombre: usuarioSistema?.nombre ?? usuario?.displayName ?? "",
      email: usuarioSistema?.email ?? usuario?.email ?? "",
      telefono:
        normalizeToE164(usuarioSistema?.telefonoUsuario, { defaultCountry: "CO" }) ?? null,
    }),
    [uid, usuarioSistema, usuario]
  );

  const [rango, setRango] = React.useState<RangoFechas | null>(null);
  const { eventos, loading } = useEventos(uid, puedeVerTodo, rango);

  const [usuarios, setUsuarios] = React.useState<UsuarioSistema[]>([]);
  const [filtroCategoria, setFiltroCategoria] = React.useState<string>(TODOS);
  const [filtroParticipante, setFiltroParticipante] = React.useState<string>(TODOS);
  const [mostrarCancelados, setMostrarCancelados] = React.useState(false);

  const [eventoDetalle, setEventoDetalle] = React.useState<Evento | null>(null);
  const [eventoEditar, setEventoEditar] = React.useState<Evento | null>(null);
  const [fechaNuevo, setFechaNuevo] = React.useState<Date | null>(null);
  const [creando, setCreando] = React.useState(false);

  React.useEffect(() => {
    if (!canCreate && !canManage) return;
    return suscribirUsuariosEquipoInterno(setUsuarios, (err) =>
      console.error("[CalendarioPage] Error cargando usuarios:", err)
    );
  }, [canCreate, canManage]);

  // Deep-link desde la campanita: /calendario?evento=<id>. Se carga el evento
  // por su id porque puede caer fuera del rango que muestra el calendario.
  const [searchParams, setSearchParams] = useSearchParams();
  const eventoEnlazado = searchParams.get("evento");

  React.useEffect(() => {
    if (!eventoEnlazado) return;

    const unsub = suscribirEvento(
      eventoEnlazado,
      (evento) => {
        if (evento) {
          setEventoDetalle(evento);
        } else {
          toast.error("El evento ya no existe.");
        }
        // El parámetro se consume una sola vez: si no, cerrar el modal lo
        // reabriría en el siguiente render.
        setSearchParams(
          (params) => {
            params.delete("evento");
            return params;
          },
          { replace: true }
        );
      },
      (err) => console.error("[CalendarioPage] Error cargando el evento enlazado:", err)
    );

    return () => unsub();
  }, [eventoEnlazado, setSearchParams]);

  // El modal de detalle se alimenta de la lista en vivo: si alguien responde la
  // invitación o cancela el evento, lo que está abierto se actualiza solo.
  const detalleVigente = React.useMemo(
    () => (eventoDetalle ? eventos.find((e) => e.id === eventoDetalle.id) ?? eventoDetalle : null),
    [eventos, eventoDetalle]
  );

  const eventosFiltrados = React.useMemo(
    () =>
      eventos.filter((e) => {
        if (!mostrarCancelados && e.estado === "cancelado") return false;
        if (filtroCategoria !== TODOS && e.categoria !== filtroCategoria) return false;
        if (filtroParticipante !== TODOS && !e.participantesUids.includes(filtroParticipante)) {
          return false;
        }
        return true;
      }),
    [eventos, mostrarCancelados, filtroCategoria, filtroParticipante]
  );

  const eventosCalendario = React.useMemo<EventInput[]>(
    () =>
      eventosFiltrados.flatMap((evento) => {
        const inicio = aFecha(evento.inicio);
        const fin = aFecha(evento.fin);
        if (!inicio || !fin || !evento.id) return [];
        return [
          {
            id: evento.id,
            title: evento.titulo,
            start: inicio,
            end: fin,
            allDay: evento.todoElDia,
            extendedProps: { eventoId: evento.id },
            className: [
              "event-fc-color",
              CLASE_CATEGORIA[evento.categoria],
              evento.estado === "cancelado" ? "fc-evento-cancelado" : "",
            ].filter(Boolean),
          },
        ];
      }),
    [eventosFiltrados]
  );

  /** FullCalendar avisa el rango visible en cada navegación de mes/semana. */
  const onDatesSet = React.useCallback((info: { start: Date; end: Date }) => {
    setRango((actual) => {
      if (
        actual &&
        actual.desde.getTime() === info.start.getTime() &&
        actual.hasta.getTime() === info.end.getTime()
      ) {
        return actual; // mismo rango: no reabrir la suscripción
      }
      return { desde: info.start, hasta: info.end };
    });
  }, []);

  function buscarEvento(id?: string): Evento | undefined {
    return eventos.find((e) => e.id === id);
  }

  function onEventClick(arg: EventClickArg) {
    const evento = buscarEvento(arg.event.id);
    if (evento) setEventoDetalle(evento);
  }

  function onSelect(arg: DateSelectArg) {
    if (!canCreate) return;
    setFechaNuevo(arg.start);
    setCreando(true);
  }

  function puedeMover(evento: Evento): boolean {
    return canManage || evento.organizadorId === uid;
  }

  async function onEventDrop(arg: EventDropArg) {
    // Mover no define hora final: solo cambia de sitio el bloque.
    await aplicarReprogramacion(arg.event.id, arg.event.start, arg.event.end, arg.event.allDay, arg.revert, false);
  }

  async function onEventResize(arg: EventResizeDoneArg) {
    // Estirar el bloque sí es una forma de fijar la hora final.
    await aplicarReprogramacion(arg.event.id, arg.event.start, arg.event.end, arg.event.allDay, arg.revert, true);
  }

  async function aplicarReprogramacion(
    id: string,
    inicio: Date | null,
    fin: Date | null,
    todoElDia: boolean,
    revertir: () => void,
    defineHoraFin: boolean
  ) {
    const evento = buscarEvento(id);
    if (!evento || !inicio) {
      revertir();
      return;
    }
    if (!puedeMover(evento)) {
      revertir();
      toast.error("Solo el organizador puede mover este evento.");
      return;
    }
    if (evento.estado === "cancelado") {
      revertir();
      toast.error("El evento está cancelado. Reactívalo antes de reprogramarlo.");
      return;
    }

    // Un evento de día completo arrastrado en la vista de mes llega sin `end`.
    const finEfectivo =
      fin ?? new Date(inicio.getTime() + (todoElDia ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000));

    try {
      await reprogramarEvento(id, inicio, finEfectivo, { todoElDia, defineHoraFin });
      toast.success("Evento reprogramado. Se recalcularon los recordatorios.");
    } catch (err) {
      console.error("[CalendarioPage] Error reprogramando:", err);
      revertir();
      toast.error("No se pudo reprogramar el evento.");
    }
  }

  if (aclLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canRead) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          No tienes permiso para ver el calendario.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendario</h1>
          <p className="text-sm text-muted-foreground">
            Agenda y eventos del equipo de Gestión Global.
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setFechaNuevo(null);
              setCreando(true);
            }}
          >
            <CalendarPlus className="mr-1 h-4 w-4" />
            Nuevo evento
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
        <Select value={filtroCategoria} onValueChange={setFiltroCategoria}>
          <SelectTrigger className="h-9 w-[190px]">
            <SelectValue placeholder="Categoría" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas las categorías</SelectItem>
            {EVENTO_CATEGORIAS.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {puedeVerTodo && usuarios.length > 0 && (
          <Select value={filtroParticipante} onValueChange={setFiltroParticipante}>
            <SelectTrigger className="h-9 w-[220px]">
              <SelectValue placeholder="Participante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODOS}>Todo el equipo</SelectItem>
              {usuarios.map((u) => (
                <SelectItem key={u.uid} value={u.uid}>
                  {u.nombre || u.email}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={mostrarCancelados}
            onCheckedChange={(v) => setMostrarCancelados(v === true)}
          />
          Mostrar cancelados
        </label>

        <span className="ml-auto text-sm text-muted-foreground">
          {loading ? "Cargando..." : `${eventosFiltrados.length} evento(s) en el periodo`}
        </span>
      </div>

      <div className="custom-calendar rounded-lg border bg-card p-2">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          locale={esLocale}
          timeZone="local"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,timeGridWeek,timeGridDay",
          }}
          buttonText={{
            today: "Hoy",
            month: "Mes",
            week: "Semana",
            day: "Día",
          }}
          events={eventosCalendario}
          datesSet={onDatesSet}
          eventClick={onEventClick}
          select={onSelect}
          selectable={canCreate}
          selectMirror
          editable={canCreate || canManage}
          eventDrop={onEventDrop}
          eventResize={onEventResize}
          nowIndicator
          dayMaxEvents={3}
          height="auto"
          slotDuration={PASO_HORA_FULLCALENDAR}
          snapDuration={PASO_HORA_FULLCALENDAR}
          slotMinTime="06:00:00"
          slotMaxTime="21:00:00"
          firstDay={1}
          noEventsText="No hay eventos en este periodo"
        />
      </div>

      {detalleVigente && !eventoEditar && (
        <EventoDetalleModal
          evento={detalleVigente}
          uid={uid ?? ""}
          canManage={canManage}
          onEditar={() => setEventoEditar(detalleVigente)}
          onClose={() => setEventoDetalle(null)}
        />
      )}

      {(creando || eventoEditar) && uid && (
        <EventoFormModal
          evento={eventoEditar}
          fechaInicial={fechaNuevo}
          usuarios={usuarios}
          actor={actor}
          canManage={canManage}
          onClose={() => {
            setCreando(false);
            setEventoEditar(null);
            setFechaNuevo(null);
          }}
          onSaved={() => setEventoDetalle(null)}
        />
      )}
    </div>
  );
}
