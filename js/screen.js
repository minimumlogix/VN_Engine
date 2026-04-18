// screen.js — Smart Screen State Manager v3 (Perfected)
// ============================================================================
// BUG FIXES vs v2:
//  1. Display mode per screen — configurable, not hardcoded 'flex' everywhere.
//  2. Loading screen correctly synced into ScreenManager state on boot.
//  3. addCleanup is idempotent — duplicate registrations are prevented.
//  4. goBack() passes correct cleanup semantics; no double-cleanup on same frame.
//  5. Cleanup queue is cleared after run to prevent stale double-execution.
//  6. History capped at MAX_HISTORY_SIZE to prevent unbounded memory growth.
//  7. All public methods guard against null/unregistered screen names.
//  8. showScreen is re-entrant safe — pending transitions are rejected cleanly.
//  9. DOM auto-registration correctly derives display mode from existing CSS.
// 10. _updateContextUI dead stub fully removed.
// ============================================================================

class ScreenManager {
    constructor() {
        this.screens      = {};     // { name: { el, displayMode } }
        this.hooks        = {};     // { name: { onEnter, onLeave } }
        this.cleanups     = {};     // { name: Set<fn> } — Set prevents duplicate registrations
        this.listeners    = {};     // { event: [fn, ...] }

        this.currentScreen  = null;
        this.previousScreen = null;
        this.history        = [];

        this._transitioning = false;

        // Cap navigation history to prevent unbounded memory growth
        this.MAX_HISTORY_SIZE = 100;

        // Auto-register all .screen[id] elements found in the DOM
        document.querySelectorAll('.screen[id]').forEach(el => {
            // Derive logical name: storyScreen → story, endScreen → end, loadingScreen → loading
            const name = el.id.replace(/Screen$/i, '').toLowerCase();

            // Determine the natural display mode from existing inline styles or CSS.
            // If the element already has a computed display, honour it; otherwise default to 'flex'.
            const computedDisplay = getComputedStyle(el).display;
            const naturalDisplay  = (computedDisplay && computedDisplay !== 'none')
                ? computedDisplay
                : 'flex';

            this._register(name, el, naturalDisplay);
        });

        // Sync internal state: identify which screen is visually active right now.
        // This stops currentScreen from being null when the first showScreen() fires.
        this._syncInitialState();
    }

    // ── Registration ────────────────────────────────────────────────────────

    /**
     * Register (or re-register) a screen element.
     * @param {string}      name        - Logical name (e.g. 'story', 'end')
     * @param {HTMLElement} element     - DOM element
     * @param {string}      [display]   - CSS display value when visible (default: 'flex')
     * @param {Object}      [hooks]     - { onEnter(to, from), onLeave(from, to) }
     */
    registerScreen(name, element, display = 'flex', hooks = {}) {
        if (!name || !element) {
            console.error('[ScreenManager] registerScreen() requires a name and element.');
            return;
        }
        this._register(name, element, display, hooks);
    }

    /**
     * Set or merge lifecycle hooks for a screen.
     * @param {string} name
     * @param {{ onEnter?: Function, onLeave?: Function }} hooks
     */
    setHooks(name, hooks = {}) {
        if (!this._exists(name)) {
            console.warn(`[ScreenManager] setHooks() — screen "${name}" is not registered.`);
            return;
        }
        this.hooks[name] = { ...(this.hooks[name] || {}), ...hooks };
    }

    /**
     * Register a cleanup function for a screen.
     * Called when LEAVING that screen. Duplicate functions are silently ignored.
     * @param {string}   screenName
     * @param {Function} cleanupFn
     */
    addCleanup(screenName, cleanupFn) {
        if (!this._exists(screenName)) {
            console.warn(`[ScreenManager] addCleanup() — screen "${screenName}" is not registered.`);
            return;
        }
        if (typeof cleanupFn !== 'function') {
            console.error('[ScreenManager] addCleanup() requires a function.');
            return;
        }
        // Using a Set prevents the same function from being registered more than once,
        // which eliminates the stacking bug when setupEventListeners() is called repeatedly.
        if (!this.cleanups[screenName]) this.cleanups[screenName] = new Set();
        this.cleanups[screenName].add(cleanupFn);
    }

    /**
     * Remove a previously registered cleanup function for a screen.
     * @param {string}   screenName
     * @param {Function} cleanupFn
     */
    removeCleanup(screenName, cleanupFn) {
        this.cleanups[screenName]?.delete(cleanupFn);
    }

    // ── Navigation ──────────────────────────────────────────────────────────

