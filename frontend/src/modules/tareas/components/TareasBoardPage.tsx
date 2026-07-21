import * as React from "react";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/shared/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";

import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { PERMS } from "@/shared/constants/acl";
import { obtenerEjecutivos } from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

import { useTareas } from "../hooks/useTareas";
import { TAREA_ESTADOS } from "../constants/tareaConstants";
import type { Tarea, TareaEstado } from "../models/tarea.model";
import { cambiarEstadoTarea } from "../services/tareaService";
import { TareaColumn } from "./TareaColumn";
import { TareaFormModal } from "./TareaFormModal";

const TODOS = "__TODOS__";

export default function TareasBoardPage() {
  const { can, roles, loading: aclLoading } = useAcl();
  const { usuario, usuarioSistema } = useUsuarioActual();

  const canRead = can(PERMS.Tareas_Read);
  const canManage = can(PERMS.Tareas_Manage);
  const canEstadoEdit = can(PERMS.Tareas_Estado_Edit);

  const uid = usuario?.uid;
  const nombreActor = usuarioSistema?.nombre ?? usuario?.displayName ?? "";
  const puedeVerTodas = roles.includes("admin") || roles.includes("ejecutivoAdmin");

  const { tareas, loading } = useTareas(uid, canManage && puedeVerTodas);

  const [ejecutivos, setEjecutivos] = React.useState<UsuarioSistema[]>([]);
  const [filtroEjecutivo, setFiltroEjecutivo] = React.useState<string>(TODOS);
  const [tareaSeleccionada, setTareaSeleccionada] = React.useState<Tarea | null>(null);
  const [mostrarNuevaTarea, setMostrarNuevaTarea] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  React.useEffect(() => {
    if (!canManage) return;
    obtenerEjecutivos()
      .then(setEjecutivos)
      .catch((err) => console.error("[TareasBoardPage] Error cargando ejecutivos:", err));
  }, [canManage]);

  const tareasFiltradas = React.useMemo(() => {
    if (!canManage || filtroEjecutivo === TODOS) return tareas;
    return tareas.filter((t) => t.asignadoA === filtroEjecutivo);
  }, [tareas, canManage, filtroEjecutivo]);

  function tareasParaColumna(estado: TareaEstado) {
    return tareasFiltradas.filter((t) => t.estado === estado);
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
        <h1 className="text-xl font-bold">Tareas</h1>
        <div className="flex items-center gap-2">
          {canManage && (
            <Select value={filtroEjecutivo} onValueChange={setFiltroEjecutivo}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Filtrar por ejecutivo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos los ejecutivos</SelectItem>
                {ejecutivos.map((e) => (
                  <SelectItem key={e.uid} value={e.uid}>{e.nombre || e.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {canRead && (
            <Button onClick={() => setMostrarNuevaTarea(true)}>
              <Plus className="h-4 w-4 mr-1" /> Nueva tarea
            </Button>
          )}
        </div>
      </div>

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

      {tareaSeleccionada && (
        <TareaFormModal
          tarea={tareaSeleccionada}
          canManage={canManage}
          ejecutivos={ejecutivos}
          actor={{ uid: uid ?? "", nombre: nombreActor }}
          onClose={() => setTareaSeleccionada(null)}
          onSaved={() => setTareaSeleccionada(null)}
        />
      )}

      {mostrarNuevaTarea && (
        <TareaFormModal
          canManage={canManage}
          ejecutivos={ejecutivos}
          actor={{ uid: uid ?? "", nombre: nombreActor }}
          onClose={() => setMostrarNuevaTarea(false)}
          onSaved={() => setMostrarNuevaTarea(false)}
        />
      )}
    </div>
  );
}
