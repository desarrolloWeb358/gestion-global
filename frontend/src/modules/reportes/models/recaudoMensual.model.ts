// ==============================
// models/recaudoMensual.model.ts
// ==============================

export interface EstadoMensualItem {
  id: string;
  clienteUID: string;
  inmuebleUID: string;
  mes: string;           // "YYYY-MM"
  deuda: number;
  honorario: number;
  recaudo: number;
}

export interface TotalesMes {
  mes: string;           // "YYYY-MM"
  totalDeuda: number;
  totalHonorario: number;
  totalRecaudo: number;
}

export interface ResumenPorCliente {
  clienteUID: string;
  clienteNombre: string; // ← agregado para mostrar en UI
  deuda: number;
  honorario: number;
  recaudo: number;
}

export interface ResumenMesSeleccionado {
  totales: TotalesMes;
  porCliente: ResumenPorCliente[];
}
