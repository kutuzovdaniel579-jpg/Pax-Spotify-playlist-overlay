// ==UserScript==
// @name         FOLP Universal Spotify Bar (met refresh)
// @namespace    https://fluxopenlab.example
// @version      1.2.0
// @description  Universele topbalk die overal je huidige Spotify-track toont, met automatische token refresh
// @author       FoL
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// ==/UserScript==

(function () {
  "use strict";

  // --- UI: topbalk ---
  const bar = document.createElement("div");
  bar.id = "folp-spotify-bar";
  Object.assign(bar.style, {
    position: "fixed",
    top: "0",
    left: "0",
    right: "0",
    height: "36px",
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "0 12px",
    fontFamily:
      'system-ui, -apple-system, "Segoe UI", Roboto, Ubuntu, Cantarell, "Helvetica Neue", Arial',
    fontSize: "14px",
    color: "#fff",
    background: "linear-gradient(90deg, #1db954 0%, #1aa34a 100%)",
    boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
    zIndex: "999999",
    userSelect: "none",
  });

  const icon = document.createElement("span");
  icon.textContent = "🎧";

  const artwork = document.createElement("img");
  Object.assign(artwork.style, { borderRadius: "4px", display: "none" });
  artwork.width = 24;
  artwork.height = 24;

  const text = document.createElement("span");
  text.id = "folp-spotify-text";
  Object.assign(text.style, {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    maxWidth: "70vw",
  });
  text.textContent = "Zoeken naar huidige track…";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✕";
  closeBtn.title = "Verberg balk";
  Object.assign(closeBtn.style, {
    marginLeft: "auto",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    padding: "4px 8px",
    cursor: "pointer",
  });
  closeBtn.addEventListener("click", () => {
    bar.remove();
    clearInterval(interval);
    clearInterval(refreshInterval);
  });

  bar.append(icon, artwork, text, closeBtn);
  document.body.appendChild(bar);
  document.body.style.marginTop = "36px";

  // --- Menu: credentials instellen ---
  GM_registerMenuCommand("Spotify refresh token instellen", async () => {
    const current = GM_getValue("spotify_refresh_token") || "";
    const token = prompt("Plak hier je Spotify refresh token:", current ? `[${current}]` : "");
    if (token && token.trim()) {
      GM_setValue("spotify_refresh_token", token.trim());
      alert("Refresh token opgeslagen.");
    }
  });

  GM_registerMenuCommand("Spotify client ID instellen", async () => {
    const current = GM_getValue("spotify_client_id") || "";
    const id = prompt("Plak hier je Spotify Client ID:", current ? `[${current}]` : "");
    if (id && id.trim()) {
      GM_setValue("spotify_client_id", id.trim());
      alert("Client ID opgeslagen.");
    }
  });

  GM_registerMenuCommand("Spotify client secret instellen", async () => {
    const current = GM_getValue("spotify_client_secret") || "";
    const secret = prompt("Plak hier je Spotify Client Secret:", current ? `[${current}]` : "");
    if (secret && secret.trim()) {
      GM_setValue("spotify_client_secret", secret.trim());
      alert("Client Secret opgeslagen.");
    }
  });

  // --- Token verversen ---
  async function refreshSpotifyToken() {
    const refreshToken = GM_getValue("spotify_refresh_token");
    const clientId = GM_getValue("spotify_client_id");
    const clientSecret = GM_getValue("spotify_client_secret");
    if (!refreshToken || !clientId || !clientSecret) return;

    try {
      const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: "Basic " + btoa(clientId + ":" + clientSecret),
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: refreshToken,
        }),
      });
      if (!res.ok) {
        console.error("Kon token niet verversen:", await res.text());
        return;
      }
      const data = await res.json();
      GM_setValue("spotify_token", data.access_token);
      console.log("Nieuw Spotify token opgehaald.");
    } catch (err) {
      console.error("Fout bij verversen token:", err);
    }
  }

  // --- Helpers ---
  function format(meta) {
    if (!meta) return "Geen track gedetecteerd";
    const { title, artist, album } = meta;
    if (title && artist && album) return `Luistert: ${title} — ${artist} · ${album}`;
    if (title && artist) return `Luistert: ${title} — ${artist}`;
    if (title) return `Luistert: ${title}`;
    return "Geen track gedetecteerd";
  }

  function setArtwork(src) {
    if (src) {
      artwork.src = src;
      artwork.style.display = "inline-block";
    } else {
      artwork.style.display = "none";
    }
  }

  async function readSpotifyAPI() {
    const token = GM_getValue("spotify_token");
    if (!token) return null;
    try {
      const res = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 204) return null;
      if (!res.ok) return null;
      const data = await res.json();
      const item = data.item;
      if (!item) return null;
      return {
        title: item.name,
        artist: item.artists?.map((a) => a.name).join(", ") || "",
        album: item.album?.name || "",
        artwork: item.album?.images?.[0]?.url || null,
      };
    } catch {
      return null;
    }
  }

  // --- Update loop ---
  let lastText = "";
  let lastArt = "";

  async function update() {
    let meta = await readSpotifyAPI();
    const display = format(meta);
    if (display !== lastText) {
      text.textContent = display;
      lastText = display;
    }
    const art = meta?.artwork || "";
    if (art !== lastArt) {
      setArtwork(art);
      lastArt = art;
    }
  }

  const interval = setInterval(update, 1500);
  const refreshInterval = setInterval(refreshSpotifyToken, 60 * 60 * 1000); // elk uur
  refreshSpotifyToken(); // meteen bij start
})();
