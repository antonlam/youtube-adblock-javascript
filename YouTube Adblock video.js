// ==UserScript==
// @name         Youtube-Adblock v5.0
// @namespace    http://tampermonkey.net/
// @version      5.2
// @description  Youtube Adblock v5
// @author       Anton
// @match        *://*.youtube.com/*
// @exclude      *://accounts.youtube.com/*
// @exclude      *://www.youtube.com/live_chat_replay*
// @exclude      *://www.youtube.com/persist_identity*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=YouTube.com
// @grant        none
// @license MIT
// ==/UserScript==

(function() {
    'use strict';
    window.dev = false;

    // All tunable values — adjust these when testing on iOS Safari
    const config = {
        // --- Main loop ---
        logInterval: 500, // ms; how often the script runs

        // --- Auto-play at video start ---
        autoPlayTime: 1, // seconds; auto-play if paused within first N seconds

        // --- Ad skip (Case 2) ---
        adsBeforeEndTime: 0.1,// seconds; seek to duration minus this value
        adTailStuckThreshold: 0.05, // seconds; treat as stuck when within this of nearEnd
        adTailPushDelta: 0.3, // seconds; extra push when stuck at ad tail
        adUnknownDurationPlaybackRate: 16, // playback rate while ad duration is not yet loaded
        normalPlaybackRate: 1, // playback rate to restore after ad skip

        // --- Skip button detection ---
        skipButtonMinSize: 1, // px; min width/height for a clickable skip button

        // --- Post-skip recovery window (Case 3 & 4) ---
        postSkipWatchMs: 1000, // ms; monitor main video after ad pod ends
        postSkipDelayMs: 400, // ms; wait before recovery (avoid ad-pod transitions)
        stallThresholdMs: 800, // ms; how long currentTime must stay still = stalled
        timeMovedThreshold: 0.01, // seconds; min delta to count as "time moved"

        // --- Case 3: stuck at mid-roll ad timestamp ---
        midrollSeekDelta: 0.8, // seconds; push forward when currentTime frozen

        // --- Case 4: black screen after skip ---
        blackScreenMinReadyState: 2, // readyState below this = possible black screen
        blackScreenMicroSeek: 0.001, // seconds; tiny seek to unstick decoder
        blackScreenPushDelta: 1.0,  // seconds; second push if still stuck after stallThresholdMs

        // --- Content playing check ---
        contentMinReadyState: 2, // readyState needed to count as playing normally

        // --- Adblock warning popup ---
        randomThreshold: 1000,// ms; base interval for popup check
        warningCheckRandomRange: 500, // ms; random extra delay added to check interval
        removePopupDelayTime: 1000, // ms; max random delay before closing popup
    };

    const cssSelectors = [
        `#masthead-ad`,
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-row #content:has(.ytd-display-ad-renderer)`,
        `.video-ads.ytp-ad-module`,
        `tp-yt-paper-dialog:has(yt-mealbar-promo-renderer)`,
        `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]`,
        `#related #player-ads`,
        `#related ytd-ad-slot-renderer`,
        `ytd-ad-slot-renderer`,
        `yt-mealbar-promo-renderer`,
        `ytd-popup-container:has(a[href="/premium"])`,
        `ad-slot-renderer`,
        `ytm-companion-ad-renderer`,
        `#related #-ad-`,
    ];

    let adblockStyleEl = null;
    let warningInterval = null;
    let warningCloseScheduled = false;
    let wasAdShowing = false;
    let postSkipRecovery = null;
    let postSkipRecoveryTimer = null;
    let lastAdVideo = null;

    function isAdShowing() {
        return !!document.querySelector('.ad-showing, .video-ads.ytp-ad-module');
    }

    function getAdPodInfo() {
        const adTextEl = document.querySelector('.ytp-ad-text, .ytp-ad-preview-text, .ytp-ad-duration-remaining');
        if (!adTextEl) return null;

        const match = adTextEl.textContent.match(/(\d+)\s*(?:\/|of)\s*(\d+)/i);
        if (!match) return null;

        return {
            current: parseInt(match[1], 10),
            total: parseInt(match[2], 10)
        };
    }

    function isLastAdInPod() {
        const pod = getAdPodInfo();
        return !pod || pod.current >= pod.total;
    }

    function isSkipButtonReady(btn) {
        if (!btn || btn.offsetParent === null) return false;
        if (btn.disabled || btn.getAttribute('aria-disabled') === 'true') return false;

        const rect = btn.getBoundingClientRect();
        if (rect.width < config.skipButtonMinSize || rect.height < config.skipButtonMinSize) return false;

        const container = btn.closest('.ytp-ad-skip-button-container, .ytp-ad-skip-button-modern');
        if (container && container.classList.contains('ytp-ad-skip-button-disabled')) return false;

        return true;
    }

    async function safePlay(video) {
        if (!video) return false;
        try {
            await video.play();
            return true;
        } catch (error) {
            console.error('Failed to play video:', error);
            return false;
        }
    }

    function clickSkipButton() {
        const skipButtons = document.querySelectorAll(
            '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, ' +
            '.ytp-ad-skip-button-container button, .ytp-ad-skip-button-slot button'
        );

        for (const skipBtn of skipButtons) {
            if (isSkipButtonReady(skipBtn)) {
                skipBtn.click();
                return true;
            }
        }

        return false;
    }

    function cancelPostSkipRecovery() {
        if (postSkipRecoveryTimer !== null) {
            clearTimeout(postSkipRecoveryTimer);
            postSkipRecoveryTimer = null;
        }
        postSkipRecovery = null;
    }

    function schedulePostSkipRecovery(video) {
        if (!video || !isLastAdInPod()) return;

        if (postSkipRecoveryTimer !== null) {
            clearTimeout(postSkipRecoveryTimer);
        }

        postSkipRecoveryTimer = setTimeout(() => {
            postSkipRecoveryTimer = null;
            if (!isAdShowing())startPostSkipRecovery(video);
        }, config.postSkipDelayMs);
    }

    function startPostSkipRecovery(video) {
        if (!video) return;
        postSkipRecovery = {
            startTime: Date.now(),
            lastCurrentTime: video.currentTime,
            lastCheckTime: Date.now(),
            blackScreenRecoveryStarted: false
        };
    }

    function removeNonVideoAds(selectors) {
        const cssRules = selectors.map((selector) => `${selector}{display:none!important}`).join(' ');

        if (!adblockStyleEl) {
            adblockStyleEl = document.createElement('style');
            adblockStyleEl.id = 'yt-adblock-styles';
            (document.head || document.body).appendChild(adblockStyleEl);
        }

        if (adblockStyleEl.textContent !== cssRules) {
            adblockStyleEl.textContent = cssRules;
        }

        const premiumContainers = [...document.querySelectorAll('ytd-popup-container')].filter(
            (container) => container.querySelector('a[href="/premium"]')
        );
        premiumContainers.forEach((container) => container.remove());

        const backdrops = document.querySelectorAll('tp-yt-iron-overlay-backdrop');
        const targetBackdrop = Array.from(backdrops).find((backdrop) => backdrop.style.zIndex === "2201");
        if (targetBackdrop) {
            targetBackdrop.className = '';
            targetBackdrop.removeAttribute('opened');
        }

        const emptyBox = 'ytd-rich-item-renderer:has(> #content > ytd-ad-slot-renderer)';
        document.querySelectorAll(emptyBox).forEach((item) => item.remove());
    }

    function isContentPlayingNormally(video) {
        return video && !isAdShowing() && !video.paused && !video.ended && video.readyState >= config.contentMinReadyState;
    }

    async function skipAd(video) {
        if (!video) return;

        if (video !== lastAdVideo) {
            lastAdVideo = video;
            video.playbackRate = config.normalPlaybackRate;
        }

        const skipClicked = clickSkipButton();

        if (!video.duration || !isFinite(video.duration)) {
            video.muted = true;
            video.playbackRate = config.adUnknownDurationPlaybackRate;
            await safePlay(video);
            return;
        }

        if (video.playbackRate !== config.normalPlaybackRate) {
            video.playbackRate = config.normalPlaybackRate;
        }

        const nearEnd = video.duration - config.adsBeforeEndTime;
        const stuckAtTail = video.currentTime >= nearEnd - config.adTailStuckThreshold;

        if (stuckAtTail) {
            video.currentTime = Math.min(video.currentTime + config.adTailPushDelta, video.duration);
            video.muted = true;
            await safePlay(video);
            return;
        }

        video.muted = true;
        video.currentTime = nearEnd;

        if (skipClicked && isLastAdInPod()) {
            schedulePostSkipRecovery(video);
        }
    }

    async function recoverBlackScreen(video, stalledAt) {
        video.pause();
        video.currentTime += config.blackScreenMicroSeek;
        await safePlay(video);

        setTimeout(async () => {
            if (!postSkipRecovery) return;

            const elapsed = Date.now() - postSkipRecovery.startTime;
            if (elapsed > config.postSkipWatchMs) return;

            const stillStuck = video.paused || Math.abs(video.currentTime - stalledAt) < config.timeMovedThreshold;

            if (stillStuck) {
                video.currentTime += config.blackScreenPushDelta;
                await safePlay(video);
                postSkipRecovery.lastCurrentTime = video.currentTime;
                postSkipRecovery.lastCheckTime = Date.now();
            }
        }, config.stallThresholdMs);
    }

    async function handlePostSkipRecovery(video) {
        if (!postSkipRecovery || !video || isAdShowing()) return;

        const now = Date.now();
        const elapsed = now - postSkipRecovery.startTime;
        if (elapsed > config.postSkipWatchMs) {
            postSkipRecovery = null;
            return;
        }

        const timeSinceLastCheck = now - postSkipRecovery.lastCheckTime;
        const currentTime = video.currentTime;
        const timeMoved = Math.abs(currentTime - postSkipRecovery.lastCurrentTime) > config.timeMovedThreshold;
        const isStalled = !timeMoved && timeSinceLastCheck >= config.stallThresholdMs;
        const isBlackScreen = !video.ended && (video.paused || video.readyState < config.blackScreenMinReadyState);

        if (isStalled && isBlackScreen && !postSkipRecovery.blackScreenRecoveryStarted) {
            postSkipRecovery.blackScreenRecoveryStarted = true;
            await recoverBlackScreen(video, currentTime);
            return;
        }

        if (isStalled && !postSkipRecovery.blackScreenRecoveryStarted) {
            video.currentTime += config.midrollSeekDelta;
            await safePlay(video);
            postSkipRecovery.lastCurrentTime = video.currentTime;
            postSkipRecovery.lastCheckTime = now;
            return;
        }

        if (timeMoved) {
            postSkipRecovery.lastCurrentTime = currentTime;
            postSkipRecovery.lastCheckTime = now;
        }
    }

    function removeAdblockWarning() {
        if (warningInterval !== null) {
            return;
        }

        const checkInterval = config.randomThreshold + Math.random() * config.warningCheckRandomRange;

        warningInterval = setInterval(() => {
            const popupExists = document.getElementsByClassName('style-scope ytd-popup-container').length > 0;
            const dismissButton = document.getElementById('dismiss-button');
            const divider = document.getElementById('divider');

            if (!popupExists || !dismissButton || !divider || warningCloseScheduled) return;
            warningCloseScheduled = true;

            const closeDelay = Math.random() * config.removePopupDelayTime;

            setTimeout(() => {
                const playButton = document.querySelector('.ytp-play-button.ytp-button');
                const currentDismissButton = document.getElementById('dismiss-button');
                if (currentDismissButton) currentDismissButton.click();
                if (playButton) playButton.click();

                console.log('Banner closed');

                clearInterval(warningInterval);
                warningInterval = null;
                warningCloseScheduled = false;
            }, closeDelay);
        }, checkInterval);
    }

    setInterval(() => {
        if (document.readyState === 'loading') return;

        window.addEventListener('beforeunload', () => {
            window.localStorage.setItem('lastUrl', window.location.href);
        }, { once: true });

        removeNonVideoAds(cssSelectors);
        removeAdblockWarning();

        const adsVideo = document.querySelector('.ad-showing video');
        const mainVideo = document.querySelector('video');
        const adShowing = isAdShowing();

        if (adShowing) {
            cancelPostSkipRecovery();
        } else if (wasAdShowing && mainVideo) {
            schedulePostSkipRecovery(mainVideo);
        }
        wasAdShowing = adShowing;

        if (mainVideo) {
            const playerStatus = {
                currentTime: mainVideo.currentTime,
                isPaused: mainVideo.paused,
                speed: mainVideo.playbackRate
            };

            if (playerStatus.currentTime <= config.autoPlayTime && playerStatus.isPaused === true) safePlay(mainVideo);
            handlePostSkipRecovery(mainVideo);
        }

        skipAd(adsVideo);
    }, config.logInterval);

})();
