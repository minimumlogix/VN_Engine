const editorContainer = document.getElementById('editor-container');
const workspace = document.getElementById('workspace');
const svg = document.getElementById('connections-svg');

// --- DATA MANAGEMENT (AAA STORE) ---

class NexusDataStore {
    constructor() {
        this.nodes = [];
        this.links = [];
        this.groups = [];
        this.config = JSON.parse(JSON.stringify(DEFAULT_STORY_DATA)); // Deep clone
        this.listeners = [];
        this.autoSaveKey = 'nexus_editor_autosave';
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = 100;
        this.historyTimer = null;
    }

    pushSnapshot() {
        const snapshot = JSON.stringify({
            nodes: this.nodes,
            links: this.links,
            groups: this.groups,
            config: this.config
        });
        const last = this.undoStack[this.undoStack.length - 1];
        if (last === snapshot) return;
        this.undoStack.push(snapshot);
        this.redoStack = [];
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
    }

    undo() {
        if (this.undoStack.length <= 1) {
            showToast('Nothing to undo', 'warn');
            return;
        }
        const current = JSON.stringify({
            nodes: this.nodes,
            links: this.links,
            groups: this.groups,
            config: this.config
        });
        this.redoStack.push(current);
        this.undoStack.pop();
        const prevState = JSON.parse(this.undoStack[this.undoStack.length - 1]);
        this.nodes = prevState.nodes || [];
        this.links = prevState.links || [];
        this.groups = prevState.groups || [];
        this.config = prevState.config || this.config;
        this.emit('nodes_changed');
        this.emit('groups_changed');
        this.emit('config_refresh');
        this.emit('links_changed');
        showToast('Undo');
    }

    redo() {
        if (this.redoStack.length === 0) {
            showToast('Nothing to redo', 'warn');
            return;
        }
        const current = JSON.stringify({
            nodes: this.nodes,
            links: this.links,
            groups: this.groups,
            config: this.config
        });
        this.undoStack.push(current);
        const nextState = JSON.parse(this.redoStack.pop());
        this.nodes = nextState.nodes || [];
        this.links = nextState.links || [];
        this.groups = nextState.groups || [];
        this.config = nextState.config || this.config;
        this.emit('nodes_changed');
        this.emit('groups_changed');
        this.emit('config_refresh');
        this.emit('links_changed');
        showToast('Redo');
    }

    // Observer Pattern
    subscribe(callback) {
        this.listeners.push(callback);
    }

    emit(event, data) {
        console.log(`[DataStore] ${event}`, data);
        this.listeners.forEach(cb => cb(event, data));
        this.save();
    }

    // --- Persistence ---
    save() {
        const payload = {
            nodes: this.nodes,
            links: this.links,
            groups: this.groups,
            config: this.config
        };
        localStorage.setItem(this.autoSaveKey, JSON.stringify(payload));
    }

    load() {
        const saved = localStorage.getItem(this.autoSaveKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.nodes = data.nodes || [];
                this.links = data.links || [];
                this.groups = data.groups || [];
                this.config = data.config || this.config;

                // MIGRATION: Convert object initialState to array if needed
                if (this.config.initialState && !Array.isArray(this.config.initialState)) {
                    console.log("Migrating initialState to array structure...");
                    const newInit = [];
                    Object.entries(this.config.initialState).forEach(([k, v]) => {
                        newInit.push({ id: 'var_' + Math.random().toString(36).substr(2, 9), key: k, value: v });
                    });
                    this.config.initialState = newInit;
                }

                return true;
            } catch (e) {
                console.error("Failed to load autosave", e);
                showToast("Corrupted autosave cleared", "error");
                localStorage.removeItem(this.autoSaveKey);
            }
        }
        return false;
    }

    clearAutosave(isFactoryReset = false) {
        localStorage.removeItem(this.autoSaveKey);
        if (isFactoryReset) {
            localStorage.setItem('nexus_factory_reset', 'true');
        }
        // Also clear undo/redo stacks so nothing is recoverable after reset
        this.undoStack = [];
        this.redoStack = [];
        location.reload();
    }

    // --- Node Operations ---
    addNode(type, x, y) {
        this.pushSnapshot();
        const id = 'node_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        const node = {
            id, type,
            x: (x - offset.x) / zoom,
            y: (y - offset.y) / zoom,
            data: {},
            choices: type === 'choice' ? [{ text: 'Option 1', target: null }] : []
        };
        this.nodes.push(node);
        this.emit('nodes_changed');
        return node;
    }

    deleteNode(id) {
        this.pushSnapshot();

        // AAA Cleanup: Destroy and remove the rich editor instance for this node
        if (window._nexusRichEditors && window._nexusRichEditors[id]) {
            window._nexusRichEditors[id].destroy();
            delete window._nexusRichEditors[id];
        }

        this.nodes = this.nodes.filter(n => n.id !== id);
        this.links = this.links.filter(l => l.fromNode !== id && l.toNode !== id);
        this.emit('nodes_changed');
    }

    updateNodeData(id, field, value) {
        const node = this.nodes.find(n => n.id === id);
        if (node) {
            if (!this.historyTimer) {
                this.pushSnapshot();
            }
            clearTimeout(this.historyTimer);
            this.historyTimer = setTimeout(() => {
                this.historyTimer = null;
            }, 1000);
            node.data[field] = value;
            this.emit('node_data_updated', { id, field });
        }
    }

    updateNodePos(id, x, y) {
        const node = this.nodes.find(n => n.id === id);
        if (node) {
            node.x = x;
            node.y = y;
        }
    }

    // --- Choice Logic ---
    addChoice(nodeId) {
        this.pushSnapshot();
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.type === 'choice') {
            node.choices.push({ text: 'New Choice', target: null });
            this.emit('node_refresh', nodeId);
        }
    }

    updateChoice(nodeId, idx, text) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.choices[idx]) {
            if (!this.historyTimer) {
                this.pushSnapshot();
            }
            clearTimeout(this.historyTimer);
            this.historyTimer = setTimeout(() => {
                this.historyTimer = null;
            }, 1000);
            node.choices[idx].text = text;
            this.emit('data_updated');
        }
    }

    // --- Gate Logic ---
    addGate(nodeId) {
        this.pushSnapshot();
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.type === 'condition') {
            if (!node.data.gates) node.data.gates = [];
            const defaultVar = (this.config.initialState && this.config.initialState[0]) ? this.config.initialState[0].key : 'new_var';
            node.data.gates.push({ variable: defaultVar, operator: '==', value: 0 });
            this.emit('node_refresh', nodeId);
        }
    }

    updateGate(nodeId, idx, field, value) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.data.gates && node.data.gates[idx]) {
            if (!this.historyTimer) {
                this.pushSnapshot();
            }
            clearTimeout(this.historyTimer);
            this.historyTimer = setTimeout(() => {
                this.historyTimer = null;
            }, 1000);
            node.data.gates[idx][field] = value;
            this.emit('data_updated');
            if (field === 'variable' || field === 'operator') {
                this.emit('node_refresh', nodeId);
            }
        }
    }

    deleteGate(nodeId, idx) {
        this.pushSnapshot();
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.data.gates) {
            node.data.gates.splice(idx, 1);
            this.emit('node_refresh', nodeId);
        }
    }


    // --- Link Operations ---
    createLink(fromNode, fromPort, toNode, toPort) {
        this.pushSnapshot();
        this.links = this.links.filter(l => !(l.fromNode === fromNode && l.fromPort === fromPort));
        this.links.push({ fromNode, fromPort, toNode, toPort });
        this.emit('links_changed');
    }

    // --- Global Config Operations ---
    updateConfig(field, value) {
        this.pushSnapshot();
        this.config[field] = value;
        this.emit('config_updated');
    }

    addStateVar(key = "new_var", val = 0) {
        this.pushSnapshot();
        const id = 'var_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        this.config.initialState.push({ id, key, value: val });
        this.emit('config_refresh');
    }

    deleteStateVar(id) {
        this.pushSnapshot();
        this.config.initialState = this.config.initialState.filter(v => v.id !== id);
        this.emit('config_refresh');
    }

    updateStateVar(id, newKey, newValue) {
        if (!this.historyTimer) {
            this.pushSnapshot();
        }
        clearTimeout(this.historyTimer);
        this.historyTimer = setTimeout(() => {
            this.historyTimer = null;
        }, 1000);

        const variable = this.config.initialState.find(v => v.id === id);
        if (!variable) return;

        const oldKey = variable.key;
        variable.key = newKey;
        variable.value = newValue;

        if (oldKey !== newKey) {
            // Refactor node references
            this.nodes.forEach(node => {
                if (node.data) {
                    if (node.data.variable === oldKey) {
                        node.data.variable = newKey;
                    }
                    // Also refactor condition gates
                    if (node.data.gates && Array.isArray(node.data.gates)) {
                        node.data.gates.forEach(gate => {
                            if (gate.variable === oldKey) {
                                gate.variable = newKey;
                            }
                        });
                    }
                }
            });
            this.emit('nodes_changed');
        }
        this.emit('config_refresh');
    }

    addCharacter() {
        this.pushSnapshot();
        const id = "NEW_CHAR_" + Object.keys(this.config.characters).length;
        this.config.characters[id] = {
            name: "New Character",
            sprites: { neutral: "" },
            position: "center",
            sfx: "",
            description: ""
        };
        this.emit('config_refresh');
    }

    updateCharacter(id, field, value) {
        if (!this.historyTimer) {
            this.pushSnapshot();
        }
        clearTimeout(this.historyTimer);
        this.historyTimer = setTimeout(() => {
            this.historyTimer = null;
        }, 1000);
        if (field === 'id') {
            const char = this.config.characters[id];
            delete this.config.characters[id];
            this.config.characters[value] = char;

            // Refactor existing node references to this character
            this.nodes.forEach(node => {
                if (node.data && node.data.character === id) {
                    node.data.character = value;
                }
            });
            this.emit('nodes_changed');
        } else {
            this.config.characters[id][field] = value;
        }
        this.emit('config_refresh');
    }

    deleteCharacter(id) {
        this.pushSnapshot();
        delete this.config.characters[id];
        this.emit('config_refresh');
    }

    // --- Group Operations ---
    addGroup(x, y) {
        this.pushSnapshot();
        const id = 'group_' + Date.now();
        const group = {
            id,
            title: 'New Group',
            x: (x - offset.x) / zoom,
            y: (y - offset.y) / zoom,
            width: 400,
            height: 300,
            color: 'rgba(0, 255, 204, 0.05)'
        };
        this.groups.push(group);
        this.emit('groups_changed');
        return group;
    }

    updateGroup(id, field, value) {
        const group = this.groups.find(g => g.id === id);
        if (group) {
            if (field !== 'x' && field !== 'y' && !this.historyTimer) {
                this.pushSnapshot();
            }
            group[field] = value;
            this.emit('groups_changed');
        }
    }

    deleteGroup(id) {
        this.pushSnapshot();
        this.groups = this.groups.filter(g => g.id !== id);
        this.emit('groups_changed');
    }

    moveGroupNodes(groupId, dx, dy) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        // Find nodes whose center is inside the group
        const containedNodes = this.getNodesInGroup(groupId);

        containedNodes.forEach(node => {
            node.x += dx;
            node.y += dy;
        });

        if (containedNodes.length > 0) {
            this.emit('nodes_changed');
        }
    }

    getNodesInGroup(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return [];
        return this.nodes.filter(node => {
            const nodeWidth = 280; // Standard node width from CSS
            const nx = node.x + nodeWidth / 2;
            const ny = node.y + 50; // Use top area for inclusion check
            return nx >= group.x && nx <= group.x + group.width &&
                ny >= group.y && ny <= group.y + group.height;
        });
    }

    fitGroupToNodes(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        const containedNodes = this.getNodesInGroup(groupId);
        if (containedNodes.length === 0) {
            showToast("No nodes found in group", "warn");
            return;
        }

        this.pushSnapshot();

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        containedNodes.forEach(node => {
            minX = Math.min(minX, node.x);
            minY = Math.min(minY, node.y);
            maxX = Math.max(maxX, node.x + 280);
            maxY = Math.max(maxY, node.y + 350); // Estimated height
        });

        const padding = 40;
        group.x = minX - padding;
        group.y = minY - (padding + 40); // Leave room for header
        group.width = (maxX - minX) + padding * 2;
        group.height = (maxY - minY) + padding * 2 + 40;

        this.emit('groups_changed');
        showToast("Group auto-fitted");
    }

    deleteGroupAndNodes(groupId) {
        const group = this.groups.find(g => g.id === groupId);
        if (!group) return;

        if (!confirm("Are you sure? This will delete the group and ALL nodes inside it.")) return;

        this.pushSnapshot();
        const nodesToDelete = this.getNodesInGroup(groupId);
        nodesToDelete.forEach(node => {
            // Re-use existing delete logic for clean cleanup
            const idx = this.nodes.findIndex(n => n.id === node.id);
            if (idx !== -1) {
                if (window._nexusRichEditors && window._nexusRichEditors[node.id]) {
                    window._nexusRichEditors[node.id].destroy();
                    delete window._nexusRichEditors[node.id];
                }
                this.nodes.splice(idx, 1);
            }
            this.links = this.links.filter(l => l.fromNode !== node.id && l.toNode !== node.id);
        });

        this.groups = this.groups.filter(g => g.id !== groupId);

        this.emit('nodes_changed');
        this.emit('groups_changed');
        showToast(`Deleted group and ${nodesToDelete.length} nodes`);
    }

    alignGroupNodes(groupId, type) {
        const group = this.groups.find(g => g.id === groupId);
        const nodes = this.getNodesInGroup(groupId);
        if (nodes.length < 2) return;

        this.pushSnapshot();

        if (type === 'left') {
            const minX = Math.min(...nodes.map(n => n.x));
            nodes.forEach(n => n.x = minX);
        } else if (type === 'center') {
            const avgX = nodes.reduce((a, b) => a + b.x, 0) / nodes.length;
            nodes.forEach(n => n.x = avgX);
        } else if (type === 'distribute-v') {
            nodes.sort((a, b) => a.y - b.y);
            const minY = nodes[0].y;
            const maxY = nodes[nodes.length - 1].y;
            const step = (maxY - minY) / (nodes.length - 1);
            nodes.forEach((n, i) => n.y = minY + (i * step));
        }

        this.emit('nodes_changed');
        showToast(`Aligned ${nodes.length} nodes`);
    }

    autoNameGroup(groupId) {
        const nodes = this.getNodesInGroup(groupId);
        if (nodes.length === 0) return;

        // Count character mentions
        const charCounts = {};
        nodes.forEach(node => {
            if (node.data && node.data.character) {
                charCounts[node.data.character] = (charCounts[node.data.character] || 0) + 1;
            }
        });

        const characters = Object.entries(charCounts).sort((a, b) => b[1] - a[1]);
        let newName = "New Scene";
        if (characters.length > 0) {
            const mainChar = characters[0][0];
            newName = `${mainChar.toUpperCase()} SCENE`;
        } else if (nodes.some(n => n.type === 'choice')) {
            newName = "CHOICE BRANCH";
        }

        this.updateGroup(groupId, 'title', newName);
        this.emit('groups_changed');
        showToast(`Renamed to: ${newName}`);
    }
}

