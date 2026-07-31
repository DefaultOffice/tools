# Atmospheric Sunset/Sunrise Simulator — Technical & Design Plan

**For:** tools.defaultoffice.com · **Build target:** Opus · **Status:** spec, no code

---

## 1. What the renderer actually computes

The core realization that makes this tractable: with no sun disc, no scene, and a fixed viewing azimuth, the entire output is a **1D function** — spectral radiance as a function of view elevation angle. The full-bleed "gradient" is just that 1D function stretched horizontally across the screen.

This means we can afford physics that would be extravagant per-pixel. We compute a ~1024-entry radiance LUT (one entry per screen row) with full spectral single-scattering integration, and repaint it on every parameter change. Everything else — the screen quad, dithering, export — samples that LUT.

The model is Nishita-style single scattering in a spherical-shell atmosphere, extended with ozone absorption (Hillaire 2020). Ozone is non-negotiable: the Chappuis absorption band (peaking ~600 nm) is the reason the zenith stays deep blue after sunset. Without it, twilight renders grey-green and the whole "blue hour" is wrong — this is the single most common failure of naive sky renderers.

### Geometry

Spherical Earth, radius R = 6360 km, atmosphere top at R + 80 km. Observer at radius R + h (h = altitude parameter). For each view elevation θ_v, march the ray from the observer to its exit from the atmosphere shell.

At each sample point P along the ray:

1. **Sun occlusion test** — does the ray from P toward the sun intersect the Earth sphere? If yes, P is in Earth's shadow: no direct in-scatter. This geometric test is what produces twilight — after sunset, only high-altitude air is still sunlit, and the gradient you see is literally the shadow of the planet sweeping upward. It falls out of the geometry for free; do not fake it.
2. **Sun transmittance** — optical depth along the P→sun ray through all three constituents (secondary march, or the transmittance LUT in §5).
3. **In-scatter accumulation** — per wavelength:

```
L(θ_v, λ) = E_sun(λ) · ∫ T(0→s) · [ β_R(λ)·ρ_R(s)·P_R(μ) + β_M(λ)·ρ_M(s)·P_M(μ) ] · T_sun(s) ds
```

where T includes extinction from Rayleigh + Mie + ozone, and μ is the cosine of the view–sun angle.

### Constituents

| | Density profile | Sea-level coefficient (550 nm) | Wavelength dependence |
|---|---|---|---|
| Rayleigh (scatter) | exp(−h/8000 m) | β_R = 13.5 × 10⁻⁶ m⁻¹ | λ⁻⁴ (so ≈5.8e-6 @680, ≈33.1e-6 @440) |
| Mie (scatter + absorb) | exp(−h/1200 m) | β_M from turbidity, see §2 | λ⁻α, Ångström α = 0.6 default (marine aerosol; see §6 reference target) |
| Ozone (absorb only) | tent: peak 25 km, zero at 10/40 km | σ_O₃(λ), Chappuis band (RGB ref: 0.650, 1.881, 0.085 ×10⁻⁶ m⁻¹) | tabulated cross-section |

Mie extinction = scattering / 0.9 (single-scattering albedo 0.9, i.e. mildly absorbing aerosol). Mie phase function: Cornette-Shanks with g = 0.76 — this produces the bright forward-scatter glow near the sun's direction. Since our gradient looks along the sun's azimuth, that glow is the horizontal band of fire at the horizon during sunset. It is physical aureole, not a sun disc; keep it.

### Spectral, not RGB

Integrate at **12–16 wavelength samples, 380–720 nm**, then convert: spectral radiance × CIE 1931 CMFs → XYZ → linear sRGB (or Display P3 where supported). RGB-only scattering (the usual shortcut) systematically oversaturates sunset oranges and misses the way the spectrum slides — λ⁻⁴ extinction acting on a full spectrum is precisely the physics we're claiming to simulate. At LUT resolution the cost is trivial: 1024 rows × 32 view samples × 8 light samples × 14 wavelengths ≈ 3.7M multiply-adds per repaint — comfortably 60 fps on GPU, and near-realtime even in scalar JS.

Sun spectrum E_sun(λ): tabulated extraterrestrial solar irradiance (ASTM E-490, downsampled to our wavelength grid). A 5778 K blackbody is an acceptable fallback but the tabulated curve is one small constant array — use it.

### Known simplifications (declared, not hidden)

- **Single scattering only.** The main deviation: real twilight is brighter and softer because of multiple scattering. Mitigation in v1: a small ambient in-scatter term proportional to zenith transmittance (an established cheap approximation), clearly tagged in code as the one non-first-principles term. Upgrade path: Hillaire's isotropic multiple-scattering estimate, which is cheap in our 1D setting; Bruneton-style precomputation is overkill here.
- **Atmospheric refraction ignored** (~0.57° elevation error at the horizon). Optionally fold in as a fixed elevation offset near the horizon; note it, don't model it.
- **No clouds, no aerosol layers/inversions.** Out of scope by design.
- **Below-horizon rays clipped.** No ground means rays below the geometric horizon (with altitude dip) have nothing physical to show; the frame's bottom edge is the horizon.

