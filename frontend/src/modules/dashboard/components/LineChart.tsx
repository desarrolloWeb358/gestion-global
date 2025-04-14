import React from "react";
import PageBreadcrumb from "../../../shared/components/ui/PageBreadCrumb";
import ComponentCard from "../../../shared/components/ui/ComponentCard";
import LineChartOne from "./LineChartOne";
import PageMeta from "../../../shared/components/ui/PageMeta";

export default function LineChart() {
  return (
    <>
      <PageMeta
        title="React.js Chart Dashboard | TailAdmin - React.js Admin Dashboard Template"
        description="This is React.js Chart Dashboard page for TailAdmin - React.js Tailwind CSS Admin Dashboard Template"
      />
      <PageBreadcrumb pageTitle="Line Chart" />
      <div className="space-y-6">
        <ComponentCard title="Line Chart 1">
          <LineChartOne />
        </ComponentCard>
      </div>
    </>
  );
}
