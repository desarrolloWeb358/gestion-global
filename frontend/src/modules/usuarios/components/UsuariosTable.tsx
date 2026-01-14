// src/modules/usuarios/components/UsuariosCrud.tsx
import { useEffect, useState, useMemo } from "react";
import { createPortal } from "react-dom";
import { crearUsuarioDesdeAdmin } from "@/shared/services/crearUsuarioService";
import {
  Check,
  ChevronDown,
  Filter,
  Pencil,
  Search,
  X,
  UserPlus,
  Users,
} from "lucide-react";
import { Timestamp } from "firebase/firestore";
import { toast } from "sonner";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/shared/ui/tooltip";
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
import { BackButton } from "@/shared/design-system/components/BackButton";

// Sentinelas para selects (evitar value="")
const ALL = "__ALL__";
const ALL_BOOL = "__ALL_BOOL__";

// ====== FUNCIÓN HELPER PARA COLORES DE ROLES ======
const getRoleBadgeColor = (role: string) => {
  const colors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700 border-purple-200",
    administrador: "bg-purple-100 text-purple-700 border-purple-200",
    editor: "bg-blue-100 text-blue-700 border-blue-200",
    viewer: "bg-green-100 text-green-700 border-green-200",
    usuario: "bg-green-100 text-green-700 border-green-200",
    gerente: "bg-orange-100 text-orange-700 border-orange-200",
    supervisor: "bg-indigo-100 text-indigo-700 border-indigo-200",
    empleado: "bg-teal-100 text-teal-700 border-teal-200",
  };
  return (
    colors[role?.toLowerCase?.() ?? ""] ||
    "bg-gray-100 text-gray-700 border-gray-200"
  );
};

