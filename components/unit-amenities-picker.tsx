"use client";

import { useState, useRef, useEffect } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const CONDO_AMENITIES = [
  "Studio Unit",
  "1 Bedroom",
  "2 Bedrooms",
  "3 Bedrooms",
  "4+ Bedrooms",
  "1 Bathroom",
  "2 Bathrooms",
  "3+ Bathrooms",
  "Parking Space",
  "Fully Furnished",
  "Semi-Furnished",
  "Unfurnished",
  "Air Conditioning",
  "Wi-Fi",
  "Laundry Area",
  "Kitchen",
  "Balcony",
  "Built-in Cabinets",
  "Swimming Pool",
  "Gym / Fitness Center",
  "Elevator",
  "24/7 Security",
  "CCTV Surveillance",
  "Function Room",
  "Children's Playground",
] as const;

interface UnitAmenitiesPickerProps {
  value: string[];
  onChange: (features: string[]) => void;
  className?: string;
  disabled?: boolean;
}

export function UnitAmenitiesPicker({
  value = [],
  onChange,
  className,
  disabled = false,
}: UnitAmenitiesPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const toggleAmenity = (amenity: string) => {
    if (value.includes(amenity)) {
      onChange(value.filter((item) => item !== amenity));
    } else {
      onChange([...value, amenity]);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {/* Dropdown Input Trigger */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        tabIndex={disabled ? -1 : 0}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
            e.preventDefault();
            setIsOpen(true);
          } else if (e.key === "Escape") {
            setIsOpen(false);
          }
        }}
        className={cn(
          "min-h-[44px] w-full rounded-xl border border-border bg-white px-3 py-2 text-sm flex items-center justify-between gap-2 cursor-pointer transition-colors shadow-2xs",
          "focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15",
          isOpen && "border-blue-500 ring-2 ring-blue-500/15",
          disabled && "bg-slate-50 cursor-not-allowed opacity-60"
        )}
      >
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {value.length === 0 ? (
            <span className="text-slate-400 select-none text-sm">Select features...</span>
          ) : (
            value.map((feature) => (
              <span
                key={feature}
                className="inline-flex items-center gap-1 rounded-lg bg-blue-50 border border-blue-200 px-2 py-0.5 text-xs font-medium text-blue-700 shadow-2xs"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleAmenity(feature);
                }}
              >
                <span>{feature}</span>
                <span
                  role="button"
                  tabIndex={0}
                  className="rounded-full p-0.5 text-blue-500 hover:bg-blue-200 hover:text-blue-900 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAmenity(feature);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      toggleAmenity(feature);
                    }
                  }}
                  aria-label={`Remove ${feature}`}
                >
                  <X className="h-3 w-3" />
                </span>
              </span>
            ))
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {value.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange([]);
              }}
              title="Clear all"
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-200",
              isOpen && "rotate-180 text-blue-600"
            )}
          />
        </div>
      </div>

      {/* Vertical Dropdown List */}
      {isOpen && (
        <div
          role="listbox"
          aria-multiselectable="true"
          className="absolute left-0 right-0 top-full mt-1.5 z-[9999] max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in-50 zoom-in-95 duration-150"
        >
          <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-100 mb-1 flex items-center justify-between">
            <span>Condominium Amenities &amp; Facilities</span>
            <span>{value.length} selected</span>
          </div>
          <div className="flex flex-col gap-0.5">
            {CONDO_AMENITIES.map((amenity) => {
              const isSelected = value.includes(amenity);
              return (
                <button
                  key={amenity}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleAmenity(amenity);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium rounded-lg transition-colors cursor-pointer",
                    isSelected
                      ? "bg-blue-50/90 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center transition-colors",
                        isSelected
                          ? "border-blue-600 bg-blue-600 text-white"
                          : "border-slate-300 bg-white"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <span>{amenity}</span>
                  </div>
                  {isSelected && (
                    <span className="text-[10px] uppercase tracking-wider text-blue-600 font-bold">
                      Selected
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default UnitAmenitiesPicker;
