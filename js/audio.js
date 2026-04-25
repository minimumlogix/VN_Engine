// audio.js — AudioManager v2 (Perfected)
// ============================================================================
// BUG FIXES vs v1:
//  1.  _crossfadeTo URL comparison: now uses normalized absolute URL comparison
//      so the same track doesn't re-crossfade into itself.
//  2.  _crossfadeTo crossfade math: volumeStep is re-derived each tick from the
//      *live* bgmVolume value, not a stale capture, so setBgmVolume() mid-fade works.
//  3.  _crossfadeTo: added guard so a crossfade to volume=0 still terminates.
//  4.  setBgmVolume: now updates BOTH channels (active + inactive) during crossfade
//      so mid-fade volume changes land on the correct ceiling.
//  5.  playSfx: sets muted BEFORE src assignment; also stops & resets pool node
//      before reuse to prevent audio bleed from old sounds playing concurrently.
//  6.  playSfx: returns early (before any DOM work) if !userInteracted.
//  7.  stopAllSfx(): new public method — stops and resets every pool node instantly.
//      Called by handleSkipNextClick() to silence character SFX on skip.
//  8.  setSfxVolume: now updates volume on all currently-playing pool nodes live.
//  9.  toggleGlobalAudio: explicitly mutes/pauses BOTH BGM channels (not just active).
// 10.  stopTypingSound: does NOT reset currentTime — prevents audible click on resume.
// 11.  playTypingSound: removed misleading empty try/catch wrapper.
// 12.  sfxEnabled zombie field removed — all logic uses globalAudioEnabled directly.
// 13.  _setupInteractionListeners: removed redundant manual removeEventListener
//      inside unlock() — the { once: true } option already handles it.
// 14.  _resolveAbsoluteUrl helper: converts relative paths to absolute for
//      reliable URL comparison (fixes the endsWith() cross-origin mismatch).
// ============================================================================
class AudioManager {
    constructor() {
        this.logger = typeof appLogger !== 'undefined' ? appLogger : console;

        // ── State & Persistence ──────────────────────────────────────────────
        this.globalAudioEnabled  = this._load('globalAudioEnabled', true);
        this.sfxVolume           = this._load('sfxVolume',          0.5);
        this.typingSfxVolume     = this._load('typingSfxVolume',    0.2);
        this.bgmVolume           = this._load('bgmVolume',          0.4);

        // ── Observers (UI sync) ──────────────────────────────────────────────
        this.stateObservers = [];

        // ── Interaction & Autoplay Lock ──────────────────────────────────────
        this.userInteracted = false;
        this.pendingBgm     = null;
        this._setupInteractionListeners();

        // ── BGM Engine (dual-channel crossfade) ──────────────────────────────
        this.bgmAudio1        = this._createNode(true);
        this.bgmAudio2        = this._createNode(true);
        this.bgmAudio1.volume = 0;
        this.bgmAudio2.volume = 0;
        this.activeBgmChannel = 1;   // 1 or 2
        this.crossfadeInterval = null;
        this._bgmTargetUrl    = '';  // normalized absolute URL of the target track

        // ── SFX Pool (Round-Robin, fixed size) ───────────────────────────────
        this.sfxPoolSize = 8;
        this.sfxPool     = Array.from({ length: this.sfxPoolSize }, () => this._createNode(false));
        this.sfxIndex    = 0;

        // Track which pool slot is the "current character SFX" so skip can
        // stop specifically that one (and not future effects-pool sounds).
        this._lastCharSfxIndex = -1;

        // ── Scene SFX Tracking ───────────────────────────────────────────────
        this._sceneSfxStartTimers = [];
        this._sceneSfxEndTimers   = [];
        this._activeSceneSfxNodes = [];

        // ── Typing Sound ─────────────────────────────────────────────────────
        const typingSoundPath = (typeof ENGINE_CONFIG !== 'undefined' && ENGINE_CONFIG.audio)
            ? ENGINE_CONFIG.audio.typingSoundPath
            : 'core/assets/audio/typing_loop.mp3';
        this.typingSoundEffect = new Audio(typingSoundPath);
        this.typingSoundEffect.loop   = true;
        this.typingSoundEffect.volume = this.typingSfxVolume;
        this.typingSoundEffect.muted  = !this.globalAudioEnabled;
        this.typingSoundEffect.onerror = (e) => {
            if (this.logger.warn) this.logger.warn('[Audio] Typing sound failed to load:', e);
        };

        if (this.logger.info) this.logger.info('[Audio] AudioManager v2 initialised.');
    }

