// --- DATA HANDLING & INITIALIZATION ---

function setPageBackgroundsAndTitle(worldData) {
    const page1 = document.getElementById('page1');
    const animatedText = document.getElementById('animated-text');
    if (worldData.worldSummary.page1Background) {
        page1.style.backgroundImage = `url('${worldData.worldSummary.page1Background}')`;
    }
    document.getElementById('page2').style.backgroundColor = '#000000';
    document.getElementById('page3').style.backgroundColor = '#000000';
    document.getElementById('page4').style.backgroundColor = '#000000';
    if (worldData.worldSummary.animatedTextTitle) {
        animatedText.textContent = worldData.worldSummary.animatedTextTitle;
    }
}

function initializeWidget(worldData) {
    setPageBackgroundsAndTitle(worldData);
    generateTabsAndContent(worldData);

    pages = document.querySelectorAll('.page');
    page3Element = document.getElementById('page3');

    if (page3Element) {
        page3Element.addEventListener('scroll', animateTimeline);
        animateTimeline();
    }

    document.querySelectorAll('.timeline-content').forEach(content => {
        content.addEventListener('mouseenter', function () { gsap.to(this, { duration: 0.2, y: -8, scale: 1.02, ease: "power1.out" }); });
        content.addEventListener('mouseleave', function () { gsap.to(this, { duration: 0.2, y: 0, scale: 1, ease: "power1.out" }); });
    });
}

function showErrorMessage() {
    document.getElementById('container').style.display = 'none';
    document.querySelector('.nav-arrow').style.display = 'none';
    document.getElementById('error-message').style.display = 'flex';
}
