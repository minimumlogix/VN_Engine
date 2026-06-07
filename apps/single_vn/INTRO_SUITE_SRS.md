# Software Requirements Specification (SRS)
## Project: INTRO SUITE
**Document Version:** 1.0.0  
**Date:** June 4, 2026  
**Status:** Under Active Development  
**Target Platform:** Web Browsers (Visual Novel Story Engine companion)

---

## 1. Introduction & Overview

### 1.1 Purpose
**Intro Suite** is a visual, browser-based drag-and-drop landing page editor and component builder designed specifically for the **Visual Novel (VN) Story Engine**. It enables visual novel creators to design immersive, theme-compliant intro pages, loading screens, character hubs, and story portals. 

The suite abstracts HTML/CSS complexity, allowing creators to assemble responsive widgets, style text with a precision color picker, apply animations/effects, and export production-ready, minified HTML snippets that hook directly into the VN Engine.

### 1.2 System Context
Intro Suite resides within the `apps/single_vn/` subfolder of the VN Engine ecosystem. It functions as an authoring tool:
```
+------------------------------------------------------------+
|                     VN Engine Workspace                    |
|                                                            |
|  +---------------------+        +-----------------------+  |
|  |     Intro Suite     | =====> |   VN Story Engine     |  |
|  |   (Authoring Tool)  | Exports|  (Web/Iframe Player)  |  |
|  +---------------------+  Code  +-----------------------+  |
|                                                            |
+------------------------------------------------------------+
```

### 1.3 Key Objectives & Goals
- **Zero-Code Landing Pages**: Enable storytellers to build rich landing pages without needing frontend development expertise.
- **Theme Consistency**: Automatically align the style, color accents, and typography of landing pages with the active VN engine theme.
- **WYSIWYG Rich Text & Effects**: Provide inline editing for dialogue and text, complete with markdown rendering, custom text colors, gradients, and inline motion effects (glitch, shake, glow).
- **Performant Output**: Generate minified, single-line, copy-pasteable HTML that embeds perfectly into a VN story's index page.

---

## 2. Architecture & Technical Stack

### 2.1 Core Technologies
- **Markup & Structure**: HTML5 (utilizing semantic structures, `<canvas>`, and `<dialog>` overlays).
- **Styling**: Vanilla CSS3 with extensive use of CSS variables (Custom Properties) to support hot-swappable themes, flexbox/grid layouts, and `@keyframes` animations.
- **Logic**: Vanilla JavaScript (ES6+ modular design, event-driven state updates, DOM manipulation).
- **Typography & Assets**: Google Fonts (Pre-loaded family sets) and Bootstrap Icons (v1.11.3) for the user interface.

### 2.2 System State & Data Model
The editor state is represented as a linear array of canvas items:
```javascript
let canvasItems = [
  {
    id: 1717520000000,
    type: "image",
    "image-url": "https://.../cover.png"
  },
  {
    id: 1717520000001,
    type: "dialogue",
    "dialogue-text": "Welcome to the **Neon City**. [glitch]"
  }
];
```
- **Serialization**: The array is serialized to JSON for caching and minification purposes.
- **State Caching**: Automatically saved to the browser's `localStorage` under the key `nexus_intro_architect_state` to prevent data loss.

### 2.3 Modular File Breakdown
The application is structured into the following files inside `apps/single_vn/`:
1. `intro_editor.html`: The layout template containing the sidebar panel, canvas viewport, configuration modals, and rich text toolbar.
2. `js/intro_editor.js`: The central engine handling state, undo/redo stacks, inline edit listeners, markdown formatting, HTML compiling, and UI rendering.
3. `js/nexus_colorpicker.js`: A self-contained precision HSV color wheel module utilizing canvas rendering.
4. `styles/intro_editor.css`: UI layout styles for the editor interface, scrollbars, modals, and tabs.
5. `styles/nexus_colorpicker.css`: Stylesheet for the floating color picker interface.
6. `styles/intro_effects.css`: Contains keyframe animations for text effects (neon glow, glitch, shake, bounce, gradient loops).
7. `styles/vn_*.css`: Thematic stylesheets defining design tokens (primary colors, background overlays, borders) matching the VN story engine.

---

## 3. Theme Engine

