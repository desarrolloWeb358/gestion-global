"use client";

import React, { useState } from "react";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { useLoading } from "../../../context/LoadingContext";
import { Spinner } from "../../../components/ui/spinner";
import { Select } from "../../../components/ui/select";
import { Label } from "../../../components/ui/label";

export default function ProbarNotificacionesPage() {
  const [tipo, setTipo] = useState("sms");
  const [destino, setDestino] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [asunto, setAsunto] = useState("");
  const [archivoUrl, setArchivoUrl] = useState("");
  const [resultado, setResultado] = useState<string | null>(null);
  const [error, setError] = useState("");
  const { isLoading, setLoading } = useLoading();

  const handleSubmit = async () => {
    if (!destino || !mensaje || !tipo) {
      setError("Debes completar todos los campos obligatorios.");
      return;
    }

    const payload: Record<string, string> = {
      tipo,
      destino,
      mensaje,
    };

    if (tipo === "correo") {
      if (asunto) payload["asunto"] = asunto;
      if (archivoUrl) payload["archivoUrl"] = archivoUrl;
    }

    setLoading(true);
    setError("");
    setResultado(null);

    try {
      const response = await fetch("https://enviarnotificacion-prldsxsgzq-uc.a.run.app", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const res = await response.json();

      if (!response.ok) throw new Error(res || "Error al enviar");

      setResultado(`✅ Enviado correctamente. SID/ID: ${res.resultado}`);
    } catch (err) {
      console.error(err);
      setError("❌ Error al enviar notificación.");
    } finally {
      setLoading(false);
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
            onChange={(e) => setTipo(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="sms">SMS</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="correo">Correo</option>
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

      <div>
        <Label>Mensaje</Label>
        <Input
          placeholder="Escribe el mensaje a enviar"
          value={mensaje}
          onChange={(e) => setMensaje(e.target.value)}
        />
      </div>

      {tipo === "correo" && (
        <>
          <div>
            <Label>Asunto (opcional)</Label>
            <Input
              placeholder="Asunto del correo"
              value={asunto}
              onChange={(e) => setAsunto(e.target.value)}
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
