import * as React from "react";
import { AlertTriangle, CalendarIcon, Link2, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import { Button } from "@/shared/ui/button";
import { Calendar } from "@/shared/ui/calendar";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import { Textarea } from "@/shared/ui/textarea";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

import {
  CANALES,
  CANALES_AVISO_POR_DEFECTO,
  CANAL_LABELS,
  DURACION_MINIMA_MINUTOS,
  EVENTO_CATEGORIAS,
  EVENTO_MODALIDADES,
  OPCIONES_HORA,
  RECORDATORIOS_POR_DEFECTO,
  UBICACION_OFICINA,
  ajustarAMediaHora,
} from "../constants/eventoConstants";
import {
  aFecha,
  aHoraInput,
  combinarFechaHora,
  formatoRangoEvento,
  proximaMediaHora,
  sumarMinutos,
} from "../lib/fechaEvento";
import type {
  CanalAviso,
  Evento,
  EventoCategoria,
  EventoModalidad,
  ParticipanteEvento,
  RecordatorioEvento,
} from "../models/evento.model";
import {
  actualizarEvento,
  buscarConflictos,
  crearEvento,
  eliminarEvento,
  type ConflictoAgenda,
  type GuardarEventoInput,
} from "../services/eventoService";
import { ParticipantesSelector } from "./ParticipantesSelector";
import { RecordatoriosEditor } from "./RecordatoriosEditor";

export interface ActorEvento {
  uid: string;
  nombre?: string;
  email?: string;
  telefono?: string | null;
}

interface EventoFormModalProps {
  /** Evento existente, o null para uno nuevo. */
  evento?: Evento | null;
  /** Fecha preseleccionada al hacer clic en una celda del calendario. */
  fechaInicial?: Date | null;
  usuarios: UsuarioSistema[];
  actor: ActorEvento;
  canManage: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function EventoFormModal({
  evento,
  fechaInicial,
  usuarios,
  actor,
  canManage,
  onClose,
  onSaved,
}: EventoFormModalProps) {
  const esEdicion = !!evento?.id;
  const esOrganizador = evento?.organizadorId === actor.uid;
  const soloLectura = esEdicion && !canManage && !esOrganizador;

  const inicioEvento = aFecha(evento?.inicio);
  const finEvento = aFecha(evento?.fin);
  const arranque = inicioEvento ?? fechaInicial ?? proximaMediaHora();
  const cierre = finEvento ?? sumarMinutos(arranque, DURACION_MINIMA_MINUTOS);

  const [titulo, setTitulo] = React.useState(evento?.titulo ?? "");
  const [descripcion, setDescripcion] = React.useState(evento?.descripcion ?? "");
  const [categoria, setCategoria] = React.useState<EventoCategoria>(
    evento?.categoria ?? "reunion"
  );
  const [modalidad, setModalidad] = React.useState<EventoModalidad>(
    evento?.modalidad ?? "presencial"
  );
  const [ubicacion, setUbicacion] = React.useState(evento?.ubicacion ?? "");
  const [enlaceReunion, setEnlaceReunion] = React.useState(evento?.enlaceReunion ?? "");
  const [todoElDia, setTodoElDia] = React.useState(evento?.todoElDia ?? false);
  const [enOficina, setEnOficina] = React.useState(
    (evento?.ubicacion ?? "") === UBICACION_OFICINA
  );

  const [fechaInicio, setFechaInicio] = React.useState<Date>(arranque);
  const [horaInicio, setHoraInicio] = React.useState(ajustarAMediaHora(aHoraInput(arranque)));
  const [fechaFin, setFechaFin] = React.useState<Date>(cierre);
  const [horaFin, setHoraFin] = React.useState(ajustarAMediaHora(aHoraInput(cierre)));
  // Un evento nuevo arranca sin hora final; los ya creados conservan la suya.
  const [tieneHoraFin, setTieneHoraFin] = React.useState(
    esEdicion ? evento?.tieneHoraFin !== false : false
  );

  // Quien crea el evento NO se agrega solo: normalmente lo agenda la secretaria
  // para otras personas y ella no asiste. Si va a ir, se marca a sí misma.
  const [participantes, setParticipantes] = React.useState<ParticipanteEvento[]>(
    evento?.participantes ?? []
  );
  const [canalesAviso, setCanalesAviso] = React.useState<CanalAviso[]>(
    evento?.canalesAviso ?? CANALES_AVISO_POR_DEFECTO
  );
  const [recordatorios, setRecordatorios] = React.useState<RecordatorioEvento[]>(
    evento?.recordatorios ?? RECORDATORIOS_POR_DEFECTO
  );

  const [guardando, setGuardando] = React.useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = React.useState(false);
  const [conflictos, setConflictos] = React.useState<ConflictoAgenda[]>([]);
  const [buscandoConflictos, setBuscandoConflictos] = React.useState(false);
  const [confirmarCruce, setConfirmarCruce] = React.useState(false);

  const hayTelefonos = participantes.some((p) => !!p.telefono);

  /** Instante de inicio ya combinado, que usan la validación y el guardado. */
  const inicioCombinado = React.useMemo(
    () => (todoElDia ? combinarFechaHora(fechaInicio, "00:00") : combinarFechaHora(fechaInicio, horaInicio)),
    [todoElDia, fechaInicio, horaInicio]
  );

  const finCombinado = React.useMemo(() => {
    if (todoElDia) return combinarFechaHora(fechaFin, "23:59");
    // Sin hora final el evento ocupa el bloque mínimo.
    if (!tieneHoraFin) return sumarMinutos(inicioCombinado, DURACION_MINIMA_MINUTOS);
    return combinarFechaHora(fechaFin, horaFin);
  }, [todoElDia, tieneHoraFin, fechaFin, horaFin, inicioCombinado]);

  function activarHoraFin(activar: boolean) {
    setTieneHoraFin(activar);
    if (!activar) return;
    // Se propone el bloque mínimo: media hora después del inicio.
    const propuesta = sumarMinutos(inicioCombinado, DURACION_MINIMA_MINUTOS);
    setFechaFin(propuesta);
    setHoraFin(aHoraInput(propuesta));
  }

  // Si nadie tiene telefono, se limpia el canal de WhatsApp para no dejar
  // recordatorios que jamas se van a poder entregar.
  React.useEffect(() => {
    if (hayTelefonos) return;
    setCanalesAviso((actuales) =>
      actuales.includes("whatsapp") ? actuales.filter((c) => c !== "whatsapp") : actuales
    );
    setRecordatorios((actuales) => {
      if (!actuales.some((r) => r.canales.includes("whatsapp"))) return actuales;
      return actuales.map((r) => ({
        ...r,
        canales: r.canales.filter((c) => c !== "whatsapp"),
      }));
    });
  }, [hayTelefonos]);

  const uidsParticipantes = participantes.map((p) => p.uid).join(",");

  /**
   * Revisa la disponibilidad cada vez que cambian los asistentes o el horario.
   * Va con retardo para no consultar en cada tecla, y descarta respuestas viejas
   * que lleguen después de una consulta más reciente.
   */
  React.useEffect(() => {
    if (participantes.length === 0 || todoElDia) {
      setConflictos([]);
      return;
    }

    let vigente = true;
    setBuscandoConflictos(true);

    const temporizador = setTimeout(async () => {
      try {
        const encontrados = await buscarConflictos({
          inicio: inicioCombinado,
          fin: finCombinado,
          uids: participantes.map((p) => p.uid),
          excluirEventoId: evento?.id,
        });
        if (vigente) setConflictos(encontrados);
      } catch (err) {
        console.error("[EventoFormModal] Error revisando disponibilidad:", err);
        if (vigente) setConflictos([]);
      } finally {
        if (vigente) setBuscandoConflictos(false);
      }
    }, 400);

    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
    // `uidsParticipantes` colapsa el arreglo a una cadena estable: comparar el
    // arreglo por referencia dispararía la consulta en cada render.
  }, [uidsParticipantes, inicioCombinado, finCombinado, todoElDia, evento?.id, participantes]);

  /** Un renglón por persona ocupada, con el evento que se le cruza. */
  const conflictosPorPersona = React.useMemo(() => {
    const mapa = new Map<string, ConflictoAgenda[]>();
    conflictos.forEach((c) => {
      mapa.set(c.uid, [...(mapa.get(c.uid) ?? []), c]);
    });
    return [...mapa.entries()];
  }, [conflictos]);

  function construirInput(): GuardarEventoInput | null {
    if (!titulo.trim()) {
      toast.error("El titulo es obligatorio.");
      return null;
    }

    const inicio = inicioCombinado;
    const fin = finCombinado;

    if (tieneHoraFin && !todoElDia) {
      const minutos = (fin.getTime() - inicio.getTime()) / 60_000;
      if (minutos <= 0) {
        toast.error("La hora final debe ser posterior a la de inicio.");
        return null;
      }
      if (minutos < DURACION_MINIMA_MINUTOS) {
        toast.error(`El evento debe durar al menos ${DURACION_MINIMA_MINUTOS} minutos.`);
        return null;
      }
    }

    if (modalidad !== "virtual" && !ubicacion.trim()) {
      toast.error("Indica el lugar del evento.");
      return null;
    }
    if (modalidad !== "presencial" && !enlaceReunion.trim()) {
      toast.error("Indica el enlace de la reunion virtual.");
      return null;
    }
    if (participantes.length === 0) {
      toast.error("Selecciona al menos un asistente.");
      return null;
    }
    if (recordatorios.some((r) => r.canales.length === 0)) {
      toast.error("Cada recordatorio necesita al menos un canal.");
      return null;
    }

    return {
      titulo,
      descripcion,
      categoria,
      modalidad,
      ubicacion: modalidad === "virtual" ? "" : ubicacion,
      enlaceReunion: modalidad === "presencial" ? "" : enlaceReunion,
      inicio,
      fin,
      tieneHoraFin,
      todoElDia,
      participantes,
      canalesAviso,
      recordatorios,
      clienteId: evento?.clienteId ?? null,
      clienteNombre: evento?.clienteNombre ?? null,
      tareaId: evento?.tareaId ?? null,
    };
  }

  /** Punto de entrada del botón: si hay cruces, primero se confirma. */
  function intentarGuardar() {
    if (!construirInput()) return;
    if (conflictos.length > 0) {
      setConfirmarCruce(true);
      return;
    }
    void onSubmit();
  }

  async function onSubmit() {
    const input = construirInput();
    if (!input) return;

    setConfirmarCruce(false);
    setGuardando(true);
    try {
      if (esEdicion && evento?.id) {
        await actualizarEvento(evento.id, input);
        toast.success(
          canalesAviso.length > 0
            ? "Evento actualizado. Se avisará a los asistentes."
            : "Evento actualizado, sin avisar."
        );
      } else {
        await crearEvento(input, actor);
        toast.success(
          canalesAviso.length > 0
            ? `Evento creado. Se avisó por ${canalesAviso
                .map((c) => CANAL_LABELS[c].toLowerCase())
                .join(" y ")}.`
            : "Evento creado, sin avisar a nadie."
        );
      }
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[EventoFormModal] Error guardando:", err);
      toast.error("No se pudo guardar el evento.");
    } finally {
      setGuardando(false);
    }
  }

  async function onEliminar() {
    if (!evento?.id) return;
    setGuardando(true);
    try {
      await eliminarEvento(evento.id, evento.titulo);
      toast.success("Evento eliminado.");
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("[EventoFormModal] Error eliminando:", err);
      toast.error("No se pudo eliminar el evento.");
    } finally {
      setGuardando(false);
      setConfirmarBorrado(false);
    }
  }

  const bloqueado = guardando || soloLectura;

  return (
    <>
      <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {esEdicion ? "Editar evento" : "Nuevo evento"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="evento-titulo">Titulo *</Label>
              <Input
                id="evento-titulo"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Ej: Comite de cartera semanal"
                disabled={bloqueado}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Categoria</Label>
                <Select
                  value={categoria}
                  onValueChange={(v) => setCategoria(v as EventoCategoria)}
                  disabled={bloqueado}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENTO_CATEGORIAS.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Modalidad</Label>
                <Select
                  value={modalidad}
                  onValueChange={(v) => setModalidad(v as EventoModalidad)}
                  disabled={bloqueado}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENTO_MODALIDADES.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {modalidad !== "virtual" && (
              <div className="space-y-1.5">
                <Label htmlFor="evento-ubicacion">
                  <MapPin className="mr-1 inline h-3.5 w-3.5" />
                  Lugar *
                </Label>
                <label className="flex w-fit items-center gap-2 text-sm">
                  <Checkbox
                    checked={enOficina}
                    onCheckedChange={(v) => {
                      const marcado = v === true;
                      setEnOficina(marcado);
                      // Al desmarcar se limpia para que no quede la sede escrita
                      // en un evento que en realidad es en otro lado.
                      setUbicacion(marcado ? UBICACION_OFICINA : "");
                    }}
                    disabled={bloqueado}
                  />
                  En la oficina
                </label>
                <Input
                  id="evento-ubicacion"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Conjunto Casa Blanca, torre 3"
                  disabled={bloqueado || enOficina}
                />
              </div>
            )}

            {modalidad !== "presencial" && (
              <div className="space-y-1.5">
                <Label htmlFor="evento-enlace">
                  <Link2 className="mr-1 inline h-3.5 w-3.5" />
                  Enlace de la reunion *
                </Label>
                <Input
                  id="evento-enlace"
                  value={enlaceReunion}
                  onChange={(e) => setEnlaceReunion(e.target.value)}
                  placeholder="https://meet.google.com/..."
                  disabled={bloqueado}
                />
              </div>
            )}

            <label className="flex w-fit items-center gap-2 text-sm">
              <Checkbox
                checked={todoElDia}
                onCheckedChange={(v) => setTodoElDia(v === true)}
                disabled={bloqueado}
              />
              Todo el dia
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Inicio *</Label>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        disabled={bloqueado}
                        className="flex-1 justify-start font-normal"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {fechaInicio.toLocaleDateString("es-CO")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={fechaInicio}
                        defaultMonth={fechaInicio}
                        onSelect={(d) => {
                          if (!d) return;
                          setFechaInicio(d);
                          // Arrastra el fin si quedo antes del inicio.
                          if (d.getTime() > fechaFin.getTime()) setFechaFin(d);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                  {!todoElDia && (
                    <Select
                      value={horaInicio}
                      onValueChange={setHoraInicio}
                      disabled={bloqueado}
                    >
                      <SelectTrigger className="w-[125px]" aria-label="Hora de inicio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {OPCIONES_HORA.map((o) => (
                          <SelectItem key={o.valor} value={o.valor}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={tieneHoraFin}
                    onCheckedChange={(v) => activarHoraFin(v === true)}
                    disabled={bloqueado || todoElDia}
                  />
                  Hora final
                </label>

                {tieneHoraFin && !todoElDia ? (
                  <div className="flex gap-2">
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={bloqueado}
                          className="flex-1 justify-start font-normal"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {fechaFin.toLocaleDateString("es-CO")}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={fechaFin}
                          defaultMonth={fechaFin}
                          onSelect={(d) => d && setFechaFin(d)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <Select
                      value={horaFin}
                      onValueChange={setHoraFin}
                      disabled={bloqueado}
                    >
                      <SelectTrigger className="w-[125px]" aria-label="Hora de fin">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        {OPCIONES_HORA.map((o) => (
                          <SelectItem key={o.valor} value={o.valor}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <p className="pt-2 text-xs text-muted-foreground">
                    {todoElDia
                      ? "El evento ocupa el día completo."
                      : "Sin hora final. Márcala si el evento tiene duración definida."}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="evento-descripcion">Descripcion / agenda</Label>
              <Textarea
                id="evento-descripcion"
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                placeholder="Temas a tratar, material requerido..."
                rows={3}
                disabled={bloqueado}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Asistentes *</Label>
              <p className="text-xs text-muted-foreground">
                Quien agenda no queda incluido automáticamente. Márcate también a ti
                si vas a asistir.
              </p>
              <ParticipantesSelector
                usuarios={usuarios}
                seleccionados={participantes}
                onChange={setParticipantes}
                disabled={bloqueado}
              />

              {buscandoConflictos && (
                <p className="text-xs text-muted-foreground">
                  Revisando disponibilidad...
                </p>
              )}

              {conflictosPorPersona.length > 0 && (
                <div className="space-y-1.5 rounded-md border border-amber-300 bg-amber-50 p-3">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-amber-900">
                    <AlertTriangle className="h-4 w-4" />
                    Cruce de horario
                  </p>
                  <ul className="space-y-1 text-xs text-amber-800">
                    {conflictosPorPersona.map(([uid, lista]) => (
                      <li key={uid}>
                        <strong>{lista[0].nombre}</strong> no está disponible:
                        {lista.map((c) => (
                          <span key={c.eventoId} className="block pl-3">
                            · {c.eventoTitulo} —{" "}
                            {formatoRangoEvento(c.inicio, c.fin, false, c.tieneHoraFin)}
                          </span>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Avisar al guardar por</Label>
              <p className="text-xs text-muted-foreground">
                Aviso inmediato de agendamiento. También se usa si después
                reprogramas o cancelas el evento.
              </p>
              <div className="flex flex-wrap items-center gap-4 rounded-md border p-3">
                {CANALES.map((canal) => {
                  const deshabilitado =
                    bloqueado || (canal === "whatsapp" && !hayTelefonos);
                  return (
                    <label
                      key={canal}
                      className="flex items-center gap-2 text-sm data-[off=true]:opacity-50"
                      data-off={deshabilitado}
                    >
                      <Checkbox
                        checked={canalesAviso.includes(canal)}
                        onCheckedChange={() =>
                          setCanalesAviso((actuales) =>
                            actuales.includes(canal)
                              ? actuales.filter((c) => c !== canal)
                              : [...actuales, canal]
                          )
                        }
                        disabled={deshabilitado}
                      />
                      {CANAL_LABELS[canal]}
                    </label>
                  );
                })}
              </div>
              {canalesAviso.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nadie será notificado al guardar. Marca un canal si quieres avisar.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>Recordatorios</Label>
              <RecordatoriosEditor
                recordatorios={recordatorios}
                onChange={setRecordatorios}
                disabled={bloqueado}
                whatsappDisponible={hayTelefonos}
              />
            </div>

          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <div>
              {esEdicion && (canManage || esOrganizador) && (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setConfirmarBorrado(true)}
                  disabled={guardando}
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Eliminar
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} disabled={guardando}>
                Cancelar
              </Button>
              {!soloLectura && (
                <Button type="button" onClick={intentarGuardar} disabled={guardando}>
                  {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear evento"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmarCruce} onOpenChange={setConfirmarCruce}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hay un cruce de horario</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  {conflictosPorPersona.length === 1
                    ? "Esta persona ya tiene otro compromiso a esa hora:"
                    : "Estas personas ya tienen otro compromiso a esa hora:"}
                </p>
                <ul className="space-y-1 text-sm">
                  {conflictosPorPersona.map(([uid, lista]) => (
                    <li key={uid}>
                      <strong>{lista[0].nombre}</strong>
                      {lista.map((c) => (
                        <span key={c.eventoId} className="block pl-3 text-muted-foreground">
                          · {c.eventoTitulo} —{" "}
                          {formatoRangoEvento(c.inicio, c.fin, false, c.tieneHoraFin)}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
                <p>¿Quieres agendar el evento de todos modos?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Revisar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void onSubmit()} disabled={guardando}>
              Agendar de todos modos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmarBorrado} onOpenChange={setConfirmarBorrado}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar este evento</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrara definitivamente y se cancelaran sus recordatorios pendientes.
              Si solo quieres avisar que no se realizara, usa "Cancelar evento": los
              participantes reciben el aviso y queda el registro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={guardando}>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={onEliminar} disabled={guardando}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
