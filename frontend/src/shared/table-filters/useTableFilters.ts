// src/shared/table-filters/useTableFilters.ts
import * as React from "react";
import { applyFilters } from "./applyFilters";
import { FilterField } from "./types";

export function useTableFilters<T>(items: T[], fields: FilterField<T>[]) {
  const [state, setState] = React.useState<Record<string, any>>({});
  const [search, setSearch] = React.useState(""); // buscador global opcional

  const filtered = React.useMemo(() => {
    let out = applyFilters(items, fields, state);
    if (search.trim()) {
      const q = search.toLowerCase();
      out = out.filter((it) => JSON.stringify(it).toLowerCase().includes(q));
    }
    return out;
  }, [items, fields, state, search]);

  function setFilter<K extends string>(key: K, value: any) {
    setState((s) => ({ ...s, [key]: value }));
  }
  function resetFilters() {
    setState({});
    setSearch("");
  }

  return { filtersState: state, setFilter, resetFilters, search, setSearch, filtered };
}
