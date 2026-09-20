import { useEffect, useState } from "react";
import { Lock, Unlock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import { setBloqueoPorPago } from "@/modules/clientes/services/clienteService";
import { enviarCorreoBloqueoPago } from "@/modules/clientes/services/clienteBloqueoPagoEmail";

interface Props {
  cliente: Cliente | null;
  open: boolean;
  /** Acción a confirmar: bloquear o reactivar. */
  bloquear: boolean;
  actor: { uid: string; nombre?: string };
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Confirmación del ejecutivo para inhabilitar (o reactivar) el portal del cliente
 * por no pago del servicio.
 */
export function ClienteBloqueoPagoDialog({
  cliente,
  open,
  bloquear,
  actor,
  onClose,
  onSaved,
}: Props) {
  const [motivo, setMotivo] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) setMotivo("");
  }, [open]);

  const handleConfirmar = async () => {
    if (!cliente?.id) return;
    setGuardando(true);
    try {
      await setBloqueoPorPago(cliente.id, bloquear, { ...actor, motivo });

      // El correo va aparte: si falla, el cambio de estado ya quedó guardado y
      // no se revierte, solo se avisa al ejecutivo para que informe a mano.
      try {
        const correo = await enviarCorreoBloqueoPago({
          clienteId: cliente.id,
          bloqueado: bloquear,
          motivo,
          clienteNombre: cliente.nombre,
        });
        toast.success(
          bloquear
            ? `Cliente inhabilitado por no pago. Se avisó a ${correo}`
            : `Acceso del cliente reactivado. Se avisó a ${correo}`
        );
      } catch (errorCorreo) {
        console.error("No se pudo avisar por correo el bloqueo por pago:", errorCorreo);
        toast.warning(
          bloquear
            ? "Cliente inhabilitado, pero no se pudo enviar el correo de aviso"
            : "Acceso reactivado, pero no se pudo enviar el correo de aviso"
        );
      }

      onClose();
      onSaved();
    } catch (error) {
      console.error("Error al cambiar el bloqueo por pago:", error);
      toast.error("No se pudo actualizar el estado del cliente");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle
            className={`text-xl font-bold flex items-center gap-2 ${
              bloquear ? "text-red-600" : "text-green-700"
            }`}
          >
            {bloquear ? (
              <Lock className="h-5 w-5" />
            ) : (
              <Unlock className="h-5 w-5" />
            )}
            {bloquear
              ? "Inhabilitar cliente por no pago"
              : "Reactivar acceso del cliente"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm text-gray-700">
          {bloquear ? (
            <>
              <p>
                <strong className="text-brand-secondary">{cliente?.nombre}</strong>{" "}
                podrá iniciar sesión pero no podrá abrir ninguno de sus
                accesos rápidos (deudores, valores agregados, reporte, seguimiento
                y contratos). Al intentarlo verá el aviso para comunicarse con su
                ejecutivo de cuenta.
              </p>
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
                Se enviará un correo al administrador del conjunto informándole
                de la suspensión.
              </p>
              <div>
                <Label className="text-brand-secondary font-medium">
                  Motivo (opcional)
                </Label>
                <p className="mt-0.5 text-xs text-gray-500">
                  Se incluye tal cual en el correo al cliente. Si lo dejas vacío,
                  el correo indica que está pendiente el pago de los honorarios.
                </p>
                <Textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  rows={3}
                  className="mt-1.5 resize-none border-brand-secondary/30 bg-white focus:border-brand-primary focus:ring-brand-primary/20"
                  placeholder="Ej: Factura de julio vencida hace 45 días"
                />
              </div>
            </>
          ) : (
            <>
              <p>
                Se restablecerá el acceso completo de{" "}
                <strong className="text-brand-secondary">{cliente?.nombre}</strong> a
                todos sus accesos rápidos.
              </p>
              <p className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-green-800">
                Se enviará un correo al administrador del conjunto informándole
                que su acceso quedó reactivado.
              </p>
            </>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={guardando}
            className="border-brand-secondary/30"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant={bloquear ? "destructive" : "brand"}
            onClick={handleConfirmar}
            disabled={guardando}
          >
            {guardando
              ? "Guardando..."
              : bloquear
              ? "Inhabilitar acceso"
              : "Reactivar acceso"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
