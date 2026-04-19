/**
 * Writing.js — The "Mouth" of the Engine
 * Handles high-performance typewriter rendering and tokenization.
 */

class WritingEngine {
    constructor(displayElement, ghostElement) {
        this.el = displayElement;
        this.ghost = ghostElement;
        this.isTyping = false;
        this.speed = 50;
        this.skipRequested = false;
        this.instanceId = 0;

        // Callbacks for the Controller
        this.onCharTyped = null;
        this.onComplete = null;
    }

    setSpeed(ms) {
        this.speed = ms;
    }

    /**
     * Force stop any ongoing typing immediately
     */
    forceStop() {
        this.instanceId++;
        this.isTyping = false;
    }

    /**
     * Skip to the end of the current string
     */
    skip() {
        if (this.isTyping) this.skipRequested = true;
    }

    /**
     * Perform the typing operation
     */
    async write(rawText) {
        const id = ++this.instanceId;
        this.isTyping = true;
        this.skipRequested = false;

        // 1. Layout Lock
        if (this.ghost) {
            this.ghost.style.width = getComputedStyle(this.el).width;
            this.ghost.innerHTML = rawText;
            this.el.style.minHeight = `${this.ghost.offsetHeight}px`;
        }

        this.el.innerHTML = '';

        // 2. Tokenize (Tags and Logic Events)
        const tokens = rawText.split(/(<[^>]+>|\[[^\]]+\])/g);
        let buffer = "";

        for (const token of tokens) {
            if (this.instanceId !== id) return;

            // Handle Tags instantly
            if (token.startsWith('<')) {
                buffer += token;
                continue;
            }

            // Handle Engine Macros (e.g. [shake])
            if (token.startsWith('[')) {
                const macro = token.slice(1, -1);
                if (typeof effectsEngine !== 'undefined') effectsEngine.triggerMacro(macro);
                continue;
            }

            // Type Characters
            for (const char of token) {
                if (this.instanceId !== id) return;

                if (this.skipRequested) break;

                // Sync with external UI pause states dynamically
                while (typeof state !== 'undefined' && state.isPaused && !this.skipRequested) {
                    await new Promise(r => setTimeout(r, 100));
                }

                buffer += char;
                this.el.innerHTML = buffer;

                if (this.onCharTyped) this.onCharTyped(char);

                // Punctuation Pacing
                let delay = this.speed;
                if (/[.!?]/.test(char)) delay *= 15;
                else if (/,/.test(char)) delay *= 8;

                await new Promise(r => setTimeout(r, delay));
            }
        }

        // Final Cleanup
        if (this.instanceId === id) {
            this.el.innerHTML = rawText.replace(/\[[^\]]+\]/g, '');
            this.el.style.minHeight = 'auto';
            this.isTyping = false;
            if (this.onComplete) this.onComplete();
        }
    }
}