// src/modules/deudores/pages/DeudorDetailPage.tsx
"use client";

import * as React from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  User,
  History,
  CreditCard,
  Phone,
  Mail,
  IdCard,
  Tag,
} from "lucide-react";

import { getDeudorById, vincularDeudorConUsuario } from "../services/deudorService";


import {
  getUsuarioByUid,
  obtenerUsuarios,
} from "@/modules/usuarios/services/usuarioService";
import type { UsuarioSistema } from "@/modules/usuarios/models/usuarioSistema.model";

import { Typography } from "@/shared/design-system/components/Typography";
import { BackButton } from "@/shared/design-system/components/BackButton";
import { cn } from "@/shared/lib/cn";

import { getClienteById } from "@/modules/clientes/services/clienteService";
import type { Cliente } from "@/modules/clientes/models/cliente.model";
import { Deudor } from "../models/deudores.model";
import { crearUsuarioParaDeudor } from "../services/deudorUserService";
import { useUsuarioActual } from "@/modules/auth/hooks/useUsuarioActual";



// Helper para colores de tipificación
const getTipificacionColor = (tipificacion?: string) => {
  const colors: Record<string, string> = {
    GESTIONANDO: "bg-blue-100 text-blue-700 border-blue-200",
    PROMESA_PAGO: "bg-yellow-100 text-yellow-700 border-yellow-200",
    PAGADO: "bg-green-100 text-green-700 border-green-200",
    INACTIVO: "bg-gray-100 text-gray-700 border-gray-200",
    PREJURIDICO: "bg-orange-100 text-orange-700 border-orange-200",
    JURIDICO: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    colors[tipificacion || ""] ||
    "bg-gray-100 text-gray-700 border-gray-200"
  );
};

