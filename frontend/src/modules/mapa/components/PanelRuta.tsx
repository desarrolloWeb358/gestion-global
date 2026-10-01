// Ruta de visitas: los conjuntos elegidos, desde dónde se sale y el resultado
// (orden, tiempos con tráfico y enlace para navegar en el celular).

import { useMemo, useRef, useState } from "react";
import { Building2, Crosshair, Loader2, Navigation, Plus, Route, Search, Trash2, X } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Switch } from "@/shared/ui/switch";
import { cn } from "@/shared/lib/cn";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import {
  MAX_PARADAS,
  OFICINA,
  textoDistancia,
  textoDuracion,
  type ResultadoRuta,
} from "../services/rutaService";

export type OrigenRuta = "oficina" | "ubicacion";

const normalizar = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const MAX_SUGERENCIAS = 8;

export function PanelRuta(props: {
  paradas: Cliente[]; // en el orden en que se agregaron
  candidatos: Cliente[]; // conjuntos con ubicación que se pueden agregar
  onAgregar: (c: Cliente) => void;
  soloRuta: boolean;
  onSoloRuta: (v: boolean) => void;
  origen: OrigenRuta;
  onOrigen: (o: OrigenRuta) => void;
  resultado: ResultadoRuta | null;
  urlNavegar: string | null;
  calculando: boolean;
  onCalcular: () => void;
  onQuitar: (id: string) => void;
  onLimpiar: () => void;
  onVer: (id: string) => void;
}) {
  const { paradas, resultado } = props;
  const porId = new Map(paradas.map((c) => [c.id!, c]));
  const ordenadas = resultado ? resultado.orden.map((id) => porId.get(id)).filter(Boolean) as Cliente[] : paradas;
  const tramo = (id: string) => resultado?.tramos.find((t) => t.haciaId === id);
  const llena = paradas.length >= MAX_PARADAS;

  // Buscador: todas las palabras escritas deben aparecer en el nombre (sin tildes).
  const [texto, setTexto] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const sugerencias = useMemo(() => {
    const palabras = normalizar(texto).split(/\s+/).filter(Boolean);
    if (palabras.length === 0) return [];
    const elegidos = new Set(paradas.map((c) => c.id));
    return props.candidatos
      .filter((c) => !elegidos.has(c.id) && palabras.every((p) => normalizar(c.nombre ?? "").includes(p)))
      .slice(0, MAX_SUGERENCIAS);
  }, [texto, paradas, props.candidatos]);

  const agregar = (c: Cliente) => {
    props.onAgregar(c);
    setTexto("");
    input.current?.focus();
  };

  return (
    <section className="rounded-2xl border border-brand-primary/30 bg-white shadow-sm p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Route className="h-5 w-5 text-brand-primary" />
          <h3 className="font-semibold text-brand-primary">Ruta de visitas</h3>
          <span className="text-xs text-gray-500">
            {paradas.length} de {MAX_PARADAS} conjuntos
          </span>
        </div>
        {paradas.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <Switch id="ver-todos-ruta" checked={!props.soloRuta} onCheckedChange={(v) => props.onSoloRuta(!v)} />
              Ver todos los conjuntos
            </label>
            <button type="button" onClick={props.onLimpiar} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600">
              <Trash2 className="h-3.5 w-3.5" /> Vaciar ruta
            </button>
          </div>
        )}
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <Input
          ref={input}
          id="buscar-conjunto-ruta"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && sugerencias[0] && !llena) { e.preventDefault(); agregar(sugerencias[0]); }
            if (e.key === "Escape") setTexto("");
          }}
          disabled={llena}
          placeholder={llena ? `La ruta ya tiene ${MAX_PARADAS} conjuntos` : "Buscar conjunto para agregar a la ruta…"}
          className="pl-9"
          autoComplete="off"
        />
        {texto.trim() && !llena && (
          <ul className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border bg-white shadow-lg divide-y">
            {sugerencias.length === 0 && <li className="p-3 text-sm text-gray-500">Ningún conjunto con ubicación coincide.</li>}
            {sugerencias.map((c, i) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => agregar(c)}
                  className={cn("w-full text-left px-3 py-2 hover:bg-brand-primary/5 flex items-center gap-2", i === 0 && "bg-gray-50")}
                >
                  <Plus className="h-4 w-4 shrink-0 text-brand-primary" />
                  <span className="min-w-0">
                    <span className="block text-sm truncate">{c.nombre}</span>
                    <span className="block text-xs text-gray-500 truncate">
                      {c.direccion}{c.geo?.localidad ? ` · ${c.geo.localidad}` : ""}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {paradas.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-600">Salir desde:</span>
            {([
              ["oficina", "Oficina", Building2],
              ["ubicacion", "Mi ubicación", Crosshair],
            ] as const).map(([id, label, Icono]) => (
              <button
                key={id}
                type="button"
                onClick={() => props.onOrigen(id)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs",
                  props.origen === id ? "border-brand-primary bg-brand-primary/10 text-brand-primary" : "border-gray-200 hover:bg-gray-50"
                )}
              >
                <Icono className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
            {props.origen === "oficina" && <span className="text-xs text-gray-500">{OFICINA.direccion}</span>}
          </div>
    
          <ol className="space-y-1.5">
            {ordenadas.map((c, i) => {
              const t = tramo(c.id!);
              return (
                <li key={c.id} className="flex items-start gap-2.5">
                  <span
                    className={cn(
                      "mt-0.5 h-6 w-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center",
                      resultado ? "bg-brand-primary text-white" : "bg-gray-100 text-gray-500"
                    )}
                  >
                    {resultado ? i + 1 : "•"}
                  </span>
                  <button type="button" onClick={() => props.onVer(c.id!)} className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium truncate">{c.nombre}</span>
                    <span className="block text-xs text-gray-500 truncate">
                      {t ? `${textoDuracion(t.segundos)} · ${textoDistancia(t.metros)} desde ${i === 0 ? "el inicio" : "la anterior"}` : c.direccion}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => props.onQuitar(c.id!)}
                    aria-label={`Quitar ${c.nombre} de la ruta`}
                    className="rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ol>
    
          {resultado && (
            <p className="text-sm">
              Total: <b>{textoDuracion(resultado.totalSegundos)}</b> · {textoDistancia(resultado.totalMetros)}
              <span className="text-xs text-gray-500"> (con el tráfico de ahora; termina en el último conjunto)</span>
            </p>
          )}
    
          <div className="flex flex-wrap gap-2">
            <Button variant="brand" size="sm" onClick={props.onCalcular} disabled={props.calculando || paradas.length === 0} className="gap-2">
              {props.calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Route className="h-4 w-4" />}
              {props.calculando ? "Calculando…" : resultado ? "Recalcular" : "Calcular mejor ruta"}
            </Button>
            {resultado && props.urlNavegar && (
              <a
                href={props.urlNavegar}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-brand-primary px-3 text-sm font-medium text-brand-primary hover:bg-brand-primary/5"
              >
                <Navigation className="h-4 w-4" /> Abrir en Google Maps
              </a>
            )}
          </div>
        </>
      )}
    </section>
  );
}
