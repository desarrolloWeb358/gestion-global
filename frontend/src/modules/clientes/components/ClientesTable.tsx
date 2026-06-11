import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, Pencil, User, Users, Search, X, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/shared/ui/tooltip";

import { Cliente } from "@/modules/clientes/models/cliente.model";
import { obtenerClientesPorUsuario } from "@/modules/clientes/services/clienteService";
import { getUsuarioByUid } from "@/modules/usuarios/services/usuarioService";
import { obtenerDeudorPorCliente } from "@/modules/cobranza/services/deudorService";
import { TipificacionDeuda } from "@/shared/constants/tipificacionDeuda";
import { ClienteEditDialog } from "./ClienteEditDialog";

import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { PERMS } from "@/shared/constants/acl";

const SESSION_KEY = "clientesTable_q";

export default function ClientesCrud() {
  const navigate = useNavigate();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);

  const [clienteEditando, setClienteEditando] = useState<Cliente | null>(null);
  const [mostrarDialogo, setMostrarDialogo] = useState(false);
  const [mostrarInactivos, setMostrarInactivos] = useState(false);
  const [q, setQ] = useState(() => sessionStorage.getItem(SESSION_KEY) ?? "");

  // Auth / Roles / ACL
  const { usuario, roles, loading: userLoading } = useUsuarioActual();
  const { can, loading: aclLoading } = useAcl();

  const isAdmin = roles?.includes("admin") || roles?.includes("ejecutivoAdmin");
  const isEjecutivo = roles?.includes("ejecutivo");
  const isClienteOnly =
    roles?.includes("cliente") && !isAdmin && !isEjecutivo; // cliente puro

  const canView = can(PERMS.Clientes_Read);
  const canEdit = can(PERMS.Clientes_Edit);

  // ----------------------------
  // Clientes filtrados por usuario/roles (SERVER SIDE)
  // ----------------------------
  const fetchClientes = async () => {
    // Asegura que haya contexto
    if (!roles) return;

    // Admin puede ver todo incluso si por alguna razón usuario no está listo
    if (!usuario?.uid && !isAdmin) return;

    setLoading(true);
    try {
      const data = await obtenerClientesPorUsuario({
        uid: usuario?.uid ?? "", // si es admin y no hay uid por algo raro, igual no debería pasar
        roles,
      });

      setClientes(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ✅ importantísimo: NO cargues clientes hasta que sepas roles/usuario
    if (userLoading || aclLoading) return;
    if (!can(PERMS.Clientes_Read)) return; // si no puede ver, ni consultes
    fetchClientes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLoading, aclLoading, usuario?.uid, roles?.join("|")]);

  // ----------------------------
  function resolverNombreCliente(c: Cliente) {
    return (c as any).nombre ?? c.id ?? "(Sin nombre)";
  }

  const clientesFiltrados = useMemo(() => {
    let result = mostrarInactivos
      ? clientes.filter((c) => c.activo === false)
      : clientes.filter((c) => c.activo !== false);

    const qn = q.trim().toLowerCase();
    if (!qn) return result;
    return result.filter((c) => {
      const nombre = (c as any).nombre?.toLowerCase?.() ?? "";
      return nombre.includes(qn);
    });
  }, [clientes, q, mostrarInactivos]);

  // Guards UI
  if (userLoading || aclLoading) {
    return <div className="p-6">Cargando permisos…</div>;
  }
  if (isClienteOnly) {
    return <div className="p-6">No tienes acceso a esta página.</div>;
  }
  if (!canView) {
    return <div className="p-6">No tienes permiso para ver clientes.</div>;
  }

  // ----------------------------
  // Edit dialog helpers
  // ----------------------------
  const abrirEditar = (cliente: Cliente) => {
    setClienteEditando(cliente);
    setMostrarDialogo(true);
  };

  const cerrarDialogo = () => {
    setClienteEditando(null);
    setMostrarDialogo(false);
  };

  const [exportando, setExportando] = useState(false);

  const TIPIFICACIONES_INACTIVAS = new Set<string>([
    TipificacionDeuda.INACTIVO,
    TipificacionDeuda.TERMINADO,
    TipificacionDeuda.DEMANDA_TERMINADO,
    TipificacionDeuda.DEVUELTO,
  ]);

  async function exportarExcel() {
    if (exportando) return;
    setExportando(true);
    try {
      const rows = await Promise.all(
        clientesFiltrados.map(async (c) => {
          const cc = c as any;
          const uid = cc.usuarioUid ?? c.id;

          // Cargar usuario vinculado para email y teléfono
          const usuario = uid ? await getUsuarioByUid(uid) : null;

          // Contar deudores activos
          const deudores = c.id ? await obtenerDeudorPorCliente(c.id) : [];
          const deudoresActivos = deudores.filter(
            (d) => !TIPIFICACIONES_INACTIVAS.has(d.tipificacion ?? "")
          ).length;

          return {
            Nombre: cc.nombre ?? c.id ?? "",
            NIT: cc.nit ?? cc.numeroDocumento ?? "",
            Correo: usuario?.email ?? cc.email ?? "",
            Teléfono: (usuario as any)?.telefonoUsuario ?? cc.telefono ?? "",
            Dirección: c.direccion ?? "",
            Administrador: c.administrador ?? "",
            "Deudores activos": deudoresActivos,
          };
        })
      );

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Clientes");
      XLSX.writeFile(wb, `Clientes_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch {
      toast.error("Error al exportar el archivo");
    } finally {
      setExportando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-brand-primary/10">
                  <Users className="h-6 w-6 text-brand-primary" />
                </div>
                <div>
                  <Typography
                    variant="h2"
                    className="!text-brand-primary font-bold"
                  >
                    Gestión de Clientes
                  </Typography>
                  <Typography variant="small" className="mt-0.5">
                    {clientesFiltrados.length}{" "}
                    {clientesFiltrados.length === 1
                      ? "cliente encontrado"
                      : "clientes encontrados"}
                  </Typography>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={exportarExcel}
              disabled={clientesFiltrados.length === 0 || exportando}
              className="gap-2 border-brand-secondary/30 shadow-sm self-start md:self-auto"
            >
              <Download className={`h-4 w-4 ${exportando ? "animate-pulse" : ""}`} />
              {exportando ? "Exportando..." : "Exportar Excel"}
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <Typography
              variant="h3"
              className="!text-brand-secondary font-semibold"
            >
              Búsqueda de clientes
            </Typography>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-4 lg:grid-cols-5">
              <div className="md:col-span-2 lg:col-span-2">
                <Label className="mb-2 block text-brand-secondary font-medium">
                  Búsqueda
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-secondary/60" />
                  <Input
                    value={q}
                    onChange={(e) => {
                      const val = e.target.value;
                      setQ(val);
                      if (val) sessionStorage.setItem(SESSION_KEY, val);
                      else sessionStorage.removeItem(SESSION_KEY);
                    }}
                    placeholder="Buscar por nombre..."
                    className="pl-9 border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                  />
                  {q && (
                    <button
                      type="button"
                      onClick={() => { setQ(""); sessionStorage.removeItem(SESSION_KEY); }}
                      aria-label="Limpiar búsqueda"
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1  hover:bg-gray-100 transition-colors"
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
                  onClick={() => { setQ(""); sessionStorage.removeItem(SESSION_KEY); }}
                >
                  Limpiar búsqueda
                </Button>
              </div>

              <div className="flex items-end">
                <Button
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full border-brand-secondary/30 hover:bg-brand-primary/5",
                    mostrarInactivos
                      ? "text-amber-600 border-amber-300 bg-amber-50"
                      : "text-brand-secondary"
                  )}
                  onClick={() => setMostrarInactivos((v) => !v)}
                >
                  {mostrarInactivos ? "Ocultar inactivos" : "Ver inactivos"}
                </Button>
              </div>
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
              <Typography variant="body" >
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
              <Typography variant="small" className=" max-w-md">
                {q
                  ? "No se encontraron clientes que coincidan con tu búsqueda."
                  : mostrarInactivos
                  ? "No hay clientes inactivos."
                  : "No hay clientes activos."}
              </Typography>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[600px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">
                      Nombre
                    </TableHead>
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Acciones
                    </TableHead>
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
                                  onClick={() =>
                                    navigate(`/deudores/${cliente.id}`)
                                  }
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
                                  onClick={() =>
                                    navigate(`/clientes/${cliente.id}`)
                                  }
                                  className="hover:bg-green-50 transition-colors"
                                >
                                  <User className="w-4 h-4 text-green-600" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent className="bg-brand-secondary text-white">
                                Ver perfil del cliente
                              </TooltipContent>
                            </Tooltip>

                            {/* Editar solo si puede */}
                            {canEdit && (
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
                            )}
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

        <ClienteEditDialog
          cliente={clienteEditando}
          open={mostrarDialogo}
          onClose={cerrarDialogo}
          onSaved={fetchClientes}
        />
      </div>
    </div>
  );
}
