// src/shared/table-filters/FiltersBar.tsx
"use client";

import * as React from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { DateRange, FilterField } from "./types";

type Props<T> = {
  fields?: FilterField<T>[];
  filtersState: Record<string, any>;
  setFilter: (key: string, value: any) => void;
  search?: string;
  setSearch?: (v: string) => void;
  onReset?: () => void;
};

// Normaliza cualquier "options" a un array seguro de {value,label} strings únicos.
function normalizeOptions(optionsInput: any, fieldKey: string): Array<{ value: string; label: string }> {
  let arr: Array<{ value: string; label: string }> = [];

  if (Array.isArray(optionsInput)) {
    arr = optionsInput.map((op: any, idx: number) => {
      const rawVal = op?.value;
      const rawLab = op?.label;
      const value = rawVal == null ? "" : String(rawVal).trim();
      const label = rawLab == null ? value : String(rawLab);
      if (value === "") {
        // Evita chocar con la opción "Todas" que usa value=""
        console.warn(`[FiltersBar:${fieldKey}] Opción ignorada por value vacío en índice ${idx}`, op);
      }
      return { value, label };
    });
  } else if (optionsInput && typeof optionsInput === "object") {
    arr = Object.entries(optionsInput).map(([k, v]) => {
      const value = String(k).trim();
      const label = v == null ? value : String(v);
      if (value === "") {
        console.warn(`[FiltersBar:${fieldKey}] Opción ignorada por key vacío en objeto`, optionsInput);
      }
      return { value, label };
    });
  }

  // Filtra vacíos y deduplica
  const seen = new Set<string>();
  return arr
    .filter(op => op.value.length > 0)
    .filter(op => (seen.has(op.value) ? (console.warn(`[FiltersBar:${fieldKey}] Opción duplicada`, op), false) : (seen.add(op.value), true)));
}

export default function FiltersBar<T>({
  fields,
  filtersState,
  setFilter,
  search,
  setSearch,
  onReset,
}: Props<T>) {
  const safeFields: FilterField<T>[] = Array.isArray(fields) ? fields : [];

  return (
    <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {/* Búsqueda global opcional */}
      {typeof search === "string" && typeof setSearch === "function" && (
        <div className="col-span-2">
          <Label>Búsqueda</Label>
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar en la tabla…"
          />
        </div>
      )}

      {safeFields
        .filter((f) => !f.hidden)
        .map((f) => {
          // ==========
          // TEXT
          // ==========
          if (f.kind === "text") {
            return (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Input
                  value={filtersState?.[f.key] ?? ""}
                  onChange={(e) => setFilter(f.key, e.target.value)}
                  placeholder={`Filtrar ${f.label.toLowerCase()}…`}
                />
              </div>
            );
          }

          // ==========
          // SELECT (tolerante y seguro)
          // ==========
          if (f.kind === "select") {
            const raw = filtersState?.[f.key];
            let controlledValue = raw == null ? "" : String(raw).trim();

            const options = normalizeOptions((f as any).options, f.key);
            const allowed = new Set(options.map((o) => o.value));

            if (controlledValue !== "" && !allowed.has(controlledValue)) {
              // Evita crash de Radix al no encontrar un SelectItem con ese value
              console.warn(`[FiltersBar:${f.key}] Valor controlado "${controlledValue}" no existe en options. Reseteando a vacío.`);
              controlledValue = "";
            }

            return (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Select
                  value={controlledValue}
                  onValueChange={(v) => setFilter(f.key, v === "" ? undefined : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {/* Opción vacía (todas) */}
                    <SelectItem value="">Todas</SelectItem>

                    {options.map((op) => {
                      // Defensa: evita render si value sigue raro
                      if (typeof op.value !== "string" || op.value.length === 0) {
                        console.warn(`[FiltersBar:${f.key}] Opción descartada por value inválido`, op);
                        return null;
                      }
                      return (
                        <SelectItem key={`${f.key}-${op.value}`} value={op.value}>
                          {op.label}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // ==========
          // BOOLEAN (usa "true"/"false" como strings)
          // ==========
          if (f.kind === "boolean") {
            const raw = filtersState?.[f.key];
            const controlledValue = typeof raw === "boolean" ? String(raw) : "";
            return (
              <div key={f.key}>
                <Label>{f.label}</Label>
                <Select
                  value={controlledValue}
                  onValueChange={(v) =>
                    setFilter(f.key, v === "" ? undefined : v === "true")
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    <SelectItem value="true">Sí</SelectItem>
                    <SelectItem value="false">No</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            );
          }

          // ==========
          // DATERANGE
          // ==========
          if (f.kind === "daterange") {
            const val: DateRange | undefined = filtersState?.[f.key];
            const fromLabel = val?.from
              ? val.from.toLocaleDateString("es-CO")
              : "Desde";
            const toLabel = val?.to
              ? val.to.toLocaleDateString("es-CO")
              : "Hasta";

            return (
              <div key={f.key} className="flex flex-col gap-1">
                <Label>{f.label}</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {fromLabel} — {toLabel}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="start">
                    <div className="grid grid-cols-2 gap-2">
                      <Calendar
                        mode="single"
                        selected={val?.from}
                        onSelect={(d) =>
                          setFilter(f.key, { ...(val || {}), from: d ?? undefined })
                        }
                        initialFocus
                      />
                      <Calendar
                        mode="single"
                        selected={val?.to}
                        onSelect={(d) =>
                          setFilter(f.key, { ...(val || {}), to: d ?? undefined })
                        }
                      />
                    </div>
                  </PopoverContent>
                </Popover>

                {(val?.from || val?.to) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="justify-start px-2"
                    onClick={() => setFilter(f.key, undefined)}
                  >
                    <X className="h-4 w-4 mr-1" /> Limpiar
                  </Button>
                )}
              </div>
            );
          }

          return null;
        })}

      {onReset && (
        <div className="flex items-end">
          <Button variant="outline" onClick={onReset} className="w-full">
            Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
