// src/hooks/useInmueblesDelCliente.ts
import { useEffect, useState } from "react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { db } from "../firebase"
import { deudor } from "../modules/cobranza/models/deudores.model"

export const useInmueblesDelCliente = (clienteId: string | null) => {
  const [inmuebles, setInmuebles] = useState<deudor[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clienteId) return

    const obtenerInmuebles = async () => {
      try {
        const ref = collection(db, "inmuebles")
        const q = query(ref, where("clienteId", "==", clienteId))
        const snapshot = await getDocs(q)
        const docs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as deudor[]
        setInmuebles(docs)
      } catch (error) {
        console.error("Error obteniendo inmuebles del cliente:", error)
      } finally {
        setLoading(false)
      }
    }

    obtenerInmuebles()
  }, [clienteId])

  return { inmuebles, loading }
}
