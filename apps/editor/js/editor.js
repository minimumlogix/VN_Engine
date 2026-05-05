const editorContainer = document.getElementById('editor-container');
const workspace = document.getElementById('workspace');
const svg = document.getElementById('connections-svg');

// --- DATA MANAGEMENT (AAA STORE) ---

class NexusDataStore {
    constructor() {
        this.nodes = [];
        this.links = [];
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
            config: this.config
        });
        this.redoStack.push(current);
        this.undoStack.pop();
        const prevState = JSON.parse(this.undoStack[this.undoStack.length - 1]);
        this.nodes = prevState.nodes || [];
        this.links = prevState.links || [];
        this.config = prevState.config || this.config;
        this.emit('nodes_changed');
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
            config: this.config
        });
        this.undoStack.push(current);
        const nextState = JSON.parse(this.redoStack.pop());
        this.nodes = nextState.nodes || [];
        this.links = nextState.links || [];
        this.config = nextState.config || this.config;
        this.emit('nodes_changed');
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
                this.config = data.config || this.config;
                return true;
            } catch (e) {
                console.error("Failed to load autosave", e);
                showToast("Corrupted autosave cleared", "error");
                localStorage.removeItem(this.autoSaveKey);
            }
        }
        return false;
    }

    clearAutosave() {
        localStorage.removeItem(this.autoSaveKey);
        // Also clear undo/redo stacks so nothing is recoverable after reset
        this.undoStack = [];
        this.redoStack = [];
        location.reload();
    }

    // --- Node Operations ---
    addNode(type, x, y) {
        this.pushSnapshot();
        const id = 'node_' + Date.now();
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
            node.data.gates.push({ variable: Object.keys(this.config.initialState)[0] || 'new_var', operator: '==', value: 0 });
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
        this.config.initialState[key] = val;
        this.emit('config_refresh');
    }

    deleteStateVar(key) {
        this.pushSnapshot();
        delete this.config.initialState[key];
        this.emit('config_refresh');
    }

    updateStateVar(oldKey, newKey, value) {
        if (!this.historyTimer) {
            this.pushSnapshot();
        }
        clearTimeout(this.historyTimer);
        this.historyTimer = setTimeout(() => {
            this.historyTimer = null;
        }, 1000);
        if (oldKey !== newKey) {
            delete this.config.initialState[oldKey];
            // Refactor node references
            this.nodes.forEach(node => {
                if (node.data && node.data.variable === oldKey) {
                    node.data.variable = newKey;
                }
            });
            this.emit('nodes_changed');
        }
        this.config.initialState[newKey] = value;
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

let needsRender = true;
let mouseEvent = null;

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
    });

    window.onclick = () => {
        document.querySelectorAll('.nexus-dropdown').forEach(d => d.classList.remove('active'));
    };
    
    // Subscribe UI to Data Changes
    store.subscribe((event, data) => {
        if (event === 'nodes_changed') {
            renderAllNodes();
        } else if (event === 'node_refresh') {
            refreshNode(data);
        } else if (event === 'config_refresh' || event === 'config_updated') {
            renderConfig();
            refreshAllNodes(); // Character selects etc
        } else if (event === 'links_changed') {
            needsRender = true;
        }
        needsRender = true;
    });

    // Try load autosave or use template
    if (!store.load()) {
        if (DEFAULT_STORY_DATA.storyDialogue) {
            DEFAULT_STORY_DATA.storyDialogue.forEach(d => {
                store.nodes.push({ ...d });
            });
        }
    }

    // Push initial state to history stack
    store.pushSnapshot();

    renderAllNodes();
    renderConfig();
    requestAnimationFrame(tick);

    showToast("Hint: Alt + Click a link to delete it", "info");

    // AAA Responsive Auto-Hide
    if (window.innerWidth < 1200) {
        toggleConfigPanel();
    }
}

function renderAllNodes() {
    workspace.innerHTML = '';
    store.nodes.forEach(n => renderNode(n));
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
        workspace.style.transform = `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`;
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
        isDragging = true;
        lastMousePos = { x: e.clientX, y: e.clientY };
    }
}

