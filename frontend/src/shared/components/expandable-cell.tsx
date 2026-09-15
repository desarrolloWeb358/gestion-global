import * as React from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

type Props = {
  text?: string | null;
  lines?: number; // 1,2,3...
  className?: string;
  emptyText?: string;
};

export function ExpandableCell({
  text,
  lines = 2,
  className,
  emptyText = "—",
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [overflows, setOverflows] = React.useState(false);
  const textRef = React.useRef<HTMLDivElement>(null);
  const value = (text ?? "").trim();

  // El botón aparece si el texto realmente se desborda del clamp, no por
  // su longitud: un texto corto con varios saltos de línea también se recorta.
  React.useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || open) return; // solo medimos colapsado

    const medir = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    medir();

    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value, lines, open]);

  if (!value) return <span className="text-muted-foreground text-sm">{emptyText}</span>;

  const showToggle = overflows;

  return (
    <div className={cn("space-y-1", className)}>
      <div
        ref={textRef}
        className="whitespace-pre-wrap text-sm leading-relaxed text-gray-700"
        style={
          open
            ? undefined
            : {
                display: "-webkit-box",
                WebkitLineClamp: lines,
                WebkitBoxOrient: "vertical" as any,
                overflow: "hidden",
              }
        }
      >
        {value}
      </div>

      {showToggle && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setOpen((s) => !s)}
          className="h-7 px-2 text-xs text-brand-primary hover:bg-brand-primary/10"
        >
          {open ? (
            <>
              Ver menos <ChevronUp className="ml-1 h-4 w-4" />
            </>
          ) : (
            <>
              Ver más <ChevronDown className="ml-1 h-4 w-4" />
            </>
          )}
        </Button>
      )}
    </div>
  );
}
