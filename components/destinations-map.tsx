"use client";

import { divIcon } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";

import "leaflet/dist/leaflet.css";

const philippinesBounds: [[number, number], [number, number]] = [
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
  return divIcon({
    className: "destination-map-marker-shell",
    html: `<span class="destination-map-marker"><span class="destination-map-marker__dot"></span><span class="destination-map-marker__label">${name}</span></span>`,
    iconSize: [34, 54],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

export default function DestinationsMap() {
  return (
    <MapContainer
      center={[11.5, 121.8]}
      zoom={5.5}
      minZoom={5}
      maxZoom={12}
      maxBounds={philippinesBounds}
      scrollWheelZoom={false}
      className="destinations-map h-full w-full"
      aria-label="Interactive map of the Philippines"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.de/{z}/{x}/{y}.png"
      />
      {destinations.map((destination) => (
        <Marker
          key={destination.name}
          position={destination.coordinates}
          icon={createDestinationIcon(destination.name)}
          title={`View properties in ${destination.name}`}
          alt={`Properties in ${destination.name}`}
        >
          <Popup>
            <div className="destination-map-popup">
              <strong>{destination.name}</strong>
              <span>{destination.region}</span>
              <a href="#properties">View properties</a>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
