// src/modules/clientes/components/ClienteInfoSummaryCard.tsx
import { Cliente } from "@/modules/clientes/models/cliente.model";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

export function ClienteInfoSummaryCard({
  cliente,
  usuarioCliente,
}: {
  cliente: Cliente;
  usuarioCliente?: UsuarioSistema | null;
}) {
  const F = (v?: string | number | null) => (v ?? "—");

  return (
    <div className="rounded-2xl border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
        <p><span className="font-semibold">Correo:</span> {F(usuarioCliente?.email)}</p>
        <p><span className="font-semibold">Teléfono:</span> {F(usuarioCliente?.telefonoUsuario)}</p>
        <p><span className="font-semibold">Dirección:</span> {F(cliente.direccion)}</p>
        <p><span className="font-semibold">N° Cuenta:</span> {F(cliente.numeroCuenta)}</p>
        <p><span className="font-semibold">Tipo de Cuenta:</span> {F(cliente.tipoCuenta)}</p>
        <p>
          <span className="font-semibold">Documento:</span>{" "}
          {usuarioCliente?.tipoDocumento && usuarioCliente?.numeroDocumento
            ? `${usuarioCliente.tipoDocumento} ${usuarioCliente.numeroDocumento}`
            : "—"}
        </p>
      </div>
    </div>
  );
}
