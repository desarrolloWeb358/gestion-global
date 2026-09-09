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
  MoreLinkArg,
} from "@fullcalendar/core";
import type { DateClickArg, EventResizeDoneArg } from "@fullcalendar/interaction";
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
import {
  EVENTO_CATEGORIAS,
  EVENTO_CATEGORIA_CLASE,
  FORMATO_FRANJA_HORARIA,
  FORMATO_HORA_EVENTO,
  PASO_HORA_FULLCALENDAR,
} from "../constants/eventoConstants";
import { aFecha } from "../lib/fechaEvento";
import { MENSAJE_NO_ES_DUENO, esDuenoEvento } from "../lib/permisosEvento";
import type { Evento } from "../models/evento.model";
import { reprogramarEvento, suscribirEvento, type RangoFechas } from "../services/eventoService";
import { DiaResumenModal } from "./DiaResumenModal";
import { EventoDetalleModal } from "./EventoDetalleModal";
import { EventoFormModal } from "./EventoFormModal";

const TODOS = "__TODOS__";
const UN_DIA_MS = 24 * 60 * 60 * 1000;

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
  /**
   * Día abierto en el resumen. Se conserva mientras se mira el detalle de uno
   * de sus eventos o se crea otro: al cerrar ese modal se vuelve a la lista del
   * día en vez de quedar en el calendario pelado.
   */
  const [diaResumen, setDiaResumen] = React.useState<Date | null>(null);

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
            // Solo el dueño puede arrastrar o estirar su bloque. El handler de
            // drop igual lo revalida, pero así ni siquiera se puede intentar.
            editable: esDuenoEvento(evento, uid) && evento.estado !== "cancelado",
            extendedProps: { eventoId: evento.id },
            className: [
              "event-fc-color",
              EVENTO_CATEGORIA_CLASE[evento.categoria] ?? EVENTO_CATEGORIA_CLASE.otro,
              evento.estado === "cancelado" ? "fc-evento-cancelado" : "",
            ].filter(Boolean),
          },
        ];
      }),
    [eventosFiltrados, uid]
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

  /**
   * Un click en una casilla del mes abre el resumen del día, no el formulario:
   * lo primero que se quiere saber al tocar un día es qué hay agendado. Crear
   * queda a un botón de distancia, dentro de ese mismo resumen.
   */
  function onDateClick(arg: DateClickArg) {
    if (arg.view.type !== "dayGridMonth") return;
    arg.view.calendar.unselect();
    setDiaResumen(arg.date);
  }

  function onSelect(arg: DateSelectArg) {
    // En Mes, el click de un solo día ya lo atendió `onDateClick`. Arrastrar
    // varios días sí sigue creando un evento que los abarca.
    const unSoloDia = arg.end.getTime() - arg.start.getTime() <= UN_DIA_MS;
    if (arg.view.type === "dayGridMonth" && unSoloDia) {
      arg.view.calendar.unselect();
      return;
    }
    if (!canCreate) return;
    setFechaNuevo(arg.start);
    setCreando(true);
  }

  /**
   * El "+N más" de una casilla llena abre el mismo resumen del día. Devolver el
   * tipo de vista actual evita el popover nativo de FullCalendar sin moverse
   * del mes que se está viendo.
   */
  function onMoreLinkClick(arg: MoreLinkArg) {
    setDiaResumen(arg.date);
    return arg.view.type;
  }

  function puedeMover(evento: Evento): boolean {
    return esDuenoEvento(evento, uid);
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
      toast.error(MENSAJE_NO_ES_DUENO);
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
          dateClick={onDateClick}
          moreLinkClick={onMoreLinkClick}
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
          // Las franjas se rotulan cada hora: con rótulo cada media hora la
          // columna quedaba llena de texto y no se leía ninguno.
          slotLabelInterval="01:00:00"
          slotLabelFormat={FORMATO_FRANJA_HORARIA}
          eventTimeFormat={FORMATO_HORA_EVENTO}
          // El locale español trae reloj de 24 h; aquí toda la agenda se habla
          // en am/pm, así que se fuerza en las cabeceras y en los bloques.
          slotMinTime="06:00:00"
          slotMaxTime="21:00:00"
          // Los eventos que coinciden se reparten el ancho en vez de montarse
          // uno encima de otro: en Semana/Día tapaban por completo el título.
          slotEventOverlap={false}
          expandRows
          allDayText="Todo el día"
          views={{
            // En Mes basta el nombre del día; en Semana/Día se agrega el número
            // para ubicarse sin mirar el título de la barra superior.
            dayGridMonth: { dayHeaderFormat: { weekday: "long" } },
            timeGridWeek: { dayHeaderFormat: { weekday: "short", day: "numeric" } },
            timeGridDay: { dayHeaderFormat: { weekday: "long", day: "numeric" } },
          }}
          firstDay={1}
          noEventsText="No hay eventos en este periodo"
        />
      </div>

      {/* El resumen del día cede el paso al detalle y al formulario, y vuelve
          solo cuando se cierran: nunca hay dos modales encima. */}
      {diaResumen && !detalleVigente && !creando && !eventoEditar && (
        <DiaResumenModal
          dia={diaResumen}
          eventos={eventosFiltrados}
          puedeCrear={canCreate}
          onVerEvento={(evento) => setEventoDetalle(evento)}
          onCrearEvento={(fecha) => {
            setFechaNuevo(fecha);
            setCreando(true);
          }}
          onClose={() => setDiaResumen(null)}
        />
      )}

      {detalleVigente && !eventoEditar && (
        <EventoDetalleModal
          evento={detalleVigente}
          uid={uid ?? ""}
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
