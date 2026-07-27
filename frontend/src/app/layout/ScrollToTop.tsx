// src/components/layout/ScrollToTop.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Vistas maestro-detalle donde navegar NO significa "cambiar de página": abrir
// una conversación cambia la URL pero el usuario sigue en la misma pantalla, y
// subir el scroll le quita de vista la lista que estaba recorriendo.
const SIN_SCROLL_TOP = ["/whatsapp/"];

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    if (SIN_SCROLL_TOP.some((p) => pathname.startsWith(p))) return;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [pathname]);

  return null;
};

export default ScrollToTop;
