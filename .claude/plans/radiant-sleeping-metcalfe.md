# Standardised Export Naming Dialog

## Context

Multiple animation tools export frame sequences as `frame_XXXXX.png`. When imported into KeyShot, different animations collide because they share identical filenames. We need a shared, modular dialog component that standardises frame naming across all tools with customisable prefixes and timestamps.

**Tools in scope:** WaveMesh Generator, SVG Line Animator, Animated Gradient Loop, Fusion Particle Sim  
**Out of scope:** Default Office Grid (never goes into KeyShot)

---

## New File: `shared/export-dialog.js`

A self-contained IIFE that exposes a global `ExportDialog` object. Injects its own scoped CSS (all selectors under `[data-export-dialog] .exd-*`). Dark theme with `#FF4F00` orange accent, matching the majority design language.

### API

```js
// Opens dialog, returns Promise with user's choices
ExportDialog.show({
  toolName: 'wavemesh',              // auto-fills name field
  info: [                             // read-only info rows
    { label: 'Canvas', value: '1920×1080' },
    { label: 'Frames', value: '90' }
  ],
  fields: [                           // custom tool-specific fields (select, checkbox, color)
    { id: 'format', type: 'select', label: 'Format',
      options: [{ value: 'png', label: 'PNG' }], default: 'png' }
  ],
  zipMeta: '1920x1080-30fps'          // string or function(values) for zip filename metadata
}) → Promise<{ name, timestamp, customValues, cancelled }>

// Generates frame filename: "wavemesh_260416_143022_00001.png"
// Optional suffix for layers: frameName({ name, timestamp, extension, suffix: 'boundary' }, i)
//   → "wavemesh_boundary_260416_143022_00001.png"
ExportDialog.frameName({ name, timestamp, extension, suffix }, frameIndex) → string

// Generates zip filename: "wavemesh_260416_143022_1920x1080-30fps.zip"
ExportDialog.zipName({ name, timestamp, metadata }) → string

// Progress control (called by tool during export loop)
ExportDialog.progress(current, total, statusText?)
ExportDialog.isCancelled() → boolean
ExportDialog.complete()
```

### Dialog Layout

```
┌─ Export PNG Sequence ─────────────────┐
│                                       │
│  Canvas          1920×1080            │  ← info rows (read-only)
│  Frames          90                   │
│  FPS             30                   │
│  ─────────────────────────────────    │
│  Name            [wavemesh        ]   │  ← text input, auto-filled
│  Timestamp       [✓] 260416_143022    │  ← checkbox + preview
│  ─────────────────────────────────    │
│  Frame preview   wavemesh_260416…01   │  ← live preview updates as you type
│  ─────────────────────────────────    │
│  Format          [PNG (Alpha)    ▾]   │  ← custom fields (tool-specific)
│  ─────────────────────────────────    │
│  ████████████░░░░░  45 / 90           │  ← progress (hidden until export)
│                                       │
│               [Cancel]  [Export]       │
└───────────────────────────────────────┘
```

### Naming Convention

- **Frames:** `{name}_{YYMMDD_HHMMSS}_{00001}.{ext}` (timestamp optional via checkbox)
- **Zip:** `{name}_{YYMMDD_HHMMSS}_{metadata}.zip`
- **Padding:** Always 5 digits
- **Timestamp:** Captured at moment user clicks Export (so all frames share it)

### Modularity

Custom fields are declared via config — `select`, `checkbox`, `color` types supported. Adding a new field to all tools means adding one entry to each tool's config object. The dialog renders them dynamically. A `linkedFields` mechanism handles conditional visibility (e.g. color picker appears only when "Custom" background is selected).

---

## Integration Per Tool

### 1. WaveMesh Generator (`tools/wavemesh-generator/index.html`)

- **Add** `<script src="../../shared/export-dialog.js"></script>` after JSZip
- **Remove** export modal HTML (~lines 234-247) and modal CSS (~lines 99-114)
- **Remove** `openExportModal()`, `closeExportModal()`, `startExport()`
- **Replace with** new function that calls `ExportDialog.show()` with format field, then runs export loop using `ExportDialog.frameName()` / `ExportDialog.zipName()` / `ExportDialog.progress()`
- **Custom fields:** Format (PNG/JPEG)

### 2. SVG Line Animator (`tools/svg-line-animator/index.html`)

- **Add** script tag after JSZip
- **Remove** Scale and Background controls from sidebar export section (keep FPS in sidebar)
- **Remove** `export-progress` div
- **Rewrite** export button handler to call `ExportDialog.show()` with scale + background fields, then run export
- **Custom fields:** Scale (1x/2x/3x), Background (white/transparent/custom with linked color picker)

### 3. Animated Gradient Loop (`tools/animated-gradient-loop/index.html`)

- **Add** script tag after JSZip
- **Rewrite** export button handler to call `ExportDialog.show()` (no custom fields), then run export
- **Fix** frame padding from 4-digit to 5-digit (via `ExportDialog.frameName()`)
- **Custom fields:** None

### 4. Fusion Particle Sim (`tools/fusion-particle-sim/index.html`)

- **Add** script tag after JSZip
- **Wrap** `exportSequence()` and `exportAllLayers()` to open dialog first
- **Remove** `export-status` div
- **Keep** `exportCurrentFrame()` as-is (single frame, no dialog needed)
- **Custom fields:** None

**Layer export handling:** Dialog opens once. The tool handles subfolder creation itself. Layer name is embedded in the frame filename so files are self-describing even outside folder context:
```
particle-layers_260416_143022_seed12345.zip
  ├── boundary/
  │   ├── particle-sim_boundary_260416_143022_00001.png
  │   └── ...
  ├── lithium/
  │   ├── particle-sim_lithium_260416_143022_00001.png
  │   └── ...
  └── (etc for all 6 layers)
```

The `ExportDialog.frameName()` API supports an optional `suffix` param inserted after the name: `frameName({ name: 'particle-sim', timestamp, extension, suffix: 'boundary' }, i)` → `particle-sim_boundary_260416_143022_00001.png`. The shared component stays generic — the tool passes the layer name as the suffix.

---

## Implementation Order

1. Create `shared/export-dialog.js` (full component)
2. WaveMesh Generator (already has modal — easiest to validate before/after)
3. Animated Gradient Loop (simplest — no custom fields)
4. SVG Line Animator (custom fields with linked color picker)
5. Fusion Particle Sim (most complex — sequence + layer + single frame exports)

## Verification

For each tool after integration:
- Open tool in browser via dev server
- Configure animation parameters
- Click Export → verify dialog appears with correct info and fields
- Change name, toggle timestamp → verify preview updates live
- Click Export → verify progress bar animates
- Open downloaded zip → verify frame naming follows `{name}_{timestamp}_{00001}.png`
- Verify zip filename follows convention
- Test Cancel before and during export
