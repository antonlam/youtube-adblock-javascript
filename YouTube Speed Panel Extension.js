// ==UserScript==
// @name         YouTube Speed Panel Extension
// @namespace    http://tampermonkey.net/
// @version      1.0
// @author       Anton
// @description  Extend YouTube's variable speed panel with extra presets and a 10x slider, with minimal overhead.
// @match        https://www.youtube.com/*
// @grant        none
// ==/UserScript==


(function () {
  'use strict';

  const DEBUG = true;
  const EXTRA_SPEEDS = [3.0, 5.0, 7.0, 9.0, 10.0];
  const SLIDER_MIN = 0.25;
  const SLIDER_MAX = 10;
  const SLIDER_STEP = 0.05;
  const STYLE_ID = 'yt-speed-panel-two-row-native-style';

  function log(...args) {
    if (!DEBUG) return;
    console.log('[YT-Speed-Panel-Ext]', ...args);
  }

  function getVideo() {
    const v =
      document.querySelector('video.html5-main-video') ||
      document.querySelector('video');
    return v;
  }

   function injectStyles() {
    if (document.getElementById(STYLE_ID)) {
      return;
    }

    const style = document.createElement('style');
    style.id = STYLE_ID;

    style.textContent = `
      /*
       * Apply only while the native variable-speed screen is visible.
       * The larger panel prevents a second row from being clipped.
       */
      .ytp-popup.ytp-settings-menu:has(.ytp-variable-speed-panel-content) {
        width: 330px !important;
        height: 310px !important;
      }

      .ytp-popup.ytp-settings-menu:has(.ytp-variable-speed-panel-content)
      .ytp-panel {
        width: 330px !important;
        height: 310px !important;
      }

      .ytp-variable-speed-panel-content {
        height: 253px !important;
        overflow: visible !important;
      }

      /*
       * Five buttons on each row.
       * A sixth native preset automatically moves to the next row.
       */
      .ytp-variable-speed-panel-chips {
        display: grid !important;
        grid-template-columns: repeat(5, minmax(0, 1fr)) !important;
        grid-auto-rows: 38px !important;
        gap: 8px 6px !important;

        width: 100% !important;
        min-height: 84px !important;
        height: auto !important;
        padding: 4px 12px 10px !important;

        overflow: visible !important;
        box-sizing: border-box !important;
      }

      .ytp-variable-speed-panel-chips
      .ytp-variable-speed-panel-preset-button-wrapper {
        display: block !important;
        width: auto !important;
        min-width: 0 !important;
        height: 38px !important;
        margin: 0 !important;
      }

      .ytp-variable-speed-panel-chips
      .ytp-variable-speed-panel-preset-button {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;

        width: 100% !important;
        min-width: 0 !important;
        height: 38px !important;
        margin: 0 !important;
      }

      /*
       * Retain the native Premium marker's position when YouTube shows it.
       */
      .ytp-variable-speed-panel-chips
      .ytp-variable-speed-panel-premium-upsell-icon {
        flex: 0 0 auto !important;
        margin-left: 3px !important;
      }

      .ytp-variable-speed-panel-preset-button-wrapper:has(
        .ytp-variable-speed-panel-premium-upsell-icon
      ) {
        visibility: hidden !important;
        pointer-events: none !important;
        display: none !important;
      }
    `;

    document.head.appendChild(style);
    log('Two-row native preset style injected');
  }

  function getSpeedPanel() {
    const popup = document.querySelector('.ytp-popup.ytp-settings-menu');
    if (!popup) return null;
    const content = popup.querySelector('.ytp-variable-speed-panel-content');
    if (!content) return null;
    return { popup, content };
  }

  function logPremiumGate(content) {
    const premiumBadge = content.querySelector('.ytp-variable-speed-panel-premium-badge');
    const premiumIcon = content.querySelector('.ytp-variable-speed-panel-premium-upsell-icon');
    const premiumChipWrapper = premiumIcon ? premiumIcon.closest('.ytp-variable-speed-panel-preset-button-wrapper') : null;

    log('Premium gate:', {
      badgeFound: !!premiumBadge,
      iconFound: !!premiumIcon,
      chipWrapperFound: !!premiumChipWrapper
    });
  }

  function patchSlider(content) {
    const slider = content.querySelector('input.ytp-varispeed-input-slider.ytp-input-slider');
    if (!slider) {
      log('patchSlider(): slider not found');
      return;
    }

    slider.min = String(SLIDER_MIN);
    slider.max = String(SLIDER_MAX);
    slider.step = String(SLIDER_STEP);

    const indicatorText = content.querySelector('.ytp-speedslider-text');

    slider.addEventListener('input', () => {
      const v = getVideo();
      if (!v) return;
      const rate = parseFloat(slider.value);
      v.playbackRate = rate;
      v.dispatchEvent(new Event('ratechange'));
      if (indicatorText) {
        indicatorText.textContent = `${rate.toFixed(2).replace(/\.00$/, ':--')}x`;
      }
      log('slider input', rate);
    }, { once: false });

    log('patchSlider(): slider patched', {
      min: slider.min,
      max: slider.max,
      step: slider.step
    });
  }

   function updateSpeedWording(content, speed) {
        const text = `${Number(speed).toFixed(2)}x`;

        // Large readout at the top of the speed panel, e.g. "1.50x"
        const mainDisplay = content.querySelector(
            '.ytp-variable-speed-panel-display > span'
        );

        // Label above the slider thumb
        const sliderDisplay = content.querySelector(
            '.ytp-speedslider-text'
        );

        if (mainDisplay) {
            mainDisplay.textContent = text;
        }

        if (sliderDisplay) {
            sliderDisplay.textContent = text;
        }
    }

  function patchPresetChips(content) {
    const chipsContainer = content.querySelector('.ytp-variable-speed-panel-chips');
    if (!chipsContainer) {
      log('patchPresetChips(): chips container not found');
      return;
    }

    // Remove previous extras for this open
    chipsContainer.querySelectorAll('.ytp-variable-speed-panel-extra-chip').forEach(el => el.remove());

    EXTRA_SPEEDS.forEach(speed => {
      const wrapper = document.createElement('div');
      wrapper.className = 'ytp-variable-speed-panel-preset-button-wrapper ytp-variable-speed-panel-extra-chip';
      wrapper.setAttribute('aria-hidden', 'false');

      const button = document.createElement('button');
      button.className = 'ytp-button ytp-variable-speed-panel-preset-button ytp-variable-speed-panel-button';
      button.type = 'button';

      const span = document.createElement('span');
      span.textContent = `${speed.toFixed(1)}`;

      button.appendChild(span);
      wrapper.appendChild(button);

      button.addEventListener('click', () => {
        const v = getVideo();
        if (!v) return;
        v.playbackRate = speed;
        v.dispatchEvent(new Event('ratechange'));

      const slider = content.querySelector('input.ytp-varispeed-input-slider.ytp-input-slider');
          if (!slider) {
              log('patchSlider(): slider not found');
              return;
          }
      slider.value = speed;

      updateSpeedWording(document, speed);

        log('extra chip clicked', speed);
      });

      chipsContainer.appendChild(wrapper);
      log('patchPresetChips(): extra chip added', speed);
    });
  }

  function patchOnceWhenPanelIsOpen() {
    const panel = getSpeedPanel();
    if (!panel) return;
    const { popup, content } = panel;
    const innerPanel = content.closest('.ytp-panel');

    popup.style.width = '330px';
    popup.style.height = '330px';

    if (innerPanel) {
      innerPanel.style.width = '330px';
      innerPanel.style.height = '330px';
    }

    // Avoid re-patching the same instance
    if (content.__ytSpeedPanelPatched) {
      return;
    }
    content.__ytSpeedPanelPatched = true;

    log('patchOnceWhenPanelIsOpen(): patching');

    logPremiumGate(content);
    patchSlider(content);
    patchPresetChips(content);

    log('patchOnceWhenPanelIsOpen(): done');
  }

  // Observe only the settings popup area, not the whole document
  function setupObserver() {
    const root = document.body || document.documentElement;
    if (!root) return;

    const observer = new MutationObserver(() => {
      // When DOM changes, try once; cheap check
      patchOnceWhenPanelIsOpen();
    });

    observer.observe(root, { childList: true, subtree: true });
    log('MutationObserver set up');
  }

  // Initial setup
  document.addEventListener('DOMContentLoaded', () => {
    setupObserver();
  });

  window.addEventListener('load', () => {
    setupObserver();
  });

   window.addEventListener('yt-navigate-finish', () => {
    injectStyles();
  });
})();