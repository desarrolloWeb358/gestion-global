import React, { useState } from 'react';
import { generarYGuardarAcuerdo } from '../services/agreementService';

interface AgreementFormProps {
  clienteId: string;
  inmuebleId: string;
  onSuccess: () => void;
}

export default function AgreementForm({ clienteId, inmuebleId, onSuccess }: AgreementFormProps) {
  const [numero, setNumero] = useState('');
  const [fechaAcuerdo, setFechaAcuerdo] = useState(new Date().toISOString().slice(0, 10));
  const [caracteristicas, setCaracteristicas] = useState('');
  const [porcentajeHonorarios, setPorcentajeHonorarios] = useState<number | ''>('');
  const [valorTotal, setValorTotal] = useState<number | ''>('');
  const [valorHonorarios, setValorHonorarios] = useState(0);
  const [cuotasCount, setCuotasCount] = useState<number | ''>('');
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().slice(0, 10));

  // Calcular honorarios cuando cambian monto o porcentaje
  React.useEffect(() => {
    const vt = typeof valorTotal === 'number' ? valorTotal : 0;
    const ph = typeof porcentajeHonorarios === 'number' ? porcentajeHonorarios : 0;
    setValorHonorarios(Number(((vt * ph) / 100).toFixed(2)));
  }, [valorTotal, porcentajeHonorarios]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero) return alert('Debe ingresar el número de acuerdo');
    const debtCapital = Number(valorTotal);
    const honorarioPct = Number(porcentajeHonorarios);
    const nCuotas = Number(cuotasCount);

    await generarYGuardarAcuerdo(clienteId, inmuebleId, {
      numero,
      fechaAcuerdo,
      caracteristicas,
      tipo: 'fijo',
      porcentajeHonorarios: honorarioPct,
      deudaCapitalInicial: debtCapital,
      cuotasCount: nCuotas,
      fechaInicio,
    });
  onSuccess();
};

  // Calcular cuota aproximada por pago
  const cuotaAprox = () => {
    const vt = typeof valorTotal === 'number' ? valorTotal : 0;
    const ph = typeof porcentajeHonorarios === 'number' ? porcentajeHonorarios : 0;
    const qc = typeof cuotasCount === 'number' && cuotasCount > 0 ? cuotasCount : 1;
    const principal = vt / qc;
    const honorarios = (vt * ph / 100) / qc;
    return Number((principal + honorarios).toFixed(2));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 border rounded">
      <div>
        <label>Número de Acuerdo</label>
        <input
          type="text"
          value={numero}
          onChange={e => setNumero(e.target.value)}
          className="w-full p-2 border rounded"
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label>Valor Total</label>
          <input
            type="number"
            value={valorTotal}
            onChange={e => setValorTotal(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label>% Honorarios</label>
          <input
            type="number"
            value={porcentajeHonorarios}
            onChange={e => setPorcentajeHonorarios(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
        <div>
          <label># Cuotas</label>
          <input
            type="number"
            value={cuotasCount}
            onChange={e => setCuotasCount(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full p-2 border rounded"
          />
        </div>
      </div>
      <div>
        <p>Cuota aproximada: <strong>${cuotaAprox()}</strong></p>
      </div>
      <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Guardar Acuerdo</button>
    </form>
  );
}