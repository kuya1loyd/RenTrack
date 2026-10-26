"use client";

import React, { useState, useMemo } from "react";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, Check, Wrench, Home, Shield, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { MAINTENANCE_REASON_GROUPS } from "@/lib/data";

interface MaintenanceReasonModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onSelect: (reason: string) => void;
  customReason?: string;
  onCustomReasonChange?: (custom: string) => void;
}

export function MaintenanceReasonModal({
  isOpen,
  onClose,
  value,
  onSelect,
  customReason = "",
  onCustomReasonChange,
}: MaintenanceReasonModalProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("All");

  const categories = useMemo(() => {
    return ["All", ...MAINTENANCE_REASON_GROUPS.map((g) => g.group)];
  }, []);

  const filteredGroups = useMemo(() => {
    let groups = MAINTENANCE_REASON_GROUPS;

    if (activeCategory !== "All") {
      groups = groups.filter((g) => g.group === activeCategory);
    }

    if (!searchTerm.trim()) return groups;

    const term = searchTerm.toLowerCase();
    return groups
      .map((grp) => ({
        ...grp,
        reasons: grp.reasons.filter((r) => r.toLowerCase().includes(term)),
      }))
      .filter((grp) => grp.reasons.length > 0);
  }, [searchTerm, activeCategory]);

  const getGroupIcon = (groupName: string) => {
    if (groupName.toLowerCase().includes("unit")) return <Wrench className="h-4 w-4 text-blue-500" />;
    if (groupName.toLowerCase().includes("house")) return <Home className="h-4 w-4 text-emerald-500" />;
    if (groupName.toLowerCase().includes("system") || groupName.toLowerCase().includes("platform"))
      return <Shield className="h-4 w-4 text-amber-500" />;
    return <Sparkles className="h-4 w-4 text-purple-500" />;
  };

  const isCustomSelected = value === "Other / Custom Maintenance Reason";

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Select Maintenance & Repair Reason"
      description="Choose the appropriate category and maintenance reason to broadcast to users."
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-1">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search reasons, e.g. plumbing, HVAC, electrical, roof..."
            className="pl-10 h-10 rounded-xl bg-gray-50 border-gray-200 text-sm focus:bg-white"
            autoFocus
          />
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActiveCategory(cat)}
              className={cn(
                "px-3 py-1.5 text-xs font-semibold rounded-lg whitespace-nowrap transition-colors cursor-pointer",
                activeCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              )}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Reasons List */}
        <div className="max-h-[380px] overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-200">
          {filteredGroups.length === 0 ? (
            <div className="py-12 text-center text-sm text-gray-400">
              No matching maintenance reasons found for "{searchTerm}"
            </div>
          ) : (
            filteredGroups.map((grp) => (
              <div key={grp.group} className="space-y-1.5">
                <div className="flex items-center gap-2 px-1 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  {getGroupIcon(grp.group)}
                  <span>{grp.group}</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {grp.reasons.map((reason) => {
                    const isSelected = value === reason;
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          onSelect(reason);
                          if (reason !== "Other / Custom Maintenance Reason") {
                            onClose();
                          }
                        }}
                        className={cn(
                          "flex items-start justify-between gap-2 p-3 rounded-xl border text-left text-xs transition-all cursor-pointer",
                          isSelected
                            ? "border-blue-500 bg-blue-50/70 text-blue-950 font-semibold shadow-xs ring-1 ring-blue-500/30"
                            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50"
                        )}
                      >
                        <span className="leading-snug">{reason}</span>
                        {isSelected && (
                          <div className="h-4 w-4 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                            <Check className="h-3 w-3 stroke-[2.5]" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Custom Reason Input if selected */}
        {isCustomSelected && (
          <div className="pt-2 border-t border-gray-100 space-y-1.5">
            <label className="text-xs font-bold text-gray-800">
              Enter Custom Maintenance Reason *
            </label>
            <Input
              value={customReason}
              onChange={(e) => onCustomReasonChange?.(e.target.value)}
              placeholder="e.g. Server infrastructure migration and main water pump replacement"
              className="text-xs h-9 bg-white"
            />
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500 truncate max-w-sm">
            Current: <strong className="text-gray-800">{isCustomSelected && customReason.trim() ? customReason.trim() : value}</strong>
          </p>
          <Button
            size="sm"
            onClick={onClose}
            className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-4"
          >
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
