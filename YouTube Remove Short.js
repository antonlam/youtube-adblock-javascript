// ==UserScript==
// @name               Remove YouTube Shorts
// @namespace          http://tampermonkey.net/
// @version            1.0
// @author             Anton
// @icon               https://www.google.com/s2/favicons?sz=64&domain=YouTube.com
// @match              https://*.youtube.com/*
// @match              https://m.youtube.com/*
// @grant        none
// @license MIT
// ==/UserScript==

(function () {
    'use strict';

    // Development/debug flag, kept off by default.
    var dev = false;

    // Global options, grouped to match the style of the adblock script.
    var config = {
        hideHome: true,
        hideWatch: true,
        hideSearch: true,
        hideChannel: true,
        hidePlaylist: true,
        hideHistory: false,

        hideSidebar: true,
        hideMiniGuide: true,
        hideBottomNav: true,
        hideExplore: true,

        redirectShorts: true,
        detectDisguisedShorts: true,
        blockApi: false,

        updateFrequency: 500,
    };

    var stats = {
        counts: {},
        report: function (category) {
            this.counts[category] = (this.counts[category] || 0) + 1;
        },
        print: function () {
            if (!dev) return;
            var rows = Object.entries(this.counts);
            if (!rows.length) return;

            console.groupCollapsed('%cRemove YouTube Shorts - Removed', 'color:#e33;font-weight:bold');
            rows.forEach(function (item) {
                console.log(String(item[0]).padEnd(10, ' ') + ' ' + item[1]);
            });
            console.groupEnd();
        }
    };

    function log() {
        if (!dev) return;
        console.log.apply(console, ['[YT-Shorts-Remover]'].concat([].slice.call(arguments)));
    }

    function injectStyle() {
        if (document.getElementById('yt-shorts-remover-style')) return;

        var css = [
            'ytd-reel-shelf-renderer{display:none!important}',
            'ytd-rich-shelf-renderer[is-shorts-shelf]{display:none!important}',
            'ytd-rich-shelf-renderer[is-shorts]{display:none!important}',
            'ytd-rich-section-renderer{display:none!important}',
            'ytd-rich-section-renderer[is-shorts]{display:none!important}',
            'ytd-reel-item-renderer{display:none!important}',
            'ytm-reel-shelf-renderer{display:none!important}',
            'ytm-shorts-lockup-view-model{display:none!important}',
            '[is-shorts-shelf]{display:none!important}',
            '[is-shorts]{display:none!important}',
            'ytd-mini-guide-entry-renderer[aria-label="Shorts"]{display:none!important}',
            'ytd-guide-entry-renderer:has(a[title="Shorts"]){display:none!important}',
            '.pivot-shorts{display:none!important}',
            'tp-yt-paper-tab:has(> .tab-content[title="Shorts"]){display:none!important}'
        ].join(' ');

        var style = document.createElement('style');
        style.id = 'yt-shorts-remover-style';
        style.textContent = css;
        (document.head || document.documentElement).appendChild(style);
    }

    function closestContainer(el) {
        if (!el || !el.closest) return el;
        return el.closest([
            'ytd-video-renderer',
            'ytd-grid-video-renderer',
            'ytd-compact-video-renderer',
            'ytd-rich-item-renderer',
            'ytd-rich-shelf-renderer',
            'ytd-reel-shelf-renderer',
            'ytd-reel-item-renderer',
            'ytd-rich-section-renderer',
            'ytd-playlist-video-renderer',
            'ytd-playlist-panel-video-renderer',
            'ytm-video-with-context-renderer',
            'ytm-shorts-lockup-view-model',
            'ytm-reel-item-renderer'
        ].join(', ')) || el;
    }

    function safeRemove(el, category) {
        if (!el || !el.isConnected) return;

        var target = closestContainer(el);
        if (target.dataset && target.dataset.ytShortsRemoved) return;
        if (target.dataset) target.dataset.ytShortsRemoved = 'true';

        target.remove();
        stats.report(category);
        log('removed [' + category + ']', target);
    }

    function isShortsLink(el) {
        if (!el) return false;
        if (el.tagName === 'A' && el.getAttribute('href') && el.getAttribute('href').indexOf('/shorts') === 0) return true;
        if (el.querySelector && el.querySelector('a[href^="/shorts"]')) return true;
        return false;
    }

    function isShortsMarked(el) {
        if (!el) return false;
        if (el.hasAttribute && (el.hasAttribute('is-shorts') || el.hasAttribute('is-shorts-shelf'))) return true;
        if (el.querySelector && el.querySelector('[overlay-style="SHORTS"], [is-shorts], [is-shorts-shelf], [data-style="SHORTS"]')) return true;
        return false;
    }

    function isShortsTag(el) {
        if (!el || !el.tagName) return false;
        return [
            'YTD-REEL-SHELF-RENDERER',
            'YTD-REEL-ITEM-RENDERER',
            'YTM-REEL-SHELF-RENDERER',
            'YTM-REEL-ITEM-RENDERER',
            'YTM-SHORTS-LOCKUP-VIEW-MODEL'
        ].indexOf(el.tagName) !== -1;
    }

    function isShorts(el) {
        if (!el || el.nodeType !== 1) return false;
        return isShortsTag(el) || isShortsMarked(el) || isShortsLink(el);
    }

    function extractVideoId(pathname) {
        var match = pathname.match(/\/shorts\/([a-zA-Z0-9_-]{6,})/);
        return match ? match[1] : null;
    }

    function redirectIfShorts() {
        if (!config.redirectShorts) return;

        var id = extractVideoId(location.pathname);
        if (!id) return;

        var target = 'https://www.youtube.com/watch?v=' + id;
        stats.report('Redirect');
        log('redirect', location.href, '->', target);
        location.replace(target);
    }

    function hookHistoryForRedirect() {
        if (!config.redirectShorts) return;

        var wrap = function (type) {
            var original = history[type];
            history[type] = function () {
                var result = original.apply(this, arguments);
                queueMicrotask(redirectIfShorts);
                return result;
            };
        };

        wrap('pushState');
        wrap('replaceState');
        window.addEventListener('popstate', redirectIfShorts);
    }

    function hookApiBlocking() {
        if (!config.blockApi) return;

        var reelPattern = /\/youtubei\/v1\/reel\//;
        var originalFetch = window.fetch;

        window.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            if (reelPattern.test(url)) {
                log('blocked fetch:', url);
                stats.report('API');
                return Promise.resolve(new Response('{}', { status: 200 }));
            }
            return originalFetch.apply(this, arguments);
        };

        var originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function (method, url) {
            this.__ytShortsBlocked = reelPattern.test(url);
            return originalOpen.apply(this, arguments);
        };

        var originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function () {
            if (this.__ytShortsBlocked) {
                log('blocked xhr');
                stats.report('API');
                return;
            }
            return originalSend.apply(this, arguments);
        };
    }

    function filterHome(root) {
        if (!config.hideHome) return;
        root.querySelectorAll('ytd-rich-shelf-renderer[is-shorts-shelf]').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-rich-shelf-renderer[is-shorts]').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-rich-section-renderer').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-rich-section-renderer[is-shorts]').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-reel-shelf-renderer').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-rich-item-renderer a[href^="/shorts"]').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'Home'); });
    }

    function filterExplore(root) {
        if (!config.hideExplore) return;
        if (location.pathname.indexOf('/feed/explore') === -1) return;
        root.querySelectorAll('a[href^="/shorts"], [is-shorts]').forEach(function (el) { safeRemove(el, 'Explore'); });
    }

    function filterSearch(root) {
        if (!config.hideSearch) return;
        if (location.pathname.indexOf('/results') === -1) return;

        root.querySelectorAll('ytd-video-renderer [overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'Search'); });
        root.querySelectorAll('ytd-reel-shelf-renderer').forEach(function (el) { safeRemove(el, 'Search'); });

        root.querySelectorAll('ytd-shelf-renderer').forEach(function (shelf) {
            var title = shelf.querySelector('#title, yt-formatted-string#title');
            if (title && /shorts/i.test(title.textContent || '')) safeRemove(shelf, 'Search');
        });

        root.querySelectorAll('yt-chip-cloud-chip-renderer').forEach(function (chip) {
            var text = chip.textContent || '';
            if (/^\s*Shorts\s*$/i.test(text)) safeRemove(chip, 'Search');
        });
    }

    function filterWatch(root) {
        if (!config.hideWatch) return;
        if (location.pathname.indexOf('/watch') !== 0) return;

        root.querySelectorAll('#related ytd-compact-video-renderer [overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'Watch'); });
        root.querySelectorAll('#related ytd-reel-shelf-renderer').forEach(function (el) { safeRemove(el, 'Watch'); });

        root.querySelectorAll('.ytp-endscreen-content a[href^="/shorts"]').forEach(function (el) {
            var card = el.closest('.ytp-videowall-still, .ytp-suggestion-set');
            safeRemove(card || el, 'Watch');
        });
    }

    function filterChannel(root) {
        if (!config.hideChannel) return;
        if (location.pathname.indexOf('/channel') === -1 && location.pathname.indexOf('/@') === -1 && location.pathname.indexOf('/c/') === -1) return;

        root.querySelectorAll('yt-tab-shape').forEach(function (tab) {
            var title = (tab.getAttribute('tab-title') || tab.textContent || '').trim();
            if (title === 'Shorts' && !tab.dataset.ytShortsRemoved) {
                tab.dataset.ytShortsRemoved = 'true';
                tab.style.display = 'none';
                stats.report('Tabs');
            }
        });

        if (/\/(shorts)(\/)?$/.test(location.pathname)) {
            var base = location.pathname.replace(/\/shorts\/?$/, '');
            log('leaving channel shorts tab ->', base);
            location.replace('https://www.youtube.com' + base + location.search);
        }

        root.querySelectorAll('ytd-reel-shelf-renderer').forEach(function (el) { safeRemove(el, 'Channel'); });
    }

    function filterPlaylist(root) {
        if (!config.hidePlaylist) return;
        if (location.pathname.indexOf('/playlist') === -1 && location.search.indexOf('list=') === -1) return;
        root.querySelectorAll('ytd-playlist-video-renderer a[href^="/shorts"]').forEach(function (el) { safeRemove(el, 'Playlist'); });
        root.querySelectorAll('ytd-playlist-panel-video-renderer a[href^="/shorts"]').forEach(function (el) { safeRemove(el, 'Playlist'); });
    }

    function filterSubscriptions(root) {
        if (location.pathname.indexOf('/feed/subscriptions') === -1) return;
        root.querySelectorAll('ytd-grid-video-renderer [overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-video-renderer [overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'Home'); });
        root.querySelectorAll('ytd-rich-item-renderer [overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'Home'); });
    }

    function filterHistory(root) {
        if (!config.hideHistory) return;
        if (location.pathname.indexOf('/feed/history') === -1) return;
        root.querySelectorAll('ytd-reel-shelf-renderer').forEach(function (el) { safeRemove(el, 'History'); });
        root.querySelectorAll('[overlay-style="SHORTS"]').forEach(function (el) { safeRemove(el, 'History'); });
    }

    function filterSidebar(root) {
        if (config.hideSidebar) {
            root.querySelectorAll('#guide a[href^="/shorts"], #guide [title="Shorts"]').forEach(function (el) { safeRemove(el, 'Sidebar'); });

            root.querySelectorAll('ytd-guide-entry-renderer').forEach(function (entry) {
                var text = (entry.textContent || '').trim();
                if (/^Shorts$/i.test((text.split('\n')[0] || ''))) safeRemove(entry, 'Sidebar');
            });
        }

        if (config.hideMiniGuide) {
            root.querySelectorAll('.ytd-mini-guide-entry-renderer[title="Shorts"], .ytd-mini-guide-entry-renderer[aria-label="Shorts"]').forEach(function (el) {
                safeRemove(el, 'MiniGuide');
            });
        }
    }

    function filterMobile(root) {
        if (location.hostname.indexOf('m.youtube.com') === -1) return;

        if (config.hideBottomNav) {
            root.querySelectorAll('.pivot-shorts').forEach(function (el) { safeRemove(el, 'BottomNav'); });
        }

        root.querySelectorAll('ytm-reel-shelf-renderer').forEach(function (el) { safeRemove(el, 'Shelf'); });
        root.querySelectorAll('ytm-shorts-lockup-view-model').forEach(function (el) { safeRemove(el, 'Shelf'); });

        if (config.hideSearch) {
            root.querySelectorAll('ytm-search ytm-video-with-context-renderer [data-style="SHORTS"]').forEach(function (el) {
                safeRemove(el, 'Search');
            });
        }
    }

    function runAllFilters(root) {
        filterHome(root);
        filterExplore(root);
        filterSearch(root);
        filterWatch(root);
        filterChannel(root);
        filterPlaylist(root);
        filterSubscriptions(root);
        filterHistory(root);
        filterSidebar(root);
        filterMobile(root);
    }

    function checkDisguisedShorts() {
        if (!config.detectDisguisedShorts) return;
        if (location.pathname.indexOf('/watch') !== 0) return;

        var shortsPlayer = document.querySelector('ytd-shorts, #shorts-container, ytd-reel-video-renderer');
        if (!shortsPlayer) return;

        stats.report('Disguised');
        log('disguised shorts detected on watch page', shortsPlayer);

        var params = new URLSearchParams(location.search);
        var videoId = params.get('v');
        if (videoId) {
            location.replace('https://www.youtube.com/watch?v=' + videoId);
        }
    }

    function removeNonShorts(root) {
        var nodes = root.querySelectorAll([
            'ytd-reel-shelf-renderer',
            'ytd-rich-shelf-renderer[is-shorts-shelf]',
            'ytd-rich-shelf-renderer[is-shorts]',
            'ytd-rich-section-renderer',
            'ytd-rich-section-renderer[is-shorts]',
            'ytd-reel-item-renderer',
            'ytm-reel-shelf-renderer',
            'ytm-shorts-lockup-view-model',
            '[is-shorts-shelf]'
        ].join(','));

        nodes.forEach(function (el) {
            safeRemove(el, 'Shelf');
        });

        runAllFilters(root);
        checkDisguisedShorts();
        stats.print();
    }

    function hookNavigation() {
        window.addEventListener('popstate', function () {
            removeNonShorts(document);
            redirectIfShorts();
        });

        document.addEventListener('yt-navigate-finish', function () {
            removeNonShorts(document);
            redirectIfShorts();
        });
    }

    function startLoop() {
        var lastUrl = location.href;

        setInterval(function () {
            if (document.readyState === 'loading') return;

            if (location.href !== lastUrl) {
                lastUrl = location.href;
                redirectIfShorts();
            }

            removeNonShorts(document);
        }, config.updateFrequency);
    }

    function init() {
        log('Remove YouTube Shorts reworked script initialized');

        injectStyle();
        hookHistoryForRedirect();
        hookApiBlocking();
        redirectIfShorts();
        removeNonShorts(document);
        hookNavigation();
        startLoop();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
