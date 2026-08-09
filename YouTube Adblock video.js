// ==UserScript==
// @name         Youtube-Adblock v5.0
// @namespace    http://tampermonkey.net/
// @version      2026-08-09
// @description  Youtube Adblock v4
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
    'use strict'; // Enable strict mode for better error handling
    window.dev = false; // Development mode flag (currently disabled)

    const config = {
        // second
        // Configuration settings for the adblock script
        autoPlayTime: 5, // Time in seconds to auto-play video if paused
        adsBeforeEndTime: 0.1, // Time in seconds before ad finish to skip

        // milliseconds
        logInterval: 500, // Interval in milliseconds for logging player status
        randomThreshold: 1000, // Random threshold for adblock warning check interval
        warningCheckRandomRange: 500, // Random range for adblock warning check interval
        removePopupDelayTime: 3000 // Delay time in milliseconds before removing adblock warning popup
    };

    // Array of CSS selectors for different types of YouTube ads to block
    var cssArrObject = [
        `#masthead-ad`,                                                                    // Top banner ads
        `ytd-rich-item-renderer.style-scope.ytd-rich-grid-row #content:has(.ytd-display-ad-renderer)`, // Rich grid display ads
        `.video-ads.ytp-ad-module`,                                                       // Video overlay ads
        `tp-yt-paper-dialog:has(yt-mealbar-promo-renderer)`,                             // Mealbar promo dialogs
        `ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-ads"]`, // Engagement panel ads
        `#related #player-ads`,                                                           // Related video ads
        `#related ytd-ad-slot-renderer`,                                                 // Related ad slots
        `ytd-ad-slot-renderer`,                                                          // General ad slot renderers
        `yt-mealbar-promo-renderer`,                                                     // Mealbar promo renderers
        `ytd-popup-container:has(a[href="/premium"])`,                                   // Premium subscription popups
        `ad-slot-renderer`,                                                              // Generic ad slot renderers
        `ytm-companion-ad-renderer`,                                                     // Companion ads (mobile)
        `#related #-ad-`,                                                                // Related section ads
    ];


    function removeNonVideoAds(arry) {
        // Convert each selector to a CSS rule that hides the element
        arry.forEach((selector, index) => {
            arry[index] = `${selector}{display:none!important}`; // Force hide with !important
        });

        // Find and remove YouTube Premium subscription popup containers
        const premiumContainers = [...document.querySelectorAll(`ytd-popup-container`)];
        const matchingContainers = premiumContainers.filter(container =>
            container.querySelector(`a[href="/premium"]`) // Look for premium subscription links
        );

        // Remove all premium popup containers if found
        if (matchingContainers.length > 0) {
            matchingContainers.forEach(container => container.remove());
        }

        // Handle overlay backdrops that might block interaction
        const backdrops = document.querySelectorAll(`tp-yt-iron-overlay-backdrop`);
        const targetBackdrop = Array.from(backdrops).find(
            (backdrop) => backdrop.style.zIndex === `2201` // Specific z-index for premium overlays
        );

        // Remove the target backdrop if found
        if (targetBackdrop) {
            targetBackdrop.className = ``; // Clear CSS classes
            targetBackdrop.removeAttribute(`opened`); // Remove opened attribute
        }

        // Create and inject CSS style element to hide ads
        let style = document.createElement(`style`);
        (document.head || document.body).appendChild(style); // Add to document head or body
        style.appendChild(document.createTextNode(arry.join(` `))); // Join all CSS rules with spaces
    }

    /**
     * Skips video ads by fast-forwarding to the end
     * @param {HTMLVideoElement} video - The video element showing the ad
     */
    function skipAd(video) {
        // Look for various ad skip button indicators
        const adIndicator = document.querySelector(
            '.ytp-ad-skip-button, .ytp-skip-ad-button, .ytp-ad-skip-button-modern, ' +
            '.video-ads.ytp-ad-module .ytp-ad-player-overlay, .ytp-ad-button-icon'
        );

        // Only skip ads if indicator is found and not on mobile YouTube
        if (adIndicator && !window.location.href.includes('https://m.youtube.com/')) {
            video.muted = true; // Mute the ad video
            video.currentTime = video.duration - config.adsBeforeEndTime; // Jump to near the end (0.1 seconds before finish)
        }
    }

    let warningInterval = null;
    let warningCloseScheduled = false;

    function removeAdblockWarning() {
        // Prevent multiple intervals if this function is called repeatedly
        if (warningInterval !== null) {
            return;
        }

        const checkInterval =
            config.randomThreshold +
            Math.random() * config.warningCheckRandomRange;

        warningInterval = setInterval(() => {
            const popupExists =
                document.getElementsByClassName(
                    "style-scope ytd-popup-container"
                ).length > 0;

            const dismissButton = document.getElementById("dismiss-button");
            const divider = document.getElementById("divider");

            if (
                !popupExists ||
                !dismissButton ||
                !divider ||
                warningCloseScheduled
            ) {
                return;
            }

            warningCloseScheduled = true;

            const closeDelay =
                Math.random() * config.removePopupDelayTime;

            setTimeout(() => {
                // Check that the button still exists before clicking
                const playButton = document.querySelector(".ytp-play-button.ytp-button");
                const currentDismissButton = document.getElementById("dismiss-button");
                if(currentDismissButton) currentDismissButton.click();
                if(playButton) playButton.click();

                console.log("Banner closed");

                clearInterval(warningInterval);
                warningInterval = null;
                warningCloseScheduled = false;
            }, closeDelay);
        }, checkInterval);
    }

    // Main execution loop - runs every config.logInterval ms to continuously monitor and block ads
    setInterval(() => {
        // Only run when page is fully loaded
        if (document.readyState !== 'loading') {
            // Save current URL to localStorage when leaving page (for potential resume functionality)
            window.addEventListener('beforeunload', () => {
                window.localStorage.setItem('lastUrl', window.location.href);
            }, { once: true }); // Only add listener once

            // Remove all non-video ads using CSS injection
            removeNonVideoAds(cssArrObject);

            // Monitor and remove adblock warning popups
            removeAdblockWarning();

            // Get video elements for ad skipping and player status monitoring
            var adsVideo = document.querySelector('.ad-showing video'); // Video element showing ads
            var mainVideo = document.querySelector('video'); // Main video player element

            // Monitor main video player status and handle auto-play functionality
            if(mainVideo) {
                // Get current player status information
                var playerStatus = {
                    currentTime: mainVideo.currentTime,  // Current playback position in seconds
                    isPaused: mainVideo.paused,          // Whether video is paused (true/false)
                    speed: mainVideo.playbackRate        // Current playback speed (1.0 = normal)
                };

                // Uncomment the line below to log player status to console for debugging
                // console.log('YouTube Player Status:', playerStatus);

                // Auto-play video if it's paused and at the beginning (5 seconds or less)
                if(playerStatus.currentTime <= config.autoPlayTime && playerStatus.isPaused == true){
                    mainVideo.play().catch(error => {
                        console.error('Failed to play video:', error); // Log play errors
                    });
                }
            }

            // Skip any video ads that are currently playing
            skipAd(adsVideo);
        }
    }, config.logInterval); // Run every config.logInterval ms for real-time ad blocking

})();