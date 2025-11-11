import { useEffect, useState, useMemo } from "react";
import { Check, ChevronDown, Filter, Pencil, Search, X } from "lucide-react";
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
import { Typography } from "@/shared/design-system/components/Typography";

// Sentinelas para selects (evitar value="")
const ALL = "__ALL__";
const ALL_BOOL = "__ALL_BOOL__";

export default function UsuariosCrud() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [tipoDocControl, setTipoDocControl] = useState<"CC" | "CE" | "TI" | "NIT" | undefined>(
    undefined
  );
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
    const x = new Date(d); x.setHours(0, 0, 0, 0); return x;
  };
  const normalizarFin = (d?: Date) => {
    if (!d) return undefined;
    const x = new Date(d); x.setHours(23, 59, 59, 999); return x;
  };

  const fmt = (d?: Date) => (d ? d.toLocaleDateString("es-CO") : "—");
  const chips = useMemo(() => {
    const arr: { label: string; onClear: () => void }[] = [];
    if (q) arr.push({ label: `Búsqueda: “${q}”`, onClear: () => setQ("") });
    if (rolFilter !== ALL) arr.push({ label: `Rol: ${rolFilter}`, onClear: () => setRolFilter(ALL) });
    if (activoFilter !== ALL_BOOL) {
      arr.push({ label: `Activo: ${activoFilter === "true" ? "Sí" : "No"}`, onClear: () => setActivoFilter(ALL_BOOL) });
    }
    if (desde) arr.push({ label: `Desde: ${fmt(desde)}`, onClear: () => setDesde(undefined) });
    if (hasta) arr.push({ label: `Hasta: ${fmt(hasta)}`, onClear: () => setHasta(undefined) });
    return arr;
  }, [q, rolFilter, activoFilter, desde, hasta, ALL, ALL_BOOL, setQ, setRolFilter, setActivoFilter, setDesde, setHasta]);

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
    setTipoDocControl(undefined);
  };

  const abrirEditar = (usuario: UsuarioSistema) => {
    setUsuarioEditando(usuario);
    setPassword("");
    setFecha(usuario.fecha_registro instanceof Timestamp ? usuario.fecha_registro.toDate() : undefined);
    setRolesSeleccionados((usuario.roles ?? []) as Rol[]);
    setMostrarDialogo(true);
    setTipoDocControl(usuario.tipoDocumento as any);
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
        <Typography variant="h2" className="!text-brand-primary font-bold">
          Usuarios
        </Typography>

        <Button variant="brand" onClick={abrirCrear}>
          Crear Usuario
        </Button>
      </div>

      {/* ====== FILTROS ====== */}
      <section className="rounded-2xl border border-brand-secondary/30 bg-white/60 p-4 md:p-5 shadow-sm">
        {/* Encabezado + chips + limpiar todo */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted" />
            <Typography variant="h3" className="!text-brand-secondary">Filtros
            </Typography>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {chips.map((c, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full border border-border bg-bg px-2 py-1 text-xs text-fg"
                  >
                    {c.label}
                    <button
                      type="button"
                      onClick={c.onClear}
                      className="rounded p-0.5 hover:bg-gray-100"
                      aria-label={`Quitar ${c.label}`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className={chips.length === 0 ? "opacity-60 pointer-events-none" : ""}
              onClick={() => {
                setQ("");
                setRolFilter(ALL);
                setActivoFilter(ALL_BOOL);
                setDesde(undefined);
                setHasta(undefined);
              }}
            >
              Limpiar todo
            </Button>
          </div>
        </div>

        {/* Grid de controles */}
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-6">
          {/* Búsqueda ancho */}
          <div className="md:col-span-2 lg:col-span-3">
            <Label className="mb-1 block">Búsqueda</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre o email…"
                className="pl-9  border border-brand-secondary/30 bg-white/60"
                aria-label="Buscar por nombre o email"
              />
              {q && (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted hover:bg-gray-100"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Rol */}
          <div>
            <Label className="mb-1 block ">Rol</Label>
            <Select value={rolFilter} onValueChange={setRolFilter}>
              <SelectTrigger className="border border-brand-secondary/30 bg-white/60"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent className="max-h-64 border border-brand-secondary/30 bg-white/60 ">
                <SelectItem className="border border-brand-secondary/30 bg-white/60" value={ALL}>Todos</SelectItem>
                {rolesDisponibles.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Activo */}
          <div>
            <Label className="mb-1 block t">Activo</Label>
            <Select value={activoFilter} onValueChange={setActivoFilter}>
              <SelectTrigger className="border border-brand-secondary/30 bg-white/60"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent className="border border-brand-secondary/30 bg-white/60">
                <SelectItem value={ALL_BOOL}>Todos</SelectItem>
                <SelectItem value="true">Sí</SelectItem>
                <SelectItem value="false">No</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Rango de fechas unificado */}
          <div className="lg:col-span-2">
            <Label className="mb-1 block">Rango de fechas</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start border border-brand-secondary/30 bg-white/60">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {desde || hasta ? `${fmt(desde)} → ${fmt(hasta)}` : "Seleccionar rango"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2" align="start">
                <div className="flex flex-col gap-3 ">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => {
                      const hoy = new Date(); setDesde(hoy); setHasta(hoy);
                    }}>Hoy</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const hoy = new Date(); const d7 = new Date(); d7.setDate(hoy.getDate() - 7);
                      setDesde(d7); setHasta(hoy);
                    }}>Últimos 7 días</Button>
                    <Button size="sm" variant="outline" onClick={() => {
                      const hoy = new Date(); const d30 = new Date(); d30.setDate(hoy.getDate() - 30);
                      setDesde(d30); setHasta(hoy);
                    }}>Últimos 30 días</Button>
                    <Button size="sm" variant="ghost" onClick={() => { setDesde(undefined); setHasta(undefined); }}>
                      Limpiar
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div>
                      <Label className="mb-1 block text-xs text-muted">Desde</Label>
                      <Calendar mode="single" selected={desde} onSelect={setDesde} initialFocus />
                    </div>
                    <div>
                      <Label className="mb-1 block text-xs text-muted">Hasta</Label>
                      <Calendar mode="single" selected={hasta} onSelect={setHasta} />
                    </div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </section>

      {loading ? (
        <p className="text-center py-6 text-muted">Cargando usuarios...</p>
      ) : usuariosFiltrados.length === 0 ? (
        <div className="rounded-xl border border-border p-10 text-center text-muted">
          No hay resultados con los filtros actuales.
        </div>
      ) : (
        <div >
          <div className=" rounded-xl overflow-x-auto border border-brand-secondary/30 bg-white/60">
            <Table className="min-w-[900px]">
              <TableHeader className="sticky top-0 bg-bg z-10 ">
                <TableRow >
                  <TableHead>Email</TableHead>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Activo</TableHead>
                  <TableHead>Fecha de registro</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody >
                {usuariosFiltrados.map((usuario) => (
                  <TableRow key={usuario.uid} className="even:bg-gray-50 hover:bg-gray-100/60">
                    <TableCell className="font-medium">{usuario.email}</TableCell>
                    <TableCell>{usuario.nombre}</TableCell>
                    <TableCell className="text-sm">
                      {usuario.roles?.map((r) => (
                        <span
                          key={r}
                          className="mr-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                        >
                          {r}
                        </span>
                      ))}
                    </TableCell>
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
                        className="
    data-[state=checked]:bg-brand-secondary
    hover:data-[state=checked]:bg-brand-700
    data-[state=unchecked]:bg-gray-300
    focus-visible:ring-2 focus-visible:ring-brand-secondary/30
  "
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
                              <Button size="icon" variant="ghost" onClick={() => abrirEditar(usuario)}>
                                <Pencil className="w-4 h-4 text-brand-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent >Editar</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
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
                <Select value={tipoDocControl} onValueChange={(v) => setTipoDocControl(v as any)}>
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
                {/* ¡Clave! esto hace que llegue al FormData */}
                <input type="hidden" name="tipoDocumento" value={tipoDocControl ?? ""} />
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

              <div className="flex items-center gap-2">
                <Switch
                  name="activo"
                  id="activo"
                  defaultChecked={usuarioEditando?.activo ?? true}
                  className="
      data-[state=checked]:bg-brand-primary
      data-[state=unchecked]:bg-gray-300
      focus-visible:ring-2 focus-visible:ring-brand-primary/30
    "
                />
                <Label htmlFor="activo" className="text-fg">Activo</Label>
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
