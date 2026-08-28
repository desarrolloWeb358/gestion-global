import * as React from "react";
import { Building2, Loader2, Search, X } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/lib/cn";
import {
  listarClientesBasico,
  type ClienteOption,
} from "@/modules/clientes/services/clienteService";

/** Cantidad de coincidencias que se muestran; escribir más afina la busqueda. */
const MAX_SUGERENCIAS = 8;

export interface ClienteAsociado {
  id: string;
  nombre: string;
}

interface ClienteSelectorProps {
  valor: ClienteAsociado | null;
  onChange: (cliente: ClienteAsociado | null) => void;
  disabled?: boolean;
}

/**
 * Autocompletado de conjuntos para asociar (opcionalmente) un evento a un
 * cliente. Se apoya en `listarClientesBasico`, el mismo listado id+nombre que ya
 * usan el panel de seguimiento y el de WhatsApp: una sola lectura de la
 * colección y el filtrado se hace en memoria mientras se escribe.
 */
export function ClienteSelector({ valor, onChange, disabled }: ClienteSelectorProps) {
  const [clientes, setClientes] = React.useState<ClienteOption[]>([]);
  const [cargando, setCargando] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [busqueda, setBusqueda] = React.useState("");
  const [abierto, setAbierto] = React.useState(false);
  const contenedor = React.useRef<HTMLDivElement>(null);

  // La lista se pide una sola vez, la primera vez que el usuario escribe: si el
  // evento no se va a asociar a ningún conjunto no se gasta la lectura.
  const pedirClientes = React.useCallback(() => {
    if (cargando || clientes.length > 0) return;
    setCargando(true);
    setError(false);
    listarClientesBasico()
      .then(setClientes)
      .catch((err) => {
        console.error("[ClienteSelector] Error cargando conjuntos:", err);
        setError(true);
      })
      .finally(() => setCargando(false));
  }, [cargando, clientes.length]);

  // Clic afuera: cierra la lista de sugerencias.
  React.useEffect(() => {
    if (!abierto) return;
    function alClicar(e: MouseEvent) {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", alClicar);
    return () => document.removeEventListener("mousedown", alClicar);
  }, [abierto]);

  const sugerencias = React.useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return clientes.slice(0, MAX_SUGERENCIAS);
    return clientes
      .filter((c) => c.nombre.toLowerCase().includes(termino))
      .slice(0, MAX_SUGERENCIAS);
  }, [clientes, busqueda]);

  function elegir(cliente: ClienteOption) {
    onChange({ id: cliente.id, nombre: cliente.nombre });
    setBusqueda("");
    setAbierto(false);
  }

  if (valor) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">{valor.nombre}</span>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={() => onChange(null)}
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Quitar
          </Button>
        )}
      </div>
    );
  }

  return (
    <div ref={contenedor} className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        value={busqueda}
        onChange={(e) => {
          setBusqueda(e.target.value);
          setAbierto(true);
          pedirClientes();
        }}
        onFocus={() => {
          setAbierto(true);
          pedirClientes();
        }}
        placeholder="Escribe parte del nombre del conjunto..."
        className="pl-8"
        disabled={disabled}
      />

      {abierto && !disabled && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          {cargando && (
            <p className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Cargando conjuntos...
            </p>
          )}

          {!cargando && error && (
            <p className="p-3 text-sm text-destructive">
              No se pudo cargar la lista de conjuntos.
            </p>
          )}

          {!cargando && !error && sugerencias.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              Ningún conjunto coincide con "{busqueda.trim()}".
            </p>
          )}

          {!cargando && !error && sugerencias.length > 0 && (
            <ScrollArea className="max-h-56">
              <div className="p-1">
                {sugerencias.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => elegir(c)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                      "hover:bg-accent"
                    )}
                  >
                    <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1 truncate">{c.nombre}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>
      )}
    </div>
  );
}