export default function UsuariosCrud() {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [tipoDocControl, setTipoDocControl] = useState<
    "CC" | "CE" | "TI" | "NIT" | undefined
  >(undefined);

  const [loading, setLoading] = useState(true);
  const [usuarioEditando, setUsuarioEditando] = useState<UsuarioSistema | null>(
    null
  );
  const [mostrarDialogo, setMostrarDialogo] = useState(false);

  const [password, setPassword] = useState("");
  const [fecha, setFecha] = useState<Date | undefined>();
  const [rolesSeleccionados, setRolesSeleccionados] = useState<Rol[]>([]);
  const rolesDisponibles = ROLES;

  const [saving, setSaving] = useState(false);

  // ====== FILTROS ======
  const [q, setQ] = useState("");
  const [rolFilter, setRolFilter] = useState<string>(ALL);
  const [activoFilter, setActivoFilter] = useState<string>(ALL_BOOL);
  const [desde, setDesde] = useState<Date | undefined>();
  const [hasta, setHasta] = useState<Date | undefined>();

  const normalizarInicio = (d?: Date) => {
    if (!d) return undefined;
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
  };
  const normalizarFin = (d?: Date) => {
    if (!d) return undefined;
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
  };

  const fmt = (d?: Date) => (d ? d.toLocaleDateString("es-CO") : "—");

  const chips = useMemo(() => {
    const arr: { label: string; onClear: () => void }[] = [];
    if (q) arr.push({ label: `Búsqueda: "${q}"`, onClear: () => setQ("") });
    if (rolFilter !== ALL)
      arr.push({ label: `Rol: ${rolFilter}`, onClear: () => setRolFilter(ALL) });
    if (activoFilter !== ALL_BOOL) {
      arr.push({
        label: `Activo: ${activoFilter === "true" ? "Sí" : "No"}`,
        onClear: () => setActivoFilter(ALL_BOOL),
      });
    }
    if (desde) arr.push({ label: `Desde: ${fmt(desde)}`, onClear: () => setDesde(undefined) });
    if (hasta) arr.push({ label: `Hasta: ${fmt(hasta)}`, onClear: () => setHasta(undefined) });
    return arr;
  }, [q, rolFilter, activoFilter, desde, hasta]);

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
          <Button
            variant="outline"
            className="w-full justify-between border-brand-secondary/30 hover:border-brand-secondary/50"
            type="button"
          >
            {selectedRoles.length > 0 ? selectedRoles.join(", ") : "Selecciona roles"}
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
                "w-full flex items-center justify-between px-2 py-1.5 text-sm rounded hover:bg-brand-primary/10 transition-colors",
                selectedRoles.includes(rol) && "bg-brand-primary/10 text-brand-primary"
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
    setTipoDocControl(undefined);
    setMostrarDialogo(true);
  };

  const abrirEditar = (usuario: UsuarioSistema) => {
    setUsuarioEditando(usuario);
    setPassword("");
    setFecha(
      usuario.fecha_registro instanceof Timestamp
        ? usuario.fecha_registro.toDate()
        : undefined
    );
    setRolesSeleccionados((usuario.roles ?? []) as Rol[]);
    setTipoDocControl(usuario.tipoDocumento as any);
    setMostrarDialogo(true);
  };

  const cerrarDialogo = () => {
    setSaving(false);
    setUsuarioEditando(null);
    setPassword("");
    setFecha(undefined);
    setRolesSeleccionados([]);
    setTipoDocControl(undefined);
    setMostrarDialogo(false);
  };

  const handleEliminar = async (uid: string) => {
    const ok = window.confirm(
      "¿Desea borrar el usuario? Este borrado es permanente y no podrá recuperarlo."
    );
    if (!ok) return;
    await eliminarUsuario(uid);
    await fetchUsuarios();
  };

  // ====== APLICAR FILTROS ======
  const usuariosFiltrados = useMemo(() => {
    const qn = q.trim().toLowerCase();
    const fDesde = normalizarInicio(desde);
    const fHasta = normalizarFin(hasta);

    return usuarios.filter((u) => {
      if (qn) {
        const texto = `${u.nombre ?? ""} ${u.email ?? ""}`.toLowerCase();
        if (!texto.includes(qn)) return false;
      }

      if (rolFilter !== ALL) {
        const rolesU = (u.roles ?? []) as string[];
        if (!rolesU.includes(rolFilter)) return false;
      }

      if (activoFilter !== ALL_BOOL) {
        const want = activoFilter === "true";
        if (Boolean(u.activo) !== want) return false;
      }

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* ====== HEADER ====== */}
        <header className="space-y-4">
          <div className="flex items-center gap-2">
            <BackButton
              variant="ghost"
              size="sm"
              to="/dashboard/admin"
              label="Ir al Dashboard"
              className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
            />
          </div>

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-primary/10">
                  <Users className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <Typography variant="h2" className="!text-brand-primary font-bold">
                    Gestión de Usuarios
                  </Typography>
                  <Typography variant="small" className=" mt-0.5">
                    {usuariosFiltrados.length}{" "}
                    {usuariosFiltrados.length === 1
                      ? "usuario encontrado"
                      : "usuarios encontrados"}
                  </Typography>
                </div>
              </div>
            </div>

            <Button
              variant="brand"
              onClick={abrirCrear}
              className="gap-2 shadow-md hover:shadow-lg transition-all"
            >
              <UserPlus className="h-4 w-4" />
              Crear Usuario
            </Button>
          </div>
        </header>

        {/* ====== FILTROS ====== */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-brand-primary/10">
                  <Filter className="h-4 w-4 text-brand-primary" />
                </div>
                <Typography variant="h3" className="!text-brand-secondary font-semibold">
                  Filtros de búsqueda
                </Typography>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {chips.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {chips.map((c, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-primary/20 bg-brand-primary/5 px-3 py-1 text-xs text-brand-secondary font-medium"
                      >
                        {c.label}
                        <button
                          type="button"
                          onClick={c.onClear}
                          className="rounded-full p-0.5 hover:bg-brand-primary/20 transition-colors"
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
                  className={cn(
                    "border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary/5",
                    chips.length === 0 && "opacity-50 pointer-events-none"
                  )}
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
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
              {/* Búsqueda */}
              <div className="lg:col-span-3">
                <Label className="mb-2 block text-brand-secondary font-medium">
                  Búsqueda
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/60" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre o email..."
                    className="pl-9 border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                    aria-label="Buscar por nombre o email"
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1  hover:bg-gray-100 transition-colors"
                      aria-label="Limpiar búsqueda"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Rol */}
              <div>
                <Label className="mb-2 block text-brand-secondary font-medium">
                  Rol
                </Label>
                <Select value={rolFilter} onValueChange={setRolFilter}>
                  <SelectTrigger className="border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="border-brand-secondary/30 bg-white">
                    <SelectItem value={ALL}>Todos los roles</SelectItem>
                    {rolesDisponibles.map((r) => (
                      <SelectItem key={r} value={r} className="capitalize">
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Activo */}
              <div>
                <Label className="mb-2 block text-brand-secondary font-medium">
                  Estado
                </Label>
                <Select value={activoFilter} onValueChange={setActivoFilter}>
                  <SelectTrigger className="border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20">
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent className="border-brand-secondary/30 bg-white">
                    <SelectItem value={ALL_BOOL}>Todos los estados</SelectItem>
                    <SelectItem value="true">✓ Activos</SelectItem>
                    <SelectItem value="false">✗ Inactivos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Rango de fechas */}
              <div className="lg:col-span-2">
                <Label className="mb-2 block text-brand-secondary font-medium">
                  Rango de fechas
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start border-brand-secondary/30 bg-white hover:bg-brand-primary/5"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-brand-primary" />
                      {desde || hasta
                        ? `${fmt(desde)} → ${fmt(hasta)}`
                        : "Seleccionar rango"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="start">
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            const hoy = new Date();
                            setDesde(hoy);
                            setHasta(hoy);
                          }}
                        >
                          Hoy
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            const hoy = new Date();
                            const d7 = new Date();
                            d7.setDate(hoy.getDate() - 7);
                            setDesde(d7);
                            setHasta(hoy);
                          }}
                        >
                          Últimos 7 días
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          onClick={() => {
                            const hoy = new Date();
                            const d30 = new Date();
                            d30.setDate(hoy.getDate() - 30);
                            setDesde(d30);
                            setHasta(hoy);
                          }}
                        >
                          Últimos 30 días
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-xs"
                          onClick={() => {
                            setDesde(undefined);
                            setHasta(undefined);
                          }}
                        >
                          Limpiar
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div>
                          <Label className="mb-1 block text-xs ">
                            Desde
                          </Label>
                          <Calendar
                            mode="single"
                            selected={desde}
                            onSelect={setDesde}
                            initialFocus
                          />
                        </div>
                        <div>
                          <Label className="mb-1 block text-xs ">
                            Hasta
                          </Label>
                          <Calendar mode="single" selected={hasta} onSelect={setHasta} />
                        </div>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </section>

        {/* ====== TABLA ====== */}
        {loading ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body" className="">
                Cargando usuarios...
              </Typography>
            </div>
          </div>
        ) : usuariosFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-brand-primary/10">
                <Users className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                No hay resultados
              </Typography>
              <Typography variant="small" className=" max-w-md">
                {chips.length > 0
                  ? "No se encontraron usuarios que coincidan con los filtros aplicados. Intenta ajustar tus criterios de búsqueda."
                  : "Aún no hay usuarios registrados. Comienza creando el primer usuario."}
              </Typography>
              {chips.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
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
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">
                      Email
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">
                      Nombre
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">
                      Rol
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">
                      Estado
                    </TableHead>
                    <TableHead className="text-brand-secondary font-semibold">
                      Fecha de registro
                    </TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Acciones
                    </TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {usuariosFiltrados.map((usuario, index) => (
                    <TableRow
                      key={usuario.uid}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-brand-secondary">
                        {usuario.email}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {usuario.nombre}
                      </TableCell>

                      <TableCell className="text-sm">
                        <div className="flex flex-wrap gap-1">
                          {usuario.roles?.map((r) => (
                            <span
                              key={r}
                              className={cn(
                                "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-all hover:scale-105",
                                getRoleBadgeColor(r)
                              )}
                            >
                              {r}
                            </span>
                          ))}
                        </div>
                      </TableCell>

                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!!usuario.activo}
                            onCheckedChange={async (checked) => {
                              try {
                                const actualizado = { ...usuario, activo: checked };
                                await actualizarUsuario(actualizado);
                                setUsuarios((prev) =>
                                  prev.map((u) =>
                                    u.uid === actualizado.uid ? actualizado : u
                                  )
                                );
                                toast.success(
                                  checked ? "✓ Usuario activado" : "✗ Usuario desactivado"
                                );
                              } catch (e) {
                                console.error(e);
                                toast.error("No se pudo actualizar el estado");
                              }
                            }}
                            className="data-[state=checked]:bg-brand-primary hover:data-[state=checked]:bg-brand-primary/90 data-[state=unchecked]:bg-gray-300 focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                          />
                          <span
                            className={cn(
                              "text-xs font-medium",
                              usuario.activo ? "text-green-600" : "text-gray-400"
                            )}
                          >
                            {usuario.activo ? "Activo" : "Inactivo"}
                          </span>
                        </div>
                      </TableCell>

                      <TableCell className="text-gray-600">
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
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => abrirEditar(usuario)}
                                  className="hover:bg-brand-primary/10 transition-colors"
                                >
                                  <Pencil className="w-4 h-4 text-brand-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white border-brand-secondary">
                                Editar usuario
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>

                          {/* Si quieres botón eliminar aquí, lo agregas */}
                          {/* <Button type="button" variant="ghost" onClick={() => handleEliminar(usuario.uid)}>Eliminar</Button> */}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* ====== DIALOG ====== */}
        <Dialog
          open={mostrarDialogo}
          onOpenChange={(open) => {
            if (!open) cerrarDialogo();
            else setMostrarDialogo(true);
          }}
        >
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-brand-primary text-xl font-bold">
                {usuarioEditando ? "Editar Usuario" : "Crear Nuevo Usuario"}
              </DialogTitle>
            </DialogHeader>

            <form
              className="space-y-6 py-4"
              onSubmit={async (e) => {
                e.preventDefault();

                const form = e.target as HTMLFormElement;
                const formData = new FormData(form);

                const email = (formData.get("email") as string) ?? "";
                const nombre = (formData.get("nombre") as string) ?? "";
                const telefonoUsuario = (formData.get("telefono") as string) ?? "";
                const tipoDocumento = formData.get("tipoDocumento") as "CC" | "CE" | "TI" | "NIT";
                const numeroDocumento = (formData.get("numeroDocumento") as string) ?? "";
                const activo = (form.elements.namedItem("activo") as HTMLInputElement)?.checked;
                const fecha_registro = fecha ? Timestamp.fromDate(fecha) : Timestamp.now();

                // ✅ VALIDACIONES ANTES DE setSaving(true)
                if (!email || !/\S+@\S+\.\S+/.test(email)) {
                  toast.error("Por favor ingresa un correo electrónico válido.");
                  return;
                }

                if (!nombre || !tipoDocumento || !numeroDocumento) {
                  toast.error("Todos los campos personales son obligatorios.");
                  return;
                }

                if (rolesSeleccionados.length === 0) {
                  toast.error("Debes seleccionar al menos un rol.");
                  return;
                }

                if (!usuarioEditando) {
                  if (!password) {
                    toast.error("La contraseña es obligatoria para nuevos usuarios.");
                    return;
                  }
                  if (password.length < 6) {
                    toast.error("⚠️ La contraseña debe tener al menos 6 caracteres.");
                    return;
                  }
                }

                try {
                  setSaving(true);

                  if (usuarioEditando) {
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

                    toast.success("✓ Usuario actualizado correctamente");
                    cerrarDialogo();
                  } else {
                    // 1) Crear en Auth + Firestore desde Admin (Cloud Function)
                    const res = await crearUsuarioDesdeAdmin({
                      email,
                      password,
                      nombre,
                      telefonoUsuario,
                      tipoDocumento,
                      numeroDocumento,
                      roles: [rolesSeleccionados?.[0] ?? "ejecutivo"], // si tu sistema usa 1 rol principal
                      activo: Boolean(activo),
                      asociadoA: null,
                    });

                    // 2) Guardar datos extra en tu colección (si manejas campos adicionales)
                    // Si tu function ya los guarda, puedes omitir esto.
                    const nuevo: UsuarioSistema = {
                      uid: res.uid,
                      email,
                      nombre,
                      telefonoUsuario,
                      tipoDocumento,
                      numeroDocumento,
                      roles: rolesSeleccionados,
                      activo: Boolean(activo),
                      fecha_registro,
                    };

                    setUsuarios((prev) => [...prev, nuevo]);
                    toast.success("✓ Usuario creado exitosamente");
                    cerrarDialogo();
                  }
                } catch (error: any) {
                  if (error?.code === "auth/email-already-in-use") {
                    toast.error("❌ Este correo ya está registrado. Usa uno diferente.");
                  } else {
                    toast.error("⚠️ Error al guardar: " + (error?.message ?? "desconocido"));
                  }
                } finally {
                  setSaving(false);
                }
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-brand-secondary font-medium">
                    Nombre completo
                  </Label>
                  <Input
                    name="nombre"
                    defaultValue={usuarioEditando?.nombre}
                    className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                    placeholder="Ej: Juan Pérez"
                  />
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">Email</Label>
                  <Input
                    name="email"
                    type="email"
                    defaultValue={usuarioEditando?.email}
                    required
                    className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                    placeholder="ejemplo@correo.com"
                  />
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">Teléfono</Label>
                  <Input
                    name="telefono"
                    defaultValue={usuarioEditando?.telefonoUsuario}
                    className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                    placeholder="300 123 4567"
                  />
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">
                    Tipo de documento
                  </Label>
                  <Select
                    value={tipoDocControl}
                    onValueChange={(v) => setTipoDocControl(v as any)}
                  >
                    <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                      <SelectValue placeholder="Selecciona un tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CC">Cédula de ciudadanía</SelectItem>
                      <SelectItem value="CE">Cédula de extranjería</SelectItem>
                      <SelectItem value="TI">Tarjeta de identidad</SelectItem>
                      <SelectItem value="NIT">NIT</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="hidden"
                    name="tipoDocumento"
                    value={tipoDocControl ?? ""}
                  />
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">
                    Número de documento
                  </Label>
                  <Input
                    name="numeroDocumento"
                    defaultValue={usuarioEditando?.numeroDocumento}
                    required
                    className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                    placeholder="1234567890"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label className="text-brand-secondary font-medium">
                    Roles asignados
                  </Label>
                  <div className="mt-1.5">
                    <MultiSelectRoles
                      selectedRoles={rolesSeleccionados}
                      setSelectedRoles={setRolesSeleccionados}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-brand-secondary/20 bg-brand-primary/5">
                  <Switch
                    name="activo"
                    id="activo"
                    defaultChecked={usuarioEditando?.activo ?? true}
                    className="data-[state=checked]:bg-brand-primary data-[state=unchecked]:bg-gray-300 focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                  />
                  <div>
                    <Label
                      htmlFor="activo"
                      className="text-brand-secondary font-medium cursor-pointer"
                    >
                      Usuario activo
                    </Label>
                    <p className="text-xs  mt-0.5">
                      Los usuarios inactivos no pueden acceder al sistema
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">
                    Fecha de Registro
                  </Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className="w-full justify-start text-left font-normal mt-1.5 border-brand-secondary/30 hover:bg-brand-primary/5"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-brand-primary" />
                        {fecha
                          ? fecha.toLocaleDateString("es-CO")
                          : "Selecciona una fecha"}
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
                  <div className="md:col-span-2">
                    <Label className="text-brand-secondary font-medium">
                      Contraseña
                    </Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                      placeholder="Mínimo 6 caracteres"
                    />
                    <p className="text-xs  mt-1.5">
                      La contraseña debe tener al menos 6 caracteres
                    </p>
                  </div>
                )}
              </div>

              <DialogFooter className="mt-6 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cerrarDialogo}
                  className="border-brand-secondary/30"
                  disabled={saving}
                >
                  Cancelar
                </Button>

                <Button
                  type="submit"
                  variant="brand"
                  className="gap-2"
                  disabled={saving}
                >
                  {usuarioEditando ? "Guardar cambios" : "Crear usuario"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ✅ OVERLAY GLOBAL: BLOQUEA TODA LA APP */}
        {saving &&
          createPortal(
            <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <div className="rounded-xl bg-white shadow-xl px-6 py-5 flex items-center gap-3">
                <div className="h-5 w-5 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                <Typography variant="body" className="font-medium">
                  {usuarioEditando ? "Guardando cambios..." : "Creando usuario..."}
                </Typography>
              </div>
            </div>,
            document.body
          )}
      </div>
    </div>
  );
}
