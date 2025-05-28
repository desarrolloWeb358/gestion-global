// src/modules/cobranza/components/InmuebleProcess.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, doc as fsDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { Inmueble } from '../models/inmueble.model';
import * as XLSX from 'xlsx';
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
  Box,
  Button,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import numeroALetras from '../../../shared/numeroALetras';

const REQUIRED_COLUMNS = [
  'numero_cuota',
  'fecha_limite',
  'deuda_capital',
  'cuota_capital',
  'deuda_honorarios',
  'cuota_honorarios',
  'cuota_acuerdo',
];

export default function InmuebleProcess() {
  const { clienteId, inmuebleId } = useParams<{ clienteId: string; inmuebleId: string }>();
  const navigate = useNavigate();
  const [inmueble, setInmueble] = useState<Inmueble | null>(null);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState(false);
  const [excelPreview, setExcelPreview] = useState<any[]>([]);
  const [setClienteData] = useState<any>(null);

  useEffect(() => {
    const fetchClienteData = async () => {
      if (clienteId) {
        const clienteSnap = await getDoc(fsDoc(db, 'clientes', clienteId));
        if (clienteSnap.exists()) {
          setClienteData(clienteSnap.data());
        } else {
          setClienteData(null);
        }
      }
    };
    fetchClienteData();
  }, [clienteId]);

  useEffect(() => {
    const load = async () => {
      if (!clienteId || !inmuebleId) return;
      setLoading(true);
      const snap = await getDoc(fsDoc(db, 'clientes', clienteId, 'inmuebles', inmuebleId));
      if (snap.exists()) {
        const data = snap.data() as Omit<Inmueble, 'id'>;
        setInmueble({
          id: snap.id,
          ...data,
          estado: data.estado || 'gestionando',
        });
      } else {
        setInmueble(null);
      }
      setLoading(false);
    };
    load();
  }, [clienteId, inmuebleId]);

  useEffect(() => {
    // Hidratar excelPreview desde Firestore si hay cuotas guardadas
    if (inmueble && inmueble.acuerdo_pago && Array.isArray(inmueble.acuerdo_pago.cuotas) && inmueble.acuerdo_pago.cuotas.length > 0) {
      setExcelPreview(inmueble.acuerdo_pago.cuotas);
    } else {
      setExcelPreview([]);
    }
  }, [inmueble]);

  const handleGuardar = async () => {
    if (!clienteId || !inmuebleId || !inmueble) return;
    const ref = fsDoc(db, 'clientes', clienteId, 'inmuebles', inmuebleId);
    await updateDoc(ref, {
      responsable: inmueble.nombreResponsable,
      deuda_total: inmueble.deuda_total,
      estado: inmueble.estado,
      porcentaje_honorarios: inmueble.porcentaje_honorarios,
    });
    setEditando(false);
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const isCSV = file.name.endsWith('.csv');
    let json: any[] = [];
    if (isCSV) {
      // Leer CSV como texto y parsear con XLSX
      const text = await file.text();
      const workbook = XLSX.read(text, { type: 'string' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    } else {
      // XLSX
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
    }
    if (!inmueble) return;
    // Validar columnas requeridas
    const firstRow = json[0] as any;
    const missing = REQUIRED_COLUMNS.filter(col => !(col in firstRow));
    if (missing.length > 0) {
      alert('Faltan columnas requeridas en el archivo: ' + missing.join(', '));
      return;
    }
    // Filtrar filas de totales (numero_cuota = 'Totales' o similar)
    const cuotas = json.filter((row: any) => {
      return String(row.numero_cuota).toLowerCase() !== 'totales';
    }).map((row: any, idx: number) => {
      // Validar que los campos numéricos sean válidos
      const numFields = ['deuda_capital', 'cuota_capital', 'deuda_honorarios', 'cuota_honorarios', 'cuota_acuerdo'];
      for (const f of numFields) {
        if (isNaN(Number(row[f]))) {
          alert(`El valor de la columna ${f} en la fila ${idx + 2} no es un número válido.`);
          throw new Error('Dato inválido');
        }
      }
      // Corregir fecha si viene como número (Excel date)
      let fechaLimite = row.fecha_limite;
      if (typeof fechaLimite === 'number') {
        const excelEpoch = new Date(Date.UTC(1899, 11, 30));
        const jsDate = new Date(excelEpoch.getTime() + (fechaLimite * 24 * 60 * 60 * 1000));
        fechaLimite = jsDate.toISOString().slice(0, 10);
      }
      return {
        id: idx + 1,
        numero_cuota: Number(row.numero_cuota) || idx + 1,
        fecha_limite: fechaLimite || '',
        deuda_capital: Number(row.deuda_capital) || 0,
        cuota_capital: Number(row.cuota_capital) || 0,
        deuda_honorarios: Number(row.deuda_honorarios) || 0,
        cuota_honorarios: Number(row.cuota_honorarios) || 0,
        cuota_acuerdo: Number(row.cuota_acuerdo) || 0,
        _isTotals: false,
      };
    });
    setExcelPreview(cuotas);
    // Guardar en Firestore
    const ref = fsDoc(db, 'clientes', clienteId!, 'inmuebles', inmuebleId!);
    await updateDoc(ref, {
      'acuerdo_pago.cuotas': cuotas,
    });
    // Después de guardar en Firestore, también actualiza el preview con lo guardado
    setExcelPreview(cuotas);
    // Actualizar inmueble localmente solo si la estructura es compatible
    setInmueble(prev => prev ? {
      ...prev,
      acuerdo_pago: {
        ...prev.acuerdo_pago,
        cuotas: cuotas as any // Forzar tipo para mantener el preview en la página
      }
    } as Inmueble : prev);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data() as Omit<Inmueble, 'id'>;
      setInmueble({ id: snap.id, ...data, estado: data.estado || 'gestionando' });
    }
    alert('Cuotas cargadas correctamente desde archivo.');
  };

  if (loading) return <Typography>Cargando proceso...</Typography>;
  if (!inmueble) return <Typography color="error">Inmueble no encontrado.</Typography>;

  return (
    <Box sx={{ p: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Button variant="outlined" onClick={() => navigate(-1)}>
          Regresar
        </Button>
      </Box>

      {/* Soportes */}

      {/* Información General */}
      <Accordion sx={{ maxWidth: 700, mx: 'auto', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Información General</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {editando ? (
            <Box component="form" sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <input
                type="text"
                value={inmueble.nombreResponsable}
                onChange={e => setInmueble({ ...inmueble, nombreResponsable: e.target.value })}
                placeholder="Responsable"
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
              <input
                type="number"
                value={inmueble.deuda_total}
                onChange={e => setInmueble({ ...inmueble, deuda_total: Number(e.target.value) })}
                placeholder="Deuda Total"
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              />
              <input
                type="number"
                value={inmueble.porcentaje_honorarios ?? ''}
                onChange={e => setInmueble({ ...inmueble, porcentaje_honorarios: Number(e.target.value) })}
                placeholder="% Honorarios"
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
                min={0}
                max={100}
              />
              <select
                value={inmueble.estado}
                onChange={e => setInmueble({ ...inmueble, estado: e.target.value })}
                style={{ padding: 8, borderRadius: 4, border: '1px solid #ccc' }}
              >
                <option value="gestionando">Gestionando</option>
                <option value="acuerdo">Acuerdo</option>
                <option value="demanda acuerdo">Demanda Acuerdo</option>
                <option value="demanda">Demanda</option>
              </select>
              <Button variant="contained" color="primary" onClick={handleGuardar} sx={{ mt: 2 }}>
                Guardar
              </Button>
              <Button variant="text" color="secondary" onClick={() => setEditando(false)} sx={{ mt: 1 }}>
                Cancelar
              </Button>
            </Box>
          ) : (
            <>
              <Typography><strong>Responsable:</strong> {inmueble.nombreResponsable}</Typography>
              <Typography><strong>Deuda Total:</strong> ${inmueble.deuda_total.toLocaleString()}</Typography>
              <Typography><strong>Estado:</strong> {inmueble.estado}</Typography>
              <Typography><strong>Honorarios:</strong> {inmueble.porcentaje_honorarios}%</Typography>
              <Button variant="outlined" size="small" sx={{ mt: 2 }} onClick={() => setEditando(true)}>
                Editar
              </Button>
            </>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Cronograma de Cuotas */}
      <Accordion defaultExpanded sx={{ maxWidth: 700, mx: 'auto', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Cronograma de Cuotas</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ width: '100%', minWidth: 600, mb: 2 }}>
            <Button
              variant="outlined"
              color="primary"
              sx={{ mb: 2, mr: 2 }}
              href="/plantilla_cuotas.csv"
              download
            >
              Descargar plantilla CSV
            </Button>
            <Button
              variant="outlined"
              color="error"
              sx={{ mb: 2, mr: 2 }}
              onClick={() => {
                setExcelPreview([]);
                if (clienteId && inmuebleId) {
                  const ref = doc(db, 'clientes', clienteId, 'inmuebles', inmuebleId);
                  updateDoc(ref, { 'acuerdo_pago.cuotas': [] });
                }
              }}
            >
              Eliminar tabla de cuotas
            </Button>
            <Button variant="outlined" component="label" sx={{ mb: 2 }}>
              Subir Excel o CSV de cuotas
              <input type="file" accept=".xlsx,.xls,.csv" hidden onChange={handleExcelUpload} />
            </Button>
            {excelPreview && (
              <Box sx={{ mb: 2, overflowX: 'auto' }}>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Vista previa de cuotas cargadas:</Typography>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      <th>No. Cuota</th>
                      <th>Fecha Límite</th>
                      <th>Deuda Capital</th>
                      <th>Cuota Capital</th>
                      <th>Deuda Honorarios</th>
                      <th>Cuota Honorarios</th>
                      <th>Cuota Acuerdo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {excelPreview.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.numero_cuota}</td>
                        <td>{row.fecha_limite}</td>
                        <td>{row.deuda_capital.toLocaleString()}</td>
                        <td>{row.cuota_capital.toLocaleString()}</td>
                        <td>{row.deuda_honorarios.toLocaleString()}</td>
                        <td>{row.cuota_honorarios.toLocaleString()}</td>
                        <td>{row.cuota_acuerdo.toLocaleString()}</td>
                      </tr>
                    ))}
                    {/* Fila de totales */}
                    <tr style={{ fontWeight: 'bold', background: '#f5f5f5' }}>
                      <td colSpan={3}>Totales</td>
                      <td>{excelPreview.reduce((sum, r) => sum + (Number(r.cuota_capital) || 0), 0).toLocaleString()}</td>
                      <td></td>
                      <td>{excelPreview.reduce((sum, r) => sum + (Number(r.cuota_honorarios) || 0), 0).toLocaleString()}</td>
                      <td>{excelPreview.reduce((sum, r) => sum + (Number(r.cuota_acuerdo) || 0), 0).toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </Box>
            )}
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Glosas Automáticas */}
      <Accordion sx={{ maxWidth: 700, mx: 'auto', mb: 2 }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography>Generar acuerdo</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Button
            variant="contained"
            color="primary"
            sx={{ mb: 2 }}
            onClick={async () => {
              // Obtener nombre del cliente
              let clienteNombre = "";
              let clienteData: any = null;
              if (clienteId) {
                const clienteSnap = await getDoc(fsDoc(db, 'clientes', clienteId));
                if (clienteSnap.exists()) {
                  clienteData = clienteSnap.data();
                  clienteNombre = (clienteData as { nombre?: string }).nombre || "";
                }
              }
              const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel } = await import("docx");
              // Texto introductorio y datos del inmueble
              const doc = new Document({
                sections: [
                  {
                    properties: {},
                    children: [
                      // Título
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `ACUERDO DE PAGO CELEBRADO\nENTRE GESTION GLOBAL ACG S.A.S\nY ${inmueble?.nombreResponsable ?? ''}`,
                            bold: true,
                            font: "Arial",
                            size: 28,
                            color: "000000"
                          })
                        ],
                        alignment: "center",
                        heading: HeadingLevel.HEADING_1,
                      }),
                      new Paragraph({ text: "\n" }),
                      // Párrafo introductorio
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Entre los suscritos a saber por una parte ", font: "Arial", size: 24 }),
                          new TextRun({ text: "GESTION GLOBAL ACG S.A.S", bold: true, font: "Arial", size: 24 }),
                          new TextRun({ text: " actuando como apoderado(a) judicial del ", font: "Arial", size: 24 }),
                          new TextRun({ text: clienteNombre, bold: true, font: "Arial", size: 24 }),
                          new TextRun({ text: ", y por otra parte ", font: "Arial", size: 24 }),
                          new TextRun({ text: inmueble?.nombreResponsable ?? '', bold: true, font: "Arial", size: 24 }),
                          new TextRun({ text: ", persona mayor de edad identificado con la Cédula de Ciudadanía ", font: "Arial", size: 24 }),
                          new TextRun({ text: inmueble?.cedulaResponsable ?? '', bold: true, font: "Arial", size: 24 }),
                          new TextRun({ text: " de Bogotá D.C., quien en adelante se denominará el ", font: "Arial", size: 24 }),
                          new TextRun({ text: "DEUDOR", bold: true, font: "Arial", size: 24 }),
                          new TextRun({ text: ", hemos convenido celebrar el presente ", font: "Arial", size: 24 }),
                          new TextRun({ text: "ACUERDO DE PAGO", bold: true, font: "Arial", size: 24 }),
                          new TextRun({ text: ", que en adelante se regirá por las cláusulas que a continuación se enuncian, previas las siguientes", font: "Arial", size: 24 })
                        ]
                      }),
                      new Paragraph({ text: "\n" }),
                      // Considerandos
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CONSIDERACIONES",
                            bold: true,
                            font: "Arial",
                            size: 24,
                            color: "000000"
                          })
                        ],
                        alignment: "center",
                        heading: HeadingLevel.HEADING_2
                      }),
                      // Párrafo legal adicional (debajo de consideraciones)
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `Que el señor `,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: inmueble?.nombreResponsable ?? '',
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " adeuda acreencias a favor de ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: clienteNombre,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: ", por valor de $",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: inmueble?.deuda_total?.toLocaleString() ?? '',
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          ...(inmueble?.deuda_total && !isNaN(Number(inmueble.deuda_total))
                            ? [
                              new TextRun({
                                text: ` (${numeroALetras(Math.round(Number(inmueble.deuda_total))).toUpperCase()} DE PESOS M/CTE)`,
                                bold: true,
                                font: "Arial",
                                size: 24
                              })
                            ]
                            : []),
                          new TextRun({
                            text: `. Conforme al estado de deuda bajado directamente del sistema a la fecha ${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}, el cual forma parte de este documento.`,
                            font: "Arial",
                            size: 24
                          })
                        ],
                        alignment: "both",
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Que la anterior suma de dinero corresponde a las cuotas vencidas de las expensas de administración, intereses de mora y honorarios causados, de la ",
                            font: "Arial",
                            size: 24
                          }),
                          ...(inmueble?.casa ? [
                            new TextRun({
                              text: `Casa ${inmueble.casa}`,
                              bold: true,
                              font: "Arial",
                              size: 24
                            })
                          ] : [
                            new TextRun({
                              text: `Torre ${inmueble?.torre ?? ''} Apto ${inmueble?.apartamento ?? ''}`,
                              bold: true,
                              font: "Arial",
                              size: 24
                            })
                          ]),
                          new TextRun({
                            text: ", ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: clienteData?.direccion ?? '',
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: ".",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),

                          
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CLÁUSULA PRIMERA. - OBJETO: ",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "El presente acuerdo tiene como objeto principal, facilitar a ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "EL DEUDOR",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " el pago de las obligaciones a favor de la entidad ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "ACREEDOR/A",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " por valor de $",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: inmueble?.deuda_total?.toLocaleString() ?? '',
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " (",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: inmueble?.deuda_total ? numeroALetras(Math.round(inmueble.deuda_total)).toUpperCase() : '',
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "). Frente a lo cual asume desde ya los compromisos y obligaciones contenidos en este Acuerdo.",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CLÁUSULA SEGUNDA. - FACILIDAD DE PAGO DE LAS OBLIGACIONES: ",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "Las condiciones de pago objeto del presente acuerdo, son las siguientes:",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun("Primera. Objeto: El presente acuerdo tiene por objeto establecer las condiciones de pago de la deuda reconocida por el deudor.\n"),
                          new TextRun("Segunda. Valor de la deuda: El valor total de la deuda asciende a $" + (inmueble?.deuda_total?.toLocaleString() ?? '') + ".\n"),
                          new TextRun("Tercera. Forma de pago: El deudor se compromete a pagar la deuda en las cuotas y fechas establecidas en el cronograma anexo.\n"),
                          new TextRun("Cuarta. Incumplimiento: El incumplimiento de cualquiera de las cuotas faculta al acreedor para exigir el pago total de la obligación y dar por terminado el acuerdo.\n")
                        ]
                      }),
                      new Paragraph({ text: "\n" }),
                      // Cronograma de cuotas (ya implementado)
                      new Paragraph({
                        text: "Cronograma de cuotas:",
                        heading: HeadingLevel.HEADING_2
                      }),
                      new Table({
                        rows: [
                          new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph("No. Cuota")] }),
                              new TableCell({ children: [new Paragraph("Fecha Límite")] }),
                              new TableCell({ children: [new Paragraph("Deuda Capital")] }),
                              new TableCell({ children: [new Paragraph("Cuota Capital")] }),
                              new TableCell({ children: [new Paragraph("Deuda Honorarios")] }),
                              new TableCell({ children: [new Paragraph("Cuota Honorarios")] }),
                              new TableCell({ children: [new Paragraph("Cuota Acuerdo")] }),
                            ]
                          }),
                          // Filas de cuotas
                          ...(excelPreview || []).map(row => new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph(String(row.numero_cuota))] }),
                              new TableCell({ children: [new Paragraph(String(row.fecha_limite))] }),
                              new TableCell({ children: [new Paragraph(`$${row.deuda_capital.toLocaleString()}`)] }),
                              new TableCell({ children: [new Paragraph(`$${row.cuota_capital.toLocaleString()}`)] }),
                              new TableCell({ children: [new Paragraph(`$${row.deuda_honorarios.toLocaleString()}`)] }),
                              new TableCell({ children: [new Paragraph(`$${row.cuota_honorarios.toLocaleString()}`)] }),
                              new TableCell({ children: [new Paragraph(`$${row.cuota_acuerdo.toLocaleString()}`)] }),
                            ]
                          })),
                          // Fila de totales
                          new TableRow({
                            children: [
                              new TableCell({ children: [new Paragraph("Totales")], columnSpan: 3 }),
                              new TableCell({ children: [new Paragraph(`$${excelPreview.reduce((sum, r) => sum + (Number(r.cuota_capital) || 0), 0).toLocaleString()}`)] }),
                              new TableCell({ children: [new Paragraph("")] }),
                              new TableCell({ children: [new Paragraph(`$${excelPreview.reduce((sum, r) => sum + (Number(r.cuota_honorarios) || 0), 0).toLocaleString()}`)] }),
                              new TableCell({ children: [new Paragraph(`$${excelPreview.reduce((sum, r) => sum + (Number(r.cuota_acuerdo) || 0), 0).toLocaleString()}`)] }),
                            ]
                          })
                        ]
                      }),
                      new Paragraph({ text: "\n" }),
                      // PARÁGRAFO 1: LAS CUOTAS PACTADAS EN EL PRESENTE ACUERDO DEBERA SER CONSIGNADA ASI:
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "PARÁGRAFO 1: LAS CUOTAS PACTADAS EN EL PRESENTE ACUERDO DEBERÁ SER CONSIGNADA ASÍ:",
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "a. En la cuenta de ahorros No. 123456789 a nombre de GESTION GLOBAL ACG S.A.S en el banco BBVA.",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "b. Las referencias de pago son:",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "i. 123456 - Cuota Capital",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "ii. 654321 - Honorarios",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "iii. 789012 - Cuota Acuerdo",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({ text: "\n" }),
                      // Firmas
                      new Paragraph({
                        children: [
                          new TextRun({ text: "FIRMAS", bold: true })
                        ],
                        heading: HeadingLevel.HEADING_2
                      }),
                      new Paragraph({ text: "\n" }),
                      new Paragraph({ text: "______________________________" }),
                      new Paragraph({ text: "Acreedor: GESTION GLOBAL ACG S.A.S." }),
                      new Paragraph({ text: "\n" }),
                      new Paragraph({ text: "______________________________" }),
                      new Paragraph({ text: `Deudor: ${inmueble?.nombreResponsable ?? ''}` }),
                      // Nueva cláusula octava
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CLAUSULA OCTAVA. NOTIFICACIONES: ",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "Para efectos de las comunicaciones a que haya lugar en virtud del presente Acuerdo, las direcciones son las siguientes: la entidad acreedora las recibirá a en la ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: `${clienteData?.direccion || '[DIRECCIÓN]'}`,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " Oficina de Administración en xxxx y el señor ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: `${inmueble?.nombreResponsable || '[RESPONSABLE]'}`,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " de la ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "TORRE",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: ` ${inmueble?.torre || '[TORRE]'}`,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " APTO ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: `${inmueble?.apartamento || '[APARTAMENTO]'}`,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " CELULAR ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: `${inmueble?.telefonoResponsable || '[CELULAR]'}`,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " CORREO ELECTRÓNICO ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: `${inmueble?.correoResponsable || '[CORREO]'}`,
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: ".",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CLAUSULA NOVENA. PAZ Y SALVO: ",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "Una vez cumplida la totalidad del presente acuerdo, las partes firmantes se declararán a paz y salvo y se abstendrán mutuamente de iniciar cualquier acción judicial o administrativa, respecto a las obligaciones aquí pactadas.",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "CLAUSULA DECIMA. DOMICILIO CONTRACTUAL: ",
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: "Para todos los efectos el domicilio del presente contrato en Soacha Cundinamarca.",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "En constancia se suscribe el presente acuerdo en Soacha Cundinamarca, para el inmueble ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: (inmueble?.torre || "[TORRE]") + "-" + (inmueble?.apartamento || "[APARTAMENTO]"),
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: " a los ",
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' }),
                            bold: true,
                            font: "Arial",
                            size: 24
                          }),
                          new TextRun({
                            text: ".",
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      // FIRMAS Y HUELLA
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "EL DEUDOR,",
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: inmueble?.nombreResponsable?.toUpperCase() || '[NOMBRE DEUDOR]',
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: `C.C. No. ${inmueble?.cedulaResponsable || '[CEDULA]'} de Bogotá D.C.`,
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 200 }
                      }),
                      // HUELLA (espacio)
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "HUELLA",
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ],
                        alignment: "right"
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "\u25A1", // cuadrado para huella
                            font: "Arial",
                            size: 80
                          })
                        ],
                        alignment: "right"
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "INDICE DERECHO",
                            font: "Arial",
                            size: 16
                          })
                        ],
                        alignment: "right"
                      }),
                      // Acreedor
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "EL ACREEDOR,",
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ],
                        spacing: { after: 100 }
                      }),
                      // Firma imagen (opcional, si tienes la imagen puedes usar docx.ImageRun)
                      // new Paragraph({
                      //   children: [
                      //     new ImageRun({
                      //       data: firmaAcreedorImg, // Uint8Array de la imagen
                      //       transformation: { width: 120, height: 60 }
                      //     })
                      //   ]
                      // }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "GESTION GLOBAL ACG S.A.S",
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Nit. 901.662.783-7.",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "JAVIER MAURICIO GARCIA",
                            bold: true,
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: "Representante Legal",
                            font: "Arial",
                            size: 24
                          })
                        ]
                      }),
                    ]
                  }
                ]
              });
              const blob = await Packer.toBlob(doc);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `acuerdo_pago_${inmueble?.nombreResponsable ?? 'inmueble'}.docx`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }}
          >
            Generar acuerdo (Word)
          </Button>
          <Typography variant="body2" color="textSecondary">
            El acuerdo incluirá los datos del inmueble y el cronograma de cuotas cargado.
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Box>
  );
}
