let canvasItems = [];
let currentType = null;

const CACHE_KEY = 'nexus_intro_architect_state';

function saveToCache() {
    const state = {
        canvasItems,
        theme: document.getElementById('global-theme-select').value
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
}

function loadFromCache() {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        try {
            const state = JSON.parse(cached);
            canvasItems = state.canvasItems || [];
            if (state.theme) {
                document.getElementById('global-theme-select').value = state.theme;
                updateTheme();
            }
            renderCanvas();
            updateCodeView();
            showToast('Previous project restored from cache!');
        } catch (e) {
            console.error('Failed to load cache:', e);
        }
    }
}

function clearCache() {
    if (confirm('Are you sure you want to delete the cached project? This cannot be undone.')) {
        localStorage.removeItem(CACHE_KEY);
        canvasItems = [];
        renderCanvas();
        updateCodeView();
        showToast('Cache cleared.');
    }
}

window.onload = loadFromCache;

function updateTheme() {
    const theme = document.getElementById('global-theme-select').value;
    document.getElementById('dynamic-theme').href = `styles/${theme}`;
    updateCodeView();
    saveToCache();
}

function switchTab(tab) {
    const live = document.getElementById('canvas-live');
    const code = document.getElementById('canvas-code-container');
    const buttons = document.querySelectorAll('.tab-btn');
    
    if (tab === 'live') {
        live.style.display = 'flex';
        code.style.display = 'none';
        buttons[0].classList.add('active');
        buttons[1].classList.remove('active');
    } else {
        live.style.display = 'none';
        code.style.display = 'block';
        buttons[0].classList.remove('active');
        buttons[1].classList.add('active');
        updateCodeView();
    }
}

function updateCodeView() {
    const gutter = document.querySelector('.code-gutter');
    const content = document.querySelector('.code-content');
    if (content) {
        const rawHtml = generateFullHTML(false);
        const highlighted = highlightHTML(rawHtml);
        content.innerHTML = highlighted;
        
        // Update line numbers
        const lineCount = rawHtml.split('\n').length;
        gutter.innerHTML = Array.from({length: lineCount}, (_, i) => i + 1).join('<br>');
    }
}