### Exposure and tone

Physical radiance spans ~4+ log units from noon to astronomical night. To stay continuous:

- Fixed reference exposure modulated by a **smooth adaptation curve** — a slow logistic in sun elevation, documented as photopic→scotopic adaptation. This is the eye, not a hack, and it keeps a single scrub from noon to night watchable.
- Tonemap: a filmic curve with gentle shoulder (AgX-family or Hable). No auto-exposure — it fights the scrub and breaks determinism (same parameters must always yield the same export).
- Out-of-gamut handling: desaturate toward luminance (sunset chromaticities routinely exceed sRGB; hard clipping causes hue skew right where the image is most interesting).
- Below θ_s ≈ −18° the model correctly goes to ~zero. Render it: near-black is the correct answer for night. An optional faint airglow constant is a designer decision, off by default.

---

## 2. Parameters — the entire control surface

Three sliders. Each is a physical quantity a photographer or physicist would recognize, and every visual behaviour derives from them through the model — nothing is independently tuned per-parameter.

**Sun elevation θ_s** — the master. Range **−25° to +90°**, with tick landmarks at 0° (sunset), −6° (civil), −12° (nautical), −18° (astronomical twilight). This drives everything: path length through the atmosphere (hence reddening), the Earth-shadow geometry (hence twilight structure), the ozone-dominated zenith at dusk, the adaptation curve. Non-linear slider response — finer resolution in −10°…+10° where all the action is; linear elsewhere. A "time of day" scrub is just a cosine remap of this axis and can be offered as an alternate label, but elevation is the canonical parameter and what the readout shows.

**Turbidity T** — atmospheric clarity, range **1 to 10**, log-spaced slider. Defined the classical way: T = (τ_R + τ_M)/τ_R at 550 nm, which fixes the Mie coefficient definitionally rather than by feel:

```
β_M(550) = (T − 1) · β_R(550) · H_R / H_M     (H_R = 8000, H_M = 1200)
```

T = 1 is a pure molecular atmosphere (crisp alpine, saturated blues, thin sharp sunset band). T ≈ 2–3 is a clear day. T ≈ 6–10 is hazy/polluted (desaturated washed sky, broad orange glow, milky horizon). Secondary effect, also physical: g eases from 0.76 toward 0.80 as T rises (larger particles scatter more forward). That is the only coupling; everything else follows from β_M in the integral.

**Observer altitude h** — **0 to 12 km**, log-ish slider. Moves the ray origin up: less air below means a darker, deeper zenith, a horizon that dips below 0°, and thinner reddening. At 10 km the model should read unmistakably as "from an aircraft window" without any special-casing — if it doesn't, the model is wrong, not the parameter.

**Advanced (behind a single disclosure, defaults locked):** view azimuth relative to sun (0° = toward sunset, default; 180° gives the antisolar sky — Belt of Venus and the rising Earth-shadow band, which the occlusion test in §1 already produces for free); frame top elevation E_max (default 45°, this is camera framing, not physics); ozone column (default 300 DU); Ångström exponent α (default 0.6 marine, ~1.3 urban/continental — this is aerosol *character* where turbidity is aerosol *amount*).

That's the whole surface. No colour controls exist anywhere in the product.

---

## 3. Rendering approach

