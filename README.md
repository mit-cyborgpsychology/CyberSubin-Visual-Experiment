# CYBER SUBIN — Motion Atlas

An interactive browser-based atlas for the 59 Thai traditional dance movement models indexed in `59.ts`.

## Features

- Bilingual Thai/English movement selector for all 59 GLB files
- Automatic `/models` discovery with each additional GLB filename used as its selector index
- Real-time skeletal animation playback, scrubbing, always-visible 0.05×–5× speed control, orbit, and zoom
- Toggleable automatic camera orbit with clockwise/counterclockwise direction and independent 0.25×, 0.5×, 1×, and 2× speeds
- Screen-position controls move the avatar visibly left, right, up, or down with an off-axis projection; the camera and orbit target still follow its world position so rotation remains centered on the avatar
- Ten motion signals covering left/right hands, arms, legs, and feet, plus head and torso
- Overlaying, draggable right-sidebar graphs with a 3× longer, 270-sample history and ALL, X, Y, Z, or AVG views; resizing never shifts the centered 3D stage
- Solid-and-dotted 3D traces for every tracked body point
- Independent COLOR DOTS switch directly beneath LINE hides or restores the colored body-part markers without changing motion traces
- Independent DOTS + LINE or LINE ONLY display and RAW or centripetal SMOOTH path rendering
- Trace display defaults to OFF; a permanent first-row ON/OFF button remains accessible beside Line Controls SHOW/HIDE and stays synchronized with the detailed display controls
- A separate collapsible N.60 Elements menu with combinable Energy, Circles + Curves, Axis Points, Synchronous Limbs, External Body Spaces, and Shifting Relations lenses
- Circles + Curves continuously preserves the full smoothed 108-point motion stroke as a thin, non-glowing 3D line, without angle, path-length, or recency thresholds that make curves disappear abruptly
- Axis Points keeps one central Hips marker at the pelvis (without redundant upper-leg points); nearby pivots now activate across a wider proximity range, collapse into one centered marker, and turn white and grow slightly at near-contact
- Synchronous Limbs compares bilateral, same-side kinetic-chain, and cross-body hand/foot and arm/leg relationships. Coral-to-cyan links terminate at reactive limb-axis dots; midpoint circles are removed
- Shifting Relations uses a direct attention beam from the head to the non-head body part currently driving the transition, with the focus halo staying on that target
- External Body Spaces uses five simplified, rounded 3D panels to reveal only the leg–leg, left/right arm–leg, and left/right arm–head voids. Each panel warps through the real depth of its surrounding joints, forms a beveled volume inside the gap rather than behind the avatar, and is stencil-cut so it never draws across the body
- Energy mode colors only the avatar surface with accumulated effort heat. Joint-chain gravitational torque, raised knee/foot posture, center-of-mass balance over the support foot, knee bend, and torso counterbalance drive the result; movement contributes only when acting through an already loaded lever. Distal hands and feet stay comparatively cool unless load-bearing, and unloaded regions cool rapidly from red through orange to blue
- Switchable permanent or fading 3D traces with 1, 1.5, 3, 8, and 15-second lengths and three screen-space widths
- Discrete 5, 10, 20, 30, 60, 90, 120, and 240 Hz trace-sampling options with sub-frame interpolation at high rates
- Independent collapsible Camera Controls and a unified Line + Controls box on the left, with scene lighting kept with the camera tools and trace sampling kept with the line tools
- Non-reflective floor-light presets with a brighter High level and a draggable graph-panel divider
- Full-animation motion paths plus live elbow, knee, and torso-angle measurements
- Automatic horizontal recentering keeps the animated character in the middle of the stage
- Timeline scrubbing preserves existing traces and starts a new spatial segment; reset/restart clears them
- The unkeyed T-pose lead-in is trimmed so playback and traces begin at the first dance pose
- Responsive, minimal black interface with no server-side dependency
- Balanced typography hierarchy with enlarged primary controls, graph labels, movement selection, timecode, and playback speed while secondary text stays compact

## Run locally

```bash
pnpm install
pnpm dev
```

Build the static site with `pnpm build`. The existing `glb-optim/` directory is configured as Vite's public asset directory, so the models are copied into the production build and served from `/{index}.glb`.

## Controls

- Drag to orbit; scroll or pinch to zoom
- Space toggles playback
- Left/right arrow selects the previous/next movement
- `R` resets the camera and animation
- Double-click the viewer to reset the camera
- `C` toggles automatic camera orbit
