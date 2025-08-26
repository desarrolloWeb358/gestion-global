import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2, User } from "lucide-react";

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

  // Selects controlados para el formulario
  const [tipoCuentaSel, setTipoCuentaSel] = useState<"" | "ahorros" | "corriente" | "convenio">("");
  const [ejecutivoPreSel, setEjecutivoPreSel] = useState<string>("");
  const [ejecutivoJurSel, setEjecutivoJurSel] = useState<string>("");
  const [activoSel, setActivoSel] = useState<boolean>(true);

  const fetchClientes = async () => {
    setLoading(true);
    const data = await obtenerClientes();
    setClientes(data);
    setLoading(false);
  };

  const fetchEjecutivos = async () => {
    const todos = await obtenerUsuarios();
    const ejecutivosFiltrados = todos.filter(
      (u) => Array.isArray(u.roles) && u.roles.includes("ejecutivo")
    );
    setEjecutivos(ejecutivosFiltrados);
  };

  useEffect(() => {
    fetchClientes();
    fetchEjecutivos();
  }, []);

  const abrirEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setTipoCuentaSel((cliente.tipoCuenta as any) ?? "");
    setEjecutivoPreSel(cliente.ejecutivoPrejuridicoId ?? "");
    setEjecutivoJurSel(cliente.ejecutivoJuridicoId ?? "");
    setActivoSel(cliente.activo ?? true);
    setMostrarDialogo(true);
  };

  const cerrarDialogo = () => {
    setClienteEditando(null);
    setMostrarDialogo(false);
  };

  return (
    <div className="space-y-4">
      {/* Encabezado sin botón de creación */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
        {/* (Se eliminó el botón "Crear cliente") */}
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Cargando clientes...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
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
                        <TooltipContent>Ver deudores</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => navigate(`/clientes/${cliente.id}`)}>
                            <User className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver cliente</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(cliente)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Dialogo solo para EDITAR */}
      <Dialog open={mostrarDialogo} onOpenChange={setMostrarDialogo}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Editar cliente</DialogTitle>
          </DialogHeader>

          <form
            className="grid gap-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!clienteEditando?.id) {
                // seguridad: no se permite crear desde aquí
                cerrarDialogo();
                return;
              }

              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);

              // Campos de Cliente
              const nombre = (formData.get("nombre") as string)?.trim();
              const direccion = (formData.get("direccion") as string)?.trim();
              const banco = (formData.get("banco") as string)?.trim();
              const numeroCuenta = (formData.get("numeroCuenta") as string)?.trim();

              // Selects controlados
              const tipoCuentaRaw = tipoCuentaSel; // "" | union
              const tipoCuenta =
                tipoCuentaRaw === "" ? undefined : (tipoCuentaRaw as "ahorros" | "corriente" | "convenio");
              const ejecutivoPrejuridicoId = ejecutivoPreSel || null;
              const ejecutivoJuridicoId = ejecutivoJurSel || null;
              const activo = activoSel;

              if (!nombre) {
                alert("El nombre es obligatorio.");
                return;
              }

              const payload: Partial<Cliente> = {
                nombre,
                direccion: direccion || "",
                banco: banco || "",
                numeroCuenta: numeroCuenta || "",
                ...(tipoCuenta ? { tipoCuenta } : {}), // evita guardar ""
                ejecutivoPrejuridicoId,
                ejecutivoJuridicoId,
                activo,
              };

              await actualizarCliente(clienteEditando.id, payload);
              cerrarDialogo();
              fetchClientes();
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              {/* Campos propios de Cliente */}
              <div><Label>Nombre</Label><Input name="nombre" defaultValue={clienteEditando?.nombre} required /></div>
              <div><Label>Dirección</Label><Input name="direccion" defaultValue={clienteEditando?.direccion} /></div>

              {/* Ejecutivos */}
              <div>
                <Label>Ejecutivo Prejurídico</Label>
                <Select value={ejecutivoPreSel} onValueChange={setEjecutivoPreSel}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>
                        {e.nombre ?? e.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ejecutivo Jurídico</Label>
                <Select value={ejecutivoJurSel} onValueChange={setEjecutivoJurSel}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>
                        {e.nombre ?? e.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Datos bancarios del Cliente */}
              <div><Label>Banco</Label><Input name="banco" defaultValue={clienteEditando?.banco} /></div>
              <div><Label>Número de cuenta</Label><Input name="numeroCuenta" defaultValue={clienteEditando?.numeroCuenta} /></div>

              <div>
                <Label>Tipo de cuenta</Label>
                <Select
                  value={tipoCuentaSel}
                  onValueChange={(value) => setTipoCuentaSel(value as "ahorros" | "corriente" | "convenio" | "")}
                >
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ahorros">Ahorros</SelectItem>
                    <SelectItem value="corriente">Corriente</SelectItem>
                    <SelectItem value="convenio">Convenio</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Activo</Label>
                <div className="flex items-center space-x-2 mt-2">
                  <input
                    type="checkbox"
                    checked={activoSel}
                    onChange={(e) => setActivoSel(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span>¿Activo?</span>
                </div>
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
