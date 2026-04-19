/**
 * ENGINE_CONFIG.js — Centralized Configuration
 * All magic numbers, timings, and defaults are defined here for easy maintenance.
 * 
 * Load this file FIRST in index.html before other scripts.
 * Fallbacks are merged with loaded config.json at initialization.
 */

const ENGINE_CONFIG = {
    // ── Typing & Dialogue ─────────────────────────────────────────────────
    timing: {
        typingSpeed: 50,                        // ms delay per character
        autoProgressDelay: 1000,                // ms before auto-advancing
        autoSpeedModifier: 50,                  // Multiply reading time for auto mode
        chapterTransitionDuration: 1700,        // ms for chapter interstitial
        chapterTransitionFadeIn: 1000,          // ms for fade in/out
        typewriterGhostMinHeight: 100,          // Minimum height for layout lock
        spriteEntryAnimation: 600,              // ms for sprite entry animation
        dialogueQueueCheckInterval: 100,        // ms to check if paused
        effectOverlayFadeDelay: 400,            // ms before truly hiding overlay
    },

    // ── Audio ─────────────────────────────────────────────────────────────
    audio: {
        typingSoundPath: 'core_assets/audio/typing_loop.mp3',
        bgmVolume: 0.4,                         // Default BGM volume (0.0-1.0)
        sfxVolume: 0.5,                         // Default SFX volume (0.0-1.0)
        typingSfxVolume: 0.2,                   // Default typing sound volume
        crossfadeDuration: 1500,                // ms for BGM crossfade
        crossfadeSteps: 30,                     // Granularity of crossfade
        crossfadeStepTime: 50,                  // Derived: fadeDuration / steps
        sfxPoolSize: 8,                         // Number of concurrent SFX tracks
        preloadTimeout: 10000,                  // ms before forcing story launch
    },

    // ── Effects ───────────────────────────────────────────────────────────
    effects: {
        macroEffects: {
            'shake':        { duration: 600   },
            'glitch':       { duration: 1800  },
            'flash':        { duration: 200   },
            'blink':        { duration: 1400  },
            'electricuted': { duration: 1200  },
            'shadows':      { duration: 2200  },
            'earthquake':   { duration: 1800  },
            'heartbeat':    { duration: 1600  },
            'vhs':          { duration: 2500  },
            'drain':        { duration: 2000  },
            'nuke':         { duration: 3000  },
            'bloodsplatter':{ duration: 1600  },
            'shockwave':    { duration: 1000  },
            'hologram':     { duration: 3000  },
            'rage':         { duration: 2000  },
        },
        overlayEffects: {
            'GLITCH':       { duration: 2000  },
            'ELECTROCUTED': { duration: 1500  },
            'NUKE':         { duration: 3500  },
            'SHOCKWAVE':    { duration: 1200  },
            'PORTAL':       { duration: 2800  },
        },
        maxIntensity: 3,                        // Maximum effect intensity multiplier
    },

    // ── Particles ─────────────────────────────────────────────────────────
    particles: {
        count: 80,                              // Number of particles
        lineDistance: 120,                      // Max distance to draw connecting lines (px)
        velocityRange: 0.4,                     // Max velocity scalar
        radiusRange: { min: 0.5, max: 1.8 },   // Particle radius range
        alphaRange: { min: 0.1, max: 0.6 },    // Alpha range
        breathingIntensity: 0.3,                // Breathing effect intensity
    },

    // ── Screen & UI ───────────────────────────────────────────────────────
    screen: {
        maxHistorySize: 100,                    // Cap navigation history
        defaultDisplayMode: 'flex',             // Default CSS display for screens
        screenTransitionLockTimeout: 5000,      // Failsafe for transition lock
    },

    // ── Character Registry ────────────────────────────────────────────────
    character: {
        validPositions: ['left', 'right', 'center', 'middle'],
        defaultPosition: 'center',
        spriteEntryClass: 'active',
        spriteSettledAttribute: 'data-sprite-settled',
        spriteSettledDelay: 600,                // ms before marking settled
    },

    // ── Asset Management ──────────────────────────────────────────────────
    assets: {
        basePath: 'stories/',
        storyIdFromUrl: true,                   // Extract story ID from ?story= param
        legacyParam: 'storytitle',              // Fallback param name
        defaultStory: 'demo_anime',
        filenameMaxLength: 24,                  // For display in loader
    },

    // ── Logging ───────────────────────────────────────────────────────────
    logging: {
        enabled: true,
        prefix: '[VN-Engine]',
        colors: {
            info: '#6CF',
            success: '#0F0',
            warn: '#FA0',
            error: '#F00',
        },
    },

    // ── LocalStorage Prefix ───────────────────────────────────────────────
    persistence: {
        keyPrefix: 'lvne_',                     // localStorage key prefix
        keys: {
            globalAudioEnabled: 'globalAudioEnabled',
            sfxVolume: 'sfxVolume',
            bgmVolume: 'bgmVolume',
            typingSfxVolume: 'typingSfxVolume',
            typingSpeed: 'typingSpeed',
            autoSpeed: 'autoSpeed',
        },
    },
};

/**
 * Merge ENGINE_CONFIG with loaded config.json
 * Called after config.json is fetched in initializeApp()
 * @param {Object} loadedConfig - Config from config.json
 */
function mergeEngineConfig(loadedConfig) {
    if (!loadedConfig || typeof loadedConfig !== 'object') return;

    // Shallow merge top-level keys (don't deep-merge)
    Object.assign(ENGINE_CONFIG, loadedConfig);

    // Update derived values
    if (loadedConfig.typingSpeed !== undefined) {
        ENGINE_CONFIG.timing.typingSpeed = loadedConfig.typingSpeed;
    }
    if (loadedConfig.autoSpeed !== undefined) {
        ENGINE_CONFIG.timing.autoSpeedModifier = loadedConfig.autoSpeed;
    }
    if (loadedConfig.bgmVolume !== undefined) {
        ENGINE_CONFIG.audio.bgmVolume = loadedConfig.bgmVolume;
    }
    if (loadedConfig.sfxVolume !== undefined) {
        ENGINE_CONFIG.audio.sfxVolume = loadedConfig.sfxVolume;
    }
    if (loadedConfig.typingSfxVolume !== undefined) {
        ENGINE_CONFIG.audio.typingSfxVolume = loadedConfig.typingSfxVolume;
    }
    if (loadedConfig.chapterTitleDuration !== undefined) {
        ENGINE_CONFIG.timing.chapterTransitionDuration = loadedConfig.chapterTitleDuration;
    }
    if (loadedConfig.transitionTiming !== undefined) {
        ENGINE_CONFIG.timing.chapterTransitionFadeIn = loadedConfig.transitionTiming;
    }

    // Merge macro effect sound mappings
    if (loadedConfig.effectSfx && typeof loadedConfig.effectSfx === 'object') {
        for (const [effect, sfxPath] of Object.entries(loadedConfig.effectSfx)) {
            if (ENGINE_CONFIG.effects.macroEffects[effect]) {
                ENGINE_CONFIG.effects.macroEffects[effect].sfxPath = sfxPath;
            }
            // Also check overlayEffects for a match
            if (ENGINE_CONFIG.effects.overlayEffects[effect]) {
                ENGINE_CONFIG.effects.overlayEffects[effect].sfxPath = sfxPath;
            }
        }
    }
}
