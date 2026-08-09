# CYBER SUBIN — Motion Atlas

An interactive browser-based atlas for the 59 Thai traditional dance movement models indexed in `59.ts`.

Open `/grid.html` for a six-avatar comparison view arranged as three dancers above and three below. Every cell has independent avatar and No. 60 effect selectors, while global SAME AVATAR ×6 and SAME EFFECT ×6 actions support synchronized comparison—including one avatar repeated six times with a different visualization in every cell. A shared bottom transport provides play/pause, normalized timeline scrubbing, restart, and 0.05×–5× playback speed for all six animations. Each cell can deep-link into the single-avatar view with its avatar, effect, speed, play state, and timeline position; the persistent GRID VIEW control restores the complete six-cell comparison.

## Project reference

This visualization is informed by [Cyber Subin: Ancestral Intelligence, Intangible Heritage, and Human-AI Co-dancing](https://cybersubin.media.mit.edu/), including its exploration of Mae Bot Yai and the six No. 60 choreographic principles.

**Reference:** Cyber Subin. *Ancestral Intelligence, Intangible Heritage, and Human-AI Co-dancing.* MIT Media Lab. [https://cybersubin.media.mit.edu/](https://cybersubin.media.mit.edu/)

## Features

- Bilingual Thai/English movement selector for all 59 GLB files
- Matching HIDE BUTTONS, HIDE ALL, SINGLE VIEW, and GRID VIEW navigation in both layouts, with the current view highlighted. HIDE BUTTONS removes the control overlays while keeping analysis and playback visible; HIDE ALL creates a clean presentation view and hides every other navigation control, leaving only a compact SHOW ALL button to restore the interface
- Six-avatar 3×2 comparison view with independent per-cell avatar/effect selection, repeat-one-avatar ×6, synchronize-one-effect ×6, and a shared bottom transport for play/pause, timeline scrubbing, 0.05×–5× speed, and restart-all. SAME AVATAR ×6 also restores every cell's camera, avatar position, floor light, traces, dots, and analysis settings to their defaults while retaining its selected effect
- Per-cell single-view launch buttons provide a bidirectional workflow: GRID VIEW writes the edited avatar, avatar color/surface/lighting, single or combined No. 60 effects, trace and dot configuration, sampling, floor lighting, camera/orbit, avatar position, graph display, speed, play state, and normalized animation position back into the focused grid cell without disturbing the other five
- Automatic `/models` discovery with each additional GLB filename used as its selector index
- Real-time skeletal animation playback, scrubbing, always-visible 0.05×–5× speed control, orbit, and zoom
- Collapsible Avatar Style controls with eight color presets; Smooth, Rough, a dense animated Point Cloud, and a high-visibility thick-bone skeleton with joint nodes; plus Studio, Bright, Side Light, Rim, and Silhouette lighting presets
- Toggleable automatic camera orbit with clockwise/counterclockwise direction and independent 0.25×, 0.5×, 1×, and 2× speeds
- Screen-position controls move the avatar visibly left, right, up, or down with an off-axis projection; the camera and orbit target still follow its world position so rotation remains centered on the avatar
- Ten motion signals covering left/right hands, arms, legs, and feet, plus head and torso
- Overlaying, draggable right-sidebar graphs with a 3× longer, 270-sample history and ALL, X, Y, Z, or AVG views; the avatar dynamically recenters within the unobscured 3D area as the panel is resized, shown, or hidden
- Always-accessible MOTION ANALYSIS control hides or restores the complete graph sidebar while preserving its resized width
- Solid-and-dotted 3D traces for every tracked body point
- Independent COLOR DOTS switch directly beneath TRACE hides or restores the colored body-part markers without changing motion traces; both TRACE and COLOR DOTS default to OFF while MOTION ANALYSIS defaults to ON
- Independent DOTS + LINE or LINE ONLY display and RAW or centripetal SMOOTH path rendering
- Trace display defaults to OFF; when enabled it defaults to a permanent, smooth, line-only path sampled at 240 Hz. A permanent first-row ON/OFF button remains accessible beside Line Controls SHOW/HIDE and stays synchronized with the detailed display controls
- A separate collapsible No. 60 Elements menu with combinable Energy, Circles + Curves, Axis Points, Synchronous Limbs, External Body Spaces, and Shifting Relations lenses
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
- Permanent traces retain every sampled point without compression across animation loops and remain intact until RESET/restart or a model change
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
