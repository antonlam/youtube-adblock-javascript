// ==UserScript==
// @name         Display Info v3
// @namespace    http://tampermonkey.net/
// @version      2025-06-24
// @description  Store and get YouTube common info; panel near Subscribe/top-row
// @match        https://www.youtube.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
  
    let previousUrl = '';
    let alwaysPlay = localStorage.getItem('alwaysPlay') === 'true';
    let hasFirstUntickOccurred = localStorage.getItem('hasFirstUntickOccurred') === 'true';
  
    const QUALITY_MAP = { tiny:'144p', small:'240p', medium:'360p', large:'480p',
      hd720:'720p', hd1080:'1080p', hd1440:'1440p', hd2160:'2160p', highres:'4320p' };
  
    // Resolve preferred anchors in priority order
    function resolveAnchor(player) {
      // 1) Subscribe button area inside owner renderer
      const subscribeBtn =
        document.querySelector('ytd-video-owner-renderer #subscribe-button, ytd-watch-metadata #subscribe-button');
      if (subscribeBtn) return { el: subscribeBtn, mode: 'after-subscribe' };
  
      // 2) Top row of watch metadata
      const topRow = document.querySelector('ytd-watch-metadata #top-row');
      if (topRow) return { el: topRow, mode: 'in-top-row' };
  
      // 3) Middle row of watch metadata (fallback within metadata)
      const middleRow = document.querySelector('ytd-watch-metadata #middle-row');
      if (middleRow) return { el: middleRow, mode: 'in-middle-row' };
  
      // 4) Player overlay fallback
      if (player) return { el: player, mode: 'overlay' };
      return null;
    }
  
    function ensurePanel(anchorObj) {
      if (!anchorObj) return null;
      const { el, mode } = anchorObj;
  
      let panel = document.getElementById('tm-video-info');
      if (!panel) {
        panel = document.createElement('div');
        panel.id = 'tm-video-info';
        panel.setAttribute('role', 'group');
  
        // Base styles
        Object.assign(panel.style, {
          zIndex: '1000',
          padding: '6px 8px',
          color: '#fff',
          backgroundColor: 'rgba(18,18,18,.85)',
          border: '1px solid #3d3d3d',
          borderRadius: '8px',
          whiteSpace: 'pre',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          lineHeight: '16px',
          maxWidth: 'min(460px, 50vw)'
        });
  
        const textSpan = document.createElement('span');
        textSpan.setAttribute('data-custom-text', 'video-info');
        panel.appendChild(textSpan);
  
        const label = document.createElement('label');
        Object.assign(label.style, { display: 'inline-flex', alignItems: 'center', cursor: 'pointer', color: '#fff' });
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.style.marginRight = '6px';
        cb.checked = alwaysPlay;
        label.appendChild(cb);
        label.appendChild(document.createTextNode('Always Play'));
        panel.appendChild(label);
      }
  
      // Placement and style per mode
      if (mode === 'after-subscribe') {
        if (panel.parentElement !== el.parentElement || panel.previousElementSibling !== el) {
          el.insertAdjacentElement('afterend', panel); // precise placement beside subscribe [web:43]
        }
        Object.assign(panel.style, { position: 'static', marginLeft: '8px', marginTop: '0', pointerEvents: 'auto' });
      } else if (mode === 'in-top-row' || mode === 'in-middle-row') {
        if (panel.parentElement !== el) el.appendChild(panel);
        Object.assign(panel.style, { position: 'static', marginTop: '8px', pointerEvents: 'auto' });
      } else {
        // overlay on player
        if (panel.parentElement !== el) el.appendChild(panel);
        Object.assign(panel.style, { position: 'absolute', bottom: '56px', left: '12px', pointerEvents: 'none' });
        if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      }
  
      return panel;
    }
  
    function getVideoInfo(video, player) {
      if (!video || isNaN(video.currentTime)) return null;
      const time = video.currentTime;
      const status = !video.paused;
      const speed = video.playbackRate.toFixed(2);
      const quality = player && typeof player.getPlaybackQuality === 'function' ? player.getPlaybackQuality() : '';
      const isTheater = document.querySelector('ytd-watch-flexy[theater]') !== null;
      const isFull = document.querySelector('ytd-watch-flexy[fullscreen]') !== null;
      const mode = isFull ? 'Full Screen' : (isTheater ? 'Theater' : 'Default');
      return { url: location.href.split('&')[0], time, status, speed, quality, mode };
    }
  
    function setVideoInfo(video, player, info) {
      if (!video || !player || !info) return;
      try {
        video.currentTime = info.time || 0;
        if (info.speed) video.playbackRate = Number(info.speed) || 1.0;
        if (info.quality && typeof player.setPlaybackQuality === 'function') player.setPlaybackQuality(info.quality);
        if (info.mode === 'Full Screen' && typeof player.enterFullScreen === 'function') player.enterFullScreen();
        else if (info.mode === 'Theater') {
          const btn = document.querySelector('.ytp-size-button');
          if (btn) btn.click();
        } else if (info.mode === 'Default' && typeof player.exitFullScreen === 'function') player.exitFullScreen();
        video.play().catch(() => {});
      } catch {}
    }
  
    function onUrlChange(video, player) {
      const currentUrl = location.href.split('&')[0];
      if (currentUrl !== previousUrl) {
        previousUrl = currentUrl;
        const k = currentUrl + '_loadCount';
        localStorage.setItem(k, String((parseInt(localStorage.getItem(k) || '0', 10)) + 1));
        const stored = localStorage.getItem(currentUrl + '_videoInfo');
        if (stored) {
          try { setVideoInfo(video, player, JSON.parse(stored)); } catch {}
        }
      }
    }
  
    function storeVideoInfo(url, info) {
      try {
        localStorage.setItem(url + '_videoInfo', JSON.stringify(info));
        const videoKeys = Object.keys(localStorage).filter(k => k.endsWith('_videoInfo'));
        const maxVideos = 20;
        if (videoKeys.length > maxVideos) {
          const sorted = videoKeys.sort((a, b) =>
            (parseInt(localStorage.getItem(a.replace('_videoInfo', '_loadCount')) || '0', 10)) -
            (parseInt(localStorage.getItem(b.replace('_videoInfo', '_loadCount')) || '0', 10)));
          const oldest = sorted[0];
          localStorage.removeItem(oldest);
          localStorage.removeItem(oldest.replace('_videoInfo', '_loadCount'));
        }
      } catch {}
    }
  
    function observeMetadata() {
      const meta = document.querySelector('ytd-watch-metadata') || document.body;
      const mo = new MutationObserver(() => {
        const player = document.querySelector('.html5-video-player');
        const anchorObj = resolveAnchor(player);
        if (!anchorObj) return;
        const panel = ensurePanel(anchorObj);
        if (!panel) return;
        // If subscribe button appears later, snap panel after it
        if (anchorObj.mode !== 'after-subscribe') {
          const sb = document.querySelector('ytd-video-owner-renderer #subscribe-button, ytd-watch-metadata #subscribe-button');
          if (sb && panel.previousElementSibling !== sb) sb.insertAdjacentElement('afterend', panel);
        }
      });
      mo.observe(meta, { childList: true, subtree: true }); // robust against Polymer re-renders [web:61]
    }
  
    const main = setInterval(() => {
      const video = document.querySelector('video');
      const player = document.querySelector('.html5-video-player');
      if (!video || !player) return;
  
      onUrlChange(video, player);
  
      const info = getVideoInfo(video, player);
      if (!info) return;
  
      const anchorObj = resolveAnchor(player);
      const panel = ensurePanel(anchorObj || {});
      if (panel) {
        const infoSpan = panel.querySelector('span[data-custom-text="video-info"]');
        const m = Math.floor(info.time / 60);
        const s = Math.floor(info.time % 60).toString().padStart(2, '0');
        const q = QUALITY_MAP[info.quality] || info.quality || '';
        const st = info.status ? 'Is Playing' : 'Is Paused';
        if (infoSpan) infoSpan.textContent = `Time: ${m}:${s} - ${st} - Speed: ${info.speed}x\nResolution: ${q} - Mode: ${info.mode}`;
      }
  
      const secKey = Math.floor(info.time);
      const lastSec = Number(localStorage.getItem(info.url + '_lastStoredSec') || '-1');
      if (secKey !== lastSec) {
        storeVideoInfo(info.url, info);
        localStorage.setItem(info.url + '_lastStoredSec', String(secKey));
      }
  
      const cb = document.querySelector('#tm-video-info input[type="checkbox"]');
      if (cb) {
        alwaysPlay = cb.checked;
        localStorage.setItem('alwaysPlay', alwaysPlay ? 'true' : 'false');
        if (alwaysPlay) {
          video.play().catch(() => {});
          const handler = () => { if (cb.checked) video.play().catch(() => {}); };
          if (video._tmHandlePause) video.removeEventListener('pause', video._tmHandlePause);
          video._tmHandlePause = handler;
          video.addEventListener('pause', handler);
        } else {
          if (!hasFirstUntickOccurred && !video.paused) {
            video.pause();
            hasFirstUntickOccurred = true;
            localStorage.setItem('hasFirstUntickOccurred', 'true');
          }
          if (video._tmHandlePause) {
            video.removeEventListener('pause', video._tmHandlePause);
            delete video._tmHandlePause;
          }
        }
      }
    }, 200);
  
    observeMetadata();
  
    window.addEventListener('beforeunload', () => clearInterval(main));
  })();
  