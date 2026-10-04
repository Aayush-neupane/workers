import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Satellite, Map as MapIcon, X, Check } from "lucide-react";
import { Button } from "./ui";
import { DAMAK_CENTER, roundPin, searchPlaces, reverseLabel, type Pin, type SearchHit } from "../lib/geo";

function pineIcon(): L.DivIcon {
  return L.divIcon({
    className: "",
    html: `<svg width="32" height="42" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M13 1C6.4 1 1 6.3 1 12.8 1 21.5 13 33 13 33s12-11.5 12-20.2C25 6.3 19.6 1 13 1z" fill="#0a2015" stroke="#f5c445" stroke-width="1.5"/><circle cx="13" cy="12.5" r="4.5" fill="#f5c445"/></svg>`,
    iconSize: [32, 42],
    iconAnchor: [16, 40],
  });
}

const ICON = pineIcon();

function ClickToMove({ onPick }: { onPick: (p: Pin) => void }) {
  useMapEvents({
    click(e) {
      onPick(roundPin({ lat: e.latlng.lat, lng: e.latlng.lng }));
    },
  });
  return null;
}

function Recenter({ pos }: { pos: Pin }) {
  const map = useMap();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 15));
  }, [map, pos]);
  return null;
}

/**
 * Damak pin picker in a dialog: tap or drag the pin, or search a place
 * (biased to Damak). Confirm hands the pin back — the address text stays
 * the source of truth, the pin is a dispatch aid.
 */
export function MapPicker({ initial, onConfirm, onClose }: {
  initial: Pin | null;
  onConfirm: (p: Pin, label: string) => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<Pin>(initial ?? DAMAK_CENTER);
  const [layer, setLayer] = useState<"streets" | "satellite">("streets");
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [label, setLabel] = useState("");

  // Live reverse label, debounced.
  useEffect(() => {
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setLabel(await reverseLabel(pos, ctrl.signal));
      } catch {
        setLabel("");
      }
    }, 600);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [pos]);

  // Debounced Damak-biased search.
  useEffect(() => {
    const term = q.trim();
    if (term.length < 3) {
      setHits([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = window.setTimeout(async () => {
      try {
        setHits(await searchPlaces(term, ctrl.signal));
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 500);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  function pickHit(h: SearchHit) {
    setPos(roundPin({ lat: Number(h.lat), lng: Number(h.lon) }));
    setHits([]);
    setQ("");
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-3 sm:p-6" role="dialog" aria-label="Pick location on map" aria-modal="true">
      <div className="absolute inset-0 bg-pine-950/70" onClick={onClose} aria-hidden="true" />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-2 border-b border-outline/60 px-4 py-3">
          <p className="font-extrabold">Pin your location — Damak</p>
          <button onClick={onClose} aria-label="Close map" className="rounded-md p-1.5 hover:bg-surface-container">
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-2 px-4 pt-3">
          <div className="flex flex-1 items-center gap-2 rounded-md border border-outline px-3 py-2">
            <Search size={16} aria-hidden="true" className="shrink-0 text-on-surface-variant" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search a place in Damak…"
              aria-label="Search places"
              className="w-full bg-transparent text-sm outline-none"
            />
            {searching && <span className="text-xs text-on-surface-variant">…</span>}
          </div>
          <div className="flex rounded-md border border-outline p-0.5 text-xs font-bold" role="group" aria-label="Map layer">
            <button onClick={() => setLayer("streets")}
              className={`flex items-center gap-1 rounded px-2.5 py-1.5 ${layer === "streets" ? "bg-pine-950 text-white" : "text-on-surface-variant"}`}>
              <MapIcon size={13} aria-hidden="true" /> Streets
            </button>
            <button onClick={() => setLayer("satellite")}
              className={`flex items-center gap-1 rounded px-2.5 py-1.5 ${layer === "satellite" ? "bg-pine-950 text-white" : "text-on-surface-variant"}`}>
              <Satellite size={13} aria-hidden="true" /> Satellite
            </button>
          </div>
        </div>
        {hits.length > 0 && (
          <ul className="mx-4 mt-2 overflow-hidden rounded-md border border-outline" aria-label="Search results">
            {hits.map((h) => (
              <li key={h.place_id}>
                <button onClick={() => pickHit(h)} className="block w-full truncate px-3 py-2 text-left text-sm hover:bg-surface-container">
                  {h.display_name}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="m-4 overflow-hidden rounded-lg border border-outline" style={{ height: 320 }}>
          <MapContainer center={[pos.lat, pos.lng]} zoom={15} style={{ height: "100%", width: "100%" }} scrollWheelZoom={false}>
            {layer === "streets" ? (
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
            ) : (
              <TileLayer attribution="Imagery &copy; Esri"
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
            )}
            <Marker position={[pos.lat, pos.lng]} icon={ICON} draggable
              eventHandlers={{ dragend: (e) => {
                const m = e.target as L.Marker;
                const ll = m.getLatLng();
                setPos(roundPin({ lat: ll.lat, lng: ll.lng }));
              } }} />
            <ClickToMove onPick={setPos} />
            <Recenter pos={pos} />
          </MapContainer>
        </div>
        <div className="border-t border-outline/60 px-4 py-3">
          <p className="truncate text-xs text-on-surface-variant" aria-live="polite">
            {label || `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`} · tap or drag the pin
          </p>
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={() => onConfirm(pos, label)}>
              <Check size={15} aria-hidden="true" /> Use this pin
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
