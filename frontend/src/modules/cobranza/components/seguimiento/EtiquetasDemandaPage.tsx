// modules/cobranza/components/seguimiento/EtiquetasDemandaPage.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Tag, Plus, Trash2, Save, ArrowLeft, Check, X } from "lucide-react";

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
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import {
  getEtiquetasDemanda,
  crearEtiquetaDemanda,
  actualizarEtiquetaDemanda,
  eliminarEtiquetaDemanda,
} from "../../services/etiquetaDemandaService";
import type { EtiquetaDemanda } from "../../models/etiquetaDemanda.model";

export default function EtiquetasDemandaPage() {
  const navigate = useNavigate();
  const [rows, setRows] = React.useState<EtiquetaDemanda[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nuevo, setNuevo] = React.useState("");
  const [creando, setCreando] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editNombre, setEditNombre] = React.useState("");

  const load = async () => {
    try {
      setLoading(true);
      setRows(await getEtiquetasDemanda(false));
    } catch {
      toast.error("⚠️ No se pudieron cargar las etiquetas");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    load();
  }, []);

  const crear = async () => {
    const nombre = nuevo.trim();
    if (!nombre || creando) return;
    try {
      setCreando(true);
      await crearEtiquetaDemanda({ nombre });
      setNuevo("");
      toast.success("✓ Etiqueta creada");
      await load();
    } catch {
      toast.error("⚠️ No se pudo crear la etiqueta");
    } finally {
      setCreando(false);
    }
  };

  const guardarEdit = async (id: string) => {
    const nombre = editNombre.trim();
    if (!nombre) return;
    try {
      await actualizarEtiquetaDemanda(id, { nombre });
      setEditId(null);
      toast.success("✓ Etiqueta actualizada");
      await load();
    } catch {
      toast.error("⚠️ No se pudo actualizar");
    }
  };

  const toggleActivo = async (e: EtiquetaDemanda) => {
    try {
      await actualizarEtiquetaDemanda(e.id!, { activo: !e.activo });
      setRows((prev) => prev.map((r) => (r.id === e.id ? { ...r, activo: !e.activo } : r)));
    } catch {
      toast.error("⚠️ No se pudo cambiar el estado");
    }
  };

  const eliminar = async (e: EtiquetaDemanda) => {
    if (!window.confirm(`¿Eliminar la etiqueta "${e.nombre}"?`)) return;
    try {
      await eliminarEtiquetaDemanda(e.id!, e.nombre);
      toast.success("✓ Etiqueta eliminada");
      setRows((prev) => prev.filter((r) => r.id !== e.id));
    } catch {
      toast.error("⚠️ No se pudo eliminar");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-3xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <header className="space-y-4">
          <AppBreadcrumb
            items={[{ label: "Inicio", href: "/" }, { label: "Etiquetas de demanda" }]}
          />
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <Tag className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <Typography variant="h1" className="!text-brand-primary font-bold">
                  Etiquetas de demanda
                </Typography>
                <Typography variant="small">
                  Catálogo usado para clasificar y consultar demandas.
                </Typography>
              </div>
            </div>
            <Button variant="outline" onClick={() => navigate(-1)} className="gap-2 border-brand-secondary/30">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Button>
          </div>
        </header>

        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="p-4 md:p-5 border-b border-brand-secondary/10 flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground font-medium">Nueva etiqueta</label>
              <Input
                value={nuevo}
                onChange={(e) => setNuevo(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && crear()}
                placeholder="Ej: Pendiente notificación"
                className="border-brand-secondary/30"
              />
            </div>
            <Button variant="brand" onClick={crear} disabled={creando || !nuevo.trim()} className="gap-2">
              <Plus className="h-4 w-4" /> {creando ? "Creando..." : "Agregar"}
            </Button>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="h-10 w-10 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
            </div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No hay etiquetas todavía.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-brand-secondary font-semibold">Nombre</TableHead>
                    <TableHead className="w-[120px] text-center text-brand-secondary font-semibold">Estado</TableHead>
                    <TableHead className="w-[160px] text-center text-brand-secondary font-semibold">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((e, index) => (
                    <TableRow key={e.id} className={cn("border-brand-secondary/5", index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]")}>
                      <TableCell>
                        {editId === e.id ? (
                          <Input value={editNombre} onChange={(ev) => setEditNombre(ev.target.value)} onKeyDown={(ev) => ev.key === "Enter" && guardarEdit(e.id!)} className="border-brand-secondary/30 h-9" autoFocus />
                        ) : (
                          <span className="font-medium text-gray-800">{e.nombre}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <button onClick={() => toggleActivo(e)} className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", e.activo !== false ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600")}>
                          {e.activo !== false ? "Activa" : "Inactiva"}
                        </button>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-2">
                          {editId === e.id ? (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => guardarEdit(e.id!)} className="hover:bg-green-50">
                                <Save className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="hover:bg-gray-100">
                                <X className="h-4 w-4 text-gray-500" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button size="sm" variant="ghost" onClick={() => { setEditId(e.id!); setEditNombre(e.nombre); }} className="hover:bg-brand-primary/10">
                                <Check className="h-4 w-4 text-brand-primary" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => eliminar(e)} className="hover:bg-red-50">
                                <Trash2 className="h-4 w-4 text-red-600" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
