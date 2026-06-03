/**
 * Rewrites YouTube video links on any page to open in a modified YouTube player
 * (yout-ube.com) with custom playback params (autoplay, no overlays, etc).
 *
 * Intercepts clicks at the document level to force links into a new tab using
 * the alternate domain, and continuously patches existing anchor tags so they
 * reflect the updated URLs.
 *
 * Paste in "User JavaScript and CSS" Chrome extension on youtube.com domain.
**/
['click', 'mousedown', 'mouseup'].forEach(type => {
  document.addEventListener(type, (e) => {
    const a = e.target.closest('a[href*="/watch?v="], a[href*="youtube.com/watch?v="]');
    if (!a) return;
    e.stopImmediatePropagation();
    if (type === 'click') {
      e.preventDefault();
      const videoId = a.href.match(/[?&]v=([^&]+)/)?.[1];
      if (videoId) window.open(`https://www.yout-ube.com/watch?v=${videoId}`, '_blank');
    }
  }, true);
});

// Still patch hrefs for visual correctness
setInterval(() => {
  document.querySelectorAll('a[href^="/watch?v="]:not([data-custom-link="true"])').forEach(a => {
    const originalHref = a.getAttribute('href'); // "/watch?v=abc123&t=30"
    const url = new URL(originalHref, 'https://www.yout-ube.com');

    // Add / override params
    url.searchParams.set('autoplay', '1');
    url.searchParams.set('iv_load_policy', '3');
    url.searchParams.set('loop', '0');
    url.searchParams.set('start', '');

    a.href = url.toString();
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.dataset.customLink = 'true';
  });
}, 1000);