function highlightHTML(html) {
    // Escape HTML special characters
    let escaped = html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // 1. Highlight Comments: <!-- ... -->
    escaped = escaped.replace(/(&lt;!--[\s\S]*?--&gt;)/g, '<span class="hl-comm">$1</span>');

    // 2. Highlight Tags and Attributes
    // This regex looks for &lt;tag ... &gt; or &lt;/tag&gt;
    // We use a replacement function to avoid matching our own <span> tags
    return escaped.replace(/(&lt;\/?[a-z1-6]+)(.*?)(&gt;)/gi, (match, tagStart, content, tagEnd) => {
        // Highlight the tag name part
        let highlightedTag = tagStart.replace(/(&lt;\/?)([a-z1-6]+)/i, '$1<span class="hl-tag">$2</span>');
        
        // Highlight attributes within the tag content
        let highlightedContent = content.replace(/([a-z-]+)=("[^"]*")/gi, 
            ' <span class="hl-attr">$1</span>=<span class="hl-str">$2</span>');
            
        return highlightedTag + highlightedContent + tagEnd;
    });
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.style = 'position:fixed; bottom:30px; left:50%; transform:translateX(-50%); background:var(--accent); color:#000; padding:12px 25px; border-radius:30px; font-weight:800; font-size:13px; z-index:2000; box-shadow:0 10px 30px rgba(0,243,255,0.4); animation: toast-in 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);';
    toast.innerText = message;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'modal-in 0.3s reverse forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

const FORM_TEMPLATES = {
    'music': [
        { label: 'YouTube URL', id: 'yt-url', type: 'text', placeholder: 'https://www.youtube.com/watch?v=...' }
    ],
    'character': [
        { label: 'Character Name', id: 'char-name', type: 'text', placeholder: 'e.g. Jax' },
        { label: 'Sprite Image URL', id: 'sprite-url', type: 'text', placeholder: 'https://.../character.png' },
        { label: 'Background Image URL', id: 'bg-url', type: 'text', placeholder: 'https://.../bg.png' }
    ],
    'vn-iframe': [
        { label: 'Story ID / URL', id: 'story-id', type: 'text', placeholder: 'Sakuragaoka:VN1' },
        { label: 'Height (px)', id: 'iframe-height', type: 'number', value: 450 }
    ],
    'dialogue': [
        { label: 'Dialogue Text', id: 'dialogue-text', type: 'textarea', placeholder: 'Enter your cinematic intro text...' }
    ],
    'lore': [
        { label: 'Lore World / Link', id: 'lore-link', type: 'text', placeholder: 'Cyberpunk2011' },
        { label: 'Height (px)', id: 'lore-height', type: 'number', value: 400 }
    ]
};

function openComponentModal(type) {
    currentType = type;
    const fields = FORM_TEMPLATES[type];
    const container = document.getElementById('form-fields');
    const title = document.getElementById('modal-title');
    const addBtn = document.getElementById('add-char-btn');
    
    title.innerText = `CONFIGURE ${type.replace('-', ' ').toUpperCase()}`;
    container.innerHTML = '';
    
    if (type === 'character') {
        addBtn.style.display = 'block';
        const bgGroup = createFieldGroup({ label: 'Background Image URL', id: 'bg-url', type: 'text', placeholder: 'https://.../bg.png' });
        container.appendChild(bgGroup);
        addCharacterRow();
    } else {
        addBtn.style.display = 'none';
        fields.forEach(field => {
            const group = createFieldGroup(field);
            container.appendChild(group);
            
            // Add listeners for rich text
            if (field.type === 'textarea') {
                const textarea = group.querySelector('textarea');
                textarea.addEventListener('mouseup', handleTextSelection);
                textarea.addEventListener('keyup', handleTextSelection);
                textarea.addEventListener('blur', () => {
                    setTimeout(() => {
                        if (document.activeElement !== textarea) {
                            document.getElementById('rich-text-toolbar').style.display = 'none';
                        }
                    }, 200);
                });
            }
        });
    }
    
    document.getElementById('config-modal').style.display = 'flex';
}

function createFieldGroup(field) {
    const group = document.createElement('div');
    group.className = 'form-group';
    
    const label = document.createElement('label');
    label.innerText = field.label;
    
    let input;
    if (field.type === 'textarea') {
        input = document.createElement('textarea');
        input.rows = 4;
    } else {
        input = document.createElement('input');
        input.type = field.type;
        if (field.value) input.value = field.value;
    }
    
    input.id = field.id;
    input.placeholder = field.placeholder || '';
    
    group.appendChild(label);
    group.appendChild(input);
    return group;
}

function addCharacterRow(name = '', sprite = '') {
    const container = document.getElementById('form-fields');
    const row = document.createElement('div');
    row.className = 'char-row';
    row.innerHTML = `
        <button type="button" class="remove-char" onclick="this.parentElement.remove()">×</button>
        <div class="form-group">
            <label>Character Name</label>
            <input type="text" class="char-name" value="${name}" placeholder="e.g. Jax">
        </div>
        <div class="form-group">
            <label>Sprite Image URL</label>
            <input type="text" class="char-sprite" value="${sprite}" placeholder="https://.../sprite.png">
        </div>
    `;
    container.appendChild(row);
}

/* --- RICH TEXT LOGIC --- */
function handleTextSelection(e) {
    const textarea = e.target;
    const toolbar = document.getElementById('rich-text-toolbar');
    
    if (textarea.selectionStart !== textarea.selectionEnd) {
        const { left, top } = textarea.getBoundingClientRect();
        toolbar.style.display = 'flex';
        toolbar.style.left = `${left}px`;
        toolbar.style.top = `${top - 50}px`;
    } else {
        toolbar.style.display = 'none';
    }
}

function applyFormat(type, value) {
    const textarea = document.querySelector('#form-fields textarea');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    let newText = selectedText;

    switch(type) {
        case 'bold': newText = `**${selectedText}**`; break;
        case 'italic': newText = `*${selectedText}*`; break;
        case 'color': newText = `<span style="color:${value}">${selectedText}</span>`; break;
        case 'shadow': newText = `<span style="text-shadow: 2px 2px 4px rgba(0,0,0,0.5)">${selectedText}</span>`; break;
    }

    textarea.value = textarea.value.substring(0, start) + newText + textarea.value.substring(end);
    textarea.focus();
    textarea.setSelectionRange(start, start + newText.length);
}

function parseMarkdown(text) {
    if (!text) return '';
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^---$/gm, '<hr>')
        .replace(/\n/g, '<br>');
}

function closeModal() {
    document.getElementById('config-modal').style.display = 'none';
}

function extractYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : null;
}

