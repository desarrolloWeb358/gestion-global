import { Typography } from "@/shared/design-system/components/Typography";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/shared/ui/table";
import { cn } from "@/shared/lib/cn";
import { fmtDate, type ValoresAgregadosPorTipo } from "../../services/reportes/valorAgregadoReporteService";

type Props = {
  grupos: ValoresAgregadosPorTipo[];
  mostrarPendientes: boolean; // true = admin/ejecutivo, false = cliente/word
};

export default function ValoresAgregadosReporteSection({ grupos, mostrarPendientes }: Props) {
  if (grupos.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-gradient-to-br from-brand-primary to-brand-secondary">
          <span className="text-white text-sm font-bold px-1">VA</span>
        </div>
        <Typography variant="h2" className="!text-brand-secondary">
          Asesoría Jurídica
        </Typography>
      </div>

      {grupos.map((grupo) => (
        <div
          key={grupo.tipo}
          className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden"
        >
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-5 py-3 border-b border-brand-secondary/10">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              {grupo.tipoLabel}
            </Typography>
          </div>

          <div className="overflow-x-auto">
            <Table className="min-w-[600px]">
              <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                  <TableHead className="text-brand-secondary font-semibold">Título</TableHead>
                  <TableHead className="w-[140px] text-brand-secondary font-semibold">Fecha solicitado</TableHead>
                  <TableHead className="w-[140px] text-brand-secondary font-semibold">Fecha entregado</TableHead>
                  <TableHead className="text-brand-secondary font-semibold">Archivo(s)</TableHead>
                  {mostrarPendientes && (
                    <TableHead className="w-[110px] text-brand-secondary font-semibold text-center">Estado</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {grupo.items.map((item, idx) => (
                  <TableRow
                    key={item.id}
                    className={cn(
                      "border-brand-secondary/5",
                      idx % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                    )}
                  >
                    <TableCell className="text-gray-800 font-medium">{item.titulo || "—"}</TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {fmtDate(item.fechaSolicitado)}
                    </TableCell>
                    <TableCell className="text-gray-600 text-sm">
                      {fmtDate(item.fechaEntregado)}
                    </TableCell>
                    <TableCell>
                      {item.archivos.length === 0 ? (
                        <span className="text-gray-400 text-sm">—</span>
                      ) : (
                        <div className="flex flex-col gap-1">
                          {item.archivos.map((a, i) => (
                            <a
                              key={i}
                              href={a.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-brand-primary hover:text-brand-secondary text-sm underline underline-offset-2 truncate max-w-[220px]"
                            >
                              {a.nombre || `Archivo ${i + 1}`}
                            </a>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    {mostrarPendientes && (
                      <TableCell className="text-center">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                            item.completado
                              ? "bg-green-100 text-green-800"
                              : "bg-yellow-100 text-yellow-800"
                          )}
                        >
                          {item.completado ? "Entregado" : "Pendiente"}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