const store = new NexusDataStore();
window.store = store;

let offset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let zoom = 1;
let lastMiddleClick = 0;
let isDragging = false;
let lastMousePos = { x: 0, y: 0 };
let activeLink = null;
let selectedNode = null;
let selectedNodes = [];
let selectionStart = null;
let marqueeEl = null;

let needsRender = true;
let mouseEvent = null;
let snapTarget = null;

// --- NODE DEFINITIONS ---
const NODE_TYPES = {
    dialogue: {
        title: "DIALOGUE",
        fields: [
            { name: 'character', label: 'Character', type: 'select', options: 'chars' },
            { name: 'spriteState', label: 'Sprite State', type: 'select', options: 'spriteStates' },
            { name: 'text', label: 'Dialogue Text', type: 'textarea' },
            { name: 'chapter', label: 'Chapter', type: 'number' },
            { name: 'scene', label: 'Scene', type: 'number' },
            { name: 'effect', label: 'Screen Effect', type: 'select', options: ['None', 'shake', 'glitch', 'flash', 'blink', 'electricuted', 'shadows', 'earthquake', 'heartbeat', 'vhs', 'drain', 'nuke', 'bloodsplatter', 'shockwave', 'hologram', 'rage'] },
            { name: 'overlay', label: 'Screen Overlay', type: 'select', options: ['None', 'GLITCH', 'ELECTROCUTED', 'NUKE', 'SHOCKWAVE', 'PORTAL'] },
            { name: 'intensity', label: 'Effect Intensity (1-3)', type: 'number' },
            { name: 'persistentEffect', label: 'Persistent GIF/Effect (URL)', type: 'text' },
            { name: 'SpriteEffects', label: 'Sprite Post-Effect', type: 'select', options: ['None', 'Scanlines', 'Holo', 'Ghost', 'Glitch', 'Faded'] }
        ],
        ports: { in: true, out: true }
    },
    choice: {
        title: "CHOICE BRANCH",
        fields: [
            { name: 'text', label: 'Prompt', type: 'text' }
        ],
        ports: { in: true, choices: true }
    },
    condition: {
        title: "LOGIC GATE",
        fields: [
            { name: 'logic', label: 'Match Logic', type: 'select', options: ['ALL (AND)', 'ANY (OR)'] }
        ],
        ports: { in: true, branches: ['True', 'False'] }
    }
};

// --- CORE ENGINE ---

function init() {
    updateWorkspace();

    editorContainer.addEventListener('mousedown', startPan);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    editorContainer.addEventListener('wheel', handleWheel);

    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            store.undo();
        }
        if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
            e.preventDefault();
            store.redo();
        }
        // Delete selected node with Delete or Backspace
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
            const active = document.activeElement;
            const isEditing = active && (active.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName));
            if (!isEditing) {
                e.preventDefault();
                const idToDelete = selectedNode;
                selectedNode = null;
                store.deleteNode(idToDelete);
            }
        }
    });

    window.onclick = () => {
        document.querySelectorAll('.nexus-dropdown').forEach(d => d.classList.remove('active'));
    };

    // Subscribe UI to Data Changes
    store.subscribe((event, data) => {
        if (event === 'nodes_changed') {
            renderAllNodes();
        } else if (event === 'groups_changed') {
            renderAllGroups();
            renderSidebar();
        } else if (event === 'node_refresh') {
            refreshNode(data);
        } else if (event === 'config_refresh' || event === 'config_updated') {
            renderConfig();
            refreshAllNodes(); // Character selects etc
        } else if (event === 'links_changed') {
            needsRender = true;
        }
        needsRender = true;
        updateNodeCountBadge();
    });

    // Try load autosave or use template
    const isFactoryReset = localStorage.getItem('nexus_factory_reset') === 'true';
    if (isFactoryReset) {
        localStorage.removeItem('nexus_factory_reset');
        store.config = {
            storyTitle: "NEW PROJECT",
            storySubtitle: "UNNAMED CHAPTER",
            theme: "nasapunk.css",
            characters: {},
            backgrounds: {},
            chapterNames: { "1": "Chapter 1" },
            chapterBackgrounds: { "1": "" },
            chapterMusic: { "1": "" },
            initialState: []
        };
        store.nodes = [];
    } else if (!store.load()) {
        if (DEFAULT_STORY_DATA.storyDialogue) {
            DEFAULT_STORY_DATA.storyDialogue.forEach(d => {
                store.nodes.push({ ...d });
            });
        }
    }

    // Push initial state to history stack
    store.pushSnapshot();

    renderAllNodes();
    renderAllGroups();
    renderConfig();
    requestAnimationFrame(tick);

    showToast("Hint: Alt + Click a link to delete it", "info");

    // AAA Responsive Auto-Hide
    if (window.innerWidth < 1200) {
        toggleConfigPanel();
    }
}

