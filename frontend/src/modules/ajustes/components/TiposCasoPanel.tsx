// modules/ajustes/components/TiposCasoPanel.tsx
// Panel del catálogo de tipos de caso (configuracion/tiposCaso).
// Mismo patrón que EtiquetasDemandaPanel.
import * as React from "react";
import { toast } from "sonner";
import { Scale, Plus, Trash2, Save, Check, X } from "lucide-react";

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
import { cn } from "@/shared/lib/cn";
import {
  getTiposCaso,
  crearTipoCaso,
  actualizarTipoCaso,
  eliminarTipoCaso,
} from "@/modules/casos/services/tipoCasoService";
import type { TipoCaso } from "@/modules/casos/models/tipoCaso.model";

export default function TiposCasoPanel() {
  const [rows, setRows] = React.useState<TipoCaso[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [nuevo, setNuevo] = React.useState("");
  const [creando, setCreando] = React.useState(false);
  const [editId, setEditId] = React.useState<string | null>(null);
  const [editNombre, setEditNombre] = React.useState("");

  const load = async () => {
    try {
      setLoading(true);
      setRows(await getTiposCaso(false));
    } catch {
      toast.error("⚠️ No se pudieron cargar los tipos de caso");
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
      await crearTipoCaso({ nombre });
      setNuevo("");
      toast.success("✓ Tipo de caso creado");
      await load();
    } catch {
      toast.error("⚠️ No se pudo crear el tipo");
    } finally {
      setCreando(false);
    }
  };

  const guardarEdit = async (id: string) => {
    const nombre = editNombre.trim();
    if (!nombre) return;
    try {
      await actualizarTipoCaso(id, { nombre });
      setEditId(null);
      toast.success("✓ Tipo actualizado");
      await load();
    } catch {
      toast.error("⚠️ No se pudo actualizar");
    }
  };

  const toggleActivo = async (t: TipoCaso) => {
    try {
      await actualizarTipoCaso(t.id!, { activo: !t.activo });
      setRows((prev) => prev.map((r) => (r.id === t.id ? { ...r, activo: !t.activo } : r)));
    } catch {
      toast.error("⚠️ No se pudo cambiar el estado");
    }
  };

  const eliminar = async (t: TipoCaso) => {
    if (!window.confirm(`¿Eliminar el tipo "${t.nombre}"?`)) return;
    try {
      await eliminarTipoCaso(t.id!, t.nombre);
      toast.success("✓ Tipo eliminado");
      setRows((prev) => prev.filter((r) => r.id !== t.id));
    } catch {
      toast.error("⚠️ No se pudo eliminar");
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          <Scale className="h-6 w-6 text-red-600" /> Tipos de caso
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Catálogo usado al clasificar los casos de clientes particulares
          (ejecutivo, verbal, tutela, sucesión, derecho de petición, asesoría...).
        </p>
      </div>

      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="p-4 md:p-5 border-b border-brand-secondary/10 flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <label className="text-xs text-muted-foreground font-medium">Nuevo tipo</label>
            <Input
              value={nuevo}
              onChange={(e) => setNuevo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && crear()}
              placeholder="Ej: Proceso ejecutivo"
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
          <div className="p-12 text-center text-muted-foreground">
            No hay tipos de caso todavía.
          </div>
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
                {rows.map((t, index) => (
                  <TableRow
                    key={t.id}
                    className={cn(
                      "border-brand-secondary/5",
                      index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                    )}
                  >
                    <TableCell>
                      {editId === t.id ? (
                        <Input
                          value={editNombre}
                          onChange={(ev) => setEditNombre(ev.target.value)}
                          onKeyDown={(ev) => ev.key === "Enter" && guardarEdit(t.id!)}
                          className="border-brand-secondary/30 h-9"
                          autoFocus
                        />
                      ) : (
                        <span className="font-medium text-gray-800">{t.nombre}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        onClick={() => toggleActivo(t)}
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                          t.activo !== false
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-600"
                        )}
                      >
                        {t.activo !== false ? "Activo" : "Inactivo"}
                      </button>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-center gap-2">
                        {editId === t.id ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => guardarEdit(t.id!)} className="hover:bg-green-50">
                              <Save className="h-4 w-4 text-green-600" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditId(null)} className="hover:bg-gray-100">
                              <X className="h-4 w-4 text-gray-500" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setEditId(t.id!);
                                setEditNombre(t.nombre);
                              }}
                              className="hover:bg-brand-primary/10"
                            >
                              <Check className="h-4 w-4 text-brand-primary" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => eliminar(t)} className="hover:bg-red-50">
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
  );
}
