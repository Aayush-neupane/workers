import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Pin } from "../lib/geo";

export interface MapStop {
  id: string;
  label: string;
  sub: string;
  pin: Pin;
}

function stopIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13 1C6.4 1 1 6.3 1 12.8 1 21.5 13 33 13 33s12-11.5 12-20.2C25 6.3 19.6 1 13 1z" fill="#0f6b44" stroke="#fff" stroke-width="1.5"/><circle cx="13" cy="12.5" r="4.5" fill="#fff"/></svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -30],
  });
}

function meIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:18px;height:18px;border-radius:9999px;background:#b7791f;border:3px solid #fff;box-shadow:0 1px 6px rgba(0,0,0,.4)"></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });
}

const STOP = stopIcon();
const ME = meIcon();

function FitTo({ points }: { points: Pin[] }) {
  const map = useMap();
  // Refit only when the SET of points changes — never fight the user's pan/zoom.
  const key = JSON.stringify(points.map((p) => [p.lat, p.lng]));
  useEffect(() => {
    const pts = JSON.parse(key) as [number, number][];
    if (pts.length === 0) return;
    if (pts.length === 1) {
      map.setView([pts[0][0], pts[0][1]], 15);
      return;
    }
    map.fitBounds(L.latLngBounds(pts.map(([la, ln]) => [la, ln] as [number, number])), { padding: [36, 36] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, key]);
  return null;
}

/**
 * Shared job map: OSM tiles, job pins with popups, optional pro position and
 * route polyline. Non-interactive by default so embedded maps never trap
 * page scroll on touch devices.
 */
export function LiveMap({ stops, me, route, height = 300, interactive = false }: {
  stops: MapStop[];
  me?: Pin | null;
  route?: [number, number][] | null;
  height?: number;
  interactive?: boolean;
}) {
  const center: [number, number] = stops[0]
    ? [stops[0].pin.lat, stops[0].pin.lng]
    : me ? [me.lat, me.lng] : [26.655, 87.699];
  const fit: Pin[] = [
    ...stops.map((s) => s.pin),
    ...(route ? route.map(([lat, lng]) => ({ lat, lng })) : []),
    ...(me ? [me] : []),
  ];
  return (
    <figure className="isolate overflow-hidden rounded-lg border border-outline/60">
      <div style={{ height }}>
        <MapContainer center={center} zoom={14} style={{ height: "100%", width: "100%", zIndex: 0 }}
          scrollWheelZoom={interactive} dragging={interactive} zoomControl={interactive}
          doubleClickZoom={interactive} attributionControl={false} keyboard={false}>
          <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {me && (
            <Marker position={[me.lat, me.lng]} icon={ME}>
              <Popup>You are here</Popup>
            </Marker>
          )}
          {stops.map((s) => (
            <Marker key={s.id} position={[s.pin.lat, s.pin.lng]} icon={STOP}>
              <Popup><strong>{s.label}</strong><br />{s.sub}</Popup>
            </Marker>
          ))}
          {route && route.length > 1 && (
            <Polyline positions={route} pathOptions={{ color: "#0f6b44", weight: 5, opacity: 0.85 }} />
          )}
          <FitTo points={fit} />
        </MapContainer>
      </div>
      <figcaption className="bg-white px-2 py-1 text-right text-[10px] text-on-surface-variant">
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="hover:underline">OpenStreetMap</a> contributors
        {route ? " · route © OSRM" : ""}
      </figcaption>
    </figure>
  );
}
