// src/shared/table-filters/FiltersBar.tsx
"use client";

import * as React from "react";
import { Input } from "@/shared/ui/input";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/shared/ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "@/shared/ui/popover";
import { Calendar } from "@/shared/ui/calendar";
import { Calendar as CalendarIcon, X } from "lucide-react";

import { DateRange, FilterField } from "./types";

type Props<T> = {
  fields: FilterField<T>[];
  filtersState: Record<string, any>;
  setFilter: (key: string, value: any) => void;
  search?: string;
  setSearch?: (v: string) => void;
  onReset?: () => void;
};

export default function FiltersBar<T>({ fields, filtersState, setFilter, search, setSearch, onReset }: Props<T>) {
  return (
    <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {/* Buscador global opcional */}
      {typeof search === "string" && setSearch && (
        <div className="col-span-2">
          <Label>Búsqueda</Label>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en la tabla…" />
        </div>
      )}

      {fields.filter(f => !f.hidden).map((f) => {
        if (f.kind === "text") {
          return (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Input
                value={filtersState[f.key] ?? ""}
                onChange={(e) => setFilter(f.key, e.target.value)}
                placeholder={`Filtrar ${f.label.toLowerCase()}…`}
              />
            </div>
          );
        }

        if (f.kind === "select") {
          return (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Select
                value={filtersState[f.key] ?? ""}
                onValueChange={(v) => setFilter(f.key, v || undefined)}
              >
                <SelectTrigger><SelectValue placeholder={`Todas`} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas</SelectItem>
                  {(f as any).options.map((op: any) => (
                    <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (f.kind === "boolean") {
          return (
            <div key={f.key}>
              <Label>{f.label}</Label>
              <Select
                value={typeof filtersState[f.key] === "boolean" ? String(filtersState[f.key]) : ""}
                onValueChange={(v) =>
                  setFilter(f.key, v === "" ? undefined : v === "true")
                }
              >
                <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="true">Sí</SelectItem>
                  <SelectItem value="false">No</SelectItem>
                </SelectContent>
              </Select>
            </div>
          );
        }

        if (f.kind === "daterange") {
          const val: DateRange | undefined = filtersState[f.key];
          return (
            <div key={f.key} className="flex flex-col gap-1">
              <Label>{f.label}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-start">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {val?.from ? val.from.toLocaleDateString("es-CO") : "Desde"}{" "}
                    – {val?.to ? val.to.toLocaleDateString("es-CO") : "Hasta"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" align="start">
                  <div className="grid grid-cols-2 gap-2">
                    <Calendar
                      mode="single"
                      selected={val?.from}
                      onSelect={(d) => setFilter(f.key, { ...(val || {}), from: d ?? undefined })}
                      initialFocus
                    />
                    <Calendar
                      mode="single"
                      selected={val?.to}
                      onSelect={(d) => setFilter(f.key, { ...(val || {}), to: d ?? undefined })}
                    />
                  </div>
                </PopoverContent>
              </Popover>
              {(val?.from || val?.to) && (
                <Button variant="ghost" size="sm" className="justify-start px-2"
                        onClick={() => setFilter(f.key, undefined)}>
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
          <Button variant="outline" onClick={onReset} className="w-full">Limpiar filtros</Button>
        </div>
      )}
    </div>
  );
}
