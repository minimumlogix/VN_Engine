/**
 * Narration.js — The "Brain" of the Engine
 * Handles story topology, state variables, and branching history.
 * Pure logic — no DOM dependencies.
 */

class NarrationEngine {
    constructor(dialogueData, initialState = {}) {
        this.nodes = dialogueData;
        this.state = JSON.parse(JSON.stringify(initialState));
        this.history = [];
        this.currentIndex = 0;

        // Build ID Map for fast jumping
        this.idMap = {};
        this.nodes.forEach((node, idx) => {
            if (node.id) this.idMap[node.id] = idx;
        });

        this.logger = typeof appLogger !== 'undefined' ? appLogger : console;
    }

    /**
     * Get the current active story node
     */
    getCurrentNode() {
        return this.nodes[this.currentIndex] || null;
    }

    /**
     * Advance the narrative pointer
     * @param {string|number} target - Optional target ID or index
     */
    advance(target = null) {
        // Save history for back-navigation
        this.history.push({
            index: this.currentIndex,
            state: JSON.parse(JSON.stringify(this.state))
        });

        const current = this.getCurrentNode();

        // 1. Manual Jump (Choice results)
        if (target !== null) {
            if (this.idMap[target] !== undefined) {
                this.currentIndex = this.idMap[target];
            } else if (typeof target === 'number') {
                this.currentIndex = target;
            }
            return;
        }

        // 2. Linear nextId jump
        if (current?.nextId && this.idMap[current.nextId] !== undefined) {
            this.currentIndex = this.idMap[current.nextId];
            return;
        }

        // 3. Default increment
        this.currentIndex++;
    }

    /**
     * Revert one step back in time
     */
    stepBack() {
        if (this.history.length === 0) return null;

        const last = this.history.pop();
        this.currentIndex = last.index;
        this.state = last.state;

        return this.getCurrentNode();
    }

    /**
     * Evaluate a logical condition string against current state
     */
    evaluateCondition(conditionStr) {
        if (!conditionStr) return true;
        try {
            // Scoped execution for state variables
            const func = new Function('state', `with(state) { return ${conditionStr}; }`);
            return func(this.state);
        } catch (e) {
            this.logger.error(`[Narration] Logic error: ${conditionStr}`, e);
            return false;
        }
    }

    /**
     * Apply delta effects to state
     */
    applyEffect(effectObj) {
        if (!effectObj) return;
        Object.entries(effectObj).forEach(([key, val]) => {
            const current = this.state[key] || 0;
            this.state[key] = current + val;
        });
    }

    /**
     * Reset the entire engine
     */
    reset(initialState) {
        this.currentIndex = 0;
        this.history = [];
        this.state = JSON.parse(JSON.stringify(initialState || {}));
    }
}