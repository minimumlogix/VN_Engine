/**
 * Enhances youtube-nocookie embed player with comments, stats, custom controls,
 * and cleaner UI. Intended for use via a userscript or injected script on
 * youtube-nocookie.com/embed/* pages.
 *
 * Paste in "User JavaScript and CSS" Chrome extension on youtube-nocookie.com domain.
 */
(function () {
  // ── Loop param cleanup ────────────────────────────────────────────────────
  const url = new URL(window.location.href);
  if (url.searchParams.get('loop') === '1') {
    url.searchParams.delete('loop');
    url.searchParams.delete('playlist');
    window.location.replace(url.toString());
    return;
  }

  const videoId = window.location.pathname.split('/embed/')[1]?.split('?')[0];
  if (!videoId) { console.warn('[yt-ext] No video ID found'); return; }

  const API_KEY = 'REPLACE_WITH_YOUTUBE_API_KEY';

  // ── Styles ────────────────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.id = 'yt-comment-style';
  style.textContent = `
    /* Hide pause overlay */
    .ytp-pause-overlay-container { display: none !important; }

    /* ── Hide unwanted UI elements ── */
    /* "More videos" watch-on-youtube button and its wrapper */
    .watch-on-youtube-button-wrapper,
    player-fullscreen-action-menu,
    .fullscreen-action-menu,
    .ytFullscreenVideoRecommendationsHost { display: none !important; }

    /* Hide anything remaining in top-right that isn't being relocated
       (catches the infinity/loop icon and any other stragglers) */
    .ytwPlayerTopControlsPlayerControlsTopRight > *:not(volume-controls):not(yt-closed-captions-toggle-button):not(#yt-comments-btn) {
      display: none !important;
    }
    /* Once volume/CC have been moved away the top-right wrapper can vanish */
    .ytwPlayerTopControlsPlayerControlsTopRight:empty { display: none !important; }

    /* Hide our bottom bar when in fullscreen */
    :fullscreen .player-controls-bottom,
    :-webkit-full-screen .player-controls-bottom {
      display: none !important;
    }

    /* ── Bottom controls bar: make visible & lay out ── */
    .player-controls-bottom {
      display: flex !important;
      align-items: center !important;
      height: 48px !important;
      padding: 0 8px !important;
      pointer-events: all !important;
    }
    .player-controls-bottom-left  { justify-content: flex-start !important; gap: 4px !important; }
    .player-controls-bottom-right { justify-content: flex-end   !important; gap: 4px !important; margin-left: auto !important; }

    /* Comments button — lives in the bottom-right bar */
    #yt-comments-btn {
      color: rgba(255,255,255,0.9);
      font-size: 11px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      cursor: pointer;
      padding: 0 8px;
      display: inline-flex;
      align-items: center;
      height: 100%;
      user-select: none;
      font-family: system-ui, sans-serif;
      white-space: nowrap;
    }
    #yt-comments-btn:hover { color: #fff; }
    #yt-comments-btn.active { color: #fff; border-bottom: 2px solid #fff; }

    /* ── Comment panel ── */
    #yt-comment-panel {
      position: fixed; bottom: 0; left: 0; right: 0; width: 100%;
      height: 320px; background: #f5f5f5; border-top: 1px solid #ccc;
      z-index: 99999; font-family: system-ui, sans-serif;
      display: flex; flex-direction: column; transition: height 0.25s ease;
    }
    #yt-comment-panel.collapsed { height: 0px; overflow: hidden; visibility: hidden; }

    #yt-comment-filter-bar {
      display: flex; align-items: center; gap: 4px;
      padding: 4px 8px; border-bottom: 1px solid #ddd; background: #ececec;
      flex-shrink: 0;
    }
    #yt-video-stats {
      margin-left: auto; display: flex; align-items: center; gap: 10px;
    }
    .yt-stat { font-size: 10px; color: #666; font-family: system-ui, sans-serif; white-space: nowrap; }
    .yt-stats-sep { font-size: 10px; color: #ccc; }
    #yt-comment-close-x {
      font-size: 18px; color: #aaa; cursor: pointer;
      line-height: 1; user-select: none;
    }
    #yt-comment-close-x:hover { color: #333; }
    #yt-like-bar {
      -webkit-appearance: none; appearance: none;
      width: 64px; height: 6px; border: none; border-radius: 3px; vertical-align: middle;
    }
    #yt-like-bar::-webkit-progress-bar  { background: #e55; border-radius: 3px; }
    #yt-like-bar::-webkit-progress-value { background: #4a4; border-radius: 3px; }
    #yt-like-bar::-moz-progress-bar     { background: #4a4; border-radius: 3px; }

    .yt-filter-btn {
      font-size: 10px; font-family: system-ui, sans-serif;
      padding: 2px 7px; border-radius: 3px; cursor: pointer; user-select: none;
      border: 1px solid #bbb; background: #fff; color: #555;
      letter-spacing: 0.04em; line-height: 1.6;
    }
    .yt-filter-btn:hover  { background: #e8e8e8; color: #222; }
    .yt-filter-btn.active { background: #333; color: #fff; border-color: #333; }

    #yt-comment-list {
      overflow-y: auto; flex: 1; display: flex; flex-direction: column;
      padding: 4px 8px;
      scrollbar-width: thin; scrollbar-color: #ccc transparent;
    }
    #yt-comment-list::-webkit-scrollbar       { width: 3px; }
    #yt-comment-list::-webkit-scrollbar-thumb { background: #ccc; }

    .yt-comment-item {
      display: flex; flex-direction: column; gap: 1px;
      padding: 4px 6px; border-bottom: 1px solid #eee; flex-shrink: 0;
    }
    .yt-comment-item:last-child { border-bottom: none; }
    .yt-comment-meta-top { display: flex; align-items: baseline; gap: 6px; }
    .yt-comment-author   { font-size: 10px; font-weight: bold; color: #111; white-space: nowrap; }
    .yt-comment-likes    { font-size: 10px; color: #bbb; white-space: nowrap; }
    .yt-comment-likes.has-likes { color: #484848; }
    .yt-comment-date     { font-size: 10px; color: #7d7d7d; white-space: nowrap; }
    .yt-comment-text     { font-size: 12.5px; color: #444; line-height: 1.4; max-width: 750px; }
    #yt-comment-loading  { padding: 16px; font-size: 13px; color: #999; font-style: italic; }
  `;
  document.head.appendChild(style);

  // ── Helpers ───────────────────────────────────────────────────────────────
  function el(tag, props = {}, ...children) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k, v]) => {
      if (k === 'className') e.className = v;
      else if (k === 'textContent') e.textContent = v;
      else if (k === 'style' && typeof v === 'string') e.style.cssText = v;
      else e.setAttribute(k, v);
    });
    children.forEach(c => c && e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return e;
  }

  // Safe alternative to innerHTML = '' — satisfies TrustedTypes CSP
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function decodeHtml(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n').replace(/<\/div>/gi, '\n').replace(/<\/li>/gi, '\n')
      .replace(/<li>/gi, '• ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, ' ').replace(/&ndash;/g, '–').replace(/&mdash;/g, '—')
      .replace(/&lsquo;/g, '\u2018').replace(/&rsquo;/g, '\u2019')
      .replace(/&ldquo;/g, '\u201C').replace(/&rdquo;/g, '\u201D')
      .replace(/&hellip;/g, '…').replace(/&bull;/g, '•')
      .replace(/&copy;/g, '©').replace(/&reg;/g, '®').replace(/&trade;/g, '™')
      .replace(/&#(\d+);/g, (_, c) => String.fromCodePoint(Number(c)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/\n{3,}/g, '\n\n').trim();
  }

  // ── Comment panel ─────────────────────────────────────────────────────────
  const panel = el('div', { id: 'yt-comment-panel' });
  panel.classList.add('collapsed');

  const closeX  = el('div', { id: 'yt-comment-close-x', textContent: '✕' });
  const filterBar = el('div', { id: 'yt-comment-filter-bar' });
  const btnTop  = el('div', { className: 'yt-filter-btn active', textContent: 'Top' });
  const btnNew  = el('div', { className: 'yt-filter-btn', textContent: 'New' });
  const statsArea = el('div', { id: 'yt-video-stats' });
  statsArea.appendChild(closeX);
  filterBar.append(btnTop, btnNew, statsArea);
  panel.appendChild(filterBar);

  const list = el('div', { id: 'yt-comment-list' });
  panel.appendChild(list);
  document.body.appendChild(panel);

  // ── Comments toggle button ────────────────────────────────────────────────
  const btn = el('div', { id: 'yt-comments-btn', textContent: 'Comments' });

  function collapse() { panel.classList.add('collapsed');    btn.classList.remove('active'); }
  function expand()   { panel.classList.remove('collapsed'); btn.classList.add('active'); }
  btn.addEventListener('click', e => {
    e.stopPropagation();
    e.preventDefault();
    panel.classList.contains('collapsed') ? expand() : collapse();
  });

  // Block mouse events that originate inside our UI from reaching YouTube's
  // play-toggle handlers. Bubble phase means our own children's listeners
  // all fire first, then propagation stops before YT's ancestor handlers see it.
  ['mousedown', 'mouseup', 'click'].forEach(type => {
    panel.addEventListener(type, e => e.stopPropagation());
    btn.addEventListener(type,   e => e.stopPropagation());
  });

  closeX.addEventListener('click', collapse);

  // ── Relocate CC + settings buttons to the bottom-right bar ───────────────
  // We also inject our Comments button there.
  // The bottom bars (.player-controls-bottom-left / -right) exist in the DOM
  // but are empty. We wait for the top-right controls to have their children
  // rendered, then move CC and the settings/gear button down.
  function relocateControls() {
    const topRight = document.querySelector('.ytwPlayerTopControlsPlayerControlsTopRight');
    const bottomRight = document.querySelector('.player-controls-bottom-right');
    const bottomLeft  = document.querySelector('.player-controls-bottom-left');
    if (!topRight || !bottomRight || !bottomLeft) {
      setTimeout(relocateControls, 300);
      return;
    }

    // Volume — left side
    const volume = topRight.querySelector('volume-controls');
    if (volume) bottomLeft.appendChild(volume);

    // Right side order: Comments | CC | Settings | Fullscreen
    bottomRight.appendChild(btn);

    const cc = topRight.querySelector('yt-closed-captions-toggle-button');
    if (cc) bottomRight.appendChild(cc);

    // Settings button
    const settingsBtn =
      document.querySelector('button[aria-label*="Settings"]') ||
      document.querySelector('.ytp-settings-button');
    if (settingsBtn) {
      const settingsWrap = settingsBtn.closest('ytm-button-renderer') || settingsBtn;
      bottomRight.appendChild(settingsWrap);
    }

    // Fullscreen button
    const fullscreenBtn =
      document.querySelector('button[aria-label*="full screen"], button[aria-label*="fullscreen"], button[aria-label*="Full screen"]') ||
      document.querySelector('.ytp-fullscreen-button');
    if (fullscreenBtn) {
      const fullscreenWrap = fullscreenBtn.closest('ytm-button-renderer') || fullscreenBtn;
      bottomRight.appendChild(fullscreenWrap);
    }
  }
  relocateControls();

  // ── Load comments ─────────────────────────────────────────────────────────
  // Comments are fetched immediately so they're ready when the panel opens.
  // The YouTube Data API v3 commentThreads endpoint requires an Origin or
  // Referer that matches a registered JS key; inside a nocookie embed iframe
  // the origin is www.youtube-nocookie.com — the key must allow that origin,
  // OR we proxy through the parent page.  If the fetch fails we show an error.

  let commentsFetched = false;

  function fetchComments(order) {
    clearNode(list);
    list.appendChild(el('div', { id: 'yt-comment-loading', textContent: 'Loading comments…' }));

    fetch(
      `https://www.googleapis.com/youtube/v3/commentThreads` +
      `?part=snippet&videoId=${videoId}&maxResults=100&order=${order}&key=${API_KEY}`
    )
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (data.error) throw new Error(data.error.message);
        clearNode(list);
        commentsFetched = true;
        const items = data.items || [];
        if (order === 'relevance') {
          items.sort((a, b) =>
            b.snippet.topLevelComment.snippet.likeCount -
            a.snippet.topLevelComment.snippet.likeCount
          );
        }
        if (!items.length) {
          list.appendChild(el('div', { id: 'yt-comment-loading', textContent: 'No comments found.' }));
          return;
        }
        items.forEach(item => {
          const c = item.snippet.topLevelComment.snippet;
          const date = new Date(c.publishedAt).toLocaleString('en-US', {
            timeZone: 'America/Chicago',
            month: 'numeric', day: 'numeric', year: '2-digit',
            hour: 'numeric', minute: '2-digit', hour12: true,
          });
          const itemEl = el('div', { className: 'yt-comment-item' });
          const metaTop = el('div', { className: 'yt-comment-meta-top' });
          metaTop.appendChild(el('span', { className: 'yt-comment-author', textContent: c.authorDisplayName }));
          metaTop.appendChild(el('span', {
            className: `yt-comment-likes${c.likeCount > 0 ? ' has-likes' : ''}`,
            textContent: `👍 ${c.likeCount}`,
          }));
          metaTop.appendChild(el('span', { className: 'yt-comment-date', textContent: date }));
          itemEl.appendChild(metaTop);
          itemEl.appendChild(el('span', { className: 'yt-comment-text', textContent: decodeHtml(c.textDisplay) }));
          list.appendChild(itemEl);
        });
      })
      .catch(err => {
        clearNode(list);
        list.appendChild(el('div', {
          id: 'yt-comment-loading',
          textContent: `Failed to load comments: ${err.message}`,
        }));
        console.error('[yt-ext] comments error:', err);
      });
  }

  btnTop.addEventListener('click', e => {
    e.stopPropagation();
    btnTop.classList.add('active'); btnNew.classList.remove('active');
    fetchComments('relevance');
  });
  btnNew.addEventListener('click', e => {
    e.stopPropagation();
    btnNew.classList.add('active'); btnTop.classList.remove('active');
    fetchComments('time');
  });

  // Kick off immediately — data will be ready by the time user opens the panel
  fetchComments('relevance');

  // ── Video stats ───────────────────────────────────────────────────────────
  Promise.all([
    fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoId}&key=${API_KEY}`)
      .then(r => r.json()),
    fetch(`https://returnyoutubedislikeapi.com/votes?videoId=${videoId}`)
      .then(r => r.json()),
  ]).then(([ytData, ryd]) => {
    const item = ytData.items?.[0];
    if (!item) return;
    const stats = item.statistics;
    const views = Number(stats.viewCount).toLocaleString('en-US');
    const published = new Date(item.snippet.publishedAt).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
    const likes    = Number(ryd.likes    || stats.likeCount || 0);
    const dislikes = Number(ryd.dislikes || 0);
    const total    = likes + dislikes;
    const likeRatio = total > 0 ? likes / total : 1;

    const bar = document.createElement('progress');
    bar.id = 'yt-like-bar'; bar.max = 100;
    bar.value = Math.round(likeRatio * 100);

    filterBar.insertBefore(
      el('span', { className: 'yt-stat', style: 'margin-left:8px', textContent: `📅 ${published}` }),
      statsArea
    );
    [
      el('span', { className: 'yt-stats-sep', textContent: '|' }),
      el('span', { className: 'yt-stat', textContent: `👁 ${views}` }),
      el('span', { className: 'yt-stat', textContent: `👍 ${likes.toLocaleString('en-US')}` }),
      bar,
      el('span', { className: 'yt-stat', textContent: `👎 ${dislikes.toLocaleString('en-US')}` }),
    ].forEach(node => statsArea.insertBefore(node, closeX));
  }).catch(err => console.error('[yt-ext] stats error:', err));

  // ── Speed hold ────────────────────────────────────────────────────────────
  // Hold anywhere over the video: upper 2/3 = 2x, lower 1/3 = 3x.
  // 200 ms threshold distinguishes a hold from a click/double-click.
  // Listens on document (capture phase) so overlay divs can't block it.
  (function setupSpeedHold() {
    const vid =
      document.querySelector('.html5-video-container video') ||
      document.querySelector('video');
    if (!vid) { setTimeout(setupSpeedHold, 500); return; }

    let holdTimer = null, inSpeedMode = false, suppressNextClick = false;

    const speedLabel = document.createElement('div');
    Object.assign(speedLabel.style, {
      position: 'fixed', pointerEvents: 'none', zIndex: '999999',
      background: 'rgba(0,0,0,0.72)', color: '#fff',
      fontSize: '18px', fontWeight: 'bold', fontFamily: 'system-ui, sans-serif',
      padding: '4px 10px', borderRadius: '6px', display: 'none',
      transform: 'translate(-50%, -130%)', whiteSpace: 'nowrap',
    });
    document.body.appendChild(speedLabel);

    function isOverVideo(e) {
      const r = vid.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right &&
             e.clientY >= r.top  && e.clientY <= r.bottom;
    }

    document.addEventListener('mousemove', e => {
      if (inSpeedMode) {
        speedLabel.style.left = e.clientX + 'px';
        speedLabel.style.top  = e.clientY + 'px';
      }
    });

    // Capture phase — fires before any overlay handlers
    document.addEventListener('mousedown', e => {
      if (e.button !== 0 || !isOverVideo(e)) return;
      const r = vid.getBoundingClientRect();
      const inUpperHalf = (e.clientY - r.top) < r.height * 0.5;
      const inLeftHalf  = (e.clientX - r.left) < r.width * 0.5;
      const speed = inUpperHalf ? (inLeftHalf ? 1.5 : 2) : 3;
      holdTimer = setTimeout(() => {
        inSpeedMode = true;
        vid.playbackRate = speed;
        speedLabel.textContent = speed + 'x';
        speedLabel.style.left = e.clientX + 'px';
        speedLabel.style.top  = e.clientY + 'px';
        speedLabel.style.display = 'block';
      }, 200);
    }, true);

    document.addEventListener('mouseup', () => {
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (inSpeedMode) {
        vid.playbackRate = 1;
        inSpeedMode = false;
        suppressNextClick = true;
        speedLabel.style.display = 'none';
      }
    }, true);

    // Suppress the click that fires after releasing a hold
    document.addEventListener('click', e => {
      if (suppressNextClick) {
        e.stopPropagation();
        e.preventDefault();
        suppressNextClick = false;
      }
    }, true);

    // ── Double-click → toggle fullscreen ───────────────────────────────────
    // We track clicks ourselves rather than relying on the 'dblclick' event
    // because YouTube's overlay swallows it. Two clicks within 300 ms over
    // the video area = fullscreen toggle. The hold timer being cleared on
    // mouseup means a held press never counts as a click here.
    let lastClickTime = 0;
    document.addEventListener('click', e => {
      // Ignore if we just suppressed a hold-release, or not over the video
      if (!isOverVideo(e)) return;
      // Ignore clicks on our own UI elements
      if (e.target.closest('#yt-comments-btn, #yt-comment-panel, .player-controls-bottom')) return;

      const now = Date.now();
      if (now - lastClickTime < 300) {
        // Double-click detected — toggle fullscreen
        lastClickTime = 0;
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else {
          document.exitFullscreen().catch(() => {});
        }
      } else {
        lastClickTime = now;
      }
    }, false); // bubble phase so it runs after the suppress handler above
  })();

  // ── Play button click → collapse comments ─────────────────────────────────
  // The center play/pause button is .icon-button.player-control-play-pause-icon.
  // We also catch clicks on the video itself (single click toggles play in YT's
  // new player) — but only when the comments panel is open, to avoid interfering
  // with normal play/pause interaction when the panel is already closed.
  (function setupPlayCollapser() {
    function attachPlayListener() {
      const playBtn = document.querySelector('.player-control-play-pause-icon');
      if (!playBtn) { setTimeout(attachPlayListener, 400); return; }
      playBtn.addEventListener('click', () => {
        if (!panel.classList.contains('collapsed')) collapse();
      });
    }
    attachPlayListener();
  })();
})();