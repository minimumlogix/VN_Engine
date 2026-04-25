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
            }
        }
        return false;
    }

    clearAutosave() {
        localStorage.removeItem(this.autoSaveKey);
        location.reload();
    }

    // --- Node Operations ---
    addNode(type, x, y) {
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
        this.nodes = this.nodes.filter(n => n.id !== id);
        this.links = this.links.filter(l => l.fromNode !== id && l.toNode !== id);
        this.emit('nodes_changed');
    }

    updateNodeData(id, field, value) {
        const node = this.nodes.find(n => n.id === id);
        if (node) {
            node.data[field] = value;
            this.emit('node_data_updated', { id, field });
        }
    }

    updateNodePos(id, x, y) {
        const node = this.nodes.find(n => n.id === id);
        if (node) {
            node.x = x;
            node.y = y;
            // No emit here to prevent render loop during drag, 
            // but we save on drag end via other means if needed
        }
    }

    // --- Choice Logic ---
    addChoice(nodeId) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.type === 'choice') {
            node.choices.push({ text: 'New Choice', target: null });
            this.emit('node_refresh', nodeId);
        }
    }

    updateChoice(nodeId, idx, text) {
        const node = this.nodes.find(n => n.id === nodeId);
        if (node && node.choices[idx]) {
            node.choices[idx].text = text;
            this.emit('data_updated');
        }
    }

    // --- Link Operations ---
    createLink(fromNode, fromPort, toNode, toPort) {
        this.links = this.links.filter(l => !(l.fromNode === fromNode && l.fromPort === fromPort));
        this.links.push({ fromNode, fromPort, toNode, toPort });
        this.emit('links_changed');
    }

    // --- Global Config Operations ---
    updateConfig(field, value) {
        this.config[field] = value;
        this.emit('config_updated');
    }

    addStateVar(key = "new_var", val = 0) {
        this.config.initialState[key] = val;
        this.emit('config_refresh');
    }

    deleteStateVar(key) {
        delete this.config.initialState[key];
        this.emit('config_refresh');
    }

    updateStateVar(oldKey, newKey, value) {
        if (oldKey !== newKey) {
            delete this.config.initialState[oldKey];
        }
        this.config.initialState[newKey] = value;
        this.emit('config_refresh');
    }

    addCharacter() {
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
        if (field === 'id') {
            const char = this.config.characters[id];
            delete this.config.characters[id];
            this.config.characters[value] = char;
        } else {
            this.config.characters[id][field] = value;
        }
        this.emit('config_refresh');
    }

    deleteCharacter(id) {
        delete this.config.characters[id];
        this.emit('config_refresh');
    }
}

const store = new NexusDataStore();

let offset = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let zoom = 1;
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
            { name: 'spriteState', label: 'Sprite State (e.g. neutral, stern)', type: 'text' },
            { name: 'text', label: 'Dialogue Text', type: 'textarea' },
            { name: 'chapter', label: 'Chapter', type: 'number' },
            { name: 'scene', label: 'Scene', type: 'number' },
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
    effect: {
        title: "SCREEN EFFECT",
        fields: [
            { name: 'effect', label: 'Macro Effect (Body)', type: 'select', options: ['None', 'shake', 'glitch', 'flash', 'blink', 'electricuted', 'shadows', 'earthquake', 'heartbeat', 'vhs', 'drain', 'nuke', 'bloodsplatter', 'shockwave', 'hologram', 'rage'] },
            { name: 'overlay', label: 'Overlay (Blocking)', type: 'select', options: ['None', 'GLITCH', 'ELECTROCUTED', 'NUKE', 'SHOCKWAVE', 'PORTAL'] },
            { name: 'intensity', label: 'Intensity (1-3)', type: 'number' }
        ],
        ports: { in: true, out: true }
    },
    condition: {
        title: "VARIABLE CHECK",
        fields: [
            { name: 'variable', label: 'Variable', type: 'select', options: 'state' },
            { name: 'operator', label: 'Operator', type: 'select', options: ['>', '<', '==', '>=', '<=', '!='] },
            { name: 'value', label: 'Value', type: 'number' }
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

    renderAllNodes();
    renderConfig();
    requestAnimationFrame(tick);

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
        const port = e.target.closest('.port');
        if (port && port.classList.contains('port-in')) {
            const targetNodeId = port.closest('.node').dataset.id;
            createLink(activeLink.fromNode, activeLink.fromPort, targetNodeId, 'in');
        }
        activeLink = null;
        needsRender = true;
    }
}

