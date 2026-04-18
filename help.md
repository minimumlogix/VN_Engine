📖 VN Engine: Advanced Developer DocumentationWelcome to the definitive guide for authoring custom stories in the VN Engine. This engine utilizes a strict JSON-driven architecture combined with an asynchronous HTML-parsing typewriter and dynamic asset preloading.If your data is formatted correctly, the engine handles the rest. If it's not, it will crash. Let's ensure the former.📑 Table of ContentsDirectory ArchitectureEngine ConfigurationThe Story Payload ([story].json)A. Global MetadataB. Chapter DictionariesC. Character RegistryD. The Dialogue SequenceAdvanced Engine MechanicsMulti-Sprite RenderingInline HTML & Typographical PacingMacro Event TokensEffects System1. Directory ArchitectureThe engine uses strict localized pathing. To ensure the preloader fetches assets correctly without CORS or 404 errors, your directory tree must look exactly like this:VN_Engine/
├── config.json                 # Global engine configuration
├── css/                        # Theme stylesheets (e.g., cyberpunk.css)
└── stories/
    └── your_story/             # 📁 The core story folder
        ├── your_story.json     # 📄 Main story payload
        └── assets/
            ├── audio/          # Background music and character SFX
            ├── images/         # Backgrounds and effects
            └── characters/     # Transparent PNG character sprites
💡 Execution Parameter: Load your story in the browser by appending the URL parameter ?story=your_story.2. Engine Configuration (config.json)The config.json file dictates the baseline operational parameters of the engine instance. If omitted, the engine falls back to hardcoded defaults.{
  "typingSpeed": 60,              // Base delay between characters (ms). Lower is faster.
  "autoSpeed": 5,                 // Modifier for AUTO read delay calculation.
  "sfxVolume": 0.5,               // Character vocal blip volume (0.0 - 1.0)
  "bgmVolume": 0.4,               // Background track volume (0.0 - 1.0)
  "typingSfxVolume": 0.1,         // Typewriter mechanical sound volume (0.0 - 1.0)
  "chapterTitleDuration": 1700,   // Display time for chapter interstitial screen (ms)
  "transitionTiming": 1000        // Fade in/out duration for chapter change (ms)
}
3. The Story PayloadThe core of your visual novel is the [story_name].json file. It must contain the following top-level objects and arrays.A. Global MetadataDefines the initialization parameters for the DOM UI.{
  "storyTitle": "NEON VEIL",
  "storySubtitle": "A Cyberpunk Tale",
  "theme": "cyberpunk.css",
  "loadScreenBackground": "stories/your_story/assets/images/loading_bg.jpg"
}
KeyTypeDescriptionstoryTitleStringRendered on the Start Menu with a cryptographic scramble effect.storySubtitleStringSubheading rendered directly below the main title.themeStringInjects the specified CSS file from the engine's /css directory.loadScreenBackgroundStringPath to the background image utilized for loading and end screens.B. Chapter DictionariesChapters require numerical string keys ("0", "1", etc.).⚠️ Architectural Override: Chapter "0" is strictly reserved for prologues. Assigning a dialogue to Chapter 0 will intentionally bypass the Chapter Transition Animation.{
  "chapterBackgrounds": {
    "0": "stories/your_story/assets/images/bg_dark.jpg",
    "1": "stories/your_story/assets/images/bg_city.jpg"
  },
  "chapterNames": {
    "1": "THE AWAKENING",
    "2": "DESCENT"
  },
  "chapterMusic": {
    "0": "",
    "1": "stories/your_story/assets/audio/bgm_city.mp3"
  }
}
C. Character RegistryEvery entity that appears on screen or speaks must be registered in the "characters" object. If a dialogue references a character not in this registry, the UI will fail to render the sprite."characters": {
  "SYS_ADMIN": {
    "name": "SYSTEM ALICE",
    "sprite": "stories/your_story/assets/characters/alice.png",
    "position": "left",
    "sfx": "stories/your_story/assets/audio/alice_blip.mp3"
  }
}
position Options: "left", "right", "center", or "middle".Note: Position is procedurally overridden if multiple characters are rendered simultaneously (see Advanced Mechanics).D. The Dialogue SequenceThe storyDialogue array is evaluated sequentially. This is the timeline of your visual novel."storyDialogue": [
  {
    "chapter": 1,
    "scene": 1,
    "character": "SYS_ADMIN",
    "text": "Initializing neural link...",
    "persistentEffect": "stories/your_story/assets/images/effects/rain.gif"
  }
]
KeyRequiredDescriptionchapterYesTriggers background/BGM changes and title cards if it differs from the previous index.sceneYesLogical grouping for state tracking.characterYesMatches a key in the Character Registry.textYesThe dialogue string. Supports HTML injection.effectNoBlocks execution to play a full-screen CSS/DOM effect.persistentEffectNoLoops an image/GIF in the background layer indefinitely.4. Advanced Engine MechanicsMulti-Sprite RenderingThe engine dynamically calculates CSS fractional slots if multiple characters are called in a single dialogue block.To summon multiple characters simultaneously, pass a comma-separated string or an array to the character key:"character": "TIA, EVA" 
// OR
"character": ["TIA", "EVA"]
Behavior: The UI joins their display names with an ampersand (TIA & EVA). It strips their default registry positions and recalculates their left CSS percentages to distribute them evenly across the viewport.Inline HTML & Typographical PacingThe typeWriter asynchronous loop parses raw HTML tokens instantaneously. This prevents HTML tags from being typed out character-by-character on screen.Text Styling: You can safely inject standard <span>, <b>, and <i> tags with inline CSS into the text string.Example: "The <b style='color:#00ffcc; text-shadow: 0 0 8px #00ffcc;'>Data Drive</b> is corrupted."Dynamic Pacing: To simulate natural human cadence, the engine automatically multiplies the typingSpeed delay when it encounters specific punctuation marks:Periods (.), Exclamation marks (!), Question marks (?) → Base delay × 15Commas (,) → Base delay × 8Macro Event TokensYou can inject synchronous logic events directly into the dialogue text using bracket notation.Syntax Example: "Get out of the blast radius! [shake]"Behavior: When the typewriter parser reaches [shake], it immediately fires effectsEngine.triggerMacro('shake') without breaking the text rendering loop.Effects SystemThe engine uses a dual-layer effect system to handle visual anomalies:effect (Overlay Engine): Triggers temporary, full-screen DOM effects (e.g., flashes, screen shakes). The engine pauses dialogue progression until the animation lifecycle resolves.persistentEffect (Background Engine): Mounts a looping image/GIF (e.g., static, snow, rain) onto the persistentEffectLayer. It runs continuously behind the sprites. It will only stop if it is explicitly overwritten, or cleared by passing an empty string "" in a subsequent dialogue block.Final Sanity Check: Validate your JSON through a linter before running it. A single missing quotation mark or trailing comma will result in a fatal SyntaxError upon initialization.
