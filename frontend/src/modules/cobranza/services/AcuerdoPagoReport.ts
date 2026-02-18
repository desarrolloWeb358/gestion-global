// src/reports/AcuerdoPagoReport.ts

import { saveAs } from "file-saver";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  HeadingLevel,
  BorderStyle,
  AlignmentType,
} from "docx";
import numeroALetras from "../../../shared/numeroALetras";

interface Cuota {
  numero_cuota: number;
  fecha_limite: string;
  deuda_capital: number;
  cuota_capital: number;
  deuda_honorarios: number;
  cuota_honorarios: number;
  cuota_acuerdo: number;
}

interface AcuerdoPagoProps {
  deudor: any;
  clienteData: any;
  excelPreview: Cuota[];
  ejecutivoData?: any;
}

export const generarAcuerdoPagoDoc = async ({ deudor, clienteData, excelPreview, ejecutivoData }: AcuerdoPagoProps) => {
  const clienteNombre = clienteData?.nombre ?? "";
  const direccionCliente = clienteData?.direccion ?? "";
  const fechaHoy = new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const deudaTotal = deudor?.deuda_total ?? 0;
  const deudaTexto = numeroALetras(Math.round(deudaTotal)).toUpperCase();

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "ACUERDO DE PAGO CELEBRADO",
                bold: true,
                font: "Arial",
                size: 28,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "ENTRE GESTION GLOBAL ACG S.A.S",
                bold: true,
                font: "Arial",
                size: 26,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `Y ${deudor?.nombre?.toUpperCase() ?? ""}`,
                bold: true,
                font: "Arial",
                size: 26,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            text: deudor?.apartamento
              ? `${deudor.torre}-${deudor.apartamento}`
              : "",
            alignment: AlignmentType.RIGHT,
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "Entre los suscritos a saber por una parte ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: "GESTION GLOBAL ACG S.A.S.",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " actuando como apoderado(a) judicial del ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: clienteNombre,
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: ", y por otra parte ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: deudor?.nombre ?? "",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: ", persona mayor de edad identificado con la Cédula de Ciudadanía No. ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: deudor?.cedulaResponsable ?? "",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " de Bogotá D.C., quien en adelante se denominará EL DEUDOR, hemos convenido celebrar el presente ACUERDO DE PAGO, que en adelante se regirá por las cláusulas que a continuación se enuncian, previas las siguientes:",
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            text: "CONSIDERACIONES:",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({
            children: [
              new TextRun({ text: "Que el señor ", font: "Arial", size: 22 }),
              new TextRun({
                text: deudor?.nombre ?? "",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " adeuda acreencias a favor ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: clienteNombre,
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: `, por valor de $${deudaTotal.toLocaleString()} (${deudaTexto} PESOS M/CTE). Conforme al estado de deuda bajado directamente del sistema a la fecha ${fechaHoy}, el cual forma parte de este documento.`,
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "Que la anterior suma de dinero corresponde a las cuotas vencidas de las expensas de administración, intereses de mora y honorarios causados, de la ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: `Torre ${deudor?.torre ?? ""} Apto ${
                  deudor?.apartamento ?? ""
                } ${direccionCliente}`,
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({ text: ".", font: "Arial", size: 22 }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "Que en virtud de lo anterior y con el fin de resolver el inconveniente presentado de manera amigable ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: "GESTION GLOBAL ACG S.A.S",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " de una parte y de la otra ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: deudor?.nombre ?? "",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " hemos acordado celebrar el presente acuerdo que se regirá en especial por las siguientes:",
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),

          new Paragraph({
            text: "CLÁUSULAS:",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "CLÁUSULA PRIMERA. - OBJETO: ",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: "El presente acuerdo tiene como objeto principal, facilitar a EL DEUDOR el pago de las obligaciones a favor de la entidad ACREEDORA por valor de ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: `$${deudaTotal.toLocaleString()} (${deudaTexto} PESOS M/CTE).`,
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " Frente a lo cual asume desde ya los compromisos y obligaciones contenidos en este Acuerdo.",
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "CLÁUSULA SEGUNDA. - FACILIDAD DE PAGO DE LAS OBLIGACIONES: ",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: "Las condiciones de pago objeto del presente acuerdo, son las siguientes:",
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `- LA SUMA DE $${deudaTotal.toLocaleString()} (${deudaTexto} PESOS M/CTE), serán canceladas por el DEUDOR al ${clienteNombre}, según tabla de amortización.`,
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.JUSTIFIED,
          }),
        ],
      },
      {
        children: [
          new Paragraph({
            text: "TABLA DE AMORTIZACIÓN SEGÚN ACUERDO",
            heading: HeadingLevel.HEADING_2,
            alignment: AlignmentType.CENTER,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: `EXTRAPROCESO ${deudor?.torre ?? ""}-${
                  deudor?.apartamento ?? ""
                }`,
                bold: true,
                font: "Arial",
                size: 22,
              }),
            ],
            alignment: AlignmentType.CENTER,
          }),

          new Table({
            rows: [
              new TableRow({
                children: [
                  "CUOTA",
                  "FECHA LÍMITE",
                  "DEUDA CAPITAL",
                  "CUOTA CAPITAL",
                  "DEUDA HONORARIOS",
                  "CUOTA HONORARIOS",
                  "CUOTA ACUERDO",
                ].map(
                  (text) =>
                    new TableCell({
                      children: [
                        new Paragraph({
                          text,
                          alignment: AlignmentType.CENTER,
                        }),
                      ],
                    })
                ),
              }),
              ...excelPreview.map(
                (row) =>
                  new TableRow({
                    children: [
                      row.numero_cuota,
                      row.fecha_limite,
                      `$${(row.deuda_capital ?? 0).toLocaleString()}`,
                      `$${(row.cuota_capital ?? 0).toLocaleString()}`,
                      `$${(row.deuda_honorarios ?? 0).toLocaleString()}`,
                      `$${(row.cuota_honorarios ?? 0).toLocaleString()}`,
                      `$${(row.cuota_acuerdo ?? 0).toLocaleString()}`,
                    ].map(
                      (val) =>
                        new TableCell({
                          children: [new Paragraph({ text: String(val) })],
                        })
                    ),
                  })
              ),
            ],
            borders: {
              top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
              insideHorizontal: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "000000",
              },
              insideVertical: {
                style: BorderStyle.SINGLE,
                size: 1,
                color: "000000",
              },
            },
          }),

          new Paragraph({ text: "" }),

          new Paragraph({
            children: [
              new TextRun({
                text: "PARÁGRAFO 1:",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " LAS CUOTAS PACTADAS EN EL PRESENTE ACUERDO DEBERÁ SER CONSIGNADA ASÍ:",
                font: "Arial",
                size: 22,
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "CUOTA ACUERDO DE PAGO Y LA ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: "CUOTA",
                bold: true,
                color: "ff0000",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " DE ADMINISTRACIÓN, SE REALIZA EN EL ",
                font: "Arial",
                size: 22,
              }),              
              new TextRun({
                text: " Y HACER LLEGAR AL EMAIL ",
                font: "Arial",
                size: 22,
              }),
              
              new TextRun({
                text: ejecutivoData?.correo ?? '[CORREO]',
                color: "0000ff",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " O AL WHATSAPP ",
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                 text: ejecutivoData?.telefonoUsuario ?? '[CELULAR]',
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " COPIA DE CADA UNO DE LOS BAUCHERS QUE SE REALICEN.",
                font: "Arial",
                size: 22,
              }),
            ],
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: "PARÁGRAFO 2:",
                bold: true,
                font: "Arial",
                size: 22,
              }),
              new TextRun({
                text: " ALTERNAMENTE Y AL CUMPLIMIENTO DE ESTE ACUERDO SE DEBE SEGUIR DANDO CANCELACIÓN A LAS CUOTAS DE ADMINISTRACIÓN MENSUAL Y CONFORME A LOS INCREMENTOS ANUALES QUE ESTABLEZCAN LAS LEYES NACIONALES.",
                font: "Arial",
                size: 22,
              }),
              new Paragraph({
                children: [
                  new TextRun({
                    text: "CLÁUSULA TERCERA. CONDICIÓN RESOLUTORIA: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text: "En el evento en que EL DEUDOR incumpla el pago de una cualquiera de las cuotas previstas en este acuerdo, La entidad Acreedora representada por el Abogado que designe, podrá declarar de plazo vencido todas y cada una de las obligaciones que adicionalmente tenga a nuestro cargo el DEUDOR, aun cuando respecto de ellas se hubiera pactado algún plazo para su exigibilidad y el mismo estuviera vigente.",
                    font: "Arial",
                    size: 22,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: "PARÁGRAFO: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text: "El presente acuerdo no significa novación, ni transacción de las obligaciones respectivas, ni desistimiento de La entidad Acreedora de las acciones judiciales que se deban iniciar para la recuperación de las obligaciones a cargo del deudor.",
                    font: "Arial",
                    size: 22,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: "CLÁUSULA CUARTA. CESIONES: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text: "La entidad Acreedora podrá ceder en cualquier tiempo y a cualquier título las obligaciones que regulan este acuerdo, así como las garantías a ella concedidas, sin necesidad de notificación alguna a EL DEUDOR. Para el efecto, bastará que LA ENTIDAD ACREEDORA informe por escrito a EL DEUDOR sobre esa circunstancia a la dirección adelante indicada.",
                    font: "Arial",
                    size: 22,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: "CLÁUSULA QUINTA. MODIFICACIONES: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text: "En caso de que el deudor llegue a aumentar su capacidad de pago, las sumas aquí adeudadas se plasmarán por escrito; el cual será anexo al presente acuerdo. Cualquier otra modificación a este ACUERDO deberá constar por escrito y sólo será válida y obligatoria en cuanto sea suscrita por las partes o sus apoderados debidamente constituidos.",
                    font: "Arial",
                    size: 22,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: "CLÁUSULA SEXTA. AUTORIZACIÓN: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text:
                      "En mi calidad de titular de información, actuando libre y voluntariamente, autorizo de manera expresa e irrevocable a " +
                      clienteNombre +
                      ", o quien represente sus derechos, a consultar, suministrar, reportar, procesar y divulgar toda la información que se requiera a mi comportamiento crediticio, financiero, comercial de servicios y de terceros países de la misma naturaleza a la central de información DATACRÉDITO - CIFIN, que administra la asociación bancaria y de entidades financieras de Colombia, o quien represente sus derechos.",
                    font: "Arial",
                    size: 22,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: "CLÁUSULA SÉPTIMA. MÉRITO EJECUTIVO: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text: "Para todos sus efectos el presente acuerdo presta mérito ejecutivo y en consecuencia EL DEUDOR renuncia a requerimiento o constitución en mora previa de cualquier índole bien sea este judicial, privado o administrativo.",
                    font: "Arial",
                    size: 22,
                  }),
                ],
              }),

              new Paragraph({
                children: [
                  new TextRun({
                    text: "CLÁUSULA OCTAVA. COMUNICACIONES: ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text:
                      "Para efectos de las comunicaciones a que haya lugar en virtud del presente Acuerdo, las direcciones son las siguientes: la entidad acreedora las recibirá en " +
                      clienteData?.direccion +
                      " Oficina de Administración en Soacha Cundinamarca, y el señor ",
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text: deudor?.nombre + " ",
                    bold: true,
                    font: "Arial",
                    size: 22,
                  }),
                  new TextRun({
                    text:
                      "la ubicación " +
                      deudor?.ubicacion +
                      ", CELULAR " +
                      deudor?.telefonos +
                      ", CORREO ELECTRÓNICO " +
                      deudor?.correos +
                      ".",
                    font: "Arial",
                    size: 22,
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "CLÁUSULA NOVENA. PAZ Y SALVO: ",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                      new TextRun({
                        text: "Una vez cumplida la totalidad del presente acuerdo, las partes firmantes se declararán a paz y salvo y se abstendrán mutuamente de iniciar cualquier acción judicial o administrativa, respecto a las obligaciones aquí pactadas.",
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "CLÁUSULA DÉCIMA. DOMICILIO CONTRACTUAL: ",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                      new TextRun({
                        text: "Para todos los efectos el domicilio del presente contrato en Soacha Cundinamarca.",
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({ text: "" }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `En constancia se suscribe el presente acuerdo en Soacha Cundinamarca, para el deudor ${
                          deudor?.torre ?? "[TORRE]"
                        }-${
                          deudor?.apartamento ?? "[APTO]"
                        } a los ${fechaHoy}.`,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({ text: "" }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "EL DEUDOR,",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text:
                          deudor?.nombre?.toUpperCase() ??
                          "[NOMBRE DEUDOR]",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `C.C. No. ${
                          deudor?.cedulaResponsable ?? "[CEDULA]"
                        } de Bogotá D.C.`,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({ text: "" }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "EL ACREEDOR,",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "GESTION GLOBAL ACG S.A.S",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Nit. 901.662.783-7.",
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "JAVIER MAURICIO GARCIA",
                        bold: true,
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),

                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "Representante Legal",
                        font: "Arial",
                        size: 22,
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(
    blob,
    `acuerdo_pago_${deudor?.nombre ?? "deudor"}.docx`
  );
};
