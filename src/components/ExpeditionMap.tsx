import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { LatLng } from "@/lib/expedition";
import { ARRIVAL_RADIUS, REVEAL_RADIUS, destinationFrom } from "@/lib/expedition";

type Props = {
  player: LatLng;
  heading: number | null;
  destination: LatLng | null;
  /** destination is only drawn once the player has uncovered that patch of map */
  destinationVisible: boolean;
  /** everywhere the player has physically been this expedition */
  trail: LatLng[];
  arrived: boolean;
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
        <div class="player-aura" style="position:absolute;width:120px;height:120px;border-radius:50%;opacity:0;"></div>
        <div class="player-arrow" style="position:absolute;inset:0;transition:transform .1s linear;opacity:0;">
          <div style="position:absolute;left:50%;top:-1px;translate:-50% 0;width:0;height:0;
            border-left:8px solid transparent;border-right:8px solid transparent;
            border-bottom:14px solid oklch(0.86 0.15 78);
            filter:drop-shadow(0 0 6px oklch(0.8 0.15 78 / .7));"></div>
        </div>
        <div style="position:absolute;width:44px;height:44px;border-radius:50%;
          border:1px solid oklch(0.86 0.15 78 / .35);"></div>
        <div style="width:18px;height:18px;border-radius:50%;background:oklch(0.96 0.02 90);
          border:3px solid oklch(0.8 0.15 78);
          box-shadow:0 0 0 5px oklch(0.8 0.15 78 / .16),0 0 18px oklch(0.8 0.15 78 / .55);"></div>
      </div>`,
  });
}

const destIcon = L.divIcon({
  className: "",
  iconSize: [64, 64],
  iconAnchor: [32, 32],
  html: `
    <div style="width:64px;height:64px;display:grid;place-items:center;">
      <svg width="58" height="58" viewBox="0 0 60 60">
        <g stroke="oklch(0.7 0.2 35)" stroke-width="6" stroke-linecap="round"
           style="filter:drop-shadow(0 0 7px oklch(0.65 0.2 35 / .8));">
          <path d="M14 12 Q31 30 46 48" fill="none"/>
          <path d="M47 13 Q29 31 13 46" fill="none"/>
        </g>
      </svg>
    </div>`,
});

/** metres → screen pixels at the map's current centre/zoom */
function metresToPixels(map: L.Map, metres: number) {
  const c = map.getCenter();
  const a = map.latLngToContainerPoint(c);
  const east = destinationFrom({ lat: c.lat, lng: c.lng }, 90, metres);
  const b = map.latLngToContainerPoint(L.latLng(east.lat, east.lng));
  return Math.max(1, Math.abs(b.x - a.x));
}

export default function ExpeditionMap({
  player,
  heading,
  destination,
  destinationVisible,
  trail,
  arrived,
  follow,
  onUserPan,
  onMapReady,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fogRef = useRef<HTMLCanvasElement>(null);
  const gridRef = useRef<HTMLCanvasElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const playerRef = useRef<L.Marker | null>(null);
  const destRef = useRef<L.Marker | null>(null);
  const ringRef = useRef<L.Circle | null>(null);
  const lineRef = useRef<L.Polyline | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);

  const programmatic = useRef(false);
  const [ready, setReady] = useState(false);
  const [, setTick] = useState(0);

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

    const redraw = () => setTick((t) => t + 1);
    map.on("move zoom viewreset resize moveend zoomend", redraw);

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

  // player position + destination overlays
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const ll = L.latLng(player.lat, player.lng);
    playerRef.current?.setLatLng(ll);

    if (destination && destinationVisible) {
      const dll = L.latLng(destination.lat, destination.lng);
      if (!destRef.current) {
        destRef.current = L.marker(dll, { icon: destIcon, interactive: false }).addTo(map);
        ringRef.current = L.circle(dll, {
          radius: ARRIVAL_RADIUS,
          color: "oklch(0.72 0.2 35)",
          weight: 1,
          fillColor: "oklch(0.72 0.2 35)",
          fillOpacity: 0.1,
        }).addTo(map);
        lineRef.current = L.polyline([ll, dll], {
          color: "oklch(0.8 0.15 78)",
          weight: 1.5,
          dashArray: "2 9",
          opacity: 0.55,
        }).addTo(map);
      }
      destRef.current.setLatLng(dll);
      ringRef.current?.setLatLng(dll);
      lineRef.current?.setLatLngs([ll, dll]);
    } else {
      destRef.current?.remove();
      ringRef.current?.remove();
      lineRef.current?.remove();
      destRef.current = null;
      ringRef.current = null;
      lineRef.current = null;
    }

    if (follow) {
      programmatic.current = true;
      map.panTo(ll, { animate: true });
      setTimeout(() => (programmatic.current = false), 400);
    }
  }, [player, destination, destinationVisible, follow, ready]);

  // heading arrow + arrival aura
  useEffect(() => {
    const root = playerRef.current?.getElement();
    const el = root?.querySelector<HTMLElement>(".player-arrow");
    if (el) {
      if (heading === null) el.style.opacity = "0";
      else {
        el.style.opacity = "1";
        el.style.transform = `rotate(${heading}deg)`;
      }
    }
    const aura = root?.querySelector<HTMLElement>(".player-aura");
    if (aura) aura.classList.toggle("is-on", arrived);
  }, [heading, player, arrived, ready]);

  // ── fog of war ─────────────────────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const cv = fogRef.current;
    if (!map || !cv) return;
    const size = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = `${size.x}px`;
    cv.style.height = `${size.y}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);
    ctx.fillStyle = "rgba(8, 12, 20, 0.965)";
    ctx.fillRect(0, 0, size.x, size.y);

    const r = metresToPixels(map, REVEAL_RADIUS);
    const pts = (trail.length ? trail : [player]).map((p) =>
      map.latLngToContainerPoint(L.latLng(p.lat, p.lng)),
    );

    ctx.globalCompositeOperation = "destination-out";
    // continuous trail between fixes
    ctx.lineWidth = r * 1.6;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "rgba(0,0,0,1)";
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    if (pts.length > 1) ctx.stroke();
    // soft-edged discs
    for (const p of pts) {
      const g = ctx.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r);
      g.addColorStop(0, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  });

  // ── square grid (drawn under the fog) ──────────────────────
  useEffect(() => {
    const map = mapRef.current;
    const cv = gridRef.current;
    if (!map || !cv || !ready) return;
    const size = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = size.x * dpr;
    cv.height = size.y * dpr;
    cv.style.width = `${size.x}px`;
    cv.style.height = `${size.y}px`;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.x, size.y);

    // Grid lines sit on whole X/Z game coordinates (1 unit = 1 metre).
    // Pick the smallest step that keeps cells at least ~40px on screen,
    // so zooming in reveals smaller and smaller squares.
    const mpp = REVEAL_RADIUS / metresToPixels(map, REVEAL_RADIUS);
    const steps = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000];
    const step = steps.find((s) => s / mpp >= 40) ?? 10000;

    // Use unwrapped coordinate space (gameCoords wraps at 100000, but every
    // step divides 100000 evenly, so raw lines align with the HUD readout).
    const b = map.getBounds();
    const cosLatB = Math.cos((b.getNorth() * Math.PI) / 180);
    const xMin = b.getWest() * 111320 * cosLatB - step;
    const xMax = b.getEast() * 111320 * cosLatB + step;
    const zMin = -b.getNorth() * 110540 - step;
    const zMax = -b.getSouth() * 110540 + step;

    const cLat = map.getCenter().lat;
    const cLng = map.getCenter().lng;
    const cosLat = Math.cos((cLat * Math.PI) / 180);
    const pxForX = (x: number) =>
      map.latLngToContainerPoint(L.latLng(cLat, x / (111320 * cosLat))).x;
    const pyForZ = (z: number) =>
      map.latLngToContainerPoint(L.latLng(-z / 110540, cLng)).y;

    ctx.strokeStyle = "rgba(235, 205, 150, 0.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
      const px = Math.round(pxForX(x)) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, size.y);
    }
    for (let z = Math.ceil(zMin / step) * step; z <= zMax; z += step) {
      const py = Math.round(pyForZ(z)) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(size.x, py);
    }
    ctx.stroke();
  });

  // ── subtle travelled-path trail ────────────────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const pts = [...trail, player].map((p) => L.latLng(p.lat, p.lng));
    if (pts.length < 2) {
      trailRef.current?.remove();
      trailRef.current = null;
      return;
    }
    if (!trailRef.current) {
      trailRef.current = L.polyline(pts, {
        color: "oklch(0.86 0.06 85)",
        weight: 1.25,
        opacity: 0.35,
        interactive: false,
      }).addTo(map);
      trailRef.current.bringToFront();
    } else {
      trailRef.current.setLatLngs(pts);
    }
  }, [trail, player, ready]);

  return (
    <div className="absolute inset-0">
      <div ref={containerRef} className="absolute inset-0 h-full w-full" />
      <canvas ref={gridRef} aria-hidden className="pointer-events-none absolute inset-0 z-[400]" />
      <canvas ref={fogRef} aria-hidden className="pointer-events-none absolute inset-0 z-[401]" />
      <div className="map-tint" aria-hidden />
    </div>
  );
}
