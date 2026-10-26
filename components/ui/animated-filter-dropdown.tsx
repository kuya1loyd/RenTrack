"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimatedFilterOption {
  value: string;
  label: string;
  dotColor?: string;
  badge?: string;
  [key: string]: any;
}

export interface AnimatedFilterDropdownProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  icon?: React.ReactNode;
  options?: AnimatedFilterOption[];
  activeDot?: boolean;
  pulseOnMaintenance?: boolean;
  containerClassName?: string;
}

export function AnimatedFilterDropdown({
  label,
  icon = <Filter className="h-3.5 w-3.5" />,
  options,
  value,
  onChange,
  disabled,
  className,
  containerClassName,
  children,
  activeDot = true,
  pulseOnMaintenance = true,
  ...props
}: AnimatedFilterDropdownProps) {
  const [isFocused, setIsFocused] = useState(false);

  const stringValue = String(value ?? "");
  const isFiltered = stringValue !== "" && stringValue !== "all";

  // Determine indicator dot color based on selected value
  let dotColor = "bg-gray-400";
  let isMaintenanceValue = false;

  const lowerVal = stringValue.toLowerCase();
  if (lowerVal.includes("occupied") || lowerVal === "active" || lowerVal === "paid" || lowerVal === "approved" || lowerVal === "resolved") {
    dotColor = "bg-emerald-500";
  } else if (lowerVal.includes("vacant") || lowerVal === "available" || lowerVal === "inquiry" || lowerVal === "open") {
    dotColor = "bg-blue-500";
  } else if (lowerVal.includes("maintenance") || lowerVal === "pending" || lowerVal === "overdue") {
    dotColor = "bg-amber-500";
    isMaintenanceValue = true;
  } else if (lowerVal.includes("reserved") || lowerVal === "owner" || lowerVal === "admin") {
    dotColor = "bg-purple-500";
  } else if (isFiltered) {
    dotColor = "bg-blue-600";
  }

  return (
    <div
      className={cn(
        "group relative inline-flex items-center gap-1.5 rounded-xl border bg-white px-3 py-1.5 transition-colors duration-150 dark:bg-gray-800/90 select-none",
        isFocused
          ? "border-blue-500 ring-2 ring-blue-500/20 shadow-xs dark:border-blue-400 dark:ring-blue-400/20"
          : isFiltered
          ? "border-blue-300 bg-blue-50/40 text-blue-900 shadow-2xs dark:border-blue-800 dark:bg-blue-950/20 dark:text-blue-200"
          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50/60 dark:border-gray-700 dark:hover:border-gray-600",
        disabled && "opacity-50 cursor-not-allowed pointer-events-none",
        containerClassName
      )}
    >
      {/* Icon */}
      {icon && (
        <span
          className={cn(
            "transition-colors duration-150 shrink-0",
            isFiltered ? "text-blue-600 dark:text-blue-400" : "text-gray-400 dark:text-gray-500 group-hover:text-gray-600"
          )}
        >
          {icon}
        </span>
      )}

      {/* Label */}
      {label && (
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 select-none whitespace-nowrap">
          {label}:
        </span>
      )}

      {/* Status Dot */}
      {activeDot && isFiltered && (
        <span className="relative flex h-2 w-2 items-center justify-center shrink-0">
          {isMaintenanceValue && pulseOnMaintenance && (
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          )}
          <span className={cn("relative inline-flex h-2 w-2 rounded-full transition-colors duration-200", dotColor)} />
        </span>
      )}

      {/* Native Select styled completely borderless, single-layer, crisp without transforms */}
      <select
        data-animated-select="true"
        value={value}
        onChange={onChange}
        disabled={disabled}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        style={{
          border: "none",
          background: "transparent",
          boxShadow: "none",
          transform: "none",
          outline: "none",
          height: "auto",
          minHeight: "0",
          width: "auto",
          padding: "0 18px 0 0",
          margin: 0,
          borderRadius: 0,
          WebkitAppearance: "none",
          MozAppearance: "none",
          appearance: "none",
        }}
        className={cn(
          "!border-0 !bg-transparent text-xs font-bold text-gray-800 dark:text-gray-200 !outline-none cursor-pointer !pr-5 !appearance-none !shadow-none focus:!outline-none focus:!ring-0 focus:!border-0 !m-0 !h-auto !min-h-0",
          isFiltered && "text-blue-950 dark:text-blue-100",
          className
        )}
        {...props}
      >
        {options
          ? options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                className="bg-white text-gray-900 font-medium py-1.5 dark:bg-gray-800 dark:text-gray-100"
              >
                {opt.label}
              </option>
            ))
          : children}
      </select>

      {/* Animated Rotating Chevron */}
      <motion.span
        animate={{ rotate: isFocused ? 180 : 0 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-hover:text-gray-700 dark:group-hover:text-gray-300"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </motion.span>
    </div>
  );
}