Intro Suite integrates a hot-swappable styling layer defined by 13 custom stylesheets:

| Style File | Theme Name | Visual Aesthetic |
| :--- | :--- | :--- |
| `vn_yellow1.css` | Vibrant Yellow | High contrast neon yellow & dark gray |
| `vn_blue1.css` | Deep Blue | Ocean depths cyan & dark blue |
| `vn_fantasy1.css` | Fantasy Ethereal | Ethereal violet, gold, and magenta gradients |
| `vn_green1.css` | Cyber Green | Matrix-like hacker green & terminal black |
| `vn_maroon1.css` | Royal Maroon | Elegant dark red & velvet tones |
| `vn_orange1.css` | Classic Orange | Warm amber & industrial gray |
| `vn_pink1.css` | Soft Pink | Pastel cherry blossom pink & light gray accents |
| `vn_red1.css` | Crimson Red | Intense blood red & dark gothic colors |
| `vn_cyberpunk1.css` | Cyberpunk 2077 | Electric magenta, yellow, and cyan neon glow |
| `vn_nasapunk1.css` | Nasapunk | Starfield-inspired clean white, charcoal, & orange |
| `vn_steampunk1.css` | Victorian Steampunk| Brass, copper, vintage brown, & parchment colors |
| `vn_anime1.css` | Cinematic Anime | High-saturation sky blue, clouds, and clean panels |
| `vn_gothic1.css` | Victorian Gothic | Dark violet, silver, lace textures, & blood crimson |

### 3.1 Theme Variable System
Each theme stylesheet exposes a set of custom CSS variables applied globally to the canvas items:
```css
:root {
    --primary-color: #00f3ff;
    --bg-overlay: rgba(10, 15, 26, 0.95);
    --border-color: rgba(0, 243, 255, 0.2);
    --font-family: 'Orbitron', sans-serif;
    --accent: #ff00ff;
}
```
When a user updates the **Engine Theme** dropdown in the settings sidebar, the document's stylesheet link is dynamically re-pointed, updating the styling of the live canvas preview instantly.

---

## 4. Component Library Specification

The editor operates on a library of 6 components. Each component generates structured markup utilizing theme styles.

### 4.1 Full-Width Image
- **Description**: Spans the screen width (`100vw`) with an auto-adjusted height to present high-fidelity covers or title banners.
- **Fields**:
  - `Image URL` (Text): Source path of the image.
- **Generated HTML**:
  ```html
  <div class="vn-image-wrapper">
      <img src="[Image URL]">
  </div>
  ```

### 4.2 Music Player Widget
- **Description**: Embeds an invisible or custom-styled YouTube audio streaming frame.
- **Fields**:
  - `YouTube URL` (Text): Standard watch or share link.
- **Generated HTML**:
  ```html
  <iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/music/mw?v=[YT_ID]&c=[THEME_HEX]&ap=1" style="width:100%;height:75px;border:none"></iframe>
  ```
  *(Note: The `c` parameter passes the current theme's primary hex color to skin the widget's loader/visualizer).*

### 4.3 Character Hub
- **Description**: Displays character sprites side-by-side with name labels on top of a custom stage backdrop.
- **Fields**:
  - `Background Image URL` (Text): Stage backdrop.
  - `Characters` (Array of Rows):
    - `Character Name` (Text)
    - `Sprite Image URL` (Text)
- **Generated HTML**:
  ```html
  <div class="vn-character-container" style="background-image:url([bg-url])">
      <div class="vn-character-group">
          <div class="vn-character-name">[name]</div>
          <img alt="[name]" class="speaking vn-character" src="[sprite]">
      </div>
  </div>
  ```

### 4.4 Interactive VN Engine Portal
- **Description**: Embeds the main visual novel player inside the landing page.
- **Fields**:
  - `Story ID / URL` (Text): The path query for the story (e.g. `MHA:MHA_V1` or a full URL).
  - `Height (px)` (Number): Vertical bounds of the iframe (defaults to `450`).
- **Generated HTML**:
  ```html
  <iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine?story=[Story ID]" style="width:100%;height:[Height]px;border:none"></iframe>
  ```

