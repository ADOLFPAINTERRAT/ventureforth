# Smooth map and reliable fog plan

## Goal
Make map panning and zooming feel smooth on phones, stop inaccurate GPS fixes from revealing long strips of map, and preserve all existing exploration, photo, destination, account, and save-progress features.

## Changes

1. **Stop false fog reveals at the GPS source**
   - Accept every usable fix for the live location display, but add a point to the permanently revealed map only when its accuracy is trustworthy.
   - Reject impossible-speed jumps and large discontinuities before they reach the saved exploration trail.
   - Break disconnected trail sections instead of drawing a reveal line between them.
   - Use the continuous GPS watcher as the primary source and remove the overlapping one-second GPS polling loop that currently duplicates updates.

2. **Make fog rendering lightweight**
   - Replace the expensive per-point blur and radial-gradient drawing loop with a cached, pre-rendered soft reveal stamp.
   - Draw isolated visited areas as soft circles and only join nearby consecutive fixes, so distant points never create a long straight reveal.
   - Simplify and spatially reduce trail points before painting, cull everything outside the visible map, and keep panning/zooming on the existing animation-frame transform path.
   - Keep explored areas permanent and clearly visible after ending an expedition, signing out, or reopening the app.

3. **Reduce work during map interaction**
   - Throttle compass updates to the display refresh rate and ignore tiny heading changes that do not visibly move the arrow.
   - Prevent unnecessary React rerenders when a GPS fix has not materially changed position, accuracy, or heading.
   - Remove GPU-heavy backdrop blur from floating controls and replace the multi-stage map tile filter with a cheaper visual treatment while retaining the current field-instrument look.
   - Keep photo memories geographically anchored, but avoid recalculating or rendering off-screen photo details during active map movement.
   - Preserve intentional error reporting; there are no ordinary debug logs to remove.

4. **Repair existing saved streaks safely**
   - Strengthen saved-trail cleanup so obvious isolated jumps are split or discarded without shrinking legitimate explored areas.
   - Save the cleaned trail once after restoration so old bad streaks do not return on the next session.

5. **Verify on a phone-sized viewport**
   - Simulate normal walking, a coarse initial fix, and a distant GPS jump; confirm only valid nearby movement reveals fog.
   - Pan and zoom repeatedly while checking frame timing, fog alignment, player movement, coordinate updates, destination behavior, and photo anchoring.
   - Reload and end an expedition to confirm all legitimate explored areas remain revealed.
   - Run the focused type and browser checks and confirm there are no new console errors.

## Technical details
- Keep the current Leaflet map and existing cloud data shape.
- Apply the existing 60 m accuracy, 12 m/s speed, and 500 m gap thresholds that are currently defined but not enforced by the live GPS handler.
- Preserve underlying trail data for fog persistence; only the previously removed visible route line stays absent.
- No redesign, new service, or change to the fictional X/Z coordinate system.
