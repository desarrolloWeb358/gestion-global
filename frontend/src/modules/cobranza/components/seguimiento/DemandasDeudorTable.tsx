// modules/cobranza/components/seguimiento/DemandasDeudorTable.tsx
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Gavel,
  Plus,
  Eye,
  Trash2,
  Tag,
  Calendar as CalendarIcon,
  Hash,
  Building2,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { PERMS, type Perm } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import {
  getDemandas,
  crearDemanda,
  eliminarDemanda,
} from "@/modules/cobranza/services/demandaService";
import { Demanda, toDateSafe } from "@/modules/cobranza/models/demanda.model";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtFecha(v: any): string {
  const d = toDateSafe(v);
  return d ? fmt.format(d) : "—";
}

const DemandasDeudorTable = React.forwardRef<any, {}>((_, ref) => {
  const { clienteId, deudorId } = useParams();
  const navigate = useNavigate();

  const acl = useAcl() as { can: (req: Perm | Perm[]) => boolean };
  const puedeEditar = acl.can(PERMS.Seguimientos_Dependientes_Edit);

  const [rows, setRows] = React.useState<Demanda[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [creando, setCreando] = React.useState(false);

  const load = async () => {
    if (!clienteId || !deudorId) return;
    try {
      setLoading(true);
      const data = await getDemandas(clienteId, deudorId);
      setRows(data);
    } catch {
      toast.error("⚠️ No se pudieron cargar las demandas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, [clienteId, deudorId]);

  const crearNueva = async () => {
    if (!puedeEditar) {
      toast.error("No tienes permiso para crear demandas.");
      return;
    }
    if (!clienteId || !deudorId || creando) return;
    try {
      setCreando(true);
      const id = await crearDemanda(clienteId, deudorId, { estado: "activa" });
      toast.success("✓ Demanda creada");
      navigate(`/clientes/${clienteId}/deudores/${deudorId}/demandas/${id}`);
    } catch {
      toast.error("⚠️ No se pudo crear la demanda");
    } finally {
      setCreando(false);
    }
  };

  // Permite que el botón del header (SeguimientoTable) dispare "Nueva demanda"
  React.useImperativeHandle(ref, () => ({ openForm: crearNueva }));

  const abrir = (demandaId: string) =>
    navigate(`/clientes/${clienteId}/deudores/${deudorId}/demandas/${demandaId}`);

  const eliminar = async (demandaId: string) => {
    if (!puedeEditar) {
      toast.error("No tienes permiso para eliminar demandas.");
      return;
    }
    if (!clienteId || !deudorId) return;
    if (!window.confirm("¿Eliminar esta demanda y todo su seguimiento?")) return;
    try {
      await eliminarDemanda(clienteId, deudorId, demandaId);
      toast.success("✓ Demanda eliminada");
      setRows((prev) => prev.filter((d) => d.id !== demandaId));
    } catch {
      toast.error("⚠️ No se pudo eliminar la demanda");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gavel className="h-5 w-5 text-red-600" />
          <Typography variant="h3" className="!text-red-700 font-semibold">
            Demandas del deudor
          </Typography>
        </div>
        {puedeEditar && (
          <Button variant="brand" onClick={crearNueva} disabled={creando} className="gap-2">
            <Plus className="h-4 w-4" />
            {creando ? "Creando..." : "Nueva demanda"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            <Typography variant="body">Cargando demandas...</Typography>
          </div>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="p-4 rounded-full bg-brand-primary/10">
              <Gavel className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              No hay demandas
            </Typography>
            <Typography variant="small">
              {puedeEditar
                ? 'Crea la primera con "Nueva demanda".'
                : "Aún no se han registrado demandas."}
            </Typography>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table className="min-w-[800px]">
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="text-brand-secondary font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Hash className="h-3.5 w-3.5" /> Radicado
                    </span>
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> Juzgado
                    </span>
                  </TableHead>
                  <TableHead className="w-[110px] text-brand-secondary font-semibold text-center">
                    Estado
                  </TableHead>
                  <TableHead className="text-brand-secondary font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5" /> Etiquetas
                    </span>
                  </TableHead>
                  <TableHead className="w-[150px] text-brand-secondary font-semibold">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" /> Última revisión
                    </span>
                  </TableHead>
                  <TableHead className="w-[130px] text-center text-brand-secondary font-semibold">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((d, index) => (
                  <TableRow
                    key={d.id}
                    className={cn(
                      "border-brand-secondary/5 transition-colors cursor-pointer",
                      index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                      "hover:bg-brand-primary/5"
                    )}
                    onClick={() => abrir(d.id!)}
                  >
                    <TableCell className="font-medium text-gray-800">
                      {d.numeroRadicado || "—"}
                    </TableCell>
                    <TableCell className="text-gray-700">{d.juzgado || "—"}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                          d.estado === "terminada"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-green-100 text-green-800"
                        )}
                      >
                        {d.estado === "terminada" ? "Terminada" : "Activa"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(d.etiquetas ?? []).length === 0 ? (
                          <span className="text-sm text-muted-foreground">—</span>
                        ) : (
                          (d.etiquetas ?? []).slice(0, 3).map((e, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-xs"
                            >
                              {e.nombre}
                            </span>
                          ))
                        )}
                        {(d.etiquetas ?? []).length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{(d.etiquetas ?? []).length - 3}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-700">
                      {fmtFecha(d.fechaUltimaRevision)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => abrir(d.id!)}
                          className="hover:bg-brand-primary/10"
                          title="Ver demanda"
                        >
                          <Eye className="h-4 w-4 text-brand-primary" />
                        </Button>
                        {puedeEditar && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => eliminar(d.id!)}
                            className="hover:bg-red-50"
                            title="Eliminar demanda"
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
  );
});

DemandasDeudorTable.displayName = "DemandasDeudorTable";

export default DemandasDeudorTable;
