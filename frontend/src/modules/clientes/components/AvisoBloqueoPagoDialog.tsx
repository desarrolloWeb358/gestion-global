import { Lock, Mail, Phone, UserRound } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/ui/dialog";
import { Button } from "@/shared/ui/button";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

/** Correo de contacto fijo para temas de cartera: siempre se muestra este. */
const CORREO_CARTERA = "carterazona1@gestionglobalacg.com";

interface Props {
  open: boolean;
  onClose: () => void;
  /** Ejecutivo de cuenta del conjunto, para que el cliente sepa a quién escribir. */
  ejecutivo?: UsuarioSistema | null;
}

/**
 * Aviso que ve el rol `cliente` cuando su conjunto está inhabilitado por no pago
 * y trata de abrir cualquiera de los accesos rápidos.
 */
export function AvisoBloqueoPagoDialog({ open, onClose, ejecutivo }: Props) {
  const nombreEjecutivo = ejecutivo?.nombre?.trim() || null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-brand-primary flex items-center gap-2">
            <span className="inline-flex rounded-lg bg-amber-100 p-2">
              <Lock className="h-5 w-5 text-amber-600" />
            </span>
            Acceso temporalmente suspendido
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 text-sm leading-relaxed text-gray-700">
          <p>
            A la fecha no hemos recibido el pago correspondiente a los honorarios
            del servicio, por lo que la consulta de la información de tu conjunto
            se encuentra suspendida de manera temporal.
          </p>
          <p>
            Si ya realizaste el pago, por favor comunícate con tu{" "}
            <strong className="text-brand-secondary">ejecutivo de cuenta</strong>{" "}
            en Gestión Global y envíale el soporte para verificarlo y reactivar tu
            usuario de inmediato.
          </p>

          <div className="rounded-lg border border-brand-secondary/20 bg-brand-primary/5 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand-secondary">
              Tu ejecutivo de cuenta
            </p>
            {nombreEjecutivo && (
              <p className="flex items-center gap-2 text-gray-700">
                <UserRound className="h-4 w-4 text-brand-primary" />
                {nombreEjecutivo}
              </p>
            )}
            <a
              href={`mailto:${CORREO_CARTERA}`}
              className="flex items-center gap-2 text-brand-primary hover:underline"
            >
              <Mail className="h-4 w-4" />
              {CORREO_CARTERA}
            </a>
            {ejecutivo?.telefonoUsuario && (
              <a
                href={`tel:${ejecutivo.telefonoUsuario}`}
                className="flex items-center gap-2 text-brand-primary hover:underline"
              >
                <Phone className="h-4 w-4" />
                {ejecutivo.telefonoUsuario}
              </a>
            )}
          </div>

          <p className="text-xs text-gray-500">
            Agradecemos tu comprensión. — Gestión Global ACG SAS
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="brand" onClick={onClose}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
