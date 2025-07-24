import { useEffect, useState } from "react";
import { Check, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { Timestamp } from "firebase/firestore";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "../../../components/ui/table";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../../../components/ui/select";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "../../../components/ui/tooltip";
import { Switch } from "../../../components/ui/switch";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../../../components/ui/popover";
import { Calendar } from "../../../components/ui/calendar";

import { UsuarioSistema } from "../models/usuarioSistema.model";
import {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from "../services/usuarioService";
import { cn } from "@/lib/utils";

export default function UsuariosCrud() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioSistema | null>(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [password, setPassword] = useState("");
  const [fecha, setFecha] = useState<Date | undefined>();
  const [rolesSeleccionados, setRolesSeleccionados] = useState<string[]>([]);
  const rolesDisponibles = ["admin", "ejecutivo", "abogado", "cliente", "deudor"] as UsuarioSistema["roles"];

  function MultiSelectRoles({
                selectedRoles,
                setSelectedRoles,
              }: {
                selectedRoles: string[];
                setSelectedRoles: (roles: string[]) => void;
              }) {
                const toggleRole = (rol: string) => {
                  if (selectedRoles.includes(rol)) {
                    setSelectedRoles(selectedRoles.filter((r) => r !== rol));
                  } else {
                    setSelectedRoles([...selectedRoles, rol]);
                  }
                };
                return (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-between">
                        {selectedRoles.length > 0
                          ? selectedRoles.join(", ")
                          : "Selecciona roles"}
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-60 p-2 space-y-1">
                      {rolesDisponibles.map((rol) => (
                        <button
                          key={rol}
                          type="button"
                          onClick={() => toggleRole(rol)}
                          className={cn(
                            "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-muted",
                            selectedRoles.includes(rol) && "bg-muted"
                          )}
                        >
                          <span className="capitalize">{rol}</span>
                          {selectedRoles.includes(rol) && <Check className="w-4 h-4" />}
                        </button>
                      ))}
                    </PopoverContent>
                  </Popover>
                );
              }


  const fetchUsuarios = async () => {
    setLoading(true);
    const data = await obtenerUsuarios();
    setUsuarios(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const abrirCrear = () => {
    setUsuarioEditando(null);
    setPassword("");
    setFecha(undefined);
    setRolesSeleccionados([]);
    setMostrarDialogo(true);
  };

  const abrirEditar = (usuario: UsuarioSistema) => {
    setUsuarioEditando(usuario);
    setPassword("");
    setFecha(usuario.fecha_registro instanceof Timestamp ? usuario.fecha_registro.toDate() : undefined);
    setRolesSeleccionados(usuario.roles || []);
    setMostrarDialogo(true);
  };
  const cerrarDialogo = () => {
    setUsuarioEditando(null);
    setPassword("");
    setMostrarDialogo(false);
  };

  const handleEliminar = async (uid: string) => {
    await eliminarUsuario(uid);
    fetchUsuarios();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <Button onClick={abrirCrear}>Crear Usuario</Button>
      </div>

      {loading ? (
        <p className="text-center py-6 text-muted-foreground">Cargando usuarios...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Rol</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Fecha de registro</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {usuarios.map((usuario) => (
              <TableRow key={usuario.uid}>
                <TableCell>{usuario.email}</TableCell>
                <TableCell>{usuario.nombre}</TableCell>
                <TableCell>{usuario.roles}</TableCell>
                <TableCell>
                  <Switch checked={usuario.activo}
                    onCheckedChange={async (checked) => {
                      const actualizado = { ...usuario, activo: checked };
                      await actualizarUsuario(actualizado);
                      setUsuarios((prev) =>
                        prev.map((u) => (u.uid === actualizado.uid ? actualizado : u))
                      );
                    }} />
                </TableCell>
                <TableCell>
                  {usuario.fecha_registro instanceof Timestamp
                    ? (() => {
                      const d = usuario.fecha_registro.toDate();
                      const dia = String(d.getDate()).padStart(2, "0");
                      const mes = String(d.getMonth() + 1).padStart(2, "0");
                      const anio = d.getFullYear();
                      return `${dia}/${mes}/${anio}`;
                    })()
                    : ""}
                </TableCell>
                <TableCell>
                  <div className="flex justify-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" onClick={() => abrirEditar(usuario)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-red-600"
                            onClick={() => handleEliminar(usuario.uid)}
                          >
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
            <DialogTitle>{usuarioEditando ? "Editar Usuario" : "Crear Usuario"}</DialogTitle>
          </DialogHeader>

          <form
            className="grid gap-4 py-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as HTMLFormElement;
              const formData = new FormData(form);
              const fecha_registro = fecha ? Timestamp.fromDate(fecha) : Timestamp.now();

              const activo = (form.elements.namedItem("activo") as HTMLInputElement)?.checked;
              const rolesDisponibles = ["admin", "ejecutivo", "abogado", "cliente", "deudor"] as UsuarioSistema["roles"];
              

              const nuevo: UsuarioSistema = {
                uid: usuarioEditando?.uid || "",
                email: formData.get("email") as string,
                nombre: formData.get("nombre") as string,
                roles: rolesSeleccionados as UsuarioSistema["roles"],
                activo, // ✅ valor booleano del switch
                fecha_registro,
              };

              if (usuarioEditando) {
                await actualizarUsuario(nuevo);
                setUsuarios((prev) =>
                  prev.map((u) => (u.uid === nuevo.uid ? nuevo : u))
                );
              } else {
                if (!password) {
                  alert("La contraseña es obligatoria");
                  return;
                }
                await crearUsuario({ ...nuevo, password });
                setUsuarios((prev) => [...prev, { ...nuevo, uid: nuevo.uid || crypto.randomUUID() }]);
              }

              cerrarDialogo();
            }
            }
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Email</Label>
                <Input name="email" defaultValue={usuarioEditando?.email} required />
              </div>
              <div>
                <Label>Nombre</Label>
                <Input name="nombre" defaultValue={usuarioEditando?.nombre} />
              </div>
              <div className="col-span-2">
                <Label>Roles</Label>
                <MultiSelectRoles
                  selectedRoles={rolesSeleccionados}
                  setSelectedRoles={setRolesSeleccionados}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  name="activo"
                  id="activo"
                  defaultChecked={usuarioEditando?.activo ?? true}
                />
                <Label htmlFor="activo">Activo</Label>
              </div>
              <div className="col-span-2">
                <Label>Fecha de Registro</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fecha ? fecha.toLocaleDateString("es-CO") : "Selecciona una fecha"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={fecha}
                      onSelect={setFecha}
                      autoFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {!usuarioEditando && (
                <div className="col-span-2">
                  <Label>Contraseña</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              )}
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
