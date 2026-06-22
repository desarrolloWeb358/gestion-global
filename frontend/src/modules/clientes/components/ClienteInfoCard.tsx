// src/modules/clientes/components/ClienteInfoCard.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { ScrollText, Download } from "lucide-react";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import type { Contrato } from "@/modules/contratos/models/contrato.model";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";
import { Typography } from "@/shared/design-system/components/Typography";

interface Props {
  cliente: Cliente;
  ejecutivos?: UsuarioSistema[];
  usuarios?: UsuarioSistema[];
  totalDeudores?: number;
  ultimoContrato?: Contrato | null;
  canViewContratos?: boolean;
}

export function ClienteInfoCard({ cliente, ejecutivos = [], usuarios = [], totalDeudores = 0, ultimoContrato, canViewContratos = false }: Props) {
  const navigate = useNavigate();
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

  const dependienteAbogadoId =
    typeof cliente.dependienteAbogadoId === "string" && cliente.dependienteAbogadoId.trim() !== ""
      ? cliente.dependienteAbogadoId.trim()
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

  const dependienteAbogado =
    dependienteAbogadoId !== null
      ? usuarios.find((u) => u.uid === dependienteAbogadoId) ?? null
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
          <div className="text-sm text-gray-600 mb-1">Total Deudores Activos</div>
          <div className="text-2xl font-bold text-blue-600">{totalDeudores}</div>
        </div>

        <div className="md:col-span-2 lg:col-span-2">
          <div className="text-sm text-gray-600 mb-1">Forma de pago</div>
          <div className="text-base text-gray-900 break-words whitespace-pre-line">
            {show(cliente.formaPago)}
          </div>
        </div>




      </div>

      {/* Último contrato — debajo de Forma de pago */}
      {canViewContratos && ultimoContrato && (
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-2 min-w-0">
            <ScrollText className="h-4 w-4 text-indigo-600 shrink-0" />
            <div className="min-w-0">
              <span className="text-sm text-gray-500">Último contrato · </span>
              <span className="text-sm font-semibold text-gray-800 truncate">
                {ultimoContrato.titulo}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {ultimoContrato.archivos.length > 0 ? (
              ultimoContrato.archivos.map((a, i) => (
                <a
                  key={i}
                  href={a.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1 text-sm text-indigo-700 hover:bg-indigo-100 transition-colors max-w-[180px]"
                >
                  <Download className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{a.nombre}</span>
                </a>
              ))
            ) : (
              <button
                onClick={() => navigate(`/clientes/${cliente.id}/contratos`)}
                className="text-sm text-indigo-600 hover:underline"
              >
                Ver contrato
              </button>
            )}
          </div>
        </div>
      )}

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

          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="text-sm text-gray-600 mb-1">Dependiente Abogado</div>
            <div className="text-base font-semibold text-gray-900">
              {getNombreUsuario(dependienteAbogado)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ClienteInfoCard;