<<<<<<< HEAD
"use client";

import React, { useState } from "react";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { useLoading } from "../../../context/LoadingContext";
import { construirConsulta, extraerDatos } from "../services/consultaPersona";
=======
// src/modules/common/pages/ConsultaRutPage.tsx
import React, { useState } from 'react';
import { Button, TextField, Box, Typography } from '@mui/material';
import { extraerDatos } from '../services/consultaPersona';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

import { useLoading } from '../../../context/LoadingContext';
import { getAuth } from "firebase/auth";

>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232

export default function ConsultarPersonasPage() {
  const [formData, setFormData] = useState({
    identificacion: "",
    nombre1: "",
    nombre2: "",
    apellido1: "",
    apellido2: "",
  });

  const [resultado, setResultado] = useState<string[][] | null>(null);
  const [error, setError] = useState("");
  const { setLoading } = useLoading();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
<<<<<<< HEAD

=======
  const { setLoading } = useLoading();
>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232
  const handleSubmit = async () => {

    const { identificacion, nombre1, nombre2, apellido1, apellido2 } = formData;
    // Si no hay identificación, validar que al menos 3 de los otros campos estén diligenciados
    if (!identificacion) {
      const camposNombre = [nombre1, nombre2, apellido1, apellido2];
      const camposDiligenciados = camposNombre.filter(c => c.trim() !== '').length;
      if (camposDiligenciados < 3) {
        setError('Debe diligenciar al menos 3 de los 4 campos del nombre si no ingresa una identificación.');
        return;
      }
    }

    const user = getAuth().currentUser;
    const uid = user?.uid;
    console.log("UID del usuario:", uid);

    if (!uid) {
      setError('No se pudo identificar el usuario.');
      return;
    }

    const payload = {
      ...formData,
      uid, 
    };

    setLoading(true);
    try {
<<<<<<< HEAD
      const consulta = construirConsulta(formData);

      const response = await fetch("https://consultarrut-prldsxsgzq-uc.a.run.app", {
        method: "POST",
=======
      setError('');
      //console.log("Datos del formulario:", formData);
      const response = await fetch("https://consultarpersonas-prldsxsgzq-uc.a.run.app", {
        method: 'POST',
>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232
        headers: {
          "Content-Type": "application/json",
        },
<<<<<<< HEAD
        body: JSON.stringify({ consulta }),
=======
        body: JSON.stringify(payload)
>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232
      });

      const text = await response.text();

      if (text === "SIN_AUTORIZACION") {
        setError("No esta autorizado para realizar esta consulta, revise con el administrador del sistema.");
        setResultado(null);
        setLoading(false); // 👈 Desactiva overlay
        return;
      }


      const tabla = extraerDatos(text);

      if (tabla.length === 0) {
<<<<<<< HEAD
        setError("No se encontraron resultados.");
=======
        setError('No se encontraron resultados.');
>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232
        setResultado(null);
      } else {
        setResultado(tabla);
        setError("");
      }
    } catch (err) {
      console.error(err);
<<<<<<< HEAD
      setError("Error en la consulta.");
    } finally {
      setLoading(false);
=======
    } finally {
      setLoading(false); // 👈 Desactiva overlay
>>>>>>> d856f43fb77832f047e9b4ddc9c740908f736232
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h2 className="text-2xl font-bold">Consulta de personas</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input placeholder="Identificación" name="identificacion" onChange={handleChange} />
        <Input placeholder="Primer Nombre" name="nombre1" onChange={handleChange} />
        <Input placeholder="Segundo Nombre" name="nombre2" onChange={handleChange} />
        <Input placeholder="Primer Apellido" name="apellido1" onChange={handleChange} />
        <Input placeholder="Segundo Apellido" name="apellido2" onChange={handleChange} />
      </div>

      <Button onClick={handleSubmit} className="bg-primary text-white hover:bg-primary/90">
        Consultar
      </Button>

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
                      {col}
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
