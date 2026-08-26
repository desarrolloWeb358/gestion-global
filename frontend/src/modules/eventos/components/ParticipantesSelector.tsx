import * as React from "react";
import { Check, Mail, Phone, Search, X } from "lucide-react";

import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import { ScrollArea } from "@/shared/ui/scroll-area";
import { cn } from "@/shared/lib/cn";
import { normalizeToE164 } from "@/shared/phoneUtils";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import type { ParticipanteEvento } from "../models/evento.model";

/** Usuario del sistema a participante nuevo (sin respuesta todavia). */
export function usuarioAParticipante(usuario: UsuarioSistema): ParticipanteEvento {
  return {
    uid: usuario.uid,
    nombre: usuario.nombre || usuario.email || "Sin nombre",
    email: usuario.email ?? "",
    telefono: normalizeToE164(usuario.telefonoUsuario, { defaultCountry: "CO" }) ?? null,
    respuesta: "asiste",
    respondidoEn: null,
  };
}

interface ParticipantesSelectorProps {
  usuarios: UsuarioSistema[];
  seleccionados: ParticipanteEvento[];
  onChange: (participantes: ParticipanteEvento[]) => void;
  disabled?: boolean;
  /** UID que no se puede quitar. Hoy nadie es obligatorio. */
  uidFijo?: string;
}

export function ParticipantesSelector({
  usuarios,
  seleccionados,
  onChange,
  disabled,
  uidFijo,
}: ParticipantesSelectorProps) {
  const [busqueda, setBusqueda] = React.useState("");

  const seleccionadosPorUid = React.useMemo(
    () => new Set(seleccionados.map((p) => p.uid)),
    [seleccionados]
  );

  const filtrados = React.useMemo(() => {
    const termino = busqueda.trim().toLowerCase();
    if (!termino) return usuarios;
    return usuarios.filter(
      (u) =>
        (u.nombre ?? "").toLowerCase().includes(termino) ||
        (u.email ?? "").toLowerCase().includes(termino)
    );
  }, [usuarios, busqueda]);

  function alternar(usuario: UsuarioSistema) {
    if (disabled) return;
    if (usuario.uid === uidFijo) return;

    if (seleccionadosPorUid.has(usuario.uid)) {
      onChange(seleccionados.filter((p) => p.uid !== usuario.uid));
    } else {
      onChange([...seleccionados, usuarioAParticipante(usuario)]);
    }
  }

  /** Sin correo no hay invitacion; sin telefono no hay WhatsApp. Se avisa antes. */
  const sinCorreo = seleccionados.filter((p) => !p.email);
  const sinTelefono = seleccionados.filter((p) => !p.telefono);

  return (
    <div className="space-y-3">
      {seleccionados.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {seleccionados.map((p) => (
            <Badge
              key={p.uid}
              variant="secondary"
              className="gap-1 pr-1 font-normal"
            >
              {p.nombre}
              {p.uid !== uidFijo && !disabled && (
                <button
                  type="button"
                  onClick={() => onChange(seleccionados.filter((s) => s.uid !== p.uid))}
                  className="rounded-full p-0.5 hover:bg-muted-foreground/20"
                  aria-label={`Quitar a ${p.nombre}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo..."
          className="pl-8"
          disabled={disabled}
        />
      </div>

      <ScrollArea className="h-48 rounded-md border">
        <div className="p-1">
          {filtrados.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">
              No hay usuarios que coincidan.
            </p>
          )}
          {filtrados.map((usuario) => {
            const marcado = seleccionadosPorUid.has(usuario.uid);
            const esFijo = usuario.uid === uidFijo;
            return (
              <button
                key={usuario.uid}
                type="button"
                onClick={() => alternar(usuario)}
                disabled={disabled || esFijo}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm",
                  "hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60",
                  marcado && "bg-accent/50"
                )}
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    marcado ? "border-primary bg-primary text-primary-foreground" : "border-input"
                  )}
                >
                  {marcado && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {usuario.nombre || usuario.email}
                    {esFijo && (
                      <span className="ml-1 text-xs font-normal text-muted-foreground">
                        (organizador)
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {usuario.email}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </ScrollArea>

      {sinCorreo.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600">
          <Mail className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Sin correo registrado ({sinCorreo.map((p) => p.nombre).join(", ")}): no
            recibiran la invitacion por correo.
          </span>
        </p>
      )}
      {sinTelefono.length > 0 && (
        <p className="flex items-start gap-1.5 text-xs text-amber-600">
          <Phone className="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            Sin telefono valido ({sinTelefono.map((p) => p.nombre).join(", ")}): no
            recibiran avisos por WhatsApp.
          </span>
        </p>
      )}
    </div>
  );
}
