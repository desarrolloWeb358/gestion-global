import * as React from "react";
import { CalendarIcon, Link2, MapPin, Trash2 } from "lucide-react";
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
  DURACION_DEFECTO_MINUTOS,
  EVENTO_CATEGORIAS,
  EVENTO_MODALIDADES,
  PASO_HORA_SEGUNDOS,
  RECORDATORIOS_POR_DEFECTO,
} from "../constants/eventoConstants";
import {
  aFecha,
  aHoraInput,
  combinarFechaHora,
  proximaMediaHora,
  sumarMinutos,
} from "../lib/fechaEvento";
import type {
  Evento,
  EventoCategoria,
  EventoModalidad,
  EventoVisibilidad,
  ParticipanteEvento,
  RecordatorioEvento,
} from "../models/evento.model";
import {
  actualizarEvento,
  crearEvento,
  eliminarEvento,
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
  const cierre = finEvento ?? sumarMinutos(arranque, DURACION_DEFECTO_MINUTOS);

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
  const [visibilidad, setVisibilidad] = React.useState<EventoVisibilidad>(
    evento?.visibilidad ?? "publica"
  );

  const [fechaInicio, setFechaInicio] = React.useState<Date>(arranque);
  const [horaInicio, setHoraInicio] = React.useState(aHoraInput(arranque));
  const [fechaFin, setFechaFin] = React.useState<Date>(cierre);
  const [horaFin, setHoraFin] = React.useState(aHoraInput(cierre));

  const [participantes, setParticipantes] = React.useState<ParticipanteEvento[]>(() => {
    if (evento?.participantes?.length) return evento.participantes;
    // En un evento nuevo el organizador siempre queda dentro. Se arma con sus
    // propios datos y no buscándolo en `usuarios`: un supervisor puede crear
    // eventos aunque su rol no aparezca en esa lista.
    return [
      {
        uid: actor.uid,
        nombre: actor.nombre || actor.email || "Organizador",
        email: actor.email ?? "",
        telefono: actor.telefono ?? null,
        respuesta: "acepto",
        respondidoEn: null,
      },
    ];
  });
  const [recordatorios, setRecordatorios] = React.useState<RecordatorioEvento[]>(
    evento?.recordatorios?.length ? evento.recordatorios : RECORDATORIOS_POR_DEFECTO
  );

  const [guardando, setGuardando] = React.useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = React.useState(false);

  const organizadorUid = evento?.organizadorId ?? actor.uid;
  const hayTelefonos = participantes.some((p) => !!p.telefono);

  // Si nadie tiene telefono, se limpia el canal de WhatsApp para no dejar
  // recordatorios que jamas se van a poder entregar.
  React.useEffect(() => {
    if (hayTelefonos) return;
    setRecordatorios((actuales) => {
      if (!actuales.some((r) => r.canales.includes("whatsapp"))) return actuales;
      return actuales.map((r) => ({
        ...r,
        canales: r.canales.filter((c) => c !== "whatsapp"),
      }));
    });
  }, [hayTelefonos]);

  function construirInput(): GuardarEventoInput | null {
    if (!titulo.trim()) {
      toast.error("El titulo es obligatorio.");
      return null;
    }

    const inicio = todoElDia
      ? combinarFechaHora(fechaInicio, "00:00")
      : combinarFechaHora(fechaInicio, horaInicio);
    const fin = todoElDia
      ? combinarFechaHora(fechaFin, "23:59")
      : combinarFechaHora(fechaFin, horaFin);

    if (fin.getTime() <= inicio.getTime()) {
      toast.error("La hora de finalizacion debe ser posterior a la de inicio.");
      return null;
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
      toast.error("Selecciona al menos un participante.");
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
      todoElDia,
      visibilidad,
      participantes,
      recordatorios,
      clienteId: evento?.clienteId ?? null,
      clienteNombre: evento?.clienteNombre ?? null,
      tareaId: evento?.tareaId ?? null,
    };
  }

  async function onSubmit() {
    const input = construirInput();
    if (!input) return;

    setGuardando(true);
    try {
      if (esEdicion && evento?.id) {
        await actualizarEvento(evento.id, input);
        toast.success("Evento actualizado. Se avisara a los participantes.");
      } else {
        await crearEvento(input, actor);
        toast.success("Evento creado. Se envio la invitacion a los participantes.");
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
                <Input
                  id="evento-ubicacion"
                  value={ubicacion}
                  onChange={(e) => setUbicacion(e.target.value)}
                  placeholder="Ej: Sala de juntas, oficina principal"
                  disabled={bloqueado}
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
                    <Input
                      type="time"
                      step={PASO_HORA_SEGUNDOS}
                      value={horaInicio}
                      onChange={(e) => setHoraInicio(e.target.value)}
                      disabled={bloqueado}
                      className="w-[110px]"
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Fin *</Label>
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
                  {!todoElDia && (
                    <Input
                      type="time"
                      step={PASO_HORA_SEGUNDOS}
                      value={horaFin}
                      onChange={(e) => setHoraFin(e.target.value)}
                      disabled={bloqueado}
                      className="w-[110px]"
                    />
                  )}
                </div>
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
              <Label>Participantes *</Label>
              <ParticipantesSelector
                usuarios={usuarios}
                seleccionados={participantes}
                onChange={setParticipantes}
                disabled={bloqueado}
                uidFijo={organizadorUid}
              />
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

            <div className="space-y-1.5">
              <Label>Visibilidad</Label>
              <Select
                value={visibilidad}
                onValueChange={(v) => setVisibilidad(v as EventoVisibilidad)}
                disabled={bloqueado}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publica">
                    Publica — todo el equipo la ve en el calendario
                  </SelectItem>
                  <SelectItem value="privada">
                    Privada — solo los participantes
                  </SelectItem>
                </SelectContent>
              </Select>
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
                <Button type="button" onClick={onSubmit} disabled={guardando}>
                  {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear evento"}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
