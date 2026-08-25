import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { LatLng } from "@/lib/expedition";
import { ARRIVAL_RADIUS } from "@/lib/expedition";

type Props = {
  player: LatLng;
  heading: number | null;
  destination: LatLng | null;
  showGrid: boolean;
  follow: boolean;
  onUserPan: () => void;
  onMapReady: (map: L.Map) => void;
};

function playerIcon() {
  return L.divIcon({
    className: "",
    iconSize: [56, 56],
    iconAnchor: [28, 28],
    html: `
      <div style="position:relative;width:56px;height:56px;display:grid;place-items:center;">
        <div class="player-arrow" style="position:absolute;inset:0;transition:transform .12s linear;opacity:0;">
          <div style="position:absolute;left:50%;top:-2px;translate:-50% 0;width:0;height:0;
            border-left:7px solid transparent;border-right:7px solid transparent;
            border-bottom:12px solid oklch(0.72 0.19 258);"></div>
        </div>
        <div style="width:26px;height:26px;border-radius:50%;background:oklch(0.62 0.19 258);
          border:3px solid oklch(0.96 0.02 240);
          box-shadow:0 0 0 6px oklch(0.62 0.19 258 / .25),0 0 22px oklch(0.62 0.19 258 / .8);"></div>
        <div style="position:absolute;bottom:-14px;font:600 10px/1 'JetBrains Mono',monospace;
          letter-spacing:.18em;color:oklch(0.96 0.02 240);text-shadow:0 0 6px #000;">YOU</div>
      </div>`,
  });
}

const destIcon = L.divIcon({
  className: "",
  iconSize: [64, 64],
  iconAnchor: [32, 32],
  html: `
    <div style="width:64px;height:64px;display:grid;place-items:center;">
      <svg width="60" height="60" viewBox="0 0 60 60">
        <g stroke="oklch(0.85 0.17 190)" stroke-width="7" stroke-linecap="round"
           style="filter:drop-shadow(0 0 8px oklch(0.78 0.16 190));">
          <line x1="13" y1="13" x2="47" y2="47"/>
          <line x1="47" y1="13" x2="13" y2="47"/>
        </g>
      </svg>
    </div>`,
});

export default function ExpeditionMap({
  player,
  heading,
  destination,
  showGrid,
  follow,
  onUserPan,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const playerRef = useRef<L.Marker | null>(null);
  const destRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.Circle | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const programmatic = useRef(false);
  const [ready, setReady] = useState(false);
  const [grid, setGrid] = useState({ size: 128, ox: 0, oy: 0 });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: [player.lat, player.lng],
      zoom: 15,
      zoomControl: false,
      attributionControl: true,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    playerRef.current = L.marker([player.lat, player.lng], {
      icon: playerIcon(),
      zIndexOffset: 1000,
    }).addTo(map);

    const syncGrid = () => {
      const o = map.getPixelOrigin();
      const z = map.getZoom();
      const size = 96 * Math.pow(2, z - Math.floor(z));
      setGrid({ size, ox: -(o.x % size), oy: -(o.y % size) });
    };
    map.on("move zoom viewreset", syncGrid);
    syncGrid();

    map.on("dragstart", () => {
      if (!programmatic.current) onUserPan();
    });

    mapRef.current = map;
    onMapReady(map);
    setReady(true);
    setTimeout(() => map.invalidateSize(), 60);

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // player position
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ll = L.latLng(player.lat, player.lng);
    playerRef.current?.setLatLng(ll);
    if (destination) {
      const dll = L.latLng(destination.lat, destination.lng);
      if (!destRef.current) {
        destRef.current = L.marker(dll, { icon: destIcon, interactive: false }).addTo(map);
        ringRef.current = L.circle(dll, {
          radius: ARRIVAL_RADIUS,
          color: "oklch(0.85 0.17 190)",
          weight: 1,
          fillOpacity: 0.12,
        }).addTo(map);
        lineRef.current = L.polyline([ll, dll], {
          color: "oklch(0.78 0.16 190)",
          weight: 1.5,
          dashArray: "6 10",
          opacity: 0.7,
        }).addTo(map);
      }
      lineRef.current?.setLatLngs([ll, dll]);
    }
    if (follow) {
      programmatic.current = true;
      map.panTo(ll, { animate: true });
      setTimeout(() => (programmatic.current = false), 400);
    }
  }, [player, destination, follow, ready]);

  // rotate the heading arrow without rebuilding the marker (keeps it snappy)
  useEffect(() => {
    const el = playerRef.current?.getElement()?.querySelector<HTMLElement>(".player-arrow");
    if (!el) return;
    if (heading === null) {
      el.style.opacity = "0";
      return;
    }
    el.style.opacity = "1";
    el.style.transform = `rotate(${heading}deg)`;
  }, [heading, player, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      {showGrid && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[401]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(175,210,255,0.32) 1px, transparent 1px), linear-gradient(90deg, rgba(175,210,255,0.32) 1px, transparent 1px)",
            backgroundSize: `${grid.size}px ${grid.size}px`,
            backgroundPosition: `${grid.ox}px ${grid.oy}px`,
          }}
        />
      )}
      <div className="map-tint" aria-hidden />
    </div>
  );
}
