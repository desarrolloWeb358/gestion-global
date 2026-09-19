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
  {
    id: "cobro-prejuridico",
    name: "Cobro prejurídico",
    subject: "Cobro prejurídico - {{conjunto}}",
    body: "Bogotá D.C., {{fecha}}\n\nSeñor@\n{{nombre}}\n{{ubicacion}}\n{{conjunto}}\nCiudad. -\n\nCOBRO PREJURÍDICO\n\nLa presente es para manifestarle que nuestro cliente {{conjunto}} nos ha otorgado poder para adelantar las acciones pre jurídicas y jurídicas, tendientes a hacer efectiva la obligación en mora que usted tiene representada en las cuotas de administración e intereses de mora, y demás, por lo tanto, se está generando un cobro de honorarios del 15%, le informamos que toda consignación realizada sin haber firmado acuerdo de pago con nuestra firma se tomará sin excepción, únicamente como abono y de este será descontado el 15% correspondiente a nuestros honorarios.\n\nPor otra parte, solicito a usted respetuosamente de comunicarse de manera INMEDIATA con los teléfonos 4631148 – 3004786715 - 3017566868 - 3123152594 - 3009739307 - 3166936088 de lunes a viernes de 9:00 am a 5:00 pm o sábados de 9:00 am a 1:00 pm, con el fin de obtener la cancelación total de su obligación o llegar a un acuerdo de pago.\n\nEn la confianza de recibir de parte suya una respuesta positiva a la presente me suscribo.\n\nJAVIER GARCIA\nABOGADO",
  },
  {
    id: "cobro-juridico",
    name: "Notificación jurídica (cobro jurídico)",
    subject: "Notificación jurídica - {{conjunto}}",
    body: "Bogotá D.C., {{fecha}}\n\nSeñor\n{{nombre}}\n{{ubicacion}}\n{{conjunto}}\nCIUDAD.\n\nNOTIFICACIÓN JURÍDICA\n\nLa presente es para manifestarle que el {{conjunto}} nos ha otorgado poder para adelantar las acciones JURÍDICAS, tendientes a hacer efectiva la obligación en mora que usted tiene representada en las cuotas de administración e intereses de mora, y demás, por lo tanto, se está generando un cobro de honorarios del 20%, le informamos que toda consignación realizada sin haber firmado acuerdo de pago con nuestra firma se tomará sin excepción, únicamente como abono y de este será descontado el 20% correspondiente a nuestros honorarios.\n\nPor otra parte, solicito a usted respetuosamente de comunicarse de manera INMEDIATA con los teléfonos 4631148 – 3245572193 o al correo electrónico carterazona1@gestionglobalacg.com con el fin de obtener la cancelación total de su obligación o llegar a un acuerdo de pago.\n\nEn la confianza de recibir de parte suya una respuesta positiva a la presente me suscribo.\n\nSandra Yepes\nEjecutiva de Cuenta\nGESTIÓN GLOBAL ACG S.A.S\n3123152594",
  },
];

export const EMAIL_VARIABLES = ["nombre", "cedula", "ubicacion", "direccion", "tipificacion", "conjunto", "fecha"] as const;
