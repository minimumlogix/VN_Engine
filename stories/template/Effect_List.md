# 🎬 LVNE Effects & Macros Reference

This guide documents all visual effects, cinematic macros, and text variables supported by the LVNE (Lightweight Visual Novel Engine).

---

## 🎭 Text Macros
Text macros are replaced dynamically at runtime. Use double curly braces `{{ }}`.

| Macro | Description | Example |
| :--- | :--- | :--- |
| `{{user}}` | The player's name. Defaults to "Player". | "Hello, {{user}}! Nice to meet you." |

> **!TIP**
> The player's name can be set via URL parameter: `?player=YourName`.

---

## ⚡ Cinematic Macros (Dialogue-Based)
Macros are triggered by placing them inside square brackets `[ ]` directly in your dialogue text. They are applied to the entire screen/body.

### Usage
- `[shake]` - Triggers default intensity.
- `[shake(2)]` - Triggers specific intensity (1 = Default, 2 = Strong, 3 = Violent).

### Available Macros
| Effect | Intensity Support | Duration | Description |
| :--- | :---: | :--- | :--- |
| `shake` | ✅ | 600ms | Rapid screen shake. |
| `glitch` | ✅ | 1800ms | Digital artifacting and displacement. |
| `flash` | ✅ | 200ms | Single white frame flash. |
| `blink` | ✅ | 1400ms | Repeated black-out "eye blink" effect. |
| `electricuted` | ✅ | 1200ms | High-frequency jitter with blue tint. |
| `shadows` | ✅ | 2200ms | Vignette darkens and pulses. |
| `earthquake` | ✅ | 1800ms | Low-frequency, heavy screen rocking. |
| `heartbeat` | ✅ | 1600ms | Double-thump zoom pulse. |
| `vhs` | ✅ | 2500ms | Analog distortion and tracking lines. |
| `drain` | ✅ | 2000ms | Colors drain to grayscale. |
| `nuke` | ✅ | 3000ms | Intense white flash followed by shockwave. |
| `bloodsplatter` | ✅ | 1600ms | Red vignette pulse. |
| `shockwave` | ✅ | 1000ms | Single radial ripple distortion. |
| `hologram` | ✅ | 3000ms | Blue tint with horizontal flickering lines. |
| `rage` | ✅ | 2000ms | Red-tinted violent shaking. |

---

## 👤 Sprite-Specific Effects
Applied to individual characters using the `SpriteEffects` property in the story JSON.

| Effect | Description |
| :--- | :--- |
| `Scanlines` | Adds digital scanlines to the sprite. |
| `Holo` | Makes the sprite look like a blue hologram. |
| `Glitch` | Localized digital distortion on the character. |
| `Ghost` | Semi-transparent with a trailing after-image. |
| `Blur` | Softens the character's appearance. |
| `Glow` | Adds an outer bloom/glow effect. |
| `Drain` | Drains color from the sprite only. |
| `Vivid` | Boosts saturation and contrast. |
| `Shadow` | Turns the sprite into a pure black silhouette. |
| `Flicker` | Rapidly toggles visibility/brightness. |
| `Pulse` | Smoothly scales the sprite up and down. |
| `Float` | Subtle hovering animation. |
| `None` / `Clear` | Removes all active effects from the sprite. |

---

## 🖼️ Media Overlays (Layers)
Special properties used in scene nodes to overlay GIFs or videos.

- **`persistentEffect`**: A URL to an asset (usually a GIF) that persists across dialogue nodes until cleared (set to `""`).
- **`simpleEffect`**: A temporary overlay with optional `delayStartMs` and `delayEndMs` timing.

---

## 🎨 Text Formatting (HTML)
The engine supports standard HTML tags within dialogue for styling:
- `<b>Bold Text</b>`
- `<i>Italic Text</i>`
- `<u>Underlined Text</u>`
- `<br>` (Line break)
- `<span style="color:red">Colored Text</span>`
- `<span style="color:#FF9900; font-family:'Arial Black'; text-shadow: 0 0 10px #00FFFF;">Colored Text</span>`
- `<span style="font-family:'Brush Script MT';">Colored Text</span>`