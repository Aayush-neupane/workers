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

/** Small non-interactive job-location map. Center can be an approximate area
 *  (geocoded from the address text); the marker appears only for a real pin. */
export function MiniMap({ pin, center, zoom, height = 180, marker = true }: {
  pin: Pin;
  center?: Pin;
  zoom?: number;
  height?: number;
  marker?: boolean;
}) {
  const at = center ?? pin;
  // `isolate` traps Leaflet's high internal z-indexes inside this map so a
  // preview can never paint over dialogs (e.g. the pin picker).
  return (
    <figure className="isolate overflow-hidden rounded-lg border border-outline/60">
      <div style={{ height }}>
        <MapContainer key={`${at.lat.toFixed(5)},${at.lng.toFixed(5)}`} center={[at.lat, at.lng]} zoom={zoom ?? 16} style={{ height: "100%", width: "100%" }}
          dragging={false} scrollWheelZoom={false} doubleClickZoom={false}
          zoomControl={false} attributionControl={false} keyboard={false}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {marker && <Marker position={[pin.lat, pin.lng]} icon={ICON} interactive={false} />}
        </MapContainer>
      </div>
      <figcaption className="bg-white px-2 py-1 text-right text-[10px] text-on-surface-variant">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> contributors
      </figcaption>
    </figure>
  );
}
