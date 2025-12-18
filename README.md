# YouTube Enhancement Suite - Tampermonkey Scripts

A powerful collection of Tampermonkey userscripts that enhance your YouTube experience by blocking ads, displaying video information, and providing auto-play functionality.

## **Never pop up again ↓**<br>
<img width="568" height="324" alt="image" src="https://github.com/user-attachments/assets/700837fd-7b53-4bc6-9b0c-71ab69be0f40" />

## Scripts Overview

### 1. YouTube Adblock v4 (`YouTube Adblock video.js`)
Blocks YouTube ads, removes various advertising elements, and automatically dismisses adblock warning popups.

https://greasyfork.org/zh-TW/scripts/550443-youtube-adblock-v4 

### 2. Display Info v4 (`Display-Info.js`)
Displays real-time video information and provides auto-play functionality with persistent settings.

## Combined Features

- **Complete Ad Blocking**: Removes all types of YouTube advertisements
- **Real-time Video Info**: Shows current time, playback status, speed, quality, and viewing mode
- **Auto-play Control**: Optional feature to automatically resume paused videos
- **Premium Prompt Removal**: Eliminates YouTube Premium subscription prompts
- **Visual Enhancement**: Clean interface with customizable information display
- **Persistent Settings**: Remembers your preferences using localStorage

## Installation

