export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  /** Cuando es true, el envío adjunta automáticamente el Excel de deudores del conjunto (solo aplica en modo "conjunto"). */
  attachDeudoresExcel?: boolean;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: "recordatorio-cartera",
    name: "Recordatorio de cartera",
    subject: "Recordatorio de cartera - {{conjunto}}",
    body: "Cordial saludo {{nombre}},\n\nLe recordamos que presenta un saldo pendiente con {{conjunto}} correspondiente al inmueble {{ubicacion}}.\n\nAgradecemos realizar el pago o comunicarse con nosotros para revisar su situación.\n\nAtentamente,\nGestión Global ACG",
  },
  {
    id: "invitacion-acuerdo",
    name: "Invitación a acuerdo de pago",
    subject: "Alternativa de acuerdo de pago - {{conjunto}}",
    body: "Cordial saludo {{nombre}},\n\nQueremos invitarle a comunicarse con Gestión Global ACG para revisar alternativas de acuerdo de pago sobre la obligación del inmueble {{ubicacion}} en {{conjunto}}.\n\nQuedamos atentos a su respuesta.",
  },
  {
    id: "comunicado-conjunto",
    name: "Comunicado general del conjunto",
    subject: "Comunicado de {{conjunto}}",
    body: "Cordial saludo {{nombre}},\n\nPor medio del presente compartimos la siguiente comunicación relacionada con {{conjunto}} y el inmueble {{ubicacion}}:\n\n[Escriba aquí el comunicado]\n\nAtentamente,\nGestión Global ACG",
  },
  {
    id: "solicitud-estados-cuenta",
    name: "Solicitud de estados de cuenta (actualización de cartera)",
    subject: "Solicitud estados de cuenta - {{conjunto}}",
    body: "Bogotá D.C., {{fecha}}\n\nSeñores\n{{conjunto}}\nADMINISTRACIÓN\nCiudad. -\n\nREFERENCIA: Solicitud de estados de cuenta por documento.\n\nCordial saludo.\n\nPor medio de la presente solicito a ustedes respetuosamente, me sean enviados los estados de cuenta y los recaudos.\n\nLo anterior, con el fin de continuar la gestión de cobro prejurídico, que llevamos en el conjunto actualmente. Anexo cuadro de deudores.\n\nAtentamente,\nGestión Global ACG",
    attachDeudoresExcel: true,
  },
];

export const EMAIL_VARIABLES = ["nombre", "cedula", "ubicacion", "direccion", "tipificacion", "conjunto", "fecha"] as const;
