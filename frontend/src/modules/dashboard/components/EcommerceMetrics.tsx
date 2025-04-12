import React from "react";
import { BoxIconLine, GroupIcon } from "../../../assets/icons";
import { EcommerceMetricsProps } from "../../../models/dashboard.model";

export default function EcommerceMetrics({
  totalClientes,
  totalUsuarios,
  totalInmuebles,
  totalDeudores,
}: EcommerceMetricsProps) {
  const cards = [
    { label: "Clientes", value: totalClientes },
    { label: "Usuarios", value: totalUsuarios },
    { label: "Inmuebles", value: totalInmuebles },
    { label: "Deudores", value: totalDeudores },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 md:gap-6">
      {cards.map((card, index) => (
        <div
          key={index}
          className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6"
        >
          <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
            {index % 2 === 0 ? (
              <GroupIcon className="text-gray-800 size-6 dark:text-white/90" />
            ) : (
              <BoxIconLine className="text-gray-800 size-6 dark:text-white/90" />
            )}
          </div>
          <div className="mt-5">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {card.label}
            </span>
            <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
              {card.value}
            </h4>
          </div>
        </div>
      ))}
    </div>
  );
}
