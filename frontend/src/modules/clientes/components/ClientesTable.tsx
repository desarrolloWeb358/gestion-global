import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, User } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

import { Cliente } from "@/modules/clientes/models/cliente.model";
import {
  obtenerClientes,
  actualizarCliente,
} from "@/modules/clientes/services/clienteService";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";

export default function ClientesCrud() {
  const navigate = useNavigate();

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  // Todos los usuarios (para resolver nombre/teléfono/email del cliente vía usuarioUid)
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  // Solo ejecutivos para los selects de ejecutivos
  const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);

  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);

  // Selects controlados del formulario
  const [tipoCuentaSel, setTipoCuentaSel] = useState<"" | "ahorros" | "corriente" | "convenio">("");
  const [ejecutivoPreSel, setEjecutivoPreSel] = useState<string>("");
  const [ejecutivoJurSel, setEjecutivoJurSel] = useState<string>("");
 
  const [activoSel, setActivoSel] = useState<boolean>(true);

  // Mapa rápido de usuarios por uid
  const usuariosMap = useMemo(() => {
    const m: Record<string, UsuarioSistema> = {};
    for (const u of usuarios) if (u.uid) m[u.uid] = u;
    return m;
  }, [usuarios]);

  // Resolver de nombre robusto: usuarioUid → nombre | displayName | email
  function resolverNombreCliente(c: Cliente) {
    // 1) por usuarioUid
    let u;
    // 2) fallback: si el doc clientes usa el mismo id que el uid del usuario
    if (!u && c.id) u = usuariosMap[c.id];
    // 3) display final
    if (u) return (u as any).nombre ?? (u as any).displayName ?? u.email ?? "(Sin usuario)";
    return "(Sin usuario)";
  }

  const fetchClientes = async () => {
    setLoading(true);
    const data = await obtenerClientes();
    setClientes(data);
    setLoading(false);
  };

  const fetchUsuarios = async () => {
    const todos = await obtenerUsuarios();
    setUsuarios(todos);

    const execs = todos.filter((u) => Array.isArray(u.roles) && u.roles.includes("ejecutivo"));
    setEjecutivos(execs);
  };

  useEffect(() => {
    fetchClientes();
    fetchUsuarios();
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
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clientes</h2>
      </div>

      {loading ? (
        <div className="py-12 text-center text-muted-foreground">Cargando clientes...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clientes.map((cliente) => (
              <TableRow key={cliente.id}>
                <TableCell>
                  {resolverNombreCliente(cliente)}                  
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/deudores/${cliente.id}`)}
                            aria-label="Ver deudores"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver deudores</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => navigate(`/clientes/${cliente.id}`)}
                            aria-label="Ver cliente"
                          >
                            <User className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Ver cliente</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => abrirEditar(cliente)}
                            aria-label="Editar"
                          >
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

      {/* Diálogo de edición (sin campo 'nombre') */}
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
                cerrarDialogo();
                return;
              }

              const form = e.currentTarget as HTMLFormElement;
              const formData = new FormData(form);

              // Campos del cliente (sin nombre)
              const direccion = (formData.get("direccion") as string)?.trim();
              const banco = (formData.get("banco") as string)?.trim();
              const numeroCuenta = (formData.get("numeroCuenta") as string)?.trim();

              // Controlados
              const tipoCuenta =
                tipoCuentaSel === "" ? undefined : (tipoCuentaSel as "ahorros" | "corriente" | "convenio");
              const ejecutivoPrejuridicoId = ejecutivoPreSel || null;
              const ejecutivoJuridicoId = ejecutivoJurSel || null;
              const activo = activoSel;

              // Si quieres forzar que siempre haya usuario:
              // if (!usuarioUid) {
              //   alert("Debes asociar un Usuario al cliente.");
              //   return;
              // }

              const payload: Partial<Cliente> = {
                direccion: direccion || "",
                banco: banco || "",
                numeroCuenta: numeroCuenta || "",
                ...(tipoCuenta ? { tipoCuenta } : {}),
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
              {/* Nombre solo lectura (desde Usuarios) */}
              <div className="col-span-2">
                <Label>Nombre (desde Usuarios)</Label>
                <Input
                  value={clienteEditando ? resolverNombreCliente(clienteEditando) : ""}
                  readOnly
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Para editar el nombre, hazlo en el módulo <b>Usuarios</b>.
                </p>
              </div>


              {/* Ejecutivos */}
              <div>
                <Label>Ejecutivo Prejurídico</Label>
                <Select value={ejecutivoPreSel} onValueChange={setEjecutivoPreSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>
                        {e.nombre ?? (e as any).displayName ?? e.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Ejecutivo Jurídico</Label>
                <Select value={ejecutivoJurSel} onValueChange={setEjecutivoJurSel}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {ejecutivos.map((e) => (
                      <SelectItem key={e.uid} value={e.uid}>
                        {e.nombre ?? (e as any).displayName ?? e.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Datos bancarios */}
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
                <Select
                  value={tipoCuentaSel}
                  onValueChange={(v) => setTipoCuentaSel(v as "ahorros" | "corriente" | "convenio" | "")}
                >
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

              <div>
                <Label>Dirección</Label>
                <Input name="direccion" defaultValue={clienteEditando?.direccion} />
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
