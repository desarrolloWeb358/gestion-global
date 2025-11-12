import React from "react";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/lib/cn";

interface BackButtonProps {
  /**
   * Texto personalizado para el botón (por defecto: "Volver")
   */
  label?: string;
  /**
   * Ruta específica a la que volver (si no se proporciona, usa navigate(-1))
   */
  to?: string;
  /**
   * Clases CSS adicionales
   */
  className?: string;
  /**
   * Variante del botón
   */
  variant?: "default" | "outline" | "ghost" | "brand";
  /**
   * Tamaño del botón
   */
  size?: "default" | "sm" | "lg" | "icon";
  /**
   * Mostrar solo el ícono (sin texto)
   */
  iconOnly?: boolean;
  /**
   * Callback personalizado al hacer clic (sobrescribe la navegación por defecto)
   */
  onClick?: () => void;
}

export function BackButton({
  label = "Volver",
  to,
  className,
  variant = "ghost",
  size = "default",
  iconOnly = false,
  onClick,
}: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (to) {
      navigate(to);
    } else {
      navigate(-1);
    }
  };

  if (iconOnly) {
    return (
      <Button
        variant={variant}
        size="icon"
        onClick={handleClick}
        className={cn(
          "rounded-full transition-all hover:scale-110",
          className
        )}
        aria-label={label}
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      className={cn(
        "group gap-2 font-primary transition-all",
        className
      )}
    >
      <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
      <span className="font-medium">{label}</span>
    </Button>
  );
}