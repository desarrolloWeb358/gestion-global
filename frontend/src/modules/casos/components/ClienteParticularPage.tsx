// modules/casos/components/ClienteParticularPage.tsx
// Ficha del cliente particular: datos, equipo asignado y sus casos.
import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  Briefcase,
  Building,
  Gavel,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserRound,
  Eye,
  IdCard,
} from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Switch } from "@/shared/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import { Typography } from "@/shared/design-system/components/Typography";
import AppBreadcrumb from "@/shared/components/app-breadcrumb";
import { cn } from "@/shared/lib/cn";
import { PERMS } from "@/shared/constants/acl";
import { useAcl } from "@/modules/auth/hooks/useAcl";
import {
  obtenerAbogados,
  obtenerDependientes,
} from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import { getFranquiciaById } from "@/modules/franquicias/services/franquiciaService";
import { toDateSafe } from "@/modules/cobranza/models/demanda.model";
import {
  getClienteParticularById,
  actualizarClienteParticular,
} from "../services/clienteParticularService";
import { crearCaso, eliminarCaso, getCasos } from "../services/casoService";
import type { ClienteParticular } from "../models/clienteParticular.model";
import { ESTADO_CASO_LABEL, type Caso } from "../models/caso.model";

const SIN_ASIGNAR = "__sin__";

