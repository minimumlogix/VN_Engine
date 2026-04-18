// ============================================================================
// ADVANCED CHAPTER MANAGER - Professional-Grade Implementation
// ============================================================================
class ChapterManager {
    constructor() {
        this.currentChapter = 1;
        this.previousChapter = null;
        this.isTransitioning = false;
        this.transitionQueue = [];
        this.logger = new Logger('ChapterManager');
        this.cache = {
            backgrounds: {},
            music: {},
            transitionTiming: 300 // ms for visual transition
        };
    }

    /**
     * Perform theme-aware chapter change with full validation
     */
    async changeChapter(newChapter, chapterData) {
        if (this.isTransitioning) {
            this.logger.warn(`Transition already in progress, queueing chapter ${newChapter}`);
            return new Promise(resolve => {
                this.transitionQueue.push({ chapter: newChapter, data: chapterData, resolve });
            });
        }

        if (newChapter === this.currentChapter) {
            this.logger.debug(`Already on chapter ${newChapter}, skipping`);
            return;
        }

        this.isTransitioning = true;

        try {
            this.previousChapter = this.currentChapter;
            this.currentChapter = newChapter;

            // Sequential rendering: Background & Music first
            await Promise.all([
                this._updateBackground(newChapter, chapterData),
                this._updateMusic(newChapter, chapterData)
            ]);

            // Followed by the chapter transition animation
            await this._showTransitionAnimation(newChapter, chapterData);

            this.logger.success(`Chapter ${newChapter} transition complete`);

            // Process queued transitions
            if (this.transitionQueue.length > 0) {
                const { chapter, data, resolve } = this.transitionQueue.shift();
                this.isTransitioning = false;
                resolve(await this.changeChapter(chapter, data));
            }
        } catch (error) {
            this.logger.error(`Chapter transition failed:`, error);
            this.currentChapter = this.previousChapter;
        } finally {
            this.isTransitioning = false;
        }
    }

    /**
     * Update background with cache busting and validation
     */
    async _updateBackground(chapter, chapterData) {
        try {
            const backgroundUrl = chapterData?.chapterBackgrounds?.[chapter];
            
            if (!backgroundUrl) {
                throw new Error(`No background found for chapter ${chapter}`);
            }

            // Cache busting for GIFs
            const finalUrl = backgroundUrl.includes('.gif') 
                ? `${backgroundUrl}?cache=${Date.now()}` 
                : backgroundUrl;

            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => {
                    elements.storyScreen.style.backgroundImage = `url('${finalUrl}')`;
                    this.cache.backgrounds[chapter] = finalUrl;
                    this.logger.success(`Background loaded: Chapter ${chapter}`);
                    resolve();
                };
                img.onerror = () => {
                    this.logger.error(`Failed to load background: ${backgroundUrl}, keeping previous background.`);
                    resolve(); // Safely resolve immediately to not break transition pipeline
                };
                img.src = finalUrl;
            });
        } catch (error) {
            this.logger.error(`Background update failed:`, error);
            // Fallback: silently continue with current background instead of crashing
        }
    }

    /**
     * Update music with error recovery
     */
    async _updateMusic(chapter, chapterData) {
        try {
            const musicUrl = chapterData?.chapterMusic?.[chapter];
            
            if (!musicUrl) {
                this.logger.debug(`No music defined for chapter ${chapter}`);
                return;
            }

            if (audioManager) {
                audioManager.playBackgroundMusic(musicUrl);
                this.cache.music[chapter] = musicUrl;
                this.logger.success(`Music updated: Chapter ${chapter}`);
            }
        } catch (error) {
            this.logger.warn(`Music update failed:`, error);
            // Don't reject, music is non-critical
        }
    }

    /**
     * Advanced theme-aware transition animation
     */
    async _showTransitionAnimation(chapter, chapterData) {
        if (parseInt(chapter) === 0) {
            this.logger.debug(`Skipping transition animation for chapter 0`);
            return Promise.resolve();
        }
        try {
            const el = document.getElementById('chapterTransition');
            if (!el) throw new Error('Transition element not found in DOM');

            const theme = this._getCurrentTheme();
            const chapterTitle = this._getChapterTitle(chapter, chapterData);

            return new Promise((resolve) => {
                // Build transition content
                el.innerHTML = `
                    <div class="chapter-transition-content">
                        <div class="chapter-number">${chapter}</div>
                        <h1 class="chapter-title">${chapterTitle}</h1>
                        <div class="chapter-divider"></div>
                    </div>
                `;

                el.style.display = 'flex';
                el.classList.add('active', `theme-${theme}`);

                // Staggered animation timing for visual polish
                requestAnimationFrame(() => {
                    el.classList.add('fade-in');
                });

                setTimeout(() => {
                    el.classList.remove('fade-in');
                    el.classList.add('fade-out');

                    setTimeout(() => {
                        el.style.display = 'none';
                        el.classList.remove('active', 'fade-out', `theme-${theme}`);
                        resolve();
                    }, this.cache.transitionTiming);
                }, state.chapterTitleDuration); // Display duration
            });
        } catch (error) {
            this.logger.error(`Transition animation failed:`, error);
            // Don't reject, animation is visual-only
        }
    }

    /**
     * Extract theme from loaded CSS or state
     */
    _getCurrentTheme() {
        const themeLink = document.getElementById('themeStylesheet');
        if (themeLink?.href) {
            return themeLink.href.match(/(\w+)\.css/)?.[1] || 'default';
        }
        return state.storyData?.theme?.replace('.css', '') || 'default';
    }

    /**
     * Generate chapter title dynamically
     */
    _getChapterTitle(chapter, chapterData) {
        if (chapterData?.chapterNames && chapterData.chapterNames[chapter]) {
            return chapterData.chapterNames[chapter];
        }
        return `CHAPTER ${chapter}`;
    }

    /**
     * Get current status for debugging
     */
    getStatus() {
        return {
            currentChapter: this.currentChapter,
            previousChapter: this.previousChapter,
            isTransitioning: this.isTransitioning,
            queuedTransitions: this.transitionQueue.length,
            cachedBackgrounds: Object.keys(this.cache.backgrounds).length
        };
    }
}

/**
 * Professional logging system with color-coded output
 */
class Logger {
    constructor(prefix = 'App') {
        this.prefix = prefix;
        this.levels = {
            DEBUG: { color: '#888', icon: '⚙' },
            INFO: { color: '#0066cc', icon: 'ℹ' },
            SUCCESS: { color: '#00aa00', icon: '✓' },
            WARN: { color: '#ff9900', icon: '⚠' },
            ERROR: { color: '#ff3333', icon: '✕' }
        };
    }

    _format(level, message, data = null) {
        const levelInfo = this.levels[level] || this.levels.INFO;
        const timestamp = new Date().toLocaleTimeString();
        const formatted = `%c[${timestamp}] ${levelInfo.icon} ${this.prefix}: ${message}`;
        const style = `color: ${levelInfo.color}; font-weight: bold;`;
        
        if (data) {
            console.log(formatted, style, data);
        } else {
            console.log(formatted, style);
        }
    }

