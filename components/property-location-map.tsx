"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { divIcon, type LatLngBoundsExpression } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { Building2, MapPin, Search, ChevronDown, RotateCcw, Filter } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { safeParseJson } from "@/lib/data";

import "leaflet/dist/leaflet.css";

type MappedProperty = {
  id: string;
  name: string;
  type: string;
  address: string;
  latitude: number;
  longitude: number;
  totalUnits: number;
  occupiedUnits: number;
  availableUnits: number;
  occupancy: number;
  outstandingReceivables?: number;
  status: string;
};

const markerIcon = divIcon({
  className: "property-map-marker-shell",
  html: '<span class="property-map-marker"><span></span></span>',
  iconSize: [30, 38],
  iconAnchor: [15, 36],
  popupAnchor: [0, -34],
});

const currency = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function rolePropertyHref(role: string, propertyId: string) {
  const encodedId = encodeURIComponent(propertyId);
  if (role === "admin") return `/dashboard/admin?tab=properties&property=${encodedId}#properties`;
  if (role === "owner") return `/dashboard/owner?tab=units&view=properties&property=${encodedId}#units`;
  if (role === "agent") return `/dashboard/agent?tab=units&property=${encodedId}#units`;
  return "/dashboard/tenant/properties-page";
}

function FitMapToProperties({ properties }: { properties: MappedProperty[] }) {
  const map = useMap();

  useEffect(() => {
    if (properties.length === 1) {
      map.setView([properties[0].latitude, properties[0].longitude], 14);
    } else if (properties.length > 1) {
      const bounds: LatLngBoundsExpression = properties.map((property) => [property.latitude, property.longitude]);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
    }
  }, [map, properties]);

  return null;
}

