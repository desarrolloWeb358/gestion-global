// modules/casos/components/ClientesParticularesTable.tsx
// Lista de clientes particulares (personas naturales/jurídicas con casos).
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Briefcase, Eye, Search, Trash2, UserRound, Building } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { PERMS } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { obtenerFranquicias } from "@/modules/franquicias/services/franquiciaService";
import type { Franquicia } from "@/modules/franquicias/models/franquicia.model";
import {
  obtenerClientesParticulares,
  eliminarClienteParticular,
} from "../services/clienteParticularService";
import type { ClienteParticular } from "../models/clienteParticular.model";

const TODAS = "__todas__";

export default function ClientesParticularesTable() {
  const navigate = useNavigate();
  const { can } = useAcl();
  const { roles, usuarioSistema } = useUsuarioActual();

  const puedeVer = can(PERMS.ClientesParticulares_Read);
  const puedeEditar = can(PERMS.ClientesParticulares_Edit);

  const [rows, setRows] = React.useState<ClienteParticular[]>([]);
  const [franquicias, setFranquicias] = React.useState<Franquicia[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [busqueda, setBusqueda] = React.useState("");
  const [franquiciaFiltro, setFranquiciaFiltro] = React.useState(TODAS);

  React.useEffect(() => {
    const load = async () => {
      if (!puedeVer) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [clientes, frs] = await Promise.all([
          obtenerClientesParticulares({
            roles,
            franquiciasAsignadas: usuarioSistema?.franquiciasAsignadas,
          }),
          obtenerFranquicias(),
        ]);
        setRows(clientes);
        setFranquicias(frs);
      } catch {
        toast.error("⚠️ No se pudieron cargar los clientes");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [roles, usuarioSistema?.franquiciasAsignadas, puedeVer]);

  if (!puedeVer) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Typography variant="h3">No tienes acceso a esta sección.</Typography>
      </div>
    );
  }

  const nombreFranquicia = (id?: string) =>
    franquicias.find((f) => f.id === id)?.nombre ?? "—";

  const visibles = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows
      .filter((c) =>
        franquiciaFiltro === TODAS ? true : c.franquiciaId === franquiciaFiltro
      )
      .filter((c) =>
        !q
          ? true
          : [c.nombre, c.numeroDocumento, c.ciudad, ...(c.correos ?? [])]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
      );
  }, [rows, busqueda, franquiciaFiltro]);

  const eliminar = async (cliente: ClienteParticular) => {
    if (
      !window.confirm(
        `¿Eliminar a "${cliente.nombre}" y TODOS sus casos? Esta acción no se puede deshacer.`
      )
    )
      return;
    try {
      await eliminarClienteParticular(cliente.id!);
      setRows((prev) => prev.filter((c) => c.id !== cliente.id));
      toast.success("✓ Cliente eliminado");
    } catch {
      toast.error("⚠️ No se pudo eliminar el cliente");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              <Briefcase className="h-6 w-6 text-brand-primary" />
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                Clientes particulares
              </Typography>
              <Typography variant="small">
                Personas naturales y jurídicas con casos gestionados por Gestión Global.
              </Typography>
            </div>
          </div>
        </header>

        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-4 shadow-sm flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[220px] space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Nombre, documento, correo o ciudad"
                className="pl-9 border-brand-secondary/30"
              />
            </div>
          </div>

          <div className="min-w-[200px] space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Franquicia</label>
            <Select value={franquiciaFiltro} onValueChange={setFranquiciaFiltro}>
              <SelectTrigger className="border-brand-secondary/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas</SelectItem>
                {franquicias.map((f) => (
                  <SelectItem key={f.id} value={f.id!}>
                    {f.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
            <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm space-y-3">
            <div className="p-4 rounded-full bg-brand-primary/10 inline-flex">
              <Briefcase className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              No hay clientes particulares
            </Typography>
            <Typography variant="small">
              Se crean desde <strong>Usuarios</strong>, asignando el rol{" "}
              <strong>clienteCaso</strong>.
            </Typography>
          </div>
        ) : (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Nombre</TableHead>
                    <TableHead className="w-[140px] text-brand-secondary font-semibold">Tipo</TableHead>
                    <TableHead className="w-[150px] text-brand-secondary font-semibold">Documento</TableHead>
                    <TableHead className="text-brand-secondary font-semibold">Contacto</TableHead>
                    <TableHead className="w-[150px] text-brand-secondary font-semibold">Franquicia</TableHead>
                    <TableHead className="w-[120px] text-brand-secondary font-semibold">Ciudad</TableHead>
                    <TableHead className="w-[120px] text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibles.map((c, index) => (
                    <TableRow
                      key={c.id}
                      onClick={() => navigate(`/clientes-particulares/${c.id}`)}
                      className={cn(
                        "border-brand-secondary/5 transition-colors cursor-pointer hover:bg-brand-primary/5",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                      )}
                    >
                      <TableCell className="font-medium text-gray-800">
                        {c.nombre || "—"}
                        {c.activo === false && (
                          <span className="ml-2 inline-flex items-center rounded-full bg-gray-100 text-gray-600 px-2 py-0.5 text-xs">
                            Inactivo
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                          {c.tipoPersona === "juridica" ? (
                            <Building className="h-3.5 w-3.5 text-indigo-600" />
                          ) : (
                            <UserRound className="h-3.5 w-3.5 text-brand-primary" />
                          )}
                          {c.tipoPersona === "juridica" ? "Jurídica" : "Natural"}
                        </span>
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {c.numeroDocumento || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700 text-sm">
                        {c.correos?.[0] || c.telefonos?.[0] || "—"}
                      </TableCell>
                      <TableCell className="text-gray-700">
                        {nombreFranquicia(c.franquiciaId)}
                      </TableCell>
                      <TableCell className="text-gray-700">{c.ciudad || "—"}</TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-center gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => navigate(`/clientes-particulares/${c.id}`)}
                            className="hover:bg-brand-primary/10"
                            title="Ver cliente"
                          >
                            <Eye className="h-4 w-4 text-brand-primary" />
                          </Button>
                          {puedeEditar && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => eliminar(c)}
                              className="hover:bg-red-50"
                              title="Eliminar cliente"
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