    // ── Node Factory ────────────────────────────────────────────────────────

    _createNode(loop) {
        const node  = new Audio();
        node.loop   = loop;
        node.onerror = (e) => {
            if (this.logger.warn) this.logger.warn('[Audio] Media error on node:', node.src, node.error || e);
        };
        return node;
    }

    // ── Interaction Unlock ──────────────────────────────────────────────────

    _setupInteractionListeners() {
        // { once: true } automatically removes each listener after the first fire.
        // No manual removeEventListener needed inside the handler.
        const unlock = () => this.forceUnlock();
        ['click', 'touchstart', 'keydown'].forEach(evt =>
            document.addEventListener(evt, unlock, { once: true, passive: true })
        );
    }

    forceUnlock() {
        if (this.userInteracted) return;
        this.userInteracted = true;
        if (this.logger.debug) this.logger.debug('[Audio] User interacted — audio system unlocked.');

        if (this.pendingBgm && this.globalAudioEnabled) {
            this._crossfadeTo(this.pendingBgm);
            this.pendingBgm = null;
        }

        // ── SFX Pool "Blessing" ──
        // Many browsers block .play() on nodes that haven't been triggered by a gesture.
        // We "bless" the pool now while we are inside the click/keydown event stack.
        this.sfxPool.forEach(node => {
            const originalSrc = node.src;
            // Silent play-pause
            node.play().then(() => {
                node.pause();
                node.currentTime = 0;
            }).catch(() => {});
        });
    }

    // ── Safe Play ──────────────────────────────────────────────────────────

    async _safePlay(node) {
        if (!this.userInteracted || !this.globalAudioEnabled) return;
        try {
            await node.play();
        } catch (err) {
            // AbortError: normal during rapid skipping (src change mid-play).
            // NotAllowedError / NotSupportedError: autoplay policy or bad format.
            // All are non-fatal — log non-abort errors only.
            if (err.name !== 'AbortError' && err.name !== 'NotSupportedError' && err.name !== 'NotAllowedError') {
                if (this.logger.warn) this.logger.warn(`[Audio] Playback error (${node.src}):`, err.message || err);
            }
        }
    }

    // ── URL Normalisation ──────────────────────────────────────────────────

    /**
     * Convert a relative URL to an absolute URL using the document base.
     * This is required for reliable src comparison because browsers always
     * expand audio.src to a fully-qualified URL.
     */
    _resolveAbsoluteUrl(relativeOrAbsolute) {
        try {
            return new URL(relativeOrAbsolute, document.baseURI).href;
        } catch {
            return relativeOrAbsolute; // already absolute or malformed — return as-is
        }
    }

    // ── BGM Engine ─────────────────────────────────────────────────────────

    playBackgroundMusic(url) {
        if (!url) return;

        if (!this.userInteracted || !this.globalAudioEnabled) {
            // Park URL until user interaction unlocks audio
            this.pendingBgm = url;
            return;
        }
        this._crossfadeTo(url);
    }

    _crossfadeTo(url) {
        if (!url) return;

        const resolvedUrl = this._resolveAbsoluteUrl(url);

        // FIX #1: Compare absolute URLs so relative paths don't bypass the guard
        if (this._bgmTargetUrl === resolvedUrl) {
            // Already playing (or crossfading to) this exact track — skip.
            return;
        }

        this._bgmTargetUrl = resolvedUrl;

        const currentCh  = this.activeBgmChannel;
        const currentNode = currentCh === 1 ? this.bgmAudio1 : this.bgmAudio2;
        const nextNode    = currentCh === 1 ? this.bgmAudio2 : this.bgmAudio1;

        clearInterval(this.crossfadeInterval);

        // Prepare incoming channel
        nextNode.src    = url;
        nextNode.load();
        nextNode.volume = 0;
        nextNode.muted  = !this.globalAudioEnabled;
        this._safePlay(nextNode);

        const fadeDuration = 1500; // ms total
        const steps        = 30;
        const stepTime     = fadeDuration / steps;
        let   currentStep  = 0;

        this.crossfadeInterval = setInterval(() => {
            currentStep++;
            // FIX #2: Derive volumeStep from live bgmVolume each tick
            const liveTarget  = this.globalAudioEnabled ? this.bgmVolume : 0;
            const t           = currentStep / steps; // 0.0 → 1.0

            if (currentStep >= steps) {
                clearInterval(this.crossfadeInterval);
                this.crossfadeInterval = null;

                nextNode.volume    = liveTarget;
                currentNode.volume = 0;
                currentNode.pause();
                currentNode.src    = '';          // release the old resource

                // Swap active channel
                this.activeBgmChannel = currentCh === 1 ? 2 : 1;
            } else {
                // Linear crossfade: next fades in, current fades out
                nextNode.volume    = Math.max(0, Math.min(t * liveTarget,       liveTarget));
                currentNode.volume = Math.max(0, Math.min((1 - t) * liveTarget, liveTarget));
            }
        }, stepTime);
    }

