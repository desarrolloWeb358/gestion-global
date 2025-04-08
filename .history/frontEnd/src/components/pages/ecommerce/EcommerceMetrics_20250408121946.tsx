// src/components/ecommerce/EcommerceMetrics.tsx
import React from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BoxIconLine,
  GroupIcon,
} from "../../../assets/icons";
import Badge from "../../ui/badge/Badge";
import { EcommerceMetricsProps } from "../../../models/dashboard.model";

export default function EcommerceMetrics({
  totalClientes,
  totalUsuarios,
  totalInmuebles,
  totalDeudores,
}: EcommerceMetricsProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:gap-6">
      {/* Clientes */}
      <MetricCard label="Clientes" value={totalClientes} icon={<GroupIcon />} trend="up" />

      {/* Usuarios */}
      <MetricCard label="Usuarios" value={totalUsuarios} icon={<BoxIconLine />} trend="down" />

      {/* Inmuebles */}
      <MetricCard label="Inmuebles" value={totalInmuebles} icon={<GroupIcon />} trend="up" />

      {/* Deudores */}
      <MetricCard label="Deudores" value={totalDeudores} icon={<GroupIcon />} trend="down" />
    </div>
  );
}

// Componente para reutilizar tarjetas
const MetricCard = ({
  label,
  value,
  icon,
  trend,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  trend: "up" | "down";
}) => {
  const TrendIcon = trend === "up" ? ArrowUpIcon : ArrowDownIcon;
  const badgeColor = trend === "up" ? "success" : "error";

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
      <div className="flex items-center justify-center w-12 h-12 bg-gray-100 rounded-xl dark:bg-gray-800">
        {icon}
      </div>
      <div className="flex items-end justify-between mt-5">
        <div>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {label}
          </span>
          <h4 className="mt-2 font-bold text-gray-800 text-title-sm dark:text-white/90">
            {value}
          </h4>
        </div>
        <Badge color={badgeColor}>
          <TrendIcon />
          {trend === "up" ? "+10%" : "-5%"}
        </Badge>
      </div>
    </div>
  );
};