function handleWheel(e) {
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    zoom = Math.min(Math.max(0.2, zoom * delta), 3);
    needsRender = true;
}

// --- NODE LOGIC ---

function addNode(type, x = 0, y = 0) {
    store.addNode(type, x, y);
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
    typeDef.fields.forEach(f => {
        fieldsHtml += `<label>${f.label}</label>`;
        if (f.type === 'textarea') {
            fieldsHtml += `<textarea oninput="store.updateNodeData('${node.id}', '${f.name}', this.value)">${node.data[f.name] || ''}</textarea>`;
        } else if (f.type === 'select') {
            fieldsHtml += `<select onchange="store.updateNodeData('${node.id}', '${f.name}', this.value)">`;
            let options = f.options;
            if (f.options === 'chars') options = Object.keys(store.config.characters);
            if (f.options === 'state') options = Object.keys(store.config.initialState);
            
            options.forEach(opt => {
                const selected = node.data[f.name] === opt ? 'selected' : '';
                fieldsHtml += `<option value="${opt}" ${selected}>${opt}</option>`;
            });
            fieldsHtml += `</select>`;
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
                    <div class="port port-choice" data-idx="${idx}" onmousedown="startLink(event, '${node.id}', 'choice_${idx}')"></div>
                </div>
            `;
        });
        fieldsHtml += `<button class="btn btn-outline" style="width:100%; margin-top:5px; font-size:10px;" onclick="store.addChoice('${node.id}')">＋ ADD CHOICE</button>`;
    }

    div.innerHTML = `
        <div class="node-header">
            ${typeDef.title}
            <span style="color:var(--text-dim); cursor:pointer" onclick="deleteNode('${node.id}')">✕</span>
        </div>
        <div class="node-content">${fieldsHtml}</div>
        ${typeDef.ports.in ? `<div class="port port-in"></div>` : ''}
        ${typeDef.ports.out ? `<div class="port port-out" onmousedown="startLink(event, '${node.id}', 'out')"></div>` : ''}
        ${typeDef.ports.branches ? typeDef.ports.branches.map((b, i) => `
            <div class="branch-row">
                <span class="branch-label">${b}</span>
                <div class="port port-out branch-port" style="top:${20 + i * 25}px" onmousedown="startLink(event, '${node.id}', 'branch_${b}')"></div>
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
}

function updateNodeData(nodeId, field, value) {
    store.updateNodeData(nodeId, field, value);
}

function deleteNode(id) {
    store.deleteNode(id);
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
        if (fromPos && toPos) drawLink(fromPos, toPos);
    });

    if (activeLink && mouseEvent) {
        const fromPos = getPortPos(activeLink.fromNode, activeLink.fromPort);
        const toPos = { x: mouseEvent.clientX, y: mouseEvent.clientY };
        drawLink(fromPos, toPos);
    }
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

function drawLink(start, end) {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    const dx = Math.abs(end.x - start.x) * 0.5;
    const d = `M ${start.x} ${start.y} C ${start.x + dx} ${start.y} ${end.x - dx} ${end.y} ${end.x} ${end.y}`;
    path.setAttribute("d", d);
    path.setAttribute("class", "connection");
    svg.appendChild(path);
}

// --- CHOICE LOGIC ---

function updateChoice(nodeId, idx, text) {
    store.updateChoice(nodeId, idx, text);
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

function updateGlobalConfig() {
    store.config.storyTitle = document.getElementById('conf-title').value;
    store.config.storySubtitle = document.getElementById('conf-subtitle').value;
    store.config.theme = document.getElementById('conf-theme').value;
    store.config.loadScreenBackground = document.getElementById('conf-loadbg').value;
    store.save();
}

function renderConfig() {
    // Title & Basics
    document.getElementById('conf-title').value = store.config.storyTitle;
    document.getElementById('conf-subtitle').value = store.config.storySubtitle;
    document.getElementById('conf-theme').value = store.config.theme || 'nasapunk.css';
    document.getElementById('conf-loadbg').value = store.config.loadScreenBackground || '';

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
            <div style="display:flex; gap:5px;">
                <select style="flex:1" onchange="updateCharacter('${id}', 'position', this.value)">
                    <option value="left" ${c.position === 'left' ? 'selected' : ''}>Left</option>
                    <option value="center" ${c.position === 'center' ? 'selected' : ''}>Center</option>
                    <option value="right" ${c.position === 'right' ? 'selected' : ''}>Right</option>
                </select>
                <button class="btn btn-outline" style="padding:2px 8px; font-size:10px" onclick="editSprites('${id}')">🎭 SPRITES</button>
            </div>
            <input value="${c.sfx || ''}" placeholder="Voice SFX URL" oninput="updateCharacter('${id}', 'sfx', this.value)">
            <textarea placeholder="Description (optional)" style="height:40px; font-size:10px" oninput="updateCharacter('${id}', 'description', this.value)">${c.description || ''}</textarea>
        `;
        charList.appendChild(div);
    });

    const bgList = document.getElementById('bg-list');
    bgList.innerHTML = '';
    Object.entries(store.config.backgrounds).forEach(([id, url]) => {
        const div = document.createElement('div');
        div.className = 'list-item';
        div.innerHTML = `
            <input value="${id}" style="width:40px" onchange="renameBg('${id}', this.value)">
            <input value="${url}" placeholder="URL" onchange="store.config.backgrounds['${id}'] = this.value; store.save()">
            <span style="cursor:pointer" onclick="deleteBg('${id}')">✕</span>
        `;
        bgList.appendChild(div);
    });
}

function refreshAllNodes() {
    store.nodes.forEach(n => refreshNode(n.id));
}

// --- EXPORT / IMPORT ---

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
            text: node.data.text || ""
        };

        if (node.data.SpriteEffects && node.data.SpriteEffects !== 'None') entry.SpriteEffects = node.data.SpriteEffects;
        if (node.data.persistentEffect) entry.persistentEffect = node.data.persistentEffect;

        if (node.type === 'effect') {
            if (node.data.effect && node.data.effect !== 'None') {
                const intensity = node.data.intensity ? `(${node.data.intensity})` : "";
                entry.text = `[${node.data.effect}${intensity}] ${entry.text}`;
            }
            if (node.data.overlay && node.data.overlay !== 'None') {
                entry.text = `[${node.data.overlay}] ${entry.text}`;
            }
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
            entry.condition = {
                variable: node.data.variable,
                operator: node.data.operator,
                value: node.data.value
            };
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
        const data = JSON.parse(re.target.result);
        store.nodes = [];
        store.links = [];
        workspace.innerHTML = '';
        
        // Load global config
        store.config = { ...store.config, ...data };
        delete store.config.storyDialogue;
        
        // Load nodes
        data.storyDialogue.forEach((d, i) => {
            const node = {
                id: d.id || `node_${i}`,
                type: d.choices ? 'choice' : (d.type === 'condition' ? 'condition' : 'dialogue'),
                x: 100 + (i % 5) * 300,
                y: 100 + Math.floor(i / 5) * 350,
                data: {
                    character: d.character,
                    text: d.text,
                    chapter: d.chapter,
                    scene: d.scene,
                    variable: d.condition?.variable,
                    operator: d.condition?.operator,
                    value: d.condition?.value
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
    };
    reader.readAsText(file);
}

init();
