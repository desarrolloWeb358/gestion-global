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
  const value = (text ?? "").trim();

  if (!value) return <span className="text-muted-foreground text-sm">{emptyText}</span>;

  const showToggle = value.length > 120;

  return (
    <div className={cn("space-y-1", className)}>
      <div
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
