// src/modules/clientes/hooks/useClienteConUsuario.ts
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Cliente } from "@/modules/clientes/models/cliente.model";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";
import type { Rol } from "@/shared/constants/acl";

// ⚠️ Ajusta estas rutas a tus servicios reales:
import { obtenerUsuarios } from "@/modules/usuarios/services/usuarioService";
import { getClienteById } from "@/modules/clientes/services/clienteService"; // debe existir en tu proyecto

type State = {
  cliente: Cliente | null;
  usuarios: UsuarioSistema[];
  usuarioCliente: UsuarioSistema | null;
  ejecutivoPre: UsuarioSistema | null;
  ejecutivoJur: UsuarioSistema | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

/**
 * Hook que trae cliente + enlaza datos de UsuarioSistema (correo/teléfono/documento)
 * y resuelve ejecutivos por los ids guardados en el cliente.
 *
 * Relación usada:
 *  - usuarioCliente: cliente.usuarioUid ?? cliente.id
 *  - ejecutivoPre:   usuarios.find(u => u.uid === cliente.ejecutivoPrejuridicoId)
 *  - ejecutivoJur:   usuarios.find(u => u.uid === cliente.ejecutivoJuridicoId)
 */
export function useClienteConUsuario(clienteId?: string): State {
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clienteId) return;
    setLoading(true);
    setError(null);
    try {
      const [c, us] = await Promise.all([
        getClienteById(clienteId), // ⚠️ implementa/ajusta en tu service
        obtenerUsuarios(),         // ya lo tienes en usuarioService
      ]);
      setCliente(c ?? null);
      setUsuarios(us ?? []);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "No se pudo cargar la información del cliente/usuarios");
    } finally {
      setLoading(false);
    }
  }, [clienteId]);

  useEffect(() => {
    load();
  }, [load]);

  const usuarioCliente = useMemo(() => {
    if (!cliente || usuarios.length === 0) return null;
    const uidCliente = (cliente as any).usuarioUid ?? cliente.id;
    return usuarios.find((u) => u.uid === uidCliente) ?? null;
  }, [cliente, usuarios]);

  const ejecutivoPre = useMemo(() => {
    if (!cliente || usuarios.length === 0) return null;
    return usuarios.find((u) => u.uid === cliente.ejecutivoPrejuridicoId) ?? null;
  }, [cliente, usuarios]);

  const ejecutivoJur = useMemo(() => {
    if (!cliente || usuarios.length === 0) return null;
    return usuarios.find((u) => u.uid === cliente.ejecutivoJuridicoId) ?? null;
  }, [cliente, usuarios]);

  return {
    cliente,
    usuarios,
    usuarioCliente,
    ejecutivoPre,
    ejecutivoJur,
    loading,
    error,
    refresh: load,
  };
}
