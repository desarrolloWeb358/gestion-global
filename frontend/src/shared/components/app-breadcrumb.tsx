// src/shared/components/app-breadcrumb.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Home } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface AppBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function AppBreadcrumb({ items, className }: AppBreadcrumbProps) {
  const navigate = useNavigate();

  // Destino del botón volver: el penúltimo item con href, o -1 si no hay
  const backItem = [...items].reverse().find((item, i) => i > 0 && !!item.href);
  const handleBack = () => {
    if (backItem?.href) navigate(backItem.href);
    else navigate(-1);
  };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {items.length > 1 && (
        <button
          type="button"
          onClick={handleBack}
          title="Volver"
          className={cn(
            "flex items-center gap-1 px-2 h-7 rounded-lg shrink-0",
            "border border-gray-200 bg-white shadow-sm",
            "text-gray-500 hover:text-brand-primary hover:border-brand-primary/40 hover:bg-brand-primary/5",
            "transition-colors duration-150"
          )}
        >
          <ChevronLeft className="h-4 w-4" />
          <span className="text-sm font-medium">Volver</span>
        </button>
      )}
      <nav
        aria-label="Breadcrumb"
        className="inline-flex items-center gap-1 flex-wrap"
      >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isFirst = index === 0;
        const isLink = !!item.href && !isLast;

        return (
          <React.Fragment key={index}>
            {isLink ? (
              <button
                type="button"
                onClick={() => navigate(item.href!)}
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium rounded-md px-1.5 py-0.5",
                  "text-gray-500 hover:text-brand-primary hover:bg-brand-primary/5",
                  "transition-colors duration-150 max-w-[160px] truncate"
                )}
                title={item.label}
              >
                {isFirst && <Home className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </button>
            ) : (
              <span
                className={cn(
                  "flex items-center gap-1.5 text-sm px-1.5 py-0.5 rounded-md max-w-[200px] truncate",
                  isLast
                    ? "font-semibold text-brand-primary bg-brand-primary/10"
                    : "font-medium text-gray-400"
                )}
                title={item.label}
              >
                {isFirst && <Home className="h-3.5 w-3.5 shrink-0" />}
                <span className="truncate">{item.label}</span>
              </span>
            )}

            {!isLast && (
              <ChevronRight className="h-3.5 w-3.5 text-gray-300 shrink-0" />
            )}
          </React.Fragment>
        );
      })}
      </nav>
    </div>
  );
}
