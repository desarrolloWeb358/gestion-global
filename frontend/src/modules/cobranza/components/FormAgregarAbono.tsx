"use client"

import { useState } from "react"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { Deudor } from "../models/deudores.model"
import { useParams } from "react-router-dom"
import { agregarAbonoAlDeudor } from "../services/deudorService"

interface FormAgregarAbonoProps {
  deudor: Deudor
  onAgregado: () => void
}

export default function FormAgregarAbono({ deudor, onAgregado }: FormAgregarAbonoProps) {
  const { clienteId } = useParams()
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [recibo, setRecibo] = useState('')
  const [tipo, setTipo] = useState<'ordinario' | 'extraordinario' | 'anticipo'>('ordinario')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!clienteId || !deudor.id || !monto || !fecha) return
    setLoading(true)

    await agregarAbonoAlDeudor(clienteId, deudor.id, {
      monto: Number(monto),
      fecha,
      recibo,
      tipo,
    })

    setMonto('')
    setFecha('')
    setRecibo('')
    setTipo('ordinario')
    setLoading(false)
    onAgregado()
  }

  return (
    <div className="grid gap-2 md:grid-cols-5 items-end">
      <Input
        placeholder="Monto"
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
      />
      <Input
        placeholder="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
      />
      <Input
        placeholder="Recibo"
        value={recibo}
        onChange={(e) => setRecibo(e.target.value)}
      />
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as any)}
        className="border p-2 rounded-md text-sm"
      >
        <option value="ordinario">Ordinario</option>
        <option value="extraordinario">Extraordinario</option>
        <option value="anticipo">Anticipo</option>
      </select>
      <Button onClick={handleSubmit} disabled={loading}>
        Agregar abono
      </Button>
    </div>
  )
}
