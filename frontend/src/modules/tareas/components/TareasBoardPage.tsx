import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Archive, LayoutDashboard, Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { PERMS } from "@/shared/constants/acl";
import { suscribirUsuariosAsignablesTareas } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

import { useTareas } from "../hooks/useTareas";
import { TAREA_ESTADOS } from "../constants/tareaConstants";
import type { Tarea, TareaEstado } from "../models/tarea.model";
import { cambiarEstadoTarea } from "../services/tareaService";
import { TareaColumn } from "./TareaColumn";
import { TareaFormModal } from "./TareaFormModal";
import { TareaCard } from "./TareaCard";

const TODOS = "__TODOS__";
const DIAS_VISIBLES_FINALIZADAS = 30;

function fechaEnMilisegundos(fecha: Tarea["fechaFinalizacion"]): number | null {
  if (!fecha || typeof (fecha as any).toDate !== "function") return null;
  return (fecha as any).toDate().getTime();
}

function estaArchivada(tarea: Tarea, ahora: number): boolean {
  if (tarea.estado !== "finalizada") return false;
  const fechaFinalizacion = fechaEnMilisegundos(tarea.fechaFinalizacion);
  if (fechaFinalizacion === null) return false;
  const antiguedadMaxima = DIAS_VISIBLES_FINALIZADAS * 24 * 60 * 60 * 1000;
  return ahora - fechaFinalizacion >= antiguedadMaxima;
}