function handleMouseMove(e) {
    mouseEvent = e;
    if (isDragging) {
        const dx = e.clientX - lastMousePos.x;
        const dy = e.clientY - lastMousePos.y;
        offset.x += dx;
        offset.y += dy;
        lastMousePos = { x: e.clientX, y: e.clientY };
        needsRender = true;
    }
    if (activeLink) {
        needsRender = true;
    }
}

function handleMouseUp(e) {
    isDragging = false;
    if (activeLink) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const port = elements.find(el => el.classList.contains('port-in'));
        if (port) {
            const targetNodeId = port.closest('.node').dataset.id;
            createLink(activeLink.fromNode, activeLink.fromPort, targetNodeId, 'in');
        }
        activeLink = null;
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
    div.className = 'node';
    div.id = node.id;
    div.dataset.id = node.id;
    div.style.left = node.x + 'px';
    div.style.top = node.y + 'px';

    let fieldsHtml = '';
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
                    ${getDropdownHtml(dropdownId, 'variable', Object.keys(store.config.initialState), gate.variable)}
                    
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
            ${typeDef.title}
            <span style="color:var(--text-dim); cursor:pointer" onclick="deleteNode('${node.id}')">✕</span>
        </div>
        <div class="node-content">${fieldsHtml}</div>
        ${typeDef.ports.in ? `<div class="port port-in port-${node.type}"></div>` : ''}
        ${typeDef.ports.out ? `<div class="port port-out port-${node.type}" onmousedown="startLink(event, '${node.id}', 'out')"></div>` : ''}
        ${typeDef.ports.branches ? typeDef.ports.branches.map((b, i) => `
            <div class="branch-row">
                <span class="branch-label">${b}</span>
                <div class="port port-out branch-port port-${node.type}" onmousedown="startLink(event, '${node.id}', 'branch_${b}')"></div>
            </div>
        `).join('') : ''}
    `;

    // Dragging logic
    const header = div.querySelector('.node-header');
    header.onmousedown = (e) => {
        e.stopPropagation();
        selectNode(node.id);
        let startX = e.clientX;
        let startY = e.clientY;
        
        const onMouseMove = (me) => {
            const dx = (me.clientX - startX) / zoom;
            const dy = (me.clientY - startY) / zoom;
            node.x += dx;
            node.y += dy;
            div.style.left = node.x + 'px';
            div.style.top = node.y + 'px';
            startX = me.clientX;
            startY = me.clientY;
            needsRender = true;
        };
        
        const onMouseUp = () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
        };
        
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    div.onclick = () => selectNode(node.id);

    workspace.appendChild(div);

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
    store.deleteNode(id);
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
    confirmAction('This will PERMANENTLY DELETE all autosaved progress and reset the editor to its default state. This cannot be undone.', () => {
        store.clearAutosave();
    });
}

function selectNode(id) {
    if (selectedNode) {
        const prev = document.getElementById(selectedNode);
        if (prev) prev.classList.remove('selected');
    }
    selectedNode = id;
    document.getElementById(id).classList.add('selected');
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
    svg.innerHTML = '';
    store.links.forEach(link => {
        const fromPos = getPortPos(link.fromNode, link.fromPort);
        const toPos = getPortPos(link.toNode, link.toPort);
        if (fromPos && toPos) drawLink(fromPos, toPos, link);
    });

    if (activeLink && mouseEvent) {
        const fromPos = getPortPos(activeLink.fromNode, activeLink.fromPort);
        const toPos = { x: mouseEvent.clientX, y: mouseEvent.clientY };
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
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function drawLink(start, end, linkData = null) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const dx = Math.min(Math.max(120, Math.abs(end.x - start.x) * 0.5), 250);
    const d = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y} ${end.x - dx} ${end.y} ${end.x} ${end.y}`;
    path.setAttribute("d", d);

    let color = '#00ffcc';
    let dimColor = 'rgba(0, 255, 204, 0.4)';

    if (linkData) {
        const sourceNode = store.nodes.find(n => n.id === linkData.fromNode);
        if (sourceNode) {
            if (sourceNode.type === 'dialogue') {
                color = '#00ffcc'; dimColor = 'rgba(0, 255, 204, 0.4)';
            } else if (sourceNode.type === 'choice') {
                color = '#ff9d00'; dimColor = 'rgba(255, 157, 0, 0.4)';
            } else if (sourceNode.type === 'condition') {
                color = '#0084ff'; dimColor = 'rgba(0, 132, 255, 0.4)';
            } else if (sourceNode.type === 'effect') {
                color = '#c03cfc'; dimColor = 'rgba(192, 60, 252, 0.4)';
            }
        }
        path.setAttribute("class", "connection connection-active");
    } else {
        path.setAttribute("class", "connection connection-drag");
    }

    path.style.setProperty('--link-color', color);
    path.style.setProperty('--link-color-dim', dimColor);

    if (linkData) {
        const removeLink = (e) => {
            if (e.altKey) {
                e.preventDefault();
                e.stopPropagation();
                store.links = store.links.filter(l => l !== linkData);
                store.emit('links_changed');
            }
        };
        path.addEventListener('click', removeLink);
        path.addEventListener('mousedown', removeLink);
    }

    svg.appendChild(path);
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
    if (el) el.remove();
    const node = store.nodes.find(n => n.id === id);
    if (node) renderNode(node);
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
            <div class="list-item" style="margin-bottom: 5px;">
                <input value="${key}" style="width:70px" onchange="const v=store.config.characters['${id}'].sprites['${key}']; delete store.config.characters['${id}'].sprites['${key}']; store.config.characters['${id}'].sprites[this.value]=v; editSprites('${id}')">
                <input value="${url}" placeholder="Sprite URL" style="flex:1" onchange="store.config.characters['${id}'].sprites['${key}'] = this.value">
                <span style="cursor:pointer" onclick="delete store.config.characters['${id}'].sprites['${key}']; editSprites('${id}')">✕</span>
            </div>
        `;
    });

    const content = `
        <div style="padding: 10px;">
            <h3>EXPRESSIONS: ${char.name}</h3>
            <div id="sprites-editor">${spriteHtml}</div>
            <button class="btn btn-outline" style="width:100%; margin-top:10px;" onclick="store.config.characters['${id}'].sprites['new_expr'] = ''; editSprites('${id}')">＋ ADD EXPRESSION</button>
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

function showSpritePreview(nodeId, charId) {
    const node = store.nodes.find(n => n.id === nodeId);
    if (!node) return;
    
    const finalCharId = charId || node.data.character;
    const character = store.config.characters[finalCharId];
    if (!character) return;

    const state = node.data.spriteState || 'neutral';
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

function deleteStateVar(key) {
    store.deleteStateVar(key);
}

const THEMES = [
    'nasapunk.css', 'cyberpunk.css', 'anime1.css', 'anime2.css', 
    'anime3.css', 'anime4.css', 'fantasy.css', 'gothic.css', 
    'romantic1.css', 'romantic2.css', 'warmui.css'
];

function updateGlobalConfig() {
    store.config.storyTitle = document.getElementById('conf-title').value;
    store.config.storySubtitle = document.getElementById('conf-subtitle').value;
    store.config.loadScreenBackground = document.getElementById('conf-loadbg').value;
    store.save();
}

function renderConfig() {
    // Title & Basics
    document.getElementById('conf-title').value = store.config.storyTitle;
    document.getElementById('conf-subtitle').value = store.config.storySubtitle;
    document.getElementById('conf-loadbg').value = store.config.loadScreenBackground || '';

    const themeContainer = document.getElementById('theme-dropdown-container');
    themeContainer.innerHTML = getDropdownHtml('global', 'theme', THEMES, store.config.theme || 'nasapunk.css');

    const stateList = document.getElementById('state-list');
    stateList.innerHTML = '';
    Object.entries(store.config.initialState).forEach(([key, val]) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <input value="${key}" style="width:70px" oninput="store.updateStateVar('${key}', this.value, ${val})">
            <input type="number" value="${val}" style="width:40px" oninput="store.updateStateVar('${key}', '${key}', parseInt(this.value))">
            <span style="cursor:pointer" onclick="deleteStateVar('${key}')">✕</span>
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
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '5px';
        div.innerHTML = `
            <div style="display:flex; gap:5px; align-items:center">
                <input type="number" value="${id}" style="width:50px; font-weight:bold; color:var(--accent)" onchange="updateChapter('${id}', this.value, 'id')">
                <input value="${name}" placeholder="Chapter Title" style="flex:1" onchange="updateChapter('${id}', null, 'name', this.value)">
                <span style="cursor:pointer" onclick="deleteChapter('${id}')">✕</span>
            </div>
            <input value="${bg}" placeholder="Background URL" style="font-size:10px" onchange="updateChapter('${id}', null, 'bg', this.value)">
            <input value="${music}" placeholder="Music URL (MP3/YT)" style="font-size:10px" onchange="updateChapter('${id}', null, 'music', this.value)">
        `;
        chapterList.appendChild(div);
    });

    const charList = document.getElementById('char-list');
    charList.innerHTML = '';
    Object.entries(store.config.characters).forEach(([id, c]) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.style.flexDirection = 'column';
        div.style.alignItems = 'stretch';
        div.style.gap = '5px';
        div.innerHTML = `
            <div style="display:flex; gap:5px; align-items:center">
                <input value="${id}" style="width:80px; font-weight:bold; color:var(--accent)" oninput="updateCharacter('${id}', 'id', this.value)">
                <input value="${c.name || ''}" placeholder="Display Name" style="flex:1" oninput="updateCharacter('${id}', 'name', this.value)">
                <span style="cursor:pointer" onclick="deleteCharacter('${id}')">✕</span>
            </div>
            <div style="display:flex; gap:5px; align-items:center; margin-bottom: 5px;">
                <div style="flex:1">
                    ${getDropdownHtml('char_' + id, 'position', ['left', 'center', 'right'], c.position || 'center')}
                </div>
                <button class="btn btn-outline" style="padding:2px 8px; font-size:10px; height:34px" onclick="editSprites('${id}')">🎭 SPRITES</button>
            </div>
            <input value="${c.sfx || ''}" placeholder="Voice SFX URL" oninput="updateCharacter('${id}', 'sfx', this.value)">
            <textarea placeholder="Description (optional)" style="height:40px; font-size:10px" oninput="updateCharacter('${id}', 'description', this.value)">${c.description || ''}</textarea>
        `;
        charList.appendChild(div);
    });

    // Background list removed as redundant
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
        storyDialogue: dialogue
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
            if (!data.storyDialogue) throw new Error("Missing storyDialogue array");

            this.store.pushSnapshot(); // Make import undoable
            
            store.nodes = [];
            store.links = [];
            workspace.innerHTML = '';
            
            // Load global config
            store.config = { ...store.config, ...data };
            delete store.config.storyDialogue;
            
            // Load nodes
            data.storyDialogue.forEach((d, i) => {
                let charId = d.character;
                let spriteState = 'neutral';
                
                // Handle Name:State format from exporter
                if (charId && charId.includes(':')) {
                    [charId, spriteState] = charId.split(':');
                }

                const node = {
                    id: d.id || `node_${i}`,
                    type: d.choices ? 'choice' : (d.type === 'condition' ? 'condition' : 'dialogue'),
                    x: d.x || (100 + (i % 5) * 300),
                    y: d.y || (100 + Math.floor(i / 5) * 350),
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

            // Re-create links
            data.storyDialogue.forEach((d, i) => {
                const fromId = d.id || `node_${i}`;
                if (d.nextId) {
                    store.links.push({ fromNode: fromId, fromPort: 'out', toNode: d.nextId, toPort: 'in' });
                }
                if (d.choices) {
                    d.choices.forEach((c, cIdx) => {
                        if (c.nextId) {
                            store.links.push({ fromNode: fromId, fromPort: `choice_${cIdx}`, toNode: c.nextId, toPort: 'in' });
                        }
                    });
                }
                if (d.branches) {
                    Object.entries(d.branches).forEach(([key, target]) => {
                        if (target) {
                            const portName = key.charAt(0).toUpperCase() + key.slice(1);
                            store.links.push({ fromNode: fromId, fromPort: `branch_${portName}`, toNode: target, toPort: 'in' });
                        }
                    });
                }
            });

            store.emit('nodes_changed');
            showToast("Import Successful");
        } catch (err) {
            console.error("Import failed", err);
            showToast("Invalid Story File: " + err.message, "error");
        }
    };
    reader.readAsText(file);
}

init();
