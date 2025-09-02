"use client";

import React, { useState } from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { useLoading } from "@/app/providers/LoadingContext";
import { Spinner } from "@/shared/ui/spinner";
import { Label } from "@/shared/ui/label";

import { TipoNotificacion } from "@/shared/constants/notificacionTipos";
import { sendNotification } from "@/shared/services/sendNotification";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function ProbarNotificacionesPage() {
  const [tipo, setTipo] = useState<TipoNotificacion>(TipoNotificacion.SMS);
  const [destino, setDestino] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [nombre, setNombre] = useState("");
  const [archivoUrl, setArchivoUrl] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { isLoading, setLoading } = useLoading();

  const handleSubmit = async () => {
    if (!destino || !tipo) {
      setError("Debes completar todos los campos obligatorios.");
      return;
    }

    const payload: any = {
      tipo,
      destino,
    };

    if (tipo === TipoNotificacion.CORREO) {
      if (!templateId) {
        setError("El campo Template ID es obligatorio para correos.");
        return;
      }
      payload.templateId = templateId;
      payload.templateData = { nombre };
      if (archivoUrl) payload.archivoUrl = archivoUrl;
    } else if (tipo === TipoNotificacion.WHATSAPP) {
      if (!templateId) {
        setError("El ID de template es obligatorio para WhatsApp.");
        return;
      }
      payload.templateId = templateId;
    } else if (tipo === TipoNotificacion.LLAMADA) {
      if (!archivoUrl) {
        setError("Debes proporcionar la URL del archivo de audio para la llamada.");
        return;
      }
      payload.archivoUrl = archivoUrl;
    } else {
      if (!mensaje) {
        setError("El mensaje es obligatorio para SMS.");
        return;
      }
      payload.mensaje = mensaje;
    }

    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const resultado = await sendNotification(payload);
      setResultado(`✅ Enviado correctamente. SID/ID: ${resultado}`);
    } catch (err) {
      console.error(err);
      setError("❌ Error al enviar notificación.");
    } finally {
      setLoading(false);
    }
  };

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const storage = getStorage();
  const fileName = `audios/audio_${Date.now()}.${file.name.split('.').pop()}`;
  const storageRef = ref(storage, fileName);

  try {
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    setArchivoUrl(url);
    setError("");
  } catch (err) {
    console.error("Error al subir el archivo:", err);
    setError("❌ Error al subir el archivo de audio");
  }
};

  if (isLoading) return <Spinner className="h-32" />;

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h2 className="text-2xl font-bold">Probar envío de notificaciones</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Tipo de notificación</Label>
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoNotificacion)}
            className="w-full border rounded px-2 py-1"
          >
            <option value={TipoNotificacion.SMS}>SMS</option>
            <option value={TipoNotificacion.WHATSAPP}>WhatsApp</option>
            <option value={TipoNotificacion.CORREO}>Correo</option>
            <option value={TipoNotificacion.LLAMADA}>Llamada</option>
          </select>
        </div>

        <div>
          <Label>Destino</Label>
          <Input
            placeholder="Ej: +573001112233 o correo@ejemplo.com"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
          />
        </div>
      </div>

      {tipo !== "correo" && tipo !== "whatsapp" && (
        <div>
          <Label>Mensaje</Label>
          <Input
            placeholder="Escribe el mensaje a enviar"
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
          />
        </div>
      )}

      {tipo === "whatsapp" && (
        <div>
          <Label>ID de template de WhatsApp</Label>
          <Input
            placeholder="SID del template de Twilio WhatsApp"
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
          />
        </div>
      )}

      {tipo === "llamada" && (
        <div>
          <Label>Archivo de audio</Label>
          <Input
            type="file"
            accept="audio/*"
            onChange={handleAudioUpload}
          />
          {archivoUrl && (
            <p className="text-sm text-green-600">✅ Audio subido con éxito.</p>
          )}
        </div>
      )}

      {tipo === "correo" && (
        <>
          <div>
            <Label>Template ID</Label>
            <Input
              placeholder="ID de plantilla de SendGrid"
              value={templateId}
              onChange={(e) => setTemplateId(e.target.value)}
            />
          </div>
          <div>
            <Label>Nombre (para template)</Label>
            <Input
              placeholder="Ej: Juan Pablo"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
          </div>
          <div>
            <Label>Archivo URL (opcional)</Label>
            <Input
              placeholder="URL pública de un PDF"
              value={archivoUrl}
              onChange={(e) => setArchivoUrl(e.target.value)}
            />
          </div>
        </>
      )}

      <Button onClick={handleSubmit} className="bg-primary text-white">
        Enviar
      </Button>

      {error && <p className="text-red-500 font-medium">{error}</p>}
      {resultado && <p className="text-green-600 font-medium">{resultado}</p>}
    </div>
  );
}
