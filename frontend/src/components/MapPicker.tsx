import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Search, Satellite, Map as MapIcon, X, Check, Crosshair } from "lucide-react";
import { Button } from "./ui";
import { DAMAK_CENTER, DAMAK_BBOX, inDamak, roundPin, searchPlaces, reverseLabel, type Pin, type SearchHit } from "../lib/geo";

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
  useEffect(() => {
    map.setView([pos.lat, pos.lng], Math.max(map.getZoom(), 15));
  }, [map, pos]);
  return null;
}

/**
 * Damak pin picker: search a place, tap the map, or drag the pin —
 * streets and satellite layers, live address label, confirm hands the pin
 * back. The address text stays the source of truth; the pin is a dispatch aid.
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
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [pinError, setPinError] = useState("");
  const coords = `${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  // Live address label for the pin (debounced reverse-geocode).
  useEffect(() => {
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        const text = await reverseLabel(pos, ctrl.signal);
        if (mounted.current) setLabel(text);
      } catch {
        if (mounted.current) setLabel("");
      }
    }, 600);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [pos]);

  // Place search (debounced, Damak-biased, Nepal-only).
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
        const found = await searchPlaces(term, ctrl.signal);
        if (mounted.current) setHits(found);
      } catch {
        if (mounted.current) setHits([]);
      } finally {
        if (mounted.current) setSearching(false);
      }
    }, 500);
    return () => {
      ctrl.abort();
      window.clearTimeout(t);
    };
  }, [q]);

  function locateMe() {
    setLocError("");
    if (!("geolocation" in navigator)) {
      setLocError("This device has no location service — drag the pin instead.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (g) => {
        if (!mounted.current) return;
        setLocating(false);
        const p = roundPin({ lat: g.coords.latitude, lng: g.coords.longitude });
        if (!inDamak(p)) {
          setLocError("You're outside Damak — drag the pin to the job site inside wards 1–10.");
          return;
        }
        setPos(p);
      },
      () => {
        if (!mounted.current) return;
        setLocating(false);
        setLocError("Location blocked — allow access or drag the pin instead.");
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-pine-950/60 p-3 sm:p-4" role="dialog" aria-label="Pick location on map" aria-modal="true">
      <div className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-outline/60 px-5 py-3.5">
          <div>
            <p className="font-display text-xl font-semibold">Pin the job spot</p>
            <p className="text-xs text-on-surface-variant">Search, tap, or drag — Damak wards 1–10.</p>
          </div>
          <button onClick={onClose} aria-label="Close map" className="rounded-md p-1.5 text-xl leading-none hover:bg-surface-container">×</button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-outline/60 px-5 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-outline px-3 py-2">
            <Search size={16} aria-hidden="true" className="shrink-0 text-on-surface-variant" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search places in Damak…"
              aria-label="Search places"
              className="w-full min-w-0 bg-transparent text-sm outline-none"
            />
          </div>
          <div className="flex shrink-0 rounded-md border border-outline p-0.5 text-xs font-bold" role="group" aria-label="Map layer">
            <button onClick={() => setLayer("streets")}
              className={`flex items-center gap-1 rounded px-2.5 py-1.5 ${layer === "streets" ? "bg-pine-950 text-white" : "text-on-surface-variant"}`}>
              <MapIcon size={13} aria-hidden="true" /> Map
            </button>
            <button onClick={() => setLayer("satellite")}
              className={`flex items-center gap-1 rounded px-2.5 py-1.5 ${layer === "satellite" ? "bg-pine-950 text-white" : "text-on-surface-variant"}`}>
              <Satellite size={13} aria-hidden="true" /> Satellite
            </button>
          </div>
          <button onClick={locateMe} disabled={locating}
            className="flex shrink-0 items-center gap-1.5 rounded-md border border-outline px-3 py-2 text-xs font-extrabold transition hover:border-primary disabled:opacity-50">
            <Crosshair size={14} aria-hidden="true" /> {locating ? "Locating…" : "Locate me"}
          </button>
        </div>
        {locError && <p role="alert" className="border-b border-outline/60 px-5 py-1.5 text-xs font-medium text-error">{locError}</p>}

        {searching ? (
          <p className="border-b border-outline/60 px-5 py-1.5 text-[11px] font-bold tracking-[0.14em] text-on-surface-variant uppercase">Searching…</p>
        ) : hits.length > 0 ? (
          <ul className="max-h-36 divide-y divide-outline/60 overflow-y-auto border-b border-outline/60" aria-label="Search results">
            {hits.map((h) => (
              <li key={h.place_id}>
                <button
                  onClick={() => {
                    setPos(roundPin({ lat: Number(h.lat), lng: Number(h.lon) }));
                    setHits([]);
                    setQ("");
                  }}
                  className="block w-full truncate px-5 py-2.5 text-left text-sm hover:bg-surface-container"
                >
                  {h.display_name.split(",").slice(0, 3).join(",")}
                </button>
              </li>
            ))}
          </ul>
        ) : q.trim().length >= 3 ? (
          <p className="border-b border-outline/60 px-5 py-2 text-xs text-on-surface-variant">
            Nothing found in Damak — try a nearby landmark, or drag the pin.
          </p>
        ) : null}

        <MapContainer center={[pos.lat, pos.lng]} zoom={15} scrollWheelZoom
          className="isolate"
          style={{ height: 320, width: "100%", zIndex: 0 }}
          minZoom={12}
          maxBounds={[[DAMAK_BBOX.minLat, DAMAK_BBOX.minLng], [DAMAK_BBOX.maxLat, DAMAK_BBOX.maxLng]]}
          maxBoundsViscosity={1.0}
        >
          {layer === "streets" ? (
            <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
          ) : (
            <TileLayer attribution="Imagery &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
          )}
          <ClickToMove onPick={setPos} />
          <Recenter pos={pos} />
          <Marker
            position={[pos.lat, pos.lng]}
            icon={ICON}
            draggable
            eventHandlers={{ dragend: (e) => {
              const m = e.target as L.Marker;
              const ll = m.getLatLng();
              setPos(roundPin({ lat: ll.lat, lng: ll.lng }));
            } }}
          />
        </MapContainer>

        <div className="border-t border-outline/60 px-5 py-2.5">
          <p className="font-mono text-xs tabular-nums">{coords}</p>
          {label ? <p className="mt-0.5 truncate text-xs text-on-surface-variant">{label.split(",").slice(0, 3).join(",")}</p> : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline/60 px-5 py-3.5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => {
            if (!inDamak(pos)) {
              setPinError("That spot is outside Damak — drag the pin back inside wards 1–10.");
              return;
            }
            onConfirm(pos, label);
          }}>Use this spot</Button>
        </div>
        {pinError && <p role="alert" className="border-t border-outline/60 px-5 py-2 text-xs font-medium text-error">{pinError}</p>}
      </div>
    </div>
  );
}