export default function PropertyLocationMap({ hideHeader = false }: { hideHeader?: boolean }) {
  const { user } = useAuth();
  const [properties, setProperties] = useState<MappedProperty[]>([]);
  const [unmappedCount, setUnmappedCount] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [occupancyFilter, setOccupancyFilter] = useState("all");
  const [selectedPropertyId, setSelectedPropertyId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    fetch("/api/data/property-map", { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        const data = await safeParseJson(response);
        if (!response.ok || !data.success) throw new Error(data.error || "Unable to load properties");
        if (!mounted) return;
        setProperties(Array.isArray(data.properties) ? data.properties : []);
        setUnmappedCount(Number(data.unmappedCount || 0));
      })
      .catch((loadError) => {
        if (mounted) setError(loadError instanceof Error ? loadError.message : "Unable to load properties");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, []);

  const propertyTypes = useMemo(() => {
    return Array.from(new Set(properties.map((p) => p.type).filter(Boolean)));
  }, [properties]);

  const filteredProperties = useMemo(() => {
    const term = search.trim().toLowerCase();
    return properties.filter((property) => {
      if (typeFilter !== "all" && property.type.toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (occupancyFilter === "available" && property.availableUnits <= 0) return false;
      if (occupancyFilter === "occupied" && property.availableUnits > 0) return false;
      if (selectedPropertyId !== "all" && property.id !== selectedPropertyId) return false;
      if (!term) return true;
      return `${property.name} ${property.address} ${property.type}`.toLowerCase().includes(term);
    });
  }, [properties, search, typeFilter, occupancyFilter, selectedPropertyId]);

  const center: [number, number] = filteredProperties[0]
    ? [filteredProperties[0].latitude, filteredProperties[0].longitude]
    : [8.9475, 125.5406];

  const hasActiveFilters = search || typeFilter !== "all" || occupancyFilter !== "all" || selectedPropertyId !== "all";

  return (
    <section className="space-y-4">
      {!hideHeader && (
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-700">Property location mapping</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Property Map</h1>
            <p className="mt-1 text-sm text-slate-600">Explore mapped properties and their unit availability.</p>
          </div>
        </header>
      )}

      {/* Modern Filter & Search Toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        {/* Search Input */}
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search properties or addresses..."
            aria-label="Search properties or addresses"
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/60 pl-9 pr-3 text-xs text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-100"
          />
        </div>

        {/* Property Type Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by property type"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Types</option>
            {propertyTypes.map((type) => (
              <option key={type} value={type} className="capitalize">{type}</option>
            ))}
          </select>
        </div>

        {/* Occupancy Status Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={occupancyFilter}
            onChange={(e) => setOccupancyFilter(e.target.value)}
            aria-label="Filter by occupancy"
            className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">All Occupancy</option>
            <option value="available">Has Vacant Units</option>
            <option value="occupied">Fully Occupied</option>
          </select>
        </div>

        {/* Quick Focus / Jump to Property Dropdown */}
        <div className="flex items-center gap-1.5">
          <select
            value={selectedPropertyId}
            onChange={(e) => setSelectedPropertyId(e.target.value)}
            aria-label="Jump to property on map"
            className="h-9 max-w-[200px] truncate rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            <option value="all">Jump to property...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setTypeFilter("all");
              setOccupancyFilter("all");
              setSelectedPropertyId("all");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      {unmappedCount > 0 && (
        <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
          {unmappedCount} {unmappedCount === 1 ? "property has" : "properties have"} no saved coordinates and {unmappedCount === 1 ? "is" : "are"} not shown on the map yet.
        </p>
      )}

      {error ? (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-8 text-center text-sm text-red-800">{error}</div>
      ) : loading ? (
        <div role="status" className="flex h-105 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-500">Loading property locations…</div>
      ) : filteredProperties.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-slate-200 bg-slate-50 px-6 text-center">
          <Building2 className="h-8 w-8 text-slate-400" />
          <h2 className="mt-3 text-base font-semibold text-slate-900">{properties.length ? "No properties match your search" : "No mapped properties yet"}</h2>
          <p className="mt-1 max-w-md text-sm leading-6 text-slate-600">
            {properties.length ? "Try a different property name or address." : "Properties appear here after latitude and longitude are saved."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="h-[min(68vh,680px)] min-h-105 w-full">
            <MapContainer center={center} zoom={6} scrollWheelZoom className="h-full w-full">
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
              />
              <FitMapToProperties properties={filteredProperties} />
              {filteredProperties.map((property) => (
                <Marker key={property.id} position={[property.latitude, property.longitude]} icon={markerIcon} title={property.name}>
                  <Popup minWidth={260} maxWidth={300}>
                    <div className="min-w-60 p-1 text-slate-900">
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-blue-700">{property.type}</p>
                      <h2 className="mt-1 text-base font-semibold">{property.name}</h2>
                      <p className="mt-1 flex gap-1.5 text-xs leading-5 text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{property.address}</p>
                      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-200 pt-3 text-xs">
                        <div><dt className="text-slate-500">Total units</dt><dd className="mt-0.5 font-semibold">{property.totalUnits}</dd></div>
                        <div><dt className="text-slate-500">Occupied</dt><dd className="mt-0.5 font-semibold">{property.occupiedUnits}</dd></div>
                        <div><dt className="text-slate-500">Available</dt><dd className="mt-0.5 font-semibold">{property.availableUnits}</dd></div>
                        <div><dt className="text-slate-500">Occupancy</dt><dd className="mt-0.5 font-semibold">{property.occupancy}%</dd></div>
                        {property.outstandingReceivables !== undefined && (
                          <div className="col-span-2"><dt className="text-slate-500">Outstanding receivables</dt><dd className="mt-0.5 font-semibold">{currency.format(property.outstandingReceivables)}</dd></div>
                        )}
                      </dl>
                      <Link
                        href={rolePropertyHref(user?.role || "tenant", property.id)}
                        onClick={() => {
                          if (typeof window !== "undefined") {
                            window.dispatchEvent(
                              new CustomEvent("renttrack-switch-tab", {
                                detail: {
                                  tab: "units",
                                  view: "properties",
                                  propertyId: property.id,
                                },
                              })
                            );
                          }
                        }}
                        className="mt-3 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 cursor-pointer"
                      >
                        View Property <span aria-hidden="true" className="ml-1">→</span>
                      </Link>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600">
            <span>{filteredProperties.length} mapped {filteredProperties.length === 1 ? "property" : "properties"}</span>
            <span>Map data © OpenStreetMap contributors</span>
          </div>
        </div>
      )}
    </section>
  );
}
