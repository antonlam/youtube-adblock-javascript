// ==UserScript==
// @name         Youtube Adblock v3
// @namespace    http://tampermonkey.net/
// @version      2025-05-09
// @description  Youtube Adblock v3
// @author       Anton
// @match        *://*.youtube.com/*
// @exclude      *://accounts.youtube.com/*
// @exclude      *://www.youtube.com/live_chat_replay*
// @exclude      *://www.youtube.com/persist_identity*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=YouTube.com
// @grant        none
// @license MIT
// ==/UserScript==

var url = "";
var video;
var videoTime = 0;
var videoInfo = {
    "time" : 0,
    "status" : '',
    "speed" : 1.0,
    "quality" : '',
    "mode" : '',
};

const cssArrObject = [
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

(function() {
    'use strict';
    window.dev=false;

    function removeNonVideoAds(arry) {
        arry.forEach((selector, index) => {
            arry[index] = `${selector}{display:none!important}`;
        });

        const premiumContainers = [...document.querySelectorAll(`ytd-popup-container`)];
        const matchingContainers = premiumContainers.filter(container =>
            container.querySelector(`a[href="/premium"]`));

        if (matchingContainers.length > 0) {
            matchingContainers.forEach(container => container.remove());
        }

        const backdrops = document.querySelectorAll(`tp-yt-iron-overlay-backdrop`);
        const targetBackdrop = Array.from(backdrops).find(
            (backdrop) => backdrop.style.zIndex === `2201`
        );

        if (targetBackdrop) {
            targetBackdrop.className = ``;
            targetBackdrop.removeAttribute(`opened`);
        }
        let style = document.createElement(`style`);
        (document.head || document.body).appendChild(style);
        style.appendChild(document.createTextNode(arry.join(` `)));
    }

    function skipAd(adsVideo) {
        const adIndicator = document.querySelector(
            '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, ' +
            '.video-ads.ytp-ad-module .ytp-ad-player-overlay, .ytp-ad-button-icon'
        );

        if (adIndicator && !window.location.href.includes('https://m.youtube.com/')) {
            adsVideo.muted = true;
            adsVideo.currentTime = adsVideo.duration - 0.1;
            adsVideo.play();
        }
    }

    const mainFunc = setInterval(() => {
        video = document.getElementById("movie_player") || document.getElementsByClassName("html5-video-player")[0];
        if (document.readyState !== 'loading') {
            window.addEventListener('beforeunload', () => {
                window.localStorage.setItem('lastUrl', window.location.href);
            }, { once: true });
            let adsVideo = document.querySelector('.ad-showing video');
            removeNonVideoAds(cssArrObject);
            //url = window.location.href;
            skipAd(adsVideo);
        }
    }, 100);

})();