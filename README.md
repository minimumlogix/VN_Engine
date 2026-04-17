# 🎭 VN ENGINE: COMPLETE STORY ARCHIVE

> **Status:** `EXPANDED` | **Engine:** `v3.1` | **Effects Engine:** `v4.0 — GODMODE`
> **Root URL:** `https://minimumlogix.github.io/VN_Engine/`

---

### 🌸 ANIME & CLASSIC STYLES
| Identifier | Category | Status | Interface Link |
| :--- | :--- | :--- | :--- |
| **My Hero Academia** | Shonen Action | `LIVE` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=MHA) |
| **Anime Story Demo 1** | Slice of Life | `BETA` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_anime1) |
| **Warm UI Demo** | Cozy/Aesthetic | `TESTING` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_warmui) |

---

### ⚡ CYBER & SPACE STYLES
| Identifier | Category | Status | Interface Link |
| :--- | :--- | :--- | :--- |
| **Cyberpunk Demo 1** | Neon Noir | `STABLE` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_cyberpunk1) |
| **Cyberpunk Demo 2** | Dystopian | `STABLE` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_cyberpunk2) |
| **Nasapunk Demo** | Hard Sci-Fi | `ALPHA` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_nasapunk) |

---

### 🏰 FANTASY & DARK STYLES
| Identifier | Category | Status | Interface Link |
| :--- | :--- | :--- | :--- |
| **Fantasy Demo** | High Fantasy | `STABLE` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_fantasy) |
| **Gothic Demo** | Dark/Horror | `STABLE` | [Launch VN](https://minimumlogix.github.io/VN_Engine/?story=demo_gothic) |

---

## ⚡ EFFECTS ENGINE v4.0 — GODMODE

The Effects Engine is a singleton class (`effectsEngine`) providing three categories of visual effects.

---

### 🔵 MACRO EFFECTS (Dialogue Inline)

Apply short-burst screen effects by embedding tags inside dialogue text.
**Syntax:** `"Your dialogue text [effect_name] continues here."`

Effects are applied to `<body>` as CSS classes and auto-remove after their duration.

| Macro Tag | CSS Class | Duration | Description |
| :--- | :--- | :--- | :--- |
| `[shake]` | `fx-shake` | 600ms | Cinematic camera shake with rotation |
| `[glitch]` | `fx-glitch` | 1800ms | Chromatic aberration + scanline tears + RGB split |
| `[flash]` | `fx-flash` | 200ms | Blinding white flash burst |
| `[blink]` | `fx-blink` | 1400ms | Cinematic hard-cut eyelid close/open |
| `[electricuted]` | `fx-electricuted` | 1200ms | Blue lightning jitter + electric overlay flicker |
| `[shadows]` | `fx-shadows` | 2200ms | Character emerges from total darkness |
| `[earthquake]` | `fx-earthquake` | 1800ms | Heavy low-frequency ground-shaking rumble |
| `[heartbeat]` | `fx-heartbeat` | 1600ms | Double-thump zoom pulse for tense moments |
| `[vhs]` | `fx-vhs` | 2500ms | Analog VHS tape distortion + colour fringing |
| `[drain]` | `fx-drain` | 2000ms | Colour drains to desaturated monochrome |
| `[nuke]` | `fx-nuke` | 3000ms | Blinding white flash + brightness burn-out |
| `[bloodsplatter]` | `fx-bloodsplatter` | 1600ms | Red vignette burst + trauma shake |
| `[shockwave]` | `fx-shockwave` | 1000ms | Radial ripple ring + impact jolt |
| `[hologram]` | `fx-hologram` | 3000ms | Flickering hologram scanlines + hue cycling |
| `[rage]` | `fx-rage` | 2000ms | Red-tinted violent shake with saturation burst |

#### Intensity Parameter
Macros support an intensity multiplier (`1`, `2`, or `3`) passed via the JS API:
```js
effectsEngine.triggerMacro('shake', { intensity: 2 }); // stronger + faster
effectsEngine.triggerMacro('earthquake', { intensity: 3, duration: 2500 }); // max violence
```

---

### 🔴 OVERLAY EFFECTS (Blocking Full-Screen)

Full-screen blocking effects that pause scene progression until complete.
Used via `playOverlayEffect()` in story JSON or manually in JS.

| Overlay Key | Duration | Description |
| :--- | :--- | :--- |
| `GLITCH` | 2000ms | Dark glitch overlay with animated cyan scan bars |
| `ELECTROCUTED` | 1500ms | Canvas-drawn procedural lightning arcs on dark blue bg |
| `NUKE` | 3500ms | Blinding white flash → expanding energy ring pulses |
| `SHOCKWAVE` | 1200ms | Single massive radial shockwave ring expansion |
| `PORTAL` | 2800ms | Three rotating neon rings converge → glowing core |

```js
// Promise-based (recommended — awaits completion)
await effectsEngine.playOverlayEffect('PORTAL');

// Legacy callback style
effectsEngine.playOverlayEffect('NUKE', () => console.log('done'));
```

---

### 🟢 PERSISTENT LAYER (Scene-Wide GIF/Media)

A full-bleed `<div>` layer between the background and character sprites.
Used for looping ambient effects (rain, fire, fog, glitch overlays, etc.).

```json
// In story JSON — set a persistent effect for this scene node
{ "persistentEffect": "assets/rain_overlay.gif" }

// Clear it on the next scene node
{ "persistentEffect": "" }
```

```js
effectsEngine.setPersistentEffect('assets/rain.gif'); // set
effectsEngine.clearPersistentEffect();                 // clear
```

---

### 🎬 SEQUENCE API

Play multiple macro effects in a timed chain:
```js
effectsEngine.playSequence([
    { name: 'flash',        gap: 100 },
    { name: 'earthquake',   opts: { intensity: 2 }, gap: 200 },
    { name: 'bloodsplatter' }
]);
```

---

### 📖 STORY JSON USAGE EXAMPLES

```json
{
  "character": "TODOROKI",
  "text": "Something's [glitch] wrong with the [shake] system.",
  "effect": "GLITCH"
}
```

```json
{
  "character": "NARRATOR",
  "text": "The world [drain] fades to grey...",
  "persistentEffect": "assets/effects/fog.gif"
}
```

```json
{
  "character": "VILLAIN",
  "text": "[nuke] EVERYTHING BURNS.",
  "effect": "NUKE"
}
```

---

### 🛠 MAINTENANCE CHECKLIST
- [ ] **Styles:** Confirm "Warm UI" color palette consistency.
- [ ] **Assets:** Check gothic-style sprite lighting.
- [ ] **Logic:** Verify nasapunk oxygen-gauge variable implementation.
- [ ] **Effects:** Test `[hologram]` + `PORTAL` overlay combo in Fantasy theme.


---
*Index Updated: April 18, 2026 — Effects Engine v4.0 GODMODE*