    debug(message, data) { this._format('DEBUG', message, data); }
    info(message, data) { this._format('INFO', message, data); }
    success(message, data) { this._format('SUCCESS', message, data); }
    warn(message, data) { this._format('WARN', message, data); }
    error(message, data) { this._format('ERROR', message, data); }
}

// Initialize managers
const chapterManager = new ChapterManager();
const appLogger = new Logger('VN-Engine');

// ============================================================================
// CONSTANTS & CORE CONFIGURATION
// ============================================================================
const TYPING_SPEED = 50;
const AUTO_PROGRESS_DELAY = 1000;

// ============================================================================
const elements = {
    storyScreen: document.getElementById('storyScreen'),
    endScreen: document.getElementById('endScreen'),
    menuIcon: document.getElementById('menuIcon'),
    muteIcon: document.getElementById('muteIcon'),
    menuOverlay: document.getElementById('menuOverlay'),
    settingsOverlay: document.getElementById('settingsOverlay'),
    settingsBtn: document.getElementById('settingsBtn'),
    fullscreenBtn: document.getElementById('fullscreenBtn'),
    characterSpriteContainer: document.getElementById('characterSpriteContainer'),
    dialogueContainer: document.querySelector('.dialogue-container'),
    typedText: document.getElementById('typedText'),
    dialogueOptions: document.getElementById('dialogueOptions'),
    endOptions: document.getElementById('endOptions'),
    characterName: document.getElementById('characterName'),
    textSpeedInput: document.getElementById('textSpeed'),
    autoSpeedInput: document.getElementById('autoSpeed'),
    sfxVolumeInput: document.getElementById('sfxVolume'),
    typingSfxVolumeInput: document.getElementById('typingSfxVolume'),
    bgmVolumeInput: document.getElementById('bgmVolume'),
    effectOverlay: document.getElementById('effectOverlay'),
    overlayContainer: document.getElementById('overlayContainer'),
    overlayTitle: document.getElementById('overlayTitle'),
    overlayFrame: document.getElementById('overlayFrame'),
    closeOverlay: document.getElementById('closeOverlay'),
    persistentEffectLayer: document.getElementById('persistentEffectLayer'),
    chapterTransition: document.getElementById('chapterTransition')
};

// State
const state = {
    isTyping: false,
    currentDialogue: '',
    currentCharacter: null,
    typingSpeed: TYPING_SPEED,
    autoSpeed: 50,
    chapterTitleDuration: 1800,
    currentDialogueIndex: 0,
    skipRequested: false,   // Advanced Typewriter skip state
    typingInstanceId: 0,    // Hard-cancel identifier for the async type engine
    autoProgressTimeout: null,
    dialogueHistory: [],
    currentChapter: 1,
    currentScene: 1,
    isAutoMode: false,
    isEffectPlaying: false,
    isPaused: false,
    storyData: null,
    characters: null,
    chapterMusic: null,
    chapterBackgrounds: null,
    chapterNames: null,
    storyBasePath: ''   // e.g. "stories/demo_anime/" — prefix for local assets
};

// Effects definition moved to effects.js

// Initialize the application
async function initializeApp() {
    try {
        const configResponse = await fetch('config.json');
        if (configResponse.ok) {
            const config = await configResponse.json();
            
            if (localStorage.getItem('lvne_typingSpeed') === null) state.typingSpeed = config.typingSpeed ?? 50;
            else state.typingSpeed = parseInt(localStorage.getItem('lvne_typingSpeed'));
            
            if (localStorage.getItem('lvne_autoSpeed') === null) state.autoSpeed = config.autoSpeed ?? 50;
            else state.autoSpeed = parseInt(localStorage.getItem('lvne_autoSpeed'));

            if (localStorage.getItem('lvne_sfxVolume') === null) audioManager.setSfxVolume(config.sfxVolume ?? 0.5);
            if (localStorage.getItem('lvne_bgmVolume') === null) audioManager.setBgmVolume(config.bgmVolume ?? 0.4);
            if (localStorage.getItem('lvne_typingSfxVolume') === null) audioManager.setTypingSfxVolume(config.typingSfxVolume ?? 0.2);
            
            chapterManager.cache.transitionTiming = config.transitionTiming ?? 300;
            state.chapterTitleDuration = config.chapterTitleDuration ?? 1800;
        }
    } catch (e) {
        appLogger.warn('No config.json found or failed to load. Using hardcoded defaults.', e);
    }

    const urlParams = new URLSearchParams(window.location.search);
    // Support both ?story= (new) and legacy ?storytitle=
    const storyName = urlParams.get('story') || urlParams.get('storytitle') || 'demo_anime';
    loadStoryData(storyName);
}

