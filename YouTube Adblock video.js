// ==UserScript==
// @name         Youtube Adblock v1
// @namespace    http://tampermonkey.net/
// @version      2024-10-30
// @description  Youtube Adblock v1
// @author       Anton
// @match        *://*.youtube.com/*
// @exclude      *://accounts.youtube.com/*
// @exclude      *://www.youtube.com/live_chat_replay*
// @exclude      *://www.youtube.com/persist_identity*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=YouTube.com
// @grant        none
// @license MIT
// ==/UserScript==
var cssArrObject = [
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
let video;
let videoTime;
let mainVideoTime = 0;
window.dev=false;

function generateRemoveADCssText(arry){
    arry.forEach((selector,index)=>{
        arry[index]=`${selector}{display:none!important}`;
    });
    const premiumContainers = [...document.querySelectorAll(`ytd-popup-container`)];
    const matchingContainers = premiumContainers.filter(container => container.querySelector(`a[href="/premium"]`));

    if(matchingContainers.length>0){
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
    return arry.join(` `);
}

function generateRemoveADHTMLElement(id) {
    let style = document.createElement(`style`);
    (document.head || document.body).appendChild(style);
    style.appendChild(document.createTextNode(generateRemoveADCssText(cssArrObject)));
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

function removePlayerAD(id) {
    let video = document.querySelector('.ad-showing video');
    if (!video) {
        new MutationObserver(debounce(() => {
            video = document.querySelector('.ad-showing video');
            if (video) {
                setupAdObserver(video);
                this.disconnect();
            }
        }, 100)).observe(document.body, { childList: true, subtree: true });
        return;
    }
    setupAdObserver(video);
}

function setupAdObserver(video) {
    const targetNode = document.querySelector('.video-player-container') || document.body;
    const config = { childList: true, subtree: true };
    
    const observer = new MutationObserver(debounce(() => {
        skipAd(video);
        observer.disconnect();
    }, 100));

    observer.observe(targetNode, config);
}

function skipAd(video) {
    const skipButton = document.querySelector('.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern');
    const shortAdMsg = document.querySelector('.video-ads.ytp-ad-module .ytp-ad-player-overlay, .ytp-ad-button-icon');
    video.playbackRate = 1.5;
    if ((skipButton || shortAdMsg) && !window.location.href.includes('https://m.youtube.com/')) {
        video.muted = true;
        video.currentTime = video.duration;
    }
}

setInterval(() => {
    removePlayerAD('removePlayerAD');
    if (document.readyState !== 'loading') {
        window.addEventListener('beforeunload', () => {
            window.localStorage.setItem('lastUrl', window.location.href);
        }, { once: true });
        generateRemoveADHTMLElement('removeADHTMLElement');
    }
}, 500);

})();