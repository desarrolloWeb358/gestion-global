// src/modules/cobranza/components/reportes/SeguimientoDemandasClienteSection.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    FileText,
    Gavel,
    Hash,
    Home,
    Search,
    Users,
    ListChecks,
} from "lucide-react";

import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import { Separator } from "@/shared/ui/separator";
import { Badge } from "@/shared/ui/badge";
import { Input } from "@/shared/ui/input";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/shared/ui/accordion";

import {
    DemandaDeudorItem,
    obtenerDemandasConSeguimientoCliente,
} from "../../services/reportes/seguimientoDemandaService";

function formatDateES(d: Date | null) {
    if (!d) return "";
    return d.toLocaleDateString("es-CO", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    });
}

function formatDateDDMMYYYY(date: Date) {
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

type Props = {
    clienteId: string;
    year: number;
    month: number; // 1..12
};

export default function SeguimientoDemandasClienteSection({ clienteId, year, month }: Props) {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<DemandaDeudorItem[]>([]);
    const [q, setQ] = useState("");

    useEffect(() => {
        if (!clienteId) return;

        (async () => {
            try {
                setLoading(true);
                const res = await obtenerDemandasConSeguimientoCliente(clienteId, year, month);
                setData(res);
            } catch (e) {
                console.error(e);
                toast.error("Error cargando seguimiento de demandas");
            } finally {
                setLoading(false);
            }
        })();
    }, [clienteId, year, month]);

    const resumen = useMemo(() => {
        const total = data.length;
        const conSeguimiento = data.filter((d) => d.seguimientos.length > 0).length;
        const sinSeguimiento = total - conSeguimiento;
        return { total, conSeguimiento, sinSeguimiento };
    }, [data]);

    const filtrado = useMemo(() => {
        const query = q.trim().toLowerCase();
        if (!query) return data;

        return data.filter((d) => {
            const blob = [
                d.ubicacion,
                d.demandados,
                d.numeroRadicado,
                d.juzgado,
                d.observacionCliente,
            ]
                .join(" ")
                .toLowerCase();

            return blob.includes(query);
        });
    }, [data, q]);

    return (
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Gavel className="h-5 w-5 text-brand-primary" />
                        <div>
                            <Typography variant="h3" className="!text-brand-secondary font-semibold">
                                Seguimiento de demandas
                            </Typography>

                        </div>
                    </div>


                </div>

                <div className="mt-4">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Buscar por inmueble, demandado, radicado, juzgado..."
                            className="pl-9 bg-white border-brand-secondary/20"
                        />
                    </div>
                </div>
            </div>

            <div className="p-4 md:p-5">
                {loading ? (
                    <div className="rounded-xl border border-brand-secondary/20 bg-white p-12 text-center">
                        <div className="flex flex-col items-center gap-4">
                            <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
                            <Typography variant="small" className="text-muted-foreground">
                                Cargando demandas...
                            </Typography>
                        </div>
                    </div>
                ) : filtrado.length === 0 ? (
                    <div className="rounded-xl border border-brand-secondary/20 bg-white p-10 text-center">
                        <Typography variant="body" className="text-muted-foreground">
                            No hay demandas para mostrar.
                        </Typography>
                    </div>
                ) : (
                    <Accordion type="multiple" className="space-y-3">
                        {filtrado.map((d) => {
                            const headerBadges = (
                                <div className="flex flex-wrap items-center gap-2">
                                    {d.numeroRadicado ? (
                                        <Badge variant="outline" className="gap-1 border-brand-secondary/20">
                                            <Hash className="h-3.5 w-3.5 text-brand-primary" />
                                            Radicado: {d.numeroRadicado}
                                        </Badge>
                                    ) : null}

                                    {d.juzgado ? (
                                        <Badge variant="outline" className="gap-1 border-brand-secondary/20">
                                            <Gavel className="h-3.5 w-3.5 text-brand-primary" />
                                            {d.juzgado}
                                        </Badge>
                                    ) : null}



                                </div>
                            );

                            return (
                                <AccordionItem
                                    key={d.deudorId}
                                    value={d.deudorId}
                                    className="rounded-xl border border-brand-secondary/15 bg-white overflow-hidden"
                                >
                                    <AccordionTrigger className="px-4 py-4 hover:no-underline hover:bg-brand-primary/[0.03]">
                                        <div className="w-full flex items-start justify-between gap-3 flex-wrap">
                                            <div className="flex items-center gap-2">
                                                <div className="p-2 rounded-lg bg-brand-primary/10">
                                                    <Home className="h-4 w-4 text-brand-primary" />
                                                </div>
                                                <div className="text-left">
                                                    <Typography
                                                        variant="body"
                                                        className="font-semibold text-brand-secondary"
                                                    >
                                                        {d.ubicacion || "Sin ubicación"}
                                                    </Typography>
                                                    <Typography variant="small" className="text-muted-foreground">
                                                        {d.demandados ? `Demandado(s): ${d.demandados}` : "—"}
                                                    </Typography>
                                                </div>
                                            </div>

                                            <div className="mt-1">{headerBadges}</div>
                                        </div>
                                    </AccordionTrigger>

                                    <AccordionContent className="px-4 pb-4">
                                        {/* LISTADO ORDENADO: 1) observacionCliente 2) seguimientos */}
                                        <div className="rounded-xl border border-brand-secondary/15 bg-white overflow-hidden">
                                            {/* Header del listado */}
                                            <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 px-4 py-3 border-b border-brand-secondary/10">
                                                <div className="flex items-center gap-2">
                                                    <FileText className="h-4 w-4 text-brand-primary" />
                                                    <Typography variant="small" className="text-brand-secondary font-semibold">
                                                        Observaciones / Seguimiento
                                                    </Typography>
                                                </div>
                                                <Typography variant="small" className="text-muted-foreground">
                                                    Listado cronológico (primero: observación del conjunto)
                                                </Typography>
                                            </div>

                                            {/* Body */}
                                            <div className="p-4">
                                                {(() => {
                                                    const lista = [
                                                        ...[...d.seguimientos]
                                                            .sort((a, b) => (b.fecha?.getTime() ?? 0) - (a.fecha?.getTime() ?? 0))
                                                            .map((s) => ({ texto: s.descripcion || "Sin descripción", fecha: s.fecha ?? null })),

                                                        ...(d.observacionCliente?.trim()
                                                            ? [{ texto: d.observacionCliente.trim(), fecha: null }]
                                                            : []),
                                                    ];


                                                    return (
                                                        <div className="rounded-xl border border-brand-secondary/10 bg-white overflow-hidden">
                                                            <div className="divide-y divide-brand-secondary/10">
                                                                {lista.map((item, idx) => (
                                                                    <div key={idx} className="px-4 py-3">
                                                                        <Typography
                                                                            variant="body"
                                                                            className="text-brand-secondary"
                                                                            style={{ whiteSpace: "pre-line" }}
                                                                        >
                                                                            {item.fecha && (
                                                                                <span className="text-brand-secondary/80 font-medium">
                                                                                    {formatDateDDMMYYYY(item.fecha)}{" "}
                                                                                </span>
                                                                            )}
                                                                            {item.texto}
                                                                        </Typography>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })()}
                                            </div>


                                        </div>
                                    </AccordionContent>

                                </AccordionItem>
                            );
                        })}
                    </Accordion>
                )}
            </div>
        </section>
    );
}
