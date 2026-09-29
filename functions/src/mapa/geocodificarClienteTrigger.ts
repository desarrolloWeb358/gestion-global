// Mantiene `clientes/{id}.geo` al dia con la direccion del conjunto.
//
// El navegador solo escribe la direccion; las coordenadas se calculan aqui UNA
// vez por direccion (no cada vez que alguien abre el mapa), que es lo que deja
// el consumo de Google Maps dentro de la cuota gratis.

import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { geocodificarCliente as calcular, necesitaGeocodificar } from "./geocodificar";

// Key de servidor: restringida a Geocoding API + Places API (New), sin referrer.
export const GOOGLE_MAPS_SERVER_KEY = defineSecret("GOOGLE_MAPS_SERVER_KEY");

export const geocodificarCliente = onDocumentWritten(
  { document: "clientes/{clienteId}", secrets: [GOOGLE_MAPS_SERVER_KEY] },
  async (event) => {
    const despues = event.data?.after;
    if (!despues?.exists) return;
    const data = despues.data();
    if (!necesitaGeocodificar(data)) return;

    try {
      const geo = await calcular(data ?? {}, GOOGLE_MAPS_SERVER_KEY.value());
      // Si la direccion cambio mientras Google respondia, gana la escritura nueva:
      // ese cambio ya disparo su propia ejecucion.
      await admin.firestore().runTransaction(async (tx) => {
        const actual = await tx.get(despues.ref);
        if (String(actual.data()?.direccion ?? "").trim() !== geo.direccionOrigen) return;
        tx.update(despues.ref, {
          geo: { ...geo, actualizadoEn: admin.firestore.FieldValue.serverTimestamp() },
        });
      });
      logger.info("geocodificarCliente", {
        clienteId: event.params.clienteId,
        estado: geo.estado,
        fuente: geo.fuente,
        motivo: geo.motivoRevision,
      });
    } catch (e: any) {
      // Sin escribir `geo`: el siguiente cambio del cliente lo reintenta.
      logger.error("geocodificarCliente fallo", { clienteId: event.params.clienteId, error: e?.message });
    }
  }
);
