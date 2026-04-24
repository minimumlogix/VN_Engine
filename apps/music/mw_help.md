# 🛰️ Nexus Music Bar 4.0 | Operative Manual

Welcome to the **Nexus Music Bar 4.0**, a high-performance, Nasapunk-styled audio playback widget engineered for deep integration into Visual Novel systems. This guide provides the technical specifications and deployment protocols for the widget.

---

## 📡 Core Features

- **Atmospheric UI**: Dynamic album art background with real-time blur and saturation effects.
- **YouTube Integration**: Support for single tracks, full playlists, and live streams.
- **Nasapunk Aesthetic**: Tactical grid overlays, cinematic telemetry, and glitch-responsive error handling.
- **Adaptive Controls**: Intelligent Volume Assembly that collapses to save screen real estate.
- **Telemetry System**: Real-time progress tracking, time displays, and loop-mode badges.

---

## 🛠️ Deployment & Uplink Parameters

The widget is controlled primarily through **URL Parameters**. You can chain these together to configure the system state upon initialization.

### 🎥 Media Source
- `v=[ID]`: Load a specific YouTube Video ID.
- `list=[ID]`: Load a YouTube Playlist ID.
- `index=[N]`: Start the playlist at index `N` (0-based).
- `shuffle=1`: Randomize the playlist sequence on startup.

### 🎨 Visual & Aesthetic
- `c=[HEX]`: Set the system accent color (e.g., `c=00ffcc` or `c=ff3300`).
- `title=[TEXT]`: Override the track name with custom data.
- `author=[TEXT]`: Override the credits label (bottom-left).

### ⚙️ System State
- `autoplay=1`: Engage audio sequence immediately upon link establishment.
- `vol=[0-100]`: Set the initial output decibels.
- `mute=1`: Initialize in a silent state.
- `repeat=[0|1|2]`: Set initial Loop Mode:
    - `0`: No Loop
    - `1`: **Loop All** (Playlist or Single)
    - `2`: **Loop One** (Current track only)

---

## 🛰️ Interface Protocols

### 🔊 Volume Management
Hover over (or tap) the **Volume Icon** on the right to reveal the tactical slider. The interface is "Sticky"—it will remain open while you are actively adjusting the levels and collapse once you've finished.

### 🔄 Loop Cycling
Click the **Repeat Icon** to cycle through modes:
1. **White/Dim**: Loop Off.
2. **Accent Color**: Loop Playlist/All.
3. **Accent + Badge "1"**: Loop Single Track.

### ⚠️ Error Protocols
If the system encounters a "Dead Link" or a Restricted Video, it will automatically enter **Failsafe Mode**.
- The UI will manifest **VHS Scanlines** and glitch effects.
- The system will attempt to load a **Rickroll Failsafe** to maintain audio output continuity.

---

## 📝 Example Uplinks

**High-Impact Combat Theme:**
`mw.html?v=dQw4w9WgXcQ&c=ff0000&vol=100&autoplay=1&title=BOSS_BATTLE`

**Awesome Wibe:**
`mw.html?v=PJWOv3taxMQ&c=ff0000&vol=100&autoplay=1&title=AWSOME%20WIBE`

**Relaxing Ambient Playlist:**
`mw.html?list=PLxyz123&c=00ffcc&shuffle=1&vol=40&author=Lofi_Nexus`

**Stealth Mission (Muted Start):**
`mw.html?v=id_here&mute=1&title=INFILTRATION`

---

> [!TIP]
> **Performance Note**: For the best visual experience, ensure your browser supports `backdrop-filter` and hardware acceleration for CSS animations.

> [!IMPORTANT]
> **Autoplay Warning**: Modern browsers may block `autoplay=1` unless the user has interacted with the page or the player is started with `mute=1`. If audio fails to start, a single click on the Play button will authorize the stream.

---
*End of Protocol. Nexus Systems v4.0.26*
