import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import L from "leaflet";
import { Trash2, X as XIcon } from "lucide-react";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [live, setLive] = useState<{ id: string; x: number; y: number; px: number } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const isSelected = (photo: PhotoMemory) => selectedId === photo.id;

  return (
    <>
      {photos.map((photo) => {
        const base = map.latLngToContainerPoint(L.latLng(photo.lat, photo.lng));
        const selected = isSelected(photo);
        const px = selected ? Math.max(18, photo.sizeM * scale) : Math.max(18, photo.sizeM * scale);
        return (
          <div
            key={photo.id}
            data-photo
            className={selected ? "ring-2 ring-[oklch(0.62_0.21_27)]" : ""}
            style={{ left: base.x, top: base.y, width: px, height: px }}
            onPointerDown={() => setSelectedId(photo.id)}
          >
            <img src={photo.url} alt="Pinned photo memory" draggable={false} />
            {selected && (
              <div className="resize-handle" onPointerDown={(e) => start(e, photo, "resize", base.x, base.y, px)} />
            )}
          </div>
        );
      })}
    </>
  );
}
