import { useState, useEffect, useMemo } from "react"
import { ChartBarInteractive } from "../ui/chart-bar-interactive"
import { DataTable } from "../dashboard/tableCliente/data-table"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../../firebase"
import { UsuarioSistema } from "../../modules/usuarios/models/usuarioSistema.model"
import { deudor } from "../../modules/cobranza/models/deudores.model"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../components/ui/select"
import { useClienteResumen } from "../../hooks/useClienteResumen"
import { useEjecutivoChartData } from "../../hooks/useEjecutivoChartData"

export default function DashboardAdmin() {
  const [inmuebles, setInmuebles] = useState<deudor[]>([])
  const [usuarioSeleccionado, setUsuarioSeleccionado] = useState<string | null>(null)
  const [inmueblesCliente, setInmueblesCliente] = useState<deudor[]>([]);
  const resumen = useClienteResumen(usuarioSeleccionado ?? "", inmuebles)
  const [rolSeleccionado, setRolSeleccionado] = useState<string>("todos")

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const { data: datosGrafico, loading: loadingGrafico } = useEjecutivoChartData(usuarioSeleccionado);

  const clientesDelEjecutivo = useMemo(() => {
    if (rolSeleccionado !== "ejecutivo" || !usuarioSeleccionado) return []

    const clientesAsignados = data.filter(u => u.rol === "cliente" && u.asociadoA === usuarioSeleccionado)

    return clientesAsignados.map(cliente => {
      const inmueblesCliente = inmuebles.filter(i => i.clienteId === cliente.id)
      const deudaTotal = inmueblesCliente.reduce((acc, i) => acc + i.deuda_total, 0)
      const recuperado = inmueblesCliente.reduce((acc, i) => acc + calcularTotalRecuperado(i), 0)

      return {
        id: cliente.id,
        nombre: cliente.nombre || cliente.email,
        correo: cliente.email,
        telefono: cliente.telefonoUsuario || "N/A",
        deudaTotal,
        recuperado
      }
    })
  }, [rolSeleccionado, usuarioSeleccionado, data, inmuebles])

  const tablaInmuebles = useMemo(() => {
    return inmueblesCliente.map((i, index) => ({
      id: index + 1,
      header: `Torre ${i.torre || ""} Apto/Casa ${i.apartamento || i.casa || ""}`,
      type: "inmueble",
      status: i.estado.toUpperCase(),
      target: i.telefonoResponsable || "Sin teléfono",
      limit: `${i.deuda_total.toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
      })}`,
      reviewer: calcularTotalRecuperado(i).toLocaleString("es-CO", {
        style: "currency",
        currency: "COP",
      }),
    }))
  }, [inmueblesCliente])

  const dataFiltrada = useMemo(() => {
    if (rolSeleccionado === "todos") return data
    return data.filter((item) => item.rol === rolSeleccionado)
  }, [data, rolSeleccionado])

  const usuariosDelRol = useMemo(() => {
    if (rolSeleccionado === "todos") return []
    return dataFiltrada.map((u) => ({
      id: u.id,
      nombre: u.nombre || u.email || "Sin nombre",
    }))
  }, [dataFiltrada, rolSeleccionado])


  function calcularTotalRecuperado(inmueble: deudor): number {
    return Object.values(inmueble.recaudos ?? {}).reduce(
      (acc, curr) => acc + (curr.monto ?? 0),
      0
    )
  }

  useEffect(() => {
    const obtenerInmuebles = async () => {
      const snapshot = await getDocs(collection(db, "inmuebles"))
      const inmueblesAll = snapshot.docs.map(doc => doc.data() as deudor)
      setInmuebles(inmueblesAll) // <- define un setInmuebles
    }
    obtenerInmuebles()
  }, [])
  useEffect(() => {
    const obtenerInmueblesCliente = async () => {
      if (!usuarioSeleccionado) return
      const snapshot = await getDocs(collection(db, "inmuebles"))
      const inmuebles = snapshot.docs
        .map(doc => doc.data() as deudor)
        .filter(i => i.clienteId === usuarioSeleccionado)

      setInmueblesCliente(inmuebles)
    }

    obtenerInmueblesCliente()
  }, [usuarioSeleccionado])

  useEffect(() => {


    const obtenerUsuarios = async () => {
      try {
        const snapshot = await getDocs(collection(db, "usuarios"))
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<UsuarioSistema, "id">)
        }))

        setData(docs) // ahora sí data tiene usuarios
      } catch (error) {
        console.error("Error al obtener los usuarios:", error)
      } finally {
        setLoading(false)
      }
    }

    obtenerUsuarios()
  }, [])
  return (
    <div className="flex flex-col flex-1  w-full max-w-7xl mx-auto px-4 py-6 lg:px-6 lg:py-8 gap-6">
      {/* Resumen de cifras */}
      {usuarioSeleccionado && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-muted p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Deuda total</p>
            <p className="text-lg font-bold">${resumen.deudaTotal.toLocaleString()}</p>
          </div>
          <div className="bg-muted p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">Recaudado</p>
            <p className="text-lg font-bold">${resumen.totalRecaudado.toLocaleString()}</p>
          </div>
          <div className="bg-muted p-4 rounded-xl">
            <p className="text-sm text-muted-foreground">% Recuperado</p>
            <p className="text-lg font-bold">{resumen.porcentajeRecuperado.toFixed(2)}</p>
          </div>
        </div>
      )}
      {/* select ejecutivo o cliente */}
      <div className="w-full flex justify-end">
        <div className="flex gap-4">

          <Select onValueChange={(value) => setRolSeleccionado(value)}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Filtrar por rol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="ejecutivo">Ejecutivo</SelectItem>
            </SelectContent>
          </Select>

          {rolSeleccionado !== "todos" && usuariosDelRol.length > 0 && (
            <Select
              defaultValue=""
              onValueChange={(value) => setUsuarioSeleccionado(value)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder={`Selecciona un ${rolSeleccionado}`} />
              </SelectTrigger>
              <SelectContent>
                {usuariosDelRol.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>



      {/* Gráfico */}
      <div className="w-full">
        {loadingGrafico ? (
          <p className="text-muted text-sm">Cargando gráfico...</p>
        ) : (
          <ChartBarInteractive
            data={datosGrafico}
            titulo="Recaudo y Honorarios"
            descripcion="Distribución mensual"
          />
        )}

      </div>

      {/* Tabla de datos */}
      {loading ? (
        <p className="text-muted text-sm">Cargando datos...</p>
      ) : usuarioSeleccionado && rolSeleccionado === "cliente" ? (
        <DataTable data={tablaInmuebles} columns={[]} />
      ) : usuarioSeleccionado && rolSeleccionado === "ejecutivo" ? (
        <DataTable data={clientesDelEjecutivo} columns={[]} />
      ) : null}
    </div>
  )
}