// Load story data from JSON file, then preload all assets
function loadStoryData(storyName) {
    updateLoaderStatus('Fetching story data...');
    appLogger.info(`Loading story: ${storyName}`);

    // Stories live in stories/{storyName}/{storyName}.json
    const storyBasePath = `stories/${storyName}/`;
    state.storyBasePath = storyBasePath;

    fetch(`${storyBasePath}${storyName}.json`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`[HTTP ${response.status}] Failed to fetch story data`);
            }
            return response.json();
        })
        .then(data => {
            // Validate JSON structure
            if (!data.storyDialogue || !Array.isArray(data.storyDialogue)) {
                throw new Error("Invalid JSON: 'storyDialogue' must be an array");
            }
            if (!data.characters || typeof data.characters !== 'object') {
                throw new Error("Invalid JSON: 'characters' must be an object");
            }

            appLogger.success(`Story metadata loaded successfully`);

            state.storyTitle = data.storyTitle || "STORY TITLE";
            state.storySubtitle = data.storySubtitle || "";
            state.storyData = data.storyDialogue;
            state.characters = data.characters;
            state.chapterMusic = data.chapterMusic || {};
            state.chapterBackgrounds = data.chapterBackgrounds || {};
            state.chapterNames = data.chapterNames || {};
            state.loadScreenBackground = data.loadScreenBackground;

            // ─ Normalize chapter keys to integers for reliable access ─
            const normalizedBackgrounds = {};
            for (const k in state.chapterBackgrounds) {
                const numKey = parseInt(k);
                if (!isNaN(numKey)) {
                    normalizedBackgrounds[numKey] = state.chapterBackgrounds[k];
                }
            }
            state.chapterBackgrounds = normalizedBackgrounds;
            appLogger.info(`Registered ${Object.keys(normalizedBackgrounds).length} chapter backgrounds`);

            const normalizedMusic = {};
            for (const k in state.chapterMusic) {
                const numKey = parseInt(k);
                if (!isNaN(numKey)) {
                    normalizedMusic[numKey] = state.chapterMusic[k];
                }
            }
            state.chapterMusic = normalizedMusic;
            appLogger.info(`Registered ${Object.keys(normalizedMusic).length} chapter music tracks`);

            const normalizedNames = {};
            for (const k in state.chapterNames) {
                const numKey = parseInt(k);
                if (!isNaN(numKey)) {
                    normalizedNames[numKey] = state.chapterNames[k];
                }
            }
            state.chapterNames = normalizedNames;
            appLogger.info(`Registered ${Object.keys(normalizedNames).length} chapter names`);

            // ─ Apply theme ─
            if (data.theme) {
                const themeHref = data.theme.startsWith('css/') ? data.theme : `css/${data.theme}`;
                document.getElementById('themeStylesheet').href = themeHref;
                appLogger.success(`Theme applied: ${data.theme}`);
            }

            // ─ Set loading screen background ─
            if (data.loadScreenBackground) {
                const ls = document.getElementById('loadingScreen');
                if (ls) {
                    ls.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.4) 100%), url('${data.loadScreenBackground}')`;
                    ls.style.backgroundSize = 'cover';
                    ls.style.backgroundPosition = 'center';
                }
            }

            // ─ Collect and preload assets ─
            updateLoaderStatus('Preloading assets...');
            const assets = collectAssetUrls(data);
            appLogger.info(`Preloading ${assets.length} assets`);
            
            preloadAssets(assets, () => {
                finishLoading();
                setupEventListeners();
                setupCharacterSprites();
                setupAdditionalElements();
                syncVolumes();
                appLogger.success(`Application fully initialized`);
            });
        })
        .catch(error => {
            appLogger.error(`Story loading failed: ${error.message}`);
            console.error(error);
            loadFallbackData();
        });
}

// Collect all preloadable URLs from the story data
function collectAssetUrls(data) {
    const urls = [];

    // Load background
    if (data.loadScreenBackground) urls.push({ url: data.loadScreenBackground, type: 'image' });

    // Chapter backgrounds
    if (data.chapterBackgrounds) {
        Object.values(data.chapterBackgrounds).forEach(bg => urls.push({ url: bg, type: 'image' }));
    }

    // Character sprites & SFX
    if (data.characters) {
        Object.values(data.characters).forEach(c => {
            if (c.sprite) urls.push({ url: c.sprite, type: 'image' });
            if (c.sfx && !c.sfx.startsWith('/path/')) urls.push({ url: c.sfx, type: 'audio' });
        });
    }

    // Chapter music
    if (data.chapterMusic) {
        Object.values(data.chapterMusic).forEach(m => urls.push({ url: m, type: 'audio' }));
    }

    // Persistent effects (GIFs) from dialogue
    if (data.storyDialogue) {
        data.storyDialogue.forEach(d => {
            if (d.persistentEffect) urls.push({ url: d.persistentEffect, type: 'image' });
        });
    }

    return urls;
}

// Preload assets with progress tracking
function preloadAssets(assets, onComplete) {
    if (assets.length === 0) { onComplete(); return; }

    // De-duplicate URLs
    const uniqueAssets = [];
    const seenUrls = new Set();
    assets.forEach(a => {
        if (!seenUrls.has(a.url)) {
            seenUrls.add(a.url);
            uniqueAssets.push(a);
        }
    });

    if (uniqueAssets.length === 0) { onComplete(); return; }

    let loaded = 0;
    let hasCompleted = false;
    const total = uniqueAssets.length;

    // Create a hidden container for caching to prevent garbage collection
    let preloadCol = document.getElementById('preloadContainer');
    if (!preloadCol) {
        preloadCol = document.createElement('div');
        preloadCol.id = 'preloadContainer';
        preloadCol.style.display = 'none';
        document.body.appendChild(preloadCol);
    }

    const fireComplete = () => {
        if (hasCompleted) return;
        hasCompleted = true;
        updateLoaderStatus('Systems online. Launching...');
        setTimeout(onComplete, 600);
    };

    const updateProgress = (label) => {
        if (hasCompleted) return;
        loaded++;
        const pct = Math.round((loaded / total) * 100);
        updateLoaderProgress(pct, label);
        if (loaded >= total) {
            fireComplete();
        }
    };

    // Failsafe overarching timeout (10 seconds)
    setTimeout(() => {
        if (!hasCompleted) {
            console.warn("Preloading timed out, forcing story launch.");
            fireComplete();
        }
    }, 10000);

    uniqueAssets.forEach(asset => {
        if (asset.type === 'image') {
            const img = new Image();
            img.onload = () => updateProgress(getFilename(asset.url));
            img.onerror = () => updateProgress(getFilename(asset.url) + ' (skip)');
            img.src = asset.url;
            preloadCol.appendChild(img);
        } else if (asset.type === 'audio') {
            const mediaObj = new Audio();
            mediaObj.oncanplaythrough = () => updateProgress(getFilename(asset.url));
            mediaObj.onerror = () => updateProgress(getFilename(asset.url) + ' (skip)');
            mediaObj.preload = 'auto';
            mediaObj.src = asset.url;
            preloadCol.appendChild(mediaObj);
        } else {
            updateProgress('unknown');
        }
    });
}

function getFilename(url) {
    try { return decodeURIComponent(url.split('/').pop().split('?')[0]).substring(0, 24); }
    catch { return 'asset'; }
}

// Loading screen UI helpers
function updateLoaderStatus(text) {
    const el = document.getElementById('loaderStatus');
    if (el) el.textContent = text;
}

function updateLoaderProgress(pct, label) {
    const fill = document.getElementById('loaderBarFill');
    const percent = document.getElementById('loaderPercent');
    const status = document.getElementById('loaderStatus');

    if (fill) fill.style.width = pct + '%';
    if (percent) percent.textContent = pct + '%';
    if (status) status.textContent = 'Loading: ' + (label || '...');
}

function finishLoading() {
    const loaderContent = document.getElementById('loaderContent');
    const startContent = document.getElementById('startContent');
    const startGameBtn = document.getElementById('startGameBtn');
    
    // Inject Dynamic Titles Professionally
    const mainTitleEl = document.getElementById('startMainTitle');
    const subTitleEl = document.getElementById('startSubTitle');
    if (mainTitleEl) mainTitleEl.textContent = state.storyTitle;
    if (subTitleEl) subTitleEl.textContent = state.storySubtitle;
    
    // Switch from loading text to start screen securely
    if (loaderContent) loaderContent.style.display = 'none';
    if (startContent) startContent.style.display = 'flex';

    // FIX: The loading screen is controlled with raw DOM (fade-out CSS class + display:none)
    // which bypasses ScreenManager entirely, leaving currentScreen = null when showScreen('story')
    // fires. We inform the manager of the 'loading' screen BEFORE transitioning so that
    // previousScreen and history are populated correctly.
    const _doStart = () => {
        // Force browser audio engine unlock inside immediate user gesture
        if (typeof audioManager !== 'undefined') audioManager.forceUnlock();

        const loadingScreen = document.getElementById('loadingScreen');
        if (!loadingScreen) return;

        // Prevent double-fire: disable button and remove key handler before async work begins.
        if (startGameBtn) startGameBtn.disabled = true;

        // Tell ScreenManager we are departing from 'loading' so onLeave fires correctly
        // and previousScreen is set to 'loading' rather than null.
        // We use force:true because currentScreen may already equal 'loading' from _syncInitialState.
        // We do NOT use showScreen('story') here because the CSS fade-out must happen first.
        screenManager._transitioning = false; // ensure no stale lock
        // Manually update internal state to reflect that we are on 'loading'
        if (screenManager.currentScreen !== 'loading') {
            screenManager.previousScreen = screenManager.currentScreen;
            screenManager.currentScreen  = 'loading';
        }

        loadingScreen.classList.add('fade-out');
        setTimeout(() => {
            // Now hand control fully to ScreenManager for the 'story' transition
            screenManager.showScreen('story');
            setTimeout(initializeStoryScreen, 100);
        }, 800);
    };

    if (startGameBtn) {
        startGameBtn.addEventListener('click', _doStart);

        // Also wire keyboard Enter to start the game from the start screen
        const _startKeyHandler = (e) => {
            const startContent = document.getElementById('startContent');
            if (startContent && startContent.style.display !== 'none' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                document.removeEventListener('keydown', _startKeyHandler);
                _doStart();
            }
        };
        document.addEventListener('keydown', _startKeyHandler);

        // Title scramble reveal after a short delay
        _scrambleTitle(document.getElementById('startMainTitle'));

    } else {
        // Fallback: no start button — go straight to story
        _doStart();
    }
}

/**
 * Scrambles an element's text content with random glyphs then resolves to the real text.
 * @param {HTMLElement} el
 */
function _scrambleTitle(el) {
    if (!el) return;
    const target = el.textContent;
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#@!&%$';
    let frame = 0;
    const totalFrames = 28;
    const interval = setInterval(() => {
        el.textContent = target.split('').map((ch, i) => {
            if (ch === ' ') return ' ';
            if (frame / totalFrames > i / target.length) return ch;
            return chars[Math.floor(Math.random() * chars.length)];
        }).join('');
        if (++frame >= totalFrames) {
            clearInterval(interval);
            el.textContent = target;
        }
    }, 40);
}

// Fallback data if JSON loading fails
function loadFallbackData() {
    state.storyTitle = 'FALLBACK MODE';
    state.storySubtitle = 'Story data failed to load';
    state.storyData = [
        // Chapter 0: Fallback Mode
        { chapter: 0, scene: 1, character: 'SYSTEM', text: "⚠ Story data missing. Entering <b>Fallback Mode</b>." },
        { chapter: 0, scene: 2, character: 'SYSTEM', text: "This isn’t the real story... Something broke. Please check your data files." },
        { chapter: 0, scene: 3, character: 'DEBUGGER', text: "Yo, player. Don’t panic. I’m just a placeholder NPC. If you’re seeing me, it means the JSON failed to load.", persistentEffect: "https://media.giphy.com/media/26tn33aiTi1jVDzO0/giphy.gif" },
        { chapter: 0, scene: 4, character: 'SYSTEM, DEBUGGER', text: "Go fix that missing data, then restart. Otherwise, you’re stuck here with us in fallback limbo." },
        { chapter: 0, scene: 5, character: 'SYSTEM', text: "[End of fallback data]", persistentEffect: "" }
    ];

    state.characters = {
        SYSTEM: {
            name: 'SYSTEM',
            sprite: 'https://joylandimages.neocities.org/JOYLAND/GREETING/Char_Imgs/VN_System.png',
            position: 'center',
            sfx: 'https://cdn.pixabay.com/download/audio/2022/03/10/audio_c818a73229.mp3?filename=message-incoming-132126.mp3',
            description: 'The game system itself, warning you that fallback mode is active.'
        },
        DEBUGGER: {
            name: 'DEBUGGER',
            sprite: 'https://joylandimages.neocities.org/JOYLAND/GREETING/Char_Imgs/Tech.png',
            position: 'left',
            sfx: 'https://cdn.pixabay.com/download/audio/2021/08/04/audio_3c3b895742.mp3?filename=blip-131856.mp3',
            description: 'A placeholder NPC that only appears when story data fails to load. Breaks the 4th wall to explain the issue.'
        }
    };

    state.chapterMusic = {
        0: 'https://cdn.pixabay.com/download/audio/2023/02/28/audio_77d2877d6b.mp3?filename=error-alert-145000.mp3'
    };

    // Set fallback backgrounds
    const fallbackChapterBg = 'https://i.pinimg.com/736x/4c/41/67/4c41674d3ec6648cfe547beabc7a0025.jpg';

    state.chapterBackgrounds = {
        0: fallbackChapterBg
    };

    // Initialize the rest of the app
    finishLoading();
    setupEventListeners();
    setupCharacterSprites();
    setupAdditionalElements();
    syncVolumes();
}

// Guard flag: event listeners must only be wired once.
let _eventListenersSetup = false;

function setupEventListeners() {
    // FIX: Guard against duplicate registration. loadFallbackData() also calls this
    // function, which previously caused addCleanup() and addEventListener() to stack
    // up multiple handlers for the same logical action.
    if (_eventListenersSetup) {
        appLogger.warn('setupEventListeners() called more than once — ignoring duplicate call.');
        return;
    }
    _eventListenersSetup = true;

    elements.menuIcon.addEventListener('click', () => toggleOverlay('menuOverlay'));
    elements.settingsBtn.addEventListener('click', () => toggleOverlay('settingsOverlay'));
    elements.fullscreenBtn.addEventListener('click', toggleFullscreen);
    elements.closeOverlay.addEventListener('click', hideOverlay);
    if (elements.muteIcon) elements.muteIcon.addEventListener('click', toggleMute);

    // Intelligent Mute UI Synchronization Observer
    if (typeof audioManager !== 'undefined' && elements.muteIcon) {
        audioManager.subscribe((enabled) => {
            const soundWaves = document.getElementById('soundWaves');
            const muteX = document.getElementById('muteX');
            if (enabled) {
                elements.muteIcon.classList.remove('muted');
                elements.muteIcon.title = 'Pause Audio';
                if (soundWaves) soundWaves.style.display = '';
                if (muteX)      muteX.style.display = 'none';
            } else {
                elements.muteIcon.classList.add('muted');
                elements.muteIcon.title = 'Play Audio';
                if (soundWaves) soundWaves.style.display = 'none';
                if (muteX)      muteX.style.display = '';
            }
        });
    }

    // Wire screen lifecycle hooks — addCleanup uses a Set internally so
    // this is safe even if called again (which it won't be, due to the guard above).
    screenManager.addCleanup('story', cleanupStoryScreen);
    screenManager.setHooks('story', {
        onLeave: (from, to) => {
            audioManager.stopTypingSound();
            clearTimeout(state.typingTimeout);
            clearTimeout(state.autoProgressTimeout);
        }
    });

    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const overlayId = btn.getAttribute('data-close');
            if (overlayId) {
                const overlay = document.getElementById(overlayId);
                overlay.classList.remove('show');
                // Wait for animation to finish before truly hiding
                setTimeout(() => {
                    overlay.style.display = 'none';
                    checkOverlaysAndResume();
                }, 400);
            }
        });
    });

    document.addEventListener('keydown', handleKeyPress);
    elements.textSpeedInput.addEventListener('input', handleTextSpeedChange);
    elements.autoSpeedInput.addEventListener('input', handleAutoSpeedChange);
    elements.sfxVolumeInput.addEventListener('input', handleSfxVolumeChange);
    if (elements.bgmVolumeInput) elements.bgmVolumeInput.addEventListener('input', handleBgmVolumeChange);
    if (elements.typingSfxVolumeInput) elements.typingSfxVolumeInput.addEventListener('input', handleTypingSfxVolumeChange);
}

// Initialize the story screen
function initializeStoryScreen() {
    state.currentDialogueIndex = 0;
    state.dialogueHistory = [];

    // Set initial chapter based on the first dialogue entry
    if (state.storyData && state.storyData.length > 0) {
        state.currentChapter = state.storyData[0].chapter;
    }

    // Sync ChapterManager with an invalid initial state to trigger a full transition on start
    chapterManager.currentChapter = null;
    appLogger.info(`Story initialized: Starting transition into Chapter ${state.currentChapter}`);

    displayNextDialogue();
}

// Initialize the end screen
function initializeEndScreen() {
    updateEndScreenButtons();

    const endScreen = document.getElementById('endScreen');
    if (state.loadScreenBackground) {
        endScreen.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.4) 100%), url('${state.loadScreenBackground}')`;
        endScreen.style.backgroundSize = 'cover';
        endScreen.style.backgroundPosition = 'center';
    } else {
        const fallbackBg = state.chapterBackgrounds && state.chapterBackgrounds[1] 
            ? state.chapterBackgrounds[1] 
            : 'https://images.unsplash.com/photo-1542401886-65d6c61de152?q=80&w=1920&auto=format&fit=crop';
        endScreen.style.backgroundImage = `linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.4) 100%), url('${fallbackBg}')`;
        endScreen.style.backgroundSize = 'cover';
        endScreen.style.backgroundPosition = 'center';
    }
}

