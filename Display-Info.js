// ==UserScript==
// @name         Display Info v3
// @namespace    http://tampermonkey.net/
// @version      2025-09-21
// @description  Store and get YouTube common info
// @author       Anton
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let previousUrl = '';
    let alwaysPlay = localStorage.getItem('alwaysPlay') === 'true';
    let hasFirstUntickOccurred = localStorage.getItem('hasFirstUntickOccurred') === 'true';

    var videoInfo = {
        "url": "",
        "time": 0,
        "status": '',
        "speed": 1.0,
        "quality": '',
        "mode": '',
    };

    function containerInfoBlk(targetXPath, player, setting) {
        const targetElement = document.evaluate(
            targetXPath,
            document,
            null,
            XPathResult.FIRST_ORDERED_NODE_TYPE,
            null
        ).singleNodeValue;

        if (targetElement) {
            let div = targetElement.querySelector('div[data-custom-text="video-time"]');
            if (!div) {
                div = document.createElement('div');
                div.setAttribute('data-custom-text', 'video-time');
                div.style.padding = '10px';
                div.style.color = '#ffffff';
                div.style.backgroundColor = "#121212";
                div.style.border = '1px solid grey';
                div.style.width = "50%";
                div.style.whiteSpace = "pre";
                div.style.borderRadius = "10px";
                div.style.marginLeft = "2%";
                div.style.display = "flex";
                div.style.alignItems = "center";
                div.style.gap = "10px";

                const textSpan = document.createElement('span');
                textSpan.setAttribute('data-custom-text', 'video-info');
                div.appendChild(textSpan);

                const radioLabel = document.createElement('label');
                radioLabel.style.color = '#ffffff';
                radioLabel.style.display = 'flex';
                radioLabel.style.alignItems = 'center';
                radioLabel.style.cursor = 'pointer';

                const radioInput = document.createElement('input');
                radioInput.type = 'checkbox';
                radioInput.style.marginRight = '5px';
                radioInput.checked = alwaysPlay; // Initialize with localStorage value

                const radioText = document.createTextNode('Always Play');
                radioLabel.appendChild(radioInput);
                radioLabel.appendChild(radioText);

                // Update alwaysPlay state and localStorage on change
                radioInput.addEventListener('change', () => {
                    alwaysPlay = radioInput.checked;
                    localStorage.setItem('alwaysPlay', alwaysPlay);
                    if (alwaysPlay) {
                        localStorage.setItem('hasFirstUntickOccurred', 'false');
                    }
                });

                div.appendChild(radioLabel);
                targetElement.appendChild(div);
            }

            const textSpan = div.querySelector('span[data-custom-text="video-info"]');
            let quality = "", status = "";
            const minutes = Math.floor(setting.time / 60);
            const seconds = Math.floor(setting.time % 60);

            if (player && player.getPlaybackQuality) {
                const qualityMap = {
                    'tiny': '144p',
                    'small': '240p',
                    'medium': '360p',
                    'large': '480p',
                    'hd720': '720p',
                    'hd1080': '1080p',
                    'hd1440': '1440p',
                    'hd2160': '2160p',
                    'highres': '4320p'
                };
                quality = qualityMap[setting.quality] || setting.quality;
            }
            status = setting.status ? "Is Playing" : "Is Paused";
            textSpan.textContent = `Time: ${minutes}:${seconds} - ${status} - Speed: ${setting.speed}x\nResolution: ${quality} - Mode: ${setting.mode}`;
            return true;
        }
        return false;
    }

    function getVideoInfo(video, player) {
        if (video && !isNaN(video.currentTime)) {
            const time = video.currentTime;
            const status = !(video.paused);
            const speed = video.playbackRate.toFixed(2);
            const quality = player.getPlaybackQuality();
            const isTheaterMode = document.querySelector('ytd-watch-flexy[theater]') !== null;
            const isFullScreen = document.querySelector('ytd-watch-flexy[fullscreen]') !== null;
            const mode = isFullScreen ? 'Full Screen' : isTheaterMode ? 'Theater' : 'Default';
            return {
                "url": window.location.href.split('&')[0],
                "time": time,
                "status": status,
                "speed": speed,
                "quality": quality,
                "mode": mode,
            };
        }
    }

    function setVideoInfo(video, player, setting) {
        if (!video || !player) {
            console.log('Video or player element not found');
            return false;
        }
        try {
            video.currentTime = setting.time;
            video.play();
            video.playbackRate = setting.speed;
            player.setPlaybackQuality(setting.quality);
            const watchFlexy = document.querySelector('ytd-watch-flexy');
            if (setting.mode == "Full Screen") {
                player.enterFullScreen();
            } else if (setting.mode == "Theater") {
                const theaterButton = document.querySelector('.ytp-size-button');
                if (theaterButton) theaterButton.click();
            } else if (setting.mode == "Default") {
                player.exitFullScreen();
            }
        } catch (e) {
            console.log(e);
        }
    }

    function checkPageLoadTime(video, player, currentUrl) {
        if (currentUrl !== previousUrl) {
            previousUrl = currentUrl;
            let loadCount = parseInt(localStorage.getItem(currentUrl + '_loadCount') || '0', 10);
            loadCount++;
            localStorage.setItem(currentUrl + '_loadCount', loadCount);

            const storedInfo = localStorage.getItem(currentUrl + '_videoInfo');
            if (storedInfo) {
                try {
                    const parsedInfo = JSON.parse(storedInfo);
                    if (video && player) {
                        setVideoInfo(video, player, parsedInfo);
                    }
                } catch (e) {
                    console.error('Error parsing stored video info:', e);
                }
            }
        }
    }

    function oldstoreVideoInfo(url, info) {
        try {
            localStorage.setItem(url + '_videoInfo', JSON.stringify(info));
        } catch (e) {
            console.error('Error storing video info:', e);
        }
    }

    function storeVideoInfo(url, info) {
    try {
        // Store the new video info
        localStorage.setItem(url + '_videoInfo', JSON.stringify(info));

        // Track all video info keys
        const videoKeys = Object.keys(localStorage).filter(key => key.endsWith('_videoInfo'));
        const maxVideos = 20;

        // If more than 20 video info entries exist, remove the oldest
        if (videoKeys.length > maxVideos) {
            // Sort keys by load count to identify the oldest (lowest load count)
            const sortedKeys = videoKeys.sort((a, b) => {
                const loadCountA = parseInt(localStorage.getItem(a.replace('_videoInfo', '_loadCount')) || '0', 10);
                const loadCountB = parseInt(localStorage.getItem(b.replace('_videoInfo', '_loadCount')) || '0', 10);
                return loadCountA - loadCountB; // Oldest has lowest load count
            });

            // Remove the oldest video info and its load count
            const oldestKey = sortedKeys[0];
            localStorage.removeItem(oldestKey); // Remove video info
            localStorage.removeItem(oldestKey.replace('_videoInfo', '_loadCount')); // Remove associated load count
        }
    } catch (e) {
        console.error('Error storing video info:', e);
    }
}

    const mainFunc = setInterval(function() {
        const video = document.querySelector('video');
        const player = document.querySelector('.html5-video-player');
        const targetXPath = '/html/body/ytd-app/div[1]/ytd-page-manager/ytd-watch-flexy/div[5]/div[1]/div/div[2]/ytd-watch-metadata/div/div[2]/div[2]';
        if (video && player) {
            const info = getVideoInfo(video, player);
            containerInfoBlk(targetXPath, player, info);
            const currentUrl = window.location.href.split('&')[0];
            //checkPageLoadTime(video, player, currentUrl);
            //storeVideoInfo(currentUrl, info);

            const alwaysPlayCheckbox = document.querySelector('div[data-custom-text="video-time"] input[type="checkbox"]');
            if (alwaysPlayCheckbox) {
                alwaysPlay = alwaysPlayCheckbox.checked; // Sync with checkbox
                //localStorage.setItem('alwaysPlay', alwaysPlay); // Update localStorage

                if (alwaysPlay) {
                    video.play().catch(error => {
                        console.error('Failed to play video:', error);
                    });
                    // Add pause handler to enforce always play
                    const handlePause = () => {
                        if (alwaysPlayCheckbox.checked) {
                            video.play().catch(error => {
                                console.error('Pause handler failed to play video:', error);
                            });
                        }
                    };
                    video.removeEventListener('pause', handlePause);
                    video.addEventListener('pause', handlePause);
                } else {
                    if (!hasFirstUntickOccurred && !video.paused) {
                        video.pause();
                        hasFirstUntickOccurred = true;
                        //localStorage.setItem('hasFirstUntickOccurred', 'true');
                    }
                    // Remove pause handler when alwaysPlay is off
                    video.removeEventListener('pause', () => video.play());
                }
            }
        }
    }, 100);

    window.addEventListener('beforeunload', function() {
        clearInterval(mainFunc);
    });
})();