"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";

import "leaflet/dist/leaflet.css";

const philippinesBounds: L.LatLngBoundsLiteral = [
  [4.5, 116.7],
  [21.3, 126.8],
];

const destinations = [
  { name: "Manila", region: "National Capital Region", coordinates: [14.5995, 120.9842] as [number, number] },
  { name: "Cebu", region: "Central Visayas", coordinates: [10.3157, 123.8854] as [number, number] },
  { name: "Butuan", region: "Agusan del Norte", coordinates: [8.9475, 125.5406] as [number, number] },
  { name: "Davao", region: "Davao Region", coordinates: [7.1907, 125.4553] as [number, number] },
];

function createDestinationIcon(name: string) {
  return L.divIcon({
    className: "destination-map-marker-shell",
    html: `<span class="destination-map-marker"><span class="destination-map-marker__dot"></span><span class="destination-map-marker__label">${name}</span></span>`,
    iconSize: [34, 54],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

interface DestinationsMapProps {
  onSelectDestination?: (destinationName: string, count?: number) => void;
  properties?: any[];
  units?: any[];
}

export default function DestinationsMap({
  onSelectDestination,
  properties = [],
  units = [],
}: DestinationsMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const onSelectDestinationRef = useRef(onSelectDestination);

  useEffect(() => {
    onSelectDestinationRef.current = onSelectDestination;
  }, [onSelectDestination]);

  // Initialize Map Once
  useEffect(() => {
    if (!containerRef.current) return;

    const el = containerRef.current as HTMLDivElement & { _leaflet_id?: number | null };

    // Clean up existing map instance or stale Leaflet ID to avoid "Map container is being reused"
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
    if (el._leaflet_id) {
      el._leaflet_id = null;
    }

    const map = L.map(el, {
      center: [11.5, 121.8],
      zoom: 5.5,
      minZoom: 5,
      maxZoom: 12,
      maxBounds: philippinesBounds,
      scrollWheelZoom: false,
    });
    mapInstanceRef.current = map;

    L.tileLayer("https://tile.openstreetmap.de/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const layerGroup = L.layerGroup().addTo(map);
    markersLayerRef.current = layerGroup;

    // Delegate click events on the map container
    const handleContainerClick = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest<HTMLElement>("[data-destination]");
      if (target) {
        e.preventDefault();
        e.stopPropagation();
        const destination = target.getAttribute("data-destination");
        const countAttr = target.getAttribute("data-count");
        const count = countAttr ? parseInt(countAttr, 10) : undefined;
        if (destination) {
          if (onSelectDestinationRef.current) {
            onSelectDestinationRef.current(destination, count);
          }
        }
      }
    };

    el.addEventListener("click", handleContainerClick);

    return () => {
      el.removeEventListener("click", handleContainerClick);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (el && el._leaflet_id) {
        el._leaflet_id = null;
      }
    };
  }, []);

  // Update Markers when properties / units change
  useEffect(() => {
    const layer = markersLayerRef.current;
    if (!layer) return;

    layer.clearLayers();

    const getListingCount = (destName: string) => {
      const q = destName.toLowerCase();
      const propMatches = (properties || []).filter((p: any) => {
        // Exclude condo building wrappers to avoid double-counting
        const isCondoBuilding = String(p.type || "").toLowerCase() === "condominium" || String(p.type || "").toLowerCase() === "building";
        if (isCondoBuilding) return false;
        const str = `${p.name || ""} ${p.location || ""} ${p.city || ""} ${p.province || ""} ${p.address || ""}`.toLowerCase();
        return str.includes(q);
      }).length;
      const unitMatches = (units || []).filter((u: any) => {
        const parent = (properties || []).find((p: any) => p.id === (u.propertyId || u.property_id));
        const str = `${u.unitNumber || ""} ${u.address || ""} ${u.location || ""} ${parent?.name || ""} ${parent?.location || ""} ${parent?.city || ""} ${parent?.province || ""}`.toLowerCase();
        return str.includes(q);
      }).length;
      return propMatches + unitMatches;
    };

    destinations.forEach((destination) => {
      const marker = L.marker(destination.coordinates, {
        icon: createDestinationIcon(destination.name),
        title: `Properties in ${destination.name}`,
        alt: `Properties in ${destination.name}`,
      });

      const count = getListingCount(destination.name);

      const actionHtml =
        count > 0
          ? `
            <div style="margin-top: 8px;">
              <span style="display:inline-block; font-size:11px; font-weight:600; color:#16a34a; margin-bottom: 4px;">
                ${count} rental ${count === 1 ? "listing" : "listings"} available
              </span>
              <br />
              <button type="button" class="destination-view-btn" data-destination="${destination.name}" data-count="${count}" style="display: inline-flex; align-items: center; gap: 4px; color: #2563eb; font-size: 13px; font-weight: 700; text-decoration: underline; cursor: pointer; background: transparent; border: none; padding: 0;">
                View properties (${count}) &rarr;
              </button>
            </div>
          `
          : `
            <div style="margin-top: 8px;">
              <span style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#64748b; background:#f1f5f9; padding:4px 8px; border-radius:6px; font-weight:500;">
                No properties available yet
              </span>
            </div>
          `;

      marker.bindPopup(`
        <div class="destination-map-popup" style="padding: 2px 0;">
          <strong style="font-size: 15px; font-weight: 700; color: #0f172a;">${destination.name}</strong>
          <span style="font-size: 12px; color: #64748b;">${destination.region}</span>
          ${actionHtml}
        </div>
      `);

      marker.addTo(layer);
    });
  }, [properties, units]);

  return (
    <div
      ref={containerRef}
      className="destinations-map h-full w-full"
      aria-label="Interactive map of the Philippines"
    />
  );
}
