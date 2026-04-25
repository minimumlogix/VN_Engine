# Story Template

This directory contains a standardized JSON template for creating new stories in the Visual Novel Engine.

## Files
- `story_template.json`: The core structure for a story, including metadata, characters, and dialogue.

## Key Features
- **{{user}} Macro**: Automatically replaced with the player's name.
- **Expressions**: Support for multi-sprite character states (e.g., `CHAR_ID:angry`).
- **SpriteEffects**: Built-in visual effects like `Scanlines`.
- **Flexible Styling**: Use HTML tags within dialogue text for rich formatting.

## Usage
1. Copy `story_template.json` to a new folder in `/stories/`.
2. Update the asset paths to point to your images and audio.
3. Define your characters and dialogue entries.

## Rules
1. `character`: `Character ID` + `:` + `Sprite ID` (e.g., `CHAR_ID:angry`).
2. `text`: Dialogue with HTML formatting support.
3. `SpriteEffects`: Visual effects to apply (e.g., `Scanlines`, `Shake`, `Pulse`).
4. `text2`: Dialogue with HTML formatting support.