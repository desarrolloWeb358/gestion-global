import { useEffect, useMemo, useState } from "react";
import { Cliente } from "../models/cliente.model";
import { addCliente, deleteCliente, getClientes, updateCliente } from "../services/clienteService";
import CrudLayout from "../../common/layouts/CrudLayout";
import { MRT_ColumnDef } from "material-react-table";
import { buildDateColumn } from "../../common/components/DateColumn";

const ClienteCrudPage = () => {
  const [clientes, setClientes] = useState<Cliente[]>([]);

  const cargarClientes = async () => {
    const data = await getClientes();
    setClientes(data);
  };

  const handleCreate = async (nuevo: Omit<Cliente, 'id'>) => {
    await addCliente(nuevo);
    await cargarClientes();
  };

  const handleUpdate = async (actualizado: Cliente) => {
    if (!actualizado.id) return;
    await updateCliente(actualizado.id, actualizado);
    await cargarClientes();
  };

  const handleDelete = async (id: string) => {
    await deleteCliente(id);
    await cargarClientes();
  };

  useEffect(() => {
    cargarClientes();
  }, []);

  const columns = useMemo<MRT_ColumnDef<Cliente>[]>(
    () => [
      {
        accessorKey: "nombre",
        header: "Nombre",
      },
      {
        accessorKey: "correo",
        header: "Correo",
      },
      {
        accessorKey: "tipo",
        header: "Tipo",
        editVariant: 'select',
        editSelectOptions: ['natural', 'jurídica'],
        muiEditTextFieldProps: {
          select: true,
          required: true,
        },
      },
      {
        accessorKey: "telefono",
        header: "Teléfono",
      },
      {
        accessorKey: "direccion",
        header: "Dirección",
      },
    ],
    []
  );

  return (
    <CrudLayout
      title="Gestión de Clientes"
      columns={columns}
      data={clientes}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
    />
  );
};

export default ClienteCrudPage;