export default function TareasBoardPage() {
  const { can, roles, loading: aclLoading } = useAcl();
  const { usuario, usuarioSistema } = useUsuarioActual();

  const canRead = can(PERMS.Tareas_Read);
  const canAssign = can(PERMS.Tareas_Assign);
  const canManage = can(PERMS.Tareas_Manage);
  const canEstadoEdit = can(PERMS.Tareas_Estado_Edit);

  const uid = usuario?.uid;
  const nombreActor = usuarioSistema?.nombre ?? usuario?.displayName ?? "";
  const puedeVerTodas = roles.includes("admin") || roles.includes("ejecutivoAdmin");
  const esAdmin = roles.includes("admin");

  const { tareas, loading } = useTareas(uid, canManage && puedeVerTodas);

  const [usuariosAsignables, setUsuariosAsignables] = React.useState<UsuarioSistema[]>([]);
  const [filtroEjecutivo, setFiltroEjecutivo] = React.useState<string>(TODOS);
  const [tareaSeleccionada, setTareaSeleccionada] = React.useState<Tarea | null>(null);
  const [mostrarNuevaTarea, setMostrarNuevaTarea] = React.useState(false);
  const [vista, setVista] = React.useState<"tablero" | "historico">("tablero");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  React.useEffect(() => {
    if (!canAssign) return;
    return suscribirUsuariosAsignablesTareas(
      setUsuariosAsignables,
      (err) => console.error("[TareasBoardPage] Error cargando usuarios asignables:", err)
    );
  }, [canAssign]);

  const tareasPorAgente = React.useMemo(() => {
    if (!canManage || filtroEjecutivo === TODOS) return tareas;
    return tareas.filter((t) => t.asignadoA === filtroEjecutivo);
  }, [tareas, canManage, filtroEjecutivo]);

  const { tareasTablero, tareasHistoricas } = React.useMemo(() => {
    const ahora = Date.now();
    return {
      tareasTablero: tareasPorAgente.filter((t) => !estaArchivada(t, ahora)),
      tareasHistoricas: tareasPorAgente
        .filter((t) => estaArchivada(t, ahora))
        .sort((a, b) =>
          (fechaEnMilisegundos(b.fechaFinalizacion) ?? 0) -
          (fechaEnMilisegundos(a.fechaFinalizacion) ?? 0)
        ),
    };
  }, [tareasPorAgente]);

  function tareasParaColumna(estado: TareaEstado) {
    return tareasTablero.filter((t) => t.estado === estado);
  }

  function puedeArrastrar(tarea: Tarea): boolean {
    if (canManage) return true;
    if (tarea.creadoPor === uid) return true;
    return canEstadoEdit && tarea.asignadoA === uid;
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const tareaId = String(active.id);
    const nuevoEstado = over.id as TareaEstado;
    const tarea = tareas.find((t) => t.id === tareaId);
    if (!tarea || !tarea.id) return;

    if (!puedeArrastrar(tarea)) return;
    if (nuevoEstado === tarea.estado) return;

    try {
      await cambiarEstadoTarea(tarea.id, nuevoEstado, tarea.creadoPor, tarea.titulo);
    } catch (err) {
      console.error("[TareasBoardPage] Error al cambiar estado:", err);
      toast.error("No se pudo actualizar el estado de la tarea.");
    }
  }

  if (aclLoading || loading) {
    return <div className="p-8 text-center text-muted-foreground">Cargando tareas...</div>;
  }

  if (!canRead) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        No tienes permisos para ver esta sección.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            Las tareas finalizadas permanecen 30 días en el tablero.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {esAdmin && (
            <div className="flex rounded-md border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={vista === "tablero" ? "default" : "ghost"}
                onClick={() => setVista("tablero")}
              >
                <LayoutDashboard className="h-4 w-4 mr-1" /> Tablero
              </Button>
              <Button
                type="button"
                size="sm"
                variant={vista === "historico" ? "default" : "ghost"}
                onClick={() => setVista("historico")}
              >
                <Archive className="h-4 w-4 mr-1" /> Histórico
              </Button>
            </div>
          )}
          {canManage && (
            <Select value={filtroEjecutivo} onValueChange={setFiltroEjecutivo}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por usuario" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los usuarios</SelectItem>
                {usuariosAsignables.map((e) => (
                  <SelectItem key={e.uid} value={e.uid}>{e.nombre || e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canRead && vista === "tablero" && (
            <Button onClick={() => setMostrarNuevaTarea(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva tarea
            </Button>
          )}
        </div>
      </div>

      {vista === "tablero" ? (
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TAREA_ESTADOS.map((col) => (
              <TareaColumn
                key={col.id}
                id={col.id}
                titulo={col.titulo}
                tareas={tareasParaColumna(col.id)}
                puedeArrastrar={puedeArrastrar}
                onTareaClick={setTareaSeleccionada}
              />
            ))}
          </div>
        </DndContext>
      ) : (
        <div className="rounded-lg border bg-muted/20 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Histórico de tareas finalizadas</h2>
              <p className="text-sm text-muted-foreground">Tareas cerradas hace 30 días o más.</p>
            </div>
            <span className="text-sm text-muted-foreground">{tareasHistoricas.length} tareas</span>
          </div>
          {tareasHistoricas.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {tareasHistoricas.map((tarea) => (
                <TareaCard
                  key={tarea.id}
                  tarea={tarea}
                  puedeArrastrar={false}
                  onClick={() => setTareaSeleccionada(tarea)}
                />
              ))}
            </div>
          ) : (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No hay tareas históricas para este filtro.
            </p>
          )}
        </div>
      )}

      {tareaSeleccionada && (
        <TareaFormModal
          tarea={tareaSeleccionada}
          canManage={canManage}
          canAssign={canAssign}
          usuariosAsignables={usuariosAsignables}
          actor={{ uid: uid ?? "", nombre: nombreActor }}
          onClose={() => setTareaSeleccionada(null)}
          onSaved={() => setTareaSeleccionada(null)}
        />
      )}

      {mostrarNuevaTarea && (
        <TareaFormModal
          canManage={canManage}
          canAssign={canAssign}
          usuariosAsignables={usuariosAsignables}
          actor={{ uid: uid ?? "", nombre: nombreActor }}
          onClose={() => setMostrarNuevaTarea(false)}
          onSaved={() => setMostrarNuevaTarea(false)}
        />
      )}
    </div>
  );
}
