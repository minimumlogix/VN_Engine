// Global Tab History Cache
let tabHistories = {};

// Custom marked renderer for lore glossary tooltips & links
const renderer = {
    link(href, title, text) {
        if (href.startsWith('tab-') || href.startsWith('detail-')) {
            return `<a href="${href}" class="lore-link" data-tooltip="${title || ''}" onclick="handleLoreNavigation(event, '${href}')">${text}</a>`;
        }
        return `<a href="${href}" target="_blank" ${title ? `title="${title}"` : ''}>${text}</a>`;
    }
};
if (typeof marked !== 'undefined' && marked.use) {
    marked.use({ renderer });
}

window.handleLoreNavigation = function(event, href) {
    if (event) event.preventDefault();
    if (href.startsWith('tab-')) {
        const tabId = href;
        const btn = document.querySelector(`.tablinks[onclick*="${tabId}"]`);
        if (btn) {
            btn.click();
        }
    } else if (href.startsWith('detail-')) {
        const parts = href.split('-');
        const key = parts[1];
        const entryIdx = parseInt(parts[2], 10);

        const btn = document.querySelector(`.tablinks[onclick*="tab-${key}"]`);
        if (btn) {
            btn.click();
        }

        if (typeof window.navigateToDetail === 'function') {
            window.navigateToDetail(key, entryIdx);
        }
    }
};

// --- DYNAMIC CONTENT GENERATION ---
function generateTabsAndContent(data) {
    const tabContainer = document.getElementById('main-tabs');
    const contentContainer = document.getElementById('main-tab-content');
    tabContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    tabHistories = {};

    Object.keys(data).forEach(key => {
        if (key !== 'worldSummary' && key !== 'outro') {
            const item = data[key];
            const tabId = `tab-${key}`;
            const button = document.createElement('button');
            button.className = 'tablinks';
            button.innerHTML = item.icon + `<span class="tooltip">${item.title}</span>`;
            button.onclick = (event) => openTab(event, tabId);
            tabContainer.appendChild(button);

            const contentDiv = document.createElement('div');
            contentDiv.id = tabId;
            contentDiv.className = 'tabcontent';

            if (key === 'timeline') {
                let timelineHTML = `<div class="timeline-container">
                                    <div class="timeline-header">
                                        <h1>${item.title}</h1>
                                        <h2>Key Events & Milestones</h2>
                                    </div>
                                    <div class="timeline">`;
                item.entries.forEach(event => {
                    timelineHTML += `<div class="timeline-item active">
                                    <div class="timeline-content">
                                        <div class="timeline-year">${event.year}</div>
                                        ${event.image ? `<img src="${event.image}" alt="${event.year}" class="timeline-image" onerror="this.onerror=null;this.src='https://placehold.co/400x200/000000/ffffff?text=Image+Not+Found';">` : ''}
                                        <div class="timeline-description">${marked.parse(event.description)}</div>
                                    </div>
                                </div>`;
                });
                timelineHTML += `</div></div>`;
                contentDiv.innerHTML = timelineHTML;
            } else {
                tabHistories[key] = {
                    stack: [{ type: 'main', item: item }],
                    cursor: 0
                };
                renderTabState(key, tabHistories[key].stack[0], contentDiv);
            }
            contentContainer.appendChild(contentDiv);
        }
    });

    const page3 = document.getElementById('page3');
    if (data.outro && page3) {
        page3.innerHTML = `<div class="outro-container">
                                <h1>${data.outro.title}</h1>
                                <p>${data.outro.description}</p>
                                <a href="${data.outro.discordLink}" target="_blank" class="discord-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-discord" viewBox="0 0 16 16"><path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/></svg>

                                    Join Discord Server
                                </a>
                            </div>`;
    }
}

