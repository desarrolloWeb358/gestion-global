// src/modules/deudores/utils/exportarAcuerdoWord.ts
import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  Table, 
  TableCell, 
  TableRow, 
  WidthType, 
  AlignmentType, 
  BorderStyle, 
  convertInchesToTwip,
  VerticalAlign 
} from "docx";
import { saveAs } from "file-saver";

interface Cuota {
  numero: number;
  fechaVencimiento: Date;
  montoCuota: number;
  pagada: boolean;
}

interface AcuerdoPago {
  numeroAcuerdo?: string;
  fechaAcuerdo?: Date;
  montoTotal?: number;
  montoCuota?: number;
  numeroCuotas?: number;
  fechaPrimeraCuota?: Date;
  periodicidad?: string;
  detalles?: string;
  observaciones?: string;
  cuotas?: Cuota[];
}

export interface DatosCliente {
  nombre: string;
  nit?: string;
  direccion?: string;  
  numeroConvenio?: string;
  email?: string;
  whatsapp?: string;
}

export interface DatosDeudor {
  nombre: string;
  cedula?: string;
  direccion?: string;
  email?: string;
  telefono?: string;
  inmueble?: string;
}

export async function exportarAcuerdoWord(
  acuerdo: AcuerdoPago,
  cliente: DatosCliente,
  deudor: DatosDeudor,
  numeroALetras: (num: number) => string
) {
  // Validaciones
  if (!cliente?.nombre) {
    throw new Error("El nombre del cliente es requerido");
  }
  if (!deudor?.nombre) {
    throw new Error("El nombre del deudor es requerido");
  }
  if (!acuerdo?.montoTotal) {
    throw new Error("El monto total es requerido");
  }

  const montoTexto = numeroALetras(acuerdo.montoTotal).toUpperCase();
  const montoNumerico = acuerdo.montoTotal.toLocaleString("es-CO");
  const fechaActual = new Date().toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Construir filas de la tabla
  const tablaFilas: TableRow[] = [
    // Header
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ text: "Cuota", alignment: AlignmentType.CENTER })],
          shading: { fill: "1F4788" },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          children: [new Paragraph({ text: "Fecha límite", alignment: AlignmentType.CENTER })],
          shading: { fill: "1F4788" },
          verticalAlign: VerticalAlign.CENTER,
        }),
        new TableCell({
          children: [new Paragraph({ text: "Valor cuota", alignment: AlignmentType.CENTER })],
          shading: { fill: "1F4788" },
          verticalAlign: VerticalAlign.CENTER,
        }),
      ],
    }),
  ];

  // Agregar filas de cuotas
  if (acuerdo.cuotas && acuerdo.cuotas.length > 0) {
    acuerdo.cuotas.forEach((cuota, index) => {
      tablaFilas.push(
        new TableRow({
          children: [
            new TableCell({
              children: [new Paragraph({ text: cuota.numero.toString(), alignment: AlignmentType.CENTER })],
              shading: { fill: index % 2 === 0 ? "FFFFFF" : "F5F5F5" },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: new Date(cuota.fechaVencimiento).toLocaleDateString("es-CO"),
                  alignment: AlignmentType.CENTER,
                }),
              ],
              shading: { fill: index % 2 === 0 ? "FFFFFF" : "F5F5F5" },
            }),
            new TableCell({
              children: [
                new Paragraph({
                  text: `$${cuota.montoCuota.toLocaleString("es-CO")}`,
                  alignment: AlignmentType.RIGHT,
                }),
              ],
              shading: { fill: index % 2 === 0 ? "FFFFFF" : "F5F5F5" },
            }),
          ],
        })
      );
    });

    // Fila TOTAL
    tablaFilas.push(
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ text: "TOTAL", alignment: AlignmentType.RIGHT })],
            columnSpan: 2,
            shading: { fill: "2563EB" },
          }),
          new TableCell({
            children: [new Paragraph({ text: `$${montoNumerico}`, alignment: AlignmentType.RIGHT })],
            shading: { fill: "2563EB" },
          }),
        ],
      })
    );
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: [
          // TÍTULO
          new Paragraph({
            text: "ACUERDO DE PAGO CELEBRADO",
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // ENTRE...
          new Paragraph({
            text: "ENTRE GESTION GLOBAL ACG S.A.S Y",
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),

          // NOMBRE DEUDOR
          new Paragraph({
            text: deudor.nombre.toUpperCase(),
            alignment: AlignmentType.CENTER,
            spacing: { after: 200 },
          }),

          // NÚMERO INMUEBLE (si existe)
          ...(deudor.inmueble
            ? [
                new Paragraph({
                  text: deudor.inmueble,
                  alignment: AlignmentType.RIGHT,
                  spacing: { after: 200 },
                }),
              ]
            : []),

          // PÁRRAFO INTRODUCTORIO
          new Paragraph({
            children: [
              new TextRun("Entre los suscritos a saber por una parte "),
              new TextRun({ text: "GESTION GLOBAL ACG S.A.S", bold: true }),
              new TextRun(" actuando como apoderado(a) judicial del "),
              new TextRun({ text: cliente.nombre.toUpperCase(), bold: true }),
              new TextRun(" y por otra parte "),
              new TextRun({ text: deudor.nombre.toUpperCase(), bold: true }),
              new TextRun(" persona mayor de edad identificada con la Cédula de Ciudadanía No "),
              new TextRun({ text: deudor.cedula || "___________", bold: true }),
              new TextRun(" de Bogotá D.C., quien en adelante se denominará el "),
              new TextRun({ text: "DEUDOR", bold: true }),
              new TextRun(", hemos convenido celebrar el presente "),
              new TextRun({ text: "ACUERDO DE PAGO", bold: true }),
              new TextRun(
                ", que en adelante se regirá por las cláusulas que a continuación se enuncian, previas las siguientes"
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 300 },
          }),

          // CONSIDERACIONES
          new Paragraph({
            text: "CONSIDERACIONES:",
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // CONSIDERACIÓN 1
          new Paragraph({
            children: [
              new TextRun(`Que ${deudor.nombre.includes("SR") ? "el señor" : "la señora"} `),
              new TextRun({ text: deudor.nombre.toUpperCase(), bold: true }),
              new TextRun(" deuda acreencias a favor de "),
              new TextRun({ text: cliente.nombre.toUpperCase(), bold: true }),
              new TextRun(
                ` por valor de $${montoNumerico} (${montoTexto} MCTE). Conforme al estado de deuda bajado directamente del sistema a la fecha ${fechaActual}, el cual forma parte de este documento.`
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CONSIDERACIÓN 2
          new Paragraph({
            children: [
              new TextRun(
                "Que la anterior suma de dinero corresponde a las cuotas vencidas de las expensas de administración, intereses de mora y honorarios causados, "
              ),
              ...(deudor.inmueble ? [new TextRun(`del ${deudor.inmueble.toLowerCase()} `)] : []),
              new TextRun("del "),
              new TextRun({ text: cliente.nombre.toUpperCase(), bold: true }),
              ...(cliente.direccion ? [new TextRun(` ${cliente.direccion}`)] : []),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CONSIDERACIÓN 3
          new Paragraph({
            children: [
              new TextRun(
                "Que en virtud de lo anterior y con el fin de resolver el inconveniente presentado de manera amigable "
              ),
              new TextRun({ text: "GESTION GLOBAL ACG SAS", bold: true }),
              new TextRun(" de una parte y de la otra "),
              new TextRun({ text: deudor.nombre.toUpperCase(), bold: true }),
              new TextRun(", hemos acordado celebrar el presente acuerdo que se regirá en especial por las siguientes:"),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 300 },
          }),

          // CLÁUSULAS
          new Paragraph({
            text: "CLAUSULAS:",
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),

          // CLÁUSULA PRIMERA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA PRIMERA. - OBJETO: ", bold: true }),
              new TextRun(
                `El presente acuerdo tiene como objeto principal, facilitar a EL DEUDOR el pago de las obligaciones a favor de la entidad ACREEDORA por valor de $${montoNumerico} (${montoTexto} MCTE). Frente a lo cual asume desde ya los compromisos y obligaciones contenidos en este acuerdo.`
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLÁUSULA SEGUNDA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA SEGUNDA. - FACILIDAD DE PAGO DE LAS OBLIGACIONES: ", bold: true }),
              new TextRun("Las condiciones de pago objeto del presente acuerdo, son las siguientes:"),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // Descripción del pago
          new Paragraph({
            text: `LA SUMA $${montoNumerico} (${montoTexto} MCTE). Serán cancelados por el DEUDOR al ${cliente.nombre.toUpperCase()}, según tabla de amortización`,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 300 },
          }),

          // TABLA DE AMORTIZACIÓN
          ...(acuerdo.cuotas && acuerdo.cuotas.length > 0
            ? [
                new Table({
                  width: { size: 100, type: WidthType.PERCENTAGE },
                  rows: tablaFilas,
                }),
                new Paragraph({ text: "", spacing: { after: 200 } }),
              ]
            : []),

          // PARÁGRAFO 1
          new Paragraph({
            text: "PARÁGRAFO 1: LAS CUOTAS PACTADAS EN EL PRESENTE ACUERDO DEBERA SER CONSIGNADA ASI",
            spacing: { before: 200, after: 100 },
          }),

          
          // PARÁGRAFO 2
          new Paragraph({
            children: [
              new TextRun({ text: "PARÁGRAFO 2: ", bold: true }),
              new TextRun(
                "ALTERNAMENTE Y AL CUMPLIMIENTO DE ESTE ACUERDO SE DEBE SEGUIR DANDO CANCELACIÓN A LAS CUOTAS DE ADMINISTRACIÓN MENSUAL Y CONFORME A LOS INCREMENTOS ANUALES QUE ESTABLEZCAN LAS LEYES NACIONALES."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLÁUSULA TERCERA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA TERCERA. COMPROMISO: ", bold: true }),
              new TextRun(
                "Las partes acuerdan que el presente compromiso se mantendrá vigente en los términos pactados. No obstante, en caso de que, durante los años 2026, 2027, 2028, 2029, 2030, 2031 o 2032, la Asamblea General de Propietarios apruebe o autorice un descuento porcentual sobre los intereses de mora, dicho beneficio será igualmente aplicable a este acuerdo. La aplicación de dicho descuento se efectuará únicamente en las mismas condiciones, porcentajes, términos y procedimientos que sean expresamente aprobados por la Asamblea General de Propietarios. En consecuencia, cualquier decisión adoptada en ese sentido por la Asamblea se entenderá extensiva a las obligaciones contenidas en el presente acuerdo, sin requerir un nuevo documento o trámite adicional."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLÁUSULA CUARTA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA CUARTA. CONDICIÓN RESOLUTORIA: ", bold: true }),
              new TextRun(
                "En el evento en que EL DEUDOR incumpla el pago de una cualquiera de las cuotas previstas en este acuerdo, La entidad Acreedora representada por el Abogado que designe, podrá declarar de plazo vencido todas y cada una de las obligaciones que adicionalmente tenga a nuestro cargo el DEUDOR, aun cuando respecto de ellas se hubiera pactado algún plazo para su exigibilidad y el mismo estuviera pendiente."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // PARÁGRAFO
          new Paragraph({
            children: [
              new TextRun({ text: "PARÁGRAFO: ", bold: true }),
              new TextRun(
                "El presente acuerdo no significa novación, ni transacción de las obligaciones respectivas, ni desistimiento de La entidad Acreedora de las acciones judiciales que se deban iniciar para la recuperación de las obligaciones a cargo del deudor."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLAUSULA QUINTA
          new Paragraph({
            children: [
              new TextRun({ text: "CLAUSULA QUINTA. CESIONES: ", bold: true }),
              new TextRun(
                "La entidad Acreedora podrá ceder en cualquier tiempo y a cualquier título las obligaciones que regulan este acuerdo, así como las garantías a ella concedidas, sin necesidad de notificación alguna a EL DEUDOR. Para el efecto, bastará que LA ENTIDAD ACREEDORA informe por escrito a EL DEUDOR sobre esta circunstancia a la dirección adelante indicada."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLÁUSULA SEXTA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA SEXTA. MODIFICACIONES: ", bold: true }),
              new TextRun(
                "En caso de que el deudor llegue a aumentar su capacidad de pago, las sumas aquí adeudadas se plasmarán por escrito; el cual será anexo al presente acuerdo. Cualquier otra modificación a este ACUERDO deberá constar por escrito y sólo será válida y obligatoria en cuanto sea suscrita por las partes o sus apoderados debidamente constituidos."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLÁUSULA SEPTIMA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA SEPTIMA. AUTORIZACIÓN: ", bold: true }),
              new TextRun(
                `En mi calidad de titular de información, actuando libre y voluntariamente, autorizo de manera expresa e irrevocable al ${cliente.nombre.toUpperCase()} o quien represente sus derechos, a consultar, suministrar, reportar, procesar y divulgar toda la información que se requiera a mi comportamiento crediticio, financiero, comercial de servicios y de terceros países de la misma naturaleza a la central de información DATACREDITO- CIFIN, que administra la asociación bancaria y de entidades financieras de Colombia, o quien represente sus derechos.`
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLÁUSULA OCTAVA
          new Paragraph({
            children: [
              new TextRun({ text: "CLÁUSULA OCTAVA. MÉRITO EJECUTIVO. ", bold: true }),
              new TextRun(
                "Para todos sus efectos el presente acuerdo presta mérito ejecutivo y en consecuencia el deudor renuncia a cualquier clase de requerimiento o constitución en mora previa de cualquier índole bien sea este judicial, privada o administrativa."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLAUSULA NOVENA
          new Paragraph({
            children: [
              new TextRun({ text: "CLAUSULA NOVENA. COMUNICACIONES: ", bold: true }),
              new TextRun(
                `Para efectos de las comunicaciones a que haya lugar en virtud del presente Acuerdo, las direcciones son las siguientes: la entidad acreedora las recibirá en ${
                  cliente.direccion || "su oficina de administración"
                } en la Ciudad de Bogotá y ${deudor.nombre} ${deudor.direccion ? `de ${deudor.direccion}` : ""} ${
                  cliente.nombre.toUpperCase()
                }${deudor.email ? ` correo ${deudor.email}` : ""}${deudor.telefono ? ` Teléfono ${deudor.telefono}` : ""}.`
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          new Paragraph({
            text: "Los cambios de direcciones serán informados por escrito.",
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLAUSULA DECIMA
          new Paragraph({
            children: [
              new TextRun({ text: "CLAUSULA DECIMA. PAZ Y SALVO: ", bold: true }),
              new TextRun(
                "Una vez cumplida la totalidad del presente acuerdo, las partes firmantes se declararán a paz y salvo y se abstendrán mutuamente de iniciar cualquier acción judicial o administrativa, respecto a las obligaciones aquí pactadas."
              ),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CLAUSULA DÉCIMA PRIMERA
          new Paragraph({
            children: [
              new TextRun({ text: "CLAUSULA DÉCIMA PRIMERA. DOMICILIO CONTRACTUAL: ", bold: true }),
              new TextRun("Para todos los efectos el domicilio del presente contrato en Bogotá."),
            ],
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 200 },
          }),

          // CONSTANCIA
          new Paragraph({
            text: `En constancia se suscribe el presente acuerdo en Bogotá D.C., ${
              deudor.inmueble ? `para ${deudor.inmueble.toLowerCase()}` : ""
            } del ${cliente.nombre}, a los ${fechaActual}.`,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { before: 300, after: 400 },
          }),

          // FIRMAS - DEUDOR
          new Paragraph({
            text: "EL DEUDOR,                                                                                  HUELLA",
            spacing: { before: 400, after: 100 },
          }),

          new Paragraph({
            text: `${deudor.nombre.toUpperCase()}                                                                       INDICE DERECHO`,
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 50 },
          }),

          new Paragraph({
            text: `C.C. No ${deudor.cedula || "___________"} de Bogotá D.C.`,
            spacing: { after: 300 },
          }),

          // FIRMAS - ACREEDOR
          new Paragraph({
            text: "LA ACREEDOR,",
            spacing: { before: 200, after: 200 },
          }),

          new Paragraph({
            text: "GESTION GLOBAL ACG S.A.S",
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 50 },
          }),

          new Paragraph({
            text: "Nit. 901.662.783-7",
            alignment: AlignmentType.JUSTIFIED,
            spacing: { after: 50 },
          }),

          new Paragraph({
            text: "JAVIER MAURICIO GARCIA",
            spacing: { after: 50 },
          }),

          new Paragraph({
            text: "Representante Legal",
            alignment: AlignmentType.JUSTIFIED,
          }),
        ],
      },
    ],
  });

  // Generar y descargar
  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Acuerdo_Pago_${acuerdo.numeroAcuerdo || deudor.nombre || "SN"}.docx`);
}