// src/shared/components/layout/SidebarToggleButton.tsx

import React from "react";
import { useSidebar } from "../../../context/SidebarContext";

const SidebarToggleButton: React.FC = () => {
  const { toggleSidebar, toggleMobileSidebar, isMobileOpen } = useSidebar();

  const handleClick = () => {
    if (window.innerWidth < 1024) {
      toggleMobileSidebar();
    } else {
      toggleSidebar();
    }
  };

  return (
    <button
  onClick={handleClick}
  className="fixed top-4 z-[1000] p-2 rounded-md bg-white shadow-md dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors left-4 lg:left-[310px]"
  aria-label="Toggle Sidebar"
>
      {isMobileOpen ? (
        // Icono de cerrar (X)
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M6.21967 6.21967C6.51256 5.92678 6.98744 5.92678 7.28033 6.21967L12 10.9393L16.7197 6.21967C17.0126 5.92678 17.4874 5.92678 17.7803 6.21967C18.0732 6.51256 18.0732 6.98744 17.7803 7.28033L13.0607 12L17.7803 16.7197C18.0732 17.0126 18.0732 17.4874 17.7803 17.7803C17.4874 18.0732 17.0126 18.0732 16.7197 17.7803L12 13.0607L7.28033 17.7803C6.98744 18.0732 6.51256 18.0732 6.21967 17.7803C5.92678 17.4874 5.92678 17.0126 6.21967 16.7197L10.9393 12L6.21967 7.28033C5.92678 6.98744 5.92678 6.51256 6.21967 6.21967Z"
            fill="currentColor"
          />
        </svg>
      ) : (
        // Icono de menú (hamburguesa)
        <svg width="20" height="20" viewBox="0 0 16 12" fill="none">
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M1 1h14v1.5H1V1zm0 4.25h14v1.5H1v-1.5zM1 9.5h14V11H1V9.5z"
            fill="currentColor"
          />
        </svg>
      )}
    </button>
  );
};

export default SidebarToggleButton;
