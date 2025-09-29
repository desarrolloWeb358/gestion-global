"use client"

import { useState } from "react"
import { Input } from "@/shared/ui/input"
import { Button } from "@/shared/ui/button"
import { Deudor } from "../models/deudores.model"
import { useParams } from "react-router-dom"
import { agregarAbonoAlDeudor } from "../services/deudorService"
import { useAcl } from "@/modules/auth/hooks/useAcl"
import { PERMS } from "@/shared/constants/acl"

interface FormAgregarAbonoProps {
  deudor: Deudor
  onAgregado: () => void
}

export default function FormAgregarAbono({ deudor, onAgregado }: FormAgregarAbonoProps) {
  const { clienteId } = useParams()
  const [monto, setMonto] = useState("")
  const [fecha, setFecha] = useState("")
  const [recibo, setRecibo] = useState("")
  const [tipo, setTipo] = useState<"ordinario" | "extraordinario" | "anticipo">("ordinario")
  const [loading, setLoading] = useState(false)

  // === RBAC ===
  const { can, roles = [], loading: aclLoading } = useAcl()
  const canView = can(PERMS.Abonos_Read)
  const canEdit = can(PERMS.Abonos_Edit)
  const isCliente = roles.includes("cliente")

  // Si es cliente → solo lectura aunque por error tenga Abonos_Edit
  const canEditSafe = canEdit && !isCliente

  const handleSubmit = async () => {
    if (!canEditSafe) return // 🚫 seguridad extra
    if (!clienteId || !deudor.id || !monto || !fecha) return

    setLoading(true)
    try {
      await agregarAbonoAlDeudor(clienteId, deudor.id, {
        monto: Number(monto),
        fecha,
        recibo,
      })

      setMonto("")
      setFecha("")
      setRecibo("")
      setTipo("ordinario")
      onAgregado()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (aclLoading) return <p className="text-sm text-muted-foreground">Cargando permisos…</p>
  if (!canView) return <p className="text-sm text-muted-foreground">No tienes acceso a Abonos.</p>

  return (
    <div className="grid gap-2 md:grid-cols-5 items-end">
      <Input
        placeholder="Monto"
        type="number"
        value={monto}
        onChange={(e) => setMonto(e.target.value)}
        disabled={!canEditSafe}
      />
      <Input
        placeholder="Fecha"
        type="date"
        value={fecha}
        onChange={(e) => setFecha(e.target.value)}
        disabled={!canEditSafe}
      />
      <Input
        placeholder="Recibo"
        value={recibo}
        onChange={(e) => setRecibo(e.target.value)}
        disabled={!canEditSafe}
      />
      <select
        value={tipo}
        onChange={(e) => setTipo(e.target.value as any)}
        disabled={!canEditSafe}
        className="border p-2 rounded-md text-sm"
      >
        <option value="ordinario">Ordinario</option>
        <option value="extraordinario">Extraordinario</option>
        <option value="anticipo">Anticipo</option>
      </select>

      {canEditSafe && (
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? "Guardando…" : "Agregar abono"}
        </Button>
      )}
    </div>
  )
}
