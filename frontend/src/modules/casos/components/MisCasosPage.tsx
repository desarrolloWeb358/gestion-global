// modules/casos/components/MisCasosPage.tsx
// Home del rol `clienteCaso`: sus casos y el avance de cada uno.
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { CalendarClock, ChevronRight, FileText, Gavel, Scale } from "lucide-react";

import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";
import { toDateSafe } from "@/modules/cobranza/models/demanda.model";
import { getCasos } from "../services/casoService";
import { getClienteParticularById } from "../services/clienteParticularService";
import { ESTADO_CASO_LABEL, type Caso } from "../models/caso.model";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

function fmtFecha(v: any): string {
  const d = toDateSafe(v);
  return d ? fmt.format(d) : "—";
}

export default function MisCasosPage() {
  const navigate = useNavigate();
  const { usuario, usuarioSistema, loading: authLoading } = useUsuarioActual();

  const [casos, setCasos] = React.useState<Caso[]>([]);
  const [nombre, setNombre] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const load = async () => {
      if (!usuario?.uid) return;
      try {
        setLoading(true);
        const [cs, cli] = await Promise.all([
          getCasos(usuario.uid),
          getClienteParticularById(usuario.uid),
        ]);
        setCasos(cs);
        setNombre(cli?.nombre ?? usuarioSistema?.nombre ?? "");
      } catch {
        toast.error("⚠️ No se pudieron cargar tus casos");
      } finally {
        setLoading(false);
      }
    };
    if (!authLoading) load();
  }, [usuario?.uid, usuarioSistema?.nombre, authLoading]);

  const activos = casos.filter((c) => c.estado === "activo");
  const terminados = casos.filter((c) => c.estado === "terminado");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-5xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-brand-primary/10">
            <Scale className="h-6 w-6 text-brand-primary" />
          </div>
          <div>
            <Typography variant="h1" className="!text-brand-primary font-bold">
              Mis casos
            </Typography>
            <Typography variant="small">
              {nombre ? `${nombre} · ` : ""}
              Avance de los procesos que Gestión Global gestiona para ti.
            </Typography>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Resumen titulo="Casos activos" valor={activos.length} color="green" />
          <Resumen titulo="Casos terminados" valor={terminados.length} color="gray" />
          <Resumen titulo="Total" valor={casos.length} color="brand" />
        </div>

        {casos.length === 0 ? (
          <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm space-y-3">
            <div className="p-4 rounded-full bg-brand-primary/10 inline-flex">
              <Gavel className="h-8 w-8 text-brand-primary/60" />
            </div>
            <Typography variant="h3" className="text-brand-secondary">
              Todavía no tienes casos registrados
            </Typography>
            <Typography variant="small">
              Cuando tu abogado registre un caso, aparecerá aquí con todo su avance.
            </Typography>
          </div>
        ) : (
          <div className="space-y-3">
            {casos.map((caso) => (
              <button
                key={caso.id}
                onClick={() => navigate(`/mis-casos/${caso.id}`)}
                className="group w-full text-left rounded-2xl border-2 border-brand-secondary/20 bg-white p-5 transition-all hover:border-brand-primary hover:shadow-lg"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Typography variant="h3" className="!text-brand-secondary text-base">
                        {caso.titulo || "Caso sin título"}
                      </Typography>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                          caso.estado === "terminado"
                            ? "bg-gray-100 text-gray-700"
                            : "bg-green-100 text-green-800"
                        )}
                      >
                        {ESTADO_CASO_LABEL[caso.estado]}
                      </span>
                    </div>

                    <p className="text-sm text-muted-foreground">
                      {[caso.tipoCaso, caso.juzgado, caso.numeroRadicado]
                        .filter(Boolean)
                        .join(" · ") || "Sin datos judiciales registrados"}
                    </p>

                    <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3.5 w-3.5" />
                        Última actualización: {fmtFecha(caso.fechaUltimaRevision)}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <FileText className="h-3.5 w-3.5" />
                        {(caso.documentos ?? []).length} documento(s)
                      </span>
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 text-brand-primary shrink-0 transition-transform group-hover:translate-x-1" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Resumen({
  titulo,
  valor,
  color,
}: {
  titulo: string;
  valor: number;
  color: "green" | "gray" | "brand";
}) {
  const estilos = {
    green: "border-green-200 bg-green-50/50 text-green-800",
    gray: "border-gray-200 bg-gray-50 text-gray-700",
    brand: "border-brand-secondary/20 bg-brand-primary/5 text-brand-primary",
  }[color];

  return (
    <div className={cn("rounded-2xl border p-5 shadow-sm", estilos)}>
      <p className="text-sm font-medium opacity-80">{titulo}</p>
      <p className="text-3xl font-bold mt-1">{valor}</p>
    </div>
  );
}
