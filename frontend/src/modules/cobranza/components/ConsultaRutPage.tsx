// src/modules/common/pages/ConsultaRutPage.tsx
import React, { useState } from 'react';
import { Button, TextField, Box, Typography } from '@mui/material';
import { construirConsulta, extraerDatos } from '../services/consultaPersona';
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper } from '@mui/material';

import { useLoading } from '../../../context/LoadingContext';


const ConsultaRutPage: React.FC = () => {
  const [formData, setFormData] = useState({
    identificacion: '',
    nombre1: '',
    nombre2: '',
    apellido1: '',
    apellido2: '',
  });

  const [resultado, setResultado] = useState<string[][] | null>(null);
  const [error, setError] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };


  const { setLoading } = useLoading();


  const handleSubmit = async () => {
    setLoading(true);
    try {
      const consulta = construirConsulta(formData);

      /*
      const response = await fetch('https://muisca.dian.gov.co/WebArancel/DefConsultaNomenclaturaPorCriterio.faces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: consulta,
      });
      */

      console.log(consulta);
      const response = await fetch("https://consultarrut-prldsxsgzq-uc.a.run.app", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ consulta })
      });

      const text = await response.text();
      const tabla = extraerDatos(text);

      if (tabla.length === 0) {
        setError('No se encontraron resultados.');
      } else {
        setResultado(tabla);
        setError('');
      }
    } catch (err) {
      setError('Error en la consulta.');
      console.error(err);
    }finally {
    setLoading(false); // 👈 Desactiva overlay
  }
  };

  return (
    <Box p={4}>
      <Typography variant="h5">Consulta de personas</Typography>
      <Box display="flex" flexDirection="column" gap={2} mt={2}>
        <TextField label="Identificación" name="identificacion" onChange={handleChange} />
        <TextField label="Primer Nombre" name="nombre1" onChange={handleChange} />
        <TextField label="Segundo Nombre" name="nombre2" onChange={handleChange} />
        <TextField label="Primer Apellido" name="apellido1" onChange={handleChange} />
        <TextField label="Segundo Apellido" name="apellido2" onChange={handleChange} />
        <Button variant="contained" onClick={handleSubmit}>Consultar</Button>
      </Box>

      {error && <Typography color="error">{error}</Typography>}

      {/*}
      {resultado && (
        <Box mt={4}>
          <Typography variant="h6">Resultados</Typography>
          <table border={1} width="100%">
            <tbody>
              {resultado.map((fila, i) => (
                <tr key={i}>
                  {fila.map((col, j) => (
                    <td key={j}>{col}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Box>
      )}

      */}

      {resultado && (
        <TableContainer component={Paper} sx={{ mt: 4 }}>
          <Table>
            <TableHead>
              <TableRow>
                {resultado[0].map((col, index) => (
                  <TableCell key={index}><strong>{col}</strong></TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {resultado.slice(1).map((fila, i) => (
                <TableRow key={i}>
                  {fila.map((col, j) => (
                    <TableCell key={j} sx={{ whiteSpace: 'pre-line' }}>
                      {col}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}



    </Box>
  );
};

export default ConsultaRutPage;
