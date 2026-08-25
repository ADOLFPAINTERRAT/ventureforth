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
import { useHeading } from "@/lib/use-heading";

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

      {/* top strip */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[500] p-3">
        <div className="panel pointer-events-auto flex items-center justify-between gap-3 rounded-xl px-3 py-2">
          <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Field log
          </span>
          <span className="flex items-center gap-1.5 text-[10px] tracking-[0.18em] text-muted-foreground">
            <span
              className={
                fixAge < 8
                  ? "h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]"
                  : "h-1.5 w-1.5 rounded-full bg-destructive"
              }
            />
            GPS {accuracy !== null ? `±${Math.round(accuracy)} m` : "—"}
          </span>
        </div>
      </div>

      {/* distance + compass, top centre */}
      <div className="pointer-events-none absolute inset-x-0 top-[4.6rem] z-[500] flex flex-col items-center gap-2">
        {arrived ? (
          <div className="panel rounded-xl px-5 py-3 text-center">
            <p className="text-base font-bold tracking-[0.2em] text-accent">YOU MADE IT</p>
            <p className="mt-1 text-[10px] tracking-wider text-muted-foreground">
              Have a look around before you head back.
            </p>
          </div>
        ) : (
          <div className="panel flex items-center gap-3 rounded-xl px-4 py-2.5">
            <Compass
              className="h-6 w-6 shrink-0 text-accent transition-transform duration-300"
              style={{ transform: `rotate(${bearing}deg)` }}
            />
            <div className="leading-none">
              <p className="coord-num text-lg">{formatDistance(dist)}</p>
              <p className="mt-1 text-[9px] tracking-[0.2em] text-muted-foreground">
                {compassLabel(bearing)} · ~{walkMinutes(dist)} MIN WALK
              </p>
            </div>
          </div>
        )}
      </div>

      {/* controls, thumb side */}
      <div className="absolute bottom-56 right-3 z-[500] flex flex-col gap-2">
        <button className="ctrl" aria-label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
          <Plus className="h-4 w-4" />
        </button>
        <button className="ctrl" aria-label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
          <Minus className="h-4 w-4" />
        </button>
        <button
          className="ctrl"
          aria-label="Recenter on me"
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
          onClick={() => setShowGrid((v) => !v)}
        >
          <Grid3x3 className={showGrid ? "h-4 w-4 text-accent" : "h-4 w-4 opacity-40"} />
        </button>
        <button
          className="ctrl"
          aria-label="Show the whole route"
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

      {/* coordinate console */}
      <div className="absolute inset-x-0 bottom-0 z-[500] p-3">
        <div className="panel rounded-2xl p-4">
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              Where you are
            </p>
            <p className="text-[11px] tracking-[0.2em] text-accent">SECTOR {sectorCode(player)}</p>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <Coord axis="X" value={pc.x} />
            <Coord axis="Z" value={pc.z} />
          </div>

          <div className="ticks mt-4 h-1.5 rounded-full opacity-60" aria-hidden />

          <div className="mt-3 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                The ✕ you&apos;re walking to
              </p>
              <p className="coord-num mt-1 text-sm text-accent">
                X {group(dc.x)} · Z {group(dc.z)}
              </p>
            </div>
            <button
              onClick={end}
              className="shrink-0 rounded-lg border border-border px-3 py-2 text-[10px] tracking-[0.18em] text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive"
            >
              <XIcon className="mr-1 inline h-3 w-3" />
              GIVE UP
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function group(n: number) {
  const s = Math.abs(n).toString();
  const grouped = s.replace(/\B(?=(\d{3})+(?!\d))/g, "\u2009");
  return (n < 0 ? "−" : "") + grouped;
}

function Coord({ axis, value }: { axis: string; value: number }) {
  return (
    <div className="rounded-xl border border-border/70 bg-secondary/40 px-3 py-2">
      <p className="text-[10px] tracking-[0.3em] text-accent">{axis}</p>
      <p className="coord-num mt-0.5 text-[clamp(1.5rem,7vw,2.25rem)] leading-none">
        {group(value)}
      </p>
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
    <main className="relative grid min-h-[100dvh] place-items-center overflow-hidden bg-background px-5 py-10 text-foreground">
      <div
        aria-hidden
        className="absolute inset-0 opacity-50"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.8 0.15 78 / .12) 1px, transparent 1px), linear-gradient(90deg, oklch(0.8 0.15 78 / .12) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          maskImage: "radial-gradient(circle at 50% 40%, black, transparent 78%)",
        }}
      />
      <div className="relative z-10 w-full max-w-sm">
        <p className="text-[10px] uppercase tracking-[0.35em] text-accent">Today</p>
        <h1 className="mt-3 text-[1.65rem] font-bold leading-snug">
          There&apos;s a spot near you
          <br />
          you&apos;ve never stood on.
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
          No landmark, no prize. Just a mark on the map somewhere between two and seven kilometres
          away, and the walk it takes to get there.
        </p>

        <div className="panel mt-7 rounded-2xl p-4">
          <div className="flex items-center justify-between text-[11px] tracking-[0.18em] text-muted-foreground">
            <span>DISTANCE</span>
            <span className="coord-num text-sm text-foreground">2–7 KM</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] tracking-[0.18em] text-muted-foreground">
            <span>DESTINATION</span>
            <span className="coord-num text-sm text-accent">UNKNOWN</span>
          </div>
          <div className="ticks mt-4 h-1.5 rounded-full opacity-60" aria-hidden />
          <button
            onClick={onBegin}
            disabled={loading}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3.5 text-xs font-bold tracking-[0.22em] text-primary-foreground transition-transform hover:brightness-110 active:translate-y-px disabled:opacity-70"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "FINDING YOU…" : "GIVE ME A PLACE"}
          </button>
        </div>

        {error && <p className="mt-4 text-[11px] leading-snug text-destructive">{error}</p>}
        <p className="mt-5 text-[10px] leading-relaxed tracking-wide text-muted-foreground">
          We need your location to drop you on the map. Nothing leaves your phone.
        </p>
      </div>
    </main>
  );
}

