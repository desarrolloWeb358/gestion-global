import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, Trash2, User } from "lucide-react";
import { createUserWithEmailAndPassword, getAuth } from "firebase/auth";
import { collection, getDocs, query, serverTimestamp, where } from "firebase/firestore";
import { db } from "../../../firebase";

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
import UsuariosCrud from "@/modules/usuarios/components/UsuariosTable";

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
    const ejecutivosFiltrados = todos.filter(
      (u) => Array.isArray(u.roles) && u.roles.includes("ejecutivo")
    );
    setEjecutivos(ejecutivosFiltrados);
  };

  const existeClienteConDocumento = async (numeroDocumento: string) => {
    const ref = collection(db, "clientes");
    const q = query(ref, where("numeroDocumento", "==", numeroDocumento));
    const snapshot = await getDocs(q);
    return !snapshot.empty;
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
                <TableCell>{cliente.email}</TableCell>
                <TableCell>{cliente.telefonoUsuario}</TableCell>
        
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
              const tipoCuentaRaw = formData.get("tipoCuenta");
              const tipoDocumento = formData.get("tipoDocumento") as "CC" | "CE" | "TI" | "NIT";
              const numeroDocumento = formData.get("numeroDocumento") as string;
              const activo = formData.get("activo") === "on";

              if (!tipoDocumento || !numeroDocumento) {
                alert("Tipo y número de documento son obligatorios.");
                return;
              }

              if (
                tipoCuentaRaw !== "ahorros" &&
                tipoCuentaRaw !== "corriente" &&
                tipoCuentaRaw !== "convenio"
              ) {
                alert("Tipo de cuenta inválido");
                return;
              }

              const tipoCuenta = tipoCuentaRaw as "ahorros" | "corriente" | "convenio";
              let nuevo: Cliente;

              if (clienteEditando) {
                nuevo = {
                  ...clienteEditando,
                  nombre: formData.get("nombre") as string,
                  email: formData.get("correo") as string,
                  telefonoUsuario: formData.get("telefono") as string,
                  direccion: formData.get("direccion") as string,
                  ejecutivoPrejuridicoId: formData.get("ejecutivoId") as string,
                  ejecutivoJuridicoId: formData.get("ejecutivoId") as string,
                  banco: formData.get("banco") as string,
                  numeroCuenta: formData.get("numeroCuenta") as string,
                  tipoCuenta,
                  tipoDocumento,
                  numeroDocumento,
                  activo,
                };
              } else {
                const email = formData.get("correo") as string;
                const password = "123456";

                const yaExiste = await existeClienteConDocumento(numeroDocumento);
                if (yaExiste) {
                  alert("Ya existe un cliente con ese número de documento.");
                  return;
                }

                const auth = getAuth();
                let userCredential;
                try {
                  userCredential = await createUserWithEmailAndPassword(auth, email, password);
                } catch (error: any) {
                  alert("Error creando usuario: " + error.message);
                  return;
                }

                const uid = userCredential.user.uid;

                nuevo = {
                  uid,
                  email,
                  nombre: formData.get("nombre") as string,
                  telefonoUsuario: formData.get("telefono") as string,
                  direccion: formData.get("direccion") as string,
                  ejecutivoPrejuridicoId: formData.get("ejecutivoId") as string,
                  ejecutivoJuridicoId: formData.get("ejecutivoId") as string,
                  banco: formData.get("banco") as string,
                  numeroCuenta: formData.get("numeroCuenta") as string,
                  tipoCuenta,
                  tipoDocumento,
                  numeroDocumento,
                  activo,
                  roles: ["cliente"],
                  fecha_registro: serverTimestamp(),
                };
              }

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
              <div><Label>Nombre</Label><Input name="nombre" defaultValue={clienteEditando?.nombre} required /></div>
              <div><Label>Correo</Label><Input name="correo" defaultValue={clienteEditando?.email} required /></div>
              <div><Label>Teléfono</Label><Input name="telefono" defaultValue={clienteEditando?.telefonoUsuario} /></div>
              <div>
                <Label>Tipo de documento</Label>
                <Select name="tipoDocumento" defaultValue={clienteEditando?.tipoDocumento}>
                  <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC">Cédula de ciudadanía</SelectItem>
                    <SelectItem value="CE">Cédula de extranjería</SelectItem>
                    <SelectItem value="TI">Tarjeta de identidad</SelectItem>
                    <SelectItem value="NIT">NIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Número de documento</Label><Input name="numeroDocumento" defaultValue={clienteEditando?.numeroDocumento} required /></div>
              <div><Label>Dirección</Label><Input name="direccion" defaultValue={clienteEditando?.direccion} /></div>
              <div>
                <Label>Ejecutivo</Label>
                <Select name="ejecutivoId" defaultValue={clienteEditando?.ejecutivoPrejuridicoId ?? clienteEditando?.ejecutivoJuridicoId}>
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
              <div><Label>Banco</Label><Input name="banco" defaultValue={clienteEditando?.banco} /></div>
              <div><Label>Número de cuenta</Label><Input name="numeroCuenta" defaultValue={clienteEditando?.numeroCuenta} /></div>
              <div>
                <Label>Tipo de cuenta</Label>
                <Select name="tipoCuenta" defaultValue={clienteEditando?.tipoCuenta}>
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
                  <input type="checkbox" name="activo" defaultChecked={clienteEditando?.activo ?? true} className="w-4 h-4" />
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
