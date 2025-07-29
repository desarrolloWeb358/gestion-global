// src/modules/deudores/components/FormAgregarAbono.tsx
import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { agregarAbonoAlDeudor } from '../services/deudorService'
import { useParams } from 'react-router-dom'

export default function FormAgregarAbono({ onAgregado }: { onAgregado: () => void }) {
  const { clienteId, deudorId } = useParams()
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState('')
  const [recibo, setRecibo] = useState('')
  const [tipo, setTipo] = useState<'ordinario' | 'extraordinario' | 'anticipo'>('ordinario')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!clienteId || !deudorId || !monto || !fecha) return
    setLoading(true)
    await agregarAbonoAlDeudor(clienteId, deudorId, {
      monto: Number(monto),
      fecha,
      recibo,
      tipo,
    })
    setLoading(false)
    setMonto('')
    setFecha('')
    setRecibo('')
    setTipo('ordinario')
    onAgregado()
  }

  return (
    <div className="grid gap-2 md:grid-cols-4 items-end">
      <Input placeholder="Monto" type="number" value={monto} onChange={(e) => setMonto(e.target.value)} />
      <Input placeholder="Fecha" type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
      <Input placeholder="Recibo" value={recibo} onChange={(e) => setRecibo(e.target.value)} />
      <select value={tipo} onChange={(e) => setTipo(e.target.value as any)} className="border p-2 rounded">
        <option value="ordinario">Ordinario</option>
        <option value="extraordinario">Extraordinario</option>
        <option value="anticipo">Anticipo</option>
      </select>
      <Button onClick={handleSubmit} disabled={loading}>Agregar abono</Button>
    </div>
  )
}
