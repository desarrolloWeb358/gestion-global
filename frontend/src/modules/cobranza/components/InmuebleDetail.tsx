// src/modules/cobranza/components/InmuebleProcess.tsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
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

  useEffect(() => {
    const load = async () => {
      if (!clienteId || !inmuebleId) return;
      setLoading(true);
      const snap = await getDoc(doc(db, 'clientes', clienteId, 'inmuebles', inmuebleId));
      if (snap.exists()) {
        const data = snap.data() as Omit<Inmueble, 'id'>;
        setInmueble({
          id: snap.id,
          ...data,
          tipificacion: data.tipificacion || 'gestionando',
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
    const ref = doc(db, 'clientes', clienteId, 'inmuebles', inmuebleId);
    await updateDoc(ref, {
      responsable: inmueble.responsable,
      deuda_total: inmueble.deuda_total,
      tipificacion: inmueble.tipificacion,
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
      const numFields = ['deuda_capital','cuota_capital','deuda_honorarios','cuota_honorarios','cuota_acuerdo'];
      for (const f of numFields) {
        if (isNaN(Number(row[f]))) {
          alert(`El valor de la columna ${f} en la fila ${idx+2} no es un número válido.`);
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
    const ref = doc(db, 'clientes', clienteId!, 'inmuebles', inmuebleId!);
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
      setInmueble({ id: snap.id, ...data, tipificacion: data.tipificacion || 'gestionando' });
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
                value={inmueble.responsable}
                onChange={e => setInmueble({ ...inmueble, responsable: e.target.value })}
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
                value={inmueble.tipificacion}
                onChange={e => setInmueble({ ...inmueble, tipificacion: e.target.value })}
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
              <Typography><strong>Responsable:</strong> {inmueble.responsable}</Typography>
              <Typography><strong>Deuda Total:</strong> ${inmueble.deuda_total.toLocaleString()}</Typography>
              <Typography><strong>Tipificación:</strong> {inmueble.tipificacion}</Typography>
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
              const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel } = await import("docx");
              // Texto introductorio y datos del inmueble
              const doc = new Document({
                sections: [
                  {
                    properties: {},
                    children: [
                      new Paragraph({
                        text: "ACUERDO DE PAGO",
                        heading: HeadingLevel.HEADING_1,
                        alignment: "center"
                      }),
                      new Paragraph({ text: "\n" }),
                      new Paragraph({
                        children: [
                          new TextRun(`Responsable: ${inmueble?.responsable ?? ''}`),
                          new TextRun("\n"),
                          new TextRun(`Deuda Total: $${inmueble?.deuda_total?.toLocaleString() ?? ''}`),
                          new TextRun("\n"),
                          new TextRun(`Tipificación: ${inmueble?.tipificacion ?? ''}`),
                          new TextRun("\n"),
                          new TextRun(`Honorarios: ${inmueble?.porcentaje_honorarios ?? ''}%`),
                        ]
                      }),
                      new Paragraph({ text: "\n" }),
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
                      new Paragraph({
                        text: "Este acuerdo de pago se genera automáticamente y debe ser revisado y firmado por las partes correspondientes.",
                      })
                    ]
                  }
                ]
              });
              const blob = await Packer.toBlob(doc);
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `acuerdo_pago_${inmueble?.responsable ?? 'inmueble'}.docx`;
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
