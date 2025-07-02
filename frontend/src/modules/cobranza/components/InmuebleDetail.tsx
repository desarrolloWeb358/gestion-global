import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../components/ui/table";
import { Checkbox } from "../../../components/ui/checkbox";
import { Inmueble } from "../../../modules/cobranza/models/inmueble.model";
import AgreementTable from "../components/AgreementTableGrid"
import SubirPlantillaExcel from "../../../components/SubirPlantillaExcel";

interface Props {
  inmueble?: Inmueble;
}

export default function InmuebleDetailTabs({ inmueble }: Props) {
  const acuerdo = inmueble?.acuerdo_pago;
  const historial = inmueble?.historial_acuerdos ?? [];


<<<<<<< HEAD
=======
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
  
  const [clienteData, setClienteData] = useState<any>(null);

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

  // Llama useEjecutivo solo cuando clienteData está disponible
  const { ejecutivoData } = useEjecutivo(clienteData?.ejecutivoId);
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
>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232

  return (
    <Tabs defaultValue="cronograma" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="cronograma">Cronograma de cuotas</TabsTrigger>
        <TabsTrigger value="descargar">Descargar acuerdo</TabsTrigger>
        <TabsTrigger value="historial">Historial de acuerdos</TabsTrigger>
      </TabsList>

      {/* TAB: CRONOGRAMA DE CUOTAS */}
      <TabsContent value="cronograma">
        <div className="mb-4">
          <SubirPlantillaExcel
            porcentajeHonorarios={10} // puedes ajustar este número dinámicamente
            inmuebleId={inmueble?.id || "sin-id"} // asegúrate de que inmueble.id exista
          />
        </div>
        <AgreementTable inmuebleId={""} />
        {acuerdo && acuerdo.cuotas && acuerdo.cuotas.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pagado</TableHead>
                <TableHead>Mes</TableHead>
                <TableHead>Valor esperado</TableHead>
                <TableHead>Fecha límite</TableHead>
                <TableHead>Observación</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {acuerdo.cuotas.map((cuota, index) => (
                <TableRow key={index}>
                  <TableCell>
                    <Checkbox checked={cuota.pagado} disabled />
                  </TableCell>
                  <TableCell>{cuota.mes}</TableCell>
                  <TableCell>${cuota.valor_esperado.toLocaleString()}</TableCell>
                  <TableCell>{cuota.fecha_limite || '-'}</TableCell>
                  <TableCell>{cuota.observacion || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p>No hay cuotas registradas.</p>
        )}
      </TabsContent>

      {/* TAB: DESCARGAR ACUERDO ACTUAL */}
      <TabsContent value="descargar">
        {acuerdo ? (
          acuerdo.numero && acuerdo.fecha_acuerdo ? (
            <div className="space-y-2">
              <p className="font-semibold">Acuerdo #{acuerdo.numero}</p>
              {/** Este campo puede no estar si no hay archivo */}
              {'archivoUrl' in acuerdo && (acuerdo as any).archivoUrl ? (
                <a
                  href={(acuerdo as any).archivoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  Descargar archivo del acuerdo
                </a>
              ) : (
                <p className="text-muted-foreground">No se cargó archivo para este acuerdo</p>
              )}
            </div>
          ) : (
            <p>No hay acuerdo actual para mostrar.</p>
          )
        ) : (
          <p>No hay acuerdo actual disponible.</p>
        )}
      </TabsContent>

      {/* TAB: HISTORIAL DE ACUERDOS */}
      <TabsContent value="historial">
        {historial.length > 0 ? (
          <ul className="space-y-2">
            {historial.map((ac, index) => (
              <li key={index} className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {ac.fecha_acuerdo} – #{ac.numero}
                </span>
                {ac.archivoUrl ? (
                  <a
                    href={ac.archivoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    Descargar
                  </a>
                ) : (
                  <span className="text-muted-foreground">Sin archivo</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No hay historial de acuerdos previos.</p>
        )}
      </TabsContent>
    </Tabs>
  );
}
