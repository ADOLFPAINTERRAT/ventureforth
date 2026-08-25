import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type L from "leaflet";
import { Compass, Crosshair, Grid3x3, Minus, Plus, Flag, X as XIcon, Loader2 } from "lucide-react";
import {
  ARRIVAL_RADIUS,
  bearingDegrees,
  compassLabel,
  distanceMeters,
  formatDistance,
  gameCoords,
  rollDestination,
  type LatLng,
} from "@/lib/expedition";

const ExpeditionMap = lazy(() => import("@/components/ExpeditionMap"));

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Expedition — Real-World Exploration Game" },
      {
        name: "description",
        content:
          "Turn your city into a game map. Get a mystery destination 2–7 km away, track it live on a game-style map and go find it.",
      },
      { property: "og:title", content: "Expedition — Real-World Exploration Game" },
      {
        property: "og:description",
        content:
          "A mystery destination, a game map grid and your live GPS position. Go outside and explore.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Phase = "start" | "locating" | "active";

function Index() {
  const [phase, setPhase] = useState<Phase>("start");
  const [player, setPlayer] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [fixAge, setFixAge] = useState(0);
  const { heading, source: headingSource, begin: startCompass, pushGps } = useHeading();
  const [destination, setDestination] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [follow, setFollow] = useState(true);
  const mapRef = useRef<L.Map | null>(null);
  const watchRef = useRef<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRef = useRef<LatLng | null>(null);
  const lastFixRef = useRef<number>(Date.now());

  const stopTracking = useCallback(() => {
    if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
    watchRef.current = null;
    if (pollRef.current !== null) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  useEffect(() => () => stopTracking(), [stopTracking]);

  // "seconds since last GPS fix" indicator
  useEffect(() => {
    if (phase !== "active") return;
    const id = setInterval(() => setFixAge(Math.round((Date.now() - lastFixRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, [phase]);

  const begin = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("This device has no GPS support.");
      return;
    }
    setError(null);
    setPhase("locating");
    startCompass(); // must happen inside the tap gesture (iOS permission)

    const onFix = (p: GeolocationPosition) => {
      const next = { lat: p.coords.latitude, lng: p.coords.longitude };
      lastFixRef.current = Date.now();
      setAccuracy(p.coords.accuracy ?? null);
      const moved = prevRef.current ? distanceMeters(prevRef.current, next) : 0;
      if (p.coords.heading !== null && !Number.isNaN(p.coords.heading) && (p.coords.speed ?? 0) > 0.5) {
        pushGps(p.coords.heading);
      } else if (prevRef.current && moved > 3) {
        pushGps(bearingDegrees(prevRef.current, next));
      }
      if (!prevRef.current || moved > 0.5) {
        prevRef.current = next;
        setPlayer(next);
      }
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        prevRef.current = here;
        lastFixRef.current = Date.now();
        setPlayer(here);
        setAccuracy(pos.coords.accuracy ?? null);
        setDestination(rollDestination(here));
        setPhase("active");
        watchRef.current = navigator.geolocation.watchPosition(onFix, () => {}, {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 30000,
        });
        // some browsers throttle watchPosition heavily — poll as a safety net
        pollRef.current = setInterval(() => {
          navigator.geolocation.getCurrentPosition(onFix, () => {}, {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000,
          });
        }, 3000);
      },
      (err) => {
        setPhase("start");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied. Enable it to start an expedition."
            : "Could not get your position. Try again outdoors.",
        );
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  }, [pushGps, startCompass]);

  const end = useCallback(() => {
    stopTracking();
    prevRef.current = null;
    setDestination(null);
    setPlayer(null);
    setAccuracy(null);
    setPhase("start");
  }, [stopTracking]);



  if (phase !== "active" || !player || !destination) {
    return <StartScreen onBegin={begin} loading={phase === "locating"} error={error} />;
  }

  const dist = distanceMeters(player, destination);
  const bearing = bearingDegrees(player, destination);
  const arrived = dist <= ARRIVAL_RADIUS;
  const pc = gameCoords(player);
  const dc = gameCoords(destination);

  return (
    <main className="relative h-[100dvh] w-full overflow-hidden bg-background text-foreground">
      <Suspense fallback={<div className="absolute inset-0 bg-background" />}>
        <ExpeditionMap
          player={player}
          heading={heading}
          destination={destination}
          showGrid={showGrid}
          follow={follow}
          onUserPan={() => setFollow(false)}
          onMapReady={(m) => {
            mapRef.current = m;
          }}
        />
      </Suspense>

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-2 sm:p-3">
        <div className="panel pointer-events-auto flex items-center justify-between gap-3 rounded px-3 py-2 text-[10px] sm:text-xs">
          <span className="font-bold tracking-[0.2em] text-accent">EXPEDITION #001</span>
          <span className="tracking-widest text-foreground">
            X: {pc.x} <span className="text-muted-foreground">Z:</span> {pc.z}
          </span>
          <span className="hidden tracking-[0.2em] text-muted-foreground sm:inline">
            MAP: UNKNOWN TERRITORY
          </span>
        </div>
      </div>

      {/* left controls */}
      <div className="absolute left-2 top-1/2 z-[500] flex -translate-y-1/2 flex-col gap-2 sm:left-3">
        <button className="ctrl" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="h-4 w-4" />
        </button>
        <button className="ctrl" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="ctrl"
          aria-label="Recenter on player"
          onClick={() => {
            setFollow(true);
            mapRef.current?.setView([player.lat, player.lng], 16);
          }}
        >
          <Crosshair className="h-4 w-4" />
        </button>
        <button
          className="ctrl"
          aria-label="Toggle grid"
          data-active={showGrid}
          onClick={() => setShowGrid((v) => !v)}
        >
          <Grid3x3 className={showGrid ? "h-4 w-4" : "h-4 w-4 opacity-40"} />
        </button>
        <button
          className="ctrl"
          aria-label="Frame destination"
          onClick={() => {
            setFollow(false);
            mapRef.current?.fitBounds(
              [
                [player.lat, player.lng],
                [destination.lat, destination.lng],
              ],
              { padding: [70, 70] },
            );
          }}
        >
          <Flag className="h-4 w-4" />
        </button>
      </div>

      {/* compass */}
      <div className="panel absolute right-2 top-16 z-[500] grid h-14 w-14 place-items-center rounded-full sm:right-3 sm:top-20">
        <Compass
          className="h-7 w-7 text-accent transition-transform duration-300"
          style={{ transform: `rotate(${bearing}deg)` }}
        />
        <span className="absolute -bottom-5 text-[10px] tracking-widest text-muted-foreground">
          {compassLabel(bearing)}
        </span>
      </div>

      {/* distance readout */}
      <div className="pointer-events-none absolute inset-x-0 top-14 z-[500] flex justify-center sm:top-16">
        <div className="panel rounded px-4 py-2 text-center">
          {arrived ? (
            <p className="text-sm font-bold tracking-[0.25em] text-accent sm:text-base">
              DESTINATION REACHED
            </p>
          ) : (
            <>
              <p className="text-[9px] tracking-[0.25em] text-muted-foreground">
                DISTANCE TO DESTINATION
              </p>
              <p className="text-xl font-bold tracking-widest text-foreground sm:text-2xl">
                {formatDistance(dist)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* bottom panel */}
      <div className="absolute inset-x-0 bottom-0 z-[500] p-2 sm:p-3">
        <div className="panel rounded p-3">
          <p className="text-[10px] tracking-[0.25em] text-accent">TODAY&apos;S EXPEDITION</p>
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-4 sm:text-xs">
            <Row label="Destination" value="Unknown" />
            <Row label="Distance" value={formatDistance(dist)} />
            <Row label="Direction" value={compassLabel(bearing)} />
            <Row label="Status" value={arrived ? "Arrived" : "Exploring"} />
          </dl>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-2 text-[10px] tracking-widest">
            <span className="text-muted-foreground">
              ✕ X: {dc.x} Z: {dc.z}
            </span>
            <button
              onClick={end}
              className="inline-flex items-center gap-1 rounded border border-destructive/60 px-2 py-1 text-destructive transition-colors hover:bg-destructive/15"
            >
              <XIcon className="h-3 w-3" /> END EXPEDITION
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2 sm:block">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-bold text-foreground">{value}</dd>
    </div>
  );
}

function StartScreen({
  onBegin,
  loading,
  error,
}: {
  onBegin: () => void;
  loading: boolean;
  error: string | null;
}) {
  return (
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-5 text-foreground">
      <div
        aria-hidden
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.62 0.19 258 / .25) 1px, transparent 1px), linear-gradient(90deg, oklch(0.62 0.19 258 / .25) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at 50% 45%, black, transparent 75%)",
        }}
      />
      <div className="panel relative z-10 w-full max-w-sm rounded p-6 text-center">
        <p className="text-[10px] tracking-[0.35em] text-accent">TODAY&apos;S EXPEDITION</p>
        <h1 className="mt-4 text-xl font-bold leading-relaxed tracking-wide">
          Somewhere out there is a place you&apos;ve never visited.
        </h1>
        <div className="my-6 grid gap-1 text-[11px] tracking-widest text-muted-foreground">
          <p>DISTANCE: APPROXIMATELY 2–7 KM</p>
          <p>DESTINATION: UNKNOWN</p>
        </div>
        <button
          onClick={onBegin}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded border border-border bg-primary px-4 py-3 text-xs font-bold tracking-[0.25em] text-primary-foreground shadow-[var(--glow-primary)] transition-transform hover:brightness-110 active:translate-y-px disabled:opacity-70"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "LOCATING…" : "BEGIN EXPEDITION"}
        </button>
        {error && <p className="mt-4 text-[11px] leading-snug text-destructive">{error}</p>}
        <p className="mt-5 text-[10px] leading-relaxed tracking-wide text-muted-foreground">
          Location access is required to place you on the map.
        </p>
      </div>
    </main>
  );
}
