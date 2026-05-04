# Lore Engine

The **Lore Engine** is a high-fidelity, high-performance Visual Novel World Encyclopedia and Wiki system. It provides an immersive, component-driven, single-page application (SPA) designed to load and present complex lore, timelines, locations, factions, and details about fictional worlds dynamically from curated JSON data.

---

## 🛠 Features

- **Dynamic World Selection**: Load and display different game worlds via URL parameters (e.g., `?world=Etherealis` or `?world=Cyberpunk2011`).
- **Tab-Based Navigation**: Interactive categorized navigation tabs (Characters, Factions, Tech, Threats, Timelines, etc.).
- **Rich Interactive Timeline**: Scrollable interactive timeline view complete with GSAP micro-animations.
- **Deep Content Hierarchy**: Support for categories, sub-categories, detail views, and sub-races.
- **Lore Hyperlinking System**: Cross-link entries within the app via custom markdown anchors (`tab-` and `detail-`) to jump seamlessly between categories.
- **Aesthetic Visuals & Effects**: Premium dark mode design, custom wavy breathing scrollbars, and spoiler warnings to protect key narrative twists.

---

## 📂 Project Architecture

```
lore/
├── core/
│   ├── scripts/
│   │   ├── components/
│   │   │   ├── renderer.js       # Dynamic DOM generator, markdown parser, and state manager
│   │   │   └── ui.js             # Interaction logic, GSAP animations, custom scrollbars, & modals
│   │   ├── services/
│   │   │   └── dataService.js    # Data loading, UI state initialization, and error handling
│   │   └── main.js               # Application bootstrap and entry point
│   └── styles/
│       └── main.css              # Premium responsive Dark Mode theme and CSS layout rules
├── worlds/
│   ├── Cyberpunk2011/
│   │   └── world.json            # World dataset for Cyberpunk 2011 setting
│   └── Etherealis/
│       └── world.json            # World dataset for Etherealis fantasy setting
├── index.html                    # The HTML5 container shell
└── readme.md                     # This documentation file
```

---

## 🚀 How It Works

### 1. Data Fetching
When the page loads, `core/scripts/main.js` checks the browser URL for the `world` search parameter:
```javascript
const params = new URLSearchParams(window.location.search);
const worldName = params.get('world') || 'Etherealis';
```
It loads the appropriate JSON database at `./worlds/${worldName}/world.json`. If it doesn't find the data or runs into errors, an elegant error screen is displayed.

### 2. World Rendering & State Management
- `renderer.js` processes the world JSON and builds tabs, nested menus, grids, card views, and content sections using vanilla JavaScript.
- A stack-based **Global Tab History Cache** tracks navigation state, supporting fully interactive back/forward/home navigation within any lore tab context.

### 3. Markdown Support
The Lore Engine integrates **Marked.js** for markdown syntax highlighting and links. It also implements custom lore link syntax:
- `[Visual Novel Engine](tab-timeline "Timeline")` -> Clicks open the timeline tab.
- `[Major Event](detail-factions-0 "Faction details")` -> Navigates the history stack to a specific sub-entry in another category.

---

## 🎨 Creative Aesthetics

- **GSAP Tweens**: Smooth micro-animations for card hovers, modal popups, and tab switches.
- **Advanced Scrollbars**: Features a wave-masked ("breathing") custom scrollbar overlay for immersive long-form reading.
- **Short Screen Responsive Optimization**: Specifically configured with a media queries matrix (`@media (max-height: 550px)`) to provide fully usable layouts at compact screen sizes (400px height constraints).