function renderAllNodes() {
    // Only clear nodes, don't clear the whole workspace if we want to keep groups
    document.querySelectorAll('.node').forEach(n => n.remove());
    store.nodes.forEach(n => renderNode(n));
}

function renderAllGroups() {
    document.querySelectorAll('.node-group').forEach(g => g.remove());
    store.groups.forEach(g => renderGroup(g));
}

function renderGroup(group) {
    const div = document.createElement('div');
    div.className = 'node-group';
    div.id = group.id;
    div.style.left = group.x + 'px';
    div.style.top = group.y + 'px';
    div.style.width = group.width + 'px';
    div.style.height = group.height + 'px';
    div.style.backgroundColor = group.color;
    div.style.boxShadow = `0 10px 40px rgba(0,0,0,0.4), 0 0 20px ${group.color}22`;
    div.style.borderColor = `${group.color}44`;

    div.innerHTML = `
        <div class="node-group-header" style="border-bottom-color: ${group.color}33">
            <div class="d-flex align-items-center gap-2" style="flex:1">
                <button class="node-group-btn" onclick="store.autoNameGroup('${group.id}')" title="Auto-Name Group">
                    <i class="bi bi-magic"></i>
                </button>
                <input type="text" value="${group.title}" oninput="store.updateGroup('${group.id}', 'title', this.value)" class="node-group-title">
            </div>
            <div class="node-group-actions">
                <div class="group-alignment-tools d-flex gap-1 me-2">
                    <button class="node-group-btn sm" onclick="store.alignGroupNodes('${group.id}', 'left')" title="Align Left"><i class="bi bi-text-left"></i></button>
                    <button class="node-group-btn sm" onclick="store.alignGroupNodes('${group.id}', 'center')" title="Align Center"><i class="bi bi-text-center"></i></button>
                    <button class="node-group-btn sm" onclick="store.alignGroupNodes('${group.id}', 'distribute-v')" title="Distribute Vertically"><i class="bi bi-distribute-vertical"></i></button>
                </div>
                <button class="node-group-btn" onclick="store.fitGroupToNodes('${group.id}')" title="Fit to Nodes">
                    <i class="bi bi-aspect-ratio"></i>
                </button>
                <button class="node-group-btn" onclick="selectAllInGroup('${group.id}')" title="Select All Nodes">
                    <i class="bi bi-cursor-fill"></i>
                </button>
                <input type="color" value="${group.color}" oninput="store.updateGroup('${group.id}', 'color', this.value)" class="node-group-color-picker">
                <button class="node-group-btn btn-danger-hover" onclick="store.deleteGroupAndNodes('${group.id}')" title="Delete Group & Nodes">
                    <i class="bi bi-trash3-fill"></i>
                </button>
            </div>
        </div>
        <div class="node-group-resizer"></div>
    `;

    // Group Dragging Logic
    const header = div.querySelector('.node-group-header');
    header.onmousedown = (e) => {
        if (e.target.tagName === 'INPUT') return;
        e.stopPropagation();
        let startX = e.clientX;
        let startY = e.clientY;

        const onMouseMove = (me) => {
            const dx = (me.clientX - startX) / zoom;
            const dy = (me.clientY - startY) / zoom;

            group.x += dx;
            group.y += dy;
            div.style.left = group.x + 'px';
            div.style.top = group.y + 'px';

            // Move nodes inside
            store.moveGroupNodes(group.id, dx, dy);

            startX = me.clientX;
            startY = me.clientY;
            needsRender = true;
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            store.emit('groups_changed');
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    // Group Resizing Logic
    const resizer = div.querySelector('.node-group-resizer');
    resizer.onmousedown = (e) => {
        e.stopPropagation();
        let startX = e.clientX;
        let startY = e.clientY;

        const onMouseMove = (me) => {
            const dx = (me.clientX - startX) / zoom;
            const dy = (me.clientY - startY) / zoom;

            group.width += dx;
            group.height += dy;
            div.style.width = group.width + 'px';
            div.style.height = group.height + 'px';

            startX = me.clientX;
            startY = me.clientY;
            needsRender = true;
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            store.emit('groups_changed');
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    workspace.prepend(div); // Render behind nodes
}

function selectAllInGroup(groupId) {
    const nodes = store.getNodesInGroup(groupId);
    if (nodes.length === 0) return;

    // Clear current selection visual but nodes don't have a multi-select state yet
    // So we'll just pulse them all to show they are identified
    nodes.forEach(n => {
        const el = document.getElementById(n.id);
        if (el) {
            el.style.transform = 'scale(1.05)';
            el.style.borderColor = 'var(--accent)';
            setTimeout(() => {
                el.style.transform = '';
                el.style.borderColor = '';
            }, 1000);
        }
    });
    showToast(`Identified ${nodes.length} nodes`);
}

function toggleConfigPanel() {
    const panel = document.getElementById('config-panel');
    const toggle = document.getElementById('panel-toggle');
    if (!panel || !toggle) return;

    panel.classList.toggle('collapsed');
    toggle.classList.toggle('active');
    toggle.innerHTML = panel.classList.contains('collapsed') ? '☰' : '✕';
}

function tick() {
    if (needsRender) {
        const rx = Math.round(offset.x);
        const ry = Math.round(offset.y);

        workspace.style.transform = `translate3d(${rx}px, ${ry}px, 0) scale(${zoom})`;

        // Sync background grid to avoid "pixely" or disconnected feel
        const gridSize = 40 * zoom;
        editorContainer.style.backgroundSize = `${gridSize}px ${gridSize}px`;
        editorContainer.style.backgroundPosition = `${rx}px ${ry}px`;

        renderLinks(mouseEvent);
        needsRender = false;
    }
    requestAnimationFrame(tick);
}

function updateWorkspace() {
    needsRender = true;
}

function startPan(e) {
    if (e.button === 1) { // Middle click
        const now = Date.now();
        if (now - lastMiddleClick < 300) {
            zoomToExtents();
        }
        lastMiddleClick = now;
    }

    if (e.target === editorContainer || e.target === svg) {
        if (e.shiftKey) {
            selectionStart = { x: e.clientX, y: e.clientY };
            marqueeEl = document.createElement('div');
            marqueeEl.className = 'selection-marquee';
            document.body.appendChild(marqueeEl);
        } else {
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
            // Clear selection if clicking background without shift
            document.querySelectorAll('.node-selected').forEach(n => n.classList.remove('node-selected'));
            selectedNodes = [];
            selectedNode = null;
            renderConfig();
        }
    }
}

function handleMouseMove(e) {
    mouseEvent = e;
    if (selectionStart) {
        const left = Math.min(selectionStart.x, e.clientX);
        const top = Math.min(selectionStart.y, e.clientY);
        const width = Math.abs(selectionStart.x - e.clientX);
        const height = Math.abs(selectionStart.y - e.clientY);

        marqueeEl.style.left = left + 'px';
        marqueeEl.style.top = top + 'px';
        marqueeEl.style.width = width + 'px';
        marqueeEl.style.height = height + 'px';
        return;
    }

    if (isDragging) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        offset.x += dx;
        offset.y += dy;
        lastMousePos = { x: e.clientX, y: e.clientY };
        needsRender = true;
    }
    if (activeLink) {
        // Magnetic Snapping
        const ports = Array.from(document.querySelectorAll('.port-in'));
        let closest = null;
        let minDist = 60; // Snapping radius

        ports.forEach(p => {
            p.classList.remove('port-snapping');
            const rect = p.getBoundingClientRect();
            const px = rect.left + rect.width / 2;
            const py = rect.top + rect.height / 2;
            const d = Math.sqrt((e.clientX - px) ** 2 + (e.clientY - py) ** 2);
            if (d < minDist) {
                minDist = d;
                closest = p;
            }
        });

        if (closest) {
            snapTarget = closest;
            closest.classList.add('port-snapping');
        } else {
            snapTarget = null;
        }

        needsRender = true;
    }
}

function handleMouseUp(e) {
    if (selectionStart) {
        const marqueeRect = marqueeEl.getBoundingClientRect();
        selectedNodes = [];
        store.nodes.forEach(node => {
            const el = document.getElementById(node.id);
            if (el) {
                const rect = el.getBoundingClientRect();
                // Check if node is fully inside marquee
                if (rect.left >= marqueeRect.left && rect.right <= marqueeRect.right &&
                    rect.top >= marqueeRect.top && rect.bottom <= marqueeRect.bottom) {
                    selectedNodes.push(node.id);
                    el.classList.add('node-selected');
                }
            }
        });
        selectedNode = selectedNodes[0] || null;
        renderConfig();
        marqueeEl.remove();
        marqueeEl = null;
        selectionStart = null;
        return;
    }

    isDragging = false;
    if (activeLink) {
        let port = snapTarget;
        if (!port) {
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            port = elements.find(el => el.classList.contains('port-in'));
        }

        if (port) {
            const targetNodeId = port.closest('.node').dataset.id;
            createLink(activeLink.fromNode, activeLink.fromPort, targetNodeId, 'in');
            port.classList.remove('port-snapping');
        }
        activeLink = null;
        snapTarget = null;
        needsRender = true;
    }
}

function handleWheel(e) {
    e.preventDefault();

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const oldZoom = zoom;
    const newZoom = Math.min(Math.max(0.1, zoom * delta), 4);

    if (oldZoom === newZoom) return;

    // Zoom relative to mouse position
    const rect = editorContainer.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Calculate workspace coordinates of the mouse
    const wx = (mx - offset.x) / oldZoom;
    const wy = (my - offset.y) / oldZoom;

    // Update zoom
    zoom = newZoom;

    // Adjust offset to keep wx, wy at mx, my
    offset.x = mx - wx * zoom;
    offset.y = my - wy * zoom;

    needsRender = true;
}

function zoomToExtents() {
    if (store.nodes.length === 0) {
        zoom = 1;
        offset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        needsRender = true;
        return;
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    store.nodes.forEach(n => {
        minX = Math.min(minX, n.x);
        minY = Math.min(minY, n.y);
        maxX = Math.max(maxX, n.x + 300); // Node width + some margin
        maxY = Math.max(maxY, n.y + 400); // Rough estimated height
    });

    const padding = 100;
    const contentWidth = maxX - minX + padding * 2;
    const contentHeight = maxY - minY + padding * 2;

    const containerRect = editorContainer.getBoundingClientRect();
    const targetZoom = Math.min(
        containerRect.width / contentWidth,
        containerRect.height / contentHeight,
        1.2 // Don't zoom in too much
    );

    zoom = Math.max(0.2, targetZoom);

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    offset.x = containerRect.width / 2 - centerX * zoom;
    offset.y = containerRect.height / 2 - centerY * zoom;

    needsRender = true;
    showToast('Zoom to Extents');
}

// --- NODE LOGIC ---

function addNode(type) {
    // Place new nodes at the current viewport center so they're always visible
    const containerRect = editorContainer.getBoundingClientRect();
    const cx = containerRect.left + containerRect.width / 2;
    const cy = containerRect.top + containerRect.height / 2;
    store.addNode(type, cx, cy);
}

function renderNode(node) {
    const typeDef = NODE_TYPES[node.type];
    const div = document.createElement('div');
    div.className = `node node-${node.type} node-appearing`;
    div.id = node.id;
    div.dataset.id = node.id;
    div.style.left = node.x + 'px';
    div.style.top = node.y + 'px';

    let fieldsHtml = '';

    // AAA Expression Preview: Show character sprite thumbnail in dialogue nodes
    if (node.type === 'dialogue') {
        const charId = node.data.character;
        const character = charId && store.config.characters[charId];
        const state = node.data.spriteState || 'neutral';
        let spriteUrl = '';
        if (character && character.sprites) {
            spriteUrl = character.sprites[state] || character.sprites['neutral'] || Object.values(character.sprites)[0];
        }

        if (spriteUrl) {
            fieldsHtml += `<div class="node-sprite-preview" style="background-image: url('${spriteUrl}')"></div>`;
        }
    }
    // Track which fields need post-mount setup
    const richFields = [];

    typeDef.fields.forEach(f => {
        fieldsHtml += `<label>${f.label}</label>`;
        if (f.type === 'textarea') {
            if (f.name === 'text') {
                // Rich editor mounted after innerHTML is set
                fieldsHtml += `<div class="nexus-re-mount" data-field="${f.name}" data-node="${node.id}"></div>`;
                richFields.push(f.name);
            } else {
                fieldsHtml += `<textarea oninput="store.updateNodeData('${node.id}', '${f.name}', this.value)">${node.data[f.name] || ''}</textarea>`;
            }
        } else if (f.type === 'select') {
            let handlers = '';
            if (f.name === 'character') {
                handlers = `onmouseenter="showSpritePreview('${node.id}', this.getAttribute('data-value'))" onmouseleave="hideSpritePreview()"`;
            } else if (f.name === 'spriteState') {
                handlers = `onmouseenter="showSpritePreview('${node.id}')" onmouseleave="hideSpritePreview()"`;
            }

            let options = f.options;
            if (f.options === 'chars') options = Object.keys(store.config.characters);
            if (f.options === 'state') options = Object.keys(store.config.initialState);
            if (f.options === 'spriteStates') {
                const charId = node.data.character;
                const char = charId && store.config.characters[charId];
                options = char && char.sprites ? Object.keys(char.sprites) : ['neutral'];
            }

            fieldsHtml += getDropdownHtml(node.id, f.name, options, node.data[f.name], handlers);
        } else {
            fieldsHtml += `<input type="${f.type}" value="${node.data[f.name] || ''}" oninput="store.updateNodeData('${node.id}', '${f.name}', this.value)">`;
        }
    });

    if (node.type === 'choice') {
        fieldsHtml += `<div class="section-title">CHOICES</div>`;
        node.choices.forEach((c, idx) => {
            fieldsHtml += `
                <div class="choice-row">
                    <input type="text" value="${c.text}" oninput="store.updateChoice('${node.id}', ${idx}, this.value)" style="flex:1">
                    <div class="port port-choice port-choice-out port-${node.type}" data-idx="${idx}" onmousedown="startLink(event, '${node.id}', 'choice_${idx}')"></div>
                </div>
            `;
        });
        fieldsHtml += `<button class="btn btn-outline" style="width:100%; margin-top:5px; font-size:10px;" onclick="store.addChoice('${node.id}')">＋ ADD CHOICE</button>`;
    }

    if (node.type === 'condition') {
        fieldsHtml += `<div class="section-title">CONDITIONS</div>`;
        if (!node.data.gates || node.data.gates.length === 0) {
            // Legacy migration: if old fields exist, migrate them to gates
            if (node.data.variable) {
                node.data.gates = [{ variable: node.data.variable, operator: node.data.operator || '==', value: node.data.value || 0 }];
                delete node.data.variable; delete node.data.operator; delete node.data.value;
            } else {
                node.data.gates = [{ variable: Object.keys(store.config.initialState)[0] || 'var', operator: '==', value: 0 }];
            }
        }

        node.data.gates.forEach((gate, idx) => {
            const dropdownId = `gate_${node.id}_${idx}`;
            fieldsHtml += `
                <div class="gate-row" style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.05)">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:5px">
                        <label style="margin:0">#${idx + 1}</label>
                        <span style="cursor:pointer; color:var(--text-dim); font-size:10px" onclick="store.deleteGate('${node.id}', ${idx})">✕ REMOVE</span>
                    </div>
                    <label>Variable</label>
                    ${getDropdownHtml(dropdownId, 'variable', store.config.initialState.map(v => v.key), gate.variable)}
                    
                    <div style="display:flex; gap:8px; margin-top:5px">
                        <div style="flex:1">
                            <label>Operator</label>
                            ${getDropdownHtml(dropdownId, 'operator', ['>', '<', '==', '>=', '<=', '!='], gate.operator)}
                        </div>
                        <div style="flex:1">
                            <label>Value</label>
                            <input type="number" value="${gate.value}" oninput="store.updateGate('${node.id}', ${idx}, 'value', this.value)">
                        </div>
                    </div>
                </div>
            `;
        });
        fieldsHtml += `<button class="btn btn-outline" style="width:100%; margin-top:5px; font-size:10px;" onclick="store.addGate('${node.id}')">＋ ADD CONDITION</button>`;
    }

    div.innerHTML = `
        <div class="node-header">
            <span class="node-header-title">${typeDef.title}</span>
            <div class="node-header-actions">
                <button class="node-action-btn" onclick="duplicateNode('${node.id}')" title="Duplicate Node">⧉</button>
                <button class="node-action-btn" onclick="toggleCollapse('${node.id}')" title="${node.collapsed ? 'Expand' : 'Collapse'}">${node.collapsed ? '⊞' : '⊟'}</button>
                <button class="node-action-btn node-delete-btn" onclick="deleteNode('${node.id}')" title="Delete">✕</button>
            </div>
        </div>
        <div class="node-content"${node.collapsed ? ' style="display:none"' : ''}>${fieldsHtml}</div>
        ${typeDef.ports.in ? `<div class="port port-in port-${node.type}"></div>` : ''}
        ${typeDef.ports.out ? `<div class="port port-out port-${node.type}" onmousedown="startLink(event, '${node.id}', 'out')"></div>` : ''}
        ${typeDef.ports.branches ? typeDef.ports.branches.map((b, i) => `
            <div class="branch-row"${node.collapsed ? ' style="display:none"' : ''}>
                <span class="branch-label">${b}</span>
                <div class="port port-out branch-port port-${node.type}" onmousedown="startLink(event, '${node.id}', 'branch_${b}')"></div>
            </div>
        `).join('') : ''}
    `;

    // Dragging logic
    const header = div.querySelector('.node-header');
    header.onmousedown = (e) => {
        e.stopPropagation();
        selectNode(node.id, e.shiftKey);
        let startX = e.clientX;
        let startY = e.clientY;

        const onMouseMove = (me) => {
            const dx = (me.clientX - startX) / zoom;
            const dy = (me.clientY - startY) / zoom;

            // Move all selected nodes
            selectedNodes.forEach(sid => {
                const snode = store.nodes.find(n => n.id === sid);
                const sel = document.getElementById(sid);
                if (snode && sel) {
                    snode.x += dx;
                    snode.y += dy;
                    sel.style.left = snode.x + 'px';
                    sel.style.top = snode.y + 'px';
                }
            });

            startX = me.clientX;
            startY = me.clientY;
            needsRender = true;
        };

        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            store.save(); // Save after drag
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    div.onclick = (e) => {
        e.stopPropagation();
        selectNode(node.id, e.shiftKey);
    };

    workspace.appendChild(div);

    // Trigger appearing animation
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            div.classList.remove('node-appearing');
        });
    });

    // Mount rich editors after the node is in the DOM
    richFields.forEach(fieldName => {
        const mount = div.querySelector(`.nexus-re-mount[data-field="${fieldName}"]`);
        if (!mount || !window.NexusRichEditor) return;

        // AAA Cleanup: Destroy existing instance for this node if it exists
        if (window._nexusRichEditors && window._nexusRichEditors[node.id]) {
            window._nexusRichEditors[node.id].destroy();
        }

        const initialHtml = node.data[fieldName] || '';
        const re = new NexusRichEditor(node.id, initialHtml, ({ html }) => {
            store.updateNodeData(node.id, fieldName, html);
        });
        re.getElement().querySelector('.nexus-re-editor').setAttribute('placeholder', 'Type dialogue here...');
        mount.replaceWith(re.getElement());

        if (!window._nexusRichEditors) window._nexusRichEditors = {};
        window._nexusRichEditors[node.id] = re;
    });
}

function updateNodeData(nodeId, field, value) {
    store.updateNodeData(nodeId, field, value);
}

function deleteNode(id) {
    const el = document.getElementById(id);
    if (el) {
        el.classList.add('node-deleting');
        setTimeout(() => {
            store.deleteNode(id);
        }, 200);
    } else {
        store.deleteNode(id);
    }
}

function duplicateNode(id) {
    const original = store.nodes.find(n => n.id === id);
    if (!original) return;
    store.pushSnapshot();
    const newId = 'node_' + Date.now();
    const clone = JSON.parse(JSON.stringify(original));
    clone.id = newId;
    clone.x = original.x + 30;
    clone.y = original.y + 30;
    clone.collapsed = false;
    store.nodes.push(clone);
    store.emit('nodes_changed');
    showToast('Node duplicated');
}

function toggleCollapse(id) {
    const node = store.nodes.find(n => n.id === id);
    if (!node) return;
    node.collapsed = !node.collapsed;
    refreshNode(id);
    store.save();
    needsRender = true;
}

function clearWorkspace() {
    confirmAction('Are you sure you want to clear the screen? This will remove all nodes and links, and reset the view. Configuration (characters/etc) will remain.', () => {
        store.nodes = [];
        store.links = [];
        // Reset history so undo can't bring back cleared nodes
        store.undoStack = [];
        store.redoStack = [];

        // Reset view for a truly "blank space"
        offset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        zoom = 1;
        needsRender = true;

        store.emit('nodes_changed');
        store.emit('links_changed');
        // Push a clean snapshot as the new base state
        store.pushSnapshot();
        showToast('Workspace cleared');
    });
}

function clearCache() {
    const content = `
        <div style="text-align:center; padding: 10px;">
            <h3 style="color:var(--accent); margin-bottom:15px; letter-spacing: 2px;">🛰️ RESET WORKSPACE</h3>
            <p style="color:white; margin-bottom:25px; font-size: 14px; line-height: 1.5;">Choose your reset level. This action cannot be undone.</p>
            <div style="display:flex; flex-direction:column; gap:12px;">
                <button class="btn btn-outline" style="width:100%; border-color:#ff9d00; color:#ff9d00;" onclick="store.clearAutosave(false)">
                    <i class="bi bi-arrow-counterclockwise"></i> RESET TO TEMPLATE
                </button>
                <button class="btn btn-outline" style="width:100%; border-color:#ff4a4a; color:#ff4a4a;" onclick="store.clearAutosave(true)">
                    <i class="bi bi-trash3-fill"></i> FACTORY RESET (BLANK)
                </button>
                <button class="btn" style="width:100%; margin-top:10px; background:rgba(255,255,255,0.1); color:white;" onclick="hideOverlay()">CANCEL</button>
            </div>
        </div>
    `;
    showModal(content);
}

function selectNode(id, isShift = false) {
    const nodeEl = document.getElementById(id);
    if (!nodeEl) return;

    if (isShift) {
        if (selectedNodes.includes(id)) {
            selectedNodes = selectedNodes.filter(n => n !== id);
            nodeEl.classList.remove('node-selected');
        } else {
            selectedNodes.push(id);
            nodeEl.classList.add('node-selected');
        }
    } else {
        if (!selectedNodes.includes(id)) {
            document.querySelectorAll('.node-selected').forEach(n => n.classList.remove('node-selected'));
            selectedNodes = [id];
            nodeEl.classList.add('node-selected');
        }
    }

    selectedNode = selectedNodes[selectedNodes.length - 1] || null;
    renderConfig();
}

// --- LINK LOGIC ---

function startLink(e, nodeId, portType) {
    e.stopPropagation();
    activeLink = { fromNode: nodeId, fromPort: portType };
}

function createLink(fromNode, fromPort, toNode, toPort) {
    store.createLink(fromNode, fromPort, toNode, toPort);
}

function renderLinks(mouseEvent = null) {
    // Surgical clear: remove only groups and paths, keep defs
    const children = Array.from(svg.childNodes);
    children.forEach(child => {
        if (child.tagName !== 'defs') child.remove();
    });

    store.links.forEach(link => {
        const fromPos = getPortPos(link.fromNode, link.fromPort);
        const toPos = getPortPos(link.toNode, link.toPort);
        if (fromPos && toPos) drawLink(fromPos, toPos, link);
    });

    if (activeLink && mouseEvent) {
        const fromPos = getPortPos(activeLink.fromNode, activeLink.fromPort);
        const containerRect = editorContainer.getBoundingClientRect();
        let toPos;

        if (snapTarget) {
            const rect = snapTarget.getBoundingClientRect();
            toPos = {
                x: (rect.left + rect.width / 2) - containerRect.left,
                y: (rect.top + rect.height / 2) - containerRect.top
            };
        } else {
            toPos = {
                x: mouseEvent.clientX - containerRect.left,
                y: mouseEvent.clientY - containerRect.top
            };
        }
        drawLink(fromPos, toPos);
    }

    updateConnectedPorts();
}

function updateConnectedPorts() {
    document.querySelectorAll('.port').forEach(p => p.classList.remove('port-connected'));
    store.links.forEach(l => {
        const fromNodeEl = document.getElementById(l.fromNode);
        if (fromNodeEl) {
            let pEl;
            if (l.fromPort === 'out') pEl = fromNodeEl.querySelector('.port-out');
            else if (l.fromPort.startsWith('choice_')) {
                const idx = l.fromPort.split('_')[1];
                pEl = fromNodeEl.querySelectorAll('.port-choice')[idx];
            } else if (l.fromPort.startsWith('branch_')) {
                const bName = l.fromPort.split('_')[1];
                const branches = Array.from(fromNodeEl.querySelectorAll('.branch-port'));
                pEl = branches.find(p => p.getAttribute('onmousedown').includes(`'branch_${bName}'`));
            }
            if (pEl) pEl.classList.add('port-connected');
        }

        const toNodeEl = document.getElementById(l.toNode);
        if (toNodeEl) {
            const pEl = toNodeEl.querySelector('.port-in');
            if (pEl) pEl.classList.add('port-connected');
        }
    });
}

function getPortPos(nodeId, portId) {
    const nodeEl = document.getElementById(nodeId);
    if (!nodeEl) return null;

    let portEl;
    if (portId === 'in') portEl = nodeEl.querySelector('.port-in');
    else if (portId === 'out') portEl = nodeEl.querySelector('.port-out');
    else if (portId.startsWith('choice_')) {
        const idx = portId.split('_')[1];
        portEl = nodeEl.querySelectorAll('.port-choice')[idx];
    } else if (portId.startsWith('branch_')) {
        const branchName = portId.split('_')[1];
        const branches = Array.from(nodeEl.querySelectorAll('.branch-port'));
        portEl = branches.find(p => p.getAttribute('onmousedown').includes(`'branch_${branchName}'`));
    }

    if (!portEl) return null;
    const rect = portEl.getBoundingClientRect();
    const containerRect = editorContainer.getBoundingClientRect();

    return {
        x: (rect.left + rect.width / 2) - containerRect.left,
        y: (rect.top + rect.height / 2) - containerRect.top
    };
}

function drawLink(start, end, linkData = null) {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    // Spline Calculation
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    let cp1x, cp1y, cp2x, cp2y;

    if (dx >= 0) {
        // Forward connection
        const intensity = Math.min(Math.max(50, absDx * 0.5), 150);
        cp1x = start.x + intensity;
        cp1y = start.y;
        cp2x = end.x - intensity;
        cp2y = end.y;
    } else {
        // Backward connection - loopier
        const intensityX = Math.max(100, absDx * 0.5);
        const intensityY = Math.max(50, absDy * 0.2);
        cp1x = start.x + intensityX;
        cp1y = start.y + (dy > 0 ? -intensityY : intensityY);
        cp2x = end.x - intensityX;
        cp2y = end.y + (dy > 0 ? intensityY : -intensityY);
    }

    const d = `M ${start.x} ${start.y} C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${end.x} ${end.y}`;

    // Color Logic
    let color = '#00ffcc';
    if (linkData) {
        const sourceNode = store.nodes.find(n => n.id === linkData.fromNode);
        if (sourceNode) {
            if (sourceNode.type === 'dialogue') color = '#00ffcc';
            else if (sourceNode.type === 'choice') color = '#ff9d00';
            else if (sourceNode.type === 'condition') color = '#0084ff';
            else if (sourceNode.type === 'effect') color = '#c03cfc';
        }
        group.setAttribute("class", "connection connection-active");
    } else {
        group.setAttribute("class", "connection connection-drag");
    }

    // Glow Path
    const glowPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    glowPath.setAttribute("d", d);
    glowPath.setAttribute("class", "connection-glow");
    glowPath.style.stroke = color;
    glowPath.style.strokeWidth = "8px";
    glowPath.style.opacity = "0.3";

    // Core Path
    const corePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    corePath.setAttribute("d", d);
    corePath.setAttribute("class", "connection-core");
    corePath.style.stroke = color;
    corePath.style.strokeWidth = "3px";
    corePath.style.opacity = "0.8";

    // Hitbox Path (Invisible but large hit area)
    const hitboxPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    hitboxPath.setAttribute("d", d);
    hitboxPath.setAttribute("class", "connection-hitbox");

    group.appendChild(glowPath);
    group.appendChild(corePath);
    group.appendChild(hitboxPath);

    // --- Directional Arrow ---
    if (linkData) {
        const t = 0.5;
        const midX = Math.pow(1 - t, 3) * start.x + 3 * Math.pow(1 - t, 2) * t * cp1x + 3 * (1 - t) * Math.pow(t, 2) * cp2x + Math.pow(t, 3) * end.x;
        const midY = Math.pow(1 - t, 3) * start.y + 3 * Math.pow(1 - t, 2) * t * cp1y + 3 * (1 - t) * Math.pow(t, 2) * cp2y + Math.pow(t, 3) * end.y;

        const tangentX = 3 * Math.pow(1 - t, 2) * (cp1x - start.x) + 6 * (1 - t) * t * (cp2x - cp1x) + 3 * Math.pow(t, 2) * (end.x - cp2x);
        const tangentY = 3 * Math.pow(1 - t, 2) * (cp1y - start.y) + 6 * (1 - t) * t * (cp2y - cp1y) + 3 * Math.pow(t, 2) * (end.y - cp2y);
        const angle = Math.atan2(tangentY, tangentX) * (180 / Math.PI);

        const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
        arrow.setAttribute("d", "M -6 -6 L 6 0 L -6 6 Z"); // Simple triangle
        arrow.setAttribute("fill", color);
        arrow.setAttribute("transform", `translate(${midX}, ${midY}) rotate(${angle})`);
        arrow.style.opacity = "0.9";
        group.appendChild(arrow);
    }

    if (linkData) {
        const removeLink = (e) => {
            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                store.links = store.links.filter(l => l !== linkData);
                store.emit('links_changed');
            }
        };
        group.addEventListener('click', removeLink);
        group.addEventListener('mousedown', removeLink);
    }

    svg.appendChild(group);
}