// Set up character sprites
function setupCharacterSprites() {
    const container = document.getElementById('characterSpriteContainer');
    container.innerHTML = '';
    
    // Inject exact img tags for each character's sprite directly into the DOM
    Object.keys(state.characters || {}).forEach(key => {
        const char = state.characters[key];
        if (char.sprite && char.sprite.trim() !== '') {
            const img = document.createElement('img');
            img.id = `sprite-${key}`;
            const normalizedPosition = ['left', 'right', 'center'].includes(char.position) ? char.position : (char.position === 'middle' ? 'center' : 'center');
            img.className = `character-sprite ${normalizedPosition}-sprite`;
            img.src = char.sprite;
            img.alt = char.name;
            img.style.display = 'none';
            container.appendChild(img);
            char.position = normalizedPosition;
            char.imgElement = img; // Retain a direct node reference
        }
    });
}

// Set up additional UI elements
function setupAdditionalElements() {
    const { dialogueOptions } = elements;
    dialogueOptions.innerHTML = '';

    // LEFT: BACK
    const backBtn = document.createElement('button');
    backBtn.id = 'backBtn';
    backBtn.classList.add('nav-icon-btn', 'nav-back');
    backBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
    backBtn.addEventListener('click', handleBackClick);

    // CENTER: AUTO
    const autoToggleBtn = document.createElement('button');
    autoToggleBtn.id = 'autoToggleBtn';
    autoToggleBtn.textContent = 'AUTO';
    autoToggleBtn.classList.add('auto-btn');
    autoToggleBtn.addEventListener('click', toggleAutoMode);

    // RIGHT: SKIP / NEXT
    const skipNextBtn = document.createElement('button');
    skipNextBtn.id = 'nextSkipBtn';
    skipNextBtn.classList.add('nav-icon-btn', 'nav-next-skip', 'show-skip'); 
    skipNextBtn.innerHTML = `
        <div class="icon-layer icon-next">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </div>
        <div class="icon-layer icon-skip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="6 17 11 12 6 7"></polyline>
                <polyline points="13 17 18 12 13 7"></polyline>
            </svg>
        </div>
    `;
    skipNextBtn.addEventListener('click', handleSkipNextClick);

    dialogueOptions.appendChild(backBtn);
    dialogueOptions.appendChild(autoToggleBtn);
    dialogueOptions.appendChild(skipNextBtn);

    // Store references
    elements.skipNextBtn = skipNextBtn;
    elements.backBtn = backBtn;
    elements.autoToggleBtn = autoToggleBtn;
}

