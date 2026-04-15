// audio.js — Professional Audio Manager (Zero Error Implementation)
class AudioManager {
    constructor() {
        this.logger = typeof appLogger !== 'undefined' ? appLogger : console;
        
        // ── State & Persistence ──
        this.globalAudioEnabled = this._load('globalAudioEnabled', true); 
        this.sfxEnabled = this.globalAudioEnabled; // For backward compatibility checks
        this.sfxVolume = this._load('sfxVolume', 0.5);
        this.bgmVolume = this._load('bgmVolume', 0.4);

        // ── Interaction & Autoplay Locks ──
        this.userInteracted = false;
        this.pendingBgm = null;
        this._setupInteractionListeners();

        // ── Universal Media Engine ──
        // Using <video> elements is a god-tier trick to universally support .mp4/.webm formats 
        // natively without NotSupportedError, as it handles a strict superset of <audio> formats.
        
        this.bgmAudio1 = this._createUniversalNode(true);
        this.bgmAudio2 = this._createUniversalNode(true);
        this.bgmAudio1.volume = 0;
        this.bgmAudio2.volume = 0;
        this.activeBgmChannel = 1; // 1 or 2
        this.crossfadeInterval = null;

        // ── SFX Pool ──
        this.sfxPool = [];
        this.sfxPoolSize = 6;
        for (let i = 0; i < this.sfxPoolSize; i++) {
            this.sfxPool.push(this._createUniversalNode(false));
        }
        this.sfxIndex = 0;

        // ── Typing Sound ──
        this.typingSoundEffect = new Audio('https://cdn.pixabay.com/download/audio/2022/03/15/audio_5c4c2c5c14.mp3?filename=keyboard-typing-144829.mp3');
        this.typingSoundEffect.loop = true;
        this.typingSoundEffect.volume = this.sfxVolume;
        this.typingSoundEffect.muted = !this.globalAudioEnabled;
    }

    _createUniversalNode(loop) {
        // Reverting to Audio. If an .mp4 has an unsupported video codec (e.g. HEVC/H.265),
        // Chrome's <video> tag throws FFmpegDemuxer exceptions. <audio> ignores the video
        // track entirely and gracefully plays the internal audio stream.
        const media = new Audio();
        media.loop = loop;
        
        media.onerror = (e) => {
            if (this.logger.warn) this.logger.warn('Media parsing error on node:', media.src, media.error || e);
        };

        return media;
    }

    _setupInteractionListeners() {
        const unlock = () => {
            if (this.userInteracted) return;
            this.userInteracted = true;
            if (this.logger.debug) this.logger.debug('User interacted, audio unlocked.');
            if (this.pendingBgm && this.globalAudioEnabled) {
                this._crossfadeTo(this.pendingBgm);
                this.pendingBgm = null;
            }
            ['click', 'touchstart', 'keydown'].forEach(evt => document.removeEventListener(evt, unlock));
        };
        ['click', 'touchstart', 'keydown'].forEach(evt => document.addEventListener(evt, unlock, { once: true }));
    }

    async _safePlay(audioObj) {
        if (!this.userInteracted || !this.globalAudioEnabled) return;
        try {
            await audioObj.play();
        } catch (error) {
            if (error.name !== "AbortError" && error.name !== "NotSupportedError") {
                if (this.logger.warn) this.logger.warn('Audio playback prevented:', error.message);
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
        nextAudio.load(); // enforce parser reload for video blobs
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
        // Keep typing sound locked to SFX volume scale
        this.typingSoundEffect.volume = this.sfxVolume;
        this._save('sfxVolume', this.sfxVolume);
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
        return this.globalAudioEnabled;
    }

    // ── Typing Sound Engine ──
    playTypingSound() {
        if (!this.globalAudioEnabled) return;
        if (this.typingSoundEffect.paused) {
            this._safePlay(this.typingSoundEffect);
        } else {
            if (this.typingSoundEffect.currentTime > 0.5) {
               this.typingSoundEffect.currentTime = 0;
            }
        }
    }

    stopTypingSound() {
        this.typingSoundEffect.pause();
    }

    // ── Persistence ──
    _save(key, value) {
        try { localStorage.setItem('lvne_' + key, JSON.stringify(value)); } catch (e) { /* silent */ }
    }

    _load(key, fallback) {
        try {
            const val = localStorage.getItem('lvne_' + key);
            return val !== null ? JSON.parse(val) : fallback;
        } catch (e) { return fallback; }
    }
}

// Initialize robust audio manager
const audioManager = new AudioManager();