// src/components/seguimiento/SeguimientoForm.tsx

import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { format } from "date-fns";
import { Calendar } from "../components/ui/calendar";
import { Seguimiento } from "../modules/cobranza/models/seguimiento.model";
import { useState, useEffect } from "react";
import { cn } from "../lib/utils";
import { Timestamp } from "firebase/firestore";

interface Props {
    open: boolean;
    seguimiento?: Seguimiento;
    onSave: (data: Omit<Seguimiento, "id">, archivo?: File, reemplazar?: boolean) => void;
    onClose: () => void;
}

export default function SeguimientoForm({ open, seguimiento, onSave, onClose }: Props) {
    const [fecha, setFecha] = useState<Timestamp>()
    const [tipo, setTipo] = useState<Seguimiento["tipo"]>("llamada");
    const [descripcion, setDescripcion] = useState("");
    const [archivo, setArchivo] = useState<File | undefined>();
    const [reemplazarArchivo, setReemplazarArchivo] = useState(false);

    useEffect(() => {
        if (seguimiento) {
            setFecha(
                seguimiento.fecha ?? Timestamp.fromDate(new Date())
            );
            setTipo(seguimiento.tipo);
            setDescripcion(seguimiento.descripcion);
            setArchivo(undefined); // no pre-carga archivo
        } else {
            setFecha(Timestamp.fromDate(new Date()));
            setTipo("llamada");
            setDescripcion("");
            setArchivo(undefined);
        }
    }, [seguimiento]);

    const handleSubmit = () => {
        const dataFinal: Omit<Seguimiento, "id"> = {
            fecha: fecha ?? Timestamp.now(),
            tipo,
            descripcion, // ✅ aquí lo usas directamente
            archivoUrl: seguimiento?.archivoUrl ?? "",
        };

        onSave(dataFinal, archivo, reemplazarArchivo);
    };
    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>{seguimiento ? "Editar seguimiento" : "Nuevo seguimiento"}</DialogTitle>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Fecha</Label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !fecha && "text-muted-foreground")}>
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {fecha ? format(fecha.toDate(), "dd/MM/yyyy") : ""}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0">
                                <Calendar
                                    mode="single"
                                    selected={fecha ? fecha.toDate() : undefined}
                                    onSelect={(d) => d && setFecha(Timestamp.fromDate(d))}
                                    initialFocus
                                />
                            </PopoverContent>
                        </Popover>
                    </div>

                    <div className="grid gap-2">
                        <Label>Tipo</Label>
                        <Select value={tipo} onValueChange={(val) => setTipo(val as Seguimiento["tipo"])}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecciona tipo" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="llamada">Llamada</SelectItem>
                                <SelectItem value="correo">Correo</SelectItem>
                                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                                <SelectItem value="sms">SMS</SelectItem>
                                <SelectItem value="visita">Visita</SelectItem>
                                <SelectItem value="otro">Otro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid gap-2">
                        <Label>Descripción</Label>
                        <Textarea
                            value={descripcion}
                            onChange={(e) => setDescripcion(e.target.value)}
                            placeholder="Descripción del seguimiento"
                            className="min-h-[100px]"
                        />
                    </div>

                    <div className="grid gap-2">
                        <Label>Archivo</Label>
                        <Input
                            type="file"
                            onChange={(e) => setArchivo(e.target.files?.[0])}
                            accept=".pdf,.jpg,.png,.jpeg"
                        />
                        {seguimiento?.archivoUrl && (
                            <div className="text-sm text-muted-foreground">
                                Archivo existente:{" "}
                                <a href={seguimiento.archivoUrl} target="_blank" rel="noreferrer" className="underline text-blue-600">
                                    Ver archivo
                                </a>
                                <div className="mt-2">
                                    <Label>
                                        <input
                                            type="checkbox"
                                            checked={reemplazarArchivo}
                                            onChange={(e) => setReemplazarArchivo(e.target.checked)}
                                            className="mr-2"
                                            title="Reemplazar archivo"
                                        />
                                        Reemplazar archivo
                                    </Label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit}>Guardar</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
