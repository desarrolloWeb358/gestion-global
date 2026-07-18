import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/shared/lib/cn";
import type { Tarea, TareaEstado } from "../models/tarea.model";
import { TareaCard } from "./TareaCard";

interface TareaColumnProps {
  id: TareaEstado;
  titulo: string;
  tareas: Tarea[];
  puedeArrastrar: (tarea: Tarea) => boolean;
  onTareaClick: (tarea: Tarea) => void;
}

export function TareaColumn({ id, titulo, tareas, puedeArrastrar, onTareaClick }: TareaColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col rounded-lg border bg-muted/30 min-h-[400px] transition-colors",
        isOver && "bg-muted/60 border-primary/50"
      )}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        <span className="text-xs rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
          {tareas.length}
        </span>
      </div>
      <div className="flex-1 p-2 space-y-2">
        {tareas.map((tarea) => (
          <TareaCard
            key={tarea.id}
            tarea={tarea}
            puedeArrastrar={puedeArrastrar(tarea)}
            onClick={() => onTareaClick(tarea)}
          />
        ))}
        {tareas.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Sin tareas</p>
        )}
      </div>
    </div>
  );
}
