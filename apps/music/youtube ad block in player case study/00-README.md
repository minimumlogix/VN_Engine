# YouTube Ad-Free Experience Scripts

Small scripts to route YouTube videos through youtube-nocookie.com and enhance the embed player with a cleaner UI, comments, and better controls.

youtube-nocookie.com is YouTube’s embed domain, which loads a simpler player with fewer UI elements and typically does not include standard YouTube ads.

---

## Script's included

### 01-open-youtube-links-externally.js
Intercepts YouTube video links and opens them in a modified player via youtube-nocookie.com.

### 02-youtube-nocookie-player.js
Enhances the embed player with:
- Comments panel
- Video stats (views, likes/dislikes)
- Cleaner UI
- Custom controls and interactions
- Hold-to-speed playback:
  - Hold in the upper area of the video to increase speed (1.5x or 2x)
  - Hold in the lower area to jump to 3x
  - Release to return to normal speed

---

## Setup

### 1. Install extension

Install **User JavaScript and CSS** Chrome extension:
https://chromewebstore.google.com/detail/user-javascript-and-css/nbhcbdghjpllgmfilhnhkllmkecfmpld?pli=1

---

### 2. Add Script #1 (YouTube links)

- Open the extension
- Go to the JS tab
- Set it to run on:
  https://www.youtube.com/*
- Paste in 01-open-youtube-links-externally.js (below)
- Save

---

### 3. Add Script #2 (Embed player)

- Add a new script
- Set it to run on:
  https://www.youtube-nocookie.com/embed/*
- Paste in 02-youtube-nocookie-player.js (below)
- Save

---

### 4.  YouTube API Key Setup (to see video comments and stats)

A YouTube Data API key is required for the comments and video stats features.

#### 1. Create a project

- Go to https://console.cloud.google.com
- Agree to Terms of Service if visiting for the first time
- Click **Select a project** → **New Project**
- Give it a name (e.g. youtube-embed) and click **Create**

#### 2. Enable the API

- Go to **APIs & Services → Library**
- Search for **YouTube Data API v3**
- Click it and press **Enable**

#### 3. Create an API key

- Go to **APIs & Services → Credentials**
- Click **Create Credentials → API key**
- Under the "APIs that can be accessed using this key" dropdown select "YouTube Data API v3" - it may take a few minutes for this to appear after enabling so keep refreshing
- Keep application restrictions as "None" and click "Create"
- Copy the key

#### 4. Add it to the script

Open `youtube-nocookie-player.js` and replace:

```js
const API_KEY = 'REPLACE_WITH_YOUTUBE_API_KEY';
```

#### 5. Refresh youtube-nocookie.com

You should now see the comments panel populate data.

---

## Optional

🎩 If you find this useful and want to support:

BTC: `3HJGYMp3E7r3ZL9KeyM1rw4dd3jNZyGFvY`