// Update end screen buttons
function updateEndScreenButtons() {
    const { endOptions } = elements;
    endOptions.innerHTML = '';

    const createButton = (text, onClick) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.className = 'option-btn';
        button.addEventListener('click', onClick);
        return button;
    };

    const replayBtn = createButton('Replay Story', () => {
        resetStory();
        screenManager.showScreen('story');
        initializeStoryScreen();
    });

    endOptions.appendChild(replayBtn);
}

// Display the next dialogue
async function displayNextDialogue() {
    clearTimeout(state.autoProgressTimeout);
    state.typingInstanceId++; // Ensure any orphaned async typing loop instances are brutally retired

    if (state.isPaused) {
        state.autoProgressTimeout = setTimeout(displayNextDialogue, 100);
        return;
    }

    if (state.currentDialogueIndex >= state.storyData.length) {
        handleEndOfStory();
        return;
    }

    const dialogue = state.storyData[state.currentDialogueIndex];

    // Handle Chapter and Scene Transitions securely, blocking the pipeline until finished
    if (dialogue.chapter !== chapterManager.currentChapter) {
        state.isTyping = true; // Lock UI during transition
        updateButtonStates();
        
        // Hide characters and dialogue container so transition is clean
        elements.dialogueContainer.style.visibility = 'hidden';
        _hideAllSprites(document.getElementById('characterSpriteContainer'));

        await updateChapterAndScene(dialogue.chapter, dialogue.scene);
        
        // Reveal UI after transition
        elements.dialogueContainer.style.visibility = 'visible';
    } else if (dialogue.scene !== state.currentScene) {
        // Just update scene safely
        await updateChapterAndScene(dialogue.chapter, dialogue.scene);
    }

    if (dialogue.effect) {
        state.isEffectPlaying = true;
        updateButtonStates();
        effectsEngine.playOverlayEffect(dialogue.effect, () => {
            state.isEffectPlaying = false;
            state.dialogueHistory.push(state.currentDialogueIndex);
            state.currentDialogueIndex++;
            updateButtonStates();
            displayNextDialogue();
        });
    } else {
        updateCharacter(dialogue.character);
        effectsEngine.setPersistentEffect(dialogue.persistentEffect);

        // Play character SFX via the pooled audio manager.
        // Pass isCharSfx=true so AudioManager tracks this slot for targeted skip-stop.
        let primaryCharKey = typeof dialogue.character === 'string'
            ? dialogue.character.split(',')[0].trim()
            : (Array.isArray(dialogue.character) ? dialogue.character[0] : dialogue.character);
        const charData = state.characters[primaryCharKey];
        if (charData && charData.sfx) {
            audioManager.playSfx(charData.sfx, true);
        }

        state.currentDialogue = dialogue.text;
        state.isTyping = true;
        typeWriter(dialogue.text, state.typingSpeed);
        state.dialogueHistory.push(state.currentDialogueIndex);
        state.currentDialogueIndex++;
        updateButtonStates();
    }
}

