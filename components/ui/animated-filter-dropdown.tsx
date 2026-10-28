"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Filter, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface AnimatedFilterOption {
  value: string;
  label: string;
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
  dropdownClassName?: string;
}

export function AnimatedFilterDropdown({
  label,
  icon = <Filter className="h-3.5 w-3.5 text-gray-400" />,
  options,
  value,
  onChange,
  disabled,
  className,
  containerClassName,
  dropdownClassName,
  children,
  ...props
}: AnimatedFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const hiddenSelectRef = useRef<HTMLSelectElement>(null);

  const stringValue = String(value ?? "");

  // Parse options from props or children if needed
  const parsedOptions: AnimatedFilterOption[] = useMemo(() => {
    if (options && options.length > 0) {
      return options;
    }
    const extracted: AnimatedFilterOption[] = [];
    React.Children.forEach(children, (child) => {
      if (React.isValidElement(child) && child.props) {
        const childProps = child.props as Record<string, any>;
        extracted.push({
          value: String(childProps.value ?? ""),
          label: String(childProps.children ?? childProps.value ?? ""),
        });
      }
    });
    return extracted;
  }, [options, children]);

  // Find currently active option
  const selectedOption = parsedOptions.find(
    (opt) => String(opt.value) === stringValue
  ) || {
    value: stringValue,
    label: stringValue || "Select...",
  };

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent | TouchEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectOption = (opt: AnimatedFilterOption) => {
    if (disabled) return;
    setIsOpen(false);

    if (hiddenSelectRef.current) {
      hiddenSelectRef.current.value = opt.value;
    }

    if (onChange) {
      const syntheticEvent = {
        target: { value: opt.value, name: props.name || "" },
        currentTarget: { value: opt.value, name: props.name || "" },
        type: "change",
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block select-none", containerClassName)}
    >
      {/* Hidden native select for form compatibility */}
      <select
        ref={hiddenSelectRef}
        value={value}
        onChange={onChange}
        disabled={disabled}
        aria-hidden="true"
        tabIndex={-1}
        className="sr-only pointer-events-none absolute h-0 w-0 opacity-0"
        {...props}
      >
        {parsedOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Simple, clean filter button without multi-colors */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "group relative inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-colors duration-150 cursor-pointer shadow-2xs bg-white dark:bg-gray-800",
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/15 text-gray-900 dark:border-blue-400 dark:ring-blue-400/20 dark:text-white"
            : "border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50/70 dark:border-gray-700 dark:text-gray-200 dark:hover:border-gray-600 dark:hover:bg-gray-750",
          disabled && "opacity-50 cursor-not-allowed pointer-events-none",
          className
        )}
      >
        {/* Icon */}
        {icon && <span className="shrink-0">{icon}</span>}

        {/* Label */}
        {label && (
          <span className="font-medium text-gray-500 dark:text-gray-400 whitespace-nowrap">
            {label}:
          </span>
        )}

        {/* Selected Value Text */}
        <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
          {selectedOption.label}
        </span>

        {/* Chevron arrow */}
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          className="shrink-0 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-300 ml-0.5"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      {/* Floating Simple Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={cn(
              "absolute left-0 top-full mt-1.5 z-50 min-w-[200px] w-max max-h-72 overflow-y-auto rounded-xl border border-gray-200 bg-white p-1 shadow-lg dark:border-gray-700 dark:bg-gray-800",
              dropdownClassName
            )}
          >
            <div className="flex flex-col gap-0.5">
              {parsedOptions.map((opt) => {
                const isSelected = String(opt.value) === stringValue;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelectOption(opt)}
                    className={cn(
                      "flex items-center justify-between gap-2.5 w-full rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer",
                      isSelected
                        ? "bg-blue-50 text-blue-700 font-semibold dark:bg-blue-950/40 dark:text-blue-300"
                        : "text-gray-700 hover:bg-gray-100/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white"
                    )}
                  >
                    <span className="truncate">{opt.label}</span>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {opt.badge && (
                        <span className="rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {opt.badge}
                        </span>
                      )}
                      {isSelected && (
                        <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