### Prerequisites
- **Tampermonkey / Userscript** browser extension installed
  - [Chrome/Edge](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
  - [Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/)
  - [Safari](https://apps.apple.com/us/app/tampermonkey/id1482490089](https://apps.apple.com/us/app/userscripts/id1463298887 )

### Setup Instructions

#### Method 1: Individual Installation
1. Install the Tampermonkey extension
2. Open Tampermonkey dashboard
3. Click "Create a new script"
4. Copy and paste the contents of `YouTube Adblock video.js`
5. Save the script (Ctrl+S)
6. Repeat steps 3-5 for `Display-Info.js`
7. Navigate to YouTube and enjoy enhanced viewing!

#### Method 2: Bulk Installation
1. Install Tampermonkey / Userscript extension
2. Open Tampermonkey dashboard
3. Click "Create a new script" for each file
4. Copy and paste both scripts
5. Save both scripts
6. Refresh YouTube page

## Script Details

### YouTube Adblock v4 Features

#### Ad Blocking Capabilities
- **Video Ad Blocking**: Automatically skips video ads by fast-forwarding to the end
- **Display Ad Removal**: Hides banner ads, sidebar ads, and other display advertisements
- **Premium Prompts Removal**: Removes YouTube Premium subscription prompts and overlays
- **Companion Ad Blocking**: Blocks companion ads and engagement panel advertisements
- **Adblock Warning Removal**: Automatically dismisses YouTube's adblock detection warnings
- **Mobile Compatibility**: Excludes mobile YouTube to avoid conflicts

#### Technical Implementation
- **CSS Injection**: Injects CSS rules to hide various ad elements
- **Video Detection**: Monitors for video ads and automatically skips them
- **DOM Manipulation**: Removes premium subscription popups and overlays
- **Anti-Detection**: Uses random timing intervals to avoid pattern detection
- **Continuous Monitoring**: Runs every 500ms to catch new ads as they appear
- **Player Status Monitoring**: Tracks video playback state and auto-plays paused videos

#### Ad Types Blocked
- Masthead advertisements (`#masthead-ad`)
- Video overlay ads (`.video-ads.ytp-ad-module`)
- Sidebar advertisements (`ytd-ad-slot-renderer`)
- Premium subscription prompts (`ytd-popup-container:has(a[href="/premium"])`)
- Mealbar promotions (`yt-mealbar-promo-renderer`)
- Engagement panel ads (`ytd-engagement-panel-section-list-renderer`)
- Companion advertisements (`ytm-companion-ad-renderer`)
- Related video ads (`#related #player-ads`)

### Display Info v4 Features

#### Information Display
- **Current Time**: Shows video timestamp in MM:SS format
- **Playback Status**: Displays "Is Playing" or "Is Paused"
- **Playback Speed**: Shows current speed multiplier (e.g., 1.25x)
- **Video Quality**: Displays resolution (144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2160p, 4320p)
- **Viewing Mode**: Shows current mode (Default, Theater, Full Screen)
- **URL Tracking**: Captures clean video URLs without tracking parameters

#### Auto-play Functionality
- **Always Play Checkbox**: Optional feature to automatically resume paused videos
- **Persistent Settings**: Remembers your auto-play preference using localStorage
- **Smart Pause Handling**: Intelligently manages video pause/resume behavior
- **Error Handling**: Gracefully handles play failures with console logging
- **First-time Detection**: Tracks when auto-play is disabled for the first time

#### Visual Interface
- **Custom Display Box**: Dark-themed information panel with rounded corners
- **Responsive Design**: Adapts to different screen sizes (50% width)
- **Clean Typography**: Easy-to-read white text on dark background (#121212)
- **Integrated Controls**: Checkbox for auto-play functionality
- **Flexbox Layout**: Modern CSS layout for better alignment

## Configuration Options

### YouTube Adblock v4
- **Update Frequency**: Currently set to 500ms intervals for optimal performance
- **Ad Selectors**: Modify `cssArrObject` array to add/remove specific ad selectors
- **Mobile Exclusion**: Script automatically excludes mobile YouTube
- **Random Timing**: Uses random intervals to avoid detection patterns
- **Auto-play Logic**: Automatically plays videos paused within first 5 seconds

### Display Info v4
- **Auto-play Setting**: Toggle via checkbox in the info panel
- **Display Position**: Information appears below video metadata using XPath targeting
- **Quality Mapping**: Customizable quality resolution mapping with fallback support
- **Update Frequency**: 100ms intervals for real-time updates
- **localStorage**: Persistent settings storage for user preferences

## Compatibility

### Supported Browsers
- Chrome (with Tampermonkey)
- Firefox (with Tampermonkey)
- Safari (with Userscript)
- Edge (with Tampermonkey)

### Platform Support
- **Desktop**: Full support for both scripts
- **Mobile**: Adblock script excludes mobile YouTube; Display Info works on mobile
- **YouTube Versions**: Compatible with current YouTube layout

### Script Managers
- **Tampermonkey**: Primary support
- **GreaseMonkey**: Compatible

## Usage Guide

### Basic Usage
1. Install both scripts following the installation instructions
2. Navigate to any YouTube video
3. The adblock script will automatically remove ads
4. The display info script will show video information below the video

### Auto-play Feature
1. Look for the "Always Play" checkbox in the info panel
2. Check the box to enable auto-play functionality
3. Your preference will be saved and remembered for future sessions
4. Uncheck to disable auto-play

### Troubleshooting

#### Ads Still Appearing?
1. Ensure both scripts are installed and enabled
2. Check that Tampermonkey is active for YouTube
3. Try refreshing the page
4. Clear browser cache
5. Verify script permissions

#### Display Info Not Showing?
1. Ensure the script is installed correctly
2. Check browser console for errors
3. Verify you're on a YouTube video page
4. Try refreshing the page

#### Auto-play Not Working?
1. Ensure the checkbox is checked
2. Check browser console for error messages
3. Verify localStorage is not disabled
4. Try unchecking and rechecking the box

#### Performance Issues?
Both scripts are optimized for minimal performance impact:
- Reduce update frequency if needed
- Disable other YouTube-related extensions temporarily
- Clear browser cache and restart browser

## Technical Specifications

### YouTube Adblock v4
- **Script Version**: 4.0 (2025-09-21)
- **Update Frequency**: 500ms
- **Grant Permissions**: None (runs in page context)
- **Namespace**: http://tampermonkey.net/
- **License**: MIT
- **Features**: Anti-detection, player status monitoring, adblock warning removal

### Display Info v4
- **Script Version**: 4.0 (2025-09-21)
- **Update Frequency**: 100ms
- **Grant Permissions**: None (runs in page context)
- **Namespace**: http://tampermonkey.net/
- **Storage**: Uses localStorage for settings persistence
- **Features**: Real-time info display, auto-play control, XPath targeting

## Contributing

Feel free to contribute to this project by:
- Reporting bugs or issues
- Suggesting new ad selectors
- Improving code efficiency
- Adding new features
- Enhancing the user interface
- Creating documentation improvements

## Disclaimer

These scripts are for educational and personal use only. Please:
- Respect YouTube's Terms of Service
- Consider supporting content creators through legitimate means
- Use responsibly and in accordance with local laws
- Understand that these scripts may become outdated as YouTube updates

## License

MIT License - Feel free to use, modify, and distribute as needed.

## Changelog

### Version 4.0 (Latest Release - 2025-09-21)
- **YouTube Adblock v4**:
  - Added adblock warning detection and automatic dismissal
  - Implemented anti-detection with random timing intervals
  - Enhanced player status monitoring and auto-play functionality
  - Improved error handling and null checks
  - Added comprehensive inline documentation
  - Updated ad selectors for current YouTube layout
  - Optimized performance with 500ms update intervals

### Version 4.0 (Previous Release)
- **Display Info v4**:
  - Real-time video information display with XPath targeting
  - Auto-play functionality with persistent localStorage settings
  - Improved visual design with dark theme and flexbox layout
  - Enhanced error handling and reliability
  - Added quality mapping with fallback support
  - Comprehensive inline documentation and comments

## Support

For issues, questions, or contributions:
1. Check the troubleshooting section above
2. Review browser console for error messages
3. Ensure both scripts are properly installed
4. Verify Tampermonkey/Userscript is working correctly

---

**Note**: These scripts work by modifying YouTube's interface on the client side. Always ensure you're using them responsibly and in accordance with your local laws and YouTube's terms of service.