export default function DeudorDetailPage() {
  const { clienteId, deudorId } = useParams<{ clienteId: string; deudorId: string }>();
  const navigate = useNavigate();

  // 👇 nuevo: saber qué rol tiene el usuario logueado
  const { roles, usuarioSistema } = useUsuarioActual();
  const userRoles = roles && roles.length ? roles : usuarioSistema?.roles ?? [];
  const esDeudor = userRoles.includes("deudor");
  const esCliente = userRoles.includes("cliente");
  const esEjecutivo = userRoles.includes("ejecutivo");
  const esAdmin = userRoles.includes("admin");
  const puedeCrearAccesoDeudor = !esDeudor && !esCliente && (esAdmin || esEjecutivo);
  const puedeGestionarAccesos = puedeCrearAccesoDeudor;
  const [deudor, setDeudor] = React.useState<Deudor | null>(null);
  const [usuario, setUsuario] = React.useState<UsuarioSistema | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadingUsuario, setLoadingUsuario] = React.useState(false);

  const [nombreCliente, setNombreCliente] =
    React.useState<string>("Cargando...");
  const [loadingCliente, setLoadingCliente] = React.useState(true);
  const [usuarios, setUsuarios] = React.useState<UsuarioSistema[]>([]);
  const [cliente, setCliente] = React.useState<Cliente | null>(null);

  const [mensajeAcceso, setMensajeAcceso] = React.useState<string | null>(null);
  const [creandoAcceso, setCreandoAcceso] = React.useState(false);

  // ===========================
  // Cargar información del cliente
  // ===========================
  const fetchCliente = async () => {
    if (!clienteId) return;

    try {
      setLoadingCliente(true);
      const clienteData = await getClienteById(clienteId);
      setCliente(clienteData);

      if (clienteData) {
        if (clienteData.nombre) {
          setNombreCliente(clienteData.nombre);
        } else {
          const todosUsuarios = await obtenerUsuarios();
          setUsuarios(todosUsuarios);

          const usuarioEncontrado = todosUsuarios.find(
            (u) => u.uid === clienteId
          );

          if (usuarioEncontrado) {
            setNombreCliente(
              usuarioEncontrado.nombre ??
              (usuarioEncontrado as any).displayName ??
              usuarioEncontrado.email ??
              "Cliente"
            );
          } else {
            setNombreCliente("Cliente");
          }
        }
      } else {
        setNombreCliente("Cliente");
      }
    } catch (error) {
      console.error("Error al cargar cliente:", error);
      setNombreCliente("Cliente");
    } finally {
      setLoadingCliente(false);
    }
  };

  // ===========================
  // Crear acceso para el deudor
  // ===========================
  const handleCrearAccesoDeudor = async () => {
    if (!deudor || !clienteId) return;
    if (!deudor.id) {
      setMensajeAcceso("No se encontró el ID del deudor.");
      return;
    }

    // 1) Correo del deudor
    const emailDeudor = usuario?.email || deudor.correos?.[0] || "";
    if (!emailDeudor) {
      setMensajeAcceso(
        "El deudor no tiene correo registrado. Registra un correo antes de crear el acceso."
      );
      return;
    }

    // 2) Número de documento del deudor -> usamos la cédula del modelo
    const numeroDocumento = usuario?.numeroDocumento || deudor.cedula || "";

    if (!numeroDocumento) {
      setMensajeAcceso(
        "El deudor no tiene número de documento (cédula) registrado. Regístralo antes de crear el acceso."
      );
      return;
    }

    // 3) Evitar duplicar usuario
    if (deudor.uidUsuario) {
      setMensajeAcceso("Este deudor ya tiene un usuario asociado.");
      return;
    }

    try {
      setCreandoAcceso(true);
      setMensajeAcceso(null);

      const usuarioDeudor = await crearUsuarioParaDeudor({
        email: emailDeudor,
        nombre: deudor.nombre,
        clienteId,
        deudorId: deudor.id,
        numeroDocumento, // 👈 contraseña inicial = cédula
      });

      await vincularDeudorConUsuario(clienteId, deudor.id, usuarioDeudor.uid);

      setDeudor((prev) =>
        prev ? { ...prev, uidUsuario: usuarioDeudor.uid } : prev
      );

      setMensajeAcceso(
        `Usuario creado para el deudor. Email: ${emailDeudor}, contraseña inicial: ${numeroDocumento}`
      );
    } catch (error: any) {
      console.error(error);
      setMensajeAcceso(
        `Error al crear acceso: ${error?.message ?? "Error desconocido"}`
      );
    } finally {
      setCreandoAcceso(false);
    }
  };

  // ===========================
  // Effects
  // ===========================
  React.useEffect(() => {
    fetchCliente();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  React.useEffect(() => {
    if (!clienteId || !deudorId) return;

    let canceled = false;
    setLoading(true);

    getDeudorById(clienteId, deudorId)
      .then(async (d) => {
        if (canceled) return;
        setDeudor(d);

        if (d?.uidUsuario) {
          setLoadingUsuario(true);
          try {
            const u = await getUsuarioByUid(String(d.uidUsuario));
            if (!canceled) setUsuario(u);
          } finally {
            if (!canceled) setLoadingUsuario(false);
          }
        }
      })
      .finally(() => {
        if (!canceled) setLoading(false);
      });

    return () => {
      canceled = true;
    };
  }, [clienteId, deudorId]);

  // ===========================
  // Estados de carga / error
  // ===========================
  if (loading || loadingCliente) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 mx-auto animate-spin rounded-full border-4 border-brand-primary/20 border-t-brand-primary mb-4" />
          <Typography variant="body" >
            Cargando información del deudor...
          </Typography>
        </div>
      </div>
    );
  }

  if (!deudor) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30 flex items-center justify-center">
        <div className="text-center">
          <div className="p-4 rounded-full bg-red-100 mb-4 inline-block">
            <User className="h-8 w-8 text-red-600" />
          </div>
          <Typography variant="h2" className="text-red-600 mb-2">
            Deudor no encontrado
          </Typography>
          <Typography variant="body" className="mb-4">
            No se pudo encontrar la información del deudor
          </Typography>
        </div>
      </div>
    );
  }

  // ===========================a
  // Render principal
  // ===========================
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-blue-50/30">
      <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 space-y-6">
        {/* HEADER */}
        <header className="space-y-4">
          {!esDeudor && (
            <div className="flex items-center gap-2">
              <BackButton
                variant="ghost"
                size="sm"
                className="text-brand-secondary hover:text-brand-primary hover:bg-brand-primary/5 transition-all"
              />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-brand-primary/10">
                <User className="h-6 w-6 text-brand-primary" />
              </div>
              <Typography
                variant="h1"
                className="!text-brand-primary font-bold"
              >
                {deudor.nombre} - {deudor.ubicacion}
              </Typography>
            </div>
            <Typography
              variant="body"
            >
              Deudor de:{" "}
              <span className="font-semibold text-brand-secondary">
                {nombreCliente}
              </span>
            </Typography>
          </div>
        </header>

        {/* INFORMACIÓN DEL DEUDOR */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <Typography
              variant="h3"
              className="!text-brand-secondary font-semibold"
            >
              Información personal
            </Typography>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Nombre */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-brand-primary/5 border border-brand-primary/10">
                <div className="p-2 rounded-lg bg-white shadow-sm">
                  <User className="h-5 w-5 text-brand-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p >
                    Nombre completo
                  </p>
                  <p className="text-sm font-semibold text-brand-secondary truncate">
                    {deudor.nombre}
                  </p>
                </div>
              </div>

              {/* Teléfono */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-green-50 border border-green-100">
                <div className="p-2 rounded-lg bg-white shadow-sm">
                  <Phone className="h-5 w-5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1">
                    Teléfono
                  </p>
                  {loadingUsuario ? (
                    <div className="h-4 w-24 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {usuario?.telefonoUsuario ||
                        deudor.telefonos?.[0] ||
                        "No registrado"}
                    </p>
                  )}
                </div>
              </div>

              {/* Correo */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-blue-50 border border-blue-100">
                <div className="p-2 rounded-lg bg-white shadow-sm">
                  <Mail className="h-5 w-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1">
                    Correo electrónico
                  </p>
                  {loadingUsuario ? (
                    <div className="h-4 w-32 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {usuario?.email || deudor.correos?.[0] || "No registrado"}
                    </p>
                  )}
                </div>
              </div>

              {/* Documento */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-purple-50 border border-purple-100">
                <div className="p-2 rounded-lg bg-white shadow-sm">
                  <IdCard className="h-5 w-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs mb-1">
                    Documento
                  </p>
                  {loadingUsuario ? (
                    <div className="h-4 w-28 bg-gray-200 animate-pulse rounded" />
                  ) : (
                    <p className="text-sm font-semibold text-gray-700 truncate">
                      {usuario?.numeroDocumento || deudor.cedula || "No registrado"}
                    </p>
                  )}
                </div>
              </div>

              {/* Tipificación */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-orange-50 border border-orange-100 md:col-span-2">
                <div className="p-2 rounded-lg bg-white shadow-sm">
                  <Tag className="h-5 w-5 text-orange-600" />
                </div>
                <div className="flex-1 min-w-0 flex items-center justify-between">
                  <div>
                    <p className="text-xs mb-1">
                      Tipificación
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      Estado actual del deudor
                    </p>
                  </div>
                  <span
                    className={cn(
                      "inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium",
                      getTipificacionColor(deudor.tipificacion as string)
                    )}
                  >
                    {deudor.tipificacion}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ACCIONES RÁPIDAS */}
        <section className="rounded-2xl border border-brand-secondary/20 bg-white shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-brand-primary/5 to-brand-secondary/5 p-4 md:p-5 border-b border-brand-secondary/10">
            <Typography
              variant="h3"
              className="!text-brand-secondary font-semibold"
            >
              Acciones disponibles
            </Typography>
          </div>

          <div className="p-4 md:p-5">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Seguimiento */}
              <button
                onClick={() =>
                  navigate(
                    `/deudores/${clienteId}/${deudor.id}/seguimiento`
                  )
                }
                className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-5 text-left transition-all hover:border-brand-primary hover:shadow-lg hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-brand-primary/5 transition-transform group-hover:scale-150" />
                <div className="relative">
                  <div className="mb-3 inline-flex rounded-lg bg-brand-primary/10 p-3 transition-colors group-hover:bg-brand-primary/20">
                    <History className="h-5 w-5 text-brand-primary" />
                  </div>
                  <Typography
                    variant="h3"
                    className="!text-brand-secondary mb-1 text-base"
                  >
                    Seguimiento
                  </Typography>
                  <Typography variant="small" >
                    Historial de gestiones
                  </Typography>
                </div>
              </button>

              {/* Abonos */}
              <button
                onClick={() =>
                  navigate(
                    `/deudores/${clienteId}/${deudor.id}/estadosMensuales`
                  )
                }
                className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-5 text-left transition-all hover:border-green-500 hover:shadow-lg hover:-translate-y-1"
              >
                <div className="absolute top-0 right-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-green-500/5 transition-transform group-hover:scale-150" />
                <div className="relative">
                  <div className="mb-3 inline-flex rounded-lg bg-green-500/10 p-3 transition-colors group-hover:bg-green-500/20">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <Typography
                    variant="h3"
                    className="!text-brand-secondary mb-1 text-base"
                  >
                    Abonos
                  </Typography>
                  <Typography variant="small" >
                    Estados mensuales
                  </Typography>
                </div>
              </button>

              {/* Crear acceso para el deudor */}
              {!esDeudor && (
                <button
                  onClick={() => navigate(`/clientes/${clienteId}/deudores/${deudor.id}/AcuerdoPago`)}
                  className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-5 text-left transition-all hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1"
                >
                  <div className="absolute top-0 right-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-indigo-500/5 transition-transform group-hover:scale-150" />
                  <div className="relative">
                    <div className="mb-3 inline-flex rounded-lg bg-indigo-500/10 p-3 transition-colors group-hover:bg-indigo-500/20">
                      <CreditCard className="h-5 w-5 text-indigo-600" />
                    </div>
                    <Typography variant="h3" className="!text-brand-secondary mb-1 text-base">
                      Ver acuerdo de pago
                    </Typography>
                    <Typography variant="small">
                      Consulta el acuerdo activo, cuotas y detalle del compromiso.
                    </Typography>
                  </div>
                </button>
              )}
              {puedeCrearAccesoDeudor && !esCliente && !esDeudor && (
                <button
                  onClick={handleCrearAccesoDeudor}
                  disabled={creandoAcceso}
                  className="group relative overflow-hidden rounded-xl border-2 border-brand-secondary/20 bg-white p-5 text-left transition-all hover:border-indigo-500 hover:shadow-lg hover:-translate-y-1 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <div className="absolute top-0 right-0 h-20 w-20 translate-x-8 -translate-y-8 rounded-full bg-indigo-500/5 transition-transform group-hover:scale-150" />
                  <div className="relative">
                    <div className="mb-3 inline-flex rounded-lg bg-indigo-500/10 p-3 transition-colors group-hover:bg-indigo-500/20">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <Typography variant="h3" className="!text-brand-secondary mb-1 text-base">
                      {creandoAcceso ? "Creando acceso..." : "Crear acceso para el deudor"}
                    </Typography>
                    <Typography variant="small">
                      Genera un usuario y una contraseña inicial basada en la cédula del deudor.
                    </Typography>
                  </div>
                </button>
              )}
            </div>

            {mensajeAcceso && (
              <p className="mt-4 text-xs">
                {mensajeAcceso}
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
