import { useEffect, useState, useMemo } from "react";
import { Check, ChevronDown, Pencil } from "lucide-react";
import { Timestamp } from "firebase/firestore";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from "@/shared/ui/tooltip";
import { Switch } from "@/shared/ui/switch";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";

import { UsuarioSistema } from "../models/usuarioSistema.model";
import {
  obtenerUsuarios,
  crearUsuario,
  actualizarUsuario,
  eliminarUsuario,
} from "../services/usuarioService";
import { cn } from "@/shared/lib/cn";
import { Rol, ROLES } from "@/shared/constants/acl";

// Sentinelas para selects (evitar value="")
const ALL = "__ALL__";
const ALL_BOOL = "__ALL_BOOL__";

export default function UsuariosCrud() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState(true);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioSistema | null>(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [password, setPassword] = useState("");
  const [fecha, setFecha] = useState<Date | undefined>();
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Rol[]>([]);
  const rolesDisponibles = ROLES;

  // ====== FILTROS ======
  const [q, setQ] = useState("");                 // búsqueda en nombre/email
  const [rolFilter, setRolFilter] = useState<string>(ALL); // Todos o un rol
  const [activoFilter, setActivoFilter] = useState<string>(ALL_BOOL); // Todos/Sí/No
  const [desde, setDesde] = useState<Date | undefined>();
  const [hasta, setHasta] = useState<Date | undefined>();

  const normalizarInicio = (d?: Date) => {
    if (!d) return undefined;
    const x = new Date(d); x.setHours(0,0,0,0); return x;
  };
  const normalizarFin = (d?: Date) => {
    if (!d) return undefined;
    const x = new Date(d); x.setHours(23,59,59,999); return x;
  };

  function MultiSelectRoles({
    selectedRoles,
    setSelectedRoles,
  }: {
    selectedRoles: Rol[];
    setSelectedRoles: (roles: Rol[]) => void;
  }) {
    const toggleRole = (rol: Rol) => {
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
    setUsuarios(Array.isArray(data) ? data : []);
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
    setRolesSeleccionados((usuario.roles ?? []) as Rol[]);
    setMostrarDialogo(true);
  };
  const cerrarDialogo = () => {
    setUsuarioEditando(null);
    setPassword("");
    setMostrarDialogo(false);
  };

  const handleEliminar = async (uid: string) => {
    const ok = window.confirm(
      "¿Desea borrar el usuario? Este borrado es permanente y no podrá recuperarlo."
    );
    if (!ok) return;

    await eliminarUsuario(uid);
    fetchUsuarios();
  };

  // ====== APLICAR FILTROS ======
  const usuariosFiltrados = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const fDesde = normalizarInicio(desde);
    const fHasta = normalizarFin(hasta);

    return usuarios.filter((u) => {
      // texto: nombre o email
      if (qn) {
        const texto = `${u.nombre ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!texto.includes(qn)) return false;
      }

      // rol
      if (rolFilter !== ALL) {
        const rolesU = (u.roles ?? []) as string[];
        if (!rolesU.includes(rolFilter)) return false;
      }

      // activo
      if (activoFilter !== ALL_BOOL) {
        const want = activoFilter === "true";
        if (Boolean(u.activo) !== want) return false;
      }

      // fecha_registro (Timestamp)
      if (fDesde || fHasta) {
        const ts = u.fecha_registro;
        const d = ts instanceof Timestamp ? ts.toDate() : undefined;
        if (!d) return false;
        if (fDesde && d < fDesde) return false;
        if (fHasta && d > fHasta) return false;
      }

      return true;
    });
  }, [usuarios, q, rolFilter, activoFilter, desde, hasta]);

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Usuarios</h2>
        <Button onClick={abrirCrear}>Crear Usuario</Button>
      </div>

      {/* ====== FILTROS ====== */}
      <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
        <div className="md:col-span-2">
          <Label>Búsqueda</Label>
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o email…"
          />
        </div>

        <div>
          <Label>Rol</Label>
          <Select value={rolFilter} onValueChange={setRolFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos</SelectItem>
              {rolesDisponibles.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>Activo</Label>
          <Select value={activoFilter} onValueChange={setActivoFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_BOOL}>Todos</SelectItem>
              <SelectItem value="true">Sí</SelectItem>
              <SelectItem value="false">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label>Desde</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {desde ? desde.toLocaleDateString("es-CO") : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar mode="single" selected={desde} onSelect={setDesde} initialFocus />
            </PopoverContent>
          </Popover>
          {desde && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start px-2"
              onClick={() => setDesde(undefined)}
            >
              Limpiar
            </Button>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Label>Hasta</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="justify-start">
                <CalendarIcon className="mr-2 h-4 w-4" />
                {hasta ? hasta.toLocaleDateString("es-CO") : "—"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <Calendar mode="single" selected={hasta} onSelect={setHasta} />
            </PopoverContent>
          </Popover>
          {hasta && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start px-2"
              onClick={() => setHasta(undefined)}
            >
              Limpiar
            </Button>
          )}
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setQ("");
              setRolFilter(ALL);
              setActivoFilter(ALL_BOOL);
              setDesde(undefined);
              setHasta(undefined);
            }}
          >
            Limpiar filtros
          </Button>
        </div>
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
            {usuariosFiltrados.map((usuario) => (
              <TableRow key={usuario.uid}>
                <TableCell>{usuario.email}</TableCell>
                <TableCell>{usuario.nombre}</TableCell>
                <TableCell>{usuario.roles?.join(", ")}</TableCell>
                <TableCell>
                  <Switch
                    checked={!!usuario.activo}
                    onCheckedChange={async (checked) => {
                      const actualizado = { ...usuario, activo: checked };
                      await actualizarUsuario(actualizado);
                      setUsuarios((prev) =>
                        prev.map((u) => (u.uid === actualizado.uid ? actualizado : u))
                      );
                    }}
                  />
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
                    : "—"}
                </TableCell>

                <TableCell>
                  <div className="flex justify-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => abrirEditar(usuario)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      {/* Si vas a reactivar Eliminar, puedes agregar aquí tu Dialog/Confirm */}
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

              const email = formData.get("email") as string;
              const nombre = formData.get("nombre") as string;
              const telefonoUsuario = formData.get("telefono") as string;
              const tipoDocumento = formData.get("tipoDocumento") as "CC" | "CE" | "TI" | "NIT";
              const numeroDocumento = formData.get("numeroDocumento") as string;
              const activo = (form.elements.namedItem("activo") as HTMLInputElement)?.checked;
              const fecha_registro = fecha ? Timestamp.fromDate(fecha) : Timestamp.now();

              if (!email || !/\S+@\S+\.\S+/.test(email)) {
                toast("Por favor ingresa un correo electrónico válido.");
                return;
              }

              if (!nombre || !tipoDocumento || !numeroDocumento) {
                toast("Todos los campos personales son obligatorios.");
                return;
              }

              if (rolesSeleccionados.length === 0) {
                toast("Debes seleccionar al menos un rol.");
                return;
              }

              if (usuarioEditando) {
                // Editar
                const actualizado: UsuarioSistema = {
                  ...usuarioEditando,
                  email,
                  nombre,
                  telefonoUsuario,
                  tipoDocumento,
                  numeroDocumento,
                  roles: rolesSeleccionados,
                  activo,
                  fecha_registro,
                };

                await actualizarUsuario(actualizado);
                setUsuarios((prev) =>
                  prev.map((u) => (u.uid === actualizado.uid ? actualizado : u))
                );
                cerrarDialogo();
              } else {
                // Crear
                if (!password) {
                  toast("La contraseña es obligatoria para nuevos usuarios.");
                  return;
                }
                if (password.length < 6) {
                  toast("⚠️ La contraseña debe tener al menos 6 caracteres.");
                  return;
                }

                try {
                  const usuarioSinUid: UsuarioSistema & { password: string } = {
                    uid: "",
                    email,
                    nombre,
                    telefonoUsuario,
                    tipoDocumento,
                    numeroDocumento,
                    roles: rolesSeleccionados,
                    activo,
                    fecha_registro,
                    password,
                  };

                  const uid = await crearUsuario(usuarioSinUid);
                  const nuevo: UsuarioSistema = { ...usuarioSinUid, uid };
                  setUsuarios((prev) => [...prev, nuevo]);
                  cerrarDialogo();
                } catch (error: any) {
                  if (error.code === "auth/email-already-in-use") {
                    toast("❌ Este correo ya está registrado. Usa uno diferente.");
                  } else {
                    toast("⚠️ Error al crear el usuario: " + error.message);
                  }
                }
              }
            }}
          >
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Nombre</Label>
                <Input name="nombre" defaultValue={usuarioEditando?.nombre} />
              </div>
              <div>
                <Label>Email</Label>
                <Input name="email" defaultValue={usuarioEditando?.email} required />
              </div>

              <div>
                <Label>Teléfono</Label>
                <Input name="telefono" defaultValue={usuarioEditando?.telefonoUsuario} />
              </div>

              <div>
                <Label>Tipo de documento</Label>
                <Select name="tipoDocumento" defaultValue={usuarioEditando?.tipoDocumento}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CC">Cédula de ciudadanía</SelectItem>
                    <SelectItem value="CE">Cédula de extranjería</SelectItem>
                    <SelectItem value="TI">Tarjeta de identidad</SelectItem>
                    <SelectItem value="NIT">NIT</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Número de documento</Label>
                <Input
                  name="numeroDocumento"
                  defaultValue={usuarioEditando?.numeroDocumento}
                  required
                />
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
