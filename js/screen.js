// screen.js — Smart Screen State Manager v2
class ScreenManager {
    constructor() {
        this.screens = {};
        this.currentScreen = null;
        this.previousScreen = null;
        this.history = [];
        this.listeners = {};
        this.hooks = {};       // { screenName: { onEnter, onLeave } }
        this.cleanups = {};    // { screenName: [fn, fn, ...] }

        // Auto-register screens found in the DOM
        document.querySelectorAll('.screen[id]').forEach(el => {
            const name = el.id.replace('Screen', '').toLowerCase();
            this.registerScreen(name, el);
        });
    }

    /**
     * Register a screen element with optional lifecycle hooks.
     * @param {string} name - Screen identifier (e.g., 'home', 'story', 'end')
     * @param {HTMLElement} element - The screen DOM element
     * @param {Object} [hooks] - { onEnter(to, from), onLeave(from, to) }
     */
    registerScreen(name, element, hooks = {}) {
        this.screens[name] = element;
        if (hooks.onEnter || hooks.onLeave) {
            this.hooks[name] = { ...this.hooks[name], ...hooks };
        }
    }

    /**
     * Set lifecycle hooks for a screen after initial registration.
     * @param {string} name - Screen identifier
     * @param {Object} hooks - { onEnter(to, from), onLeave(from, to) }
     */
    setHooks(name, hooks) {
        this.hooks[name] = { ...this.hooks[name], ...hooks };
    }

    /**
     * Register a cleanup function for a screen. Called when LEAVING that screen.
     * @param {string} screenName
     * @param {Function} cleanupFn
     */
    addCleanup(screenName, cleanupFn) {
        if (!this.cleanups[screenName]) this.cleanups[screenName] = [];
        this.cleanups[screenName].push(cleanupFn);
    }

    /**
     * Show a screen by name.
     * @param {string} screenName - Screen to show
     * @param {Object} [options] - { pushHistory: true, skipCleanup: false }
     */
    showScreen(screenName, options = {}) {
        const { pushHistory = true, skipCleanup = false } = options;

        if (!this.screens[screenName]) {
            console.error(`[ScreenManager] Screen "${screenName}" not found. Registered: ${Object.keys(this.screens).join(', ')}`);
            return;
        }

        const from = this.currentScreen;
        const to = screenName;

        // Skip if already on this screen
        if (from === to) return;

        // Run cleanup functions for the screen being left
        if (from && !skipCleanup) {
            this._runCleanups(from);
        }

        // Call onLeave hook for current screen
        if (from && this.hooks[from]?.onLeave) {
            try { this.hooks[from].onLeave(from, to); } catch (e) { console.error('[ScreenManager] onLeave error:', e); }
        }

        // Hide all screens
        Object.values(this.screens).forEach(el => {
            el.style.display = 'none';
        });

        // Show target screen
        this.screens[to].style.display = 'flex';

        // Update state
        this.previousScreen = from;
        this.currentScreen = to;

        if (pushHistory && from) {
            this.history.push(from);
        }

        // Call onEnter hook for new screen
        if (this.hooks[to]?.onEnter) {
            try { this.hooks[to].onEnter(to, from); } catch (e) { console.error('[ScreenManager] onEnter error:', e); }
        }

        // Context-aware UI updates
        this._updateContextUI(to);

        // Fire event listeners
        this._emit('change', { from, to });
    }

    /**
     * Go back to the previous screen in history.
     * @returns {boolean} true if navigated back, false if no history
     */
    goBack() {
        if (this.history.length === 0) {
            console.warn('[ScreenManager] No screen history to go back to.');
            return false;
        }
        const prev = this.history.pop();
        this.showScreen(prev, { pushHistory: false });
        return true;
    }

    /**
     * Quick state check.
     * @param {string} screenName - Screen to check
     * @returns {boolean}
     */
    is(screenName) {
        return this.currentScreen === screenName;
    }

    /**
     * Check if coming from a specific screen.
     * @param {string} screenName
     * @returns {boolean}
     */
    wasOn(screenName) {
        return this.previousScreen === screenName;
    }

    /**
     * Get the current screen name.
     * @returns {string|null}
     */
    getCurrentScreen() {
        return this.currentScreen;
    }

    /**
     * Get the previous screen name.
     * @returns {string|null}
     */
    getPreviousScreen() {
        return this.previousScreen;
    }

    /**
     * Get the full navigation history.
     * @returns {string[]}
     */
    getHistory() {
        return [...this.history];
    }

    /**
     * Subscribe to screen change events.
     * @param {string} event - Event name ('change')
     * @param {Function} callback - Called with { from, to }
     * @returns {Function} unsubscribe function
     */
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
        return () => {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        };
    }

    // ── Private ──

    _runCleanups(screenName) {
        (this.cleanups[screenName] || []).forEach(fn => {
            try { fn(); } catch (e) { console.error(`[ScreenManager] Cleanup error for "${screenName}":`, e); }
        });
    }

    _emit(event, data) {
        (this.listeners[event] || []).forEach(cb => {
            try { cb(data); } catch (e) { console.error(`[ScreenManager] Event handler error:`, e); }
        });
    }

    _updateContextUI(screenName) {
        // No longer needed: context UI for home screen has been permanently removed
    }
}

// Initialize screen manager
const screenManager = new ScreenManager();