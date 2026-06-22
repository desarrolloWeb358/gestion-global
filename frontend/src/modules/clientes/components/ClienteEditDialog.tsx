import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import { Button } from "@/shared/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import { Switch } from "@/shared/ui/switch";
import { Textarea } from "@/shared/ui/textarea";
import { toast } from "sonner";

import type { Cliente } from "@/modules/clientes/models/cliente.model";
import { actualizarCliente } from "@/modules/clientes/services/clienteService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import {
  obtenerEjecutivos,
  obtenerAbogados,
  obtenerDependientes,
} from "@/modules/usuarios/services/usuarioService";

interface Props {
  cliente: Cliente | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ClienteEditDialog({ cliente, open, onClose, onSaved }: Props) {
  const [ejecutivos, setEjecutivos] = useState<UsuarioSistema[]>([]);
  const [abogados, setAbogados] = useState<UsuarioSistema[]>([]);
  const [dependientes, setDependientes] = useState<UsuarioSistema[]>([]);

  const [ejecutivoPreSel, setEjecutivoPreSel] = useState("");
  const [ejecutivoJurSel, setEjecutivoJurSel] = useState("");
  const [dependienteSel, setDependienteSel] = useState("");
  const [abogadoSel, setAbogadoSel] = useState("");
  const [dependienteAbogadoSel, setDependienteAbogadoSel] = useState("");
  const [activoSel, setActivoSel] = useState(true);

  useEffect(() => {
    Promise.all([obtenerEjecutivos(), obtenerAbogados(), obtenerDependientes()]).then(
      ([execs, lawyers, deps]) => {
        setEjecutivos(execs);
        setAbogados(lawyers);
        setDependientes(deps);
      }
    );
  }, []);

  useEffect(() => {
    if (!cliente) return;
    setEjecutivoPreSel(cliente.ejecutivoPrejuridicoId ?? "");
    setEjecutivoJurSel(cliente.ejecutivoJuridicoId ?? "");
    setDependienteSel(cliente.ejecutivoDependienteId ?? "");
    setAbogadoSel(cliente.abogadoId ?? "");
    setDependienteAbogadoSel(cliente.dependienteAbogadoId ?? "");
    setActivoSel(cliente.activo ?? true);
  }, [cliente]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!cliente?.id) { onClose(); return; }

    const formData = new FormData(e.currentTarget);
    const payload: Partial<Cliente> = {
      direccion: (formData.get("direccion") as string)?.trim() || "",
      administrador: (formData.get("administrador") as string)?.trim() || "",
      formaPago: (formData.get("formaPago") as string)?.trim() || "",
      ejecutivoPrejuridicoId: ejecutivoPreSel || null,
      ejecutivoJuridicoId: ejecutivoJurSel || null,
      ejecutivoDependienteId: dependienteSel || null,
      abogadoId: abogadoSel || null,
      dependienteAbogadoId: dependienteAbogadoSel || null,
      activo: activoSel,
    };

    await actualizarCliente(cliente.id, payload);
    toast.success("✓ Cliente actualizado correctamente");
    onClose();
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-brand-primary text-xl font-bold flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Editar Cliente
          </DialogTitle>
        </DialogHeader>

        <form className="space-y-6 py-4" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/20">
              <Label className="text-brand-secondary font-medium">Nombre del Cliente</Label>
              <Input
                value={cliente?.nombre ?? ""}
                readOnly
                className="mt-1.5 bg-white/50 border-brand-secondary/30"
              />
              <p className="text-xs mt-1.5">
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
                    {dependientes.map((u) => (
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
                <Label className="text-brand-secondary font-medium">Dependiente Abogado</Label>
                <Select value={dependienteAbogadoSel} onValueChange={setDependienteAbogadoSel}>
                  <SelectTrigger className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20">
                    <SelectValue placeholder="Selecciona un dependiente" />
                  </SelectTrigger>
                  <SelectContent>
                    {dependientes.map((u) => (
                      <SelectItem key={u.uid} value={u.uid}>
                        {u.nombre ?? (u as any).displayName ?? u.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-brand-secondary font-medium">Administrador</Label>
                <Input
                  name="administrador"
                  defaultValue={cliente?.administrador}
                  key={`admin-${cliente?.id}`}
                  className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <Label className="text-brand-secondary font-medium">Dirección</Label>
                <Input
                  name="direccion"
                  defaultValue={cliente?.direccion}
                  key={`dir-${cliente?.id}`}
                  className="mt-1.5 border-brand-secondary/30 focus:border-brand-primary focus:ring-brand-primary/20"
                  placeholder="Calle 123 #45-67"
                />
              </div>

              <div className="md:col-span-2">
                <Label className="text-brand-secondary font-medium">Forma de pago</Label>
                <Textarea
                  name="formaPago"
                  defaultValue={cliente?.formaPago}
                  key={`pago-${cliente?.id}`}
                  rows={2}
                  className="mt-1.5 resize-none border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                  placeholder="Ej: Consignar en la cuenta bancaria: ..."
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
                <p className="text-xs mt-0.5">
                  Los clientes inactivos no aparecerán en las búsquedas principales
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-brand-secondary/30"
            >
              Cancelar
            </Button>
            <Button type="submit" variant="brand">
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
