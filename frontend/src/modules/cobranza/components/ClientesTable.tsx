import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "../../../components/ui/table";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";

import { Cliente } from "../models/cliente.model";
import {
  obtenerClientes,
  crearCliente,
  actualizarCliente,
  eliminarCliente,
} from "../services/clienteService";
import { UsuarioSistema } from "../../usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "../../usuarios/services/usuarioService";

export default function ClientesCrud() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);


  const fetchClientes = async () => {
    setLoading(true);
    const data = await obtenerClientes();
    setClientes(data);
    setLoading(false);
  };

  const fetchEjecutivos = async () => {
    const todos = await obtenerUsuarios();
    setEjecutivos(todos.filter((u) => u.roles.includes("ejecutivo")));
  };

  useEffect(() => {
    fetchClientes();
    fetchEjecutivos();
  }, []);

  const abrirCrear = () => {
    setClienteEditando(null);
    setMostrarDialogo(true);
  };

  const abrirEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setMostrarDialogo(true);
  };

  const cerrarDialogo = () => {
    setClienteEditando(null);
    setMostrarDialogo(false);
  };

  const handleEliminar = async (id: string) => {
    await eliminarCliente(id);
    fetchClientes();
  };



  return (
     <div className="space-y-4">
    <div className="flex justify-between items-center">
      <h2 className="text-xl font-semibold">Clientes</h2>
      <Button onClick={abrirCrear}>Crear cliente</Button>
    </div>

    {loading ? (
      <div className="py-12 text-center text-muted-foreground">Cargando clientes...</div>
    ) : (

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Correo</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Dirección</TableHead>
            <TableHead>Banco</TableHead>
            <TableHead>N° Cuenta</TableHead>
            <TableHead>Tipo Cuenta</TableHead>
            <TableHead className="text-center">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow key={cliente.id}>
              <TableCell>{cliente.nombre}</TableCell>
              <TableCell>{cliente.correo}</TableCell>
              <TableCell>{cliente.telefono}</TableCell>
              <TableCell>{cliente.direccion}</TableCell>
              <TableCell>{cliente.ejecutivoId}</TableCell>
              <TableCell>{cliente.banco}</TableCell>
              <TableCell>{cliente.numeroCuenta}</TableCell>
              <TableCell>{cliente.tipoCuenta}</TableCell>
              <TableCell>
                <div className="flex justify-center gap-2">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => navigate(`/deudores/${cliente.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Ver</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => abrirEditar(cliente)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Editar</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-red-600" onClick={() => handleEliminar(cliente.id!)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Eliminar</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

         )}

      <Dialog open={mostrarDialogo} onOpenChange={setMostrarDialogo}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>{clienteEditando ? "Editar cliente" : "Crear cliente"}</DialogTitle>
          </DialogHeader>

          <form
            className="grid gap-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const tipoRaw = formData.get("tipo");
              if (tipoRaw !== "natural" && tipoRaw !== "jurídica") {
                throw new Error("Tipo inválido");
              }
              const tipo = tipoRaw as "natural" | "jurídica";
              const tipoCuentaRaw = formData.get("tipoCuenta");
              if (tipoCuentaRaw !== "ahorros" && tipoCuentaRaw !== "corriente" && tipoCuentaRaw !== "convenio") {
                alert("Tipo de cuenta inválido");
                return;
              }
              const tipoCuenta = tipoCuentaRaw as "ahorros" | "corriente" | "convenio";

              const nuevo: Cliente = {
                id: clienteEditando?.id,
                nombre: formData.get("nombre") as string,
                correo: formData.get("correo") as string,
                telefono: formData.get("telefono") as string,
                direccion: formData.get("direccion") as string,
                ejecutivoId: formData.get(" ejecutivoId") as string,
                banco: formData.get("banco") as string,
                numeroCuenta: formData.get("numeroCuenta") as string,
                tipoCuenta, // ✅ tipo seguro
              };

              if (clienteEditando) {
                await actualizarCliente(nuevo);
              } else {
                await crearCliente(nuevo);
              }

              cerrarDialogo();
              fetchClientes();
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input name="nombre" defaultValue={clienteEditando?.nombre} required />
              </div>
              <div>
                <Label>Correo</Label>
                <Input name="correo" defaultValue={clienteEditando?.correo} required />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input name="telefono" defaultValue={clienteEditando?.telefono} />
              </div>
              <div>
                <Label>Dirección</Label>
                <Input name="direccion" defaultValue={clienteEditando?.direccion} />
              </div>
              <div>
                <Label>Ejecutivo</Label>
                <Select name="ejecutivoId" defaultValue={clienteEditando?.ejecutivoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.email} value={e.email}>
                        {e.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Banco</Label>
                <Input name="banco" defaultValue={clienteEditando?.banco} />
              </div>
              <div>
                <Label>Número de cuenta</Label>
                <Input name="numeroCuenta" defaultValue={clienteEditando?.numeroCuenta} />
              </div>
              <div>
                <Label>Tipo de cuenta</Label>
                <Select name="tipoCuenta" defaultValue={clienteEditando?.tipoCuenta}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorros">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                    <SelectItem value="convenio">Convenio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button type="submit">Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