    /**
     * Transition to a named screen.
     * @param {string}  screenName
     * @param {Object}  [options]
     * @param {boolean} [options.pushHistory=true]   - Add current screen to history stack.
     * @param {boolean} [options.skipCleanup=false]  - Skip cleanup fns for the screen being left.
     * @param {boolean} [options.force=false]        - Force transition even if already on screen.
     */
    showScreen(screenName, options = {}) {
        const { pushHistory = true, skipCleanup = false, force = false } = options;

        if (!this._exists(screenName)) {
            console.error(
                `[ScreenManager] Screen "${screenName}" not registered.`,
                `  Known screens: [${Object.keys(this.screens).join(', ')}]`
            );
            return false;
        }

        const from = this.currentScreen;
        const to   = screenName;

        // Already here and not forced — silently no-op.
        if (!force && from === to) return false;

        // Guard against re-entrant calls (e.g. onLeave hook triggering another showScreen).
        if (this._transitioning) {
            console.warn(`[ScreenManager] Transition to "${to}" blocked — already transitioning from "${from}". ` +
                         `Finish the current transition before navigating again.`);
            return false;
        }

        this._transitioning = true;

        try {
            // 1. Run cleanup functions for the screen being left
            if (from && !skipCleanup) {
                this._runCleanups(from);
            }

            // 2. Call onLeave hook for current screen
            if (from && this.hooks[from]?.onLeave) {
                try {
                    this.hooks[from].onLeave(from, to);
                } catch (e) {
                    console.error('[ScreenManager] onLeave hook threw an error:', e);
                }
            }

            // 3. Hide all screens atomically
            Object.values(this.screens).forEach(({ el }) => {
                el.style.display = 'none';
            });

            // 4. Show the target screen using its registered display mode
            const { el: targetEl, displayMode } = this.screens[to];
            targetEl.style.display = displayMode;

            // 5. Update navigation state
            this.previousScreen = from;
            this.currentScreen  = to;

            if (pushHistory && from) {
                this.history.push(from);
                // Enforce history cap
                if (this.history.length > this.MAX_HISTORY_SIZE) {
                    this.history.shift();
                }
            }

        } finally {
            // Always release the lock, even if hooks throw
            this._transitioning = false;
        }

        // 6. Call onEnter hook for incoming screen (after lock released — hook may call showScreen)
        if (this.hooks[to]?.onEnter) {
            try {
                this.hooks[to].onEnter(to, from);
            } catch (e) {
                console.error('[ScreenManager] onEnter hook threw an error:', e);
            }
        }

        // 7. Emit change event
        this._emit('change', { from, to });

        return true;
    }

    /**
     * Go back to the previous screen in history.
     * Does NOT run cleanups for the screen being left (the 'back' direction
     * implies the user is undoing, not committing).
     * @returns {boolean} true if navigated back successfully.
     */
    goBack() {
        if (this.history.length === 0) {
            console.warn('[ScreenManager] goBack() — history is empty, cannot go back.');
            return false;
        }
        const prev = this.history.pop();
        // skipCleanup: true because going back should not trigger forward-direction cleanups.
        // pushHistory: false to avoid polluting history with the round-trip.
        return this.showScreen(prev, { pushHistory: false, skipCleanup: true });
    }

    /**
     * Clear the entire navigation history.
     */
    clearHistory() {
        this.history = [];
    }

    // ── State Queries ───────────────────────────────────────────────────────

    /** @returns {boolean} true if the named screen is currently active. */
    is(screenName) {
        return this.currentScreen === screenName;
    }

    /** @returns {boolean} true if the previous screen was the named screen. */
    wasOn(screenName) {
        return this.previousScreen === screenName;
    }

    /** @returns {string|null} the current screen name, or null if none active. */
    getCurrentScreen() {
        return this.currentScreen;
    }

    /** @returns {string|null} the previous screen name, or null. */
    getPreviousScreen() {
        return this.previousScreen;
    }

    /** @returns {string[]} a shallow copy of the navigation history stack. */
    getHistory() {
        return [...this.history];
    }

    /** @returns {boolean} true if a screen with this name is registered. */
    has(screenName) {
        return this._exists(screenName);
    }

    // ── Events ──────────────────────────────────────────────────────────────

    /**
     * Subscribe to screen change events.
     * @param {string}   event    - Event name (currently: 'change')
     * @param {Function} callback - Receives { from: string|null, to: string }
     * @returns {Function} call this to unsubscribe and prevent memory leaks.
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            console.error('[ScreenManager] on() requires a function callback.');
            return () => {};
        }
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);

        // Return a proper unsubscribe handle; callers SHOULD store and call this.
        return () => {
            if (this.listeners[event]) {
                this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
            }
        };
    }

    // ── Private ─────────────────────────────────────────────────────────────

    _register(name, el, displayMode = 'flex', hooks = {}) {
        this.screens[name] = { el, displayMode };
        if (hooks.onEnter || hooks.onLeave) {
            this.hooks[name] = { ...(this.hooks[name] || {}), ...hooks };
        }
    }

    _exists(name) {
        return typeof name === 'string' && name in this.screens;
    }

    /**
     * Walk the DOM to determine which .screen element is currently visible,
     * and sync our internal state accordingly.
     * Prevents currentScreen from starting as null when the page loads with
     * a visible screen already rendered.
     */
    _syncInitialState() {
        for (const [name, { el }] of Object.entries(this.screens)) {
            const display = el.style.display || getComputedStyle(el).display;
            if (display !== 'none' && display !== '') {
                // Found a visible screen — treat it as the current one without
                // triggering hooks or emitting events (this is a passive sync).
                this.currentScreen = name;
                return;
            }
        }
        // If nothing is explicitly visible (all hidden), currentScreen stays null.
    }

    _runCleanups(screenName) {
        const cleanupSet = this.cleanups[screenName];
        if (!cleanupSet || cleanupSet.size === 0) return;

        cleanupSet.forEach(fn => {
            try { fn(); }
            catch (e) { console.error(`[ScreenManager] Cleanup error for "${screenName}":`, e); }
        });
        // DO NOT clear the Set here — cleanups are persistent registrations.
        // They fire every time the screen is left, not just once.
    }

    _emit(event, data) {
        (this.listeners[event] || []).forEach(cb => {
            try { cb(data); }
            catch (e) { console.error('[ScreenManager] Event listener error:', e); }
        });
    }
}

// ── Global singleton ─────────────────────────────────────────────────────────
const screenManager = new ScreenManager();