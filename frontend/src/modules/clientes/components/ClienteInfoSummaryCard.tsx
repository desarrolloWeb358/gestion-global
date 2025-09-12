import { Cliente } from "@/modules/clientes/models/cliente.model";

export function ClienteInfoSummaryCard({ cliente }: { cliente: Cliente }) {
  // helpers para mostrar guiones si no hay dato
  const F = (v?: string | number | null) => (v ?? "—");

  return (
    <div className="rounded-2xl border p-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-12">
        <p><span className="font-semibold">Correo:</span> {F((cliente as any).correo)}</p>

        <p><span className="font-semibold">Teléfono:</span> {F((cliente as any).telefono)}</p>
        <p><span className="font-semibold">Dirección:</span> {F((cliente as any).direccion)}</p>

        <p><span className="font-semibold">N° Cuenta:</span> {F((cliente as any).numeroCuenta)}</p>
        <p><span className="font-semibold">Tipo de Cuenta:</span> {F((cliente as any).tipoCuenta)}</p>
      </div>
    </div>
  );
}