function renderTabState(key, state, contentDiv) {
    if (!contentDiv) {
        contentDiv = document.getElementById(`tab-${key}`);
    }
    if (!contentDiv) return;

    contentDiv.innerHTML = '';

    const history = tabHistories[key];
    const toolbar = document.createElement('div');
    toolbar.className = 'tab-nav-toolbar';
    toolbar.innerHTML = `
        <div class="toolbar-left">
            <button class="nav-btn back-btn" ${history.cursor === 0 ? 'disabled' : ''} onclick="goBack('${key}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
        </div>
        <div class="toolbar-center">
            <button class="nav-btn home-btn" ${history.cursor === 0 ? 'disabled' : ''} onclick="goHome('${key}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
            </button>
        </div>
        <div class="toolbar-right">
            <button class="nav-btn fwd-btn" ${history.cursor === history.stack.length - 1 ? 'disabled' : ''} onclick="goForward('${key}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
            </button>
        </div>
    `;
    contentDiv.appendChild(toolbar);

    const stateContainer = document.createElement('div');
    stateContainer.className = 'tab-state-container';

    if (state.type === 'main') {
        let innerHTML = `<h3>${state.item.title}</h3>`;
        if (state.item.content) innerHTML += marked.parse(state.item.content);
        if (state.item.description) innerHTML += marked.parse(`<em>${state.item.description}</em>`);

        if (state.item.subTabs) {
            innerHTML += `<div class="cards-grid">`;
            Object.keys(state.item.subTabs).forEach(subKey => {
                const subTab = state.item.subTabs[subKey];
                innerHTML += `
                    <div class="card subtab-card" onclick="openSubTabToDetail('${key}', '${subKey}')">
                        <div class="card-image-wrapper">
                            <img src="${subTab.image || 'https://placehold.co/400x500/000000/ffffff?text=' + subTab.title.replace(/\s+/g, '+')}" alt="${subTab.title}" onerror="this.onerror=null;this.src='https://placehold.co/400x500/000000/ffffff?text=Image+Not+Found';">
                        </div>
                        <div class="card-label">
                            ‹ ${subTab.title} ›
                        </div>
                    </div>
                `;
            });
            innerHTML += `</div>`;
        } else if (state.item.subtypes || state.item.entries) {
            const entries = state.item.subtypes || state.item.entries;
            innerHTML += `<div class="cards-grid">`;
            entries.forEach((entry, idx) => {
                innerHTML += `
                    <div class="card entry-card" onclick="navigateToDetail('${key}', ${idx})">
                        <div class="card-image-wrapper">
                            <img src="${entry.image || 'https://placehold.co/400x500/000000/ffffff?text=' + entry.name.replace(/\s+/g, '+')}" alt="${entry.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x500/000000/ffffff?text=Image+Not+Found';">
                        </div>
                        <div class="card-label">
                            ‹ ${entry.name} ›
                        </div>
                    </div>
                `;
            });
            innerHTML += `</div>`;
        }
        stateContainer.innerHTML = innerHTML;
    } else if (state.type === 'detail') {
        const entry = state.entry;
        let innerHTML = `
            <div class="entry-detail-view">
                <div class="detail-header">
                    <h2>‹ ${entry.name || entry.title} ›</h2>
                </div>
                <div class="detail-content-grid">
                    <div class="detail-text-side">
                        ${entry.description ? marked.parse(entry.description) : ''}
                        ${entry.content ? marked.parse(entry.content) : ''}
                        
                        ${entry.importantPlaces ? `
                            <div class="important-places-section">
                                <h5>Important Places:</h5>
                                <ul>${entry.importantPlaces.map(p => `<li><strong>${p.name}:</strong> ${marked.parseInline(p.description)}</li>`).join('')}</ul>
                            </div>
                        ` : ''}
                    </div>
                    ${entry.image ? `
                    <div class="detail-image-side">
                        <img src="${entry.image}" alt="${entry.name || entry.title}" onerror="this.onerror=null;this.src='https://placehold.co/400x500/000000/ffffff?text=Image+Not+Found';" onclick="showImageModal('${entry.image}')">
                    </div>
                    ` : ''}
                </div>
        `;

        if (entry.subRaces && entry.subRaces.length > 0) {
            innerHTML += `<h3 class="detail-sub-header">Sub-Races</h3>`;
            innerHTML += `<div class="cards-grid">`;
            entry.subRaces.forEach((subRace, idx) => {
                innerHTML += `
                    <div class="card entry-card" onclick="navigateToSubDetail('${key}', ${idx})">
                        <div class="card-image-wrapper">
                            <img src="${subRace.image || 'https://placehold.co/400x500/000000/ffffff?text=' + subRace.name.replace(/\s+/g, '+')}" alt="${subRace.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x500/000000/ffffff?text=Image+Not+Found';">
                        </div>
                        <div class="card-label">
                            ‹ ${subRace.name} ›
                        </div>
                    </div>
                `;
            });
            innerHTML += `</div>`;
        }

        if (entry.subtypes && entry.subtypes.length > 0) {
            innerHTML += `<h3 class="detail-sub-header">Sub-Categories</h3>`;
            innerHTML += `<div class="cards-grid">`;
            entry.subtypes.forEach((subCategory, idx) => {
                innerHTML += `
                    <div class="card entry-card" onclick="navigateToSubCategoryDetail('${key}', ${idx})">
                        <div class="card-image-wrapper">
                            <img src="${subCategory.image || 'https://placehold.co/400x500/000000/ffffff?text=' + subCategory.name.replace(/\s+/g, '+')}" alt="${subCategory.name}" onerror="this.onerror=null;this.src='https://placehold.co/400x500/000000/ffffff?text=Image+Not+Found';">
                        </div>
                        <div class="card-label">
                            ‹ ${subCategory.name} ›
                        </div>
                    </div>
                `;
            });
            innerHTML += `</div>`;
        }

        innerHTML += `</div>`;
        stateContainer.innerHTML = innerHTML;
    }
    contentDiv.appendChild(stateContainer);
    
    // Initialize custom scrollbar for the new state content
    initCustomScrollbar(contentDiv);
}