// --- CHOICE LOGIC ---

function updateChoice(nodeId, idx, text) {
    store.updateChoice(nodeId, idx, text);
}

// --- CUSTOM DROPDOWN HELPERS ---
function getDropdownHtml(nodeId, fieldName, options, currentValue, handlers = '') {
    const id = `dropdown_${nodeId}_${fieldName}`;
    let itemsHtml = '';
    options.forEach(opt => {
        itemsHtml += `<div class="nexus-dropdown-option ${opt === currentValue ? 'selected' : ''}" onclick="updateDropdownValue('${nodeId}', '${fieldName}', '${opt}')">${opt}</div>`;
    });

    const displayValue = currentValue || (options.length > 0 ? options[0] : 'None');

    return `
        <div class="nexus-dropdown" id="${id}" data-value="${currentValue}" ${handlers}>
            <div class="nexus-dropdown-trigger" onclick="toggleDropdown('${id}')">
                <span>${displayValue}</span>
                <i class="bi bi-chevron-down"></i>
            </div>
            <div class="nexus-dropdown-options" onwheel="event.stopPropagation()">
                ${itemsHtml}
            </div>
        </div>
    `;
}

function toggleDropdown(id) {
    const el = document.getElementById(id);
    const wasActive = el.classList.contains('active');
    document.querySelectorAll('.nexus-dropdown').forEach(d => d.classList.remove('active'));
    if (!wasActive) el.classList.add('active');
    event.stopPropagation();
}

