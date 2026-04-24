// --- DYNAMIC CONTENT GENERATION ---
function generateTabsAndContent(data) {
    const tabContainer = document.getElementById('main-tabs');
    const contentContainer = document.getElementById('main-tab-content');
    tabContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    Object.keys(data).forEach(key => {
        if (key !== 'worldSummary' && key !== 'timeline' && key !== 'outro') {
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
            let innerHTML = `<h3>${item.title}</h3>`;

            if (item.content) innerHTML += marked.parse(item.content);
            if (item.description) innerHTML += marked.parse(`<em>${item.description}</em>`);

            if (item.subTabs) {
                innerHTML += `<div class="sub-tab" id="sub-tabs-${key}">`;
                Object.keys(item.subTabs).forEach(subKey => {
                    innerHTML += `<button class="sub-tablinks" onclick="openSubTab(event, 'sub-tab-${subKey}', '${key}')">${item.subTabs[subKey].title}</button>`;
                });
                innerHTML += `</div>`;

                Object.keys(item.subTabs).forEach(subKey => {
                    const subTab = item.subTabs[subKey];
                    innerHTML += `<div id="sub-tab-${subKey}" class="sub-tabcontent sub-tabcontent-${key}">`;
                    innerHTML += `<div class="entry">
                                <div class="entry-content">
                                    <h4>${subTab.title}</h4>
                                    ${subTab.content ? marked.parse(subTab.content) : ''}
                                </div>
                                ${subTab.image ? `<div class="entry-image-wrapper"><img src="${subTab.image}" alt="${subTab.title}" onerror="this.onerror=null;this.src='https://placehold.co/300x300/000000/ffffff?text=Image+Not+Found';" onclick="showImageModal('${subTab.image}')"></div>` : ''}
                            </div>`;
                    if (subTab.subtypes && subTab.subtypes.length > 0) {
                        innerHTML += generateSubSubtypeHTML(subTab);
                    }
                    innerHTML += `</div>`;
                });
            } else if (item.subtypes || item.entries) {
                const entries = item.subtypes || item.entries;
                entries.forEach(entry => {
                    innerHTML += `<div class="entry">
                                <div class="entry-content">
                                    <h4>${entry.name}</h4>
                                    ${marked.parse(entry.description)}
                                    ${entry.importantPlaces ? `<h5>Important Places:</h5><ul>${entry.importantPlaces.map(p => `<li><strong>${p.name}:</strong> ${marked.parseInline(p.description)}</li>`).join('')}</ul>` : ''}
                                </div>
                                ${entry.image ? `<div class="entry-image-wrapper"><img src="${entry.image}" alt="${entry.name}" onerror="this.onerror=null;this.src='https://placehold.co/300x300/000000/ffffff?text=Image+Not+Found';" onclick="showImageModal('${entry.image}')"></div>` : ''}
                                ${(entry.subRaces && entry.subRaces.length > 0) ? generateSubRaceHTML(entry) : ''}
                            </div>`;
                });
            }
            contentDiv.innerHTML = innerHTML;
            contentContainer.appendChild(contentDiv);
        }
    });

    const page3 = document.getElementById('page3');
    if (data.timeline && page3) {
        let timelineHTML = `<div class="timeline-container">
                            <div class="timeline-header">
                                <h1>${data.timeline.title}</h1>
                                <h2>Key Events & Milestones</h2>
                            </div>
                            <div class="timeline">`;
        data.timeline.entries.forEach(event => {
            timelineHTML += `<div class="timeline-item">
                            <div class="timeline-content">
                                <div class="timeline-year">${event.year}</div>
                                ${event.image ? `<img src="${event.image}" alt="${event.year}" class="timeline-image" onerror="this.onerror=null;this.src='https://placehold.co/400x200/000000/ffffff?text=Image+Not+Found';">` : ''}
                                <div class="timeline-description">${marked.parse(event.description)}</div>
                            </div>
                        </div>`;
        });
        timelineHTML += `</div></div>`;
        page3.innerHTML = timelineHTML;
    }

    const page4 = document.getElementById('page4');
    if (data.outro && page4) {
        page4.innerHTML = `<div class="outro-container">
                                <h1>${data.outro.title}</h1>
                                <p>${data.outro.description}</p>
                                <a href="${data.outro.discordLink}" target="_blank" class="discord-button">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M20.91 2.31C19.46 1.15 17.81 0.35 16.05 0.05A20.35 20.35 0 0 0 12 0c-4.05 0-7.7 0.8-9.05 2.31-1.45 1.15-2.15 2.75-2.95 4.75-0.8 2-1.2 4.3-1 6.5s0.4 4.3 1.2 6.5c0.8 2 1.5 3.6 2.95 4.75 1.35 1.15 3.05 1.95 4.85 2.25 1.8 0.3 3.6 0.45 5.4 0.45s3.6-0.15 5.4-0.45c1.8-0.3 3.5-1.1 4.85-2.25 1.45-1.15 2.15-2.75 2.95-4.75 0.8-2 1.2-4.3 1-6.5s-0.4-4.3-1.2-6.5c-0.8-2-1.5-3.6-2.95-4.75zM8.5 16.5c-0.83 0-1.5-0.67-1.5-1.5s0.67-1.5 1.5-1.5 1.5 0.67 1.5 1.5-0.67 1.5-1.5 1.5zM15.5 16.5c-0.83 0-1.5-0.67-1.5-1.5s0.67-1.5 1.5-1.5 1.5 0.67 1.5 1.5-0.67 1.5-1.5 1.5zM12 10.5c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>
                                    Join Discord Server
                                </a>
                            </div>`;
    }
}

