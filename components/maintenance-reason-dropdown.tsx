"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { ChevronDown, Check, Search, Wrench, Shield, Home, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAINTENANCE_REASON_GROUPS } from "@/lib/data";

interface MaintenanceReasonDropdownProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
}

export function MaintenanceReasonDropdown({
  value,
  onChange,
  disabled = false,
  className,
  placeholder = "Select maintenance or repair reason...",
}: MaintenanceReasonDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Filter reasons by search term
  const filteredGroups = useMemo(() => {
    if (!searchTerm.trim()) return MAINTENANCE_REASON_GROUPS;
    const term = searchTerm.toLowerCase();
    return MAINTENANCE_REASON_GROUPS.map((grp) => ({
      ...grp,
      reasons: grp.reasons.filter((r) => r.toLowerCase().includes(term)),
    })).filter((grp) => grp.reasons.length > 0);
  }, [searchTerm]);

  const getGroupIcon = (groupName: string) => {
    if (groupName.toLowerCase().includes("unit")) return <Wrench className="h-3.5 w-3.5 text-blue-500" />;
    if (groupName.toLowerCase().includes("house")) return <Home className="h-3.5 w-3.5 text-emerald-500" />;
    if (groupName.toLowerCase().includes("security") || groupName.toLowerCase().includes("system"))
      return <Shield className="h-3.5 w-3.5 text-amber-500" />;
    return <Sparkles className="h-3.5 w-3.5 text-purple-500" />;
  };

  return (
    <div ref={dropdownRef} className={cn("relative w-full", className)}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 rounded-xl border border-amber-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-gray-800 shadow-2xs transition-all text-left",
          "hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20",
          isOpen && "border-amber-500 ring-2 ring-amber-500/20",
          disabled && "opacity-60 cursor-not-allowed bg-gray-50"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Wrench className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span className="truncate">{value || placeholder}</span>
        </div>
        <ChevronDown
          className={cn("h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200", isOpen && "rotate-180")}
        />
      </button>

      {/* Floating Menu with Strict Max Height to Prevent Overlapping */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-gray-200 bg-white shadow-2xl p-2 max-w-full">
          {/* Quick Search Header */}
          <div className="relative mb-2 px-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search repair or maintenance reason..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 bg-gray-50 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-amber-400 focus:bg-white transition-colors"
              autoFocus
            />
          </div>

          {/* Scrollable list with max-height 240px */}
          <div className="max-h-60 overflow-y-auto space-y-3 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
            {filteredGroups.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">No matching reasons found</div>
            ) : (
              filteredGroups.map((grp) => (
                <div key={grp.group} className="space-y-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-bold text-gray-500 uppercase tracking-wider bg-gray-50 rounded-md">
                    {getGroupIcon(grp.group)}
                    <span>{grp.group}</span>
                  </div>
                  <div className="space-y-0.5 pt-0.5">
                    {grp.reasons.map((reason) => {
                      const isSelected = value === reason;
                      return (
                        <button
                          key={reason}
                          type="button"
                          onClick={() => {
                            onChange(reason);
                            setIsOpen(false);
                            setSearchTerm("");
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors",
                            isSelected
                              ? "bg-amber-100/70 text-amber-950 font-bold"
                              : "text-gray-700 hover:bg-amber-50/60 hover:text-amber-900 font-medium"
                          )}
                        >
                          <span className="truncate pr-2">{reason}</span>
                          {isSelected && <Check className="h-3.5 w-3.5 text-amber-700 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
