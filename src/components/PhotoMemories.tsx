import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import L from "leaflet";
import { Trash2, X as XIcon } from "lucide-react";
import type { PhotoMemory } from "@/lib/photos";

type Props = {
  map: L.Map | null;
  photos: PhotoMemory[];
  onMove: (id: string, at: { lat: number; lng: number }) => void;
  onResize: (id: string, sizeM: number) => void;
  onDelete: (photo: PhotoMemory) => void;
};

/** screen pixels per metre at the map's current zoom */
function pxPerMetre(map: L.Map) {
  const a = map.containerPointToLatLng(L.point(0, 0));
  const b = map.containerPointToLatLng(L.point(100, 0));
  const d = map.distance(a, b);
  return d > 0 ? 100 / d : 1;
}

type Drag = {
  id: string;
  mode: "move" | "resize";
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origPx: number;
  moved: boolean;
};

export default function PhotoMemories({ map, photos, onMove, onResize, onDelete }: Props) {
  const [, redraw] = useReducer((n: number) => n + 1, 0);
  const dragRef = useRef<Drag | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number; px: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!map) return;
    const fn = () => redraw();
    map.on("move zoom viewreset resize moveend zoomend", fn);
    return () => {
      map.off("move zoom viewreset resize moveend zoomend", fn);
    };
  }, [map]);

  const endDrag = useCallback(() => {
    const d = dragRef.current;
    const l = live;
    dragRef.current = null;
    setLive(null);
    map?.dragging.enable();
    if (!d || !map) return;
    if (!d.moved) {
      setOpenId(d.id);
      return;
    }
    if (!l) return;
    if (d.mode === "move") {
      const ll = map.containerPointToLatLng(L.point(l.x, l.y));
      onMove(d.id, { lat: ll.lat, lng: ll.lng });
    } else {
      onResize(d.id, Math.max(2, l.px / pxPerMetre(map)));
    }
  }, [live, map, onMove, onResize]);

  useEffect(() => {
    if (!dragRef.current) return;
    const move = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;
      if (d.mode === "move") {
        setLive({ id: d.id, x: d.origX + dx, y: d.origY + dy, px: d.origPx });
      } else {
        const delta = (dx + dy) / 2;
        setLive({
          id: d.id,
          x: d.origX,
          y: d.origY,
          px: Math.max(18, Math.min(600, d.origPx + delta * 2)),
        });
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };
  }, [endDrag, live]);

  if (!map) return null;
  const scale = pxPerMetre(map);
  const open = photos.find((p) => p.id === openId) ?? null;

  const start = (
    e: React.PointerEvent,
    photo: PhotoMemory,
    mode: "move" | "resize",
    x: number,
    y: number,
    px: number,
  ) => {
    e.stopPropagation();
    e.preventDefault();
    map.dragging.disable();
    dragRef.current = {
      id: photo.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: x,
      origY: y,
      origPx: px,
      moved: false,
    };
    setLive({ id: photo.id, x, y, px });
  };

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-[450] overflow-hidden">
        {photos.map((photo) => {
          const base = map.latLngToContainerPoint(L.latLng(photo.lat, photo.lng));
          const l = live && live.id === photo.id ? live : null;
          const x = l ? l.x : base.x;
          const y = l ? l.y : base.y;
          const px = l ? l.px : Math.max(18, photo.sizeM * scale);
          return (
            <div
              key={photo.id}
              className="pointer-events-auto absolute touch-none"
              style={{
                left: x,
                top: y,
                width: px,
                height: px,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                onPointerDown={(e) => start(e, photo, "move", x, y, px)}
                className="relative h-full w-full cursor-grab overflow-hidden rounded-[2px] bg-[oklch(0.96_0.02_90)] p-[6%] shadow-[0_4px_14px_rgba(0,0,0,0.6)]"
                style={{ border: "1.5px solid oklch(0.62 0.21 27)" }}
              >
                <img
                  src={photo.url}
                  alt="Pinned photo memory"
                  draggable={false}
                  className="h-full w-full select-none object-cover"
                />
                {/* pin — scales with the photo, capped so it never swallows small ones */}
                <div
                  aria-hidden
                  className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/3 rounded-full"
                  style={{
                    width: Math.min(10, Math.max(3, px * 0.09)),
                    height: Math.min(10, Math.max(3, px * 0.09)),
                    background: "oklch(0.62 0.21 27)",
                    boxShadow: "0 0 0 1px oklch(0.96 0.02 90 / .8), 0 1px 3px rgba(0,0,0,.7)",
                  }}
                />
              </div>
              {/* resize handle — only shown when the photo is big enough to grab */}
              {px >= 44 && (
                <div
                  role="button"
                  aria-label="Resize photo"
                  onPointerDown={(e) => start(e, photo, "resize", x, y, px)}
                  className="absolute -bottom-2 -right-2 cursor-nwse-resize rounded-full border border-[oklch(0.62_0.21_27)] bg-[oklch(0.18_0.02_250)]"
                  style={{
                    touchAction: "none",
                    width: Math.min(20, Math.max(12, px * 0.22)),
                    height: Math.min(20, Math.max(12, px * 0.22)),
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {open && (
        <div className="absolute inset-0 z-[600] grid place-items-center bg-black/80 p-5">
          <div className="w-full max-w-sm">
            <div
              className="overflow-hidden rounded-sm bg-[oklch(0.96_0.02_90)] p-2"
              style={{ border: "2px solid oklch(0.62 0.21 27)" }}
            >
              <img src={open.url} alt="Photo memory" className="aspect-square w-full object-cover" />
            </div>
            <div className="mt-3 flex justify-between gap-2">
              <button
                className="ctrl"
                aria-label="Delete photo"
                onClick={() => {
                  onDelete(open);
                  setOpenId(null);
                }}
              >
                <Trash2 className="h-4 w-4 text-[oklch(0.7_0.2_27)]" />
              </button>
              <button className="ctrl" aria-label="Close photo" onClick={() => setOpenId(null)}>
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
