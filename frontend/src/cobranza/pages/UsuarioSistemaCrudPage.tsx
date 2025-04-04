import { useEffect, useMemo, useState } from 'react';
import { UsuarioSistema } from '../models/usuarioSistema.model';
import CrudLayout from '../../common/layouts/CrudLayout';
import { MRT_ColumnDef } from 'material-react-table';
import {
  getUsuariosSistema,
  addUsuarioSistema,
  updateUsuarioSistema,
  deleteUsuarioSistema,
} from '../services/usuarioSistemaService';
import { buildDateColumn } from '../../common/components/DateColumn';

const UsuarioSistemaCrudPage = () => {
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);

  const cargarUsuarios = async () => {
    const data = await getUsuariosSistema();
    setUsuarios(data);
  };

  const handleCreate = async (nuevo: Omit<UsuarioSistema, 'uid'>) => {
    await addUsuarioSistema(nuevo);
    await cargarUsuarios();
  };

  const handleUpdate = async (actualizado: UsuarioSistema) => {
    if (!actualizado.uid) return;
    await updateUsuarioSistema(actualizado.uid, actualizado);
    await cargarUsuarios();
  };

  const handleDelete = async (uid: string) => {
    await deleteUsuarioSistema(uid);
    await cargarUsuarios();
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const columns = useMemo<MRT_ColumnDef<UsuarioSistema & { id: string }>[]>(
    () => [
      { accessorKey: 'email', header: 'Correo Electrónico' },
      {
        accessorKey: 'rol',
        header: 'Rol',
        editVariant: 'select',
        editSelectOptions: ['admin', 'cliente', 'inmueble'],
        muiEditTextFieldProps: {
          select: true,
          required: true,
        },
      },
      { accessorKey: 'asociadoA', header: 'Asociado A' },
      { accessorKey: 'nombre', header: 'Nombre' },
      {
        accessorKey: 'activo',
        header: 'Activo',
        editVariant: 'select',
        editSelectOptions: ['Sí', 'No'],
        muiEditTextFieldProps: {
          select: true,
          required: true,
        },
        Cell: ({ cell }) => (cell.getValue() ? 'Sí' : 'No'),
      },
    ],
    []
  );

  const usuariosAdaptados = usuarios.map((u) => ({ ...u, id: u.uid }));

  return (
    <CrudLayout
      title="Gestión de Usuarios"
      columns={columns}
      data={usuariosAdaptados}
      onCreate={handleCreate}
      onUpdate={(actualizado) =>
        handleUpdate({ ...actualizado, uid: actualizado.id || '' })
      }
      onDelete={(id) => handleDelete(id)}
    />
  );
};

export default UsuarioSistemaCrudPage;
