// src/modules/clientes/components/ClienteInfoCard.tsx
import * as React from "react";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";
import { Typography } from "@/shared/design-system/components/Typography";

interface Props {
  cliente: Cliente;
  ejecutivos?: UsuarioSistema[];
  usuarios?: UsuarioSistema[];
  totalDeudores?: number;
}

export function ClienteInfoCard({ cliente, ejecutivos = [], usuarios = [], totalDeudores = 0 }: Props) {
  // Normaliza IDs: si vienen como "", null o solo espacios => null
  const ejecutivoPreId =
    typeof cliente.ejecutivoPrejuridicoId === "string" &&
      cliente.ejecutivoPrejuridicoId.trim() !== ""
      ? cliente.ejecutivoPrejuridicoId.trim()
      : null;

  const ejecutivoJurId =
    typeof cliente.ejecutivoJuridicoId === "string" &&
      cliente.ejecutivoJuridicoId.trim() !== ""
      ? cliente.ejecutivoJuridicoId.trim()
      : null;

  const dependienteId =
    typeof cliente.ejecutivoDependienteId === "string" &&
      cliente.ejecutivoDependienteId.trim() !== ""
      ? cliente.ejecutivoDependienteId.trim()
      : null;

  const abogadoId =
    typeof cliente.abogadoId === "string" && cliente.abogadoId.trim() !== ""
      ? cliente.abogadoId.trim()
      : null;

  // Ahora sí buscamos SOLO si hay id válido
  const ejecutivoPre =
    ejecutivoPreId !== null
      ? ejecutivos.find((e) => e.uid === ejecutivoPreId) ?? null
      : null;

  const ejecutivoJur =
    ejecutivoJurId !== null
      ? ejecutivos.find((e) => e.uid === ejecutivoJurId) ?? null
      : null;

  const dependiente =
    dependienteId !== null
      ? usuarios.find((u) => u.uid === dependienteId) ?? null
      : null;

  const abogado =
    abogadoId !== null
      ? usuarios.find((u) => u.uid === abogadoId) ?? null
      : null;

  const uidCliente = (cliente as any).usuarioUid ?? cliente.id ?? null;

  const usuarioEnLista = uidCliente
    ? usuarios.find((u) => u.uid === uidCliente) ?? null
    : null;

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
      setUsuarioFetch(null);
      setCargandoUsuario(false);
    }

    return () => {
      cancel = true;
    };
  }, [uidCliente, usuarioEnLista]);

  const usuarioCliente = usuarioEnLista ?? usuarioFetch;

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

  const getNombreUsuario = (usuario: UsuarioSistema | null) => {
    if (!usuario) return "No asignado";
    return usuario.nombre ?? (usuario as any)?.displayName ?? usuario.email ?? "No tiene";
  };

  return (
    <div className="space-y-6">
      {/* Información básica */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div>
          <div className="text-sm text-gray-600 mb-1">Nombre</div>
          <div className="text-base font-semibold text-gray-900">
            {cargandoUsuario ? "Cargando…" : nombreCliente}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Correo</div>
          <div className="text-base text-gray-900">
            {cargandoUsuario ? "Cargando…" : show(usuarioCliente?.email)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Administrador</div>
          <div className="text-base text-gray-900">
            {cargandoUsuario ? "Cargando…" : show(cliente.administrador)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Teléfono</div>
          <div className="text-base text-gray-900">
            {cargandoUsuario ? "Cargando…" : show(telefonoCliente)}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Dirección</div>
          <div className="text-base text-gray-900">{show(cliente.direccion)}</div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Documento</div>
          <div className="text-base text-gray-900">
            {cargandoUsuario ? "Cargando…" : docString}
          </div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Banco</div>
          <div className="text-base text-gray-900">{show(cliente.banco)}</div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">N° Cuenta</div>
          <div className="text-base text-gray-900">{show(cliente.numeroCuenta)}</div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Tipo de Cuenta</div>
          <div className="text-base text-gray-900">{show(cliente.tipoCuenta)}</div>
        </div>

        <div>
          <div className="text-sm text-gray-600 mb-1">Total Deudores Activos</div>
          <div className="text-2xl font-bold text-blue-600">{totalDeudores}</div>
        </div>
      </div>

      {/* Separador */}
      <div className="border-t border-gray-200" />

      {/* Equipo Asignado */}
      <div>
        <Typography variant="h3" className="!text-gray-900 font-semibold mb-4">
          Equipo Asignado
        </Typography>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-sm text-gray-600 mb-1">Ejecutivo Prejurídico</div>
            <div className="text-base font-semibold text-gray-900">
              {getNombreUsuario(ejecutivoPre)}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-sm text-gray-600 mb-1">Ejecutivo Jurídico</div>
            <div className="text-base font-semibold text-gray-900">
              {getNombreUsuario(ejecutivoJur)}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-sm text-gray-600 mb-1">Dependiente</div>
            <div className="text-base font-semibold text-gray-900">
              {getNombreUsuario(dependiente)}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-sm text-gray-600 mb-1">Abogado</div>
            <div className="text-base font-semibold text-gray-900">
              {getNombreUsuario(abogado)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClienteInfoCard;