// audio.js — Professional Audio Manager (Next-Level Implementation)
class AudioManager {
    constructor() {
        this.logger = typeof appLogger !== 'undefined' ? appLogger : console;
        
        // ── State & Persistence ──
        this.globalAudioEnabled = this._load('globalAudioEnabled', true); 
        this.sfxEnabled = this.globalAudioEnabled; // For backward compatibility checks
        this.sfxVolume = this._load('sfxVolume', 0.5);
        this.typingSfxVolume = this._load('typingSfxVolume', 0.2);
        this.bgmVolume = this._load('bgmVolume', 0.4);

        // ── Observers ──
        this.stateObservers = [];

        // ── Interaction & Autoplay Locks ──
        this.userInteracted = false;
        this.pendingBgm = null;
        this._setupInteractionListeners();

        // ── Universal Media Engine ──
        // Using <video> tag trick universally supports .mp4/.webm formats 
        // natively without NotSupportedError, falling back to <audio> for seamless parsing
        
        this.bgmAudio1 = this._createUniversalNode(true);
        this.bgmAudio2 = this._createUniversalNode(true);
        this.bgmAudio1.volume = 0;
        this.bgmAudio2.volume = 0;
        this.activeBgmChannel = 1; // 1 or 2
        this.crossfadeInterval = null;

        // ── SFX Pool (Round-Robin) ──
        this.sfxPool = [];
        this.sfxPoolSize = 8; // Expanded pool for high intensity
        for (let i = 0; i < this.sfxPoolSize; i++) {
            this.sfxPool.push(this._createUniversalNode(false));
        }
        this.sfxIndex = 0;

        // ── Typing Sound Engine ──
        this.typingSoundEffect = new Audio('core_assets/audio/typing_loop.mp3');
        this.typingSoundEffect.loop = true;
        this.typingSoundEffect.volume = this.typingSfxVolume;
        this.typingSoundEffect.muted = !this.globalAudioEnabled;
        
        // Add exceptional error handling for the typing sound
        this.typingSoundEffect.onerror = (e) => {
            if (this.logger.warn) this.logger.warn('Typing sound failed to load:', e);
        };
    }

    _createUniversalNode(loop) {
        const media = new Audio();
        media.loop = loop;
        
        media.onerror = (e) => {
            if (this.logger.warn) this.logger.warn('Media parsing error on node:', media.src, media.error || e);
        };

        return media;
    }

    // Subscribe to state changes (UI Sync)
    subscribe(callback) {
        this.stateObservers.push(callback);
        // Fire immediately for initial sync
        callback(this.globalAudioEnabled);
    }

    _notifyObservers() {
        this.stateObservers.forEach(cb => cb(this.globalAudioEnabled));
    }

    _setupInteractionListeners() {
        const unlock = () => {
            this.forceUnlock();
            ['click', 'touchstart', 'keydown'].forEach(evt => document.removeEventListener(evt, unlock));
        };
        ['click', 'touchstart', 'keydown'].forEach(evt => document.addEventListener(evt, unlock, { once: true }));
    }

    forceUnlock() {
        if (this.userInteracted) return;
        this.userInteracted = true;
        if (this.logger.debug) this.logger.debug('User interacted, audio system unlocked globally.');
        
        // Unleash any pending background music
        if (this.pendingBgm && this.globalAudioEnabled) {
            this._crossfadeTo(this.pendingBgm);
            this.pendingBgm = null;
        }
    }

    async _safePlay(audioObj) {
        if (!this.userInteracted || !this.globalAudioEnabled) return;
        try {
            await audioObj.play();
        } catch (error) {
            // AbortError is normal during fast skipping, NotSupportedError during init without interaction
            if (error.name !== "AbortError" && error.name !== "NotSupportedError" && error.name !== "NotAllowedError") {
                if (this.logger && this.logger.warn) this.logger.warn(`Audio playback prevented (${audioObj.src}):`, error.message || error);
            }
        }
    }

    // ── Background Music Engine ──
    playBackgroundMusic(url) {
        if (!url) return;
        if (!this.userInteracted || !this.globalAudioEnabled) {
            this.pendingBgm = url;
            return;
        }
        this._crossfadeTo(url);
    }