### 4.5 Dialogue Box
- **Description**: Rich text display box mimicking visual novel textbox overlays. Supports inline HTML and custom markdown.
- **Fields**:
  - `Initial Dialogue` (Textarea): Content string containing text, formatting, and effects macros.
- **Generated HTML**:
  ```html
  <div class="vn-dialogue-box">
      <div class="vn-dialogue-content">
          [Parsed Text / HTML / Markdown]
      </div>
  </div>
  ```

### 4.6 Lore Database Widget
- **Description**: A collapsible `<details>` panel that streams world-building dossiers or database guides.
- **Fields**:
  - `Lore World / Link` (Text): Identifier (e.g., `Cyberpunk2011`) or custom URL.
  - `Height (px)` (Number): Height of the embedded lore database.
- **Generated HTML**:
  ```html
  <details class="vn-lore-details">
      <summary class="vn-lore-summary">
          <span>Lore Database</span>
          <svg class="vn-lore-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg>
      </summary>
      <div class="vn-lore-content">
          <iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/lore?world=[Lore Link]" style="width:100%;height:[Height]px;border:none;border-radius: 5px;"></iframe>
      </div>
  </details>
  ```

---

## 5. Rich Text Editor & Live Markdown Engine

A major feature of **Intro Suite** is its inline text formatting subsystem, which operates directly on `dialogue` content blocks.

### 5.1 Text Editing States
- **Display Mode**: Parses and displays the dialogue text as rendered HTML (converting markdown and formatting).
- **Source Mode (Inline Edit)**: Triggered by clicking inside the text box. The element displays raw source text (e.g., tags and raw asterisks) styled with color tokens and syntax highlights.

### 5.2 Rich Text Toolbar
A floating control bar appears when editing dialogue, exposing formatting tools:
1. **Bold / Italic**: Inserts standard markdown wrappers `**` / `*`. Keyboard shortcuts `Ctrl+B` and `Ctrl+I` are wired to these functions.
2. **Font Family**: Wraps selection in `<span style="font-family: '...'">`. Includes presets: Inter, Playfair Display, Orbitron, Cinzel, Montserrat, Special Elite, Dancing Script, Creepster, Press Start 2P, Lora.
3. **Text Shadow**: Wraps selection in `<span style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5)">`.
4. **Custom Color**: Wraps selection in `<span style="color: [color]">` by invoking the precision color wheel.
5. **Clear Formatting**: Strips all HTML formatting tags from the selection, reverting it to plain text.
6. **Insert Image**: Embeds an inline visual element via the `![image](url)` syntax.

### 5.3 Text Effects & Motion Macros
Creators can apply custom dynamic CSS classes to text selections:
- **Glitch (`effect-glitch`)**: Creates a shifting split-chromatic text overlay using CSS pseudo-elements (`::before`/`::after`) and keyframe animations.
- **Shake (`effect-shake`)**: Animates text coordinates horizontally/vertically to indicate impacts, yelling, or explosions.
- **Neon Glow (`effect-neon`)**: Applies a looping, intense text-shadow glow keyframed to shift colors or pulse.
- **Bounce (`effect-bounce`)**: Loops text up and down to convey a playful, lighthearted tone.
- **Gradient Loop (`effect-gradient-loop`)**: Applies a looping linear gradient animation using dynamic CSS variables `--grad-c1` and `--grad-c2`.

### 5.4 Gradient Designer Modal
A specialized designer window that allows creators to build custom text gradients:
- **Dual Stops**: Choose color values for Stop 1 and Stop 2.
- **Angle Range**: Range slider from `0°` to `360°` representing gradient direction.
- **Premium Palettes**: Preset gradient swatches (Cyberpunk, Sunset, Emerald, Royal, Golden, Frost, Midnight, Lush, Plasma, Aura).
- **Live Canvas Serialization**: Wraps selected text in:
  ```html
  <span style="background: linear-gradient([Angle]deg, [Color1], [Color2]); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; display: inline-block;">[Text]</span>
  ```

---

## 6. Precision Color Wheel (Nexus Color Picker)

The custom **Nexus Color Picker** provides an interactive HSV selection widget.

