import { useState, useMemo } from "react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Label } from "@/shared/ui/label";
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/shared/ui/table";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/ui/select";
import { Calendar } from "@/shared/ui/calendar";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Typography } from "@/shared/design-system/components/Typography";
import { cn } from "@/shared/lib/cn";
import {
  Calculator,
  Calendar as CalendarIcon,
  RefreshCw,
  Download,
  Save,
  Percent,
  DollarSign,
  Hash,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface CuotaAmortizacion {
  numero: number;
  fechaPago: Date;
  saldoInicial: number;
  cuota: number;
  interes: number;
  capital: number;
  saldoFinal: number;
}

export interface DatosAmortizacion {
  valorTotal: number;
  tasaInteres: number;
  numeroCuotas: number;
  fechaInicial: Date;
  periodicidad: "mensual" | "quincenal" | "semanal";
  cuotas: CuotaAmortizacion[];
}

interface TablaAmortizacionProps {
  deudorId?: string;
  clienteId?: string;
  onGuardar?: (datos: DatosAmortizacion) => Promise<void>;
  datosIniciales?: DatosAmortizacion;
}

const formatCOP = (v: number) => `$ ${Math.round(v).toLocaleString("es-CO")}`;

const formatFecha = (fecha: Date) => {
  return fecha.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
};

// Helpers para <input type="date">
const toInputDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const fromInputDate = (value: string) => {
  const [y, m, d] = value.split("-").map(Number);
  // mediodía local para evitar corrimientos por timezone
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0);
};