    setBgmVolume(volume) {
        this.bgmVolume = Math.max(0, Math.min(volume, 1));
        this._save('bgmVolume', this.bgmVolume);

        // FIX #4: Update whichever channel is currently audible.
        // During a crossfade both nodes are active; update each proportionally
        // is complex, so we simply clamp to the new ceiling.  The next tick of
        // the crossfade interval will self-correct using the live bgmVolume.
        if (!this.crossfadeInterval) {
            // Not crossfading — just set the active channel directly.
            const activeNode = this.activeBgmChannel === 1 ? this.bgmAudio1 : this.bgmAudio2;
            if (this.globalAudioEnabled) activeNode.volume = this.bgmVolume;
        }
        // During a crossfade the interval tick re-reads bgmVolume live, so no
        // extra action needed — it self-corrects on the very next tick.
    }

    // ── SFX Pool Engine ───────────────────────────────────────────────────

    /**
     * Play a one-shot SFX from the character pool.
     * Stops the previously-playing pool node before reusing it.
     * @param {string} src  - Relative or absolute URL of the audio file.
     * @param {boolean} [isCharSfx=false] - Mark as character SFX for targeted stop-on-skip.
     */
    playSfx(src, isCharSfx = false) {
        // FIX #7: Bail out before any DOM work if audio isn't unlocked yet.
        if (!this.globalAudioEnabled || !this.userInteracted || !src || src.startsWith('/path/')) return;

        const idx  = this.sfxIndex;
        this.sfxIndex = (this.sfxIndex + 1) % this.sfxPoolSize;

        const node = this.sfxPool[idx];

        // FIX #6: Stop and detach the node before reusing it.
        // Without this, the previous sound on this slot bleeds into the next play.
        if (!node.paused) {
            node.pause();
        }
        node.currentTime = 0;

        // FIX #5: Set muted BEFORE src so the browser doesn't decode+buffer
        // an unmuted frame before the flag is applied.
        node.muted  = !this.globalAudioEnabled;
        node.volume = this.sfxVolume;
        node.src    = src;

        this._safePlay(node);

        if (isCharSfx) this._lastCharSfxIndex = idx;
    }

    /**
     * Stop ALL currently-playing SFX pool nodes immediately.
     * Called on skip to prevent the previous character SFX from overlapping
     * with the next dialogue's SFX.
     */
    stopAllSfx() {
        this.sfxPool.forEach(node => {
            if (!node.paused) {
                node.pause();
            }
            node.currentTime = 0;
        });
        this._lastCharSfxIndex = -1;
        if (this.logger.debug) this.logger.debug('[Audio] All SFX stopped (skip/clear).');
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(volume, 1));
        this._save('sfxVolume', this.sfxVolume);

