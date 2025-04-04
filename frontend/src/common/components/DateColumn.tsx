// src/common/components/DateColumn.tsx
import { MRT_ColumnDef } from "material-react-table";
import { TextField } from "@mui/material";

export function buildDateColumn<T extends { [key: string]: string }>(
  key: keyof T,
  header: string
): MRT_ColumnDef<T> {
  return {
    accessorKey: key as string,
    header,
    editVariant: "text",
    muiEditTextFieldProps: {
      type: "date",
      required: true,
    },
    Cell: ({ cell }) => {
      const value = cell.getValue<string>();
      return new Date(value).toLocaleDateString();
    },
  };
}