const fmt = new Intl.DateTimeFormat("es-CO", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtFecha(v: any): string {
  const d = toDateSafe(v);
  return d ? fmt.format(d) : "—";
}

export default function ClienteParticularPage() {
  const { clienteParticularId } = useParams<{ clienteParticularId: string }>();
  const navigate = useNavigate();
  const { can } = useAcl();

  const puedeEditarCliente = can(PERMS.ClientesParticulares_Edit);
  const puedeEditarCasos = can(PERMS.Casos_Edit);

  const [cliente, setCliente] = React.useState<ClienteParticular | null>(null);
  const [casos, setCasos] = React.useState<Caso[]>([]);
  const [franquiciaNombre, setFranquiciaNombre] = React.useState("—");
  const [abogados, setAbogados] = React.useState<UsuarioSistema[]>([]);
  const [dependientes, setDependientes] = React.useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [creando, setCreando] = React.useState(false);

  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [form, setForm] = React.useState({
    nombre: "",
    tipoPersona: "natural" as ClienteParticular["tipoPersona"],
    numeroDocumento: "",
    representanteLegal: "",
    correos: "",
    telefonos: "",
    direccion: "",
    abogadoId: SIN_ASIGNAR,
    dependienteId: SIN_ASIGNAR,
    activo: true,
  });

  const cargar = React.useCallback(async () => {
    if (!clienteParticularId) return;
    try {
      setLoading(true);
      const [c, cs, abg, dep] = await Promise.all([
        getClienteParticularById(clienteParticularId),
        getCasos(clienteParticularId),
        obtenerAbogados(),
        obtenerDependientes(),
      ]);
      setCliente(c);
      setCasos(cs);
      setAbogados(abg);
      setDependientes(dep);
      if (c?.franquiciaId) {
        const f = await getFranquiciaById(c.franquiciaId);
        setFranquiciaNombre(f?.nombre ?? "—");
      }
    } catch {
      toast.error("⚠️ No se pudo cargar el cliente");
    } finally {
      setLoading(false);
    }
  }, [clienteParticularId]);

  React.useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirEdicion = () => {
    if (!cliente) return;
    setForm({
      nombre: cliente.nombre ?? "",
      tipoPersona: cliente.tipoPersona ?? "natural",
      numeroDocumento: cliente.numeroDocumento ?? "",
      representanteLegal: cliente.representanteLegal ?? "",
      correos: (cliente.correos ?? []).join(", "),
      telefonos: (cliente.telefonos ?? []).join(", "),
      direccion: cliente.direccion ?? "",
      abogadoId: cliente.abogadoId || SIN_ASIGNAR,
      dependienteId: cliente.dependienteId || SIN_ASIGNAR,
      activo: cliente.activo !== false,
    });
    setEditOpen(true);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clienteParticularId) return;
    const splitLista = (v: string) =>
      v.split(",").map((s) => s.trim()).filter(Boolean);
    try {
      setSaving(true);
      const patch = {
        nombre: form.nombre.trim(),
        tipoPersona: form.tipoPersona,
        numeroDocumento: form.numeroDocumento.trim(),
        representanteLegal: form.representanteLegal.trim(),
        correos: splitLista(form.correos),
        telefonos: splitLista(form.telefonos),
        direccion: form.direccion.trim(),
        abogadoId: form.abogadoId === SIN_ASIGNAR ? null : form.abogadoId,
        dependienteId: form.dependienteId === SIN_ASIGNAR ? null : form.dependienteId,
        activo: form.activo,
      };
      await actualizarClienteParticular(clienteParticularId, patch);
      setCliente((prev) => (prev ? { ...prev, ...patch } : prev));
      toast.success("✓ Cliente actualizado");
      setEditOpen(false);
    } catch {
      toast.error("⚠️ No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const nuevoCaso = async () => {
    if (!clienteParticularId || creando) return;
    try {
      setCreando(true);
      const id = await crearCaso(clienteParticularId, { estado: "activo" });
      toast.success("✓ Caso creado");
      navigate(`/clientes-particulares/${clienteParticularId}/casos/${id}`);
    } catch {
      toast.error("⚠️ No se pudo crear el caso");
    } finally {
      setCreando(false);
    }
  };

  const borrarCaso = async (caso: Caso) => {
    if (!clienteParticularId) return;
    if (!window.confirm("¿Eliminar este caso con todo su seguimiento y documentos?"))
      return;
    try {
      await eliminarCaso(clienteParticularId, caso.id!);
      setCasos((prev) => prev.filter((c) => c.id !== caso.id));
      toast.success("✓ Caso eliminado");
    } catch {
      toast.error("⚠️ No se pudo eliminar el caso");
    }
  };

  const nombreUsuario = (uid?: string | null, lista?: UsuarioSistema[]) =>
    uid ? lista?.find((u) => u.uid === uid)?.nombre ?? uid : "Sin asignar";

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary" />
      </div>
    );
  }

  if (!cliente) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Typography variant="h3">Cliente no encontrado</Typography>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-6xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        <AppBreadcrumb
          items={[
            { label: "Clientes particulares", href: "/clientes-particulares" },
            { label: cliente.nombre || "Cliente" },
          ]}
        />

        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-brand-primary/10">
              {cliente.tipoPersona === "juridica" ? (
                <Building className="h-6 w-6 text-brand-primary" />
              ) : (
                <UserRound className="h-6 w-6 text-brand-primary" />
              )}
            </div>
            <div>
              <Typography variant="h1" className="!text-brand-primary font-bold">
                {cliente.nombre}
              </Typography>
              <Typography variant="small">
                {cliente.tipoPersona === "juridica"
                  ? "Persona jurídica"
                  : "Persona natural"}
                {cliente.numeroDocumento ? ` · ${cliente.numeroDocumento}` : ""}
              </Typography>
            </div>
          </div>

          {puedeEditarCliente && (
            <Button variant="outline" onClick={abrirEdicion} className="gap-2 border-brand-secondary/30">
              <Pencil className="h-4 w-4" />
              Editar cliente
            </Button>
          )}
        </header>

        {/* Datos del cliente */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <Typography variant="h3" className="!text-brand-secondary font-semibold">
              Datos del cliente
            </Typography>
          </div>
          <div className="p-4 md:p-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Dato icon={Mail} label="Correos" valor={(cliente.correos ?? []).join(", ")} />
            <Dato icon={Phone} label="Teléfonos" valor={(cliente.telefonos ?? []).join(", ")} />
            <Dato icon={MapPin} label="Dirección" valor={cliente.direccion} />
            <Dato icon={Building} label="Franquicia" valor={franquiciaNombre} />
            <Dato icon={MapPin} label="Ciudad" valor={cliente.ciudad} />
            {cliente.tipoPersona === "juridica" && (
              <Dato icon={IdCard} label="Representante legal" valor={cliente.representanteLegal} />
            )}
            <Dato
              icon={Gavel}
              label="Abogado"
              valor={nombreUsuario(cliente.abogadoId, abogados)}
            />
            <Dato
              icon={Briefcase}
              label="Dependiente"
              valor={nombreUsuario(cliente.dependienteId, dependientes)}
            />
          </div>
        </section>

        {/* Casos */}
        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Gavel className="h-5 w-5 text-red-600" />
              <Typography variant="h3" className="!text-red-700 font-semibold">
                Casos del cliente
              </Typography>
            </div>
            {puedeEditarCasos && (
              <Button variant="brand" onClick={nuevoCaso} disabled={creando} className="gap-2">
                <Plus className="h-4 w-4" />
                {creando ? "Creando..." : "Nuevo caso"}
              </Button>
            )}
          </div>

          {casos.length === 0 ? (
            <div className="rounded-2xl border border-brand-secondary/20 bg-white p-12 text-center shadow-sm space-y-3">
              <div className="p-4 rounded-full bg-brand-primary/10 inline-flex">
                <Gavel className="h-8 w-8 text-brand-primary/60" />
              </div>
              <Typography variant="h3" className="text-brand-secondary">
                Sin casos registrados
              </Typography>
              <Typography variant="small">
                {puedeEditarCasos
                  ? 'Crea el primero con "Nuevo caso".'
                  : "Aún no se han registrado casos."}
              </Typography>
            </div>
          ) : (
            <div className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <Table className="min-w-[900px]">
                  <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                    <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                      <TableHead className="text-brand-secondary font-semibold">Caso</TableHead>
                      <TableHead className="w-[150px] text-brand-secondary font-semibold">Tipo</TableHead>
                      <TableHead className="w-[160px] text-brand-secondary font-semibold">Radicado</TableHead>
                      <TableHead className="w-[110px] text-center text-brand-secondary font-semibold">Estado</TableHead>
                      <TableHead className="w-[150px] text-brand-secondary font-semibold">Próxima acción</TableHead>
                      <TableHead className="w-[150px] text-brand-secondary font-semibold">Última revisión</TableHead>
                      <TableHead className="w-[120px] text-center text-brand-secondary font-semibold">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {casos.map((caso, index) => (
                      <TableRow
                        key={caso.id}
                        onClick={() =>
                          navigate(
                            `/clientes-particulares/${clienteParticularId}/casos/${caso.id}`
                          )
                        }
                        className={cn(
                          "border-brand-secondary/5 transition-colors cursor-pointer hover:bg-brand-primary/5",
                          index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]"
                        )}
                      >
                        <TableCell className="font-medium text-gray-800">
                          {caso.titulo || "(sin título)"}
                        </TableCell>
                        <TableCell className="text-gray-700">{caso.tipoCaso || "—"}</TableCell>
                        <TableCell className="text-gray-700">
                          {caso.numeroRadicado || "—"}
                        </TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
                              caso.estado === "terminado"
                                ? "bg-gray-100 text-gray-700"
                                : "bg-green-100 text-green-800"
                            )}
                          >
                            {ESTADO_CASO_LABEL[caso.estado]}
                          </span>
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {fmtFecha(caso.proximaAccionFecha)}
                        </TableCell>
                        <TableCell className="text-gray-700">
                          {fmtFecha(caso.fechaUltimaRevision)}
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                navigate(
                                  `/clientes-particulares/${clienteParticularId}/casos/${caso.id}`
                                )
                              }
                              className="hover:bg-brand-primary/10"
                              title="Ver caso"
                            >
                              <Eye className="h-4 w-4 text-brand-primary" />
                            </Button>
                            {puedeEditarCasos && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => borrarCaso(caso)}
                                className="hover:bg-red-50"
                                title="Eliminar caso"
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
        </section>

        {/* Edición */}
        <Dialog open={editOpen} onOpenChange={(o) => !saving && setEditOpen(o)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Editar cliente
              </DialogTitle>
            </DialogHeader>

            <form className="space-y-5" onSubmit={guardar}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-brand-secondary font-medium">Nombre / Razón social</Label>
                  <Input
                    value={form.nombre}
                    onChange={(e) => setForm((s) => ({ ...s, nombre: e.target.value }))}
                    className="mt-1.5 border-brand-secondary/30"
                  />
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">Tipo de persona</Label>
                  <Select
                    value={form.tipoPersona}
                    onValueChange={(v) =>
                      setForm((s) => ({ ...s, tipoPersona: v as ClienteParticular["tipoPersona"] }))
                    }
                  >
                    <SelectTrigger className="mt-1.5 border-brand-secondary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="natural">Persona natural</SelectItem>
                      <SelectItem value="juridica">Persona jurídica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">Documento / NIT</Label>
                  <Input
                    value={form.numeroDocumento}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, numeroDocumento: e.target.value }))
                    }
                    className="mt-1.5 border-brand-secondary/30"
                  />
                </div>

                {form.tipoPersona === "juridica" && (
                  <div>
                    <Label className="text-brand-secondary font-medium">Representante legal</Label>
                    <Input
                      value={form.representanteLegal}
                      onChange={(e) =>
                        setForm((s) => ({ ...s, representanteLegal: e.target.value }))
                      }
                      className="mt-1.5 border-brand-secondary/30"
                    />
                  </div>
                )}

                <div>
                  <Label className="text-brand-secondary font-medium">Abogado</Label>
                  <Select
                    value={form.abogadoId}
                    onValueChange={(v) => setForm((s) => ({ ...s, abogadoId: v }))}
                  >
                    <SelectTrigger className="mt-1.5 border-brand-secondary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                      {abogados.map((u) => (
                        <SelectItem key={u.uid} value={u.uid}>
                          {u.nombre || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-brand-secondary font-medium">Dependiente</Label>
                  <Select
                    value={form.dependienteId}
                    onValueChange={(v) => setForm((s) => ({ ...s, dependienteId: v }))}
                  >
                    <SelectTrigger className="mt-1.5 border-brand-secondary/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={SIN_ASIGNAR}>Sin asignar</SelectItem>
                      {dependientes.map((u) => (
                        <SelectItem key={u.uid} value={u.uid}>
                          {u.nombre || u.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label className="text-brand-secondary font-medium">Correos</Label>
                <Input
                  value={form.correos}
                  onChange={(e) => setForm((s) => ({ ...s, correos: e.target.value }))}
                  placeholder="correo1@example.com, correo2@example.com"
                  className="mt-1.5 border-brand-secondary/30"
                />
                <p className="text-xs mt-1 text-muted-foreground">Separa múltiples correos con comas.</p>
              </div>

              <div>
                <Label className="text-brand-secondary font-medium">Teléfonos</Label>
                <Input
                  value={form.telefonos}
                  onChange={(e) => setForm((s) => ({ ...s, telefonos: e.target.value }))}
                  placeholder="3001234567, 3109876543"
                  className="mt-1.5 border-brand-secondary/30"
                />
              </div>

              <div>
                <Label className="text-brand-secondary font-medium">Dirección</Label>
                <Input
                  value={form.direccion}
                  onChange={(e) => setForm((s) => ({ ...s, direccion: e.target.value }))}
                  className="mt-1.5 border-brand-secondary/30"
                />
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg border border-brand-secondary/20 bg-brand-primary/5">
                <Switch
                  checked={form.activo}
                  onCheckedChange={(v) => setForm((s) => ({ ...s, activo: v }))}
                  className="data-[state=checked]:bg-brand-primary data-[state=unchecked]:bg-gray-300"
                />
                <span className="text-sm text-brand-secondary font-medium">Cliente activo</span>
              </div>

              <DialogFooter className="gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(false)}
                  disabled={saving}
                  className="border-brand-secondary/30"
                >
                  Cancelar
                </Button>
                <Button type="submit" variant="brand" disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function Dato({
  icon: Icon,
  label,
  valor,
}: {
  icon: React.ElementType;
  label: string;
  valor?: string;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className="text-sm text-gray-800 break-words">{valor?.trim() || "—"}</p>
    </div>
  );
}
