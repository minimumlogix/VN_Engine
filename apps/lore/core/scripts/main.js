// Global variables
let page3Element = null;
let pages = null;
let currentPage = 0;
let isScrolling = false;

// --- DATA FETCHING & ENTRY POINT ---
window.addEventListener('load', () => {
    // Initialize modal listeners
    const closeModal = document.querySelector('.close-modal');
    if (closeModal) {
        closeModal.onclick = hideImageModal;
    }
    const modal = document.getElementById('image-modal');
    if (modal) {
        modal.onclick = (event) => { if (event.target === modal) hideImageModal(); }
    }

    // Initial animation
    gsap.from("#animated-text", { duration: 2, opacity: 0, y: 50, ease: "power3.out" });

    // Fetch data
    const params = new URLSearchParams(window.location.search);
    const worldName = params.get('world') || 'Etherealis';
    const dataUrl = `./worlds/${worldName}/world.json`;

    fetch(dataUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error(`Network response was not ok: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            initializeWidget(data);
        })
        .catch(error => {
            console.error('Error loading world data:', error);
            showErrorMessage();
        });
});
