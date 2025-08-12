import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Cliente } from "../models/cliente.model";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

interface Props {
  cliente: Cliente;
  ejecutivos: UsuarioSistema[];
}

export function ClienteInfoCard({ cliente, ejecutivos }: Props) {
  const navigate = useNavigate();

  const ejecutivoPre = ejecutivos.find(e => e.uid === cliente.ejecutivoPrejuridicoId);
  const ejecutivoJur = ejecutivos.find(e => e.uid === cliente.ejecutivoJuridicoId);

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="text-lg">Información del Cliente</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4 text-sm">
        <div><strong>Nombre:</strong> {cliente.nombre}</div>
        <div><strong>Correo:</strong> {cliente.email}</div>
        <div><strong>Teléfono:</strong> {cliente.telefonoUsuario}</div>
        <div><strong>Dirección:</strong> {cliente.direccion}</div>
        <div><strong>Documento:</strong> {cliente.tipoDocumento} {cliente.numeroDocumento}</div>
        <div><strong>Ejecutivo Prejurídico:</strong> {ejecutivoPre?.nombre ?? "No asignado"}</div>
        <div><strong>Ejecutivo Jurídico:</strong> {ejecutivoJur?.nombre ?? "No asignado"}</div>
        <div><strong>Banco:</strong> {cliente.banco}</div>
        <div><strong>N° Cuenta:</strong> {cliente.numeroCuenta}</div>
        <div><strong>Tipo de Cuenta:</strong> {cliente.tipoCuenta}</div>
      </CardContent>
    </Card>
  );
}