// Legacy persistent effect functions moved to effects.js

/**
 * Cleanup function called when leaving the story screen.
 * Clears all visual layers so they don't bleed into other screens.
 */
function cleanupStoryScreen() {
    effectsEngine.cleanup();
    _hideAllSprites(document.getElementById('characterSpriteContainer'));
    state.isTyping = false;
    state.isEffectPlaying = false;
}

// Play effect logic moved to effects.js

// Update character display
function updateCharacter(characterInput) {
    if (!state.characters) return;

    // Parse input (array or comma-string)
    let charKeys = [];
    if (Array.isArray(characterInput)) {
        charKeys = characterInput.slice();
    } else if (typeof characterInput === 'string') {
        charKeys = characterInput.split(',').map(s => s.trim());
    }
    if (charKeys.length === 0) return;

    // ── Deduplicate: same key cannot occupy two DOM nodes ────────────────
    const seenKeys = new Set();
    charKeys = charKeys.filter(k => {
        if (seenKeys.has(k)) return false;
        seenKeys.add(k);
        return true;
    });

    // Resolve to valid character objects
    const validEntries = charKeys
        .map(k => ({ key: k, data: state.characters[k] }))
        .filter(e => e.data);

    const container = document.getElementById('characterSpriteContainer');

    if (validEntries.length === 0) {
        console.warn(`Characters [${charKeys.join(',')}] not found in registry.`);
        _hideAllSprites(container);
        return;
    }

    state.currentCharacter = validEntries[0].data;

    // Character name in dialogue header
    const combinedNames = validEntries.map(e => e.data.name).join(' & ');
    elements.characterName.textContent = combinedNames;
    elements.characterName.setAttribute('data-text', combinedNames);

    const n       = validEntries.length;
    const isMulti = n > 1;
    container.classList.toggle('multi-sprite-mode', isMulti);

    // ── Push sprite-count CSS custom prop so slot sizing rules fire ───────
    if (isMulti) {
        container.style.setProperty('--sprite-count', n);
    } else {
        container.style.removeProperty('--sprite-count');
    }

    // ── Hide sprites NOT in this scene ────────────────────────────────────
    const activeDataSet = new Set(validEntries.map(e => e.data));
    Object.values(state.characters || {}).forEach(char => {
        if (char.imgElement && !activeDataSet.has(char)) {
            _resetSprite(char.imgElement);
        }
    });

    // ── Position and show active sprites ─────────────────────────────────
    validEntries.forEach((entry, index) => {
        const char = entry.data;
        if (!char.imgElement) return;

        const img = char.imgElement;
        img.style.zIndex = index + 2;

        if (isMulti) {
            // Slot-center formula: divide viewport into n equal slots,
            // place sprite centre at the middle of slot (index).
            // left = (index + 0.5) / n × 100%
            const leftPct = ((index + 0.5) / n) * 100;
            img.style.left      = `${leftPct.toFixed(4)}%`;
            img.style.right     = 'auto';
            img.style.transform = 'translateX(-50%)';
            // Remove class-based position transforms that fight inline style
            img.classList.remove('left-sprite', 'right-sprite', 'center-sprite', 'middle-sprite');
        } else {
            // Single-sprite: restore original class-based positioning
            img.style.left      = '';
            img.style.right     = '';
            img.style.transform = '';
            // Restore the position class (normalised on setup)
            const pos = char.position || 'center';
            if (!img.classList.contains(`${pos}-sprite`)) {
                img.classList.remove('left-sprite', 'right-sprite', 'center-sprite', 'middle-sprite');
                img.classList.add(`${pos}-sprite`);
            }
        }

        const wasActive = img.style.display === 'block' && img.classList.contains('active');

        if (!wasActive) {
            img.removeAttribute('data-sprite-settled');
            img.style.display = 'block';

            requestAnimationFrame(() => {
                img.classList.add('active');

                // Mark settled after entry animation so effects don't re-trigger it
                const ENTRY_MS = 600;
                setTimeout(() => {
                    if (img.classList.contains('active')) {
                        img.setAttribute('data-sprite-settled', '1');
                    }
                }, ENTRY_MS);
            });
        }
        // wasActive → sprite visible and settled; nothing to do
    });
}

/** Hide and fully reset a single sprite element */
function _resetSprite(img) {
    img.style.display   = 'none';
    img.style.left      = '';
    img.style.right     = '';
    img.style.transform = '';
    img.style.zIndex    = '';
    img.classList.remove('active');
    img.removeAttribute('data-sprite-settled');
}

/** Hide all sprites and reset container state */
function _hideAllSprites(container) {
    Object.values(state.characters || {}).forEach(char => {
        if (char.imgElement) _resetSprite(char.imgElement);
    });
    container.classList.remove('multi-sprite-mode');
    container.style.removeProperty('--sprite-count');
}

// Update button states
function updateButtonStates() {
    if (!elements.skipNextBtn || !elements.backBtn || !elements.autoToggleBtn) return;

    elements.skipNextBtn.disabled = state.isEffectPlaying;
    elements.backBtn.disabled = state.dialogueHistory.length <= 1 || state.isEffectPlaying;
    elements.autoToggleBtn.disabled = state.isEffectPlaying;
    
    // UI Visual Sync for Auto Mode
    elements.autoToggleBtn.textContent = state.isAutoMode ? 'AUTO ON' : 'AUTO OFF';
    elements.autoToggleBtn.classList.toggle('auto-active', state.isAutoMode);

    // UI Visual Sync for Skip/Next SVG
    if (state.isTyping) {
        elements.skipNextBtn.classList.add('show-skip');
        elements.skipNextBtn.classList.remove('show-next');
    } else {
        elements.skipNextBtn.classList.add('show-next');
        elements.skipNextBtn.classList.remove('show-skip');
    }
}