**WebGL2 fragment shader → 1×1024 float LUT → full-screen quad.** Not SVG (can't express this), not Canvas2D gradients (too few stops, no dithering control), not per-pixel shading (wasteful — every column is identical).

- **Pass 1 (on parameter change only):** fragment shader over a 1×1024 RGBA16F target. Each texel = one view elevation; runs the full spectral integral with wavelength loop unrolled and CMFs as constants. Optional pre-pass: a small sun-transmittance LUT (altitude × sun angle) to replace the secondary march — an optimization, defer until profiled.
- **Pass 2 (every frame while animating, else on demand):** full-screen quad samples the LUT with linear filtering, applies exposure/tonemap/gamut-map, and **blue-noise dithers** before 8-bit quantization.
- Request a **Display P3 / half-float drawing buffer** where available (`drawingBufferColorSpace = 'display-p3'`); fall back to dithered sRGB.

Dithering is not a nicety. A full-viewport, slowly-varying gradient is the worst case for 8-bit banding; an undithered version will look broken on most displays and would sink the "precision instrument" positioning on its own.

**Fallback:** identical math in TypeScript writing ImageData (shared constants module so shader and JS can never drift). Also serves as the test oracle.

**Performance contract:** LUT repaint < 2 ms on integrated GPUs → slider drag and animation run at display rate. When idle, zero GPU work (`preserveDrawingBuffer` or repaint-on-demand).

---

## 4. Interface direction

The sky is the product; the interface is instrumentation. Nothing should sit between the person and the colour field for more than a glance.

**Layout.** Full-bleed canvas, edge to edge, no chrome. A single hairline control strip along the bottom: three sliders inline with small monospaced readouts of the physical values (`θ −4.2°  ·  T 2.5  ·  h 0 m`). The strip fades out entirely after ~2 s idle and returns on pointer movement or focus — the resting state of the tool is pure sky. Top-right: an export affordance and the advanced disclosure, both reduced to quiet glyphs.

**Instrument character.** The elevation slider carries etched tick landmarks (sunset, civil/nautical/astronomical) like a lens barrel's DOF scale — this is where the precision reads, not in visual decoration. Readouts always show real units. Keyboard: arrows nudge the focused slider, shift-arrow for fine steps (0.1°), space toggles animation. Everything reachable without the pointer.

**Adaptive contrast.** UI ink colour is computed from the LUT's mean luminance in the strip region — dark hairlines over a noon sky, pale over dusk, continuously, no theme toggle. The UI literally reads its own sky.

**Animation.** Space (or a small play glyph) scrubs θ_s continuously at an adjustable rate — the model's continuity is the demo. Respect `prefers-reduced-motion`. No presets, no "sunset/noon/night" buttons: presets are an admission the parameter space isn't worth exploring, and this one is.

**State in URL.** All parameters serialize to query params. Every sky is a permalink; this is also the sharing story and it costs nothing.

---

## 5. Export

All exports sample the same LUT that's on screen — WYSIWYG by construction.

**CSS gradient.** Emit `linear-gradient(in oklab, …)` with **adaptive stop placement**: walk the LUT and insert stops where perceptual error (ΔE) between the browser's interpolation and the true curve exceeds a tolerance — dense stops through the sunset band, sparse in the flat blue. Typically 12–25 stops instead of a dumb uniform 50. Offer sRGB hex and `color(display-p3 …)` variants. This detail alone will out-quality every hand-tuned gradient generator.

**PNG.** Arbitrary resolution (the LUT is resolution-independent — re-render at target height for full precision), blue-noise dithered 8-bit; 16-bit PNG as a stretch goal for print/grading workflows.

**SVG.** `<linearGradient>` with the same adaptive stops, for design-tool import.

**Parameters.** Copy-as-JSON plus the permalink URL. An exported asset can always be reopened live at its exact state.

---

## 6. Validation & build order

**Validation (build this first, not last).** A headless harness running the TS reference integrator, checked against published data: zenith chromaticity vs sun elevation curves; blue-hour zenith hue (must stay blue through −12°, the ozone test); horizon-to-zenith luminance ratios at noon; qualitative photo comparison of T = 1 vs T = 8 at θ_s = −2°.

**Reference target: San Francisco Pacific sunset.** The canonical clear-sky look the defaults should land on: coastal marine aerosol, T ≈ 2–2.5, α ≈ 0.5–0.6, g ≈ 0.78–0.80, sea-level observer, unobstructed 0° ocean horizon, θ_s from +5° through −8°. Validate against photo references — the signature is a broad saturated orange-to-pink wall low over the water (forward-scatter aureole through moderate marine AOD), not a narrow red band. The 2020-smoke look is the same model at T ≈ 8–10 with single-scattering albedo dropped to ~0.8. Declared limitation: the fog/stratus versions of the SF sunset (pink-lit marine layer) are cloud phenomena and out of scope — this tool reproduces the clear-sky gradient behind them.

Plot CIE xy trajectories across the θ_s sweep — the whole point of the project is that these curves come out right, so they need to be inspectable.

**Build order for Opus:**

1. **Reference integrator (TS) + validation harness.** All constants in one shared module. Get the physics signed off via plots before any pixels.
2. **WebGL LUT pipeline + full-bleed render + dithering.** Verify shader ≡ TS reference within tolerance.
3. **Controls, adaptive contrast, animation, URL state.**
4. **Export** (CSS adaptive stops → PNG → SVG).
5. **Polish:** P3 buffer, multiple-scattering approximation, transmittance-LUT optimization, 16-bit PNG.

**Risk register.** Banding (mitigated: dither + P3, addressed in step 2 not deferred). Twilight too dark from missing multiple scattering (mitigated: ambient term, flagged; upgrade path known). Gamut clipping hue-skew at the horizon (mitigated: luminance-preserving desaturation, validated in step 1 plots).

---

*References for the implementer: Nishita et al. 1993 (single-scattering sky); Hillaire 2020, "A Scalable and Production Ready Sky and Atmosphere Rendering Technique" (ozone profile & coefficients, multiple-scattering estimate); Bruneton & Neyret 2008 (Rayleigh/Mie constants); Preetham et al. 1999 (turbidity convention); ASTM E-490 (solar spectrum).*
