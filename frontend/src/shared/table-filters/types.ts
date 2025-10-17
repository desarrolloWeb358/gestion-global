// src/shared/table-filters/types.ts
export type FilterKind = "text" | "select" | "daterange" | "boolean";

export type TextOperator = "contains" | "equals" | "startsWith" | "endsWith";
export type DateRange = { from?: Date; to?: Date };

export type FilterFieldBase<T = any> = {
  key: keyof T & string;   // campo del item
  label: string;           // label visible
  kind: FilterKind;
  hidden?: boolean;        // por si quieres no mostrarlo pero aplicarlo
};

export type TextFilterField<T = any> = FilterFieldBase<T> & {
  kind: "text";
  operator?: TextOperator; // default: contains
};

export type SelectFilterField<T = any> = FilterFieldBase<T> & {
  kind: "select";
  options: { value: string; label: string }[];
  // mapear valor original a option.value si hace falta:
  mapValue?: (item: T) => string | null | undefined;
};

export type DateRangeFilterField<T = any> = FilterFieldBase<T> & {
  kind: "daterange";
  // cómo leer la fecha del item (Date o Timestamp)
  getDate: (item: T) => Date | null | undefined;
};

export type BooleanFilterField<T = any> = FilterFieldBase<T> & {
  kind: "boolean";
  // cómo leer booleano del item:
  getBool: (item: T) => boolean;
};

export type FilterField<T = any> =
  | TextFilterField<T>
  | SelectFilterField<T>
  | DateRangeFilterField<T>
  | BooleanFilterField<T>;

export type FiltersState = Record<string, unknown>; // { [key]: string | DateRange | boolean | undefined }
