// ==UserScript==
// @name         Display Info v4
// @namespace    http://tampermonkey.net/
// @version      2025-09-21
// @description  Store and get YouTube common info
// @author       Anton
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Global variables for tracking state and user preferences
    let previousUrl = ''; // Track previous URL to detect page changes
    let alwaysPlay = localStorage.getItem('alwaysPlay') === 'true'; // User preference for auto-play functionality
    let hasFirstUntickOccurred = localStorage.getItem('hasFirstUntickOccurred') === 'true'; // Track if user has disabled auto-play at least once

    function containerInfoBlk(targetXPath, player, setting) {
        // Find the target element using XPath (YouTube's metadata section)
        const targetElement = document.evaluate(
            targetXPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;

        if (targetElement) {
            // Check if our custom info display already exists
            let div = targetElement.querySelector('div[data-custom-text="video-time"]');
            if (!div) {
                // Create the main container div with custom styling
                div = document.createElement('div');
                div.setAttribute('data-custom-text', 'video-time'); // Custom attribute for identification

                // Apply dark theme styling to match YouTube's interface
                div.style.padding = '10px';
                div.style.color = '#ffffff'; // White text
                div.style.backgroundColor = "#121212"; // Dark background
                div.style.border = '1px solid grey'; // Subtle border
                div.style.width = "50%"; // Take up half the available width
                div.style.whiteSpace = "pre"; // Preserve formatting for multi-line text
                div.style.borderRadius = "10px"; // Rounded corners
                div.style.marginLeft = "2%"; // Small left margin
                div.style.display = "flex"; // Flexbox layout
                div.style.alignItems = "center"; // Center align items vertically
                div.style.gap = "10px"; // Space between elements

                // Create span element to hold the video information text
                const textSpan = document.createElement('span');
                textSpan.setAttribute('data-custom-text', 'video-info'); // Custom attribute for identification
                div.appendChild(textSpan);

                // Create the "Always Play" checkbox control
                const radioLabel = document.createElement('label');
                radioLabel.style.color = '#ffffff'; // White text color
                radioLabel.style.display = 'flex'; // Flexbox layout
                radioLabel.style.alignItems = 'center'; // Center align items
                radioLabel.style.cursor = 'pointer'; // Pointer cursor on hover

                // Create the checkbox input element
                const radioInput = document.createElement('input');
                radioInput.type = 'checkbox'; // Checkbox input type
                radioInput.style.marginRight = '5px'; // Right margin for spacing
                radioInput.checked = alwaysPlay; // Initialize with saved preference from localStorage

                // Create the label text
                const radioText = document.createTextNode('Always Play');
                radioLabel.appendChild(radioInput);
                radioLabel.appendChild(radioText);

                // Event listener for checkbox changes - saves user preference
                radioInput.addEventListener('change', () => {
                    alwaysPlay = radioInput.checked; // Update local variable
                    localStorage.setItem('alwaysPlay', alwaysPlay); // Save to browser storage
                    if (alwaysPlay) {
                        // Reset the "first untick" flag when re-enabling auto-play
                        localStorage.setItem('hasFirstUntickOccurred', 'false');
                    }
                });

                // Assemble the complete interface
                div.appendChild(radioLabel); // Add checkbox to container
                targetElement.appendChild(div); // Add container to YouTube's page
            }

            // Get reference to the text span for updating video information
            const textSpan = div.querySelector('span[data-custom-text="video-info"]');
            let quality = "", status = ""; // Initialize quality and status variables

            // Convert time from seconds to minutes:seconds format
            const minutes = Math.floor(setting.time / 60);
            const seconds = Math.floor(setting.time % 60);

            // Map YouTube's quality codes to human-readable format
            if (player && player.getPlaybackQuality) {
                const qualityMap = {
                    'tiny': '144p',      // Very low quality
                    'small': '240p',     // Low quality
                    'medium': '360p',    // Standard quality
                    'large': '480p',     // Good quality
                    'hd720': '720p',     // HD quality
                    'hd1080': '1080p',   // Full HD quality
                    'hd1440': '1440p',   // 2K quality
                    'hd2160': '2160p',   // 4K quality
                    'highres': '4320p'   // 8K quality
                };
                // Convert quality code to readable format, fallback to original if not mapped
                quality = qualityMap[setting.quality] || setting.quality;
            }

            // Convert boolean status to readable text
            status = setting.status ? "Is Playing" : "Is Paused";

            // Update the display with formatted video information
            textSpan.textContent = `Time: ${minutes}:${seconds} - ${status} - Speed: ${setting.speed}x\nResolution: ${quality} - Mode: ${setting.mode}`;
            return true; // Successfully updated the display
        }
        return false; // Failed to find target element or update display
    }

    /**
     * Extracts comprehensive video information from YouTube's video element and player
     * @param {HTMLVideoElement} video - The video element from the page
     * @param {Object} player - YouTube player object
     * @returns {Object|null} - Video information object or null if invalid
     */

    function getVideoInfo(video, player) {
        // Validate that video exists and has valid current time
        if (video && !isNaN(video.currentTime)) {
            const time = video.currentTime; // Current playback position in seconds
            const status = !(video.paused); // True if playing, false if paused
            const speed = video.playbackRate.toFixed(2); // Playback speed (e.g., 1.25x)
            const quality = player.getPlaybackQuality(); // Video quality code from YouTube

            // Detect current viewing mode by checking for specific CSS attributes
            const isTheaterMode = document.querySelector('ytd-watch-flexy[theater]') !== null;
            const isFullScreen = document.querySelector('ytd-watch-flexy[fullscreen]') !== null;

            // Determine viewing mode based on detected states
            const mode = isFullScreen ? 'Full Screen' : isTheaterMode ? 'Theater' : 'Default';

            // Return comprehensive video information object
            return {
                "url": window.location.href.split('&')[0], // Clean URL without tracking parameters
                "time": time,           // Current time in seconds
                "status": status,       // Playback status (true/false)
                "speed": speed,         // Playback speed as string
                "quality": quality,     // Video quality code
                "mode": mode,           // Viewing mode (Default/Theater/Full Screen)
            };
        }
        return null; // Return null if video is invalid or not ready
    }

    // Main execution loop - runs every 100ms to continuously monitor and update
    const mainFunc = setInterval(function() {
        // Get references to YouTube's video element and player
        const video = document.querySelector('video'); // The actual video element
        const player = document.querySelector('.html5-video-player'); // YouTube's player wrapper

        // XPath to locate YouTube's metadata section where we'll insert our info display
        const targetXPath = '/html/body/ytd-app/div[1]/ytd-page-manager/ytd-watch-flexy/div[5]/div[1]/div/div[2]/ytd-watch-metadata/div/div[2]/div[2]';

        // Only proceed if both video and player elements are found
        if (video && player) {
            // Get current video information
            const info = getVideoInfo(video, player);
            // Update/create the information display container
            containerInfoBlk(targetXPath, player, info);

            // Handle auto-play functionality
            const alwaysPlayCheckbox = document.querySelector('div[data-custom-text="video-time"] input[type="checkbox"]');
            if (alwaysPlayCheckbox) {
                // Sync the local variable with checkbox state
                alwaysPlay = alwaysPlayCheckbox.checked;

                if (alwaysPlay) {
                    // Auto-play is enabled - ensure video plays and handle pause events
                    video.play().catch(error => {
                        console.error('Failed to play video:', error); // Log play failures
                    });

                    // Define pause handler that will resume playback if checkbox is still checked
                    const handlePause = () => {
                        if (alwaysPlayCheckbox.checked) {
                            video.play().catch(error => {
                                console.error('Pause handler failed to play video:', error);
                            });
                        }
                    };

                    // Remove any existing pause listeners to avoid duplicates
                    video.removeEventListener('pause', handlePause);
                    // Add new pause listener
                    video.addEventListener('pause', handlePause);
                } else {
                    // Auto-play is disabled - handle first-time disabling
                    if (!hasFirstUntickOccurred && !video.paused) {
                        // If this is the first time unchecking and video is playing, pause it
                        video.pause();
                        hasFirstUntickOccurred = true; // Mark that we've handled the first untick
                    }
                    // Remove auto-play pause listeners since auto-play is disabled
                    video.removeEventListener('pause', () => video.play());
                }
            }
        }
    }, 100); // Run every 100ms for real-time updates

    // Cleanup: Clear the interval when the page is about to unload to prevent memory leaks
    window.addEventListener('beforeunload', function() {
        clearInterval(mainFunc); // Stop the main monitoring loop
    });
})(); // End of the immediately invoked function expression (IIFE)