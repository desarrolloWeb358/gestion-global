// src/shared/table-filters/applyFilters.ts
import { FilterField, TextFilterField, DateRange } from "./types";

export function applyFilters<T>(items: T[], fields: FilterField<T>[], state: Record<string, any>) {
  return items.filter((it) => {
    for (const f of fields) {
      const val = state[f.key];

      if (f.kind === "text") {
        const ff = f as TextFilterField<T>;
        const operator = ff.operator ?? "contains";
        const raw = String((it as any)[f.key] ?? "").toLowerCase();
        const q = String(val ?? "").trim().toLowerCase();
        if (!q) continue;
        const match =
          operator === "equals" ? raw === q
          : operator === "startsWith" ? raw.startsWith(q)
          : operator === "endsWith" ? raw.endsWith(q)
          : raw.includes(q);
        if (!match) return false;
      }

      if (f.kind === "select") {
        if (!val) continue;
        const selected = String(val);
        const current = f.mapValue ? f.mapValue(it) : String((it as any)[f.key] ?? "");
        if (String(current ?? "") !== selected) return false;
      }

      if (f.kind === "daterange") {
        const dr = val as DateRange | undefined;
        if (!dr?.from && !dr?.to) continue;
        const d = f.getDate(it);
        if (!d) return false;
        if (dr.from && d < normalizeStart(dr.from)) return false;
        if (dr.to && d > normalizeEnd(dr.to)) return false;
      }

      if (f.kind === "boolean") {
        if (typeof val !== "boolean") continue;
        const b = f.getBool(it);
        if (b !== val) return false;
      }
    }
    return true;
  });
}

function normalizeStart(d: Date) {
  const x = new Date(d);
  x.setHours(0,0,0,0);
  return x;
}
function normalizeEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23,59,59,999);
  return x;
}
