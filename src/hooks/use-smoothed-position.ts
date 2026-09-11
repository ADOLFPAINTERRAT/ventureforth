import { useEffect, useRef, useState } from "react";
import { distanceMeters, type LatLng } from "@/lib/expedition";

const POSITION_DEADBAND_METERS = 1.5;
/** About 95% of a GPS correction is shown within half a second. */
const SMOOTHING_TIME_CONSTANT_SECONDS = 0.17;
const SNAP_DISTANCE_METERS = 0.05;

/**
 * Turns infrequent, noisy GPS fixes into a display-only position that glides
 * toward meaningful movement. The raw position remains available to gameplay.
 */
export function useSmoothedPosition(rawPosition: LatLng | null, active: boolean) {
  const [displayPosition, setDisplayPosition] = useState<LatLng | null>(null);
  const displayRef = useRef<LatLng | null>(null);
  const targetRef = useRef<LatLng | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastFrameRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, []);

  useEffect(() => {
    if (!active || !rawPosition) {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      lastFrameRef.current = null;
      displayRef.current = null;
      targetRef.current = null;
      setDisplayPosition(null);
      return;
    }

    if (!displayRef.current || !targetRef.current) {
      displayRef.current = rawPosition;
      targetRef.current = rawPosition;
      setDisplayPosition(rawPosition);
      return;
    }

    // Holding the previous target while stationary stops small GPS drift from
    // making the coordinate console bounce.
    if (distanceMeters(targetRef.current, rawPosition) < POSITION_DEADBAND_METERS) return;
    targetRef.current = rawPosition;

    if (frameRef.current !== null) return;
    lastFrameRef.current = performance.now();

    const animate = (now: number) => {
      const current = displayRef.current;
      const target = targetRef.current;
      const lastFrame = lastFrameRef.current;

      if (!current || !target || lastFrame === null) {
        frameRef.current = null;
        return;
      }

      const elapsedSeconds = Math.max(0, (now - lastFrame) / 1000);
      lastFrameRef.current = now;
      const progress = 1 - Math.exp(-elapsedSeconds / SMOOTHING_TIME_CONSTANT_SECONDS);
      const next = {
        lat: current.lat + (target.lat - current.lat) * progress,
        lng: current.lng + (target.lng - current.lng) * progress,
      };

      if (distanceMeters(next, target) <= SNAP_DISTANCE_METERS) {
        displayRef.current = target;
        setDisplayPosition(target);
        frameRef.current = null;
        return;
      }

      displayRef.current = next;
      setDisplayPosition(next);
      frameRef.current = requestAnimationFrame(animate);
    };

    frameRef.current = requestAnimationFrame(animate);
  }, [active, rawPosition]);

  return displayPosition;
}
