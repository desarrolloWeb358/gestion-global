// src/shared/components/app-breadcrumb.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { cn } from "@/shared/lib/cn";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

interface AppBreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function AppBreadcrumb({
  items,
  className,
}: AppBreadcrumbProps) {
  const navigate = useNavigate();

  return (
    <nav
      className={cn(
        "flex items-center text-sm text-gray-500 flex-wrap gap-1",
        className
      )}
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;

        return (
          <React.Fragment key={index}>
            {item.href && !isLast ? (
              <span
                onClick={() => navigate(item.href!)}
                className="cursor-pointer hover:text-brand-primary transition-colors font-medium"
              >
                {item.label}
              </span>
            ) : (
              <span
                className={cn(
                  isLast
                    ? "text-brand-primary font-semibold"
                    : "font-medium"
                )}
              >
                {item.label}
              </span>
            )}

            {!isLast && (
              <ChevronRight className="h-4 w-4 text-gray-400" />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}