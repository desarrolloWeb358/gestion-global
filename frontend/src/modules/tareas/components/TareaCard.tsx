import { useDraggable } from "@dnd-kit/core";
import { CalendarIcon, User } from "lucide-react";
import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/lib/cn";
import type { Tarea } from "../models/tarea.model";
import { TAREA_PRIORIDAD_BADGE_CLASS, TAREA_PRIORIDAD_LABELS } from "../constants/tareaConstants";

function formatFechaCorta(ts: any): string {
  if (!ts) return "";
  const d = typeof ts?.toDate === "function" ? ts.toDate() : null;
  if (!d) return "";
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
}

function estaVencida(tarea: Tarea): boolean {
  if (!tarea.fechaLimite || tarea.estado === "finalizada") return false;
  const d = typeof (tarea.fechaLimite as any)?.toDate === "function" ? (tarea.fechaLimite as any).toDate() : null;
  if (!d) return false;
  return d.getTime() < Date.now();
}

interface TareaCardProps {
  tarea: Tarea;
  puedeArrastrar: boolean;
  onClick?: () => void;
}

export function TareaCard({ tarea, puedeArrastrar, onClick }: TareaCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: tarea.id!,
    disabled: !puedeArrastrar,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.6 : 1 }
    : undefined;

  const vencida = estaVencida(tarea);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(puedeArrastrar ? listeners : {})}
      {...(puedeArrastrar ? attributes : {})}
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-3 shadow-sm space-y-2 cursor-pointer hover:shadow-md transition-shadow",
        puedeArrastrar && "cursor-grab active:cursor-grabbing",
        vencida && "border-destructive/50"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="outline" className={TAREA_PRIORIDAD_BADGE_CLASS[tarea.prioridad]}>
          {TAREA_PRIORIDAD_LABELS[tarea.prioridad]}
        </Badge>
        {tarea.fechaLimite && (
          <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", vencida && "text-destructive font-medium")}>
            <CalendarIcon className="h-3 w-3" />
            {formatFechaCorta(tarea.fechaLimite)}
          </span>
        )}
      </div>
      <h4 className="text-sm font-semibold leading-tight">{tarea.titulo}</h4>
      {tarea.descripcion && (
        <p className="text-xs text-muted-foreground line-clamp-2">{tarea.descripcion}</p>
      )}
      <div className="flex items-center gap-1 text-xs text-muted-foreground pt-1 border-t">
        <User className="h-3 w-3" />
        {tarea.asignadoNombre || "Sin asignar"}
      </div>
    </div>
  );
}
