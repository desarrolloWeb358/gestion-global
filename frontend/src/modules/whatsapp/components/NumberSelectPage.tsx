import { Navigate } from "react-router-dom";
import { IconBrandWhatsapp, IconChevronRight } from "@tabler/icons-react";
import { useWaNumbers } from "../hooks/useWaNumbers";
import { useNavigate } from "react-router-dom";

export default function NumberSelectPage() {
  const { numbers, loading, error } = useWaNumbers();
  const navigate = useNavigate();

  // Redirect inmediato en render (sin flash) cuando hay un solo número
  if (!loading && numbers.length === 1) {
    return <Navigate to={`/whatsapp/${numbers[0].id}`} replace />;
  }

  return (
    <div className="max-w-xl mx-auto py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <IconBrandWhatsapp className="w-6 h-6 text-green-600" />
          WhatsApp
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecciona el número para ver sus conversaciones
        </p>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">Cargando números...</p>
      )}

      {error && (
        <div className="border border-destructive/40 bg-destructive/10 rounded-lg p-4 text-sm text-destructive">
          <p className="font-medium">Error al cargar los números</p>
          <p className="mt-1 font-mono text-xs">{error}</p>
        </div>
      )}

      {!loading && numbers.length === 0 && (
        <div className="border border-dashed border-border rounded-lg p-8 text-center">
          <IconBrandWhatsapp className="w-8 h-8 text-muted-foreground opacity-30 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No hay números de WhatsApp configurados.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Agrega un número en la colección <code className="text-xs">numbers/</code> de Firestore.
          </p>
        </div>
      )}

      <div className="space-y-2">
        {numbers.map((num) => (
          <button
            key={num.id}
            onClick={() => navigate(`/whatsapp/${num.id}`)}
            className="w-full flex items-center gap-3 p-4 rounded-lg border border-border bg-background hover:bg-muted/50 transition-colors text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
              <IconBrandWhatsapp className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">
                {num.displayName}
              </p>
              <p className="text-xs text-muted-foreground font-mono truncate">
                ID: {num.phoneNumberId}
              </p>
            </div>
            <IconChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors flex-shrink-0" />
          </button>
        ))}
      </div>
    </div>
  );
}