```
+------------------------------------+
|       Precision Color Wheel        |
|                                    |
|     / \   (Hue Outer Ring)         |
|    | * |  Adjusts state.h (0-360)  |
|     \ /                            |
|    +-----+ (SV Inner Box)          |
|    |  *  | Adjusts Saturation (s)  |
|    +-----+ & Value (v)             |
|                                    |
|  [===*===] (Brightness Slider)     |
|                                    |
|  Preview: [ #00F3FF ]    [ OK ]    |
|  Recent: [X] [X] [X] [X]           |
+------------------------------------+
```

### 6.1 Rendering Mechanism
- **Hue Ring**: Rendered on a 2D canvas context via a 360-degree radial loop drawing arc slices matched to their HSV colors.
- **SV Square**: A secondary canvas positioned inside the ring. It draws a horizontal white-to-hue gradient overlaid with a vertical transparent-to-black gradient.
- **V Slider**: A linear horizontal canvas rendering brightness scale starting from `#000` to the fully saturated color at current `h` and `s`.

### 6.2 Input & Calibration
- **Bidirectional Sync**: Dragging indicators on the canvases recalculates HSV values. These are normalized, converted to HEX and RGB, and instantly written into text boxes.
- **Recent Swatches**: Stores the last 5 used colors in local storage. Includes 6 static palette presets (Cyan, Green, Yellow, Red, Purple, White) for rapid prototyping.

---

## 7. History & Workspace Management

### 7.1 Undo & Redo (State History)
Implemented via the `HistoryManager` class:
- **Capacity**: Stores up to 50 historical states.
- **De-duplication**: Serialized JSON check prevents pushing duplicate consecutive states.
- **Stack Operations**:
  - `push(state)`: Clears the redo stack and registers new canvas snapshot.
  - `undo()`: Pops the current state into the redo stack and rolls back canvas to the previous frame.
  - `redo()`: Pops from the redo stack back into the undo stack and applies the forward state.
- **Shortcuts**: Listening for global window events:
  - `Ctrl+Z` maps to `historyManager.undo()`
  - `Ctrl+Y` maps to `historyManager.redo()`

### 7.2 Cache Purging
- **Clear Canvas**: Prompts the user before setting `canvasItems = []` and updating the DOM, allowing a fresh start.
- **Cache Purge**: Wipes `nexus_intro_architect_state` from browser `localStorage` and cleans the canvas viewport.

---

## 8. Compilation & Code Export

### 8.1 HTML Generation Algorithm
The editor iterates over `canvasItems` and formats them into an HTML string:
- **Minified Mode**: Strips line breaks, padding tabs, and empty spacing to generate a highly compressed string.
- **Raw/Pretty Mode**: Inserts line breaks (`\n`) and indent spacing (`    `) for human readability.
- **External Dependencies**: Generates a header block linking the active theme styling:
  ```html
  <link href="https://minimumlogix.github.io/VN_Engine/apps/single_vn/styles/[active_theme]" rel="stylesheet">
  ```

### 8.2 Clipboard Mechanism
- **Modern Clipboard API**: Checks for support of `navigator.clipboard.writeText(code)` for asynchronous, secure copying.
- **Fallback Copy**: Instantiates a hidden `<textarea>` element off-screen, writes the compiled code, selects it, executes `document.execCommand('copy')`, and disposes of the element.
- **User Notifications**: Spawns a sliding toast message (`.nexus-toast`) to confirm copy success.

---

## 9. Verification & Quality Assurance Plan

### 9.1 Visual Consistency Checks
- Verify that components adapt immediately when the theme stylesheet is switched in the dropdown.
- Check font alignment and responsiveness when the browser size is resized from mobile width (`320px`) to ultra-wide (`1920px+`).

### 9.2 Interaction Testing
- Perform rich text selections and check if the toolbar state (Bold, Italic, Font, and Color bars) updates to match the selection styling.
- Confirm keyboard shortcuts (`Ctrl+B`, `Ctrl+I`, `Ctrl+Z`, `Ctrl+Y`) operate in both contenteditable sections and standard textarea overlays.

### 9.3 Code Integration Walkthrough
- Build a layout containing a **Music Player**, a **Character Hub**, and a **Dialogue Box**.
- Copy the minified HTML payload, paste it inside a test landing page, and ensure all dynamic links (YouTube frames, backdrops, styling rules) resolve correctly.
