// src/hooks/useEjecutivo.ts

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../../firebase';

export const useEjecutivo = (ejecutivoId?: string) => {
const [ejecutivoData, setEjecutivoData] = useState<any>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cargarEjecutivo = async () => {
      if (!ejecutivoId) {
        setEjecutivoData(null);
        setLoading(false);
        return;
      }

      try {
        const ref = doc(db, 'usuarios', ejecutivoId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setEjecutivoData(snap.data());
        } else {
          setEjecutivoData(null);
          setError('Ejecutivo no encontrado');
        }
      } catch (err: any) {
        setError('Error al cargar ejecutivo');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    cargarEjecutivo();
  }, [ejecutivoId]);

  return { ejecutivoData, loading, error };
};
