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
            if (currentPage === 2 && page3Element) animateTimeline();
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

function animateTimeline() {
    const items = document.querySelectorAll('#page3 .timeline-item');
    const page3Rect = page3Element ? page3Element.getBoundingClientRect() : { top: 0 };
    const windowHeight = window.innerHeight;
    items.forEach(item => {
        const rect = item.getBoundingClientRect();
        const itemTopRelativeToPage3 = rect.top - page3Rect.top;
        if (itemTopRelativeToPage3 < windowHeight * 0.8) {
            item.classList.add('active');
        }
    });
}
