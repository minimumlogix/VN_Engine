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
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" class="bi bi-discord" viewBox="0 0 16 16"><path d="M13.545 2.907a13.2 13.2 0 0 0-3.257-1.011.05.05 0 0 0-.052.025c-.141.25-.297.577-.406.833a12.2 12.2 0 0 0-3.658 0 8 8 0 0 0-.412-.833.05.05 0 0 0-.052-.025c-1.125.194-2.22.534-3.257 1.011a.04.04 0 0 0-.021.018C.356 6.024-.213 9.047.066 12.032q.003.022.021.037a13.3 13.3 0 0 0 3.995 2.02.05.05 0 0 0 .056-.019q.463-.63.818-1.329a.05.05 0 0 0-.01-.059l-.018-.011a9 9 0 0 1-1.248-.595.05.05 0 0 1-.02-.066l.015-.019q.127-.095.248-.195a.05.05 0 0 1 .051-.007c2.619 1.196 5.454 1.196 8.041 0a.05.05 0 0 1 .053.007q.121.1.248.195a.05.05 0 0 1-.004.085 8 8 0 0 1-1.249.594.05.05 0 0 0-.03.03.05.05 0 0 0 .003.041c.24.465.515.909.817 1.329a.05.05 0 0 0 .056.019 13.2 13.2 0 0 0 4.001-2.02.05.05 0 0 0 .021-.037c.334-3.451-.559-6.449-2.366-9.106a.03.03 0 0 0-.02-.019m-8.198 7.307c-.789 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.45.73 1.438 1.613 0 .888-.637 1.612-1.438 1.612m5.316 0c-.788 0-1.438-.724-1.438-1.612s.637-1.613 1.438-1.613c.807 0 1.451.73 1.438 1.613 0 .888-.631 1.612-1.438 1.612"/></svg>

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