function saveComponent() {
    const itemData = { type: currentType, id: Date.now() };
    
    if (currentType === 'character') {
        itemData['bg-url'] = document.getElementById('bg-url').value;
        itemData.characters = [];
        const rows = document.querySelectorAll('.char-row');
        rows.forEach(row => {
            itemData.characters.push({
                name: row.querySelector('.char-name').value,
                sprite: row.querySelector('.char-sprite').value
            });
        });
    } else {
        const fields = FORM_TEMPLATES[currentType];
        fields.forEach(field => {
            itemData[field.id] = document.getElementById(field.id).value;
        });
    }

    if (currentType === 'music') {
        const ytId = extractYoutubeId(itemData['yt-url']);
        if (!ytId) {
            alert('Invalid YouTube URL');
            return;
        }
        itemData.ytId = ytId;
    }

    canvasItems.push(itemData);
    renderCanvas();
    updateCodeView();
    saveToCache();
    closeModal();
}

function renderCanvas() {
    const canvas = document.getElementById('canvas-live');
    const emptyState = document.getElementById('empty-state');
    
    // Clear current canvas (except empty state)
    const items = canvas.querySelectorAll('.canvas-item');
    items.forEach(i => i.remove());
    
    if (canvasItems.length > 0) {
        emptyState.style.display = 'none';
    } else {
        emptyState.style.display = 'block';
    }
    
    canvasItems.forEach((item, index) => {
        const el = document.createElement('div');
        el.className = 'canvas-item';
        el.innerHTML = `
            <div class="item-label">${item.type.replace('-', ' ')}</div>
            <div class="item-controls">
                <button class="control-btn" onclick="moveItem(${index}, -1)"><i class="bi bi-chevron-up"></i></button>
                <button class="control-btn" onclick="moveItem(${index}, 1)"><i class="bi bi-chevron-down"></i></button>
                <button class="control-btn delete" onclick="removeItem(${index})"><i class="bi bi-trash"></i></button>
            </div>
            <div class="item-preview">
                ${getPreviewHTML(item)}
            </div>
        `;
        canvas.appendChild(el);
    });
}

function getPreviewHTML(item) {
    switch(item.type) {
        case 'music':
            return `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/music/mw?v=${item.ytId}&c=d66c00&vol=100&autoplay=1" style="width:100%;height:75px;border:none"></iframe>`;
        case 'character':
            let charHtml = `<div class="vn-character-container" style="background-image:url(${item['bg-url']})">`;
            (item.characters || []).forEach(char => {
                charHtml += `
                    <div class="vn-character-group">
                        <div class="vn-character-name">${char.name}</div>
                        <img alt="${char.name}" class="speaking vn-character" src="${char.sprite}">
                    </div>`;
            });
            charHtml += `</div>`;
            return charHtml;
        case 'vn-iframe':
            return `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine?story=${item['story-id']}" style="width:100%;height:${item['iframe-height']}px;border:none"></iframe>`;
        case 'dialogue':
            return `
                <div class="vn-dialogue-box">
                    <div class="vn-dialogue-content">
                        <div class="vn-dialogue-text"></div>
                        ${item['dialogue-text'].replace(/\n/g, '<br>')}
                    </div>
                </div>`;
        case 'lore':
            return `
                <details class="vn-lore-details" open>
                    <summary class="vn-lore-summary">
                        <span>Lore Database</span>
                        <svg class="vn-lore-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg>
                    </summary>
                    <div class="vn-lore-content">
                        <iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/lore?world=${item['lore-link']}" style="width:100%;height:${item['lore-height']}px;border:none;border-radius: 5px;"></iframe>
                    </div>
                </details>`;
        default:
            return '';
    }
}

function removeItem(index) {
    canvasItems.splice(index, 1);
    renderCanvas();
    updateCodeView();
    saveToCache();
}

function moveItem(index, direction) {
    const newIndex = index + direction;
    if (newIndex >= 0 && newIndex < canvasItems.length) {
        const temp = canvasItems[index];
        canvasItems[index] = canvasItems[newIndex];
        canvasItems[newIndex] = temp;
        renderCanvas();
        updateCodeView();
        saveToCache();
    }
}

function clearCanvas() {
    if (confirm('Are you sure you want to clear everything?')) {
        canvasItems = [];
        renderCanvas();
        updateCodeView();
        saveToCache();
    }
}

