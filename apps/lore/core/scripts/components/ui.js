// --- UI INTERACTION LOGIC ---

function toggleSubRaces(button, containerId) {
    const container = document.getElementById(containerId);
    const isActive = button.classList.contains('active');

    if (isActive) {
        button.classList.remove('active');
        gsap.to(container, {
            height: 0,
            opacity: 0,
            duration: 0.5,
            ease: 'power2.inOut',
            onComplete: () => {
                container.style.display = 'none';
            }
        });
    } else {
        button.classList.add('active');
        container.style.display = 'block';
        gsap.fromTo(container,
            { height: 0, opacity: 0 },
            { height: 'auto', opacity: 1, duration: 0.5, ease: 'power2.inOut' }
        );
    }
}

function openTab(evt, tabId) {
    document.querySelectorAll(".tabcontent").forEach(tc => tc.style.display = "none");
    document.querySelectorAll(".tablinks").forEach(tl => tl.classList.remove("active"));
    const targetContent = document.getElementById(tabId);
    targetContent.style.display = "block";
    gsap.from(targetContent, { duration: 0.5, opacity: 0, y: 20, ease: "power2.out" });
    evt.currentTarget.classList.add("active");
    
    // Initialize custom scrollbar for the main tab content
    initCustomScrollbar(targetContent);

    const firstSubTab = targetContent.querySelector('.sub-tablinks');
    if (firstSubTab) firstSubTab.click();

}

function openSubTab(evt, subTabId, parentKey) {
    document.querySelectorAll(`.sub-tabcontent-${parentKey}`).forEach(stc => stc.style.display = "none");
    document.querySelectorAll(`#sub-tabs-${parentKey} .sub-tablinks`).forEach(stl => stl.classList.remove("active"));
    const targetContent = document.getElementById(subTabId);
    targetContent.style.display = "block";
    gsap.from(targetContent, { duration: 0.4, opacity: 0, y: 10, ease: "power1.out" });
    evt.currentTarget.classList.add("active");

    // Initialize custom scrollbar for sub-tab content
    initCustomScrollbar(targetContent);

}

function showImageModal(src) {
    const modal = document.getElementById('image-modal');
    const modalImg = document.getElementById('modal-img');
    modal.style.pointerEvents = "auto";
    modal.style.display = "flex";
    modalImg.src = src;
    gsap.fromTo(modal, { opacity: 0 }, { duration: 0.4, opacity: 1, ease: "power2.out" });
}

function hideImageModal() {
    const modal = document.getElementById('image-modal');
    gsap.to(modal, {
        duration: 0.4, opacity: 0, ease: "power2.in", onComplete: () => {
            modal.style.display = "none";
            modal.style.pointerEvents = "none";
        }
    });
}

function smoothScroll(targetIndex) {
    if (isScrolling) return;
    isScrolling = true;
    const container = document.getElementById('container');
    const pages = document.querySelectorAll('.page');
    gsap.to(container, {
        duration: 1,
        scrollTo: { y: pages[targetIndex], autoKill: false },
        ease: "power2.inOut",
        onComplete: () => {
            isScrolling = false;
            currentPage = targetIndex;
            updateNavIcon();
        }
    });
}

function togglePage() { 
    const pages = document.querySelectorAll('.page');
    smoothScroll((currentPage + 1) % pages.length); 
}

function updateNavIcon() {
    const pages = document.querySelectorAll('.page');
    gsap.to("#nav-icon", { duration: 0.5, rotation: currentPage === pages.length - 1 ? 180 : 0, ease: "power2.inOut" });
}

function revealContent() {
    gsap.to('.spoiler-warning', {
        duration: 1, opacity: 0, scale: 1.1, ease: "power2.out", onComplete: () => {
            document.querySelector('.spoiler-warning').style.display = 'none';
            document.getElementById('biography-content').style.display = 'flex';
            gsap.from('#biography-content', { duration: 1, opacity: 0, y: 50, ease: "power3.out" });
            document.querySelector(".tablinks").click();
        }
    });
}

function initCustomScrollbar(container) {
    if (!container) return;
    
    // Remove existing if any
    const existingTrack = container.querySelector('.custom-scrollbar-track');
    if (existingTrack) existingTrack.remove();

    const track = document.createElement('div');
    track.className = 'custom-scrollbar-track';
    const thumb = document.createElement('div');
    thumb.className = 'custom-scrollbar-thumb';
    track.appendChild(thumb);
    container.appendChild(track);

    const updateScrollbar = () => {
        const contentHeight = container.scrollHeight;
        const containerHeight = container.offsetHeight;
        const scrollRange = contentHeight - containerHeight;
        
        if (scrollRange <= 0) {
            track.style.opacity = '0';
            return;
        }
        
        track.style.opacity = '1';
        const thumbHeight = Math.max((containerHeight / contentHeight) * containerHeight, 30);
        thumb.style.height = `${thumbHeight}px`;
        
        const scrollPercent = container.scrollTop / scrollRange;
        const thumbPosition = scrollPercent * (containerHeight - thumbHeight - 20); // 20 for top/bottom margin
        thumb.style.transform = `translateY(${thumbPosition}px)`;
    };

    container.addEventListener('scroll', updateScrollbar);
    window.addEventListener('resize', updateScrollbar);
    
    // Initial update after a small delay to ensure content is rendered
    setTimeout(updateScrollbar, 100);
    
    // Return the update function for manual triggers
    return updateScrollbar;
}

// --- GLOSSARY POPUP TOOLTIP IMPLEMENTATION ---
document.addEventListener('mouseover', (e) => {
    const link = e.target.closest('.lore-link');
    if (!link) return;
    const text = link.getAttribute('data-tooltip');
    if (!text) return;

    let tooltip = document.getElementById('glossary-tooltip');
    if (!tooltip) {
        tooltip = document.createElement('div');
        tooltip.id = 'glossary-tooltip';
        tooltip.className = 'glossary-tooltip';
        document.body.appendChild(tooltip);
    }
    tooltip.innerHTML = text;
    tooltip.style.display = 'block';

    const rect = link.getBoundingClientRect();
    tooltip.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
    tooltip.style.top = `${rect.top + window.scrollY - tooltip.offsetHeight - 10}px`;
    
    // adjust if going off top
    if (rect.top + window.scrollY - tooltip.offsetHeight - 10 < 0) {
        tooltip.style.top = `${rect.bottom + window.scrollY + 10}px`;
    }
});

document.addEventListener('mouseout', (e) => {
    const link = e.target.closest('.lore-link');
    if (!link) return;
    const tooltip = document.getElementById('glossary-tooltip');
    if (tooltip) {
        tooltip.style.display = 'none';
    }
});

