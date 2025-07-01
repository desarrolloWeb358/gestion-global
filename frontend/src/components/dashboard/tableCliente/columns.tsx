// tableCliente/columns.tsx

"use client"

import { ColumnDef } from "@tanstack/react-table"

export type ClienteConDeuda = {
  id: string
  nombre: string
  correo: string
  telefono: string
  deudaTotal: number // ← Calculado
}

export const columns: ColumnDef<ClienteConDeuda>[] = [
  {
    accessorKey: "nombre",
    header: "Nombre",
  },
  {
    accessorKey: "correo",
    header: "Correo",
  },
  {
    accessorKey: "telefono",
    header: "Teléfono",
  },
  {
    accessorKey: "deudaTotal",
    header: "Deuda Total",
    cell: ({ row }) => (
      <span>
        {row.original.deudaTotal.toLocaleString("es-CO", {
          style: "currency",
          currency: "COP",
        })}
      </span>
    ),
  },
]
