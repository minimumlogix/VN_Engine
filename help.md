# 🎭 VN ENGINE: Creator's Guide

**Welcome, storyteller!** This guide will help you create and publish a visual novel in 5 minutes, then show you how to add advanced features.

> **Status:** Engine v1.4 | No coding experience needed | Works with images, audio, and text

---

## 📚 Table of Contents

1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Your Story Structure](#your-story-structure)
3. [Adding Characters](#adding-characters)
4. [Writing Dialogue](#writing-dialogue)
5. [Themes & Styling](#themes--styling)
6. [Sound & Audio](#sound--audio)
7. [Advanced Features](#advanced-features)
8. [Troubleshooting](#troubleshooting)
9. [Copy-Paste Templates](#copy-paste-templates)

---

## Quick Start (5 minutes)

### Step 1: Create Your Story Folder

Inside the `stories/` folder, create a new folder for your story:

```
stories/
└── my_first_story/
    ├── my_first_story.json
    └── assets/
        ├── images/
        │   ├── backgrounds/
        │   ├── characters/
        │   └── effects/
        └── audio/
```

### Step 2: Create Your Story File

Create a file named `my_first_story.json` inside your story folder. Copy this minimal template:

```json
{
  "storyTitle": "My First Story",
  "theme": "basestyle.css",
  "loadScreenBackground": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920",
  "chapterBackgrounds": {
    "1": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920"
  },
  "characters": {
    "HERO": {
      "name": "Hero",
      "sprite": "https://via.placeholder.com/300x400/FF6B6B/FFFFFF?text=Hero",
      "position": "left",
      "sfx": ""
    },
    "FRIEND": {
      "name": "Friend",
      "sprite": "https://via.placeholder.com/300x400/4ECDC4/FFFFFF?text=Friend",
      "position": "right",
      "sfx": ""
    }
  },
  "storyDialogue": [
    {
      "chapter": 1,
      "scene": 1,
      "character": "HERO",
      "text": "It's finally time to tell you the truth."
    },
    {
      "chapter": 1,
      "scene": 2,
      "character": "FRIEND",
      "text": "The truth about what?"
    },
    {
      "chapter": 1,
      "scene": 3,
      "character": "HERO",
      "text": "That I've been waiting for this moment my whole life."
    }
  ]
}
```

### Step 3: Load Your Story

1. Open the engine in your browser: `index.html`
2. Add this to the URL: `?story=my_first_story`
3. Full URL looks like: `file:///path/to/VN_Engine/index.html?story=my_first_story`

**That's it!** Your story is now loading. You should see:
- Your story title on the start screen
- Two characters talking to each other
- Their dialogue appearing one line at a time

---

## Your Story Structure

Every story needs these parts:

### Story Metadata (The Basics)

```json
{
  "storyTitle": "My Story Title",
  "storySubtitle": "Optional: A subtitle",
  "theme": "cyberpunk.css",
  "loadScreenBackground": "stories/my_story/assets/images/load_screen.jpg"
}
```

**What each does:**
- **storyTitle** → Shown on the start menu
- **storySubtitle** → Smaller text below the title
- **theme** → Which visual style to use (see Themes section)
- **loadScreenBackground** → Background image while the story loads

### Chapter Backgrounds

Each chapter can have its own background image:

```json
{
  "chapterBackgrounds": {
    "1": "stories/my_story/assets/images/bedroom.jpg",
    "2": "stories/my_story/assets/images/city.jpg",
    "3": "stories/my_story/assets/images/forest.jpg"
  }
}
```

**Why chapters?** They help organize your story into sections. When the chapter number changes, the background changes and a title card appears.

### Chapter Names (Optional)

Give each chapter a title:

```json
{
  "chapterNames": {
    "1": "THE BEGINNING",
    "2": "THE REVELATION",
    "3": "THE END"
  }
}
```

### Chapter Music (Optional)

Add background music to each chapter:

```json
{
  "chapterMusic": {
    "1": "stories/my_story/assets/audio/bgm_peaceful.mp3",
    "2": "stories/my_story/assets/audio/bgm_dramatic.mp3"
  }
}
```

---

## Adding Characters

Every character who speaks or appears on screen must be registered first.

### Character Registry

```json
{
  "characters": {
    "ALICE": {
      "name": "Alice",
      "sprite": "stories/my_story/assets/characters/alice.png",
      "position": "left",
      "sfx": "stories/my_story/assets/audio/alice_voice.mp3"
    },
    "BOB": {
      "name": "Bob",
      "sprite": "stories/my_story/assets/characters/bob.png",
      "position": "right",
      "sfx": ""
    }
  }
}
```

**What each part does:**
- **ALICE** (all caps) → The character's ID. Use this in dialogue.
- **name** → What appears above the dialogue
- **sprite** → The character's image (PNG with transparent background works best)
- **position** → Where they appear: `"left"`, `"right"`, or `"center"`
- **sfx** → A sound that plays when they speak (optional — leave empty `""` to skip)

**Position Options:**
- `"left"` → Left side of the screen
- `"right"` → Right side of the screen
- `"center"` → Middle of the screen

### Multiple Characters at Once

To show 2+ characters on screen together, list them in the dialogue:

```json
{
  "character": "ALICE, BOB",
  "text": "We agree on this."
}
```

The engine automatically spaces them out. Their names appear joined with `&` (Alice & Bob).

---

## Writing Dialogue

Your story is made of a `storyDialogue` array — a list of dialogue lines in order.

### Basic Dialogue

```json
{
  "storyDialogue": [
    {
      "chapter": 1,
      "scene": 1,
      "character": "ALICE",
      "text": "Hello world."
    },
    {
      "chapter": 1,
      "scene": 2,
      "character": "BOB",
      "text": "Hello Alice."
    }
  ]
}
```

**What each field means:**
- **chapter** → Which chapter this line appears in (affects background & music)
- **scene** → Groups related lines together (just for organization)
- **character** → Must match a character from your registry
- **text** → What they say

### Adding Style to Text

Use HTML inside your dialogue to add colors, bold, italics:

```json
{
  "character": "ALICE",
  "text": "This is <b>bold</b> and this is <i>italic</i>."
}
```

**Advanced styling:**

```json
{
  "character": "ALICE",
  "text": "This is <span style='color: #FF0000;'>bright red</span> text."
}
```

```json
{
  "character": "ALICE",
  "text": "This is <b style='color: #00FF00; text-shadow: 0 0 8px #00FF00;'>glowing green</b>."
}
```

### Natural Pacing

The engine adds automatic pauses for punctuation to make reading feel natural:

```json
{
  "character": "ALICE",
  "text": "Wait. Is this really happening? I can't believe it! [shake]"
}
```

- Periods (.), question marks (?), exclamation marks (!) → Longer pause
- Commas (,) → Shorter pause
- `[shake]` → Special effect (see Advanced Features)

---

## Themes & Styling

The engine comes with different visual themes. Choose one in your metadata:

```json
{
  "theme": "cyberpunk.css"
}
```

### Available Themes

| Theme | Style | Try it |
|-------|-------|--------|
| `basestyle.css` | Clean, minimal | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_default) |
| `anime1.css` | Anime/manga aesthetic | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_anime) |
| `cyberpunk.css` | Neon noir sci-fi | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_cyberpunk1) |
| `fantasy.css` | Dark fantasy | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_fantasy) |
| `gothic.css` | Gothic horror | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_gothic) |
| `nasapunk.css` | Hard sci-fi space | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_nasapunk) |
| `warmui.css` | Cozy aesthetic | [Launch](https://minimumlogix.github.io/VN_Engine/?story=demo_warmui) |

**Tip:** Load each demo to see what your story will look like with that theme!

---

## Sound & Audio

### Character Voice Blips

When a character speaks, a short sound can play:

```json
{
  "characters": {
    "ALICE": {
      "name": "Alice",
      "sprite": "stories/my_story/assets/characters/alice.png",
      "position": "left",
      "sfx": "stories/my_story/assets/audio/alice_blip.mp3"
    }
  }
}
```

### Background Music

Add music to chapters:

```json
{
  "chapterMusic": {
    "1": "stories/my_story/assets/audio/chapter1_music.mp3",
    "2": "stories/my_story/assets/audio/chapter2_music.mp3"
  }
}
```

Music changes automatically when you switch chapters.

### Volume Control

Global volume settings are in `config.json`:

```json
{
  "bgmVolume": 0.4,
  "sfxVolume": 0.5,
  "typingSfxVolume": 0.1
}
```

- **bgmVolume** (0.0 - 1.0) → Background music volume
- **sfxVolume** (0.0 - 1.0) → Character voice blip volume
- **typingSfxVolume** (0.0 - 1.0) → Typewriter sound volume

**Default values are fine for most stories.** Only change if audio seems too loud or quiet.

---

## Advanced Features

### Macro Effects (Screen Effects)

Add cinematic effects inline to dialogue using `[effect_name]`:

```json
{
  "chapter": 1,
  "scene": 5,
  "character": "ALICE",
  "text": "Watch out! [shake] An earthquake just struck!"
}
```

**Available Effects:**

| Effect | What Happens | Use For |
|--------|--------------|---------|
| `[shake]` | Screen shakes | Earthquakes, impacts, tension |
| `[glitch]` | Digital distortion | Sci-fi, hacking, corruption |
| `[flash]` | Bright white flash | Explosions, bright lights |
| `[blink]` | Eyelid close/open | Transitions, dramatic moments |
| `[electricuted]` | Blue electric jitter | Lightning, electrical damage |
| `[shadows]` | Fade in from darkness | Character appearing |
| `[earthquake]` | Heavy ground shake | Earthquakes, heavy impacts |
| `[heartbeat]` | Zoom pulse | Tension, fear, excitement |
| `[vhs]` | VHS tape distortion | Retro, broken tech |
| `[drain]` | Color drains to gray | Loss, death, corruption |
| `[nuke]` | Blinding white explosion | Nuclear blast, bright impact |
| `[bloodsplatter]` | Red vignette burst | Violence, injury, horror |
| `[shockwave]` | Radial ripple | Explosions, energy release |
| `[hologram]` | Flickering scanlines | Holograms, glitchy tech |
| `[rage]` | Red shake with saturation | Anger, rage, intensity |

### Persistent Effects (Looping Backgrounds)

Add a looping image or GIF behind characters (for rain, snow, fire, etc.):

```json
{
  "chapter": 2,
  "scene": 3,
  "character": "ALICE",
  "text": "The storm is getting worse.",
  "persistentEffect": "stories/my_story/assets/images/effects/rain.gif"
}
```

The effect keeps looping until:
- You change chapters, OR
- You specify a different `persistentEffect`, OR
- You clear it with an empty string: `"persistentEffect": ""`

**To remove an effect:**

```json
{
  "chapter": 2,
  "scene": 5,
  "character": "ALICE",
  "text": "The rain stopped.",
  "persistentEffect": ""
}
```

### HTML Styling in Text

Make text pop with colors and shadows:

```json
{
  "character": "ALICE",
  "text": "The <b style='color: #00FFFF; text-shadow: 0 0 10px #00FFFF;'>neon lights</b> flickered."
}
```

**Common HTML tags:**
- `<b>bold text</b>`
- `<i>italic text</i>`
- `<u>underlined text</u>`
- `<span style='...'>custom style</span>`

---

## Troubleshooting

### Problem: "Blank screen" or "Story won't load"

**Check these:**
1. **Story ID matches folder name** — If folder is `my_story/`, URL should have `?story=my_story`
2. **JSON syntax is valid** — Copy your story JSON to [jsonlint.com](https://jsonlint.com) and check for errors
3. **All paths are correct** — If you reference `stories/my_story/assets/images/bg.jpg`, does that file exist?
4. **Browser console for errors** — Press F12, go to "Console" tab, look for red error messages

### Problem: "Characters not showing"

**Check these:**
1. **Character is in registry** — Every character in dialogue must be registered in `"characters"`
2. **Character ID matches exactly** — If you defined `"ALICE"`, use `"ALICE"` in dialogue (case-sensitive)
3. **Sprite image URL is valid** — Try opening the image URL directly in your browser
4. **Image file exists** — Check that the file path is correct

### Problem: "Dialogue won't progress" or "Stuck on one line"

**Check these:**
1. **JSON syntax error** — Missing comma, extra bracket? Validate at [jsonlint.com](https://jsonlint.com)
2. **Character mismatch** — Is the character defined in your registry?
3. **Try a different browser** — Sometimes refreshing (Ctrl+F5) helps

### Problem: "Music or sounds not playing"

**Check these:**
1. **Audio file URL is valid** — Does the path work when you open it directly?
2. **Volume isn't muted** — Check `config.json` and browser volume
3. **File format supported** — Use `.mp3` for best compatibility
4. **Browser allows audio** — Some browsers block sound on first visit; click "Allow"

### Problem: "Effects not working" or "Typo in effect name"

**Check this:**
1. **Effect name is exact** — Use `[shake]`, not `[Shake]` or `[SHAKE]`
2. **Syntax is correct** — Effect goes in text like: `"The ground shook [shake]"`

### Problem: JSON file won't validate

**Common mistakes:**
- Missing comma between fields: `"storyTitle": "Test" "theme": "css"` ← WRONG
- Single quotes instead of double quotes: `'storyTitle'` ← WRONG
- Trailing comma in last item: `{"name": "Alice",}` ← WRONG
- Extra/missing brackets or braces

**Solution:** Paste your JSON into [jsonlint.com](https://jsonlint.com) — it will tell you exactly where the error is.

---

## Copy-Paste Templates

### Template 1: Minimal Story (Fastest)

Use this if you want to test quickly with placeholder images:

```json
{
  "storyTitle": "My Story",
  "theme": "basestyle.css",
  "loadScreenBackground": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920",
  "chapterBackgrounds": {
    "1": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920"
  },
  "characters": {
    "CHAR1": {
      "name": "Character One",
      "sprite": "https://via.placeholder.com/300x400/FF6B6B/FFFFFF?text=Char1",
      "position": "left",
      "sfx": ""
    },
    "CHAR2": {
      "name": "Character Two",
      "sprite": "https://via.placeholder.com/300x400/4ECDC4/FFFFFF?text=Char2",
      "position": "right",
      "sfx": ""
    }
  },
  "chapterMusic": {},
  "storyDialogue": [
    { "chapter": 1, "scene": 1, "character": "CHAR1", "text": "Hello there." },
    { "chapter": 1, "scene": 1, "character": "CHAR2", "text": "Hi! How are you?" },
    { "chapter": 1, "scene": 1, "character": "CHAR1", "text": "I'm doing great!" }
  ]
}
```

**How to use:**
1. Copy this entire JSON
2. Paste into your `my_story.json` file
3. Change `"storyTitle"` to your story name
4. Load with `?story=my_story`
5. Then customize characters, text, and add your own images

---

### Template 2: Full Story (3 Chapters, Effects)

Use this for a more complete story with music, effects, and styling:

```json
{
  "storyTitle": "The Grand Adventure",
  "storySubtitle": "An Epic Tale",
  "theme": "fantasy.css",
  "loadScreenBackground": "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=1920",
  "chapterBackgrounds": {
    "1": "https://images.unsplash.com/photo-1440964829947-ca3277bd37f8?w=1920",
    "2": "https://images.unsplash.com/photo-1504851149312-7a075b496cc7?w=1920",
    "3": "https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=1920"
  },
  "chapterNames": {
    "1": "THE BEGINNING",
    "2": "THE CHALLENGE",
    "3": "THE REVELATION"
  },
  "chapterMusic": {
    "1": "https://cdn.pixabay.com/download/audio/2022/01/20/audio_5be6f9fa34.mp3?filename=cyberpunk-synthwave-123271.mp3",
    "2": "https://cdn.pixabay.com/download/audio/2022/01/20/audio_5be6f9fa34.mp3?filename=cyberpunk-synthwave-123271.mp3"
  },
  "characters": {
    "HERO": {
      "name": "The Hero",
      "sprite": "https://via.placeholder.com/300x400/FF6B6B/FFFFFF?text=Hero",
      "position": "left",
      "sfx": ""
    },
    "SAGE": {
      "name": "The Sage",
      "sprite": "https://via.placeholder.com/300x400/9D84B7/FFFFFF?text=Sage",
      "position": "right",
      "sfx": ""
    },
    "VILLAIN": {
      "name": "The Villain",
      "sprite": "https://via.placeholder.com/300x400/2C3E50/FFFFFF?text=Villain",
      "position": "center",
      "sfx": ""
    }
  },
  "storyDialogue": [
    {
      "chapter": 1,
      "scene": 1,
      "character": "SAGE",
      "text": "The darkness is spreading. Only you can stop it."
    },
    {
      "chapter": 1,
      "scene": 2,
      "character": "HERO",
      "text": "I will <b style='color: #FFD700;'>never</b> back down."
    },
    {
      "chapter": 1,
      "scene": 3,
      "character": "SAGE",
      "text": "Your courage will be tested."
    },
    {
      "chapter": 2,
      "scene": 1,
      "character": "VILLAIN",
      "text": "You dare challenge me? [rage]"
    },
    {
      "chapter": 2,
      "scene": 2,
      "character": "HERO",
      "text": "I do. [shake]"
    },
    {
      "chapter": 2,
      "scene": 3,
      "character": "VILLAIN",
      "text": "Foolish! [glitch]"
    },
    {
      "chapter": 3,
      "scene": 1,
      "character": "HERO",
      "text": "It's over."
    },
    {
      "chapter": 3,
      "scene": 2,
      "character": "SAGE",
      "text": "You've saved us all. Thank you, brave hero."
    },
    {
      "chapter": 3,
      "scene": 3,
      "character": "HERO",
      "text": "The real adventure begins now. [heartbeat]"
    }
  ]
}
```

---

### Quick Reference: JSON Structure

Every story needs this structure (order doesn't matter):

```json
{
  "storyTitle": "Your Title Here",
  "theme": "basestyle.css",
  "loadScreenBackground": "image URL",
  "chapterBackgrounds": { "1": "image URL", "2": "image URL" },
  "chapterNames": { "1": "CHAPTER 1 TITLE", "2": "CHAPTER 2 TITLE" },
  "chapterMusic": { "1": "audio URL", "2": "audio URL" },
  "characters": {
    "CHARACTER_ID": {
      "name": "Display Name",
      "sprite": "image URL",
      "position": "left | right | center",
      "sfx": "audio URL or empty string"
    }
  },
  "storyDialogue": [
    {
      "chapter": 1,
      "scene": 1,
      "character": "CHARACTER_ID",
      "text": "What they say",
      "persistentEffect": "image/gif URL (optional)"
    }
  ]
}
```

---

## Need Help?

1. **JSON broken?** → [jsonlint.com](https://jsonlint.com)
2. **Image won't load?** → Check the URL by opening it in a new browser tab
3. **Story doesn't appear?** → Press F12, go to Console tab, look for red errors
4. **Try a demo first** → Load one of our demo stories to see what's possible

**Happy creating! 🎭**
