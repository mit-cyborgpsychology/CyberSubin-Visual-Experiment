# CYBER SUBIN — Motion Atlas

An interactive browser-based atlas for the 59 Thai traditional dance movement models indexed in `59.ts`.

## Features

- Bilingual Thai/English movement selector for all 59 GLB files
- Automatic `/models` discovery with each additional GLB filename used as its selector index
- Real-time skeletal animation playback, scrubbing, speed control, orbit, and zoom
- Toggleable automatic camera orbit with clockwise/counterclockwise direction and independent 0.25×, 0.5×, 1×, and 2× speeds
- Screen-position controls move the avatar visibly left, right, up, or down with an off-axis projection; the camera and orbit target still follow its world position so rotation remains centered on the avatar
- Ten motion signals covering left/right hands, arms, legs, and feet, plus head and torso
- Overlaying, draggable right-sidebar graphs with a 3× longer, 270-sample history and ALL, X, Y, Z, or AVG views; resizing never shifts the centered 3D stage
- Solid-and-dotted 3D traces for every tracked body point
- Independent DOTS + LINE or LINE ONLY display and RAW or centripetal SMOOTH path rendering
- Switchable permanent or fading 3D traces with 1, 1.5, 3, 8, and 15-second lengths and three screen-space widths
- Discrete 5, 10, 20, 30, 60, 90, 120, and 240 Hz trace-sampling options with sub-frame interpolation at high rates
- Non-reflective floor-light presets with a brighter High level, collapsible settings, and a draggable graph-panel divider
- Full-animation motion paths plus live elbow, knee, and torso-angle measurements
- Automatic horizontal recentering keeps the animated character in the middle of the stage
- Timeline scrubbing preserves existing traces and starts a new spatial segment; reset/restart clears them
- The unkeyed T-pose lead-in is trimmed so playback and traces begin at the first dance pose
- Responsive, minimal black interface with no server-side dependency

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
