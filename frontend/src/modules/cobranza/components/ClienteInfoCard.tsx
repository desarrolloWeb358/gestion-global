import { Card, CardHeader, CardTitle, CardContent } from "@/shared/ui/card";
import { Cliente } from "../models/cliente.model";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { useNavigate } from "react-router-dom";

interface Props {
  cliente: Cliente;
  ejecutivos: UsuarioSistema[];
  usuarios: UsuarioSistema[]; // lista de usuarios del sistema para hidratar datos del cliente
}

export function ClienteInfoCard({ cliente, ejecutivos, usuarios }: Props) {
  const navigate = useNavigate();

  // Busca ejecutivos por uid guardado en el cliente
  const ejecutivoPre = ejecutivos.find((e) => e.uid === cliente.ejecutivoPrejuridicoId);
  const ejecutivoJur = ejecutivos.find((e) => e.uid === cliente.ejecutivoJuridicoId);

  // Busca el usuario “dueño” del cliente. 
  // Si guardaste usuarioUid en Cliente, úsalo; si no, usa id (cuando el doc clientes tiene el mismo id del usuario).
  const uidCliente = (cliente as any).usuarioUid ?? cliente.id;
  const usuarioCliente = usuarios.find((u) => u.uid === uidCliente);

  // Helper bonito para mostrar vacío
  const show = (v?: string | null) => (v ? v : "—");

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-lg">Información del Cliente</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <div><strong>Nombre:</strong> {show(cliente.nombre)}</div>
        <div><strong>Correo:</strong> {show(usuarioCliente?.email)}</div>
        <div><strong>Teléfono:</strong> {show(usuarioCliente?.telefonoUsuario)}</div>
        <div><strong>Dirección:</strong> {show(cliente.direccion)}</div>
        <div>
          <strong>Documento:</strong>{" "}
          {usuarioCliente?.tipoDocumento && usuarioCliente?.numeroDocumento
            ? `${usuarioCliente.tipoDocumento} ${usuarioCliente.numeroDocumento}`
            : "—"}
        </div>
        <div><strong>Ejecutivo Prejurídico:</strong> {show(ejecutivoPre?.nombre ?? ejecutivoPre?.email)}</div>
        <div><strong>Ejecutivo Jurídico:</strong> {show(ejecutivoJur?.nombre ?? ejecutivoJur?.email)}</div>
        <div><strong>Banco:</strong> {show(cliente.banco)}</div>
        <div><strong>N° Cuenta:</strong> {show(cliente.numeroCuenta)}</div>
        <div><strong>Tipo de Cuenta:</strong> {show(cliente.tipoCuenta)}</div>
      </CardContent>
    </Card>
  );
}