// Type writer effect (Bleeding Edge Implementation)
async function typeWriter(rawText, baseSpeed) {
    const instanceId = ++state.typingInstanceId;
    state.skipRequested = false;
    state.isTyping = true;
    
    const container = elements.typedText;
    
    // Step 1: Layout Lock using a Ghost Container
    // We render everything invisibly to calculate the container height
    let ghost = document.getElementById('typewriter-ghost');
    if (!ghost) {
        ghost = document.createElement('div');
        ghost.id = 'typewriter-ghost';
        ghost.style.visibility = 'hidden';
        ghost.style.position = 'absolute';
        ghost.style.pointerEvents = 'none';
        ghost.style.whiteSpace = 'pre-wrap';
        if (container.parentNode) container.parentNode.appendChild(ghost);
    }
    
    // Inherit precise width for perfect measurement
    ghost.style.width = getComputedStyle(container).width;
    ghost.innerHTML = rawText;
    container.style.minHeight = `${ghost.offsetHeight}px`;
    container.innerHTML = '';
    
    // Step 2: Tokenize HTML Tags & Logic Events
    const tokens = rawText.split(/(<[^>]+>|\[[^\]]+\])/g);
    let currentHTML = "";
    
    const wait = (ms) => new Promise(resolve => setTimeout(resolve, state.skipRequested ? 0 : ms));

    for (const token of tokens) {
        if (state.typingInstanceId !== instanceId) return; // Strict isolation bailout
        
        // Ignore Engine events for rendering
        if (token.startsWith('[')) {
            const eventName = token.slice(1, -1);
            if (typeof effectsEngine !== 'undefined') {
                effectsEngine.triggerMacro(eventName);
            }
            continue;
        }
        
        // Push HTML tags immediately into buffer
        if (token.startsWith('<')) {
            currentHTML += token;
            continue;
        }
        
        // Type visible characters
        for (const char of token) {
            if (state.typingInstanceId !== instanceId) return;
            
            // Sync with game's global pause (Menu/Settings overlap)
            while (state.isPaused && !state.skipRequested) {
                await new Promise(r => setTimeout(r, 100));
            }
            
            if (state.skipRequested) break; // Break char loop to compile the rest instantly
            
            currentHTML += char;
            container.innerHTML = currentHTML;
            
            if (typeof audioManager !== 'undefined') audioManager.playTypingSound();
            
            // Step 3: Punctuation Pacing
            let delay = baseSpeed;
            if (/[.!?]/.test(char)) delay *= 15;
            else if (/,/.test(char)) delay *= 8;
            
            await wait(delay);
        }
    }
    
    if (state.typingInstanceId !== instanceId) return;

    // Fast-Forward Cleanup
    if (state.skipRequested) {
        // Strip logic bracket events safely and render raw HTML fully parsed natively
        container.innerHTML = rawText.replace(/\[[^\]]+\]/g, ''); 
    }
    
    // Natural Teardown
    state.isTyping = false;
    if (typeof audioManager !== 'undefined') audioManager.stopTypingSound();
    updateButtonStates();
    
    container.style.minHeight = 'auto'; // release layout lock gracefully
    
    if (state.isAutoMode && !state.skipRequested) {
        state.autoProgressTimeout = setTimeout(displayNextDialogue, calculateAutoDelay());
    }
}

// Handle skip/next button click
function handleSkipNextClick() {
    if (state.isEffectPlaying) return;

    if (state.isTyping) {
        // Fast-forward: collapse async loop delays to 0ms.
        // FIX: Also stop any currently-playing character SFX and typing sound
        // so the old character's audio doesn't bleed into the next dialogue.
        audioManager.stopAllSfx();
        audioManager.stopTypingSound();
        state.skipRequested = true;
    } else {
        displayNextDialogue();
    }
}

// Handle back button click
function handleBackClick() {
    if (state.isEffectPlaying) {
        return;
    }
    if (screenManager.is('story')) {
        if (state.dialogueHistory.length > 1) {
            state.typingInstanceId++; // Kill any mid-flight async typeWriter instance
            clearTimeout(state.autoProgressTimeout);
            // FIX: Stop ALL active SFX (character + effects pool) AND typing sound
            // before going back, so the old character's audio doesn't overlap the
            // new one that displayNextDialogue() is about to trigger.
            audioManager.stopAllSfx();
            audioManager.stopTypingSound();
            state.dialogueHistory.pop();
            const lastIndex = state.dialogueHistory.pop();
            state.currentDialogueIndex = lastIndex;

            // Resolve the correct persistent effect for this point in the story
            const correctEffect = effectsEngine.resolveEffectForIndex(lastIndex, state.storyData);
            effectsEngine.setPersistentEffect(correctEffect);

            // Also restore the correct chapter/background for this index
            const targetDialogue = state.storyData[lastIndex];
            if (targetDialogue) {
                updateChapterAndScene(targetDialogue.chapter, targetDialogue.scene);
            }

            displayNextDialogue();
        }
    } else if (screenManager.is('end')) {
        // FIX: Kill any mid-flight async typing instance BEFORE switching screens
        // to prevent orphaned typeWriter loops from running after the screen change.
        state.typingInstanceId++;
        clearTimeout(state.autoProgressTimeout);

        screenManager.showScreen('story');
        state.currentDialogueIndex = state.storyData.length - 1;

        // Resolve effect for the last dialogue
        const correctEffect = effectsEngine.resolveEffectForIndex(state.currentDialogueIndex, state.storyData);
        effectsEngine.setPersistentEffect(correctEffect);

        displayNextDialogue();
    }
}

// Toggle global audio (Pause BGM & Mute SFX)
function toggleMute() {
    // The visual UI icon update is completely delegated to the audioManager.subscribe callback 
    // so it handles it flawlessly no matter where the toggle is invoked
    audioManager.toggleGlobalAudio();
}

// Toggle auto mode
function toggleAutoMode() {
    state.isAutoMode = !state.isAutoMode;
    elements.autoToggleBtn.textContent = state.isAutoMode ? 'AUTO ON' : 'AUTO OFF';
    elements.autoToggleBtn.classList.toggle('auto-active', state.isAutoMode);
    if (state.isAutoMode && !state.isTyping) {
        state.autoProgressTimeout = setTimeout(displayNextDialogue, calculateAutoDelay());
    } else {
        clearTimeout(state.autoProgressTimeout);
    }
}

// Calculate auto delay
function calculateAutoDelay() {
    return AUTO_PROGRESS_DELAY * (100 - state.autoSpeed) / 100;
}

// ============================================================================
// CHAPTER MANAGEMENT - Professional Implementation
// ============================================================================

/**
 * Update chapter and scene - now using ChapterManager for professional handling
 * This function coordinates all chapter-related updates
 */