// Global scope bindings for navigation events
window.goBack = function(key) {
    const history = tabHistories[key];
    if (history && history.cursor > 0) {
        history.cursor--;
        renderTabState(key, history.stack[history.cursor]);
    }
};

window.goHome = function(key) {
    const history = tabHistories[key];
    if (history && history.cursor > 0) {
        history.cursor = 0;
        history.stack = [history.stack[0]];
        renderTabState(key, history.stack[0]);
    }
};

window.goForward = function(key) {
    const history = tabHistories[key];
    if (history && history.cursor < history.stack.length - 1) {
        history.cursor++;
        renderTabState(key, history.stack[history.cursor]);
    }
};

window.navigateToDetail = function(key, entryIdx) {
    const history = tabHistories[key];
    const item = history.stack[0].item;
    const entries = item.subtypes || item.entries;
    const entry = entries[entryIdx];
    
    history.stack = history.stack.slice(0, history.cursor + 1);
    history.stack.push({ type: 'detail', entry: entry });
    history.cursor++;
    renderTabState(key, history.stack[history.cursor]);
};

window.openSubTabToDetail = function(key, subKey) {
    const history = tabHistories[key];
    const item = history.stack[0].item;
    const subTab = item.subTabs[subKey];
    
    history.stack = history.stack.slice(0, history.cursor + 1);
    history.stack.push({ type: 'detail', entry: subTab });
    history.cursor++;
    renderTabState(key, history.stack[history.cursor]);
};

window.navigateToSubDetail = function(key, subIdx) {
    const history = tabHistories[key];
    const currentDetail = history.stack[history.cursor].entry;
    const subRace = currentDetail.subRaces[subIdx];
    
    history.stack = history.stack.slice(0, history.cursor + 1);
    history.stack.push({ type: 'detail', entry: subRace });
    history.cursor++;
    renderTabState(key, history.stack[history.cursor]);
};

window.navigateToSubCategoryDetail = function(key, subIdx) {
    const history = tabHistories[key];
    const currentDetail = history.stack[history.cursor].entry;
    const subCategory = currentDetail.subtypes[subIdx];
    
    history.stack = history.stack.slice(0, history.cursor + 1);
    history.stack.push({ type: 'detail', entry: subCategory });
    history.cursor++;
    renderTabState(key, history.stack[history.cursor]);
};