export default function TablaAmortizacion({
  deudorId,
  clienteId,
  onGuardar,
  datosIniciales,
}: TablaAmortizacionProps) {
  // Estados con tipos explícitos
  const [valorTotal, setValorTotal] = useState<string>(
    datosIniciales?.valorTotal?.toString() ?? ""
  );
  const [tasaInteres, setTasaInteres] = useState<string>(
    datosIniciales?.tasaInteres?.toString() ?? "15"
  );
  const [numeroCuotas, setNumeroCuotas] = useState<string>(
    datosIniciales?.numeroCuotas?.toString() ?? "12"
  );
  const [fechaInicial, setFechaInicial] = useState<Date>(
    datosIniciales?.fechaInicial ?? new Date()
  );
  const [periodicidad, setPeriodicidad] = useState<
    "mensual" | "quincenal" | "semanal"
  >(datosIniciales?.periodicidad ?? "mensual");

  // ✅ SOLO UNA VEZ (sin duplicados y dentro del componente)
  const [cuotasGeneradas, setCuotasGeneradas] = useState<CuotaAmortizacion[]>(
    datosIniciales?.cuotas ?? []
  );

  const [guardando, setGuardando] = useState<boolean>(false);

  // ✅ Handler dentro del componente (ya tiene acceso al state)
  const handleChangeFechaCuota = (numeroCuota: number, value: string) => {
    setCuotasGeneradas((prev) =>
      prev.map((c) =>
        c.numero === numeroCuota
          ? { ...c, fechaPago: fromInputDate(value) }
          : c
      )
    );
  };

  // Calcular la siguiente fecha según la periodicidad
  const calcularSiguienteFecha = (
    fechaActual: Date,
    periodicidad: "mensual" | "quincenal" | "semanal"
  ): Date => {
    const nuevaFecha = new Date(fechaActual);

    switch (periodicidad) {
      case "mensual":
        nuevaFecha.setMonth(nuevaFecha.getMonth() + 1);
        break;
      case "quincenal":
        nuevaFecha.setDate(nuevaFecha.getDate() + 15);
        break;
      case "semanal":
        nuevaFecha.setDate(nuevaFecha.getDate() + 7);
        break;
    }

    return nuevaFecha;
  };

  // Generar tabla de amortización con cálculo simple
  const generarTabla = () => {
    const capitalInicial = parseFloat(valorTotal);
    const tasaPorcentaje = parseFloat(tasaInteres);
    const cuotas = parseInt(numeroCuotas);

    if (!capitalInicial || capitalInicial <= 0) {
      toast.error("Ingrese un valor total válido");
      return;
    }

    if (isNaN(tasaPorcentaje) || tasaPorcentaje < 0) {
      toast.error("Ingrese una tasa de interés válida");
      return;
    }

    if (!cuotas || cuotas <= 0) {
      toast.error("Ingrese un número de cuotas válido");
      return;
    }

    // Cálculo simple:
    const interesTotal = capitalInicial * (tasaPorcentaje / 100);
    const totalAPagar = capitalInicial + interesTotal;
    const cuotaFija = totalAPagar / cuotas;

    const interesPorCuota = interesTotal / cuotas;
    const capitalPorCuota = capitalInicial / cuotas;

    const tablaCuotas: CuotaAmortizacion[] = [];
    let saldoCapitalPendiente = capitalInicial;
    let fechaActual = new Date(fechaInicial);

    for (let i = 1; i <= cuotas; i++) {
      const esUltimaCuota = i === cuotas;
      const capital = esUltimaCuota ? saldoCapitalPendiente : capitalPorCuota;
      const interes = esUltimaCuota ? cuotaFija - capital : interesPorCuota;
      const saldoFinal = saldoCapitalPendiente - capital;

      tablaCuotas.push({
        numero: i,
        fechaPago: new Date(fechaActual),
        saldoInicial: saldoCapitalPendiente,
        cuota: cuotaFija,
        interes,
        capital,
        saldoFinal: Math.max(0, saldoFinal),
      });

      saldoCapitalPendiente = saldoFinal;
      fechaActual = calcularSiguienteFecha(fechaActual, periodicidad);
    }

    setCuotasGeneradas(tablaCuotas);
    toast.success("Tabla de amortización generada correctamente");
  };

  // Totales
  const totales = useMemo(() => {
    if (cuotasGeneradas.length === 0) {
      return {
        totalCuotas: 0,
        totalInteres: 0,
        totalCapital: 0,
      };
    }

    return {
      totalCuotas: cuotasGeneradas.reduce((sum, c) => sum + c.cuota, 0),
      totalInteres: cuotasGeneradas.reduce((sum, c) => sum + c.interes, 0),
      totalCapital: cuotasGeneradas.reduce((sum, c) => sum + c.capital, 0),
    };
  }, [cuotasGeneradas]);

  // Guardar
  const handleGuardar = async () => {
    if (!onGuardar) return;
    if (cuotasGeneradas.length === 0) {
      toast.error("Genere la tabla de amortización primero");
      return;
    }

    try {
      setGuardando(true);
      await onGuardar({
        valorTotal: parseFloat(valorTotal),
        tasaInteres: parseFloat(tasaInteres),
        numeroCuotas: parseInt(numeroCuotas),
        fechaInicial,
        periodicidad,
        cuotas: cuotasGeneradas,
      });
      toast.success("Tabla de amortización guardada correctamente");
    } catch (error) {
      console.error(error);
      toast.error("Error al guardar la tabla de amortización");
    } finally {
      setGuardando(false);
    }
  };

  // Exportar a Excel (simulación - necesitarías una librería como xlsx)
  const handleExportar = () => {
    toast.info("Función de exportación pendiente de implementar");
  };

  return (
    <div className="space-y-6">
      {/* Parámetros */}
      <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-brand-primary" />
              <Typography
                variant="h3"
                className="!text-brand-secondary font-semibold"
              >
                Parámetros del acuerdo
              </Typography>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={generarTabla}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Generar tabla
              </Button>
              {onGuardar && (
                <Button
                  variant="brand"
                  size="sm"
                  onClick={handleGuardar}
                  disabled={guardando || cuotasGeneradas.length === 0}
                  className="gap-2"
                >
                  <Save className="h-4 w-4" />
                  {guardando ? "Guardando..." : "Aplicar al acuerdo"}
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Valor total */}
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Valor del capital inicial
              </Label>
              <Input
                type="number"
                value={valorTotal}
                onChange={(e) => setValorTotal(e.target.value)}
                placeholder="Ej: 3082793"
                className="border-brand-secondary/30"
              />
            </div>

            {/* Tasa de interés */}
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Tasa de interés/honorarios (%)
              </Label>
              <Input
                type="number"
                step="0.1"
                value={tasaInteres}
                onChange={(e) => setTasaInteres(e.target.value)}
                placeholder="Ej: 15"
                className="border-brand-secondary/30"
              />
              {valorTotal && tasaInteres && (
                <Typography variant="small" className="text-muted-foreground">
                  Interés total:{" "}
                  {formatCOP(
                    parseFloat(valorTotal) * (parseFloat(tasaInteres) / 100)
                  )}
                </Typography>
              )}
            </div>

            {/* Número de cuotas */}
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Número de cuotas
              </Label>
              <Input
                type="number"
                value={numeroCuotas}
                onChange={(e) => setNumeroCuotas(e.target.value)}
                placeholder="Ej: 12"
                className="border-brand-secondary/30"
              />
            </div>

            {/* Periodicidad */}
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Periodicidad
              </Label>
              <Select
                value={periodicidad}
                onValueChange={(v: string) =>
                  setPeriodicidad(v as "mensual" | "quincenal" | "semanal")
                }
              >
                <SelectTrigger className="border-brand-secondary/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensual">Mensual</SelectItem>
                  <SelectItem value="quincenal">Quincenal</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Fecha inicial */}
            <div className="space-y-2">
              <Label className="text-brand-secondary font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Fecha del primer pago
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal border-brand-secondary/30",
                      !fechaInicial && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {fechaInicial ? formatFecha(fechaInicial) : "Seleccionar"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={fechaInicial}
                    onSelect={(date) => date && setFechaInicial(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Vista previa del total */}
            {valorTotal && tasaInteres && (
              <div className="space-y-2">
                <Label className="text-brand-secondary font-medium flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Total del acuerdo
                </Label>
                <div className="h-10 rounded-md border border-green-200 bg-green-50 px-3 flex items-center">
                  <Typography variant="body" className="font-bold text-green-700">
                    {formatCOP(
                      parseFloat(valorTotal) *
                      (1 + parseFloat(tasaInteres) / 100)
                    )}
                  </Typography>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Tabla de amortización */}
      {cuotasGeneradas.length > 0 && (
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <div className="flex items-center justify-between">
              <Typography
                variant="h3"
                className="!text-brand-secondary font-semibold"
              >
                Tabla de amortización
              </Typography>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportar}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                Exportar
              </Button>
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="overflow-x-auto rounded-lg border border-brand-secondary/10">
              <Table>
                <TableHeader className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5">
                  <TableRow className="border-brand-secondary/10 hover:bg-transparent">
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      #
                    </TableHead>

                    {/* ✅ Fecha justo después del número */}
                    <TableHead className="text-center text-brand-secondary font-semibold">
                      Fecha de pago
                    </TableHead>

                    <TableHead className="text-right text-brand-secondary font-semibold">
                      Saldo inicial
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold">
                      Cuota
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold">
                      Honorarios
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold">
                      Capital
                    </TableHead>
                    <TableHead className="text-right text-brand-secondary font-semibold">
                      Saldo final
                    </TableHead>
                  </TableRow>
                </TableHeader>


                <TableBody>
                  {cuotasGeneradas.map((cuota, index) => (
                    <TableRow
                      key={cuota.numero}
                      className={cn(
                        "border-brand-secondary/5 transition-colors",
                        index % 2 === 0 ? "bg-white" : "bg-brand-primary/[0.02]",
                        "hover:bg-brand-primary/5"
                      )}
                    >
                      <TableCell className="text-center font-medium">
                        {cuota.numero}
                      </TableCell>

                      <TableCell className="text-center">
                        <Input
                          type="date"
                          value={toInputDate(cuota.fechaPago)}
                          onChange={(e) =>
                            handleChangeFechaCuota(cuota.numero, e.target.value)
                          }
                          className="mx-auto w-[150px] border-brand-secondary/30"
                        />
                      </TableCell>

                      {/* ✅ Fecha editable */}
                      <TableCell className="text-center">
                        <Input
                          type="date"
                          value={toInputDate(cuota.fechaPago)}
                          onChange={(e) =>
                            handleChangeFechaCuota(
                              cuota.numero,
                              e.target.value
                            )
                          }
                          className="mx-auto w-[150px] border-brand-secondary/30"
                        />
                      </TableCell>

                      <TableCell className="text-right font-medium">
                        {formatCOP(cuota.saldoInicial)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-brand-primary">
                        {formatCOP(cuota.cuota)}
                      </TableCell>
                      <TableCell className="text-right text-orange-600">
                        {formatCOP(cuota.interes)}
                      </TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCOP(cuota.capital)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCOP(cuota.saldoFinal)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Fila de totales */}
                  <TableRow className="font-semibold bg-gradient-to-r from-brand-primary/10 to-brand-secondary/10 border-t-2 border-brand-primary/20">
                    <TableCell colSpan={3} className="text-right text-brand-secondary">
                      TOTALES
                    </TableCell>
                    <TableCell className="text-right text-brand-secondary">
                      {formatCOP(totales.totalCuotas)}
                    </TableCell>
                    <TableCell className="text-right text-brand-secondary">
                      {formatCOP(totales.totalInteres)}
                    </TableCell>
                    <TableCell className="text-right text-brand-secondary">
                      {formatCOP(totales.totalCapital)}
                    </TableCell>
                    <TableCell className="text-right text-brand-secondary">$ 0</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Resumen */}
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-lg bg-blue-50 p-4">
                <Typography variant="small" className="text-blue-600 font-medium">
                  Capital inicial
                </Typography>
                <Typography variant="h3" className="!text-blue-700">
                  {formatCOP(totales.totalCapital)}
                </Typography>
              </div>
              <div className="rounded-lg bg-orange-50 p-4">
                <Typography variant="small" className="text-orange-600 font-medium">
                  Total honorarios ({tasaInteres}%)
                </Typography>
                <Typography variant="h3" className="!text-orange-700">
                  {formatCOP(totales.totalInteres)}
                </Typography>
              </div>
              <div className="rounded-lg bg-green-50 p-4">
                <Typography variant="small" className="text-green-600 font-medium">
                  Total del acuerdo
                </Typography>
                <Typography variant="h3" className="!text-green-700">
                  {formatCOP(totales.totalCuotas)}
                </Typography>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