function updateDropdownValue(nodeId, fieldName, value) {
    if (nodeId === 'global') {
        store.pushSnapshot();
        store.config[fieldName] = value;
        store.save();
        renderConfig();
    } else if (nodeId.startsWith('char_')) {
        const charId = nodeId.replace('char_', '');
        store.updateCharacter(charId, fieldName, value);
    } else if (nodeId.startsWith('gate_')) {
        const parts = nodeId.split('_'); // gate_node_timestamp_idx
        const idx = parseInt(parts.pop());
        const actualNodeId = parts.slice(1).join('_');
        store.updateGate(actualNodeId, idx, fieldName, value);
    } else {
        store.updateNodeData(nodeId, fieldName, value);
        // Refresh the node so the dropdown display updates to the new value
        refreshNode(nodeId);
    }
}

function refreshNode(id) {
    const el = document.getElementById(id);
    if (!el) return;

    const node = store.nodes.find(n => n.id === id);
    if (node) {
        const placeholder = document.createElement('div');
        el.replaceWith(placeholder);
        renderNode(node);
        const newEl = document.getElementById(id);
        if (newEl) {
            newEl.classList.remove('node-appearing');
            placeholder.replaceWith(newEl);
        } else {
            placeholder.remove();
        }
    } else {
        el.remove();
    }
    needsRender = true;
}

