// tableCliente/pageTableCliente.tsx

"use client"

import { useEffect, useState } from "react"
import { collection, getDocs } from "firebase/firestore"
import { db } from "../../../firebase"
import { DataTable } from "./data-table"
import { columns, ClienteConDeuda } from "./columns"
import { Inmueble } from "../../../modules/cobranza/models/inmueble.model"
import { Cliente } from "../../../modules/cobranza/models/cliente.model"

export default function PageTableCliente() {
  const [data, setData] = useState<ClienteConDeuda[]>([])

  useEffect(() => {
    const fetchData = async () => {
      const snapshotClientes = await getDocs(collection(db, "clientes"))
      const snapshotInmuebles = await getDocs(collection(db, "inmuebles"))

      const inmuebles: Inmueble[] = snapshotInmuebles.docs.map(doc => doc.data() as Inmueble)

      const clientes: ClienteConDeuda[] = snapshotClientes.docs.map(doc => {
        const cliente = doc.data() as Cliente
        const deudaTotal = inmuebles
          .filter(i => i.clienteId === doc.id)
          .reduce((acc, i) => acc + i.deuda_total, 0)

        return {
          id: doc.id,
          nombre: cliente.nombre,
          correo: cliente.correo,
          telefono: cliente.telefono,
          deudaTotal,
        }
      })

      setData(clientes)
    }

    fetchData()
  }, [])

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Clientes y Deuda Total</h2>
      <DataTable columns={columns} data={data} />
    </div>
  )
}
