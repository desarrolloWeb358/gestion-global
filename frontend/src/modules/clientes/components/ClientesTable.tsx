import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, User, Users, Search, X, Building2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/shared/ui/dialog";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/shared/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/shared/ui/tooltip";
import { Switch } from "@/shared/ui/switch";
import { Cliente } from "@/modules/clientes/models/cliente.model";
import { obtenerClientes, actualizarCliente } from "@/modules/clientes/services/clienteService";
import { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import {
  obtenerUsuarios,
  obtenerEjecutivos,
  obtenerAbogados,
} from "@/modules/usuarios/services/usuarioService";
import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";
import { toast } from "sonner";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";


export default function ClientesCrud() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);
  const [abogados, setAbogados] = useState<UsuarioSistema[]>([]); // 👈 nuevo
  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [tipoCuentaSel, setTipoCuentaSel] = useState<"" | "ahorros" | "corriente" | "convenio">("");
  const [ejecutivoPreSel, setEjecutivoPreSel] = useState<string>("");
  const [ejecutivoJurSel, setEjecutivoJurSel] = useState<string>("");
  const [activoSel, setActivoSel] = useState<boolean>(true);
  const [q, setQ] = useState("");

  const [dependienteSel, setDependienteSel] = useState<string>("");
  const [abogadoSel, setAbogadoSel] = useState<string>("");

  // Roles
  const { usuario, roles, loading: userLoading } = useUsuarioActual();
  const { can, loading: aclLoading } = useAcl();

  const isAdmin = roles?.includes("admin") || roles?.includes("ejecutivoAdmin");
  const isEjecutivo = roles?.includes("ejecutivo");
  const isClienteOnly = roles?.includes("cliente") && !isAdmin && !isEjecutivo; // cliente puro

  const canView = can(PERMS.Clientes_Read);
  const canEdit = can(PERMS.Clientes_Edit);
  // Carga usuarios (para mostrar nombres de cliente)
  useEffect(() => {
    // No depende de auth; pero si quieres ahorrar, puedes moverlo después
    fetchUsuarios();
  }, []);

  // Carga clientes SOLO cuando ya sepamos quién es (o que definitivamente no hay sesión)
  useEffect(() => {
    if (userLoading || aclLoading) return;     // aún cargando contexto
    if (!roles || (!usuario && !isAdmin)) {
      // si no hay usuario y no es admin (raro), no dispares fetch
      return;
    }
    fetchClientes();                            // ahora sí
    // re-filtra si cambian usuario/roles
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, aclLoading, usuario?.uid, isAdmin, isEjecutivo]);



  function resolverNombreCliente(c: Cliente) {
    // si algunos clientes viejos no tienen nombre, caes al id
    return (c as any).nombre ?? c.id ?? "(Sin nombre)";
  }


  const fetchClientes = async () => {
    setLoading(true);
    try {
      const data = await obtenerClientes();
      let lista = Array.isArray(data) ? data : [];

      // Admin y Ejecutivo Admin: ven todo
      if (isAdmin) {
        setClientes(lista);
        return;
      }

      // Ejecutivos “puros”: ver solo los asignados
      if (isEjecutivo && usuario?.uid) {
        const uid = usuario.uid;
        lista = lista.filter((c) =>
          c?.ejecutivoPrejuridicoId === uid ||
          c?.ejecutivoJuridicoId === uid ||
          c?.ejecutivoDependienteId === uid
        );
      }

      // Clientes no deben ver esta página → el guard ya los bloquea arriba
      setClientes(lista);
    } finally {
      setLoading(false);
    }
  };



  const fetchUsuarios = async () => {
  const [execs, lawyers] = await Promise.all([
    obtenerEjecutivos(),
    obtenerAbogados(),
  ]);
  setEjecutivos(execs);
  setAbogados(lawyers);
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
    setDependienteSel(cliente.ejecutivoDependienteId ?? "");
    setAbogadoSel(cliente.abogadoId ?? "");
    setActivoSel(cliente.activo ?? true);
    setMostrarDialogo(true);
  };

  const cerrarDialogo = () => {
    setClienteEditando(null);
    setMostrarDialogo(false);
  };

  const clientesFiltrados = useMemo(() => {
    const qn = q.trim().toLowerCase();
    if (!qn) return clientes;

    return clientes.filter((c) => {
      const nombre = (c as any).nombre?.toLowerCase?.() ?? "";
      // si en clientes no guardas email, simplemente no lo uses
      return nombre.includes(qn);
    });
  }, [clientes, q]);

  if (userLoading || aclLoading) {
    return <div className="p-6 text-muted-foreground">Cargando permisos…</div>;
  }
  if (isClienteOnly) {
    return <div className="p-6">No tienes acceso a esta página.</div>;
  }
  if (!can(PERMS.Clientes_Read)) {
    return <div className="p-6">No tienes permiso para ver clientes.</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">

        <header className="space-y-4">
          <BackButton
            variant="ghost"
            size="sm"
            className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
          />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-primary/10">
                  <Users className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <Typography variant="h2" className="!text-brand-primary font-bold">
                    Gestión de Clientes
                  </Typography>
                  <Typography variant="small" className="mt-0.5">
                    {clientesFiltrados.length} {clientesFiltrados.length === 1 ? 'cliente encontrado' : 'clientes encontrados'}
                  </Typography>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Búsqueda de clientes
            </Typography>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2">
                <Label className="mb-2 block text-brand-secondary font-medium">Búsqueda</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/60" />
                  <Input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Buscar por nombre o email..."
                    className="pl-9 border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => setQ("")}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted hover:bg-gray-100 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  className={cn(
                    "w-full border-brand-secondary/30 text-brand-secondary hover:bg-brand-primary/5",
                    !q && "opacity-50 pointer-events-none"
                  )}
                  onClick={() => setQ("")}
                >
                  Limpiar búsqueda
                </Button>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body" className="text-muted">
                Cargando clientes...
              </Typography>
            </div>
          </div>
        ) : clientesFiltrados.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-3">
              <div className="p-4 rounded-full bg-brand-primary/10">
                <Users className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                No hay resultados
              </Typography>
              <Typography variant="small" className="text-muted max-w-md">
                {q ? "No se encontraron clientes que coincidan con tu búsqueda." : "Aún no hay clientes registrados."}
              </Typography>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Nombre</TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientesFiltrados.map((cliente, index) => (
                    <TableRow
                      key={cliente.id}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="font-medium text-brand-secondary">
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
                                  className="hover:bg-blue-50 transition-colors"
                                >
                                  <Eye className="w-4 h-4 text-blue-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white">
                                Ver deudores
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => navigate(`/clientes/${cliente.id}`)}
                                  className="hover:bg-green-50 transition-colors"
                                >
                                  <User className="w-4 h-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white">
                                Ver perfil del cliente
                              </TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => abrirEditar(cliente)}
                                  className="hover:bg-brand-primary/10 transition-colors"
                                >
                                  <Pencil className="w-4 h-4 text-brand-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white">
                                Editar cliente
                              </TooltipContent>
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
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Editar Cliente
              </DialogTitle>
            </DialogHeader>

            <form
              className="space-y-6 py-4"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!clienteEditando?.id) {
                  cerrarDialogo();
                  return;
                }

                const form = e.currentTarget as HTMLFormElement;
                const formData = new FormData(form);

                const direccion = (formData.get("direccion") as string)?.trim();
                const banco = (formData.get("banco") as string)?.trim();
                const numeroCuenta = (formData.get("numeroCuenta") as string)?.trim();

                const tipoCuenta = tipoCuentaSel === "" ? undefined : (tipoCuentaSel as "ahorros" | "corriente" | "convenio");
                const ejecutivoPrejuridicoId = ejecutivoPreSel || null;
                const ejecutivoJuridicoId = ejecutivoJurSel || null;
                const ejecutivoDependienteId = dependienteSel || null;
                const abogadoId = abogadoSel || null;
                const activo = activoSel;

                const payload: Partial<Cliente> = {
                  direccion: direccion || "",
                  banco: banco || "",
                  numeroCuenta: numeroCuenta || "",
                  ...(tipoCuenta ? { tipoCuenta } : {}),
                  ejecutivoPrejuridicoId,
                  ejecutivoJuridicoId,
                  ejecutivoDependienteId,
                  abogadoId,
                  activo,
                };

                await actualizarCliente(clienteEditando.id, payload);
                toast.success("✓ Cliente actualizado correctamente");
                cerrarDialogo();
                fetchClientes();
              }}
            >
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/20">
                  <Label className="text-brand-secondary font-medium">Nombre del Cliente</Label>
                  <Input
                    value={clienteEditando?.nombre ?? ""} // solo lectura igual
                    readOnly
                    className="mt-1.5 bg-white/50 border-brand-secondary/30"
                  />
                  <p className="text-xs text-muted mt-1.5">
                    Para editar el nombre, hazlo en el módulo <strong>Usuarios</strong>.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-brand-secondary font-medium">Ejecutivo Prejurídico</Label>
                    <Select value={ejecutivoPreSel} onValueChange={setEjecutivoPreSel}>
                      <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                        <SelectValue placeholder="Selecciona un ejecutivo" />
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
                    <Label className="text-brand-secondary font-medium">Ejecutivo Jurídico</Label>
                    <Select value={ejecutivoJurSel} onValueChange={setEjecutivoJurSel}>
                      <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                        <SelectValue placeholder="Selecciona un ejecutivo" />
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
                    <Label className="text-brand-secondary font-medium">Dependiente</Label>
                    <Select value={dependienteSel} onValueChange={setDependienteSel}>
                      <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                        <SelectValue placeholder="Selecciona un dependiente" />
                      </SelectTrigger>
                      <SelectContent>
                        {ejecutivos.map((u) => (
                          <SelectItem key={u.uid} value={u.uid}>
                            {u.nombre ?? (u as any).displayName ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium">Abogado</Label>
                    <Select value={abogadoSel} onValueChange={setAbogadoSel}>
                      <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                        <SelectValue placeholder="Selecciona un abogado" />
                      </SelectTrigger>
                      <SelectContent>
                        {abogados.map((u) => (
                          <SelectItem key={u.uid} value={u.uid}>
                            {u.nombre ?? (u as any).displayName ?? u.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium">Banco</Label>
                    <Input
                      name="banco"
                      defaultValue={clienteEditando?.banco}
                      className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                      placeholder="Ej: Bancolombia"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium">Número de cuenta</Label>
                    <Input
                      name="numeroCuenta"
                      defaultValue={clienteEditando?.numeroCuenta}
                      className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                      placeholder="0000000000"
                    />
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium">Tipo de cuenta</Label>
                    <Select
                      value={tipoCuentaSel}
                      onValueChange={(v) => setTipoCuentaSel(v as "ahorros" | "corriente" | "convenio" | "")}
                    >
                      <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                        <SelectValue placeholder="Selecciona un tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ahorros">Ahorros</SelectItem>
                        <SelectItem value="corriente">Corriente</SelectItem>
                        <SelectItem value="convenio">Convenio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-brand-secondary font-medium">Dirección</Label>
                    <Input
                      name="direccion"
                      defaultValue={clienteEditando?.direccion}
                      className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                      placeholder="Calle 123 #45-67"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 rounded-lg border border-brand-secondary/20 bg-brand-primary/5">
                  <Switch
                    checked={activoSel}
                    onCheckedChange={setActivoSel}
                    className="data-[state=checked]:bg-brand-primary data-[state=unchecked]:bg-gray-300 focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                  />
                  <div>
                    <Label className="text-brand-secondary font-medium cursor-pointer">
                      Cliente activo
                    </Label>
                    <p className="text-xs text-muted mt-0.5">
                      Los clientes inactivos no aparecerán en las búsquedas principales
                    </p>
                  </div>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={cerrarDialogo}
                  className="border-brand-secondary/30"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  variant="brand"
                >
                  Guardar cambios
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}