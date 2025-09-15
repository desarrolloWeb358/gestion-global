// src/modules/clientes/components/ClienteInfoCard.tsx
import * as React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";

interface Props {
  cliente: Cliente;
  ejecutivos: UsuarioSistema[];   // usuarios con rol de ejecutivo
  usuarios: UsuarioSistema[];     // lista opcional pasada desde arriba
}

export function ClienteInfoCard({ cliente, ejecutivos, usuarios }: Props) {
  // Ejecutivos por uid guardado en cliente
  const ejecutivoPre =
    ejecutivos.find((e) => e.uid === cliente.ejecutivoPrejuridicoId) ?? null;
  const ejecutivoJur =
    ejecutivos.find((e) => e.uid === cliente.ejecutivoJuridicoId) ?? null;

  // uid del dueño del cliente: usa usuarioUid si existe; si no, el id del doc cliente
  const uidCliente = (cliente as any).usuarioUid ?? cliente.id;

  // 1) buscar en la lista que viene por props
  const usuarioEnLista =
    usuarios.find((u) => u.uid === uidCliente) ?? null;

  // 2) fallback: si no viene en props, lo cargo directo de Firestore
  const [usuarioFetch, setUsuarioFetch] = React.useState<UsuarioSistema | null>(null);
  const [cargandoUsuario, setCargandoUsuario] = React.useState(false);

  React.useEffect(() => {
    let cancel = false;
    if (!uidCliente) return;

    if (!usuarioEnLista) {
      setCargandoUsuario(true);
      getUsuarioByUid(uidCliente)
        .then((u) => {
          if (!cancel) setUsuarioFetch(u);
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

  const show = (v?: string | null) => (v ? v : "—");
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
        <div><strong>Nombre:</strong> {show(cliente.nombre)}</div>

        <div>
          <strong>Correo:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : show(usuarioCliente?.email)}
        </div>

        <div>
          <strong>Teléfono:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : show(usuarioCliente?.telefonoUsuario)}
        </div>

        <div><strong>Dirección:</strong> {show(cliente.direccion)}</div>

        <div>
          <strong>Documento:</strong>{" "}
          {cargandoUsuario ? "Cargando…" : docString}
        </div>

        <div>
          <strong>Ejecutivo Prejurídico:</strong>{" "}
          {show(ejecutivoPre?.nombre ?? ejecutivoPre?.email)}
        </div>

        <div>
          <strong>Ejecutivo Jurídico:</strong>{" "}
          {show(ejecutivoJur?.nombre ?? ejecutivoJur?.email)}
        </div>

        <div><strong>Banco:</strong> {show(cliente.banco)}</div>
        <div><strong>N° Cuenta:</strong> {show(cliente.numeroCuenta)}</div>
        <div><strong>Tipo de Cuenta:</strong> {show(cliente.tipoCuenta)}</div>
      </CardContent>
    </Card>
  );
}

export default ClienteInfoCard;
