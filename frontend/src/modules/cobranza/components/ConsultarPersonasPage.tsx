"use client";

import React, { useState } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";
import { useLoading } from "@/app/providers/LoadingContext";
import { getAuth } from "firebase/auth";
import { Spinner } from "@/shared/ui/spinner";

const OMNIX_CF_URL = import.meta.env.VITE_OMNIX_CF_URL as string;
const OMNIX_API_KEY = import.meta.env.VITE_OMNIX_API_KEY as string;

export default function ConsultarPersonasPage() {
  const [identificacion, setIdentificacion] = useState("");
  const [resultado, setResultado] = useState<string[][] | null>(null);
  const [error, setError] = useState("");
  const { isLoading, setLoading } = useLoading();

  const handleSubmit = async () => {
    if (!identificacion.trim()) {
      setError("Ingrese el número de documento.");
      return;
    }

    const user = getAuth().currentUser;
    if (!user?.email) {
      setError("No se pudo identificar el usuario.");
      return;
    }

    if (!OMNIX_CF_URL || !OMNIX_API_KEY) {
      setError("Configuración de consulta incompleta. Contacte al administrador.");
      return;
    }

    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const response = await fetch(OMNIX_CF_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": OMNIX_API_KEY,
        },
        body: JSON.stringify({
          email: user.email,
          identificacion: identificacion.trim(),
          modo: "documento",
        }),
      });

      if (response.status === 404) {
        setError("Usuario no autorizado para realizar consultas. Contacte al administrador.");
        return;
      }
      if (response.status === 402) {
        setError("No hay consultas disponibles en el plan.");
        return;
      }
      if (response.status === 403) {
        setError("Sin acceso al módulo de consultas.");
        return;
      }
      if (!response.ok) {
        setError(`Error en la consulta (${response.status}). Intente de nuevo.`);
        return;
      }

      const data = await response.json() as {
        tabla: string[][];
        saldo?: number;
        found?: boolean;
      };

      if (!data?.tabla?.length || !data.found) {
        setError("No se encontraron resultados para este documento.");
        setResultado(null);
        return;
      }

      setResultado(data.tabla);
    } catch (err) {
      console.error(err);
      setError("Error de conexión al consultar. Intente de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return <Spinner className="h-32" />;
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h2 className="text-2xl font-bold">Consulta de personas</h2>

      <div className="flex gap-4 items-end">
        <div className="flex-1 max-w-sm">
          <Input
            placeholder="Número de documento"
            value={identificacion}
            onChange={(e) => setIdentificacion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !isLoading && handleSubmit()}
            inputMode="numeric"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Consultar
        </Button>
      </div>

      {error && <p className="text-red-500 font-medium">{error}</p>}

      {resultado && (
        <div className="overflow-x-auto border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                {resultado[0].map((col, index) => (
                  <TableHead key={index}>{col}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {resultado.slice(1).map((fila, i) => (
                <TableRow key={i}>
                  {fila.map((col, j) => (
                    <TableCell key={j} className="whitespace-pre-line">
                      {col || "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