// --- GLOBAL CONFIG LOGIC ---

function addBackground(id = "1", url = "") {
    store.config.backgrounds[id] = url;
    store.emit('config_refresh');
}

function addCharacter() {
    store.addCharacter();
}

function deleteCharacter(id) {
    store.deleteCharacter(id);
}

function updateCharacter(id, field, value) {
    store.updateCharacter(id, field, value);
}

function editSprites(id) {
    const char = store.config.characters[id];
    let spriteHtml = '';
    Object.entries(char.sprites || {}).forEach(([key, url]) => {
        spriteHtml += `
            <div class="list-item" style="margin-bottom: 8px; align-items: center;">
                <div class="sprite-editor-thumb" style="background-image: url('${url}')">
                    ${!url ? '<i class="bi bi-image"></i>' : ''}
                </div>
                <div style="flex:1; display:flex; flex-direction:column; gap:4px">
                    <div style="display:flex; gap:5px">
                        <input value="${key}" style="width:100px; font-weight:bold; font-size:11px" placeholder="Expression" onchange="store.pushSnapshot(); const v=store.config.characters['${id}'].sprites['${key}']; delete store.config.characters['${id}'].sprites['${key}']; store.config.characters['${id}'].sprites[this.value]=v; editSprites('${id}'); store.emit('config_refresh')">
                        <span class="btn-delete" style="padding: 2px 6px;" onclick="store.pushSnapshot(); delete store.config.characters['${id}'].sprites['${key}']; editSprites('${id}'); store.emit('config_refresh')"><i class="bi bi-trash3-fill"></i></span>
                    </div>
                    <input value="${url}" placeholder="Sprite URL" style="font-size:11px" onchange="store.pushSnapshot(); store.config.characters['${id}'].sprites['${key}'] = this.value; store.emit('config_refresh')">
                </div>
            </div>
        `;
    });

    const content = `
        <div style="padding: 10px;">
            <h3>EXPRESSIONS: ${char.name}</h3>
            <div id="sprites-editor">${spriteHtml}</div>
            <button class="btn btn-outline" style="width:100%; margin-top:10px;" onclick="store.pushSnapshot(); store.config.characters['${id}'].sprites['new_expr'] = ''; editSprites('${id}'); store.emit('config_refresh')">＋ ADD EXPRESSION</button>
            <button class="btn" style="width:100%; margin-top:20px;" onclick="hideOverlay(); store.emit('config_refresh')">DONE</button>
        </div>
    `;

    showModal(content);
}