function generateFullHTML(minified) {
    const theme = document.getElementById('global-theme-select').value;
    let html = `<!-- Generated by Nexus Intro Architect -->\n`;
    html += `<link href="https://minimumlogix.github.io/VN_Engine/apps/single_vn/styles/${theme}" rel="stylesheet">\n\n`;
    
    canvasItems.forEach(item => {
        switch(item.type) {
            case 'music':
                html += `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/music/mw?v=${item.ytId}&c=d66c00&vol=100&autoplay=1" style="width:100%;height:75px;border:none"></iframe>\n`;
                break;
            case 'character':
                html += `<div class="vn-character-container" style="background-image:url(${item['bg-url']})">`;
                (item.characters || []).forEach(char => {
                    html += `<div class="vn-character-group"><div class="vn-character-name">${char.name}</div><img alt="${char.name}" class="speaking vn-character" src="${char.sprite}"></div>`;
                });
                html += `</div>\n`;
                break;
            case 'vn-iframe':
                html += `<iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine?story=${item['story-id']}" style="width:100%;height:${item['iframe-height']}px;border:none"></iframe>\n`;
                break;
            case 'dialogue':
                html += `<div class="vn-dialogue-box"><div class="vn-dialogue-content"><div class="vn-dialogue-text"></div>${item['dialogue-text'].replace(/\n/g, '<br>')}</div></div>\n`;
                break;
            case 'lore':
                html += `<details class="vn-lore-details"><summary class="vn-lore-summary"><span>Lore Database</span><svg class="vn-lore-icon" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" /></svg></summary><div class="vn-lore-content"><iframe allow="autoplay; encrypted-media" src="https://minimumlogix.github.io/VN_Engine/apps/lore?world=${item['lore-link']}" style="width:100%;height:${item['lore-height']}px;border:none;border-radius: 5px;"></iframe></div></details>\n`;
                break;
        }
    });

    if (minified) {
        return html.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();
    }
    return html;
}

function copyMinifiedCode() {
    const code = generateFullHTML(true);
    
    // Modern approach
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(() => {
            showToast('Minified code copied to clipboard!');
        }).catch(err => {
            console.error('Clipboard error:', err);
            fallbackCopyTextToClipboard(code);
        });
    } else {
        fallbackCopyTextToClipboard(code);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    
    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast('Minified code copied (fallback)!');
        } else {
            showToast('Unable to copy code.');
        }
    } catch (err) {
        showToast('Fallback: Oops, unable to copy');
    }

    document.body.removeChild(textArea);
}

// ASSET LIBRARY LOGIC
const SAMPLE_ASSETS = {
    bg: [
        { name: 'Neon Alley', url: 'https://minimumlogix.github.io/VN_Engine/stories/earth_002/assets/images/backgrounds/bg1.png' },
        { name: 'Control Room', url: 'https://minimumlogix.github.io/VN_Engine/stories/earth_002/assets/images/backgrounds/bg2.png' }
    ],
    char: [
        { name: 'Jax (Neutral)', url: 'https://minimumlogix.github.io/VN_Engine/stories/earth_002/assets/images/characters/Jax.png' },
        { name: 'Luna', url: 'https://minimumlogix.github.io/VN_Engine/stories/earth_002/assets/images/characters/Luna.png' }
    ],
    music: [
        { name: 'Cyberpunk Theme', url: 'https://www.youtube.com/watch?v=Pz287bSmJnU' },
        { name: 'Relaxing Lo-Fi', url: 'https://www.youtube.com/watch?v=5qap5aO4i9A' }
    ]
};

function openAssetLibrary() {
    document.getElementById('asset-modal').style.display = 'flex';
    showAssetTab('bg');
}

function closeAssetLibrary() {
    document.getElementById('asset-modal').style.display = 'none';
}

function showAssetTab(tab) {
    const container = document.getElementById('asset-tab-content');
    container.innerHTML = '';
    
    SAMPLE_ASSETS[tab].forEach(asset => {
        const item = document.createElement('div');
        item.style = 'display:flex; justify-content:space-between; align-items:center; padding:12px; background:rgba(255,255,255,0.05); border-radius:8px; margin-bottom:8px;';
        item.innerHTML = `
            <div>
                <b style="color:var(--accent);">${asset.name}</b><br>
                <small style="opacity:0.6; font-size:10px;">${asset.url}</small>
            </div>
            <button class="btn-outline" style="padding:5px 10px; font-size:10px;" onclick="copyToClipboard('${asset.url}')">COPY URL</button>
        `;
        container.appendChild(item);
    });
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('URL copied to clipboard!');
    });
}
