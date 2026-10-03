// Ajustes > Plantillas de correo. Son las que se eligen al redactar un correo
// a los deudores o al conjunto (colección emailTemplates).
import EmailTemplatesManager from "@/modules/correos/components/EmailTemplatesManager";

export default function PlantillasCorreoPanel() {
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-brand-primary">Plantillas de correo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Plantillas que aparecen al enviar correos a los deudores o al conjunto. Al redactar se pueden
          ajustar antes de enviar; aquí se cambia el texto de base.
        </p>
      </div>
      <EmailTemplatesManager />
    </div>
  );
}