    _crossfadeTo(url) {
        if (!url) return;
        
        const currentAudio = this.activeBgmChannel === 1 ? this.bgmAudio1 : this.bgmAudio2;
        const nextAudio = this.activeBgmChannel === 1 ? this.bgmAudio2 : this.bgmAudio1;

        if (currentAudio.src.endsWith(url) && !currentAudio.paused) return;

        clearInterval(this.crossfadeInterval);
        
        nextAudio.src = url;
        nextAudio.load(); // Enforce parser reload for blobs
        nextAudio.volume = 0;
        this._safePlay(nextAudio);

        const fadeDuration = 1500;
        const steps = 30;
        const stepTime = fadeDuration / steps;
        const volumeStep = this.bgmVolume / steps;

        let currentStep = 0;
        
        this.crossfadeInterval = setInterval(() => {
            currentStep++;
            if (currentStep >= steps) {
                clearInterval(this.crossfadeInterval);
                nextAudio.volume = this.bgmVolume;
                currentAudio.volume = 0;
                currentAudio.pause();
                this.activeBgmChannel = this.activeBgmChannel === 1 ? 2 : 1;
            } else {
                let newNextVol = currentStep * volumeStep;
                let newCurrVol = this.bgmVolume - newNextVol;
                
                nextAudio.volume = Math.max(0, Math.min(newNextVol, this.bgmVolume));
                currentAudio.volume = Math.max(0, Math.min(newCurrVol, this.bgmVolume));
            }
        }, stepTime);
    }

    setBgmVolume(volume) {
        this.bgmVolume = Math.max(0, Math.min(volume, 1));
        this._save('bgmVolume', this.bgmVolume);
        
        if (!this.crossfadeInterval) {
            const currentAudio = this.activeBgmChannel === 1 ? this.bgmAudio1 : this.bgmAudio2;
            currentAudio.volume = this.bgmVolume;
        }
    }

    // ── SFX Engine ──
    playSfx(src) {
        if (!this.globalAudioEnabled || !src || src.startsWith('/path/')) return;
        
        const audio = this.sfxPool[this.sfxIndex];
        this.sfxIndex = (this.sfxIndex + 1) % this.sfxPoolSize;
        
        audio.src = src;
        audio.volume = this.sfxVolume;
        audio.muted = !this.globalAudioEnabled;
        audio.currentTime = 0;
        this._safePlay(audio);
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(volume, 1));
        this._save('sfxVolume', this.sfxVolume);
    }

    setTypingSfxVolume(volume) {
        this.typingSfxVolume = Math.max(0, Math.min(volume, 1));
        this.typingSoundEffect.volume = this.typingSfxVolume;
        this._save('typingSfxVolume', this.typingSfxVolume);
    }

    // ── Global Pause/Play Engine ──
    toggleGlobalAudio() {
        this.globalAudioEnabled = !this.globalAudioEnabled;
        this.sfxEnabled = this.globalAudioEnabled; 
        
        // Mute properties
        this.typingSoundEffect.muted = !this.globalAudioEnabled;
        this.sfxPool.forEach(node => node.muted = !this.globalAudioEnabled);

        const currentActiveBgm = this.activeBgmChannel === 1 ? this.bgmAudio1 : this.bgmAudio2;

        if (!this.globalAudioEnabled) {
            // Global Paused
            currentActiveBgm.pause();
            if (this.crossfadeInterval) clearInterval(this.crossfadeInterval);
        } else {
            // Global Resumed
            if (currentActiveBgm.src) {
                this._safePlay(currentActiveBgm);
            } else if (this.pendingBgm) {
                this._crossfadeTo(this.pendingBgm);
                this.pendingBgm = null;
            }
        }

        this._save('globalAudioEnabled', this.globalAudioEnabled);
        this._notifyObservers(); // Notify UI to sync instantly perfectly
        return this.globalAudioEnabled;
    }

    // ── Typing Sound Engine ──
    playTypingSound() {
        if (!this.globalAudioEnabled) return;
        
        try {
            if (this.typingSoundEffect.paused) {
                this._safePlay(this.typingSoundEffect);
            }
        } catch (error) {
            if (this.logger.warn) this.logger.warn('Failed to play typing sound:', error);
        }
    }

    stopTypingSound() {
        try {
            if (!this.typingSoundEffect.paused) {
                this.typingSoundEffect.pause();
                this.typingSoundEffect.currentTime = 0; // Restore exact timing loop for next play
            }
        } catch (error) {
            if (this.logger.warn) this.logger.warn('Failed to stop typing sound:', error);
        }
    }

    // ── Persistence ──
    _save(key, value) {
        try { 
            localStorage.setItem('lvne_' + key, JSON.stringify(value)); 
        } catch (e) {
            if (this.logger && this.logger.warn) {
                this.logger.warn(`Failed to save ${key} to localStorage:`, e);
            }
        }
    }

    _load(key, fallback) {
        try {
            const val = localStorage.getItem('lvne_' + key);
            return val !== null ? JSON.parse(val) : fallback;
        } catch (e) { 
            if (this.logger && this.logger.warn) {
                this.logger.warn(`Failed to load ${key} from localStorage, using fallback:`, e);
            }
            return fallback; 
        }
    }
}

// Initialize robust audio manager
const audioManager = new AudioManager();