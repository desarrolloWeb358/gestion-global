import { useEffect, useState } from "react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { ChartBarData } from "../components/ui/chart-bar-interactive"

export function useClienteChartData(clienteId: string | null) {
  const [data, setData] = useState<ChartBarData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clienteId) return

    const fetchData = async () => {
      const inmueblesRef = collection(db, "inmuebles")
      const q = query(inmueblesRef, where("responsable", "==", clienteId))
      const querySnapshot = await getDocs(q)

      let acumulado: ChartBarData[] = []

      querySnapshot.forEach((doc) => {
        const inmueble = doc.data()
        const recaudos = inmueble.recaudos ?? {}

        Object.entries(recaudos).forEach(([mes, detalle]: any) => {
          const honorario = detalle.monto * (inmueble.porcentaje_honorarios ?? 0.11)
          const yaExiste = acumulado.find((d) => d.date === mes)

          if (yaExiste) {
            yaExiste.recaudo += detalle.monto
            yaExiste.honorarios += honorario
          } else {
            acumulado.push({
              date: mes,
              recaudo: detalle.monto,
              honorarios: honorario,
            })
          }
        })
      })

      setData(acumulado.sort((a, b) => a.date.localeCompare(b.date)))
      setLoading(false)
    }

    fetchData()
  }, [clienteId])

  return { data, loading }
}
