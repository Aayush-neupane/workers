import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Pin } from "../lib/geo";

function dotIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#0f6b44;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const ICON = dotIcon();

/** Small non-interactive job-location map. No marker unless a real pin exists —
 *  a fallback dot would mislead pros about the job site. */
export function MiniMap({ pin, height = 180, marker = true }: {
  pin: Pin;
  height?: number;
  marker?: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-outline/60" style={{ height }}>
      <MapContainer center={[pin.lat, pin.lng]} zoom={16} style={{ height: "100%", width: "100%" }}
        dragging={false} scrollWheelZoom={false} doubleClickZoom={false}
        zoomControl={false} attributionControl={false} keyboard={false}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        {marker && <Marker position={[pin.lat, pin.lng]} icon={ICON} interactive={false} />}
      </MapContainer>
    </div>
  );
}