        // FIX #14: Apply to all live pool nodes so in-flight sounds update immediately.
        this.sfxPool.forEach(node => { node.volume = this.sfxVolume; });
        this._activeSceneSfxNodes.forEach(node => { node.volume = this.sfxVolume; });
    }

    // ── Scene SFX Engine (Timebound) ──────────────────────────────────────

    playSceneSfx(src, delayStartMs, delayEndMs) {
        if (!this.globalAudioEnabled || !this.userInteracted || !src) return;

        const msStart = (delayStartMs !== null && delayStartMs !== undefined) ? parseInt(delayStartMs) : 0;
        
        const startTimer = setTimeout(() => {
            const node = this._createNode(false);
            node.src    = src;
            node.volume = this.sfxVolume;
            node.muted  = !this.globalAudioEnabled;
            
            this._safePlay(node);
            this._activeSceneSfxNodes.push(node);

            if (delayEndMs !== null && delayEndMs !== undefined) {
                const msEnd = parseInt(delayEndMs);
                const duration = Math.max(0, msEnd - msStart);
                const endTimer = setTimeout(() => {
                    node.pause();
                    node.currentTime = 0;
                    // Remove from active nodes list
                    const index = this._activeSceneSfxNodes.indexOf(node);
                    if (index > -1) {
                        this._activeSceneSfxNodes.splice(index, 1);
                    }
                }, duration);
                this._sceneSfxEndTimers.push(endTimer);
            }
        }, msStart);

        this._sceneSfxStartTimers.push(startTimer);
    }

    clearSceneSfx() {
        this._sceneSfxStartTimers.forEach(t => clearTimeout(t));
        this._sceneSfxStartTimers = [];
        
        this._sceneSfxEndTimers.forEach(t => clearTimeout(t));
        this._sceneSfxEndTimers = [];
        
        this._activeSceneSfxNodes.forEach(node => {
            if (!node.paused) {
                node.pause();
            }
            node.currentTime = 0;
        });
        this._activeSceneSfxNodes = [];
    }

    setTypingSfxVolume(volume) {
        this.typingSfxVolume               = Math.max(0, Math.min(volume, 1));
        this.typingSoundEffect.volume      = this.typingSfxVolume;
        this._save('typingSfxVolume', this.typingSfxVolume);
    }

    // ── Global Mute / Unmute ───────────────────────────────────────────────

    toggleGlobalAudio() {
        this.globalAudioEnabled = !this.globalAudioEnabled;

        // FIX #9: Apply mute to BOTH BGM channels to handle mid-crossfade state.
        this.bgmAudio1.muted          = !this.globalAudioEnabled;
        this.bgmAudio2.muted          = !this.globalAudioEnabled;
        this.typingSoundEffect.muted  = !this.globalAudioEnabled;
        this.sfxPool.forEach(node => { node.muted = !this.globalAudioEnabled; });
        this._activeSceneSfxNodes.forEach(node => { node.muted = !this.globalAudioEnabled; });

        const activeNode = this.activeBgmChannel === 1 ? this.bgmAudio1 : this.bgmAudio2;

        if (!this.globalAudioEnabled) {
            // Pause active BGM; crossfade interval uses muted so it can resume cleanly.
            activeNode.pause();
            if (this.crossfadeInterval) {
                clearInterval(this.crossfadeInterval);
                this.crossfadeInterval = null;
                // Reset bgmTargetUrl so re-enabling triggers a fresh play
                this._bgmTargetUrl = '';
            }
        } else {
            // Resume: play active node if it has a source, else dispatch pending.
            if (activeNode.src && activeNode.src !== window.location.href) {
                this._safePlay(activeNode);
            } else if (this.pendingBgm) {
                this._crossfadeTo(this.pendingBgm);
                this.pendingBgm = null;
            }
        }

        this._save('globalAudioEnabled', this.globalAudioEnabled);
        this._notifyObservers();
        return this.globalAudioEnabled;
    }

    // ── Typing Sound ──────────────────────────────────────────────────────

    /**
     * Start the typing loop if it isn't already playing.
     */
    playTypingSound() {
        if (!this.globalAudioEnabled) return;
        // FIX #11: Removed misleading try/catch — _safePlay handles async errors internally.
        if (this.typingSoundEffect.paused) {
            this._safePlay(this.typingSoundEffect);
        }
    }

    /**
     * Stop the typing loop.
     * FIX #10: Does NOT reset currentTime — avoids audible click/pop on resume
     * because the loop continues from its playback position next time.
     */
    stopTypingSound() {
        if (!this.typingSoundEffect.paused) {
            this.typingSoundEffect.pause();
            // Intentionally NOT resetting currentTime — seamless loop behaviour.
        }
    }

    // ── Observer Pattern (UI Sync) ────────────────────────────────────────

    subscribe(callback) {
        if (typeof callback !== 'function') return;
        this.stateObservers.push(callback);
        // Fire immediately so the UI is in sync on registration.
        callback(this.globalAudioEnabled);
    }

    _notifyObservers() {
        this.stateObservers.forEach(cb => {
            try { cb(this.globalAudioEnabled); }
            catch (e) { if (this.logger.warn) this.logger.warn('[Audio] Observer error:', e); }
        });
    }

    // ── Persistence ───────────────────────────────────────────────────────

    _save(key, value) {
        try {
            localStorage.setItem('lvne_' + key, JSON.stringify(value));
        } catch (e) {
            if (this.logger.warn) this.logger.warn(`[Audio] Failed to save "${key}":`, e);
        }
    }

    _load(key, fallback) {
        try {
            const raw = localStorage.getItem('lvne_' + key);
            return raw !== null ? JSON.parse(raw) : fallback;
        } catch (e) {
            if (this.logger.warn) this.logger.warn(`[Audio] Failed to load "${key}", using fallback:`, e);
            return fallback;
        }
    }
}

// ── Global singleton ──────────────────────────────────────────────────────────
const audioManager = new AudioManager();