function generateSubRaceHTML(entry) {
    const subRaceContainerId = `sub-races-${entry.name.replace(/\s+/g, '-')}`;
    let subRaceHTML = `<div class="sub-race-section">
                        <button class="expand-button active" onclick="toggleSubRaces(this, '${subRaceContainerId}')">
                            Show Sub-Races <span class="arrow">&#9660;</span>
                        </button>
                        <div id="${subRaceContainerId}" class="sub-race-container">`;
    entry.subRaces.forEach(subRace => {
        subRaceHTML += `<div class="entry">
                        <div class="entry-content">
                            <h4>${subRace.name}</h4>
                            ${marked.parse(subRace.description)}
                        </div>
                        ${subRace.image ? `<div class="entry-image-wrapper"><img src="${subRace.image}" alt="${subRace.name}" onerror="this.onerror=null;this.src='https://placehold.co/300x300/000000/ffffff?text=Image+Not+Found';" onclick="showImageModal('${subRace.image}')"></div>` : ''}
                    </div>`;
    });
    subRaceHTML += `</div></div>`;
    return subRaceHTML;
}

function generateSubSubtypeHTML(parentEntry) {
    const subSubtypeContainerId = `sub-subtypes-${parentEntry.title.replace(/\s+/g, '-')}`;
    let subSubtypeHTML = `<div class="sub-race-section">
                        <button class="expand-button active" onclick="toggleSubRaces(this, '${subSubtypeContainerId}')">
                            Show Sub-Categories <span class="arrow">&#9660;</span>
                        </button>
                        <div id="${subSubtypeContainerId}" class="sub-race-container">`;
    parentEntry.subtypes.forEach(subSubtype => {
        subSubtypeHTML += `<div class="entry">
                        <div class="entry-content">
                            <h4>${subSubtype.name}</h4>
                            ${marked.parse(subSubtype.description)}
                        </div>
                        ${subSubtype.image ? `<div class="entry-image-wrapper"><img src="${subSubtype.image}" alt="${subSubtype.name}" onerror="this.onerror=null;this.src='https://placehold.co/300x300/000000/ffffff?text=Image+Not+Found';" onclick="showImageModal('${subSubtype.image}')"></div>` : ''}
                    </div>`;
    });
    subSubtypeHTML += `</div></div>`;
    return subSubtypeHTML;
}
