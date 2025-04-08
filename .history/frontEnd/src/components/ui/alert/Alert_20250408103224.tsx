import React from "react";
import { Link } from "react-router-dom";

export interface AlertProps {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
  showLink?: boolean;
  linkHref?: string;
  linkText?: string;
}

const Alert: React.FC<AlertProps> = ({
  variant,
  title,
  message,
  showLink = false,
  linkHref = "#",
  linkText = "Learn more",
}) => {
  const variantClasses = {
    success: {
      container: "border-green-500 bg-green-50 dark:border-green-500/30 dark:bg-green-500/15",
      icon: "text-green-500",
    },
    error: {
      container: "border-red-500 bg-red-50 dark:border-red-500/30 dark:bg-red-500/15",
      icon: "text-red-500",
    },
    warning: {
      container: "border-yellow-500 bg-yellow-50 dark:border-yellow-500/30 dark:bg-yellow-500/15",
      icon: "text-yellow-500",
    },
    info: {
      container: "border-blue-500 bg-blue-50 dark:border-blue-500/30 dark:bg-blue-500/15",
      icon: "text-blue-500",
    },
  };

  const icons = {
    success: "✅",
    error: "❌",
    warning: "⚠️",
    info: "ℹ️",
  };

  return (
    <div className={`rounded-xl border p-4 ${variantClasses[variant].container}`}>
      <div className="flex items-start gap-3">
        <div className={`text-xl ${variantClasses[variant].icon}`}>
          {icons[variant]}
        </div>
        <div>
          <h4 className="mb-1 text-sm font-semibold text-gray-800 dark:text-white/90">
            {title}
          </h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
          {showLink && (
            <Link
              to={linkHref}
              className="inline-block mt-3 text-sm font-medium text-blue-600 underline dark:text-blue-400"
            >
              {linkText}
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alert;