async function updateChapterAndScene(chapter, scene) {
    try {
        // Only proceed if chapter actually changed
        if (chapter !== chapterManager.currentChapter) {
            appLogger.debug(`Initiating chapter transition: ${chapterManager.currentChapter} → ${chapter}`);
            
            // Use ChapterManager for coordinated update
            await chapterManager.changeChapter(chapter, {
                chapterBackgrounds: state.chapterBackgrounds,
                chapterMusic: state.chapterMusic,
                chapterNames: state.chapterNames
            });

            // Update state reference to match manager
            state.currentChapter = chapterManager.currentChapter;
        }

        // Update scene
        if (scene !== state.currentScene) {
            state.currentScene = scene;
            appLogger.debug(`Scene updated to ${scene}`);
        }
    } catch (error) {
        appLogger.error(`Failed to update chapter/scene:`, error);
    }
}

/**
 * Legacy function for backward compatibility - delegates to ChapterManager
 */
function updateChapterBackground(chapter) {
    appLogger.warn('updateChapterBackground() called directly. Use updateChapterAndScene() instead.');
}

/**
 * Legacy function for backward compatibility - delegates to ChapterManager
 */
function showChapterTransition(chapter) {
    appLogger.warn('showChapterTransition() called directly. Transitions now handled by ChapterManager.');
    return Promise.resolve();
}

// Handle end of story
function handleEndOfStory() {
    screenManager.showScreen('end');
    initializeEndScreen();
}

// Reset story
function resetStory() {
    state.currentDialogueIndex = 0;
    state.dialogueHistory = [];
    state.currentChapter = 1;
    state.currentScene = 1;
    state.isAutoMode = false;
    state.isTyping = false;
    state.isEffectPlaying = false;

    // Clear all visual layers
    cleanupStoryScreen();
    updateButtonStates();
}

// Toggle overlay
function toggleOverlay(overlayId) {
    const overlay = document.getElementById(overlayId);

    // Check if it's currently marked as show
    if (overlay.classList.contains('show')) {
        overlay.classList.remove('show');
        setTimeout(() => {
            overlay.style.display = 'none';
            checkOverlaysAndResume();
        }, 400);
    } else {
        overlay.style.display = 'flex';
        // Force reflow
        void overlay.offsetWidth;
        overlay.classList.add('show');
        state.isPaused = true;
    }
}

// Hide overlay
function hideOverlay() {
    elements.overlayContainer.classList.remove('show');
    setTimeout(() => {
        elements.overlayContainer.style.display = 'none';
        checkOverlaysAndResume();
    }, 400);
}

// Check if any overlays are open to update pause state
function checkOverlaysAndResume() {
    const isMenuOpen = elements.menuOverlay.classList.contains('show');
    const isSettingsOpen = elements.settingsOverlay.classList.contains('show');
    const isIframeOpen = elements.overlayContainer.classList.contains('show');
    state.isPaused = isMenuOpen || isSettingsOpen || isIframeOpen;
}

// Show overlay with content
function showOverlay(title, content) {
    elements.overlayTitle.textContent = title;
    elements.overlayFrame.srcdoc = `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    padding: 20px;
                    color: #333;
                    line-height: 1.6;
                }
                h2 { color: #00ffff; }
                h3 { color: #ff00ff; margin-top: 20px; }
            </style>
        </head>
        <body>${content}</body>
        </html>`;
    elements.overlayContainer.style.display = 'block';
}

// Generate credits HTML
function generateCreditsHTML() {
    return `
        <h2>Credits</h2>
        <p>Writer: Cyberpunk Storyteller</p>
        <p>Artist: Digital Dreamweaver</p>
        <p>Developer: Code Runner</p>
        <p>Music: Synthwave Producer</p>
    `;
}

// Generate character info HTML
function generateCharacterInfoHTML() {
    return Object.values(state.characters).map(character => `
        <h3>${character.name}</h3>
        <p>${character.description}</p>
    `).join('');
}



// Handle key press
function handleKeyPress(event) {
    // FIX: Keyboard shortcuts should only be active on the story or end screen.
    // Previously, pressing Enter/Space/Backspace while on the loading screen (between
    // the start button press and initializeStoryScreen()) would call displayNextDialogue()
    // before storyData was ready, causing an index-out-of-bounds read.
    const activeScreen = screenManager.getCurrentScreen();
    if (activeScreen !== 'story' && activeScreen !== 'end') return;

    switch (event.key) {
        case 'Enter':
        case ' ':
            // Prevent page scroll on spacebar
            event.preventDefault();
            handleSkipNextClick();
            break;
        case 'Backspace':
            handleBackClick();
            break;
        case 'a':
        case 'A':
            toggleAutoMode();
            break;
        case 'Escape':
            // Properly close any open overlays via toggleOverlay so isPaused is correctly cleared
            ['menuOverlay', 'settingsOverlay'].forEach(id => {
                const ov = document.getElementById(id);
                if (ov && ov.classList.contains('show')) toggleOverlay(id);
            });
            if (elements.overlayContainer && elements.overlayContainer.classList.contains('show')) hideOverlay();
            break;
    }
}

// Handle text speed change
function handleTextSpeedChange(e) {
    state.typingSpeed = 101 - e.target.value;
}

// Handle auto speed change
function handleAutoSpeedChange(e) {
    state.autoSpeed = parseInt(e.target.value);
    if (state.autoSpeed > 0 && !state.isTyping && state.isAutoMode) {
        clearTimeout(state.autoProgressTimeout);
        state.autoProgressTimeout = setTimeout(displayNextDialogue, calculateAutoDelay());
    }
}

// Handle BGM volume change
function handleBgmVolumeChange(e) {
    const volume = e.target.value / 100;
    audioManager.setBgmVolume(volume);
}

// Handle SFX volume change
function handleSfxVolumeChange(e) {
    const volume = e.target.value / 100;
    audioManager.setSfxVolume(volume);
}

// Handle Typing SFX volume change
function handleTypingSfxVolumeChange(e) {
    const volume = e.target.value / 100;
    audioManager.setTypingSfxVolume(volume);
}

// Sync volumes with UI
function syncVolumes() {
    elements.sfxVolumeInput.value = audioManager.sfxVolume * 100;
    if (elements.bgmVolumeInput) elements.bgmVolumeInput.value = audioManager.bgmVolume * 100;
    if (elements.typingSfxVolumeInput) elements.typingSfxVolumeInput.value = audioManager.typingSfxVolume * 100;
    
    // Also sync standard script.js UI sliders
    if (elements.textSpeedInput) elements.textSpeedInput.value = 101 - state.typingSpeed;
    if (elements.autoSpeedInput) elements.autoSpeedInput.value = state.autoSpeed;
}

// Toggle fullscreen
function toggleFullscreen() {
    if (!document.fullscreenElement &&    // standard
        !document.mozFullScreenElement && // Firefox
        !document.webkitFullscreenElement && // Chrome, Safari and Opera
        !document.msFullscreenElement) {  // IE/Edge
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) {
            document.documentElement.msRequestFullscreen();
        } else if (document.documentElement.mozRequestFullScreen) {
            document.documentElement.mozRequestFullScreen();
        } else if (document.documentElement.webkitRequestFullscreen) {
            document.documentElement.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
        }
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}
// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeApp);