// src/modules/clientes/components/ClienteInfoCard.tsx
import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";

interface Props {
  cliente: Cliente;
  ejecutivos?: UsuarioSistema[];   // opcional
  usuarios?: UsuarioSistema[];     // lista opcional pasada desde arriba
}

export function ClienteInfoCard({ cliente, ejecutivos = [], usuarios = [] }: Props) {
  // Ejecutivos por uid guardado en cliente
  const ejecutivoPre =
    ejecutivos.find((e) => e.uid === cliente.ejecutivoPrejuridicoId) ?? null;
  const ejecutivoJur =
    ejecutivos.find((e) => e.uid === cliente.ejecutivoJuridicoId) ?? null;

  // uid del dueño del cliente: usa usuarioUid si existe; si no, el id del doc cliente
  const uidCliente = (cliente as any).usuarioUid ?? cliente.id ?? null;

  // 1) buscar en la lista que viene por props
  const usuarioEnLista = uidCliente
    ? usuarios.find((u) => u.uid === uidCliente) ?? null
    : null;

  // 2) fallback: si no viene en props, lo cargo directo de Firestore
  const [usuarioFetch, setUsuarioFetch] = React.useState<UsuarioSistema | null>(null);
  const [cargandoUsuario, setCargandoUsuario] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    if (!uidCliente) {
      setUsuarioFetch(null);
      setCargandoUsuario(false);
      return;
    }

    if (!usuarioEnLista) {
      setCargandoUsuario(true);
      getUsuarioByUid(uidCliente)
        .then((u) => {
          if (!cancel) setUsuarioFetch(u ?? null);
        })
        .finally(() => {
          if (!cancel) setCargandoUsuario(false);
        });
    } else {
      // si entra por props, limpia el fetch previo
      setUsuarioFetch(null);
      setCargandoUsuario(false);
    }

    return () => {
      cancel = true;
    };
  }, [uidCliente, usuarioEnLista]);

  const usuarioCliente = usuarioEnLista ?? usuarioFetch;

  // Helpers de display
  const show = (v?: string | null) => (v && String(v).trim() !== "" ? String(v) : "—");

  const nombreCliente =
    (usuarioCliente as any)?.nombre ??
    (usuarioCliente as any)?.displayName ??
    usuarioCliente?.email ??
    "—";

  const telefonoCliente =
    (usuarioCliente as any)?.telefono ??
    (usuarioCliente as any)?.telefonoUsuario ??
    null;

  const docString =
    usuarioCliente?.tipoDocumento && usuarioCliente?.numeroDocumento
      ? `${usuarioCliente.tipoDocumento} ${usuarioCliente.numeroDocumento}`
      : "—";

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-lg">Información del Cliente</CardTitle>
      </CardHeader>

      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        {/* Nombre viene de Usuarios (no editable aquí) */}
        <div>
          <strong>Nombre:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : nombreCliente}
        </div>

        <div>
          <strong>Correo:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : show(usuarioCliente?.email)}
        </div>

        <div>
          <strong>Teléfono:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : show(telefonoCliente)}
        </div>

        <div><strong>Dirección:</strong> {show(cliente.direccion)}</div>

        <div>
          <strong>Documento:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : docString}
        </div>

        <div>
          <strong>Ejecutivo Prejurídico:</strong>{" "}
          {show(ejecutivoPre?.nombre ?? (ejecutivoPre as any)?.displayName ?? ejecutivoPre?.email)}
        </div>

        <div>
          <strong>Ejecutivo Jurídico:</strong>{" "}
          {show(ejecutivoJur?.nombre ?? (ejecutivoJur as any)?.displayName ?? ejecutivoJur?.email)}
        </div>

        <div><strong>Banco:</strong> {show(cliente.banco)}</div>
        <div><strong>N° Cuenta:</strong> {show(cliente.numeroCuenta)}</div>
        <div><strong>Tipo de Cuenta:</strong> {show(cliente.tipoCuenta)}</div>
      </CardContent>
    </Card>
  );
}

export default ClienteInfoCard;
