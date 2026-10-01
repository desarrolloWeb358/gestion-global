// Línea de la ruta calculada y marcador del punto de partida.

import { useEffect } from "react";
import { AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { Building2, Crosshair } from "lucide-react";
import type { PuntoRuta } from "../services/rutaService";

export function RutaEnMapa(props: { polyline: string | null; origen: PuntoRuta | null; esOficina: boolean }) {
  const map = useMap();
  const geometry = useMapsLibrary("geometry");

  useEffect(() => {
    if (!map || !geometry || !props.polyline) return;
    const path = geometry.encoding.decodePath(props.polyline);
    // Borde blanco debajo para que la línea se lea sobre cualquier calle.
    const borde = new google.maps.Polyline({ path, map, strokeColor: "#ffffff", strokeOpacity: 0.9, strokeWeight: 8, zIndex: 1 });
    const linea = new google.maps.Polyline({ path, map, strokeColor: "#0d5f7a", strokeOpacity: 0.95, strokeWeight: 5, zIndex: 2 });
    const b = new google.maps.LatLngBounds();
    path.forEach((p) => b.extend(p));
    map.fitBounds(b, 60);
    return () => {
      borde.setMap(null);
      linea.setMap(null);
    };
  }, [map, geometry, props.polyline]);

  if (!props.origen) return null;
  const Icono = props.esOficina ? Building2 : Crosshair;
  return (
    <AdvancedMarker position={props.origen} title={props.esOficina ? "Oficina Gestión Global" : "Tu ubicación"} zIndex={2000}>
      <div className="flex h-9 w-9 items-center justify-center rounded-full border-[3px] border-white bg-[#0d5f7a] text-white shadow-md">
        <Icono className="h-4 w-4" />
      </div>
    </AdvancedMarker>
  );
}