function showModal(html) {
    let modal = document.getElementById('nexus-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'nexus-modal';
        modal.style = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); display:flex; align-items:center; justify-content:center; z-index:10000; backdrop-filter:blur(5px);";
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div style="background:#1a1a2e; border:1px solid var(--accent); padding:20px; border-radius:15px; width:400px; box-shadow: 0 0 30px var(--accent-glow);">
            ${html}
        </div>
    `;
    modal.style.display = 'flex';
}

function hideOverlay() {
    const modal = document.getElementById('nexus-modal');
    if (modal) modal.style.display = 'none';
}

function confirmAction(message, onConfirm) {
    const content = `
        <div style="text-align:center; padding: 10px;">
            <h3 style="color:var(--accent); margin-bottom:15px; letter-spacing: 2px;">🛰️ NEXUS WARNING</h3>
            <p style="color:white; margin-bottom:25px; font-size: 14px; line-height: 1.5;">${message}</p>
            <div style="display:flex; gap:12px; justify-content:center;">
                <button class="btn btn-outline" style="flex:1;" onclick="hideOverlay()">CANCEL</button>
                <button class="btn" style="flex:1; background:var(--accent); color:black; font-weight: bold;" id="nexus-confirm-btn">CONFIRM</button>
            </div>
        </div>
    `;
    showModal(content);
    document.getElementById('nexus-confirm-btn').onclick = () => {
        hideOverlay();
        onConfirm();
    };
}

function showToast(message, type = 'info') {
    // Remove existing toast if any
    const existing = document.getElementById('nexus-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'nexus-toast';
    const colors = {
        info: { bg: 'rgba(0,255,204,0.15)', border: 'var(--accent)', text: 'var(--accent)' },
        warn: { bg: 'rgba(255,157,0,0.15)', border: '#ff9d00', text: '#ff9d00' },
        error: { bg: 'rgba(255,60,60,0.15)', border: '#ff3c3c', text: '#ff3c3c' }
    };
    const c = colors[type] || colors.info;
    toast.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: ${c.bg};
        border: 1px solid ${c.border};
        color: ${c.text};
        padding: 8px 20px;
        border-radius: 8px;
        font-family: var(--font-mono, monospace);
        font-size: 12px;
        letter-spacing: 1px;
        text-transform: uppercase;
        z-index: 99999;
        pointer-events: none;
        backdrop-filter: blur(8px);
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    // Auto-dismiss after 1.5s
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
}

function updateNodeCountBadge() {
    const badges = [document.getElementById('node-count-badge'), document.getElementById('config-node-count-badge')];
    const count = store.nodes.length;
    badges.forEach(badge => {
        if (!badge) return;
        badge.textContent = count + (count === 1 ? ' NODE' : ' NODES');
        badge.classList.toggle('has-nodes', count > 0);
    });
}

function showSpritePreview(nodeId, charId) {
    const node = store.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const finalCharId = charId || node.data.character;
    const character = store.config.characters[finalCharId];
    if (!character) return;

    const state = node.data.spriteState || 'neutral';
    if (!character.sprites) return;
    const spriteUrl = character.sprites[state] || character.sprites['neutral'] || Object.values(character.sprites)[0];

    if (!spriteUrl || spriteUrl === "") return;

    let preview = document.getElementById('sprite-preview');
    if (!preview) {
        preview = document.createElement('div');
        preview.id = 'sprite-preview';
        document.body.appendChild(preview);
    }

    preview.style.backgroundImage = `url(${spriteUrl})`;

    // Position it relative to the node
    const nodeEl = document.getElementById(nodeId);
    if (nodeEl) {
        const rect = nodeEl.getBoundingClientRect();
        preview.style.left = (rect.left + rect.width / 2 - 110) + 'px';
        preview.style.top = (rect.top - 335) + 'px';
        preview.classList.add('active');
    }
}

function hideSpritePreview() {
    const preview = document.getElementById('sprite-preview');
    if (preview) {
        preview.classList.remove('active');
    }
}

function addChapter() {
    const id = Object.keys(store.config.chapterNames).length + 1;
    store.config.chapterNames[id] = "New Chapter";
    store.config.chapterBackgrounds[id] = "";
    store.config.chapterMusic[id] = "";
    store.emit('config_refresh');
}

function deleteChapter(id) {
    delete store.config.chapterNames[id];
    delete store.config.chapterBackgrounds[id];
    delete store.config.chapterMusic[id];
    store.emit('config_refresh');
}

function updateChapter(oldId, newId, field, value) {
    if (field === 'id') {
        const name = store.config.chapterNames[oldId];
        const bg = store.config.chapterBackgrounds[oldId];
        const mus = store.config.chapterMusic[oldId];

        delete store.config.chapterNames[oldId];
        delete store.config.chapterBackgrounds[oldId];
        delete store.config.chapterMusic[oldId];

        store.config.chapterNames[newId] = name;
        store.config.chapterBackgrounds[newId] = bg;
        store.config.chapterMusic[newId] = mus;

        // Refactor node references
        store.nodes.forEach(node => {
            // Check both string and number for robustness
            if (node.data && String(node.data.chapter) === String(oldId)) {
                node.data.chapter = newId;
            }
        });
        store.emit('nodes_changed');
    } else if (field === 'name') {
        store.config.chapterNames[oldId] = value;
    } else if (field === 'bg') {
        store.config.chapterBackgrounds[oldId] = value;
    } else if (field === 'music') {
        store.config.chapterMusic[oldId] = value;
    }
    store.emit('config_refresh');
}

function addStateVar(key = "new_var", val = 0) {
    store.addStateVar(key, val);
}

function deleteStateVar(id) {
    store.deleteStateVar(id);
}

const THEMES = [
    'nasapunk.css', 'cyberpunk.css', 'anime1.css', 'anime2.css',
    'anime3.css', 'anime4.css', 'fantasy.css', 'gothic.css',
    'romantic1.css', 'romantic2.css', 'warmui.css'
];

function updateGlobalConfig() {
    store.pushSnapshot();
    store.config.storyTitle = document.getElementById('conf-title').value;
    store.config.storySubtitle = document.getElementById('conf-subtitle').value;
    store.config.loadScreenBackground = document.getElementById('conf-loadbg').value;
    store.save();
}

function toggleSection(sectionId, header) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    const isCollapsed = section.classList.toggle('collapsed');
    header.classList.toggle('collapsed', isCollapsed);

    // Rotate icon
    const icon = header.querySelector('.bi-chevron-down');
    if (icon) {
        icon.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
}

function renderConfig() {
    // Focus Persistence: Save current focus state
    const active = document.activeElement;
    let focusInfo = null;
    if (active && active.closest('.config-section')) {
        const section = active.closest('.config-section');
        const inputs = Array.from(section.querySelectorAll('input, textarea, select'));
        focusInfo = {
            sectionId: section.id,
            index: inputs.indexOf(active),
            selectionStart: active.selectionStart,
            selectionEnd: active.selectionEnd
        };
    }

    // Title & Basics
    document.getElementById('conf-title').value = store.config.storyTitle;
    document.getElementById('conf-subtitle').value = store.config.storySubtitle;
    document.getElementById('conf-loadbg').value = store.config.loadScreenBackground || '';

    const themeContainer = document.getElementById('theme-dropdown-container');
    themeContainer.innerHTML = getDropdownHtml('global', 'theme', THEMES, store.config.theme || 'nasapunk.css');

    const stateList = document.getElementById('state-list');
    stateList.innerHTML = '';
    store.config.initialState.forEach((v) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '10px';
        div.innerHTML = `
            <i class="bi bi-hash" style="color:var(--accent); font-size: 16px; opacity: 0.6"></i>
            <input id="state-key-${v.id}" value="${v.key}" placeholder="Variable Key" style="flex:1; margin-right:5px" oninput="store.updateStateVar('${v.id}', this.value, ${v.value})">
            <input id="state-val-${v.id}" type="number" value="${v.value}" style="width:50px; text-align:center; margin-right:5px" oninput="store.updateStateVar('${v.id}', '${v.key}', parseInt(this.value))">
            <span class="btn-delete" onclick="deleteStateVar('${v.id}')"><i class="bi bi-x-lg"></i></span>
        `;
        stateList.appendChild(div);
    });

    const chapterList = document.getElementById('chapter-list');
    chapterList.innerHTML = '';
    Object.entries(store.config.chapterNames).forEach(([id, name]) => {
        const bg = store.config.chapterBackgrounds[id] || "";
        const music = store.config.chapterMusic[id] || "";
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '5px';
        div.innerHTML = `
            <div style="display:grid; grid-template-columns: 44px 1fr; gap:10px; align-items: start; width: 100%">
                ${bg ? `<img src="${bg}" class="config-thumb">` : `<div class="config-thumb-placeholder"><i class="bi bi-image"></i></div>`}
                <div style="display:flex; flex-direction:column; gap:6px; min-width: 0">
                    <div style="display:flex; gap:5px; align-items:center">
                        <input type="number" value="${id}" style="width:35px; font-weight:bold; color:var(--accent); text-align:center; padding: 4px;" onchange="updateChapter('${id}', this.value, 'id')">
                        <input value="${name}" placeholder="Chapter Title" style="flex:1; margin-right:5px" onchange="updateChapter('${id}', null, 'name', this.value)">
                        <span class="btn-delete" onclick="deleteChapter('${id}')"><i class="bi bi-x-lg"></i></span>
                    </div>
                    <input value="${bg}" placeholder="Background URL" style="font-size:11px" onchange="updateChapter('${id}', null, 'bg', this.value)">
                    <input value="${music}" placeholder="Music URL (MP3/YT)" style="font-size:11px" onchange="updateChapter('${id}', null, 'music', this.value)">
                </div>
            </div>
        `;
        chapterList.appendChild(div);
    });

    const charList = document.getElementById('char-list');
    charList.innerHTML = '';
    Object.entries(store.config.characters).forEach(([id, c]) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.display = 'flex';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '5px';
        div.innerHTML = `
            <div style="display:grid; grid-template-columns: 44px 1fr; gap:12px; align-items: start; width: 100%">
                ${c.sprites?.neutral ? `<img src="${c.sprites.neutral}" class="config-thumb">` : `<div class="config-thumb-placeholder"><i class="bi bi-person"></i></div>`}
                <div style="display:flex; flex-direction:column; gap:8px; min-width: 0">
                    <div style="display:flex; gap:6px; align-items:center">
                        <input value="${id}" style="width:70px; font-weight:bold; color:var(--accent); font-size:11px; padding: 4px; border-color:var(--accent-dim)" oninput="updateCharacter('${id}', 'id', this.value)">
                        <input value="${c.name || ''}" placeholder="Display Name" style="flex:1; margin-right:5px; font-weight: 600;" oninput="updateCharacter('${id}', 'name', this.value)">
                        <span class="btn-delete" onclick="deleteCharacter('${id}')"><i class="bi bi-trash3-fill"></i></span>
                    </div>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <div class="expression-badge">
                            <i class="bi bi-layers-fill"></i> ${Object.keys(c.sprites || {}).length}
                        </div>
                        <div style="flex:1">
                            ${getDropdownHtml('char_' + id, 'position', ['left', 'center', 'right'], c.position || 'center')}
                        </div>
                        <button class="btn btn-outline" style="padding:2px 8px; font-size:10px; height:34px" onclick="editSprites('${id}')">🎭 SPRITES</button>
                    </div>
                    <input value="${c.sfx || ''}" placeholder="Voice SFX URL" style="font-size:11px" oninput="updateCharacter('${id}', 'sfx', this.value)">
                    <textarea placeholder="Description (optional)" style="height:40px; font-size:11px" oninput="updateCharacter('${id}', 'description', this.value)">${c.description || ''}</textarea>
                </div>
            </div>
        `;
        charList.appendChild(div);
    });

    // Focus Persistence: Restore focus
    if (focusInfo && focusInfo.sectionId) {
        const section = document.getElementById(focusInfo.sectionId);
        if (section) {
            // Priority 1: Restore by ID (Stable)
            if (active && active.id) {
                const el = document.getElementById(active.id);
                if (el) {
                    el.focus();
                    if (focusInfo.selectionStart !== undefined && el.setSelectionRange) {
                        el.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
                    }
                    return;
                }
            }
            // Priority 2: Restore by Index (Fallback)
            const inputs = Array.from(section.querySelectorAll('input, textarea, select'));
            const el = inputs[focusInfo.index];
            if (el) {
                el.focus();
                if (focusInfo.selectionStart !== undefined && el.setSelectionRange) {
                    el.setSelectionRange(focusInfo.selectionStart, focusInfo.selectionEnd);
                }
            }
        }
    }
}

function refreshAllNodes() {
    store.nodes.forEach(n => refreshNode(n.id));
}

// --- EXPORT / IMPORT ---

/**
 * Convert rich editor HTML to LVNE-compatible output:
 * - macro token spans → [name(intensity)] text
 * - removes ZWS characters
 * - preserves <b>, <i>, <u>, <span style="..."> etc.
 */
function serializeRichHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    // Convert macro tokens
    div.querySelectorAll('.nexus-macro-token').forEach(tok => {
        const name = tok.dataset.macro;
        const intensity = tok.dataset.intensity;
        const text = window.macroToText
            ? macroToText(name, intensity || null)
            : `[${name}]`;
        tok.replaceWith(document.createTextNode(text));
    });
    // Strip ZWS
    div.innerHTML = div.innerHTML.replace(/\u200B/g, '');
    return div.innerHTML;
}

function exportJSON() {

    const dialogue = [];

    store.nodes.forEach((node, index) => {
        const charName = node.data.character || "NARRATION";
        const spriteState = node.data.spriteState ? `:${node.data.spriteState}` : "";

        const entry = {
            id: node.id,
            chapter: parseInt(node.data.chapter) || 0,
            scene: parseInt(node.data.scene) || 1,
            character: charName + spriteState,
            text: serializeRichHtml(node.data.text || '')
        };

        if (node.data.SpriteEffects && node.data.SpriteEffects !== 'None') entry.SpriteEffects = node.data.SpriteEffects;
        if (node.data.persistentEffect) entry.persistentEffect = node.data.persistentEffect;

        // Merge Screen Effects into Dialogue Text
        if (node.data.effect && node.data.effect !== 'None') {
            const intensity = node.data.intensity ? `(${node.data.intensity})` : "";
            entry.text = `[${node.data.effect}${intensity}] ${entry.text}`;
        }
        if (node.data.overlay && node.data.overlay !== 'None') {
            entry.text = `<${node.data.overlay}> ${entry.text}`;
        }

        // Handle out link
        const outLink = store.links.find(l => l.fromNode === node.id && l.fromPort === 'out');
        if (outLink) {
            entry.nextId = outLink.toNode;
        }

        // Handle choices
        if (node.type === 'choice') {
            entry.choices = node.choices.map((c, idx) => {
                const link = store.links.find(l => l.fromNode === node.id && l.fromPort === `choice_${idx}`);
                return {
                    text: c.text,
                    nextId: link ? link.toNode : null
                };
            });
        }

        // Handle logic branches
        if (node.type === 'condition') {
            entry.type = 'condition';
            entry.logic = node.data.logic || 'ALL (AND)';
            entry.gates = node.data.gates || [];
            entry.branches = {};
            const typeDef = NODE_TYPES[node.type];
            typeDef.ports.branches.forEach(b => {
                const link = store.links.find(l => l.fromNode === node.id && l.fromPort === `branch_${b}`);
                entry.branches[b.toLowerCase()] = link ? link.toNode : null;
            });
        }

        dialogue.push(entry);
    });

    const output = {
        ...store.config,
        storyDialogue: dialogue,
        groups: store.groups
    };

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'story.json';
    a.click();
}

function importJSON(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (re) => {
        try {
            const data = JSON.parse(re.target.result);

            // MIGRATION: Handle initialState as object (from external JSONs)
            if (data.initialState && !Array.isArray(data.initialState)) {
                const newInit = [];
                Object.entries(data.initialState).forEach(([k, v]) => {
                    newInit.push({ id: 'var_' + Math.random().toString(36).substr(2, 9), key: k, value: v });
                });
                data.initialState = newInit;
            }

            if (!data.storyDialogue) throw new Error("Missing storyDialogue array");

            store.pushSnapshot(); // Make import undoable

            store.nodes = [];
            store.links = [];
            store.groups = data.groups || [];
            workspace.innerHTML = '';

            // Load global config
            store.config = { ...store.config, ...data };
            delete store.config.storyDialogue;

            // --- SMART LAYOUT & AUTO-GROUPING ---
            const uniqueChapters = [...new Set(data.storyDialogue.map(d => d.chapter))].sort((a, b) => a - b);

            // Auto-generate groups if missing
            if ((!store.groups || store.groups.length === 0) && uniqueChapters.length > 0) {
                uniqueChapters.forEach((ch, idx) => {
                    const chName = data.chapterNames && data.chapterNames[ch] ? data.chapterNames[ch] : `CHAPTER ${ch}`;
                    store.groups.push({
                        id: `group_ch_${ch}`,
                        title: chName.toUpperCase(),
                        x: 50,
                        y: 50 + idx * 1200,
                        width: 15000,
                        height: 1000,
                        color: 'rgba(0, 255, 204, 0.05)'
                    });
                });
            }

            // Load nodes with smart positioning
            data.storyDialogue.forEach((d, i) => {
                let charId = d.character;
                let spriteState = 'neutral';
                if (charId && charId.includes(':')) {
                    [charId, spriteState] = charId.split(':');
                }

                const chIdx = uniqueChapters.indexOf(d.chapter);
                const sceneIdxInChapter = data.storyDialogue.filter((node, index) => node.chapter === d.chapter && index < i).length;

                // Smart X/Y if not provided
                let x = d.x;
                let y = d.y;
                if (!x || !y) {
                    if (chIdx !== -1) {
                        x = 200 + sceneIdxInChapter * 600;
                        y = 200 + chIdx * 1200;
                    } else {
                        x = 100 + (i % 5) * 300;
                        y = 100 + Math.floor(i / 5) * 350;
                    }
                }

                const node = {
                    id: d.id || `node_${i}`,
                    type: d.choices ? 'choice' : (d.type === 'condition' ? 'condition' : 'dialogue'),
                    x: x,
                    y: y,
                    data: {
                        character: charId,
                        spriteState: spriteState,
                        text: d.text,
                        chapter: d.chapter,
                        scene: d.scene,
                        logic: d.logic || 'ALL (AND)',
                        gates: d.gates || (d.condition ? [{ variable: d.condition.variable, operator: d.condition.operator, value: d.condition.value }] : [])
                    },
                    choices: d.choices || []
                };
                store.nodes.push(node);
            });

            // --- SMART CONNECTION ALGORITHM ---
            data.storyDialogue.forEach((d, i) => {
                const fromId = d.id || `node_${i}`;
                let hasExplicitNext = false;

                // 1. Explicit nextId
                if (d.nextId) {
                    store.links.push({ fromNode: fromId, fromPort: 'out', toNode: d.nextId, toPort: 'in' });
                    hasExplicitNext = true;
                }

                // 2. Choices
                if (d.choices) {
                    d.choices.forEach((c, cIdx) => {
                        if (c.nextId) {
                            store.links.push({ fromNode: fromId, fromPort: `choice_${cIdx}`, toNode: c.nextId, toPort: 'in' });
                            hasExplicitNext = true;
                        }
                    });
                }

                // 3. Branches (Logic)
                if (d.branches) {
                    Object.entries(d.branches).forEach(([key, target]) => {
                        if (target) {
                            const portName = key.charAt(0).toUpperCase() + key.slice(1);
                            store.links.push({ fromNode: fromId, fromPort: `branch_${portName}`, toNode: target, toPort: 'in' });
                            hasExplicitNext = true;
                        }
                    });
                }

                // 4. AUTO-LINK fallback (Sequential Progression)
                // If no explicit connection is found, link to the next node in the array
                if (!hasExplicitNext && i < data.storyDialogue.length - 1) {
                    const nextNode = data.storyDialogue[i + 1];
                    const nextId = nextNode.id || `node_${i + 1}`;
                    store.links.push({ fromNode: fromId, fromPort: 'out', toNode: nextId, toPort: 'in' });
                }
            });

            store.emit('nodes_changed');
            store.emit('groups_changed');
            store.emit('links_changed');
            store.emit('config_refresh');
            showToast("Import Successful");
        } catch (err) {
            console.error("Import failed", err);
            showToast("Invalid Story File: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

init();

function toggleSidebar() {
    const sidebar = document.getElementById('nav-sidebar');
    sidebar.classList.toggle('active');
    if (sidebar.classList.contains('active')) {
        renderSidebar();
    }
}

function renderSidebar() {
    const navList = document.getElementById('nav-list');
    if (!navList) return;

    navList.innerHTML = '';

    // Sort groups by Y position to match vertical chapter order
    const sortedGroups = [...store.groups].sort((a, b) => a.y - b.y);

    sortedGroups.forEach(group => {
        const item = document.createElement('div');
        item.className = 'nav-item';

        // Count nodes in this group
        const nodeCount = store.getNodesInGroup(group.id).length;

        item.innerHTML = `
            <i class="bi bi-folder2-open"></i>
            <div class="nav-title">${group.title || 'Untitled Group'}</div>
            <div class="nav-meta">${nodeCount} nodes</div>
        `;

        item.onclick = () => scrollToGroup(group.id);
        navList.appendChild(item);
    });

    if (sortedGroups.length === 0) {
        navList.innerHTML = '<div style="text-align:center; opacity:0.3; padding:40px; font-size:11px">No groups found</div>';
    }
}

function scrollToGroup(groupId) {
    const groupEl = document.getElementById(groupId);
    if (!groupEl) return;

    // Center the group in the workspace
    const rect = groupEl.getBoundingClientRect();
    const container = editorContainer.getBoundingClientRect();

    // We need to account for current pan and zoom
    // But since it's an SVG-based workspace, scrollIntoView might be tricky if it's not actually scrollable
    // Our workspace uses CSS transform for panning.

    const group = store.groups.find(g => g.id === groupId);
    if (group) {
        // Target offset to center the group
        const targetX = (window.innerWidth / 2) - (group.x * zoom + (group.width * zoom) / 2);
        const targetY = (window.innerHeight / 2) - (group.y * zoom + (group.height * zoom) / 2);

        // Smooth transition for pan
        animatePan(targetX, targetY);
    }

    // Highlight the group briefly
    groupEl.style.outline = '4px solid var(--accent)';
    groupEl.style.boxShadow = '0 0 50px var(--accent)';
    setTimeout(() => {
        groupEl.style.outline = '';
        groupEl.style.boxShadow = '';
    }, 1500);
}

function animatePan(targetX, targetY) {
    const startX = offset.x;
    const startY = offset.y;
    const duration = 500;
    const startTime = performance.now();

    function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Ease out quint
        const ease = 1 - Math.pow(1 - progress, 5);

        offset.x = startX + (targetX - startX) * ease;
        offset.y = startY + (targetY - startY) * ease;

        updateWorkspace();
        if (progress < 1) {
            requestAnimationFrame(step);
        }
    }
    requestAnimationFrame(step);
}
