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

export default function DestinationsMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

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

    destinations.forEach((destination) => {
      const marker = L.marker(destination.coordinates, {
        icon: createDestinationIcon(destination.name),
        title: `View properties in ${destination.name}`,
        alt: `Properties in ${destination.name}`,
      }).addTo(map);

      marker.bindPopup(`
        <div class="destination-map-popup">
          <strong>${destination.name}</strong>
          <span>${destination.region}</span>
          <a href="#properties">View properties</a>
        </div>
      `);
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (el && el._leaflet_id) {
        el._leaflet_id = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="destinations-map h-full w-full"
      aria-label="Interactive map of the Philippines"
    />
  );
}
