// src/components/SeguimientoForm.tsx
import { useState, useEffect } from 'react';
import {
    Box, Button, Dialog, DialogActions, DialogContent,
    DialogTitle, MenuItem, TextField, Typography
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { Timestamp } from 'firebase/firestore';
import { Seguimiento } from '../models/seguimiento.model';


interface SeguimientoFormProps {
    open: boolean;
    onClose: () => void;
    onSave: (data: Omit<Seguimiento, 'id'>, archivo?: File, reemplazarArchivo?: boolean) => void;
    seguimiento?: Seguimiento;
}

export default function SeguimientoForm({ open, onClose, onSave, seguimiento }: SeguimientoFormProps) {
    const [fecha, setFecha] = useState<Date | null>(new Date());
    const [tipo, setTipo] = useState<Seguimiento['tipo']>('llamada');
    const [descripcion, setDescripcion] = useState('');
    const [archivo, setArchivo] = useState<File | null>(null);
    const [reemplazar, setReemplazar] = useState(false);

    useEffect(() => {
        if (seguimiento) {
            setFecha((seguimiento.fecha as Timestamp).toDate());
            setTipo(seguimiento.tipo);
            setDescripcion(seguimiento.descripcion);
        } else {
            setFecha(new Date());
            setTipo('llamada');
            setDescripcion('');
            setArchivo(null);
            setReemplazar(false);
        }
    }, [seguimiento]);

    const handleSubmit = () => {
        if (!fecha || !descripcion) return;
        onSave({
            fecha: Timestamp.fromDate(fecha),
            tipo,
            descripcion,
        }, archivo || undefined, reemplazar);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{seguimiento ? 'Editar Seguimiento' : 'Crear Seguimiento'}</DialogTitle>
            <DialogContent>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                    <DatePicker
                        label="Fecha"
                        value={fecha}
                        onChange={(date) => setFecha(date)}
                        slotProps={{ textField: { fullWidth: true, margin: 'normal' } }}
                    />
                </LocalizationProvider>

                <TextField
                    select
                    label="Tipo"
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as Seguimiento['tipo'])}
                    fullWidth
                    margin="normal"
                >
                    <MenuItem value="llamada">Llamada</MenuItem>
                    <MenuItem value="correo">Correo</MenuItem>
                    <MenuItem value="whatsapp">WhatsApp</MenuItem>
                    <MenuItem value="sms">SMS</MenuItem>
                    <MenuItem value="visita">Visita</MenuItem>
                    <MenuItem value="otro">Otro</MenuItem>
                </TextField>

                <TextField
                    label="Descripción"
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    fullWidth
                    margin="normal"
                />

                {seguimiento?.archivoUrl && (
                    <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
                        Al cargar un nuevo archivo se eliminará el anterior.
                    </Typography>
                )}

                <Button variant="outlined" component="label" fullWidth sx={{ mt: 2 }}>
                    {seguimiento ? 'Reemplazar archivo' : 'Cargar archivo'}
                    <input
                        hidden
                        type="file"
                        onChange={(e) => {
                            setArchivo(e.target.files?.[0] || null);
                            setReemplazar(true);
                        }}
                    />
                </Button>
                {(archivo || seguimiento?.archivoUrl) && (
                    <Box sx={{ mt: 1 }}>
                        {archivo?.name ||
                            decodeURIComponent(
                                seguimiento?.archivoUrl?.split('%2F').pop()?.split('?')[0] || ''
                            )
                        }
                    </Box>
                )}
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button variant="contained" onClick={handleSubmit}>Guardar</Button>
            </DialogActions>
        </Dialog>
    );
}
