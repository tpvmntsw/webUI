/*
 * app-usb.js — USB Multi-Media Player shell (PRODUCTION code, board-bound).
 *
 * SOURCE-BOUND base layer: declares `source: 'USB'`, so the shell shows this as
 * the OPAQUE base layer whenever the current source is USB, beneath every overlay.
 *
 * USB device detection:
 *   - Production: backend monitors system USB events, pushes VAL usb_device_list
 *   - Dev/Mock: simulated USB devices with mock folder structure
 *
 * User flow:
 *   1. No USB -> shows "No USB device"
 *   2. USB inserted -> shows device selection
 *   3. Press OK on device -> shows split-panel view:
 *      - Left panel: Folder/Music/Video/Photo categories
 *      - Right panel: Contents of selected category
 *   4. UP/DOWN on left panel switches categories
 *   5. RIGHT enters right panel
 *   6. LEFT on first item returns to left panel
 *   7. BACK returns to previous level or device list
 */
(function () {
  'use strict';

  var stageEl = null;
  var idleEl = null;
  var deviceListEl = null;
  var splitViewEl = null;
  var leftPanelEl = null;
  var rightPanelEl = null;
  var idleTextEl = null;
  var idleIconEl = null;
  var playerViewEl = null;
  var optionMenuEl = null;
  var videoInfoEl = null;
  var fullscreenEl = null;
  var windowEl = null;

  var usbDevices = [];
  var selectedDeviceIndex = 0;
  // 'idle' | 'devices' | 'split' | 'playing' | 'option-menu' | 'video-info' | 'media-options' | 'media-slidespeed-submenu' | 'music-player' | 'photo-player' | 'photo-slidespeed-menu' | 'photo-player-info' | 'video-info-dialog' | 'video-player'
  var currentView = 'idle';
  var musicPlayerEl = null;
  var photoOptionsEl = null;
  var photoViewmodeSubmenuEl = null;
  var photoRepeatSubmenuEl = null;
  var photoSlidespeedSubmenuEl = null;
  var photoPlayerEl = null;
  var photoInfoEl = null;
  var photoSlidespeedMenuEl = null;
  var playerSlidespeedMenuEl = null;
  var photoPlayerInfoEl = null;
  var currentDeviceId = null;
  // 'left' | 'right' - which panel is active
  var activePanel = 'left';
  var selectedCategoryIndex = 0;
  var folderEntries = [];
  var selectedFolderIndex = 0;
  var currentPath = [];
  var navigationStack = [];

  // Playback state
  var playbackTimer = null;
  var playbackElapsed = 0;
  var playbackDuration = 0;
  var isPaused = false;
  var currentPlayingFile = null;
  var playbackMode = 'repeat-all'; // 'single' | 'repeat-one' | 'repeat-all' | 'shuffle'
  var selectedModeIndex = 2;
  var playableFiles = []; // filtered list of playable files in current folder
  var currentPlayingIndex = -1;

  // Unified Media Options state (shared across Videos/Photos/Music)
  var mediaOptionsEl = null;
  var mediaOptionsIndex = 0;
  var mediaShuffleOn = false;        // Shared shuffle setting, default Off
  var mediaRepeatOn = true;          // Shared repeat setting, default On
  var mediaSlideSpeed = 'fast';      // Shared slide speed (affects Photos only): 'fast' | 'medium' | 'slow'
  var mediaSlidespeedSubmenuEl = null;
  var mediaSlidespeedSubmenuIndex = 0;

  // Music Player state
  var musicPlayerControlIndex = 0; // 0-7: play/pause, rewind, ff, prev, next, playall, shuffle, repeat
  var musicPlayerPlayAllOn = false;
  var musicPlayerShuffleOn = false;
  var musicPlayerRepeatOn = false; // false = play once, true = repeat
  var musicPlayerFastMode = null; // null | 'rewind' | 'forward'
  var musicPlayerFastSpeed = 0; // 0=x2, 1=x4, 2=x8, 3=x16, 4=x32
  var musicPlayerReturnToIndex = 0; // index in folderEntries to return to after BACK
  var musicPlayerFromPlayAll = false; // true if entered via Play all option
  var musicPlayerPlayedIndices = []; // tracks which songs have been played in Play all mode

  // Video Info Dialog
  var videoInfoDialogEl = null;

  // Video Player state
  var videoPlayerEl = null;
  var videoPlayerControlIndex = 0; // 0-6: play/pause, rewind, forward, prev, next, shuffle, repeat (7 controls)
  var videoPlayerPlayAllOn = false;
  var videoPlayerShuffleOn = false;
  var videoPlayerRepeatOn = false; // false = play once, true = repeat
  var videoPlayerReturnToIndex = 0;
  var videoPlayerFromPlayAll = false;
  var videoPlayerPlayedIndices = [];
  var videoPlayerHudVisible = true;
  var videoPlayerHudTimer = null;
  var videoPlayerHudLocked = false;
  var videoPlayerFastMode = null; // null | 'rewind' | 'forward'
  var videoPlayerFastSpeed = 0; // 0=x2, 1=x4, 2=x8, 3=x16, 4=x32

  // Photo Player state
  var photoPlayerControlIndex = 0; // 0-5: play/pause, prev, next, shuffle, repeat, slidespeed
  var photoPlayerPlayAllOn = false;
  var photoPlayerShuffleOn = false;
  var photoPlayerRepeatOn = false; // false = play once, true = repeat
  var photoPlayerSlideSpeed = 'fast'; // 'fast' | 'medium' | 'slow'
  var photoPlayerReturnToIndex = 0;
  var photoPlayerFromSlideshow = false;
  var photoPlayerPlayedIndices = [];
  var photoSlidespeedMenuIndex = 0; // for the clock icon menu in player

  // HUD visibility state for Music/Photo players
  var HUD_AUTO_HIDE_DELAY = 5000; // 5 seconds
  var musicPlayerHudVisible = true;
  var musicPlayerHudTimer = null;
  var musicPlayerHudLocked = false; // true when shown by INFO key (no auto-hide)
  var photoPlayerHudVisible = true;
  var photoPlayerHudTimer = null;
  var photoPlayerHudLocked = false; // true when shown by INFO key (no auto-hide)

  // Slide show speed mapping (seconds)
  var SLIDE_SPEED_SECONDS = { fast: 4, medium: 8, slow: 12 };

  // Playback modes
  var PLAYBACK_MODES = [
    { id: 'single', name: 'Single', icon: '&#9654;', desc: 'Play once and stop' },
    { id: 'repeat-one', name: 'Repeat One', icon: '&#128257;', desc: 'Repeat current file' },
    { id: 'repeat-all', name: 'Repeat All', icon: '&#128256;', desc: 'Repeat all files' },
    { id: 'shuffle', name: 'Shuffle', icon: '&#128256;', desc: 'Random playback' }
  ];

  // Mock duration for files (in real implementation, backend would provide this)
  function getFileDuration(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    var audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    var imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

    if (videoExts.indexOf(ext) !== -1) return Math.floor(Math.random() * 180) + 60; // 1-4 min
    if (audioExts.indexOf(ext) !== -1) return Math.floor(Math.random() * 240) + 120; // 2-6 min
    if (imageExts.indexOf(ext) !== -1) return 5; // 5 sec for photo slideshow
    return 10;
  }

  function formatDuration(seconds) {
    var mins = Math.floor(seconds / 60);
    var secs = seconds % 60;
    return (mins < 10 ? '0' : '') + mins + ':' + (secs < 10 ? '0' : '') + secs;
  }

  function isPlayableFile(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var playableExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm',
                        'mp3', 'wav', 'flac', 'aac', 'ogg', 'wma',
                        'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    return playableExts.indexOf(ext) !== -1;
  }

  function isVideoFile(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    return videoExts.indexOf(ext) !== -1;
  }

  function isPhotoFile(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var photoExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];
    return photoExts.indexOf(ext) !== -1;
  }

  function isMusicFile(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var musicExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'];
    return musicExts.indexOf(ext) !== -1;
  }

  function generateMockFileSize() {
    var size = (Math.random() * 500 + 1).toFixed(2);
    return size + ' MB';
  }

  function generateMockDate() {
    var day = Math.floor(Math.random() * 28) + 1;
    var month = Math.floor(Math.random() * 12) + 1;
    var dayStr = (day < 10 ? '0' : '') + day;
    var monthStr = (month < 10 ? '0' : '') + month;
    return dayStr + '/' + monthStr + '/2026';
  }

  function generateMockDimensions() {
    var widths = [71, 128, 256, 512, 640, 800, 1024, 1280, 1920, 3840];
    var heights = [71, 128, 256, 512, 480, 600, 768, 720, 1080, 2160];
    var idx = Math.floor(Math.random() * widths.length);
    return widths[idx] + ' x ' + heights[idx];
  }

  function generateMockMusicInfo() {
    var albums = ['Japanese', 'Greatest Hits', 'Summer Collection', 'Classical', 'Jazz Masters', 'Rock Anthems'];
    var titles = ['Sakura', 'Moonlight', 'Summer Breeze', 'Symphony No.5', 'Blue Moon', 'Highway Star'];
    var artists = ['Artist One', 'The Band', 'Jazz Trio', 'Orchestra', 'Rock Legend', 'Pop Star'];
    var bitRates = ['128K', '192K', '256K', '320K'];
    var samplings = ['44K', '44.1K', '48K', '96K'];
    var years = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
    var sizes = [2048, 3500, 4096, 5120, 6500, 8192, 9395, 10240];

    return {
      album: albums[Math.floor(Math.random() * albums.length)],
      title: titles[Math.floor(Math.random() * titles.length)],
      bitRate: bitRates[Math.floor(Math.random() * bitRates.length)],
      artist: artists[Math.floor(Math.random() * artists.length)],
      sampling: samplings[Math.floor(Math.random() * samplings.length)],
      year: years[Math.floor(Math.random() * years.length)],
      size: sizes[Math.floor(Math.random() * sizes.length)] + ' Kbytes'
    };
  }

  // Generate different static photo backgrounds based on index
  // Note: single quotes in SVG must be encoded as %27 to avoid breaking CSS url()
  function getPhotoBackground(index) {
    var backgrounds = [
      // Landscape with sun and hills
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Crect fill=%27%23263238%27 width=%27400%27 height=%27300%27/%3E%3Ccircle cx=%27320%27 cy=%2780%27 r=%2740%27 fill=%27%23ffc239%27/%3E%3Cpath d=%27M0 220 Q100 160 200 200 T400 180 L400 300 L0 300Z%27 fill=%27%232e7d32%27/%3E%3Cpath d=%27M0 260 Q150 200 300 240 T400 220 L400 300 L0 300Z%27 fill=%27%231b5e20%27/%3E%3C/svg%3E",
      // Beach sunset
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Cdefs%3E%3ClinearGradient id=%27sky%27 x1=%270%27 y1=%270%27 x2=%270%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%23ff6b35%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23f7c59f%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill=%27url(%23sky)%27 width=%27400%27 height=%27200%27/%3E%3Ccircle cx=%27200%27 cy=%27160%27 r=%2750%27 fill=%27%23ff4500%27/%3E%3Crect y=%27200%27 fill=%27%231565c0%27 width=%27400%27 height=%27100%27/%3E%3Cpath d=%27M0 210 Q100 200 200 215 T400 205 L400 230 L0 230Z%27 fill=%27%230d47a1%27 opacity=%27.5%27/%3E%3C/svg%3E",
      // Mountains with snow
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Crect fill=%27%2387ceeb%27 width=%27400%27 height=%27300%27/%3E%3Cpath d=%27M0 300 L100 120 L200 300Z%27 fill=%27%23546e7a%27/%3E%3Cpath d=%27M80 300 L200 100 L320 300Z%27 fill=%27%23607d8b%27/%3E%3Cpath d=%27M200 100 L180 140 L220 140Z%27 fill=%27white%27/%3E%3Cpath d=%27M250 300 L350 150 L400 220 L400 300Z%27 fill=%27%23455a64%27/%3E%3Crect y=%27260%27 fill=%27%232e7d32%27 width=%27400%27 height=%2740%27/%3E%3C/svg%3E",
      // Night sky with stars
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Crect fill=%27%230a1628%27 width=%27400%27 height=%27300%27/%3E%3Ccircle cx=%2750%27 cy=%2740%27 r=%272%27 fill=%27white%27/%3E%3Ccircle cx=%27120%27 cy=%2780%27 r=%271.5%27 fill=%27white%27/%3E%3Ccircle cx=%27200%27 cy=%2730%27 r=%272%27 fill=%27white%27/%3E%3Ccircle cx=%27280%27 cy=%2770%27 r=%271%27 fill=%27white%27/%3E%3Ccircle cx=%27350%27 cy=%2750%27 r=%272%27 fill=%27white%27/%3E%3Ccircle cx=%2780%27 cy=%27120%27 r=%271%27 fill=%27white%27/%3E%3Ccircle cx=%27320%27 cy=%27100%27 r=%271.5%27 fill=%27white%27/%3E%3Ccircle cx=%27300%27 cy=%27180%27 r=%2725%27 fill=%27%23f5f5dc%27/%3E%3Cpath d=%27M0 250 Q100 230 200 250 T400 240 L400 300 L0 300Z%27 fill=%27%231a237e%27/%3E%3C/svg%3E",
      // Forest
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Crect fill=%27%2381d4fa%27 width=%27400%27 height=%27300%27/%3E%3Cpath d=%27M50 300 L80 180 L110 300Z%27 fill=%27%231b5e20%27/%3E%3Cpath d=%27M100 300 L150 150 L200 300Z%27 fill=%27%232e7d32%27/%3E%3Cpath d=%27M180 300 L230 130 L280 300Z%27 fill=%27%231b5e20%27/%3E%3Cpath d=%27M260 300 L300 160 L340 300Z%27 fill=%27%232e7d32%27/%3E%3Cpath d=%27M320 300 L370 140 L400 220 L400 300Z%27 fill=%27%231b5e20%27/%3E%3Crect y=%27270%27 fill=%27%238d6e63%27 width=%27400%27 height=%2730%27/%3E%3C/svg%3E",
      // City skyline
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Cdefs%3E%3ClinearGradient id=%27dusk%27 x1=%270%27 y1=%270%27 x2=%270%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%231a237e%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23e91e63%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill=%27url(%23dusk)%27 width=%27400%27 height=%27300%27/%3E%3Crect x=%2730%27 y=%27180%27 width=%2740%27 height=%27120%27 fill=%27%23212121%27/%3E%3Crect x=%2790%27 y=%27140%27 width=%2750%27 height=%27160%27 fill=%27%23424242%27/%3E%3Crect x=%27160%27 y=%27100%27 width=%2760%27 height=%27200%27 fill=%27%23212121%27/%3E%3Crect x=%27240%27 y=%27160%27 width=%2745%27 height=%27140%27 fill=%27%23424242%27/%3E%3Crect x=%27300%27 y=%27120%27 width=%2755%27 height=%27180%27 fill=%27%23212121%27/%3E%3Crect x=%27370%27 y=%27200%27 width=%2730%27 height=%27100%27 fill=%27%23424242%27/%3E%3C/svg%3E",
      // Desert with cactus
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Crect fill=%27%23ffcc80%27 width=%27400%27 height=%27300%27/%3E%3Ccircle cx=%27320%27 cy=%2760%27 r=%2735%27 fill=%27%23fff59d%27/%3E%3Crect y=%27220%27 fill=%27%23d7ccc8%27 width=%27400%27 height=%2780%27/%3E%3Cpath d=%27M150 220 L150 140 L160 140 L160 170 L180 170 L180 160 L190 160 L190 220%27 fill=%27%232e7d32%27/%3E%3Cpath d=%27M140 170 L140 150 L150 150 L150 170%27 fill=%27%232e7d32%27/%3E%3Cellipse cx=%2780%27 cy=%27250%27 rx=%2740%27 ry=%2715%27 fill=%27%23bcaaa4%27/%3E%3Cellipse cx=%27300%27 cy=%27260%27 rx=%2750%27 ry=%2720%27 fill=%27%23a1887f%27/%3E%3C/svg%3E",
      // Underwater scene
      "data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27400%27 height=%27300%27%3E%3Cdefs%3E%3ClinearGradient id=%27water%27 x1=%270%27 y1=%270%27 x2=%270%27 y2=%271%27%3E%3Cstop offset=%270%25%27 stop-color=%27%2300bcd4%27/%3E%3Cstop offset=%27100%25%27 stop-color=%27%23006064%27/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill=%27url(%23water)%27 width=%27400%27 height=%27300%27/%3E%3Cellipse cx=%27100%27 cy=%27100%27 r=%278%27 fill=%27rgba(255,255,255,0.3)%27/%3E%3Cellipse cx=%27300%27 cy=%2760%27 r=%275%27 fill=%27rgba(255,255,255,0.3)%27/%3E%3Cellipse cx=%27200%27 cy=%27150%27 r=%276%27 fill=%27rgba(255,255,255,0.3)%27/%3E%3Cpath d=%27M50 280 Q70 250 90 280 Q110 250 130 280 L130 300 L50 300Z%27 fill=%27%23ff7043%27/%3E%3Cpath d=%27M200 270 Q230 230 260 270 Q290 230 320 270 L320 300 L200 300Z%27 fill=%27%23e91e63%27/%3E%3Cellipse cx=%27250%27 cy=%27120%27 rx=%2730%27 ry=%2715%27 fill=%27%23ffeb3b%27/%3E%3Cpath d=%27M280 120 L300 110 L300 130Z%27 fill=%27%23ffeb3b%27/%3E%3C/svg%3E"
    ];
    var safeIndex = ((index % backgrounds.length) + backgrounds.length) % backgrounds.length;
    return backgrounds[safeIndex];
  }

  // Categories for USB content
  var CATEGORIES = [
    { id: 'video', name: 'Videos', icon: '&#127910;' },
    { id: 'photo', name: 'Photos', icon: '&#128444;' },
    { id: 'music', name: 'Music', icon: '&#127925;' }
  ];


  // Mock data for each category (20+ items per root)
  var MOCK_DATA = {
    folders: {
      root: [
        { name: 'Documents', isDirectory: true },
        { name: 'Downloads', isDirectory: true },
        { name: 'Pictures', isDirectory: true },
        { name: 'Music', isDirectory: true },
        { name: 'Videos', isDirectory: true },
        { name: 'Projects', isDirectory: true },
        { name: 'Backup', isDirectory: true },
        { name: 'Archive', isDirectory: true },
        { name: 'readme.txt', isDirectory: false },
        { name: 'notes.txt', isDirectory: false },
        { name: 'config.json', isDirectory: false },
        { name: 'data.csv', isDirectory: false },
        { name: 'report.pdf', isDirectory: false },
        { name: 'presentation.pptx', isDirectory: false },
        { name: 'spreadsheet.xlsx', isDirectory: false },
        { name: 'document.docx', isDirectory: false },
        { name: 'script.sh', isDirectory: false },
        { name: 'log.txt', isDirectory: false },
        { name: 'backup.zip', isDirectory: false },
        { name: 'install.exe', isDirectory: false },
        { name: 'license.txt', isDirectory: false },
        { name: 'changelog.md', isDirectory: false }
      ],
      Documents: [
        { name: 'Work', isDirectory: true },
        { name: 'Personal', isDirectory: true },
        { name: 'resume.pdf', isDirectory: false },
        { name: 'contract.pdf', isDirectory: false }
      ],
      Downloads: [
        { name: 'setup.exe', isDirectory: false },
        { name: 'archive.zip', isDirectory: false },
        { name: 'image.png', isDirectory: false }
      ],
      Pictures: [
        { name: 'screenshot_01.png', isDirectory: false },
        { name: 'screenshot_02.png', isDirectory: false }
      ],
      Projects: [
        { name: 'project_a', isDirectory: true },
        { name: 'project_b', isDirectory: true },
        { name: 'todo.txt', isDirectory: false }
      ],
      Backup: [
        { name: 'backup_2024.zip', isDirectory: false },
        { name: 'backup_2025.zip', isDirectory: false },
        { name: 'backup_2026.zip', isDirectory: false }
      ],
      Archive: [
        { name: 'old_files', isDirectory: true },
        { name: 'archive_2023.tar', isDirectory: false }
      ],
      Work: [
        { name: 'meeting_notes.txt', isDirectory: false },
        { name: 'project_plan.pdf', isDirectory: false }
      ],
      Personal: [
        { name: 'diary.txt', isDirectory: false },
        { name: 'recipes.pdf', isDirectory: false }
      ],
      project_a: [
        { name: 'src', isDirectory: true },
        { name: 'README.md', isDirectory: false }
      ],
      project_b: [
        { name: 'main.py', isDirectory: false },
        { name: 'requirements.txt', isDirectory: false }
      ]
    },
    video: {
      root: [
        { name: 'Movies', isDirectory: true },
        { name: 'TV Shows', isDirectory: true },
        { name: 'Tutorials', isDirectory: true },
        { name: 'Recordings', isDirectory: true },
        { name: 'movie_classic.mp4', isDirectory: false },
        { name: 'movie_action.mkv', isDirectory: false },
        { name: 'movie_comedy.avi', isDirectory: false },
        { name: 'movie_drama.mp4', isDirectory: false },
        { name: 'documentary_01.mp4', isDirectory: false },
        { name: 'documentary_02.mkv', isDirectory: false },
        { name: 'concert_live.mp4', isDirectory: false },
        { name: 'interview.mov', isDirectory: false },
        { name: 'clip_funny.mp4', isDirectory: false },
        { name: 'clip_sports.mp4', isDirectory: false },
        { name: 'trailer_01.mp4', isDirectory: false },
        { name: 'trailer_02.mp4', isDirectory: false },
        { name: 'wedding_video.mp4', isDirectory: false },
        { name: 'birthday_party.mov', isDirectory: false },
        { name: 'vacation_2024.mp4', isDirectory: false },
        { name: 'vacation_2025.mp4', isDirectory: false },
        { name: 'tutorial_cooking.mp4', isDirectory: false },
        { name: 'tutorial_coding.mkv', isDirectory: false }
      ],
      Movies: [
        { name: 'Action', isDirectory: true },
        { name: 'Comedy', isDirectory: true },
        { name: 'blockbuster_2024.mp4', isDirectory: false },
        { name: 'indie_film.mkv', isDirectory: false }
      ],
      'TV Shows': [
        { name: 'series_s01e01.mp4', isDirectory: false },
        { name: 'series_s01e02.mp4', isDirectory: false },
        { name: 'series_s01e03.mp4', isDirectory: false }
      ],
      Tutorials: [
        { name: 'photoshop_basics.mp4', isDirectory: false },
        { name: 'excel_tips.mp4', isDirectory: false },
        { name: 'programming_101.mkv', isDirectory: false }
      ],
      Recordings: [
        { name: 'meeting_2024_01.mp4', isDirectory: false },
        { name: 'meeting_2024_02.mp4', isDirectory: false },
        { name: 'presentation_rec.mov', isDirectory: false }
      ],
      Action: [
        { name: 'hero_rises.mp4', isDirectory: false },
        { name: 'fast_chase.mkv', isDirectory: false }
      ],
      Comedy: [
        { name: 'laugh_out_loud.mp4', isDirectory: false },
        { name: 'funny_moments.avi', isDirectory: false }
      ]
    },
    music: {
      root: [
        { name: 'Albums', isDirectory: true },
        { name: 'Artists', isDirectory: true },
        { name: 'Playlists', isDirectory: true },
        { name: 'Podcasts', isDirectory: true },
        { name: 'Audiobooks', isDirectory: true },
        { name: 'Recordings', isDirectory: true },
        { name: 'Downloads', isDirectory: true },
        { name: 'Favorites', isDirectory: true },
        { name: 'song_pop_01.mp3', isDirectory: false },
        { name: 'song_pop_02.mp3', isDirectory: false },
        { name: 'song_rock_01.mp3', isDirectory: false },
        { name: 'song_rock_02.flac', isDirectory: false },
        { name: 'song_jazz_01.mp3', isDirectory: false },
        { name: 'song_jazz_02.flac', isDirectory: false },
        { name: 'song_classical_01.flac', isDirectory: false },
        { name: 'song_classical_02.wav', isDirectory: false },
        { name: 'song_electronic_01.mp3', isDirectory: false },
        { name: 'song_electronic_02.mp3', isDirectory: false },
        { name: 'song_hiphop_01.mp3', isDirectory: false },
        { name: 'song_hiphop_02.mp3', isDirectory: false },
        { name: 'song_country_01.mp3', isDirectory: false },
        { name: 'song_rnb_01.mp3', isDirectory: false },
        { name: 'ambient_01.mp3', isDirectory: false },
        { name: 'ambient_02.flac', isDirectory: false },
        { name: 'live_recording.wav', isDirectory: false },
        { name: 'remix_special.mp3', isDirectory: false }
      ],
      Albums: [
        { name: 'Rock Classics', isDirectory: true },
        { name: 'Jazz Collection', isDirectory: true },
        { name: 'Pop Hits 2024', isDirectory: true },
        { name: 'Electronic Mix', isDirectory: true },
        { name: 'Classical Masterpieces', isDirectory: true },
        { name: 'Country Roads', isDirectory: true }
      ],
      Artists: [
        { name: 'The Beatles', isDirectory: true },
        { name: 'Taylor Swift', isDirectory: true },
        { name: 'Ed Sheeran', isDirectory: true },
        { name: 'Adele', isDirectory: true }
      ],
      Playlists: [
        { name: 'favorites.m3u', isDirectory: false },
        { name: 'workout.m3u', isDirectory: false },
        { name: 'relaxing.m3u', isDirectory: false },
        { name: 'party.m3u', isDirectory: false },
        { name: 'road_trip.m3u', isDirectory: false },
        { name: 'chill_vibes.m3u', isDirectory: false }
      ],
      Podcasts: [
        { name: 'Tech Talk', isDirectory: true },
        { name: 'Daily News', isDirectory: true },
        { name: 'Science Hour', isDirectory: true },
        { name: 'podcast_latest.mp3', isDirectory: false }
      ],
      Audiobooks: [
        { name: 'Fiction', isDirectory: true },
        { name: 'Non-Fiction', isDirectory: true },
        { name: 'novel_chapter01.mp3', isDirectory: false },
        { name: 'novel_chapter02.mp3', isDirectory: false },
        { name: 'self_help_intro.mp3', isDirectory: false }
      ],
      Recordings: [
        { name: 'Voice Memos', isDirectory: true },
        { name: 'meeting_2024_01.mp3', isDirectory: false },
        { name: 'meeting_2024_02.mp3', isDirectory: false },
        { name: 'interview_01.mp3', isDirectory: false },
        { name: 'lecture_notes.mp3', isDirectory: false }
      ],
      Downloads: [
        { name: 'new_release_01.mp3', isDirectory: false },
        { name: 'new_release_02.mp3', isDirectory: false },
        { name: 'trending_hit.mp3', isDirectory: false },
        { name: 'viral_song.mp3', isDirectory: false }
      ],
      Favorites: [
        { name: 'best_of_2024.mp3', isDirectory: false },
        { name: 'all_time_favorite.mp3', isDirectory: false },
        { name: 'loved_track_01.flac', isDirectory: false },
        { name: 'loved_track_02.flac', isDirectory: false }
      ],
      'Rock Classics': [
        { name: 'track01_legendary.mp3', isDirectory: false },
        { name: 'track02_anthem.mp3', isDirectory: false },
        { name: 'track03_ballad.mp3', isDirectory: false },
        { name: 'guitar_solo.mp3', isDirectory: false },
        { name: 'rock_anthem.flac', isDirectory: false }
      ],
      'Jazz Collection': [
        { name: 'smooth_jazz_01.flac', isDirectory: false },
        { name: 'bebop_classic.flac', isDirectory: false },
        { name: 'midnight_sax.mp3', isDirectory: false },
        { name: 'piano_blues.mp3', isDirectory: false }
      ],
      'Pop Hits 2024': [
        { name: 'summer_hit.mp3', isDirectory: false },
        { name: 'dance_anthem.mp3', isDirectory: false },
        { name: 'ballad_2024.mp3', isDirectory: false },
        { name: 'chart_topper.mp3', isDirectory: false }
      ],
      'Electronic Mix': [
        { name: 'techno_01.mp3', isDirectory: false },
        { name: 'house_02.mp3', isDirectory: false },
        { name: 'trance_03.flac', isDirectory: false },
        { name: 'dubstep_drop.mp3', isDirectory: false }
      ],
      'Classical Masterpieces': [
        { name: 'symphony_no5.flac', isDirectory: false },
        { name: 'moonlight_sonata.flac', isDirectory: false },
        { name: 'four_seasons.mp3', isDirectory: false }
      ],
      'Country Roads': [
        { name: 'country_ballad.mp3', isDirectory: false },
        { name: 'honky_tonk.mp3', isDirectory: false },
        { name: 'nashville_nights.mp3', isDirectory: false }
      ],
      'The Beatles': [
        { name: 'hey_jude.mp3', isDirectory: false },
        { name: 'let_it_be.mp3', isDirectory: false },
        { name: 'yesterday.mp3', isDirectory: false }
      ],
      'Taylor Swift': [
        { name: 'love_story.mp3', isDirectory: false },
        { name: 'shake_it_off.mp3', isDirectory: false },
        { name: 'blank_space.mp3', isDirectory: false }
      ],
      'Ed Sheeran': [
        { name: 'shape_of_you.mp3', isDirectory: false },
        { name: 'perfect.mp3', isDirectory: false },
        { name: 'thinking_out_loud.mp3', isDirectory: false }
      ],
      'Adele': [
        { name: 'hello.mp3', isDirectory: false },
        { name: 'someone_like_you.mp3', isDirectory: false },
        { name: 'rolling_in_the_deep.mp3', isDirectory: false }
      ],
      'Tech Talk': [
        { name: 'ep01_ai_future.mp3', isDirectory: false },
        { name: 'ep02_web_dev.mp3', isDirectory: false },
        { name: 'ep03_cybersecurity.mp3', isDirectory: false }
      ],
      'Daily News': [
        { name: 'news_2024_01_15.mp3', isDirectory: false },
        { name: 'news_2024_01_16.mp3', isDirectory: false }
      ],
      'Science Hour': [
        { name: 'space_exploration.mp3', isDirectory: false },
        { name: 'climate_change.mp3', isDirectory: false }
      ],
      'Fiction': [
        { name: 'mystery_novel_ch1.mp3', isDirectory: false },
        { name: 'mystery_novel_ch2.mp3', isDirectory: false },
        { name: 'sci_fi_adventure.mp3', isDirectory: false }
      ],
      'Non-Fiction': [
        { name: 'biography_part1.mp3', isDirectory: false },
        { name: 'history_lesson.mp3', isDirectory: false }
      ],
      'Voice Memos': [
        { name: 'memo_001.mp3', isDirectory: false },
        { name: 'memo_002.mp3', isDirectory: false },
        { name: 'reminder.mp3', isDirectory: false }
      ]
    },
    photo: {
      root: [
        { name: 'Vacation', isDirectory: true },
        { name: 'Family', isDirectory: true },
        { name: 'Wallpapers', isDirectory: true },
        { name: 'Screenshots', isDirectory: true },
        { name: 'Events', isDirectory: true },
        { name: 'photo_001.jpg', isDirectory: false },
        { name: 'photo_002.jpg', isDirectory: false },
        { name: 'photo_003.png', isDirectory: false },
        { name: 'photo_004.jpg', isDirectory: false },
        { name: 'photo_005.jpg', isDirectory: false },
        { name: 'sunset_beach.jpg', isDirectory: false },
        { name: 'mountain_view.png', isDirectory: false },
        { name: 'cityscape.jpg', isDirectory: false },
        { name: 'portrait_01.jpg', isDirectory: false },
        { name: 'portrait_02.jpg', isDirectory: false },
        { name: 'nature_01.jpg', isDirectory: false },
        { name: 'nature_02.png', isDirectory: false },
        { name: 'food_photo.jpg', isDirectory: false },
        { name: 'pet_photo.jpg', isDirectory: false },
        { name: 'selfie_2024.jpg', isDirectory: false },
        { name: 'panorama.jpg', isDirectory: false },
        { name: 'art_gallery.png', isDirectory: false }
      ],
      Vacation: [
        { name: 'Beach 2024', isDirectory: true },
        { name: 'Mountain Trip', isDirectory: true },
        { name: 'beach_01.jpg', isDirectory: false },
        { name: 'beach_02.jpg', isDirectory: false },
        { name: 'hotel_view.jpg', isDirectory: false },
        { name: 'sunset.png', isDirectory: false }
      ],
      Family: [
        { name: 'birthday_2024.jpg', isDirectory: false },
        { name: 'birthday_2025.jpg', isDirectory: false },
        { name: 'christmas_2024.jpg', isDirectory: false },
        { name: 'gathering_01.png', isDirectory: false },
        { name: 'gathering_02.jpg', isDirectory: false }
      ],
      Wallpapers: [
        { name: 'nature_wallpaper_01.jpg', isDirectory: false },
        { name: 'nature_wallpaper_02.jpg', isDirectory: false },
        { name: 'abstract_01.png', isDirectory: false },
        { name: 'abstract_02.png', isDirectory: false },
        { name: 'minimalist.jpg', isDirectory: false }
      ],
      Screenshots: [
        { name: 'screenshot_2024_01.png', isDirectory: false },
        { name: 'screenshot_2024_02.png', isDirectory: false },
        { name: 'screenshot_2025_01.png', isDirectory: false },
        { name: 'error_capture.png', isDirectory: false }
      ],
      Events: [
        { name: 'concert_2024.jpg', isDirectory: false },
        { name: 'wedding_photo.jpg', isDirectory: false },
        { name: 'graduation.jpg', isDirectory: false },
        { name: 'party_night.jpg', isDirectory: false }
      ],
      'Beach 2024': [
        { name: 'sunrise.jpg', isDirectory: false },
        { name: 'swimming.jpg', isDirectory: false },
        { name: 'sandcastle.jpg', isDirectory: false }
      ],
      'Mountain Trip': [
        { name: 'peak_view.jpg', isDirectory: false },
        { name: 'hiking_trail.jpg', isDirectory: false },
        { name: 'campfire.jpg', isDirectory: false }
      ]
    }
  };

  function render() {
    if (!idleEl || !deviceListEl || !splitViewEl || !playerViewEl || !optionMenuEl || !videoInfoEl || !fullscreenEl || !windowEl || !mediaOptionsEl || !mediaSlidespeedSubmenuEl || !musicPlayerEl || !photoPlayerEl || !photoSlidespeedMenuEl || !photoPlayerInfoEl || !playerSlidespeedMenuEl || !videoInfoDialogEl || !videoPlayerEl) return;

    // Hide all views
    idleEl.style.display = 'none';
    deviceListEl.style.display = 'none';
    splitViewEl.style.display = 'none';
    playerViewEl.style.display = 'none';
    optionMenuEl.style.display = 'none';
    videoInfoEl.style.display = 'none';
    mediaOptionsEl.style.display = 'none';
    mediaSlidespeedSubmenuEl.style.display = 'none';
    musicPlayerEl.style.display = 'none';
    photoPlayerEl.style.display = 'none';
    photoSlidespeedMenuEl.style.display = 'none';
    photoPlayerInfoEl.style.display = 'none';
    playerSlidespeedMenuEl.style.display = 'none';
    videoInfoDialogEl.style.display = 'none';
    videoPlayerEl.style.display = 'none';

    // Determine if we're in fullscreen mode
    var isFullscreenView = (currentView === 'split' || currentView === 'playing' ||
                            currentView === 'option-menu' || currentView === 'video-info' ||
                            currentView === 'media-options' || currentView === 'media-slidespeed-submenu' ||
                            currentView === 'music-player' ||
                            currentView === 'photo-player' ||
                            currentView === 'photo-slidespeed-menu' ||
                            currentView === 'photo-player-info' ||
                            currentView === 'player-slidespeed-menu' ||
                            currentView === 'video-info-dialog' ||
                            currentView === 'video-player');

    // Toggle between windowed (idle/devices) and fullscreen (split/playing) containers
    windowEl.style.display = isFullscreenView ? 'none' : 'flex';
    fullscreenEl.style.display = isFullscreenView ? 'block' : 'none';

    if (currentView === 'idle' || (currentView === 'devices' && usbDevices.length === 0)) {
      idleEl.style.display = 'flex';
      if (idleTextEl) idleTextEl.textContent = 'No USB device';
      if (idleIconEl) {
        // Use the same USB flash drive SVG icon as the device list
        idleIconEl.innerHTML = '<svg viewBox="0 0 64 64" width="96" height="96" fill="none" xmlns="http://www.w3.org/2000/svg">' +
          '<rect x="12" y="20" width="40" height="32" rx="4" fill="#3a86ff" stroke="#e6ebf2" stroke-width="2"/>' +
          '<rect x="22" y="8" width="20" height="14" rx="2" fill="#1d2430" stroke="#e6ebf2" stroke-width="2"/>' +
          '<rect x="28" y="12" width="3" height="6" rx="1" fill="#e6ebf2"/>' +
          '<rect x="33" y="12" width="3" height="6" rx="1" fill="#e6ebf2"/>' +
          '<rect x="18" y="28" width="28" height="4" rx="1" fill="#1d2430" opacity="0.5"/>' +
          '<circle cx="24" cy="44" r="3" fill="#ffc239"/>' +
          '</svg>';
        idleIconEl.style.color = '';
      }
      currentView = 'idle';
    } else if (currentView === 'devices') {
      deviceListEl.style.display = 'block';
      renderDeviceList();
    } else if (currentView === 'split') {
      splitViewEl.style.display = 'flex';
      renderLeftPanel();
      renderRightPanel();
    } else if (currentView === 'playing') {
      playerViewEl.style.display = 'flex';
      renderPlayer();
    } else if (currentView === 'option-menu') {
      playerViewEl.style.display = 'flex';
      optionMenuEl.style.display = 'flex';
      renderPlayer();
      renderOptionMenu();
    } else if (currentView === 'video-info') {
      splitViewEl.style.display = 'flex';
      videoInfoEl.style.display = 'flex';
      renderLeftPanel();
      renderRightPanel();
      renderVideoInfo();
    } else if (currentView === 'media-options') {
      splitViewEl.style.display = 'flex';
      mediaOptionsEl.style.display = 'flex';
      renderLeftPanel();
      renderRightPanel();
      renderMediaOptions();
    } else if (currentView === 'media-slidespeed-submenu') {
      splitViewEl.style.display = 'flex';
      mediaSlidespeedSubmenuEl.style.display = 'flex';
      renderLeftPanel();
      renderRightPanel();
      renderMediaSlidespeedSubmenu();
    } else if (currentView === 'music-player') {
      musicPlayerEl.style.display = 'flex';
      renderMusicPlayer();
    } else if (currentView === 'photo-player') {
      photoPlayerEl.style.display = 'flex';
      renderPhotoPlayer();
    } else if (currentView === 'photo-slidespeed-menu') {
      photoPlayerEl.style.display = 'flex';
      photoSlidespeedMenuEl.style.display = 'flex';
      renderPhotoPlayer();
      renderPhotoSlidespeedMenu();
    } else if (currentView === 'photo-player-info') {
      photoPlayerEl.style.display = 'flex';
      photoPlayerInfoEl.style.display = 'flex';
      renderPhotoPlayer();
      renderPhotoPlayerInfo();
    } else if (currentView === 'player-slidespeed-menu') {
      // Show the appropriate player background based on source
      if (playerSlidespeedMenuSource === 'video') {
        videoPlayerEl.style.display = 'flex';
        renderVideoPlayer();
      } else if (playerSlidespeedMenuSource === 'music') {
        musicPlayerEl.style.display = 'flex';
        renderMusicPlayer();
      } else {
        photoPlayerEl.style.display = 'flex';
        renderPhotoPlayer();
      }
      playerSlidespeedMenuEl.style.display = 'flex';
      renderPlayerSlidespeedMenu();
    } else if (currentView === 'video-info-dialog') {
      splitViewEl.style.display = 'flex';
      videoInfoDialogEl.style.display = 'flex';
      renderLeftPanel();
      renderRightPanel();
      renderVideoInfoDialog();
    } else if (currentView === 'video-player') {
      videoPlayerEl.style.display = 'flex';
      renderVideoPlayer();
    }
  }

  function updateDeviceScrollOffset() {
    var total = usbDevices.length;
    if (total <= DEVICE_VISIBLE_COUNT) {
      deviceScrollOffset = 0;
      return;
    }

    var visibleStart = deviceScrollOffset;
    var visibleEnd = deviceScrollOffset + DEVICE_VISIBLE_COUNT - 1;

    // Keep cursor in the second-to-last position when moving down
    // Keep cursor in the second position when moving up
    if (selectedDeviceIndex > visibleEnd) {
      deviceScrollOffset = selectedDeviceIndex - (DEVICE_VISIBLE_COUNT - 1);
    } else if (selectedDeviceIndex < visibleStart) {
      deviceScrollOffset = selectedDeviceIndex;
    } else if (selectedDeviceIndex === visibleEnd && selectedDeviceIndex < total - 1) {
      // At bottom visible row and there's more below - scroll to keep cursor at second-to-last
      deviceScrollOffset = Math.min(selectedDeviceIndex - (DEVICE_VISIBLE_COUNT - 2), total - DEVICE_VISIBLE_COUNT);
    } else if (selectedDeviceIndex === visibleStart && deviceScrollOffset > 0) {
      // At top visible row and there's more above - scroll to keep cursor at second position
      deviceScrollOffset = Math.max(selectedDeviceIndex - 1, 0);
    }

    // Clamp scroll offset
    var maxOffset = Math.max(0, total - DEVICE_VISIBLE_COUNT);
    deviceScrollOffset = Math.max(0, Math.min(deviceScrollOffset, maxOffset));
  }

  function renderDeviceList() {
    if (!deviceListEl) return;
    var total = usbDevices.length;
    var startIdx = deviceScrollOffset;
    var endIdx = Math.min(startIdx + DEVICE_VISIBLE_COUNT, total);

    // Split-panel layout: left icon panel + right device list
    var html = '<div class="usb-device-split">';

    // Left panel - USB icon and title
    html += '<div class="usb-device-left-panel">';
    // USB flash drive SVG icon
    var usbFlashSvg = '<svg viewBox="0 0 64 64" width="120" height="120" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="12" y="20" width="40" height="32" rx="4" fill="#3a86ff" stroke="#e6ebf2" stroke-width="2"/>' +
      '<rect x="22" y="8" width="20" height="14" rx="2" fill="#1d2430" stroke="#e6ebf2" stroke-width="2"/>' +
      '<rect x="28" y="12" width="3" height="6" rx="1" fill="#e6ebf2"/>' +
      '<rect x="33" y="12" width="3" height="6" rx="1" fill="#e6ebf2"/>' +
      '<rect x="18" y="28" width="28" height="4" rx="1" fill="#1d2430" opacity="0.5"/>' +
      '<circle cx="24" cy="44" r="3" fill="#ffc239"/>' +
      '</svg>';
    html += '<div class="usb-device-icon-wrap">' + usbFlashSvg + '</div>';
    html += '<div class="usb-device-panel-title">USB Devices</div>';
    html += '</div>';

    // Right panel - device list (7 rows)
    html += '<div class="usb-device-right-panel">';
    html += '<div class="usb-device-right-content">';
    // Small USB flash drive icon for list items
    var usbSmallSvg = '<svg viewBox="0 0 64 64" width="32" height="32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<rect x="12" y="20" width="40" height="32" rx="4" fill="#3a86ff" stroke="currentColor" stroke-width="2"/>' +
      '<rect x="22" y="8" width="20" height="14" rx="2" fill="#1d2430" stroke="currentColor" stroke-width="2"/>' +
      '<rect x="28" y="12" width="3" height="6" rx="1" fill="currentColor"/>' +
      '<rect x="33" y="12" width="3" height="6" rx="1" fill="currentColor"/>' +
      '</svg>';
    for (var i = startIdx; i < endIdx; i++) {
      var device = usbDevices[i];
      var cls = 'usb-device-row' + (i === selectedDeviceIndex ? ' usb-device-row-selected' : '');
      var displayName = device.label || device.name || ('USB Device ' + (i + 1));
      html += '<div class="' + cls + '" data-index="' + i + '">' +
        '<span class="usb-device-row-icon">' + usbSmallSvg + '</span>' +
        '<span class="usb-device-row-name">' + escapeHtml(displayName) + '</span>' +
        '</div>';
    }
    // Fill empty rows to maintain 7 rows
    for (var j = endIdx - startIdx; j < DEVICE_VISIBLE_COUNT; j++) {
      html += '<div class="usb-device-row usb-device-row-empty"></div>';
    }
    html += '</div>';

    // Scrollbar
    if (total > DEVICE_VISIBLE_COUNT) {
      var scrollbarHeight = Math.max(30, (DEVICE_VISIBLE_COUNT / total) * 100);
      var maxScrollOffset = total - DEVICE_VISIBLE_COUNT;
      var scrollbarTop = maxScrollOffset > 0 ? (deviceScrollOffset / maxScrollOffset) * (100 - scrollbarHeight) : 0;
      html += '<div class="usb-device-scrollbar-track">' +
        '<div class="usb-device-scrollbar-thumb" style="height:' + scrollbarHeight + '%;top:' + scrollbarTop + '%"></div>' +
        '</div>';
    }
    html += '</div>';

    html += '</div>';

    deviceListEl.innerHTML = html;
  }

  function renderLeftPanel() {
    if (!leftPanelEl) return;
    var html = '';
    for (var i = 0; i < CATEGORIES.length; i++) {
      var cat = CATEGORIES[i];
      var isSelected = (i === selectedCategoryIndex);
      var isActive = (activePanel === 'left' && isSelected);
      var cls = 'usb-cat-item' + (isSelected ? ' usb-cat-selected' : '') + (isActive ? ' usb-cat-active' : '');
      html += '<div class="' + cls + '" data-index="' + i + '">' +
        '<div class="usb-cat-icon">' + cat.icon + '</div>' +
        '<div class="usb-cat-name">' + escapeHtml(cat.name) + '</div>' +
        '</div>';
    }
    leftPanelEl.innerHTML = html;
  }

  var GRID_COLS = 4;
  var GRID_ROWS = 3;
  var ITEMS_PER_PAGE = GRID_COLS * GRID_ROWS;
  // Scroll offset for smooth scrolling (row-based)
  var scrollRowOffset = 0;

  // Music list view settings
  var MUSIC_LIST_VISIBLE = 11;
  var musicListScrollOffset = 0;

  // Device list scrolling (max visible items)
  var DEVICE_VISIBLE_COUNT = 7;
  var deviceScrollOffset = 0;

  function renderRightPanel() {
    if (!rightPanelEl) return;
    var cat = CATEGORIES[selectedCategoryIndex];

    var pathDisplay = currentPath.length > 0 ? currentPath.join(' / ') : cat.name;
    var html = '<div class="usb-right-header">' + escapeHtml(pathDisplay) + '</div>';
    html += '<div class="usb-right-content-wrapper">';

    if (folderEntries.length === 0) {
      html += '<div class="usb-right-content"><div class="usb-empty">Empty</div></div>';
    } else {
      // Calculate visible window based on scroll offset
      var startIdx = scrollRowOffset * GRID_COLS;
      var endIdx = Math.min(startIdx + ITEMS_PER_PAGE, folderEntries.length);

      html += '<div class="usb-right-content">';
      html += '<div class="usb-file-grid">';
      for (var i = startIdx; i < endIdx; i++) {
        var entry = folderEntries[i];
        var icon = entry.isDirectory ? '&#128193;' : getFileIcon(entry.name);
        var isSelected = (activePanel === 'right' && i === selectedFolderIndex);
        var cls = 'usb-file-item' + (isSelected ? ' usb-file-selected' : '');
        html += '<div class="' + cls + '" data-index="' + i + '">' +
          '<span class="usb-file-icon">' + icon + '</span>' +
          '<span class="usb-file-name">' + escapeHtml(entry.name) + '</span>' +
          '</div>';
      }
      html += '</div>';
      html += '</div>';

      // Scrollbar
      var totalRows = Math.ceil(folderEntries.length / GRID_COLS);
      if (totalRows > GRID_ROWS) {
        var scrollbarHeight = Math.max(30, (GRID_ROWS / totalRows) * 100);
        var maxScrollOffset = totalRows - GRID_ROWS;
        var scrollbarTop = maxScrollOffset > 0 ? (scrollRowOffset / maxScrollOffset) * (100 - scrollbarHeight) : 0;
        html += '<div class="usb-scrollbar-track">' +
          '<div class="usb-scrollbar-thumb" style="height:' + scrollbarHeight + '%;top:' + scrollbarTop + '%"></div>' +
          '</div>';
      }
    }
    html += '</div>';
    rightPanelEl.innerHTML = html;
  }

  function updateMusicListScrollOffset() {
    var total = folderEntries.length;
    if (total <= MUSIC_LIST_VISIBLE) {
      musicListScrollOffset = 0;
      return;
    }

    var visibleStart = musicListScrollOffset;
    var visibleEnd = musicListScrollOffset + MUSIC_LIST_VISIBLE - 1;

    if (selectedFolderIndex > visibleEnd) {
      musicListScrollOffset = selectedFolderIndex - (MUSIC_LIST_VISIBLE - 1);
    } else if (selectedFolderIndex < visibleStart) {
      musicListScrollOffset = selectedFolderIndex;
    } else if (selectedFolderIndex === visibleEnd && selectedFolderIndex < total - 1) {
      musicListScrollOffset = Math.min(selectedFolderIndex - (MUSIC_LIST_VISIBLE - 2), total - MUSIC_LIST_VISIBLE);
    } else if (selectedFolderIndex === visibleStart && musicListScrollOffset > 0) {
      musicListScrollOffset = Math.max(selectedFolderIndex - 1, 0);
    }

    var maxOffset = Math.max(0, total - MUSIC_LIST_VISIBLE);
    musicListScrollOffset = Math.max(0, Math.min(musicListScrollOffset, maxOffset));
  }

  function renderMusicListView() {
    if (!rightPanelEl) return;

    // Use same header style as Videos/Photos
    var pathDisplay = currentPath.length > 0 ? currentPath.join(' / ') : 'Music';
    var html = '<div class="usb-right-header">' + escapeHtml(pathDisplay) + '</div>';

    html += '<div class="usb-music-body">';

    // Left: track list
    html += '<div class="usb-music-list-container">';
    if (folderEntries.length === 0) {
      html += '<div class="usb-empty">Empty</div>';
    } else {
      var total = folderEntries.length;
      var startIdx = musicListScrollOffset;
      var endIdx = Math.min(startIdx + MUSIC_LIST_VISIBLE, total);

      html += '<div class="usb-music-list">';
      for (var i = startIdx; i < endIdx; i++) {
        var entry = folderEntries[i];
        var isSelected = (activePanel === 'right' && i === selectedFolderIndex);
        var cls = 'usb-music-row' + (isSelected ? ' usb-music-row-selected' : '');
        html += '<div class="' + cls + '" data-index="' + i + '">' +
          '<span class="usb-music-row-icon">&#9835;</span>' +
          '<span class="usb-music-row-name">' + escapeHtml(entry.name) + '</span>' +
          '</div>';
      }
      html += '</div>';

      // Scrollbar
      if (total > MUSIC_LIST_VISIBLE) {
        var scrollbarHeight = Math.max(30, (MUSIC_LIST_VISIBLE / total) * 100);
        var maxScrollOffset = total - MUSIC_LIST_VISIBLE;
        var scrollbarTop = maxScrollOffset > 0 ? (musicListScrollOffset / maxScrollOffset) * (100 - scrollbarHeight) : 0;
        html += '<div class="usb-music-scrollbar-track">' +
          '<div class="usb-music-scrollbar-thumb" style="height:' + scrollbarHeight + '%;top:' + scrollbarTop + '%"></div>' +
          '</div>';
      }
    }
    html += '</div>';

    // Right: info panel (only show when activePanel === 'right' and a file is selected)
    html += '<div class="usb-music-info-panel">';
    if (activePanel === 'right' && folderEntries.length > 0 && selectedFolderIndex < folderEntries.length) {
      var entry = folderEntries[selectedFolderIndex];
      var musicInfo = generateMockMusicInfo();
      var duration = getFileDuration(entry.name);
      var durationStr = formatDuration(duration);

      // Album art placeholder (music note icon as SVG)
      html += '<div class="usb-music-info-art">';
      html += '<svg viewBox="0 0 100 100" width="280" height="280" xmlns="http://www.w3.org/2000/svg">' +
        '<rect width="100" height="100" fill="#1d2430" rx="8"/>' +
        '<text x="50" y="62" text-anchor="middle" font-size="40" fill="#8a94a6">&#9835;</text>' +
        '</svg>';
      html += '</div>';

      html += '<div class="usb-music-info-details">';
      html += '<div class="usb-music-info-filename">' + escapeHtml(entry.name) + '</div>';
      html += '<div class="usb-music-info-row"><span class="usb-music-info-label">Duration:</span> ' + durationStr + '</div>';
      html += '<div class="usb-music-info-row"><span class="usb-music-info-label">Artist:</span> ' + escapeHtml(musicInfo.artist) + '</div>';
      html += '<div class="usb-music-info-row"><span class="usb-music-info-label">Album:</span> ' + escapeHtml(musicInfo.album) + '</div>';
      html += '<div class="usb-music-info-row"><span class="usb-music-info-label">Genre:</span> Pop</div>';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';

    rightPanelEl.innerHTML = html;
  }

  function updateScrollOffset() {
    // Calculate which row the cursor is on
    var cursorRow = Math.floor(selectedFolderIndex / GRID_COLS);
    var totalRows = Math.ceil(folderEntries.length / GRID_COLS);

    // Keep cursor in the middle row (row index 1 of 0,1,2) when possible
    // When moving down: if cursor goes to row 2 (third row), scroll up so cursor is on row 1
    // When moving up: if cursor goes to row 0 (first row), scroll down so cursor is on row 1

    var visibleRowStart = scrollRowOffset;
    var visibleRowEnd = scrollRowOffset + GRID_ROWS - 1;

    // If cursor is below visible area
    if (cursorRow > visibleRowEnd) {
      scrollRowOffset = cursorRow - (GRID_ROWS - 1);
    }
    // If cursor is above visible area
    else if (cursorRow < visibleRowStart) {
      scrollRowOffset = cursorRow;
    }
    // Try to keep cursor in middle row when there's room to scroll
    else if (cursorRow === visibleRowEnd && cursorRow < totalRows - 1) {
      // Cursor at bottom row and there's more content below - scroll to put cursor in middle
      scrollRowOffset = Math.min(cursorRow - 1, totalRows - GRID_ROWS);
    }
    else if (cursorRow === visibleRowStart && scrollRowOffset > 0) {
      // Cursor at top row and there's more content above - scroll to put cursor in middle
      scrollRowOffset = Math.max(cursorRow - 1, 0);
    }

    // Clamp scroll offset
    var maxOffset = Math.max(0, totalRows - GRID_ROWS);
    scrollRowOffset = Math.max(0, Math.min(scrollRowOffset, maxOffset));
  }

  function getFileIcon(filename) {
    var ext = (filename.split('.').pop() || '').toLowerCase();
    var videoExts = ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm'];
    var audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm3u'];
    var imageExts = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'];

    if (videoExts.indexOf(ext) !== -1) return '&#127910;';
    if (audioExts.indexOf(ext) !== -1) return '&#127925;';
    if (imageExts.indexOf(ext) !== -1) return '&#128444;';
    return '&#128196;';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function renderPlayer() {
    if (!playerViewEl || !currentPlayingFile) return;
    var modeInfo = PLAYBACK_MODES.find(function(m) { return m.id === playbackMode; });
    var progressPercent = playbackDuration > 0 ? (playbackElapsed / playbackDuration) * 100 : 0;
    var statusIcon = isPaused ? '&#10074;&#10074;' : '&#9654;';

    // Format large timer display (MM:SS)
    var timerMins = Math.floor(playbackElapsed / 60);
    var timerSecs = playbackElapsed % 60;
    var timerDisplay = (timerMins < 10 ? '0' : '') + timerMins + ':' + (timerSecs < 10 ? '0' : '') + timerSecs;

    // Determine if video/photo/music for background style
    var isVideo = isVideoFile(currentPlayingFile.name);
    var isPhoto = isPhotoFile(currentPlayingFile.name);
    var bgClass = isVideo ? 'usb-bg-video' : (isPhoto ? 'usb-bg-photo' : 'usb-bg-music');

    // Photo playback: dynamic background per photo, no progress bar in HUD
    // Video/Music: animated background with full HUD
    var hudCenterHtml = isPhoto ? '' :
      '<div class="usb-hud-center">' +
        '<div class="usb-hud-progress">' +
          '<span class="usb-hud-time">' + formatDuration(playbackElapsed) + '</span>' +
          '<div class="usb-hud-bar"><div class="usb-hud-fill" style="width:' + progressPercent + '%"></div></div>' +
          '<span class="usb-hud-time">' + formatDuration(playbackDuration) + '</span>' +
        '</div>' +
      '</div>';

    // For photos, use dynamic background based on current index
    var bgStyle = isPhoto ? 'background:#1a1a1a url("' + getPhotoBackground(currentPlayingIndex) + '") center/cover no-repeat' : '';

    playerViewEl.innerHTML =
      // Fullscreen simulated background (photo uses dynamic image per index)
      "<div class=\"usb-player-bg " + bgClass + "\"" + (bgStyle ? " style='" + bgStyle + "'" : "") + ">" +
        (isPhoto ? '' : '<div class="usb-player-timer">' + timerDisplay + '</div>') +
        (isPaused ? '<div class="usb-player-pause-icon">&#10074;&#10074;</div>' : '') +
      '</div>' +
      // Bottom HUD overlay
      '<div class="usb-player-hud">' +
        '<div class="usb-hud-left">' +
          '<span class="usb-hud-status">' + statusIcon + '</span>' +
          '<span class="usb-hud-filename">' + escapeHtml(currentPlayingFile.name) + '</span>' +
        '</div>' +
        hudCenterHtml +
        '<div class="usb-hud-right">' +
          '<span class="usb-hud-mode">' + modeInfo.icon + '</span>' +
          '<span class="usb-hud-counter">' + (currentPlayingIndex + 1) + '/' + playableFiles.length + '</span>' +
        '</div>' +
      '</div>';
  }

  function renderOptionMenu() {
    if (!optionMenuEl) return;
    var html = '<div class="usb-option-dialog">' +
      '<div class="usb-option-title">Playback Mode</div>';

    for (var i = 0; i < PLAYBACK_MODES.length; i++) {
      var mode = PLAYBACK_MODES[i];
      var isSelected = (i === selectedModeIndex);
      var isCurrent = (mode.id === playbackMode);
      var cls = 'usb-option-item' + (isSelected ? ' usb-option-selected' : '') + (isCurrent ? ' usb-option-current' : '');
      html += '<div class="' + cls + '">' +
        '<span class="usb-option-icon">' + mode.icon + '</span>' +
        '<span class="usb-option-name">' + mode.name + '</span>' +
        '<span class="usb-option-desc">' + mode.desc + '</span>' +
        (isCurrent ? '<span class="usb-option-check">&#10003;</span>' : '') +
        '</div>';
    }

    html += '<div class="usb-option-hint">UP/DOWN: Select | OK: Confirm | BACK: Cancel</div>';
    html += '</div>';
    optionMenuEl.innerHTML = html;
  }

  function renderVideoInfo() {
    if (!videoInfoEl) return;
    var entry = folderEntries[selectedFolderIndex];
    if (!entry) return;

    var cat = CATEGORIES[selectedCategoryIndex];
    var isPhoto = (cat.id === 'photo');
    var isMusic = (cat.id === 'music');
    var dateStr = generateMockDate();
    var html;

    if (isPhoto) {
      var dimensionsStr = generateMockDimensions();
      html = '<div class="usb-video-info-dialog">' +
        '<div class="usb-video-info-title">Picture metadata</div>' +
        '<div class="usb-video-info-content">' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Title:</span> ' + escapeHtml(entry.name) + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Date:</span> ' + dateStr + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Size:</span> ' + dimensionsStr + '</div>' +
        '</div>' +
        '<button class="usb-video-info-close">Close</button>' +
      '</div>';
    } else if (isMusic) {
      var musicInfo = generateMockMusicInfo();
      html = '<div class="usb-video-info-dialog">' +
        '<div class="usb-video-info-title">Music metadata</div>' +
        '<div class="usb-video-info-content">' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Album:</span> ' + escapeHtml(musicInfo.album) + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Title:</span> ' + escapeHtml(musicInfo.title) + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Bit Rate :</span> ' + musicInfo.bitRate + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Artist:</span> ' + escapeHtml(musicInfo.artist) + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Sampling :</span> ' + musicInfo.sampling + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Year:</span> ' + musicInfo.year + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Size:</span> ' + musicInfo.size + '</div>' +
        '</div>' +
        '<button class="usb-video-info-close">Close</button>' +
      '</div>';
    } else {
      var duration = getFileDuration(entry.name);
      var durationStr = formatDuration(duration);
      var sizeStr = generateMockFileSize();
      html = '<div class="usb-video-info-dialog">' +
        '<div class="usb-video-info-title">Video metadata</div>' +
        '<div class="usb-video-info-content">' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Title:</span> ' + escapeHtml(entry.name) + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Size:</span> ' + sizeStr + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Date:</span> ' + dateStr + '</div>' +
          '<div class="usb-video-info-row"><span class="usb-video-info-label">Duration:</span> ' + durationStr + '</div>' +
        '</div>' +
        '<button class="usb-video-info-close">Close</button>' +
      '</div>';
    }
    videoInfoEl.innerHTML = html;
  }

  // Unified Media Options (Videos/Photos/Music)
  // Menu items: Play all (default On), Shuffle (toggle), Repeat (toggle), Slide show speed (submenu)
  function renderMediaOptions() {
    if (!mediaOptionsEl) return;

    var shuffleToggle = mediaShuffleOn ?
      '<span class="media-opt-toggle media-opt-toggle-on"></span>' :
      '<span class="media-opt-toggle media-opt-toggle-off"></span>';

    var repeatToggle = mediaRepeatOn ?
      '<span class="media-opt-toggle media-opt-toggle-on"></span>' :
      '<span class="media-opt-toggle media-opt-toggle-off"></span>';

    var speedLabel = mediaSlideSpeed.charAt(0).toUpperCase() + mediaSlideSpeed.slice(1);

    var html = '<div class="media-opt-dialog">' +
      '<div class="media-opt-header">' +
        '<span class="media-opt-title">Options</span>' +
      '</div>' +
      '<div class="media-opt-list">';

    // Play all (index 0)
    var playAllCls = 'media-opt-item' + (mediaOptionsIndex === 0 ? ' media-opt-item-selected' : '');
    html += '<div class="' + playAllCls + '" data-index="0">' +
      '<span class="media-opt-name">Play all</span>' +
    '</div>';

    // Shuffle (index 1)
    var shuffleCls = 'media-opt-item' + (mediaOptionsIndex === 1 ? ' media-opt-item-selected' : '');
    html += '<div class="' + shuffleCls + '" data-index="1">' +
      '<span class="media-opt-name">Shuffle</span>' +
      shuffleToggle +
    '</div>';

    // Repeat (index 2)
    var repeatCls = 'media-opt-item' + (mediaOptionsIndex === 2 ? ' media-opt-item-selected' : '');
    html += '<div class="' + repeatCls + '" data-index="2">' +
      '<span class="media-opt-name">Repeat</span>' +
      repeatToggle +
    '</div>';

    // Slide show speed (index 3)
    var speedCls = 'media-opt-item' + (mediaOptionsIndex === 3 ? ' media-opt-item-selected' : '');
    html += '<div class="' + speedCls + '" data-index="3">' +
      '<span class="media-opt-name">Slide show speed</span>' +
      '<span class="media-opt-value">' + speedLabel + '</span>' +
      '<span class="media-opt-arrow">&#10095;</span>' +
    '</div>';

    html += '</div></div>';

    mediaOptionsEl.innerHTML = html;
  }

  function renderMediaSlidespeedSubmenu() {
    if (!mediaSlidespeedSubmenuEl) return;

    var fastCls = 'media-speed-item' + (mediaSlidespeedSubmenuIndex === 0 ? ' media-speed-item-selected' : '');
    var mediumCls = 'media-speed-item' + (mediaSlidespeedSubmenuIndex === 1 ? ' media-speed-item-selected' : '');
    var slowCls = 'media-speed-item' + (mediaSlidespeedSubmenuIndex === 2 ? ' media-speed-item-selected' : '');

    var fastCheck = (mediaSlideSpeed === 'fast') ? '<span class="media-speed-check">&#10003;</span>' : '';
    var mediumCheck = (mediaSlideSpeed === 'medium') ? '<span class="media-speed-check">&#10003;</span>' : '';
    var slowCheck = (mediaSlideSpeed === 'slow') ? '<span class="media-speed-check">&#10003;</span>' : '';

    var html = '<div class="media-speed-dialog">' +
      '<div class="media-speed-header">' +
        '<span class="media-speed-title">Slide show speed</span>' +
      '</div>' +
      '<div class="media-speed-list">' +
        '<div class="' + fastCls + '" data-index="0">' +
          '<span class="media-speed-name">Fast</span>' +
          fastCheck +
        '</div>' +
        '<div class="' + mediumCls + '" data-index="1">' +
          '<span class="media-speed-name">Medium</span>' +
          mediumCheck +
        '</div>' +
        '<div class="' + slowCls + '" data-index="2">' +
          '<span class="media-speed-name">Slow</span>' +
          slowCheck +
        '</div>' +
      '</div>' +
    '</div>';

    mediaSlidespeedSubmenuEl.innerHTML = html;
  }

  function openMediaOptions() {
    mediaOptionsIndex = 0;
    currentView = 'media-options';
    render();
    return true;
  }

  function closeMediaOptions() {
    currentView = 'split';
    render();
  }

  function openMediaSlidespeedSubmenu() {
    mediaSlidespeedSubmenuIndex = (mediaSlideSpeed === 'fast') ? 0 : (mediaSlideSpeed === 'medium') ? 1 : 2;
    currentView = 'media-slidespeed-submenu';
    render();
  }

  function closeMediaSlidespeedSubmenu() {
    currentView = 'media-options';
    render();
  }

  function confirmMediaSlidespeed() {
    mediaSlideSpeed = (mediaSlidespeedSubmenuIndex === 0) ? 'fast' : (mediaSlidespeedSubmenuIndex === 1) ? 'medium' : 'slow';
    renderMediaSlidespeedSubmenu();
  }

  function handleMediaOptionsOK() {
    var cat = CATEGORIES[selectedCategoryIndex];
    switch (mediaOptionsIndex) {
      case 0: // Play all
        closeMediaOptions();
        if (cat.id === 'video') {
          playAllVideosFromOptions();
        } else if (cat.id === 'photo') {
          playAllPhotosFromOptions();
        } else if (cat.id === 'music') {
          playAllMusicFromOptions();
        }
        break;
      case 1: // Shuffle toggle
        mediaShuffleOn = !mediaShuffleOn;
        renderMediaOptions();
        break;
      case 2: // Repeat toggle
        mediaRepeatOn = !mediaRepeatOn;
        renderMediaOptions();
        break;
      case 3: // Slide show speed
        openMediaSlidespeedSubmenu();
        break;
    }
  }

  // Unified Player HUD icons (50x50 size for 9-control compact HUD)
  function getPlayerIcon(type, isHighlight, speed) {
    var color = isHighlight ? '#fff' : '#8a94a6';
    switch (type) {
      case 'play':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><polygon points="12,8 32,20 12,32" fill="' + color + '"/></svg>';
      case 'pause':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><rect x="10" y="8" width="7" height="24" fill="' + color + '"/><rect x="23" y="8" width="7" height="24" fill="' + color + '"/></svg>';
      case 'rewind':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><polygon points="20,8 20,32 4,20" fill="' + color + '"/><polygon points="36,8 36,32 20,20" fill="' + color + '"/></svg>';
      case 'forward':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><polygon points="4,8 20,20 4,32" fill="' + color + '"/><polygon points="20,8 36,20 20,32" fill="' + color + '"/></svg>';
      case 'prev':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><rect x="6" y="8" width="4" height="24" fill="' + color + '"/><polygon points="34,8 34,32 14,20" fill="' + color + '"/></svg>';
      case 'next':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><polygon points="6,8 26,20 6,32" fill="' + color + '"/><rect x="30" y="8" width="4" height="24" fill="' + color + '"/></svg>';
      case 'playall':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><circle cx="20" cy="20" r="14" fill="none" stroke="' + color + '" stroke-width="3"/><polygon points="16,12 16,28 28,20" fill="' + color + '"/></svg>';
      case 'shuffle':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><path d="M6,12 L20,12 L26,28 L34,28 M6,28 L20,28 L26,12 L34,12" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/><polyline points="30,8 34,12 30,16" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><polyline points="30,24 34,28 30,32" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'repeat':
        return '<svg viewBox="0 0 40 40" width="50" height="50"><path d="M8,14 L8,26 Q8,30 12,30 L28,30 Q32,30 32,26 L32,14 Q32,10 28,10 L12,10" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/><polyline points="16,6 12,10 16,14" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      case 'speedometer':
        var needleX2, needleY2;
        if (speed === 'fast') { needleX2 = 30; needleY2 = 22; }
        else if (speed === 'medium') { needleX2 = 20; needleY2 = 10; }
        else { needleX2 = 10; needleY2 = 22; }
        return '<svg viewBox="0 0 40 40" width="50" height="50"><path d="M6,28 A16,16 0 1,1 34,28" fill="none" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/><line x1="20" y1="22" x2="' + needleX2 + '" y2="' + needleY2 + '" stroke="' + color + '" stroke-width="3" stroke-linecap="round"/><circle cx="20" cy="22" r="3" fill="' + color + '"/></svg>';
      default:
        return '';
    }
  }

  // Cache for music file metadata (so it doesn't regenerate on every render)
  var musicFileMetaCache = {};

  function getMusicFileInfo(entry) {
    // Use cached metadata if available
    if (musicFileMetaCache[entry.name]) {
      return musicFileMetaCache[entry.name];
    }
    // Generate and cache metadata for this file
    var info = generateMockMusicInfo();
    var fileInfo = {
      filename: entry.name,
      artist: info.artist,
      album: info.album,
      genre: 'Electronic'
    };
    musicFileMetaCache[entry.name] = fileInfo;
    return fileInfo;
  }

  // Cache for photo file metadata (so it doesn't regenerate on every render)
  var photoFileMetaCache = {};

  function getPhotoFileInfo(entry, index) {
    // Use cached metadata if available
    if (photoFileMetaCache[entry.name]) {
      return photoFileMetaCache[entry.name];
    }
    // Generate and cache metadata for this file
    var fileInfo = {
      filename: entry.name,
      dimensions: generateMockDimensions(),
      date: generateMockDate(),
      size: generateMockFileSize(),
      bgIndex: index >= 0 ? index : 0
    };
    photoFileMetaCache[entry.name] = fileInfo;
    return fileInfo;
  }

  // Music Player HUD visibility functions
  function clearMusicPlayerHudTimer() {
    if (musicPlayerHudTimer) {
      clearTimeout(musicPlayerHudTimer);
      musicPlayerHudTimer = null;
    }
  }

  function startMusicPlayerHudTimer() {
    clearMusicPlayerHudTimer();
    if (musicPlayerHudLocked) return; // Don't auto-hide if locked by INFO
    musicPlayerHudTimer = setTimeout(function() {
      musicPlayerHudVisible = false;
      musicPlayerHudTimer = null;
      renderMusicPlayer();
    }, HUD_AUTO_HIDE_DELAY);
  }

  function showMusicPlayerHud(locked) {
    musicPlayerHudVisible = true;
    musicPlayerHudLocked = locked || false;
    if (!locked) {
      startMusicPlayerHudTimer();
    } else {
      clearMusicPlayerHudTimer();
    }
    renderMusicPlayer();
  }

  function hideMusicPlayerHud() {
    clearMusicPlayerHudTimer();
    musicPlayerHudVisible = false;
    musicPlayerHudLocked = false;
    renderMusicPlayer();
  }

  function toggleMusicPlayerHudByInfo() {
    if (musicPlayerHudVisible) {
      hideMusicPlayerHud();
    } else {
      showMusicPlayerHud(true); // Show locked (no auto-hide)
    }
  }

  function resetMusicPlayerHudOnPlayPause() {
    // Called when OK/PLAY/PAUSE is pressed
    musicPlayerHudLocked = false;
    showMusicPlayerHud(false); // Show with auto-hide
  }

  // Photo Player HUD visibility functions
  function clearPhotoPlayerHudTimer() {
    if (photoPlayerHudTimer) {
      clearTimeout(photoPlayerHudTimer);
      photoPlayerHudTimer = null;
    }
  }

  function startPhotoPlayerHudTimer() {
    clearPhotoPlayerHudTimer();
    if (photoPlayerHudLocked) return; // Don't auto-hide if locked by INFO
    photoPlayerHudTimer = setTimeout(function() {
      photoPlayerHudVisible = false;
      photoPlayerHudTimer = null;
      renderPhotoPlayer();
    }, HUD_AUTO_HIDE_DELAY);
  }

  function showPhotoPlayerHud(locked) {
    photoPlayerHudVisible = true;
    photoPlayerHudLocked = locked || false;
    if (!locked) {
      startPhotoPlayerHudTimer();
    } else {
      clearPhotoPlayerHudTimer();
    }
    renderPhotoPlayer();
  }

  function hidePhotoPlayerHud() {
    clearPhotoPlayerHudTimer();
    photoPlayerHudVisible = false;
    photoPlayerHudLocked = false;
    renderPhotoPlayer();
  }

  function togglePhotoPlayerHudByInfo() {
    if (photoPlayerHudVisible) {
      hidePhotoPlayerHud();
    } else {
      showPhotoPlayerHud(true); // Show locked (no auto-hide)
    }
  }

  function resetPhotoPlayerHudOnPlayPause() {
    // Called when OK/PLAY/PAUSE is pressed
    photoPlayerHudLocked = false;
    showPhotoPlayerHud(false); // Show with auto-hide
  }

  function renderMusicPlayer() {
    if (!musicPlayerEl || !currentPlayingFile) return;

    var fileInfo = getMusicFileInfo(currentPlayingFile);
    var progressPercent = playbackDuration > 0 ? (playbackElapsed / playbackDuration) * 100 : 0;

    // Determine play/pause icon state
    var playPauseIcon = isPaused ? getPlayerIcon('play', true) : getPlayerIcon('pause', true);

    // Fast mode display
    var rewindContent, forwardContent;
    if (musicPlayerFastMode === 'rewind') {
      var speeds = ['x2', 'x4', 'x8', 'x16', 'x32'];
      rewindContent = '<span class="player-fast-speed">' + speeds[musicPlayerFastSpeed] + '</span>';
    } else {
      rewindContent = getPlayerIcon('rewind', true);
    }
    if (musicPlayerFastMode === 'forward') {
      var speeds = ['x2', 'x4', 'x8', 'x16', 'x32'];
      forwardContent = '<span class="player-fast-speed">' + speeds[musicPlayerFastSpeed] + '</span>';
    } else {
      forwardContent = getPlayerIcon('forward', true);
    }

    // Build control icons (9 controls: play/pause, rewind, forward, prev, next, playall, shuffle, repeat, slidespeed)
    // Slidespeed is gray (not highlighted) for Music, but still functional
    var controls = [
      { id: 'playpause', content: playPauseIcon, highlight: true },
      { id: 'rewind', content: rewindContent, highlight: true },
      { id: 'forward', content: forwardContent, highlight: true },
      { id: 'prev', content: getPlayerIcon('prev', true), highlight: true },
      { id: 'next', content: getPlayerIcon('next', true), highlight: true },
      { id: 'playall', content: getPlayerIcon('playall', musicPlayerPlayAllOn), highlight: musicPlayerPlayAllOn },
      { id: 'shuffle', content: getPlayerIcon('shuffle', mediaShuffleOn), highlight: mediaShuffleOn },
      { id: 'repeat', content: getPlayerIcon('repeat', mediaRepeatOn), highlight: mediaRepeatOn },
      { id: 'slidespeed', content: getPlayerIcon('speedometer', false, mediaSlideSpeed), highlight: false }
    ];

    var controlsHtml = '';
    for (var i = 0; i < controls.length; i++) {
      var ctrl = controls[i];
      var isSelected = (musicPlayerControlIndex === i);
      var cls = 'player-ctrl-btn' + (isSelected ? ' player-ctrl-selected' : '') + (ctrl.highlight ? ' player-ctrl-on' : ' player-ctrl-off');
      controlsHtml += '<div class="' + cls + '" data-index="' + i + '">' + ctrl.content + '</div>';
    }

    // Large timer display in background
    var timerMins = Math.floor(playbackElapsed / 60);
    var timerSecs = playbackElapsed % 60;
    var timerDisplay = (timerMins < 10 ? '0' : '') + timerMins + ':' + (timerSecs < 10 ? '0' : '') + timerSecs;

    // Build HUD HTML (no metadata line, just filename + counter + progress + controls)
    var hudHtml = '';
    if (musicPlayerHudVisible) {
      hudHtml =
        '<div class="player-hud">' +
          '<div class="player-hud-top">' +
            '<div class="player-filename">' + escapeHtml(fileInfo.filename) + '</div>' +
            '<div class="player-counter">' + (currentPlayingIndex + 1) + '/' + playableFiles.length + '</div>' +
          '</div>' +
          '<div class="player-progress">' +
            '<span class="player-time">' + formatDuration(playbackElapsed) + '</span>' +
            '<div class="player-progress-bar">' +
              '<div class="player-progress-fill" style="width:' + progressPercent + '%"></div>' +
            '</div>' +
            '<span class="player-time">' + formatDuration(playbackDuration) + '</span>' +
          '</div>' +
          '<div class="player-controls">' + controlsHtml + '</div>' +
        '</div>';
    }

    musicPlayerEl.innerHTML =
      '<div class="mp-bg">' +
        '<div class="mp-timer">' + timerDisplay + '</div>' +
      '</div>' +
      hudHtml;
  }

  function openMusicPlayer(entry, fromPlayAll) {
    musicPlayerFromPlayAll = fromPlayAll || false;
    musicPlayerReturnToIndex = selectedFolderIndex;
    musicPlayerControlIndex = 0;
    musicPlayerFastMode = null;
    musicPlayerFastSpeed = 0;
    musicPlayerPlayedIndices = []; // Reset played tracking

    // Sync options state with unified Media Options
    if (fromPlayAll) {
      musicPlayerPlayAllOn = true;
    } else {
      musicPlayerPlayAllOn = false;
    }
    musicPlayerShuffleOn = mediaShuffleOn;
    musicPlayerRepeatOn = mediaRepeatOn;

    buildPlayableList();
    currentPlayingIndex = -1;
    for (var i = 0; i < playableFiles.length; i++) {
      if (playableFiles[i].name === entry.name) {
        currentPlayingIndex = i;
        break;
      }
    }
    if (currentPlayingIndex === -1 && playableFiles.length > 0) {
      currentPlayingIndex = 0;
    }
    currentPlayingFile = entry;
    currentView = 'music-player';
    // Initialize HUD as visible with auto-hide timer
    musicPlayerHudVisible = true;
    musicPlayerHudLocked = false;
    startMusicPlayerTimer();
    render();
    startMusicPlayerHudTimer(); // Start auto-hide after initial render
  }

  function closeMusicPlayer() {
    stopPlaybackTimer();
    clearMusicPlayerHudTimer(); // Clean up HUD timer
    musicPlayerFastMode = null;
    musicPlayerFastSpeed = 0;

    // Find and select the last played file in the list before clearing state
    if (currentPlayingIndex >= 0 && currentPlayingIndex < playableFiles.length) {
      var lastPlayedFile = playableFiles[currentPlayingIndex];
      for (var i = 0; i < folderEntries.length; i++) {
        if (folderEntries[i].name === lastPlayedFile.name) {
          selectedFolderIndex = i;
          break;
        }
      }
    } else {
      selectedFolderIndex = musicPlayerReturnToIndex;
    }

    currentPlayingFile = null;
    currentPlayingIndex = -1;
    playbackElapsed = 0;
    playbackDuration = 0;
    isPaused = false;
    musicPlayerPlayAllOn = false; // Reset Play All state on exit

    updateScrollOffset();
    currentView = 'split';
    render();
  }

  function playAllMusicFromOptions() {
    buildPlayableMusicList();
    if (playableFiles.length === 0) return;

    var startEntry;
    if (mediaShuffleOn) {
      var startIndex = Math.floor(Math.random() * playableFiles.length);
      startEntry = playableFiles[startIndex];
    } else {
      startEntry = playableFiles[0];
    }
    openMusicPlayer(startEntry, true);
  }

  function buildPlayableMusicList() {
    playableFiles = [];
    for (var i = 0; i < folderEntries.length; i++) {
      var entry = folderEntries[i];
      if (!entry.isDirectory && isMusicFile(entry.name)) {
        playableFiles.push(entry);
      }
    }
  }

  function startMusicPlayerTimer() {
    stopPlaybackTimer();
    if (!currentPlayingFile) return;

    playbackDuration = getFileDuration(currentPlayingFile.name);
    playbackElapsed = 0;
    isPaused = false;

    playbackTimer = setInterval(function() {
      if (!isPaused && musicPlayerFastMode === null) {
        playbackElapsed++;
        if (playbackElapsed >= playbackDuration) {
          onMusicPlayerComplete();
          return;
        }
      } else if (musicPlayerFastMode === 'rewind') {
        var speeds = [2, 4, 8, 16, 32];
        var delta = speeds[musicPlayerFastSpeed];
        playbackElapsed = Math.max(0, playbackElapsed - delta);
        if (playbackElapsed <= 0) {
          playbackElapsed = 0;
        }
      } else if (musicPlayerFastMode === 'forward') {
        var speeds = [2, 4, 8, 16, 32];
        var delta = speeds[musicPlayerFastSpeed];
        playbackElapsed = Math.min(playbackDuration - 1, playbackElapsed + delta);
        if (playbackElapsed >= playbackDuration - 1) {
          onMusicPlayerComplete();
          return;
        }
      }
      if (currentView === 'music-player') {
        renderMusicPlayer();
      }
    }, 1000);
  }

  function onMusicPlayerComplete() {
    stopPlaybackTimer();
    musicPlayerFastMode = null;
    musicPlayerFastSpeed = 0;

    // Case 1: No Play all, no Repeat (with or without Shuffle)
    // -> Play current song once, then stop
    if (!musicPlayerPlayAllOn && !musicPlayerRepeatOn) {
      closeMusicPlayer();
      return;
    }

    // Case 2: Only Repeat (no Play all, with or without Shuffle)
    // -> Repeat current song forever
    if (!musicPlayerPlayAllOn && musicPlayerRepeatOn) {
      playbackElapsed = 0;
      startMusicPlayerTimer();
      return;
    }

    // Case 3: Play all (with or without Shuffle/Repeat)
    if (musicPlayerPlayAllOn) {
      // Mark current song as played
      if (musicPlayerPlayedIndices.indexOf(currentPlayingIndex) === -1) {
        musicPlayerPlayedIndices.push(currentPlayingIndex);
      }

      var nextIndex = -1;

      if (musicPlayerShuffleOn) {
        // Shuffle mode: pick random unplayed song
        var unplayedIndices = [];
        for (var i = 0; i < playableFiles.length; i++) {
          if (musicPlayerPlayedIndices.indexOf(i) === -1) {
            unplayedIndices.push(i);
          }
        }

        if (unplayedIndices.length > 0) {
          // Still have unplayed songs
          var randomIdx = Math.floor(Math.random() * unplayedIndices.length);
          nextIndex = unplayedIndices[randomIdx];
        } else {
          // All songs played once
          if (musicPlayerRepeatOn) {
            // Play all + Shuffle + Repeat: reset and continue
            musicPlayerPlayedIndices = [];
            var randomIdx = Math.floor(Math.random() * playableFiles.length);
            nextIndex = randomIdx;
          } else {
            // Play all + Shuffle (no Repeat): stop
            closeMusicPlayer();
            return;
          }
        }
      } else {
        // Sequential mode: play next in order
        nextIndex = currentPlayingIndex + 1;

        if (nextIndex >= playableFiles.length) {
          // Reached end of playlist
          if (musicPlayerRepeatOn) {
            // Play all + Repeat: loop back to start
            musicPlayerPlayedIndices = [];
            nextIndex = 0;
          } else {
            // Play all (no Repeat): stop
            closeMusicPlayer();
            return;
          }
        }
      }

      if (nextIndex >= 0) {
        playMusicAtIndex(nextIndex);
      }
    }
  }

  function playMusicAtIndex(index) {
    if (index >= 0 && index < playableFiles.length) {
      stopPlaybackTimer();
      musicPlayerFastMode = null;
      musicPlayerFastSpeed = 0;
      currentPlayingIndex = index;
      currentPlayingFile = playableFiles[index];
      musicPlayerReturnToIndex = findFolderEntryIndex(currentPlayingFile.name);
      startMusicPlayerTimer();
      renderMusicPlayer();
    }
  }

  function findFolderEntryIndex(filename) {
    for (var i = 0; i < folderEntries.length; i++) {
      if (folderEntries[i].name === filename) return i;
    }
    return 0;
  }

  // Photo Options functions
  function openPhotoOptions(fromLeftPanel) {
    var cat = CATEGORIES[selectedCategoryIndex];
    if (cat.id !== 'photo') return false;

    photoOptionsFromLeftPanel = fromLeftPanel;
    photoOptionsIndex = 0;
    currentView = 'photo-options';
    render();
    return true;
  }

  function closePhotoOptions() {
    currentView = 'split';
    render();
  }

  function renderPhotoOptions() {
    if (!photoOptionsEl) return;

    var shuffleToggle = photoShuffleOn ?
      '<span class="photo-opt-toggle photo-opt-toggle-on"></span>' :
      '<span class="photo-opt-toggle photo-opt-toggle-off"></span>';

    // Determine menu items based on context
    var hasSlideshow = !photoOptionsFromLeftPanel && folderEntries.length > 0 &&
                       selectedFolderIndex < folderEntries.length &&
                       !folderEntries[selectedFolderIndex].isDirectory &&
                       isPhotoFile(folderEntries[selectedFolderIndex].name);
    var hasInfo = hasSlideshow;

    var html = '<div class="photo-opt-dialog">' +
      '<div class="photo-opt-header">' +
        '<span class="photo-opt-title">Options</span>' +
      '</div>' +
      '<div class="photo-opt-list">';

    var idx = 0;

    // Slideshow option (only for photo files)
    if (hasSlideshow) {
      var slideshowCls = 'photo-opt-item' + (photoOptionsIndex === idx ? ' photo-opt-item-selected' : '');
      html += '<div class="' + slideshowCls + '" data-index="' + idx + '">' +
        '<span class="photo-opt-name">Slide show</span>' +
      '</div>';
      idx++;
    }

    // List/Thumbnails
    var viewmodeCls = 'photo-opt-item' + (photoOptionsIndex === idx ? ' photo-opt-item-selected' : '');
    html += '<div class="' + viewmodeCls + '" data-index="' + idx + '">' +
      '<span class="photo-opt-name">List/Thumbnails</span>' +
      '<span class="photo-opt-arrow">&#10095;</span>' +
    '</div>';
    idx++;

    // Shuffle
    var shuffleCls = 'photo-opt-item' + (photoOptionsIndex === idx ? ' photo-opt-item-selected' : '');
    html += '<div class="' + shuffleCls + '" data-index="' + idx + '">' +
      '<span class="photo-opt-name">Shuffle</span>' +
      shuffleToggle +
    '</div>';
    idx++;

    // Repeat
    var repeatCls = 'photo-opt-item' + (photoOptionsIndex === idx ? ' photo-opt-item-selected' : '');
    html += '<div class="' + repeatCls + '" data-index="' + idx + '">' +
      '<span class="photo-opt-name">Repeat</span>' +
      '<span class="photo-opt-arrow">&#10095;</span>' +
    '</div>';
    idx++;

    // Slide show speed
    var speedCls = 'photo-opt-item' + (photoOptionsIndex === idx ? ' photo-opt-item-selected' : '');
    html += '<div class="' + speedCls + '" data-index="' + idx + '">' +
      '<span class="photo-opt-name">Slide show speed</span>' +
      '<span class="photo-opt-arrow">&#10095;</span>' +
    '</div>';
    idx++;

    // Info (only for photo files)
    if (hasInfo) {
      var infoCls = 'photo-opt-item' + (photoOptionsIndex === idx ? ' photo-opt-item-selected' : '');
      html += '<div class="' + infoCls + '" data-index="' + idx + '">' +
        '<span class="photo-opt-name">Info</span>' +
      '</div>';
    }

    html += '</div></div>';

    photoOptionsEl.innerHTML = html;
  }

  function getPhotoOptionsMaxIndex() {
    var hasSlideshow = !photoOptionsFromLeftPanel && folderEntries.length > 0 &&
                       selectedFolderIndex < folderEntries.length &&
                       !folderEntries[selectedFolderIndex].isDirectory &&
                       isPhotoFile(folderEntries[selectedFolderIndex].name);
    // Base items: List/Thumbnails, Shuffle, Repeat, Slide show speed = 4
    // If hasSlideshow: +1 for Slideshow, +1 for Info = 6 total
    // If folder/left panel: 4 total
    if (hasSlideshow) {
      return 5; // 0-5: slideshow, viewmode, shuffle, repeat, speed, info
    }
    return 3; // 0-3: viewmode, shuffle, repeat, speed
  }

  function getPhotoOptionItem(index) {
    var hasSlideshow = !photoOptionsFromLeftPanel && folderEntries.length > 0 &&
                       selectedFolderIndex < folderEntries.length &&
                       !folderEntries[selectedFolderIndex].isDirectory &&
                       isPhotoFile(folderEntries[selectedFolderIndex].name);

    if (hasSlideshow) {
      var items = ['slideshow', 'viewmode', 'shuffle', 'repeat', 'speed', 'info'];
      return items[index] || '';
    } else {
      var items = ['viewmode', 'shuffle', 'repeat', 'speed'];
      return items[index] || '';
    }
  }

  function handlePhotoOptionsOK() {
    var item = getPhotoOptionItem(photoOptionsIndex);
    switch (item) {
      case 'slideshow':
        closePhotoOptions();
        playAllPhotosFromOptions();
        break;
      case 'viewmode':
        openPhotoViewmodeSubmenu();
        break;
      case 'shuffle':
        photoShuffleOn = !photoShuffleOn;
        renderPhotoOptions();
        break;
      case 'repeat':
        openPhotoRepeatSubmenu();
        break;
      case 'speed':
        openPhotoSlidespeedSubmenu();
        break;
      case 'info':
        closePhotoOptions();
        showPhotoInfo();
        break;
    }
  }

  function handlePhotoOptionsRight() {
    var item = getPhotoOptionItem(photoOptionsIndex);
    if (item === 'viewmode' || item === 'repeat' || item === 'speed') {
      handlePhotoOptionsOK();
    }
  }

  // Photo Viewmode submenu
  function openPhotoViewmodeSubmenu() {
    photoViewmodeSubmenuIndex = (photoViewMode === 'thumbnails') ? 0 : 1;
    currentView = 'photo-viewmode-submenu';
    render();
  }

  function closePhotoViewmodeSubmenu() {
    currentView = 'photo-options';
    render();
  }

  function renderPhotoViewmodeSubmenu() {
    if (!photoViewmodeSubmenuEl) return;

    var thumbCls = 'photo-submenu-item' + (photoViewmodeSubmenuIndex === 0 ? ' photo-submenu-item-selected' : '');
    var listCls = 'photo-submenu-item' + (photoViewmodeSubmenuIndex === 1 ? ' photo-submenu-item-selected' : '');

    var thumbCheck = (photoViewMode === 'thumbnails') ? '<span class="photo-submenu-check">&#10003;</span>' : '';
    var listCheck = (photoViewMode === 'list') ? '<span class="photo-submenu-check">&#10003;</span>' : '';

    var html = '<div class="photo-submenu-dialog">' +
      '<div class="photo-submenu-header">' +
        '<span class="photo-submenu-title">List/Thumbnails</span>' +
      '</div>' +
      '<div class="photo-submenu-list">' +
        '<div class="' + thumbCls + '" data-index="0">' +
          '<span class="photo-submenu-name">Thumbnails</span>' +
          thumbCheck +
        '</div>' +
        '<div class="' + listCls + '" data-index="1">' +
          '<span class="photo-submenu-name">List</span>' +
          listCheck +
        '</div>' +
      '</div>' +
    '</div>';

    photoViewmodeSubmenuEl.innerHTML = html;
  }

  function confirmPhotoViewmode() {
    photoViewMode = (photoViewmodeSubmenuIndex === 0) ? 'thumbnails' : 'list';
    renderPhotoViewmodeSubmenu();
  }

  // Photo Repeat submenu
  function openPhotoRepeatSubmenu() {
    photoRepeatSubmenuIndex = (photoRepeatMode === 'play-once') ? 0 : 1;
    currentView = 'photo-repeat-submenu';
    render();
  }

  function closePhotoRepeatSubmenu() {
    currentView = 'photo-options';
    render();
  }

  function renderPhotoRepeatSubmenu() {
    if (!photoRepeatSubmenuEl) return;

    var playOnceCls = 'photo-submenu-item' + (photoRepeatSubmenuIndex === 0 ? ' photo-submenu-item-selected' : '');
    var repeatCls = 'photo-submenu-item' + (photoRepeatSubmenuIndex === 1 ? ' photo-submenu-item-selected' : '');

    var playOnceCheck = (photoRepeatMode === 'play-once') ? '<span class="photo-submenu-check">&#10003;</span>' : '';
    var repeatCheck = (photoRepeatMode === 'repeat') ? '<span class="photo-submenu-check">&#10003;</span>' : '';

    var html = '<div class="photo-submenu-dialog">' +
      '<div class="photo-submenu-header">' +
        '<span class="photo-submenu-title">Repeat</span>' +
      '</div>' +
      '<div class="photo-submenu-list">' +
        '<div class="' + playOnceCls + '" data-index="0">' +
          '<span class="photo-submenu-name">Repeat once</span>' +
          playOnceCheck +
        '</div>' +
        '<div class="' + repeatCls + '" data-index="1">' +
          '<span class="photo-submenu-name">Repeat</span>' +
          repeatCheck +
        '</div>' +
      '</div>' +
    '</div>';

    photoRepeatSubmenuEl.innerHTML = html;
  }

  function confirmPhotoRepeat() {
    photoRepeatMode = (photoRepeatSubmenuIndex === 0) ? 'play-once' : 'repeat';
    renderPhotoRepeatSubmenu();
  }

  // Photo Slide speed submenu
  function openPhotoSlidespeedSubmenu() {
    if (photoSlideSpeed === 'fast') photoSlidespeedSubmenuIndex = 0;
    else if (photoSlideSpeed === 'medium') photoSlidespeedSubmenuIndex = 1;
    else photoSlidespeedSubmenuIndex = 2;
    currentView = 'photo-slidespeed-submenu';
    render();
  }

  function closePhotoSlidespeedSubmenu() {
    currentView = 'photo-options';
    render();
  }

  function renderPhotoSlidespeedSubmenu() {
    if (!photoSlidespeedSubmenuEl) return;

    var fastCls = 'photo-submenu-item' + (photoSlidespeedSubmenuIndex === 0 ? ' photo-submenu-item-selected' : '');
    var mediumCls = 'photo-submenu-item' + (photoSlidespeedSubmenuIndex === 1 ? ' photo-submenu-item-selected' : '');
    var slowCls = 'photo-submenu-item' + (photoSlidespeedSubmenuIndex === 2 ? ' photo-submenu-item-selected' : '');

    var fastCheck = (photoSlideSpeed === 'fast') ? '<span class="photo-submenu-check">&#10003;</span>' : '';
    var mediumCheck = (photoSlideSpeed === 'medium') ? '<span class="photo-submenu-check">&#10003;</span>' : '';
    var slowCheck = (photoSlideSpeed === 'slow') ? '<span class="photo-submenu-check">&#10003;</span>' : '';

    var html = '<div class="photo-submenu-dialog">' +
      '<div class="photo-submenu-header">' +
        '<span class="photo-submenu-title">Slide show speed</span>' +
      '</div>' +
      '<div class="photo-submenu-list">' +
        '<div class="' + fastCls + '" data-index="0">' +
          '<span class="photo-submenu-name">Fast</span>' +
          fastCheck +
        '</div>' +
        '<div class="' + mediumCls + '" data-index="1">' +
          '<span class="photo-submenu-name">Medium</span>' +
          mediumCheck +
        '</div>' +
        '<div class="' + slowCls + '" data-index="2">' +
          '<span class="photo-submenu-name">Slow</span>' +
          slowCheck +
        '</div>' +
      '</div>' +
    '</div>';

    photoSlidespeedSubmenuEl.innerHTML = html;
  }

  function confirmPhotoSlidespeed() {
    if (photoSlidespeedSubmenuIndex === 0) photoSlideSpeed = 'fast';
    else if (photoSlidespeedSubmenuIndex === 1) photoSlideSpeed = 'medium';
    else photoSlideSpeed = 'slow';
    renderPhotoSlidespeedSubmenu();
  }

  // Photo Info
  function showPhotoInfo() {
    if (activePanel !== 'right') return false;
    if (folderEntries.length === 0) return false;

    var entry = folderEntries[selectedFolderIndex];
    if (entry.isDirectory) return false;

    var cat = CATEGORIES[selectedCategoryIndex];
    if (cat.id !== 'photo' || !isPhotoFile(entry.name)) return false;

    currentView = 'photo-info';
    render();
    return true;
  }

  function closePhotoInfo() {
    currentView = 'split';
    render();
  }

  function renderPhotoInfo() {
    if (!photoInfoEl) return;
    var entry = folderEntries[selectedFolderIndex];
    if (!entry) return;

    var dateStr = generateMockDate();
    var dimensionsStr = generateMockDimensions();
    var sizeStr = generateMockFileSize();

    var html = '<div class="photo-info-dialog">' +
      '<div class="photo-info-title">Picture metadata</div>' +
      '<div class="photo-info-content">' +
        '<div class="photo-info-row"><span class="photo-info-label">Title:</span> ' + escapeHtml(entry.name) + '</div>' +
        '<div class="photo-info-row"><span class="photo-info-label">Date:</span> ' + dateStr + '</div>' +
        '<div class="photo-info-row"><span class="photo-info-label">Size:</span> ' + dimensionsStr + '</div>' +
        '<div class="photo-info-row"><span class="photo-info-label">File size:</span> ' + sizeStr + '</div>' +
      '</div>' +
      '<button class="photo-info-close">Close</button>' +
    '</div>';

    photoInfoEl.innerHTML = html;
  }

  // Photo Player
  function playAllPhotosFromOptions() {
    buildPlayablePhotoList();
    if (playableFiles.length === 0) return;

    var startEntry;
    if (mediaShuffleOn) {
      var startIndex = Math.floor(Math.random() * playableFiles.length);
      startEntry = playableFiles[startIndex];
    } else {
      startEntry = playableFiles[0];
    }
    openPhotoPlayer(startEntry, true);
  }

  function buildPlayablePhotoList() {
    playableFiles = [];
    for (var i = 0; i < folderEntries.length; i++) {
      var entry = folderEntries[i];
      if (!entry.isDirectory && isPhotoFile(entry.name)) {
        playableFiles.push(entry);
      }
    }
  }

  function openPhotoPlayer(entry, fromSlideshow) {
    photoPlayerFromSlideshow = fromSlideshow || false;
    photoPlayerReturnToIndex = selectedFolderIndex;
    photoPlayerControlIndex = 0;
    photoPlayerPlayedIndices = [];

    // Sync options state with unified Media Options
    if (fromSlideshow) {
      photoPlayerPlayAllOn = true;
    } else {
      photoPlayerPlayAllOn = false;
    }
    photoPlayerShuffleOn = mediaShuffleOn;
    photoPlayerRepeatOn = mediaRepeatOn;
    photoPlayerSlideSpeed = mediaSlideSpeed;

    buildPlayablePhotoList();
    currentPlayingIndex = -1;
    for (var i = 0; i < playableFiles.length; i++) {
      if (playableFiles[i].name === entry.name) {
        currentPlayingIndex = i;
        break;
      }
    }
    if (currentPlayingIndex === -1 && playableFiles.length > 0) {
      currentPlayingIndex = 0;
    }
    currentPlayingFile = entry;
    currentView = 'photo-player';
    // Initialize HUD as visible with auto-hide timer
    photoPlayerHudVisible = true;
    photoPlayerHudLocked = false;
    startPhotoPlayerTimer();
    render();
    startPhotoPlayerHudTimer(); // Start auto-hide after initial render
  }

  function closePhotoPlayer() {
    stopPlaybackTimer();
    clearPhotoPlayerHudTimer(); // Clean up HUD timer

    // Find and select the last played file in the list
    if (currentPlayingIndex >= 0 && currentPlayingIndex < playableFiles.length) {
      var lastPlayedFile = playableFiles[currentPlayingIndex];
      for (var i = 0; i < folderEntries.length; i++) {
        if (folderEntries[i].name === lastPlayedFile.name) {
          selectedFolderIndex = i;
          break;
        }
      }
    } else {
      selectedFolderIndex = photoPlayerReturnToIndex;
    }

    currentPlayingFile = null;
    currentPlayingIndex = -1;
    playbackElapsed = 0;
    playbackDuration = 0;
    isPaused = false;
    photoPlayerPlayAllOn = false;

    updateScrollOffset();
    currentView = 'split';
    render();
  }

  function startPhotoPlayerTimer() {
    stopPlaybackTimer();
    if (!currentPlayingFile) return;

    playbackDuration = SLIDE_SPEED_SECONDS[photoPlayerSlideSpeed] || 4;
    playbackElapsed = 0;
    isPaused = false;

    playbackTimer = setInterval(function() {
      if (!isPaused) {
        playbackElapsed++;
        if (playbackElapsed >= playbackDuration) {
          onPhotoPlayerComplete();
          return;
        }
      }
      if (currentView === 'photo-player' || currentView === 'photo-slidespeed-menu') {
        renderPhotoPlayer();
      }
    }, 1000);
  }

  function onPhotoPlayerComplete() {
    stopPlaybackTimer();

    // Case 1: No slideshow (Play all), no Repeat - stay on photo, paused
    if (!photoPlayerPlayAllOn && !photoPlayerRepeatOn) {
      isPaused = true;
      playbackElapsed = playbackDuration;
      renderPhotoPlayer();
      return;
    }

    // Case 2: Only Repeat (no Play all)
    if (!photoPlayerPlayAllOn && photoPlayerRepeatOn) {
      playbackElapsed = 0;
      startPhotoPlayerTimer();
      return;
    }

    // Case 3: Play all (slideshow)
    if (photoPlayerPlayAllOn) {
      if (photoPlayerPlayedIndices.indexOf(currentPlayingIndex) === -1) {
        photoPlayerPlayedIndices.push(currentPlayingIndex);
      }

      var nextIndex = -1;

      if (photoPlayerShuffleOn) {
        var unplayedIndices = [];
        for (var i = 0; i < playableFiles.length; i++) {
          if (photoPlayerPlayedIndices.indexOf(i) === -1) {
            unplayedIndices.push(i);
          }
        }

        if (unplayedIndices.length > 0) {
          var randomIdx = Math.floor(Math.random() * unplayedIndices.length);
          nextIndex = unplayedIndices[randomIdx];
        } else {
          if (photoPlayerRepeatOn) {
            photoPlayerPlayedIndices = [];
            var randomIdx = Math.floor(Math.random() * playableFiles.length);
            nextIndex = randomIdx;
          } else {
            closePhotoPlayer();
            return;
          }
        }
      } else {
        nextIndex = currentPlayingIndex + 1;

        if (nextIndex >= playableFiles.length) {
          if (photoPlayerRepeatOn) {
            photoPlayerPlayedIndices = [];
            nextIndex = 0;
          } else {
            closePhotoPlayer();
            return;
          }
        }
      }

      if (nextIndex >= 0) {
        playPhotoAtIndex(nextIndex);
      }
    }
  }

  function playPhotoAtIndex(index) {
    if (index >= 0 && index < playableFiles.length) {
      stopPlaybackTimer();
      currentPlayingIndex = index;
      currentPlayingFile = playableFiles[index];
      photoPlayerReturnToIndex = findFolderEntryIndex(currentPlayingFile.name);
      startPhotoPlayerTimer();
      renderPhotoPlayer();
    }
  }

  function renderPhotoPlayer() {
    if (!photoPlayerEl || !currentPlayingFile) return;

    // Build control icons (9 controls: play/pause, rewind, forward, prev, next, playall, shuffle, repeat, slidespeed)
    // For Photos: rewind = prev photo, forward = next photo, slidespeed = highlighted
    var playPauseIcon = isPaused ? getPlayerIcon('play', true) : getPlayerIcon('pause', true);

    var controls = [
      { id: 'playpause', content: playPauseIcon, highlight: true },
      { id: 'rewind', content: getPlayerIcon('rewind', true), highlight: true },
      { id: 'forward', content: getPlayerIcon('forward', true), highlight: true },
      { id: 'prev', content: getPlayerIcon('prev', true), highlight: true },
      { id: 'next', content: getPlayerIcon('next', true), highlight: true },
      { id: 'playall', content: getPlayerIcon('playall', photoPlayerPlayAllOn), highlight: photoPlayerPlayAllOn },
      { id: 'shuffle', content: getPlayerIcon('shuffle', mediaShuffleOn), highlight: mediaShuffleOn },
      { id: 'repeat', content: getPlayerIcon('repeat', mediaRepeatOn), highlight: mediaRepeatOn },
      { id: 'slidespeed', content: getPlayerIcon('speedometer', true, mediaSlideSpeed), highlight: true }
    ];

    var controlsHtml = '';
    for (var i = 0; i < controls.length; i++) {
      var ctrl = controls[i];
      var isSelected = (photoPlayerControlIndex === i);
      var cls = 'player-ctrl-btn' + (isSelected ? ' player-ctrl-selected' : '') + (ctrl.highlight ? ' player-ctrl-on' : ' player-ctrl-off');
      controlsHtml += '<div class="' + cls + '" data-index="' + i + '">' + ctrl.content + '</div>';
    }

    // Dynamic background - use currentPlayingIndex directly for variety
    var bgUrl = getPhotoBackground(currentPlayingIndex);
    var bgStyle = "background-color:#1a1a1a;background-image:url('" + bgUrl + "');background-size:cover;background-position:center;background-repeat:no-repeat";

    // Build HUD HTML (no metadata line, just filename + counter + controls)
    var hudHtml = '';
    if (photoPlayerHudVisible) {
      hudHtml =
        '<div class="player-hud">' +
          '<div class="player-hud-top">' +
            '<div class="player-filename">' + escapeHtml(currentPlayingFile.name) + '</div>' +
            '<div class="player-counter">' + (currentPlayingIndex + 1) + '/' + playableFiles.length + '</div>' +
          '</div>' +
          '<div class="player-controls">' + controlsHtml + '</div>' +
        '</div>';
    }

    photoPlayerEl.innerHTML =
      '<div class="pp-bg" style="' + bgStyle + '"></div>' +
      hudHtml;
  }

  function handlePhotoPlayerNav(act) {
    switch (act) {
      case 'LEFT':
        if (photoPlayerHudVisible && photoPlayerControlIndex > 0) {
          photoPlayerControlIndex--;
          // Restart auto-hide timer only if not locked by INFO
          if (!photoPlayerHudLocked) {
            startPhotoPlayerHudTimer();
          }
          renderPhotoPlayer();
        }
        return true;
      case 'RIGHT':
        if (photoPlayerHudVisible && photoPlayerControlIndex < 8) {
          photoPlayerControlIndex++;
          // Restart auto-hide timer only if not locked by INFO
          if (!photoPlayerHudLocked) {
            startPhotoPlayerHudTimer();
          }
          renderPhotoPlayer();
        }
        return true;
      case 'OK':
        // If HUD hidden, just show it; if visible, perform control action
        if (photoPlayerHudVisible) {
          resetPhotoPlayerHudOnPlayPause(); // Restart auto-hide timer
          handlePhotoPlayerOK();
        } else {
          resetPhotoPlayerHudOnPlayPause(); // Show HUD with auto-hide
        }
        return true;
      case 'PLAY':
        // Show HUD with auto-hide, resume if paused
        if (photoPlayerHudVisible) {
          resetPhotoPlayerHudOnPlayPause(); // Restart auto-hide timer
        } else {
          resetPhotoPlayerHudOnPlayPause(); // Show HUD with auto-hide
        }
        if (isPaused) {
          isPaused = false;
          renderPhotoPlayer();
        }
        return true;
      case 'PAUSE':
        // Show HUD with auto-hide, pause if playing
        if (photoPlayerHudVisible) {
          resetPhotoPlayerHudOnPlayPause(); // Restart auto-hide timer
        } else {
          resetPhotoPlayerHudOnPlayPause(); // Show HUD with auto-hide
        }
        if (!isPaused) {
          isPaused = true;
          renderPhotoPlayer();
        }
        return true;
      case 'BACK':
        closePhotoPlayer();
        return true;
      case 'INFO':
        // Toggle HUD visibility with INFO key
        togglePhotoPlayerHudByInfo();
        return true;
      case 'OPTION':
        // No action in Photo Player
        return true;
      default:
        return false;
    }
  }

  function handlePhotoPlayerOK() {
    switch (photoPlayerControlIndex) {
      case 0: // Play/Pause
        isPaused = !isPaused;
        break;
      case 1: // Rewind = Previous photo (for Photos)
        if (playableFiles.length > 0) {
          var prevIndex = (currentPlayingIndex - 1 + playableFiles.length) % playableFiles.length;
          playPhotoAtIndex(prevIndex);
        }
        return;
      case 2: // Forward = Next photo (for Photos)
        if (playableFiles.length > 0) {
          var nextIndex = (currentPlayingIndex + 1) % playableFiles.length;
          playPhotoAtIndex(nextIndex);
        }
        return;
      case 3: // Previous
        if (playableFiles.length > 0) {
          var prevIndex = (currentPlayingIndex - 1 + playableFiles.length) % playableFiles.length;
          playPhotoAtIndex(prevIndex);
        }
        return;
      case 4: // Next
        if (playableFiles.length > 0) {
          var nextIndex = (currentPlayingIndex + 1) % playableFiles.length;
          playPhotoAtIndex(nextIndex);
        }
        return;
      case 5: // Play All (Slideshow)
        photoPlayerPlayAllOn = !photoPlayerPlayAllOn;
        photoPlayerPlayedIndices = [];
        break;
      case 6: // Shuffle
        mediaShuffleOn = !mediaShuffleOn;
        photoPlayerShuffleOn = mediaShuffleOn;
        photoPlayerPlayedIndices = [];
        break;
      case 7: // Repeat
        mediaRepeatOn = !mediaRepeatOn;
        photoPlayerRepeatOn = mediaRepeatOn;
        break;
      case 8: // Slide speed - open submenu
        openPlayerSlidespeedMenu('photo');
        return;
    }
    renderPhotoPlayer();
  }

  // Photo slide speed menu (in player, similar to Info popup)
  function openPhotoSlidespeedMenu() {
    if (photoPlayerSlideSpeed === 'fast') photoSlidespeedMenuIndex = 0;
    else if (photoPlayerSlideSpeed === 'medium') photoSlidespeedMenuIndex = 1;
    else photoSlidespeedMenuIndex = 2;
    currentView = 'photo-slidespeed-menu';
    render();
  }

  function closePhotoSlidespeedMenu() {
    currentView = 'photo-player';
    render();
  }

  function renderPhotoSlidespeedMenu() {
    if (!photoSlidespeedMenuEl) return;

    var fastCls = 'pp-speed-item' + (photoSlidespeedMenuIndex === 0 ? ' pp-speed-item-selected' : '');
    var mediumCls = 'pp-speed-item' + (photoSlidespeedMenuIndex === 1 ? ' pp-speed-item-selected' : '');
    var slowCls = 'pp-speed-item' + (photoSlidespeedMenuIndex === 2 ? ' pp-speed-item-selected' : '');

    var fastCheck = (photoPlayerSlideSpeed === 'fast') ? '<span class="pp-speed-check">&#10003;</span>' : '';
    var mediumCheck = (photoPlayerSlideSpeed === 'medium') ? '<span class="pp-speed-check">&#10003;</span>' : '';
    var slowCheck = (photoPlayerSlideSpeed === 'slow') ? '<span class="pp-speed-check">&#10003;</span>' : '';

    var html = '<div class="pp-speed-dialog">' +
      '<div class="pp-speed-header">' +
        '<span class="pp-speed-title">Slide show speed</span>' +
      '</div>' +
      '<div class="pp-speed-list">' +
        '<div class="' + fastCls + '" data-index="0">' +
          '<span class="pp-speed-name">Fast</span>' +
          fastCheck +
        '</div>' +
        '<div class="' + mediumCls + '" data-index="1">' +
          '<span class="pp-speed-name">Medium</span>' +
          mediumCheck +
        '</div>' +
        '<div class="' + slowCls + '" data-index="2">' +
          '<span class="pp-speed-name">Slow</span>' +
          slowCheck +
        '</div>' +
      '</div>' +
    '</div>';

    photoSlidespeedMenuEl.innerHTML = html;
  }

  function confirmPhotoSlidespeedMenu() {
    if (photoSlidespeedMenuIndex === 0) photoPlayerSlideSpeed = 'fast';
    else if (photoSlidespeedMenuIndex === 1) photoPlayerSlideSpeed = 'medium';
    else photoPlayerSlideSpeed = 'slow';

    // Sync back to unified options
    mediaSlideSpeed = photoPlayerSlideSpeed;

    // Update timer with new speed
    playbackDuration = SLIDE_SPEED_SECONDS[photoPlayerSlideSpeed] || 4;
    if (playbackElapsed >= playbackDuration) {
      playbackElapsed = playbackDuration - 1;
    }

    renderPhotoSlidespeedMenu();
  }

  // Unified Player Slidespeed Menu (used by Video/Music/Photo HUD)
  var playerSlidespeedMenuSource = null; // 'video' | 'music' | 'photo'
  var playerSlidespeedMenuIndex = 0;

  function openPlayerSlidespeedMenu(source) {
    playerSlidespeedMenuSource = source;
    if (mediaSlideSpeed === 'fast') playerSlidespeedMenuIndex = 0;
    else if (mediaSlideSpeed === 'medium') playerSlidespeedMenuIndex = 1;
    else playerSlidespeedMenuIndex = 2;

    // Stop HUD auto-hide timer and keep HUD visible while in menu
    if (source === 'video') {
      clearVideoPlayerHudTimer();
    } else if (source === 'music') {
      clearMusicPlayerHudTimer();
    } else {
      clearPhotoPlayerHudTimer();
    }

    currentView = 'player-slidespeed-menu';
    render();
  }

  function closePlayerSlidespeedMenu(showHud) {
    // Return to player view
    if (playerSlidespeedMenuSource === 'video') {
      currentView = 'video-player';
      if (showHud) {
        videoPlayerHudVisible = true;
        videoPlayerHudLocked = false;
        startVideoPlayerHudTimer();
      }
    } else if (playerSlidespeedMenuSource === 'music') {
      currentView = 'music-player';
      if (showHud) {
        musicPlayerHudVisible = true;
        musicPlayerHudLocked = false;
        startMusicPlayerHudTimer();
      }
    } else {
      currentView = 'photo-player';
      if (showHud) {
        photoPlayerHudVisible = true;
        photoPlayerHudLocked = false;
        startPhotoPlayerHudTimer();
      }
    }
    render();
  }

  function renderPlayerSlidespeedMenu() {
    if (!playerSlidespeedMenuEl) return;

    var fastCls = 'pp-speed-item' + (playerSlidespeedMenuIndex === 0 ? ' pp-speed-item-selected' : '');
    var mediumCls = 'pp-speed-item' + (playerSlidespeedMenuIndex === 1 ? ' pp-speed-item-selected' : '');
    var slowCls = 'pp-speed-item' + (playerSlidespeedMenuIndex === 2 ? ' pp-speed-item-selected' : '');

    var fastCheck = (mediaSlideSpeed === 'fast') ? '<span class="pp-speed-check">&#10003;</span>' : '';
    var mediumCheck = (mediaSlideSpeed === 'medium') ? '<span class="pp-speed-check">&#10003;</span>' : '';
    var slowCheck = (mediaSlideSpeed === 'slow') ? '<span class="pp-speed-check">&#10003;</span>' : '';

    var html = '<div class="pp-speed-dialog">' +
      '<div class="pp-speed-header">' +
        '<span class="pp-speed-title">Slide show speed</span>' +
      '</div>' +
      '<div class="pp-speed-list">' +
        '<div class="' + fastCls + '" data-index="0">' +
          '<span class="pp-speed-name">Fast</span>' +
          fastCheck +
        '</div>' +
        '<div class="' + mediumCls + '" data-index="1">' +
          '<span class="pp-speed-name">Medium</span>' +
          mediumCheck +
        '</div>' +
        '<div class="' + slowCls + '" data-index="2">' +
          '<span class="pp-speed-name">Slow</span>' +
          slowCheck +
        '</div>' +
      '</div>' +
    '</div>';

    playerSlidespeedMenuEl.innerHTML = html;
  }

  function confirmPlayerSlidespeedMenu() {
    if (playerSlidespeedMenuIndex === 0) mediaSlideSpeed = 'fast';
    else if (playerSlidespeedMenuIndex === 1) mediaSlideSpeed = 'medium';
    else mediaSlideSpeed = 'slow';

    // Sync to photo player slide speed
    photoPlayerSlideSpeed = mediaSlideSpeed;

    renderPlayerSlidespeedMenu();
  }

  function handlePlayerSlidespeedMenuNav(act) {
    switch (act) {
      case 'UP':
        if (playerSlidespeedMenuIndex > 0) {
          playerSlidespeedMenuIndex--;
          renderPlayerSlidespeedMenu();
        }
        return true;
      case 'DOWN':
        if (playerSlidespeedMenuIndex < 2) {
          playerSlidespeedMenuIndex++;
          renderPlayerSlidespeedMenu();
        }
        return true;
      case 'OK':
        confirmPlayerSlidespeedMenu(); // Just toggle selection, stay in menu
        return true;
      case 'BACK':
        closePlayerSlidespeedMenu(true); // BACK returns to HUD
        return true;
      default:
        return false;
    }
  }

  function isPhotoCategory() {
    return CATEGORIES[selectedCategoryIndex].id === 'photo';
  }

  function isVideoCategory() {
    return CATEGORIES[selectedCategoryIndex].id === 'video';
  }

  // Video Options functions
  function openVideoOptions(fromLeftPanel) {
    var cat = CATEGORIES[selectedCategoryIndex];
    if (cat.id !== 'video') return false;

    videoOptionsFromLeftPanel = fromLeftPanel;
    videoOptionsIndex = 0;
    currentView = 'video-options';
    render();
    return true;
  }

  function closeVideoOptions() {
    currentView = 'split';
    render();
  }

  function renderVideoOptions() {
    if (!videoOptionsEl) return;

    var shuffleToggle = videoShuffleOn ?
      '<span class="video-opt-toggle video-opt-toggle-on"></span>' :
      '<span class="video-opt-toggle video-opt-toggle-off"></span>';

    // Determine menu items based on context
    var hasPlayAll = !videoOptionsFromLeftPanel && folderEntries.length > 0 &&
                     selectedFolderIndex < folderEntries.length &&
                     !folderEntries[selectedFolderIndex].isDirectory &&
                     isVideoFile(folderEntries[selectedFolderIndex].name);
    var hasInfo = hasPlayAll;

    var html = '<div class="video-opt-dialog">' +
      '<div class="video-opt-header">' +
        '<span class="video-opt-title">Options</span>' +
      '</div>' +
      '<div class="video-opt-list">';

    var idx = 0;

    // Play all option (only for video files)
    if (hasPlayAll) {
      var playAllCls = 'video-opt-item' + (videoOptionsIndex === idx ? ' video-opt-item-selected' : '');
      html += '<div class="' + playAllCls + '" data-index="' + idx + '">' +
        '<span class="video-opt-name">Play all</span>' +
      '</div>';
      idx++;
    }

    // List/Thumbnails
    var viewmodeCls = 'video-opt-item' + (videoOptionsIndex === idx ? ' video-opt-item-selected' : '');
    html += '<div class="' + viewmodeCls + '" data-index="' + idx + '">' +
      '<span class="video-opt-name">List/Thumbnails</span>' +
      '<span class="video-opt-arrow">&#10095;</span>' +
    '</div>';
    idx++;

    // Shuffle
    var shuffleCls = 'video-opt-item' + (videoOptionsIndex === idx ? ' video-opt-item-selected' : '');
    html += '<div class="' + shuffleCls + '" data-index="' + idx + '">' +
      '<span class="video-opt-name">Shuffle</span>' +
      shuffleToggle +
    '</div>';
    idx++;

    // Repeat
    var repeatCls = 'video-opt-item' + (videoOptionsIndex === idx ? ' video-opt-item-selected' : '');
    html += '<div class="' + repeatCls + '" data-index="' + idx + '">' +
      '<span class="video-opt-name">Repeat</span>' +
      '<span class="video-opt-arrow">&#10095;</span>' +
    '</div>';
    idx++;

    // Info (only for video files)
    if (hasInfo) {
      var infoCls = 'video-opt-item' + (videoOptionsIndex === idx ? ' video-opt-item-selected' : '');
      html += '<div class="' + infoCls + '" data-index="' + idx + '">' +
        '<span class="video-opt-name">Info</span>' +
      '</div>';
    }

    html += '</div></div>';

    videoOptionsEl.innerHTML = html;
  }

  function getVideoOptionsMaxIndex() {
    var hasPlayAll = !videoOptionsFromLeftPanel && folderEntries.length > 0 &&
                     selectedFolderIndex < folderEntries.length &&
                     !folderEntries[selectedFolderIndex].isDirectory &&
                     isVideoFile(folderEntries[selectedFolderIndex].name);
    // Base items: List/Thumbnails, Shuffle, Repeat = 3
    // If hasPlayAll: +1 for Play all, +1 for Info = 5 total
    // If folder/left panel: 3 total
    if (hasPlayAll) {
      return 4; // 0-4: playall, viewmode, shuffle, repeat, info
    }
    return 2; // 0-2: viewmode, shuffle, repeat
  }

  function getVideoOptionItem(index) {
    var hasPlayAll = !videoOptionsFromLeftPanel && folderEntries.length > 0 &&
                     selectedFolderIndex < folderEntries.length &&
                     !folderEntries[selectedFolderIndex].isDirectory &&
                     isVideoFile(folderEntries[selectedFolderIndex].name);

    if (hasPlayAll) {
      var items = ['playall', 'viewmode', 'shuffle', 'repeat', 'info'];
      return items[index] || '';
    } else {
      var items = ['viewmode', 'shuffle', 'repeat'];
      return items[index] || '';
    }
  }

  function handleVideoOptionsOK() {
    var item = getVideoOptionItem(videoOptionsIndex);
    switch (item) {
      case 'playall':
        closeVideoOptions();
        playAllVideosFromOptions();
        break;
      case 'viewmode':
        openVideoViewmodeSubmenu();
        break;
      case 'shuffle':
        videoShuffleOn = !videoShuffleOn;
        renderVideoOptions();
        break;
      case 'repeat':
        openVideoRepeatSubmenu();
        break;
      case 'info':
        closeVideoOptions();
        showVideoInfoDialog();
        break;
    }
  }

  function handleVideoOptionsRight() {
    var item = getVideoOptionItem(videoOptionsIndex);
    if (item === 'viewmode' || item === 'repeat') {
      handleVideoOptionsOK();
    }
  }

  // Video Viewmode submenu
  function openVideoViewmodeSubmenu() {
    videoViewmodeSubmenuIndex = (videoViewMode === 'thumbnails') ? 0 : 1;
    currentView = 'video-viewmode-submenu';
    render();
  }

  function closeVideoViewmodeSubmenu() {
    currentView = 'video-options';
    render();
  }

  function renderVideoViewmodeSubmenu() {
    if (!videoViewmodeSubmenuEl) return;

    var thumbCls = 'video-submenu-item' + (videoViewmodeSubmenuIndex === 0 ? ' video-submenu-item-selected' : '');
    var listCls = 'video-submenu-item' + (videoViewmodeSubmenuIndex === 1 ? ' video-submenu-item-selected' : '');

    var thumbCheck = (videoViewMode === 'thumbnails') ? '<span class="video-submenu-check">&#10003;</span>' : '';
    var listCheck = (videoViewMode === 'list') ? '<span class="video-submenu-check">&#10003;</span>' : '';

    var html = '<div class="video-submenu-dialog">' +
      '<div class="video-submenu-header">' +
        '<span class="video-submenu-title">List/Thumbnails</span>' +
      '</div>' +
      '<div class="video-submenu-list">' +
        '<div class="' + thumbCls + '" data-index="0">' +
          '<span class="video-submenu-name">Thumbnails</span>' +
          thumbCheck +
        '</div>' +
        '<div class="' + listCls + '" data-index="1">' +
          '<span class="video-submenu-name">List</span>' +
          listCheck +
        '</div>' +
      '</div>' +
    '</div>';

    videoViewmodeSubmenuEl.innerHTML = html;
  }

  function confirmVideoViewmode() {
    videoViewMode = (videoViewmodeSubmenuIndex === 0) ? 'thumbnails' : 'list';
    renderVideoViewmodeSubmenu();
  }

  // Video Repeat submenu
  function openVideoRepeatSubmenu() {
    videoRepeatSubmenuIndex = (videoRepeatMode === 'play-once') ? 0 : 1;
    currentView = 'video-repeat-submenu';
    render();
  }

  function closeVideoRepeatSubmenu() {
    currentView = 'video-options';
    render();
  }

  function renderVideoRepeatSubmenu() {
    if (!videoRepeatSubmenuEl) return;

    var playOnceCls = 'video-submenu-item' + (videoRepeatSubmenuIndex === 0 ? ' video-submenu-item-selected' : '');
    var repeatCls = 'video-submenu-item' + (videoRepeatSubmenuIndex === 1 ? ' video-submenu-item-selected' : '');

    var playOnceCheck = (videoRepeatMode === 'play-once') ? '<span class="video-submenu-check">&#10003;</span>' : '';
    var repeatCheck = (videoRepeatMode === 'repeat') ? '<span class="video-submenu-check">&#10003;</span>' : '';

    var html = '<div class="video-submenu-dialog">' +
      '<div class="video-submenu-header">' +
        '<span class="video-submenu-title">Repeat</span>' +
      '</div>' +
      '<div class="video-submenu-list">' +
        '<div class="' + playOnceCls + '" data-index="0">' +
          '<span class="video-submenu-name">Repeat once</span>' +
          playOnceCheck +
        '</div>' +
        '<div class="' + repeatCls + '" data-index="1">' +
          '<span class="video-submenu-name">Repeat</span>' +
          repeatCheck +
        '</div>' +
      '</div>' +
    '</div>';

    videoRepeatSubmenuEl.innerHTML = html;
  }

  function confirmVideoRepeat() {
    videoRepeatMode = (videoRepeatSubmenuIndex === 0) ? 'play-once' : 'repeat';
    renderVideoRepeatSubmenu();
  }

  // Video Info Dialog (from Options menu)
  function showVideoInfoDialog() {
    if (activePanel !== 'right') return false;
    if (folderEntries.length === 0) return false;

    var entry = folderEntries[selectedFolderIndex];
    if (entry.isDirectory) return false;
    if (!isVideoFile(entry.name)) return false;

    currentView = 'video-info-dialog';
    render();
    return true;
  }

  function closeVideoInfoDialog() {
    currentView = 'split';
    render();
  }

  function renderVideoInfoDialog() {
    if (!videoInfoDialogEl) return;
    var entry = folderEntries[selectedFolderIndex];
    if (!entry) return;

    var duration = getFileDuration(entry.name);
    var durationStr = formatDuration(duration);
    var sizeStr = generateMockFileSize();
    var dateStr = generateMockDate();

    var html = '<div class="video-info-dlg-dialog">' +
      '<div class="video-info-dlg-title">Video metadata</div>' +
      '<div class="video-info-dlg-content">' +
        '<div class="video-info-dlg-row"><span class="video-info-dlg-label">Title:</span> ' + escapeHtml(entry.name) + '</div>' +
        '<div class="video-info-dlg-row"><span class="video-info-dlg-label">Size:</span> ' + sizeStr + '</div>' +
        '<div class="video-info-dlg-row"><span class="video-info-dlg-label">Date:</span> ' + dateStr + '</div>' +
        '<div class="video-info-dlg-row"><span class="video-info-dlg-label">Duration:</span> ' + durationStr + '</div>' +
      '</div>' +
      '<button class="video-info-dlg-close">Close</button>' +
    '</div>';

    videoInfoDialogEl.innerHTML = html;
  }

  // Play all videos
  function buildPlayableVideoList() {
    playableFiles = [];
    for (var i = 0; i < folderEntries.length; i++) {
      var entry = folderEntries[i];
      if (!entry.isDirectory && isVideoFile(entry.name)) {
        playableFiles.push(entry);
      }
    }
  }

  function playAllVideosFromOptions() {
    buildPlayableVideoList();
    if (playableFiles.length === 0) return;

    var startEntry;
    if (mediaShuffleOn) {
      var startIndex = Math.floor(Math.random() * playableFiles.length);
      startEntry = playableFiles[startIndex];
    } else {
      startEntry = playableFiles[0];
    }
    openVideoPlayer(startEntry, true);
  }

  // Video Player HUD visibility functions
  function clearVideoPlayerHudTimer() {
    if (videoPlayerHudTimer) {
      clearTimeout(videoPlayerHudTimer);
      videoPlayerHudTimer = null;
    }
  }

  function startVideoPlayerHudTimer() {
    clearVideoPlayerHudTimer();
    if (videoPlayerHudLocked) return;
    videoPlayerHudTimer = setTimeout(function() {
      videoPlayerHudVisible = false;
      videoPlayerHudTimer = null;
      renderVideoPlayer();
    }, HUD_AUTO_HIDE_DELAY);
  }

  function showVideoPlayerHud(locked) {
    videoPlayerHudVisible = true;
    videoPlayerHudLocked = locked || false;
    if (!locked) {
      startVideoPlayerHudTimer();
    } else {
      clearVideoPlayerHudTimer();
    }
    renderVideoPlayer();
  }

  function hideVideoPlayerHud() {
    clearVideoPlayerHudTimer();
    videoPlayerHudVisible = false;
    videoPlayerHudLocked = false;
    renderVideoPlayer();
  }

  function toggleVideoPlayerHudByInfo() {
    if (videoPlayerHudVisible) {
      hideVideoPlayerHud();
    } else {
      showVideoPlayerHud(true);
    }
  }

  function resetVideoPlayerHudOnPlayPause() {
    videoPlayerHudLocked = false;
    showVideoPlayerHud(false);
  }

  // Video Player functions
  function openVideoPlayer(entry, fromPlayAll) {
    videoPlayerFromPlayAll = fromPlayAll || false;
    videoPlayerReturnToIndex = selectedFolderIndex;
    videoPlayerControlIndex = 0;
    videoPlayerPlayedIndices = [];
    videoPlayerFastMode = null;
    videoPlayerFastSpeed = 0;

    // Sync options state with unified Media Options
    if (fromPlayAll) {
      videoPlayerPlayAllOn = true;
    } else {
      videoPlayerPlayAllOn = false;
    }
    videoPlayerShuffleOn = mediaShuffleOn;
    videoPlayerRepeatOn = mediaRepeatOn;

    buildPlayableVideoList();
    currentPlayingIndex = -1;
    for (var i = 0; i < playableFiles.length; i++) {
      if (playableFiles[i].name === entry.name) {
        currentPlayingIndex = i;
        break;
      }
    }
    if (currentPlayingIndex === -1 && playableFiles.length > 0) {
      currentPlayingIndex = 0;
    }
    currentPlayingFile = entry;
    currentView = 'video-player';
    videoPlayerHudVisible = true;
    videoPlayerHudLocked = false;
    startVideoPlayerTimer();
    render();
    startVideoPlayerHudTimer();
  }

  function closeVideoPlayer() {
    stopPlaybackTimer();
    clearVideoPlayerHudTimer();
    videoPlayerFastMode = null;
    videoPlayerFastSpeed = 0;

    if (currentPlayingIndex >= 0 && currentPlayingIndex < playableFiles.length) {
      var lastPlayedFile = playableFiles[currentPlayingIndex];
      for (var i = 0; i < folderEntries.length; i++) {
        if (folderEntries[i].name === lastPlayedFile.name) {
          selectedFolderIndex = i;
          break;
        }
      }
    } else {
      selectedFolderIndex = videoPlayerReturnToIndex;
    }

    currentPlayingFile = null;
    currentPlayingIndex = -1;
    playbackElapsed = 0;
    playbackDuration = 0;
    isPaused = false;
    videoPlayerPlayAllOn = false;

    updateScrollOffset();
    currentView = 'split';
    render();
  }

  function startVideoPlayerTimer() {
    stopPlaybackTimer();
    if (!currentPlayingFile) return;

    playbackDuration = getFileDuration(currentPlayingFile.name);
    playbackElapsed = 0;
    isPaused = false;

    playbackTimer = setInterval(function() {
      if (!isPaused && videoPlayerFastMode === null) {
        playbackElapsed++;
        if (playbackElapsed >= playbackDuration) {
          onVideoPlayerComplete();
          return;
        }
      } else if (videoPlayerFastMode === 'rewind') {
        var speeds = [2, 4, 8, 16, 32];
        var delta = speeds[videoPlayerFastSpeed];
        playbackElapsed = Math.max(0, playbackElapsed - delta);
        if (playbackElapsed <= 0) {
          playbackElapsed = 0;
        }
      } else if (videoPlayerFastMode === 'forward') {
        var speeds = [2, 4, 8, 16, 32];
        var delta = speeds[videoPlayerFastSpeed];
        playbackElapsed = Math.min(playbackDuration - 1, playbackElapsed + delta);
        if (playbackElapsed >= playbackDuration - 1) {
          onVideoPlayerComplete();
          return;
        }
      }
      if (currentView === 'video-player') {
        renderVideoPlayer();
      }
    }, 1000);
  }

  function onVideoPlayerComplete() {
    stopPlaybackTimer();

    // Case 1: No Play all, no Repeat - stop
    if (!videoPlayerPlayAllOn && !videoPlayerRepeatOn) {
      closeVideoPlayer();
      return;
    }

    // Case 2: Only Repeat (no Play all) - repeat current video
    if (!videoPlayerPlayAllOn && videoPlayerRepeatOn) {
      playbackElapsed = 0;
      startVideoPlayerTimer();
      return;
    }

    // Case 3: Play all
    if (videoPlayerPlayAllOn) {
      if (videoPlayerPlayedIndices.indexOf(currentPlayingIndex) === -1) {
        videoPlayerPlayedIndices.push(currentPlayingIndex);
      }

      var nextIndex = -1;

      if (videoPlayerShuffleOn) {
        var unplayedIndices = [];
        for (var i = 0; i < playableFiles.length; i++) {
          if (videoPlayerPlayedIndices.indexOf(i) === -1) {
            unplayedIndices.push(i);
          }
        }

        if (unplayedIndices.length > 0) {
          var randomIdx = Math.floor(Math.random() * unplayedIndices.length);
          nextIndex = unplayedIndices[randomIdx];
        } else {
          if (videoPlayerRepeatOn) {
            videoPlayerPlayedIndices = [];
            var randomIdx = Math.floor(Math.random() * playableFiles.length);
            nextIndex = randomIdx;
          } else {
            closeVideoPlayer();
            return;
          }
        }
      } else {
        nextIndex = currentPlayingIndex + 1;

        if (nextIndex >= playableFiles.length) {
          if (videoPlayerRepeatOn) {
            videoPlayerPlayedIndices = [];
            nextIndex = 0;
          } else {
            closeVideoPlayer();
            return;
          }
        }
      }

      if (nextIndex >= 0) {
        playVideoAtIndex(nextIndex);
      }
    }
  }

  function playVideoAtIndex(index) {
    if (index >= 0 && index < playableFiles.length) {
      stopPlaybackTimer();
      currentPlayingIndex = index;
      currentPlayingFile = playableFiles[index];
      videoPlayerReturnToIndex = findFolderEntryIndex(currentPlayingFile.name);
      startVideoPlayerTimer();
      renderVideoPlayer();
    }
  }

  function renderVideoPlayer() {
    if (!videoPlayerEl || !currentPlayingFile) return;

    var progressPercent = playbackDuration > 0 ? (playbackElapsed / playbackDuration) * 100 : 0;

    // Build control icons (9 controls: play/pause, rewind, forward, prev, next, playall, shuffle, repeat, slidespeed)
    var playPauseIcon = isPaused ? getPlayerIcon('play', true) : getPlayerIcon('pause', true);

    // Fast mode display for rewind/forward
    var rewindContent, forwardContent;
    if (videoPlayerFastMode === 'rewind') {
      var speeds = ['x2', 'x4', 'x8', 'x16', 'x32'];
      rewindContent = '<span class="player-fast-speed">' + speeds[videoPlayerFastSpeed] + '</span>';
    } else {
      rewindContent = getPlayerIcon('rewind', true);
    }
    if (videoPlayerFastMode === 'forward') {
      var speeds = ['x2', 'x4', 'x8', 'x16', 'x32'];
      forwardContent = '<span class="player-fast-speed">' + speeds[videoPlayerFastSpeed] + '</span>';
    } else {
      forwardContent = getPlayerIcon('forward', true);
    }

    // Slidespeed is gray (not highlighted) for Video/Music, but still functional
    var controls = [
      { id: 'playpause', content: playPauseIcon, highlight: true },
      { id: 'rewind', content: rewindContent, highlight: true },
      { id: 'forward', content: forwardContent, highlight: true },
      { id: 'prev', content: getPlayerIcon('prev', true), highlight: true },
      { id: 'next', content: getPlayerIcon('next', true), highlight: true },
      { id: 'playall', content: getPlayerIcon('playall', videoPlayerPlayAllOn), highlight: videoPlayerPlayAllOn },
      { id: 'shuffle', content: getPlayerIcon('shuffle', mediaShuffleOn), highlight: mediaShuffleOn },
      { id: 'repeat', content: getPlayerIcon('repeat', mediaRepeatOn), highlight: mediaRepeatOn },
      { id: 'slidespeed', content: getPlayerIcon('speedometer', false, mediaSlideSpeed), highlight: false }
    ];

    var controlsHtml = '';
    for (var i = 0; i < controls.length; i++) {
      var ctrl = controls[i];
      var isSelected = (videoPlayerControlIndex === i);
      var cls = 'player-ctrl-btn' + (isSelected ? ' player-ctrl-selected' : '') + (ctrl.highlight ? ' player-ctrl-on' : ' player-ctrl-off');
      controlsHtml += '<div class="' + cls + '" data-index="' + i + '">' + ctrl.content + '</div>';
    }

    // Large timer display
    var timerMins = Math.floor(playbackElapsed / 60);
    var timerSecs = playbackElapsed % 60;
    var timerDisplay = (timerMins < 10 ? '0' : '') + timerMins + ':' + (timerSecs < 10 ? '0' : '') + timerSecs;

    // Build HUD HTML (no metadata line, just filename + counter + progress + controls)
    var hudHtml = '';
    if (videoPlayerHudVisible) {
      hudHtml =
        '<div class="player-hud">' +
          '<div class="player-hud-top">' +
            '<div class="player-filename">' + escapeHtml(currentPlayingFile.name) + '</div>' +
            '<div class="player-counter">' + (currentPlayingIndex + 1) + '/' + playableFiles.length + '</div>' +
          '</div>' +
          '<div class="player-progress">' +
            '<span class="player-time">' + formatDuration(playbackElapsed) + '</span>' +
            '<div class="player-progress-bar">' +
              '<div class="player-progress-fill" style="width:' + progressPercent + '%"></div>' +
            '</div>' +
            '<span class="player-time">' + formatDuration(playbackDuration) + '</span>' +
          '</div>' +
          '<div class="player-controls">' + controlsHtml + '</div>' +
        '</div>';
    }

    videoPlayerEl.innerHTML =
      '<div class="vp-bg">' +
        '<div class="vp-timer">' + timerDisplay + '</div>' +
        (isPaused ? '<div class="vp-pause-icon">&#10074;&#10074;</div>' : '') +
      '</div>' +
      hudHtml;
  }

  function handleVideoPlayerNav(act) {
    switch (act) {
      case 'LEFT':
        if (videoPlayerHudVisible && videoPlayerControlIndex > 0) {
          videoPlayerControlIndex--;
          // Restart auto-hide timer only if not locked by INFO
          if (!videoPlayerHudLocked) {
            startVideoPlayerHudTimer();
          }
          renderVideoPlayer();
        }
        return true;
      case 'RIGHT':
        if (videoPlayerHudVisible && videoPlayerControlIndex < 8) {
          videoPlayerControlIndex++;
          // Restart auto-hide timer only if not locked by INFO
          if (!videoPlayerHudLocked) {
            startVideoPlayerHudTimer();
          }
          renderVideoPlayer();
        }
        return true;
      case 'OK':
        if (videoPlayerHudVisible) {
          resetVideoPlayerHudOnPlayPause();
          handleVideoPlayerOK();
        } else {
          resetVideoPlayerHudOnPlayPause();
        }
        return true;
      case 'PLAY':
        if (videoPlayerHudVisible) {
          resetVideoPlayerHudOnPlayPause();
        } else {
          resetVideoPlayerHudOnPlayPause();
        }
        if (isPaused) {
          isPaused = false;
          renderVideoPlayer();
        }
        return true;
      case 'PAUSE':
        if (videoPlayerHudVisible) {
          resetVideoPlayerHudOnPlayPause();
        } else {
          resetVideoPlayerHudOnPlayPause();
        }
        if (!isPaused) {
          isPaused = true;
          renderVideoPlayer();
        }
        return true;
      case 'BACK':
        closeVideoPlayer();
        return true;
      case 'INFO':
        toggleVideoPlayerHudByInfo();
        return true;
      case 'OPTION':
        return true;
      default:
        return false;
    }
  }

  function handleVideoPlayerOK() {
    switch (videoPlayerControlIndex) {
      case 0: // Play/Pause
        videoPlayerFastMode = null;
        videoPlayerFastSpeed = 0;
        isPaused = !isPaused;
        break;
      case 1: // Rewind
        if (videoPlayerFastMode !== 'rewind') {
          videoPlayerFastMode = 'rewind';
          videoPlayerFastSpeed = 0;
          isPaused = true;
        } else {
          videoPlayerFastSpeed = (videoPlayerFastSpeed + 1) % 5;
        }
        break;
      case 2: // Forward
        if (videoPlayerFastMode !== 'forward') {
          videoPlayerFastMode = 'forward';
          videoPlayerFastSpeed = 0;
          isPaused = true;
        } else {
          videoPlayerFastSpeed = (videoPlayerFastSpeed + 1) % 5;
        }
        break;
      case 3: // Previous
        videoPlayerFastMode = null;
        videoPlayerFastSpeed = 0;
        if (playableFiles.length > 0) {
          var prevIndex = (currentPlayingIndex - 1 + playableFiles.length) % playableFiles.length;
          playVideoAtIndex(prevIndex);
        }
        return;
      case 4: // Next
        videoPlayerFastMode = null;
        videoPlayerFastSpeed = 0;
        if (playableFiles.length > 0) {
          var nextIndex = (currentPlayingIndex + 1) % playableFiles.length;
          playVideoAtIndex(nextIndex);
        }
        return;
      case 5: // Play All
        videoPlayerPlayAllOn = !videoPlayerPlayAllOn;
        videoPlayerPlayedIndices = [];
        break;
      case 6: // Shuffle
        mediaShuffleOn = !mediaShuffleOn;
        videoPlayerPlayedIndices = [];
        break;
      case 7: // Repeat
        mediaRepeatOn = !mediaRepeatOn;
        break;
      case 8: // Slide speed - open submenu
        openPlayerSlidespeedMenu('video');
        return;
    }
    renderVideoPlayer();
  }

  // Photo Player Info
  function openPhotoPlayerInfo() {
    currentView = 'photo-player-info';
    render();
  }

  function closePhotoPlayerInfo() {
    currentView = 'photo-player';
    render();
  }

  function renderPhotoPlayerInfo() {
    if (!photoPlayerInfoEl || !currentPlayingFile) return;

    var entry = currentPlayingFile;
    var photoInfo = getPhotoFileInfo(entry, currentPlayingIndex);

    var html = '<div class="pp-info-dialog">' +
      '<div class="pp-info-title">Picture metadata</div>' +
      '<div class="pp-info-content">' +
        '<div class="pp-info-row"><span class="pp-info-label">Title:</span> ' + escapeHtml(entry.name) + '</div>' +
        '<div class="pp-info-row"><span class="pp-info-label">Date:</span> ' + photoInfo.date + '</div>' +
        '<div class="pp-info-row"><span class="pp-info-label">Size:</span> ' + photoInfo.dimensions + '</div>' +
        '<div class="pp-info-row"><span class="pp-info-label">File size:</span> ' + photoInfo.size + '</div>' +
      '</div>' +
      '<button class="pp-info-close">Close</button>' +
    '</div>';

    photoPlayerInfoEl.innerHTML = html;
  }

  function handleMusicPlayerNav(act) {
    switch (act) {
      case 'LEFT':
        if (musicPlayerHudVisible && musicPlayerControlIndex > 0) {
          musicPlayerControlIndex--;
          // Restart auto-hide timer only if not locked by INFO
          if (!musicPlayerHudLocked) {
            startMusicPlayerHudTimer();
          }
          renderMusicPlayer();
        }
        return true;
      case 'RIGHT':
        if (musicPlayerHudVisible && musicPlayerControlIndex < 8) {
          musicPlayerControlIndex++;
          // Restart auto-hide timer only if not locked by INFO
          if (!musicPlayerHudLocked) {
            startMusicPlayerHudTimer();
          }
          renderMusicPlayer();
        }
        return true;
      case 'OK':
        // If HUD hidden, just show it; if visible, perform control action
        if (musicPlayerHudVisible) {
          resetMusicPlayerHudOnPlayPause(); // Restart auto-hide timer
          handleMusicPlayerOK();
        } else {
          resetMusicPlayerHudOnPlayPause(); // Show HUD with auto-hide
        }
        return true;
      case 'PLAY':
        // Show HUD with auto-hide, resume if paused
        if (musicPlayerHudVisible) {
          resetMusicPlayerHudOnPlayPause(); // Restart auto-hide timer
        } else {
          resetMusicPlayerHudOnPlayPause(); // Show HUD with auto-hide
        }
        if (isPaused) {
          isPaused = false;
          renderMusicPlayer();
        }
        return true;
      case 'PAUSE':
        // Show HUD with auto-hide, pause if playing
        if (musicPlayerHudVisible) {
          resetMusicPlayerHudOnPlayPause(); // Restart auto-hide timer
        } else {
          resetMusicPlayerHudOnPlayPause(); // Show HUD with auto-hide
        }
        if (!isPaused) {
          isPaused = true;
          renderMusicPlayer();
        }
        return true;
      case 'INFO':
        // Toggle HUD visibility with INFO key
        toggleMusicPlayerHudByInfo();
        return true;
      case 'BACK':
        closeMusicPlayer();
        return true;
      case 'FF':
        // Direct fast forward key
        if (musicPlayerFastMode !== 'forward') {
          musicPlayerFastMode = 'forward';
          musicPlayerFastSpeed = 0;
          isPaused = true;
        } else {
          musicPlayerFastSpeed = (musicPlayerFastSpeed + 1) % 5;
        }
        renderMusicPlayer();
        return true;
      case 'REW':
        // Direct rewind key
        if (musicPlayerFastMode !== 'rewind') {
          musicPlayerFastMode = 'rewind';
          musicPlayerFastSpeed = 0;
          isPaused = true;
        } else {
          musicPlayerFastSpeed = (musicPlayerFastSpeed + 1) % 5;
        }
        renderMusicPlayer();
        return true;
      default:
        return false;
    }
  }

  function handleMusicPlayerOK() {
    // Exit fast mode when selecting any other control
    if (musicPlayerFastMode !== null && musicPlayerControlIndex !== 1 && musicPlayerControlIndex !== 2) {
      musicPlayerFastMode = null;
      musicPlayerFastSpeed = 0;
      isPaused = false;
    }

    switch (musicPlayerControlIndex) {
      case 0: // Play/Pause
        if (musicPlayerFastMode !== null) {
          musicPlayerFastMode = null;
          musicPlayerFastSpeed = 0;
          isPaused = false;
        } else {
          isPaused = !isPaused;
        }
        break;
      case 1: // Rewind
        if (musicPlayerFastMode !== 'rewind') {
          musicPlayerFastMode = 'rewind';
          musicPlayerFastSpeed = 0;
          isPaused = true;
        } else {
          musicPlayerFastSpeed = (musicPlayerFastSpeed + 1) % 5;
        }
        break;
      case 2: // Fast Forward
        if (musicPlayerFastMode !== 'forward') {
          musicPlayerFastMode = 'forward';
          musicPlayerFastSpeed = 0;
          isPaused = true;
        } else {
          musicPlayerFastSpeed = (musicPlayerFastSpeed + 1) % 5;
        }
        break;
      case 3: // Previous
        musicPlayerFastMode = null;
        musicPlayerFastSpeed = 0;
        isPaused = false;
        if (playableFiles.length > 0) {
          var prevIndex = (currentPlayingIndex - 1 + playableFiles.length) % playableFiles.length;
          playMusicAtIndex(prevIndex);
        }
        return;
      case 4: // Next
        musicPlayerFastMode = null;
        musicPlayerFastSpeed = 0;
        isPaused = false;
        if (playableFiles.length > 0) {
          var nextIndex = (currentPlayingIndex + 1) % playableFiles.length;
          playMusicAtIndex(nextIndex);
        }
        return;
      case 5: // Play All
        musicPlayerPlayAllOn = !musicPlayerPlayAllOn;
        musicPlayerPlayedIndices = [];
        break;
      case 6: // Shuffle
        mediaShuffleOn = !mediaShuffleOn;
        musicPlayerShuffleOn = mediaShuffleOn;
        musicPlayerPlayedIndices = [];
        break;
      case 7: // Repeat
        mediaRepeatOn = !mediaRepeatOn;
        musicPlayerRepeatOn = mediaRepeatOn;
        break;
      case 8: // Slide speed - open submenu
        openPlayerSlidespeedMenu('music');
        return;
    }
    renderMusicPlayer();
  }

  function handleMusicOptionsOK() {
    var playAllIdx = musicOptionsFromLeftPanel ? -1 : 0;
    var shuffleIdx = musicOptionsFromLeftPanel ? 0 : 1;
    var repeatIdx = musicOptionsFromLeftPanel ? 1 : 2;

    if (musicOptionsIndex === playAllIdx) {
      closeMusicOptions();
      playAllMusicFromOptions();
    } else if (musicOptionsIndex === shuffleIdx) {
      musicShuffleOn = !musicShuffleOn;
      renderMusicOptions();
    } else if (musicOptionsIndex === repeatIdx) {
      openMusicRepeatSubmenu();
    }
  }


  function showVideoInfo() {
    var cat = CATEGORIES[selectedCategoryIndex];
    if (activePanel !== 'right') return false;
    if (folderEntries.length === 0) return false;

    var entry = folderEntries[selectedFolderIndex];
    if (entry.isDirectory) return false;

    // Check if in Videos category with a video file
    if (cat.id === 'video' && isVideoFile(entry.name)) {
      currentView = 'video-info';
      render();
      return true;
    }

    // Check if in Photos category with a photo file
    if (cat.id === 'photo' && isPhotoFile(entry.name)) {
      currentView = 'video-info';
      render();
      return true;
    }

    // Check if in Music category with a music file
    if (cat.id === 'music' && isMusicFile(entry.name)) {
      currentView = 'video-info';
      render();
      return true;
    }

    return false;
  }

  function closeVideoInfo() {
    currentView = 'split';
    render();
  }

  // Playback timer functions
  function stopPlaybackTimer() {
    if (playbackTimer) {
      clearInterval(playbackTimer);
      playbackTimer = null;
    }
  }

  function startPlaybackTimer() {
    stopPlaybackTimer();
    if (!currentPlayingFile) return;

    playbackDuration = getFileDuration(currentPlayingFile.name);
    playbackElapsed = 0;
    isPaused = false;

    playbackTimer = setInterval(function() {
      if (!isPaused) {
        playbackElapsed++;
        if (playbackElapsed >= playbackDuration) {
          onPlaybackComplete();
          return;
        }
      }
      if (currentView === 'playing' || currentView === 'option-menu') {
        renderPlayer();
      }
    }, 1000);
  }

  function togglePause() {
    isPaused = !isPaused;
    renderPlayer();
  }

  function seekForward(seconds) {
    playbackElapsed = Math.min(playbackDuration - 1, playbackElapsed + seconds);
    renderPlayer();
  }

  function seekBackward(seconds) {
    playbackElapsed = Math.max(0, playbackElapsed - seconds);
    renderPlayer();
  }

  function stepFrame(forward) {
    if (forward) {
      playbackElapsed = Math.min(playbackDuration - 1, playbackElapsed + 1);
    } else {
      playbackElapsed = Math.max(0, playbackElapsed - 1);
    }
    isPaused = true;
    renderPlayer();
  }

  function onPlaybackComplete() {
    stopPlaybackTimer();

    if (playbackMode === 'single') {
      currentView = 'split';
      render();
    } else if (playbackMode === 'repeat-one') {
      startPlaybackTimer();
    } else if (playbackMode === 'repeat-all') {
      var nextIndex = (currentPlayingIndex + 1) % playableFiles.length;
      playFileAtIndex(nextIndex);
    } else if (playbackMode === 'shuffle') {
      var nextIndex = Math.floor(Math.random() * playableFiles.length);
      playFileAtIndex(nextIndex);
    }
  }

  function buildPlayableList() {
    playableFiles = [];
    for (var i = 0; i < folderEntries.length; i++) {
      var entry = folderEntries[i];
      if (!entry.isDirectory && isPlayableFile(entry.name)) {
        playableFiles.push(entry);
      }
    }
  }

  function playFileAtIndex(index) {
    if (index >= 0 && index < playableFiles.length) {
      stopPlaybackTimer();
      currentPlayingIndex = index;
      currentPlayingFile = playableFiles[index];
      currentView = 'playing';
      startPlaybackTimer();
      render();
    }
  }

  function playFile(entry) {
    buildPlayableList();
    currentPlayingIndex = -1;
    for (var i = 0; i < playableFiles.length; i++) {
      if (playableFiles[i].name === entry.name) {
        currentPlayingIndex = i;
        break;
      }
    }
    if (currentPlayingIndex === -1 && playableFiles.length > 0) {
      currentPlayingIndex = 0;
    }
    currentPlayingFile = entry;
    currentView = 'playing';
    startPlaybackTimer();
    render();
  }

  function playNext() {
    if (playableFiles.length === 0) return;
    var nextIndex;
    if (playbackMode === 'shuffle') {
      nextIndex = Math.floor(Math.random() * playableFiles.length);
    } else {
      nextIndex = (currentPlayingIndex + 1) % playableFiles.length;
    }
    playFileAtIndex(nextIndex);
  }

  function playPrev() {
    if (playableFiles.length === 0) return;
    var prevIndex = (currentPlayingIndex - 1 + playableFiles.length) % playableFiles.length;
    playFileAtIndex(prevIndex);
  }

  function stopPlayback() {
    stopPlaybackTimer();
    currentPlayingFile = null;
    currentPlayingIndex = -1;
    playbackElapsed = 0;
    isPaused = false;
    currentView = 'split';
    render();
  }

  function openOptionMenu() {
    selectedModeIndex = PLAYBACK_MODES.findIndex(function(m) { return m.id === playbackMode; });
    if (selectedModeIndex < 0) selectedModeIndex = 2;
    currentView = 'option-menu';
    render();
  }

  function confirmModeSelection() {
    playbackMode = PLAYBACK_MODES[selectedModeIndex].id;
    currentView = 'playing';
    render();
  }

  function updateDeviceList(devices) {
    usbDevices = devices || [];
    selectedDeviceIndex = 0;
    deviceScrollOffset = 0;

    if (usbDevices.length === 0) {
      currentView = 'idle';
      currentDeviceId = null;
      folderEntries = [];
      currentPath = [];
      navigationStack = [];
      activePanel = 'left';
    } else if (currentView === 'idle') {
      currentView = 'devices';
    }
    render();
  }

  function collectAllMusicFiles(categoryData) {
    var allFiles = [];
    var visited = {};

    function collectFromFolder(folderKey) {
      if (visited[folderKey]) return;
      visited[folderKey] = true;

      var entries = categoryData[folderKey] || [];
      for (var i = 0; i < entries.length; i++) {
        var entry = entries[i];
        if (entry.isDirectory) {
          collectFromFolder(entry.name);
        } else if (isMusicFile(entry.name)) {
          allFiles.push(entry);
        }
      }
    }

    collectFromFolder('root');

    // Sort by filename: 0-9, A-Z, a-z
    allFiles.sort(function(a, b) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });

    return allFiles;
  }

  function loadCategoryContent(categoryId) {
    var categoryData = MOCK_DATA[categoryId] || {};
    // All categories (video, music, photo) use the same folder structure display
    folderEntries = categoryData['root'] || [];
    selectedFolderIndex = 0;
    scrollRowOffset = 0;
    musicListScrollOffset = 0;
    currentPath = [];
    navigationStack = [];
  }

  function isMusicCategory() {
    return CATEGORIES[selectedCategoryIndex].id === 'music';
  }

  function moveSelectionVertical(dir) {
    if (currentView === 'devices') {
      if (usbDevices.length === 0) return;
      var newIndex = selectedDeviceIndex + dir;
      if (newIndex >= 0 && newIndex < usbDevices.length) {
        selectedDeviceIndex = newIndex;
        updateDeviceScrollOffset();
        renderDeviceList();
      }
    } else if (currentView === 'split') {
      if (activePanel === 'left') {
        var newIndex = selectedCategoryIndex + dir;
        if (newIndex >= 0 && newIndex < CATEGORIES.length) {
          selectedCategoryIndex = newIndex;
          loadCategoryContent(CATEGORIES[selectedCategoryIndex].id);
          renderLeftPanel();
          renderRightPanel();
        }
      } else {
        if (folderEntries.length === 0) return;
        // Move by row (GRID_COLS items per row) for all categories
        var newIndex = selectedFolderIndex + (dir * GRID_COLS);
        if (newIndex >= 0 && newIndex < folderEntries.length) {
          selectedFolderIndex = newIndex;
          updateScrollOffset();
          renderRightPanel();
        }
      }
    }
  }

  function moveSelectionHorizontalInGrid(dir) {
    if (folderEntries.length === 0) return false;

    var newIndex = selectedFolderIndex + dir;
    // Check if we're at the edge of the grid
    var currentCol = selectedFolderIndex % GRID_COLS;
    var newCol = currentCol + dir;

    if (dir === -1 && currentCol === 0) {
      // At leftmost column, go back to left panel
      return false;
    }
    if (dir === 1 && (newCol >= GRID_COLS || newIndex >= folderEntries.length)) {
      // At rightmost column or end of items, do nothing (only OK enters folder)
      return true;
    }
    if (newIndex >= 0 && newIndex < folderEntries.length) {
      selectedFolderIndex = newIndex;
      renderRightPanel();
      return true;
    }
    return true;
  }

  function moveRight() {
    if (currentView === 'split' && activePanel === 'left') {
      if (folderEntries.length > 0) {
        activePanel = 'right';
        selectedFolderIndex = 0;
        scrollRowOffset = 0;
        musicListScrollOffset = 0;
        renderLeftPanel();
        renderRightPanel();
      }
      return true;
    } else if (currentView === 'split' && activePanel === 'right') {
      return moveSelectionHorizontalInGrid(1);
    }
    return false;
  }

  function moveLeft() {
    if (currentView === 'split' && activePanel === 'right') {
      var currentCol = selectedFolderIndex % GRID_COLS;
      if (currentCol > 0) {
        // Move left within grid
        selectedFolderIndex--;
        renderRightPanel();
        return true;
      }
      // At leftmost column
      if (navigationStack.length > 0) {
        // Go back in folder navigation
        var prev = navigationStack.pop();
        currentPath.pop();
        loadMockFolder(prev.folder);
        selectedFolderIndex = prev.selectedIndex;
        scrollRowOffset = prev.scrollOffset || 0;
        updateScrollOffset();
        renderRightPanel();
        return true;
      }
      // Go back to left panel
      activePanel = 'left';
      renderLeftPanel();
      renderRightPanel();
      return true;
    }
    return false;
  }

  function enterFolder(folderName) {
    var categoryId = CATEGORIES[selectedCategoryIndex].id;
    var currentFolderKey = currentPath.length === 0 ? 'root' : currentPath[currentPath.length - 1];
    navigationStack.push({
      folder: currentFolderKey,
      selectedIndex: selectedFolderIndex,
      scrollOffset: scrollRowOffset
    });
    currentPath.push(folderName);
    loadMockFolder(folderName);
    renderRightPanel();
  }

  function loadMockFolder(folderName) {
    var categoryId = CATEGORIES[selectedCategoryIndex].id;
    var categoryData = MOCK_DATA[categoryId] || {};
    folderEntries = categoryData[folderName] || [];
    selectedFolderIndex = 0;
    scrollRowOffset = 0;
    musicListScrollOffset = 0;
  }

  function enterSelected() {
    if (currentView === 'devices') {
      if (usbDevices.length === 0) return;
      var device = usbDevices[selectedDeviceIndex];
      currentDeviceId = device.id;
      selectedCategoryIndex = 0;
      activePanel = 'left';
      loadCategoryContent(CATEGORIES[0].id);
      currentView = 'split';
      render();
    } else if (currentView === 'split') {
      if (activePanel === 'left') {
        moveRight();
      } else if (activePanel === 'right' && folderEntries.length > 0) {
        var entry = folderEntries[selectedFolderIndex];
        if (entry.isDirectory) {
          enterFolder(entry.name);
        } else if (isPlayableFile(entry.name)) {
          if (isMusicFile(entry.name)) {
            openMusicPlayer(entry, false);
          } else if (isPhotoFile(entry.name)) {
            openPhotoPlayer(entry, false);
          } else if (isVideoFile(entry.name)) {
            openVideoPlayer(entry, false);
          } else {
            playFile(entry);
          }
        }
      }
    } else if (currentView === 'playing') {
      togglePause();
    } else if (currentView === 'option-menu') {
      confirmModeSelection();
    }
  }

  function goBack() {
    if (currentView === 'playing') {
      stopPlayback();
      return true;
    } else if (currentView === 'option-menu') {
      currentView = 'playing';
      render();
      return true;
    } else if (currentView === 'split') {
      if (activePanel === 'right') {
        if (navigationStack.length > 0) {
          var prev = navigationStack.pop();
          currentPath.pop();
          loadMockFolder(prev.folder);
          selectedFolderIndex = prev.selectedIndex;
          if (isMusicCategory()) {
            musicListScrollOffset = prev.scrollOffset || 0;
            updateMusicListScrollOffset();
          } else {
            scrollRowOffset = prev.scrollOffset || 0;
            updateScrollOffset();
          }
          renderRightPanel();
          return true;
        }
        activePanel = 'left';
        renderLeftPanel();
        renderRightPanel();
        return true;
      }
      // Back to device list from left panel
      currentView = 'devices';
      selectedCategoryIndex = 0;
      folderEntries = [];
      currentPath = [];
      navigationStack = [];
      scrollRowOffset = 0;
      musicListScrollOffset = 0;
      render();
      return true;
    } else if (currentView === 'devices') {
      return false;
    }
    return false;
  }

  // Listen for NAV events directly since source-bound base layer
  // doesn't receive onNav when stack is empty
  var isVisible = false;
  var allowExitFullscreen = false;

  // Re-enter fullscreen if user presses Esc/F11 while still on USB
  if (typeof document !== 'undefined') {
    document.addEventListener('fullscreenchange', function() {
      if (!document.fullscreenElement && isVisible && !allowExitFullscreen) {
        var docEl = document.documentElement;
        if (docEl.requestFullscreen) {
          docEl.requestFullscreen().catch(function() {});
        } else if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      }
    });
    document.addEventListener('webkitfullscreenchange', function() {
      if (!document.webkitFullscreenElement && isVisible && !allowExitFullscreen) {
        var docEl = document.documentElement;
        if (docEl.webkitRequestFullscreen) {
          docEl.webkitRequestFullscreen();
        }
      }
    });
  }

  Shell.on('nav', function(act) {
    if (!isVisible) return;
    // Only handle if no overlay is on top (stack is empty)
    if (Shell.stack.length > 0) return;
    handleNavAction(act);
  });

  function handleNavAction(act) {
    if (currentView === 'idle') {
      return false;
    }

    // Handle playback controls in playing/option-menu views
    if (currentView === 'playing') {
      switch (act) {
        case 'PLAY':
          // When playing, Play does nothing; when paused, Play resumes
          if (isPaused) {
            isPaused = false;
            renderPlayer();
          }
          return true;
        case 'PAUSE':
          // When playing, Pause pauses; when paused, Pause does nothing
          if (!isPaused) {
            isPaused = true;
            renderPlayer();
          }
          return true;
        case 'OK':
          // OK always toggles pause state
          togglePause();
          return true;
        case 'STOP':
          stopPlayback();
          return true;
        case 'FF':
          seekForward(10);
          return true;
        case 'REW':
          seekBackward(10);
          return true;
        case 'NEXT_FRAME':
          stepFrame(true);
          return true;
        case 'PREV_FRAME':
          stepFrame(false);
          return true;
        case 'LEFT':
          playPrev();
          return true;
        case 'RIGHT':
          playNext();
          return true;
        case 'OPTION':
          openOptionMenu();
          return true;
        case 'BACK':
          return goBack();
      }
      return false;
    }

    if (currentView === 'option-menu') {
      switch (act) {
        case 'UP':
          if (selectedModeIndex > 0) {
            selectedModeIndex--;
            renderOptionMenu();
          }
          return true;
        case 'DOWN':
          if (selectedModeIndex < PLAYBACK_MODES.length - 1) {
            selectedModeIndex++;
            renderOptionMenu();
          }
          return true;
        case 'OK':
          confirmModeSelection();
          return true;
        case 'BACK':
          return goBack();
      }
      return false;
    }

    // Handle video-info view
    if (currentView === 'video-info') {
      switch (act) {
        case 'OK':
        case 'BACK':
        case 'INFO':
          closeVideoInfo();
          return true;
      }
      return false;
    }

    // Handle unified media-options view
    if (currentView === 'media-options') {
      switch (act) {
        case 'UP':
          if (mediaOptionsIndex > 0) {
            mediaOptionsIndex--;
            renderMediaOptions();
          }
          return true;
        case 'DOWN':
          if (mediaOptionsIndex < 3) {
            mediaOptionsIndex++;
            renderMediaOptions();
          }
          return true;
        case 'OK':
          handleMediaOptionsOK();
          return true;
        case 'RIGHT':
          if (mediaOptionsIndex === 3) {
            openMediaSlidespeedSubmenu();
          }
          return true;
        case 'BACK':
        case 'OPTION':
          closeMediaOptions();
          return true;
      }
      return false;
    }

    // Handle media-slidespeed-submenu view
    if (currentView === 'media-slidespeed-submenu') {
      switch (act) {
        case 'UP':
          if (mediaSlidespeedSubmenuIndex > 0) {
            mediaSlidespeedSubmenuIndex--;
            renderMediaSlidespeedSubmenu();
          }
          return true;
        case 'DOWN':
          if (mediaSlidespeedSubmenuIndex < 2) {
            mediaSlidespeedSubmenuIndex++;
            renderMediaSlidespeedSubmenu();
          }
          return true;
        case 'OK':
          confirmMediaSlidespeed();
          return true;
        case 'LEFT':
        case 'BACK':
          closeMediaSlidespeedSubmenu();
          return true;
      }
      return false;
    }

    // Handle music-player view
    if (currentView === 'music-player') {
      return handleMusicPlayerNav(act);
    }

    // Handle photo-player view
    if (currentView === 'photo-player') {
      return handlePhotoPlayerNav(act);
    }

    // Handle photo-slidespeed-menu view (in player)
    if (currentView === 'photo-slidespeed-menu') {
      switch (act) {
        case 'UP':
          if (photoSlidespeedMenuIndex > 0) {
            photoSlidespeedMenuIndex--;
            renderPhotoSlidespeedMenu();
          }
          return true;
        case 'DOWN':
          if (photoSlidespeedMenuIndex < 2) {
            photoSlidespeedMenuIndex++;
            renderPhotoSlidespeedMenu();
          }
          return true;
        case 'OK':
          confirmPhotoSlidespeedMenu();
          return true;
        case 'BACK':
          closePhotoSlidespeedMenu();
          return true;
      }
      return false;
    }

    // Handle photo-player-info view
    if (currentView === 'photo-player-info') {
      switch (act) {
        case 'OK':
        case 'BACK':
        case 'INFO':
          closePhotoPlayerInfo();
          return true;
      }
      return false;
    }

    // Handle player-slidespeed-menu view (unified for Video/Music/Photo HUD)
    if (currentView === 'player-slidespeed-menu') {
      return handlePlayerSlidespeedMenuNav(act);
    }

    // Handle video-info-dialog view
    if (currentView === 'video-info-dialog') {
      switch (act) {
        case 'OK':
        case 'BACK':
        case 'INFO':
          closeVideoInfoDialog();
          return true;
      }
      return false;
    }

    // Handle video-player view
    if (currentView === 'video-player') {
      return handleVideoPlayerNav(act);
    }

    // Handle split/devices views
    switch (act) {
      case 'UP':
        moveSelectionVertical(-1);
        return true;
      case 'DOWN':
        moveSelectionVertical(1);
        return true;
      case 'LEFT':
        return moveLeft();
      case 'RIGHT':
        return moveRight();
      case 'OK':
        enterSelected();
        return true;
      case 'BACK':
        return goBack();
      case 'PLAY':
        // If in split view with a playable file selected, play it
        if (currentView === 'split' && activePanel === 'right' && folderEntries.length > 0) {
          var entry = folderEntries[selectedFolderIndex];
          if (!entry.isDirectory && isPlayableFile(entry.name)) {
            if (isMusicFile(entry.name)) {
              openMusicPlayer(entry, false);
            } else if (isPhotoFile(entry.name)) {
              openPhotoPlayer(entry, false);
            } else if (isVideoFile(entry.name)) {
              openVideoPlayer(entry, false);
            } else {
              playFile(entry);
            }
            return true;
          }
        }
        return false;
      case 'OPTION':
        // Unified Media Options for Videos/Photos/Music
        return openMediaOptions();
      case 'INFO':
        // Show video info if in Videos category and on a video file
        return showVideoInfo();
    }
    return false;
  }

  Shell.register({
    id: 'app-usb',
    layer: 'source.usb',
    source: 'USB',

    mount: function (el) {
      // CSS follows slides.html design spec (v6)
      // Colors: --bg:#0d0f14, --fg:#e6ebf2, --dim:#8a94a6, --accent:#3a86ff, --accent2:#ffc239, --card:#161a22, --line:#2a3140
      // idle/devices: windowed style; split/playing: fullscreen
      el.innerHTML =
        '<style>' +
        '.usb-root{position:absolute;inset:0;background:#0d0f14;display:flex;' +
          'align-items:center;justify-content:center;' +
          'font-family:"Segoe UI","PingFang TC","Microsoft JhengHei",Arial,sans-serif}' +
        '.usb-player{width:92%;max-width:1400px;height:85%;background:#161a22;' +
          'border:1px solid #2a3140;border-radius:16px;box-shadow:0 8px 40px rgba(0,0,0,.6);' +
          'display:flex;flex-direction:column;overflow:hidden}' +
        '.usb-title{background:#11151c;color:#e6ebf2;padding:20px 32px;font-size:1.8rem;' +
          'font-weight:bold;letter-spacing:.5px;border-bottom:1px solid #2a3140;' +
          'display:flex;align-items:center;gap:16px}' +
        '.usb-dot{width:14px;height:14px;border-radius:50%;background:#3a86ff}' +
        '.usb-stage{flex:1;position:relative;background:#0d0f14;overflow:hidden}' +
        '.usb-idle{position:absolute;inset:0;display:flex;flex-direction:column;' +
          'align-items:center;justify-content:center;color:#8a94a6;gap:20px}' +
        '.usb-idle-icon{opacity:.6;display:flex;align-items:center;justify-content:center}' +
        '.usb-idle-text{font-size:1.8rem}' +
        '.usb-device-list{position:absolute;inset:0;overflow:hidden;display:none}' +
        // Split-panel layout for device list (like Media view)
        '.usb-device-split{display:flex;flex-direction:row;height:100%;width:100%}' +
        '.usb-device-left-panel{width:280px;background:#11151c;border-right:2px solid #2a3140;' +
          'display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 20px}' +
        '.usb-device-icon-wrap{margin-bottom:24px;display:flex;align-items:center;justify-content:center}' +
        '.usb-device-panel-title{font-size:1.6rem;font-weight:600;color:#e6ebf2;text-align:center;letter-spacing:.5px}' +
        '.usb-device-right-panel{flex:1;background:#0d0f14;display:flex;flex-direction:row;position:relative;overflow:hidden}' +
        '.usb-device-right-content{flex:1;display:flex;flex-direction:column;padding:16px 24px;gap:8px}' +
        '.usb-device-row{display:flex;align-items:center;padding:18px 24px;' +
          'background:#161a22;border:2px solid #2a3140;border-radius:12px;color:#e6ebf2;cursor:pointer;transition:all .15s}' +
        '.usb-device-row:hover{background:#1d2430;border-color:#3a86ff}' +
        '.usb-device-row.usb-device-row-selected{background:#3a86ff;color:#fff;border-color:#fff}' +
        '.usb-device-row.usb-device-row-empty{background:transparent;border-color:transparent;cursor:default}' +
        '.usb-device-row.usb-device-row-empty:hover{background:transparent;border-color:transparent}' +
        '.usb-device-row-icon{margin-right:16px;min-width:40px;display:flex;align-items:center;justify-content:center}' +
        '.usb-device-row-name{font-size:1.4rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.usb-device-scrollbar-track{position:absolute;right:8px;top:16px;bottom:16px;width:6px;' +
          'background:rgba(42,49,64,0.3);border-radius:3px}' +
        '.usb-device-scrollbar-thumb{position:absolute;width:100%;background:rgba(138,148,166,0.4);' +
          'border-radius:3px;transition:top .15s ease-out}' +
        '.usb-empty{color:#8a94a6;text-align:center;padding:60px;font-size:1.5rem}' +
        // Split view styles - fullscreen layout (inside .usb-fullscreen)
        '.usb-split-view{position:absolute;inset:0;display:none;flex-direction:row;width:1920px;height:1080px}' +
        '.usb-left-panel{width:320px;background:#11151c;border-right:2px solid #2a3140;' +
          'display:flex;flex-direction:column;justify-content:center;padding:24px 0}' +
        '.usb-right-panel{flex:1;background:#0d0f14;display:flex;flex-direction:column;overflow:hidden}' +
        '.usb-cat-item{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'padding:28px 20px;margin:12px 20px;border-radius:18px;color:#8a94a6;cursor:pointer;' +
          'transition:all .15s;border:3px solid transparent}' +
        '.usb-cat-item:hover{background:#1d2430;color:#e6ebf2}' +
        '.usb-cat-item.usb-cat-selected{background:#1d2430;color:#e6ebf2;border-color:#3a86ff}' +
        '.usb-cat-item.usb-cat-active{background:#3a86ff;color:#fff;border-color:#3a86ff}' +
        '.usb-cat-icon{font-size:5rem;margin-bottom:16px;transition:transform .25s ease}' +
        '.usb-cat-item.usb-cat-active .usb-cat-icon{transform:scale(1.1)}' +
        '.usb-cat-name{font-size:1.8rem;font-weight:600;text-align:center;transition:transform .25s ease}' +
        '.usb-cat-item.usb-cat-active .usb-cat-name{transform:scale(1.1)}' +
        '.usb-right-header{background:#11151c;color:#ffc239;padding:20px 32px;font-size:1.6rem;' +
          'font-weight:600;border-bottom:1px solid #2a3140;letter-spacing:.5px}' +
        '.usb-right-content-wrapper{flex:1;display:flex;flex-direction:row;overflow:hidden;position:relative}' +
        '.usb-right-content{flex:1;overflow:hidden;padding:24px;display:flex;flex-direction:column}' +
        '.usb-file-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);' +
          'gap:16px;flex:1;align-content:start}' +
        '.usb-file-item{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'padding:20px 12px;background:#161a22;border:3px solid #2a3140;border-radius:18px;color:#e6ebf2;' +
          'cursor:pointer;transition:all .15s;min-height:0}' +
        '.usb-file-item:hover{background:#1d2430;border-color:#3a86ff}' +
        '.usb-file-item.usb-file-selected{background:#3a86ff;color:#fff;border-color:#fff}' +
        '.usb-file-icon{font-size:3.6rem;margin-bottom:12px;transition:transform .25s ease}' +
        '.usb-file-item.usb-file-selected .usb-file-icon{transform:scale(1.3)}' +
        '.usb-file-name{font-size:1.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
          'max-width:100%;text-align:center;transition:transform .25s ease}' +
        '.usb-file-item.usb-file-selected .usb-file-name{transform:scale(1.4)}' +
        '.usb-scrollbar-track{position:absolute;right:8px;top:24px;bottom:24px;width:8px;' +
          'background:rgba(42,49,64,0.3);border-radius:4px}' +
        '.usb-scrollbar-thumb{position:absolute;width:100%;background:rgba(138,148,166,0.4);' +
          'border-radius:4px;transition:top .15s ease-out}' +
        // Music list view styles
        '.usb-music-body{flex:1;display:flex;flex-direction:row;overflow:hidden}' +
        '.usb-music-list-container{flex:1;display:flex;flex-direction:row;position:relative;' +
          'padding:16px 24px;overflow:hidden}' +
        '.usb-music-list{flex:1;display:flex;flex-direction:column;gap:4px;overflow:hidden}' +
        '.usb-music-row{display:flex;align-items:center;padding:14px 20px;' +
          'background:transparent;border-radius:8px;color:#e6ebf2;cursor:pointer;transition:all .15s}' +
        '.usb-music-row:hover{background:#1d2430}' +
        '.usb-music-row.usb-music-row-selected{background:#3a86ff;color:#fff}' +
        '.usb-music-row-icon{font-size:1.6rem;margin-right:16px;min-width:28px;color:#8a94a6}' +
        '.usb-music-row.usb-music-row-selected .usb-music-row-icon{color:#fff}' +
        '.usb-music-row-name{font-size:1.3rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.usb-music-scrollbar-track{position:absolute;right:8px;top:16px;bottom:16px;width:6px;' +
          'background:rgba(42,49,64,0.3);border-radius:3px}' +
        '.usb-music-scrollbar-thumb{position:absolute;width:100%;background:rgba(138,148,166,0.4);' +
          'border-radius:3px;transition:top .15s ease-out}' +
        '.usb-music-info-panel{width:500px;background:#11151c;border-left:1px solid #2a3140;' +
          'display:flex;flex-direction:column;align-items:center;padding:48px 40px;gap:32px}' +
        '.usb-music-info-art{width:280px;height:280px;display:flex;align-items:center;justify-content:center;' +
          'background:#1d2430;border-radius:16px;overflow:hidden}' +
        '.usb-music-info-art svg{display:block}' +
        '.usb-music-info-details{width:100%;display:flex;flex-direction:column;gap:12px}' +
        '.usb-music-info-filename{color:#e6ebf2;font-size:1.6rem;font-weight:600;' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;margin-bottom:12px}' +
        '.usb-music-info-row{color:#8a94a6;font-size:1.4rem;line-height:1.6}' +
        '.usb-music-info-label{color:#e6ebf2;font-weight:500}' +
        // Player view styles - fullscreen playback with simulated video background
        '.usb-player-view{position:absolute;inset:0;display:none;flex-direction:column}' +
        // Fullscreen simulated background
        '.usb-player-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}' +
        '.usb-bg-video{background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)}' +
        '.usb-bg-photo{background:#1a1a1a url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'400\' height=\'300\'%3E%3Crect fill=\'%23263238\' width=\'400\' height=\'300\'/%3E%3Ccircle cx=\'320\' cy=\'80\' r=\'40\' fill=\'%23ffc239\'/%3E%3Cpath d=\'M0 220 Q100 160 200 200 T400 180 L400 300 L0 300Z\' fill=\'%232e7d32\'/%3E%3Cpath d=\'M0 260 Q150 200 300 240 T400 220 L400 300 L0 300Z\' fill=\'%231b5e20\'/%3E%3C/svg%3E") center/cover no-repeat}' +
        '.usb-bg-music{background:linear-gradient(135deg,#0d0d0d 0%,#1a1a2e 50%,#2d132c 100%)}' +
        '.usb-player-timer{font-size:12rem;font-weight:200;color:rgba(255,255,255,.15);' +
          'font-family:"Segoe UI Light","Segoe UI",sans-serif;letter-spacing:8px;user-select:none}' +
        '.usb-player-pause-icon{position:absolute;font-size:8rem;color:rgba(255,255,255,.3)}' +
        // Bottom HUD overlay
        '.usb-player-hud{position:absolute;bottom:0;left:0;right:0;' +
          'background:linear-gradient(transparent,rgba(0,0,0,.8));padding:24px 40px 32px;' +
          'display:flex;align-items:center;gap:24px}' +
        '.usb-hud-left{display:flex;align-items:center;gap:16px;min-width:280px}' +
        '.usb-hud-status{font-size:1.6rem;color:#3a86ff}' +
        '.usb-hud-filename{color:#e6ebf2;font-size:1.4rem;font-weight:500;' +
          'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:240px}' +
        '.usb-hud-center{flex:1;display:flex;justify-content:center}' +
        '.usb-hud-progress{display:flex;align-items:center;gap:16px;width:100%;max-width:600px}' +
        '.usb-hud-time{color:#8a94a6;font-size:1.2rem;min-width:50px;text-align:center}' +
        '.usb-hud-bar{flex:1;height:6px;background:rgba(255,255,255,.2);border-radius:3px;overflow:hidden}' +
        '.usb-hud-fill{height:100%;background:linear-gradient(90deg,#3a86ff,#ffc239);' +
          'border-radius:3px;transition:width .3s ease-out}' +
        '.usb-hud-right{display:flex;align-items:center;gap:16px;min-width:120px;justify-content:flex-end}' +
        '.usb-hud-mode{font-size:1.4rem;color:#ffc239}' +
        '.usb-hud-counter{color:#8a94a6;font-size:1.2rem}' +
        // Option menu styles
        '.usb-option-menu{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(4px)}' +
        '.usb-option-dialog{background:#161a22;border:3px solid #3a86ff;border-radius:20px;' +
          'padding:32px 40px;min-width:500px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.usb-option-title{color:#ffc239;font-size:1.8rem;font-weight:600;margin-bottom:28px;text-align:center}' +
        '.usb-option-item{display:flex;align-items:center;padding:20px 24px;margin:10px 0;' +
          'background:#0d0f14;border:2px solid #2a3140;border-radius:14px;color:#e6ebf2;cursor:pointer;transition:all .15s}' +
        '.usb-option-item:hover{background:#1d2430;border-color:#3a86ff}' +
        '.usb-option-item.usb-option-selected{background:#3a86ff;color:#fff;border-color:#fff}' +
        '.usb-option-item.usb-option-current{border-color:#ffc239}' +
        '.usb-option-icon{font-size:1.8rem;margin-right:20px;min-width:40px;text-align:center}' +
        '.usb-option-name{font-size:1.4rem;font-weight:600;margin-right:16px}' +
        '.usb-option-desc{flex:1;color:#8a94a6;font-size:1.1rem}' +
        '.usb-option-check{color:#ffc239;font-size:1.4rem;margin-left:auto}' +
        '.usb-option-hint{color:#8a94a6;font-size:1rem;text-align:center;margin-top:20px;padding-top:20px;border-top:1px solid #2a3140}' +
        // Video info dialog styles
        '.usb-video-info{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(4px)}' +
        '.usb-video-info-dialog{background:#4a5568;border:3px solid #718096;border-radius:16px;' +
          'padding:32px 48px;min-width:480px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.usb-video-info-title{color:#ffc239;font-size:2rem;font-weight:600;margin-bottom:28px}' +
        '.usb-video-info-content{margin-bottom:32px}' +
        '.usb-video-info-row{color:#e2e8f0;font-size:1.4rem;margin:12px 0;line-height:1.6}' +
        '.usb-video-info-label{color:#e2e8f0;font-weight:600}' +
        '.usb-video-info-close{display:block;width:100%;background:#3182ce;color:#fff;border:none;' +
          'border-radius:28px;padding:16px 32px;font-size:1.3rem;font-weight:600;cursor:pointer;' +
          'transition:background .15s}' +
        '.usb-video-info-close:hover{background:#2b6cb0}' +
        // Fullscreen views (split/playing) - positioned outside usb-player window
        '.usb-fullscreen{position:absolute;inset:0;display:none;background:#0d0f14}' +
        // Unified Media Options dialog styles (centered like Info Menu)
        '.media-options{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        '.media-opt-dialog{background:#4a5568;border:3px solid #718096;border-radius:16px;min-width:420px;' +
          'padding:32px 48px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.media-opt-header{margin-bottom:24px}' +
        '.media-opt-title{font-size:2rem;font-weight:600;color:#ffc239;letter-spacing:.5px}' +
        '.media-opt-list{display:flex;flex-direction:column;gap:8px}' +
        '.media-opt-item{display:flex;align-items:center;padding:18px 24px;color:#e2e8f0;' +
          'background:#5a6578;border:2px solid #718096;border-radius:12px;cursor:pointer;transition:all .15s}' +
        '.media-opt-item:hover{background:#6a7588;border-color:#8a94a6}' +
        '.media-opt-item.media-opt-item-selected{background:#3182ce;color:#fff;border-color:#fff}' +
        '.media-opt-name{flex:1;font-size:1.4rem;font-weight:500}' +
        '.media-opt-value{font-size:1.2rem;color:#a0aec0;margin-right:12px}' +
        '.media-opt-item.media-opt-item-selected .media-opt-value{color:#fff}' +
        '.media-opt-arrow{font-size:1.2rem;color:#a0aec0}' +
        '.media-opt-item.media-opt-item-selected .media-opt-arrow{color:#fff}' +
        // Toggle switch styles for Media Options
        '.media-opt-toggle{display:inline-block;width:52px;height:28px;border-radius:14px;position:relative;' +
          'transition:background .2s}' +
        '.media-opt-toggle::after{content:"";position:absolute;top:3px;width:22px;height:22px;' +
          'border-radius:50%;background:#fff;transition:left .2s}' +
        '.media-opt-toggle-off{background:#718096}' +
        '.media-opt-toggle-off::after{left:3px}' +
        '.media-opt-toggle-on{background:#3a86ff}' +
        '.media-opt-toggle-on::after{left:27px}' +
        // Media Slide speed submenu dialog styles (centered)
        '.media-slidespeed-submenu{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        '.media-speed-dialog{background:#4a5568;border:3px solid #718096;border-radius:16px;min-width:420px;' +
          'padding:32px 48px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.media-speed-header{margin-bottom:24px}' +
        '.media-speed-title{font-size:2rem;font-weight:600;color:#ffc239;letter-spacing:.5px}' +
        '.media-speed-list{display:flex;flex-direction:column;gap:8px}' +
        '.media-speed-item{display:flex;align-items:center;padding:18px 24px;color:#e2e8f0;' +
          'background:#5a6578;border:2px solid #718096;border-radius:12px;cursor:pointer;transition:all .15s}' +
        '.media-speed-item:hover{background:#6a7588;border-color:#8a94a6}' +
        '.media-speed-item.media-speed-item-selected{background:#3182ce;color:#fff;border-color:#fff}' +
        '.media-speed-name{flex:1;font-size:1.4rem;font-weight:500}' +
        '.media-speed-check{font-size:1.4rem;color:#e2e8f0}' +
        '.media-speed-item.media-speed-item-selected .media-speed-check{color:#fff}' +
        // Music Player styles (matching reference mp.jpg)
        '.music-player-view{position:absolute;inset:0;display:none;flex-direction:column;background:#0d0f14}' +
        '.mp-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
          'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#2d132c 100%)}' +
        '.mp-timer{font-size:14rem;font-weight:200;color:rgba(255,255,255,.12);' +
          'font-family:"Segoe UI Light","Segoe UI",sans-serif;letter-spacing:12px;user-select:none}' +
        // Photo Player styles
        '.photo-player-view{position:absolute;inset:0;display:none;flex-direction:column;background:#0d0f14}' +
        '.pp-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background-size:cover;background-position:center}' +
        // Photo slide speed menu in player
        '.photo-slidespeed-menu{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        '.pp-speed-dialog{background:#4a5568;border:3px solid #718096;border-radius:16px;min-width:400px;' +
          'padding:32px 48px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.pp-speed-header{margin-bottom:24px}' +
        '.pp-speed-title{font-size:2rem;font-weight:600;color:#ffc239;letter-spacing:.5px}' +
        '.pp-speed-list{display:flex;flex-direction:column;gap:8px}' +
        '.pp-speed-item{display:flex;align-items:center;padding:18px 24px;color:#e2e8f0;' +
          'background:#5a6578;border:2px solid #718096;border-radius:12px;cursor:pointer;transition:all .15s}' +
        '.pp-speed-item:hover{background:#6a7588;border-color:#8a94a6}' +
        '.pp-speed-item.pp-speed-item-selected{background:#3182ce;color:#fff;border-color:#fff}' +
        '.pp-speed-name{flex:1;font-size:1.4rem;font-weight:500}' +
        '.pp-speed-check{font-size:1.4rem;color:#e2e8f0}' +
        '.pp-speed-item.pp-speed-item-selected .pp-speed-check{color:#fff}' +
        // Player slide speed menu (unified for Video/Music/Photo HUD)
        '.player-slidespeed-menu{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        // Photo Player Info dialog
        '.photo-player-info{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        '.pp-info-dialog{background:#4a5568;border:3px solid #718096;border-radius:16px;' +
          'padding:32px 48px;min-width:480px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.pp-info-title{color:#ffc239;font-size:2rem;font-weight:600;margin-bottom:28px}' +
        '.pp-info-content{margin-bottom:32px}' +
        '.pp-info-row{color:#e2e8f0;font-size:1.4rem;margin:12px 0;line-height:1.6}' +
        '.pp-info-label{color:#e2e8f0;font-weight:600}' +
        '.pp-info-close{display:block;width:100%;background:#3182ce;color:#fff;border:none;' +
          'border-radius:28px;padding:16px 32px;font-size:1.3rem;font-weight:600;cursor:pointer;transition:background .15s}' +
        '.pp-info-close:hover{background:#2b6cb0}' +
        // Video Info dialog styles (from Options menu)
        '.video-info-dialog{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px)}' +
        '.video-info-dlg-dialog{background:#4a5568;border:3px solid #718096;border-radius:16px;' +
          'padding:32px 48px;min-width:480px;box-shadow:0 12px 60px rgba(0,0,0,.8)}' +
        '.video-info-dlg-title{color:#ffc239;font-size:2rem;font-weight:600;margin-bottom:28px}' +
        '.video-info-dlg-content{margin-bottom:32px}' +
        '.video-info-dlg-row{color:#e2e8f0;font-size:1.4rem;margin:12px 0;line-height:1.6}' +
        '.video-info-dlg-label{color:#e2e8f0;font-weight:600}' +
        '.video-info-dlg-close{display:block;width:100%;background:#3182ce;color:#fff;border:none;' +
          'border-radius:28px;padding:16px 32px;font-size:1.3rem;font-weight:600;cursor:pointer;transition:background .15s}' +
        '.video-info-dlg-close:hover{background:#2b6cb0}' +
        // Video Player styles
        '.video-player-view{position:absolute;inset:0;display:none;flex-direction:column;background:#0d0f14}' +
        '.vp-bg{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
          'background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)}' +
        '.vp-timer{font-size:14rem;font-weight:200;color:rgba(255,255,255,.12);' +
          'font-family:"Segoe UI Light","Segoe UI",sans-serif;letter-spacing:12px;user-select:none}' +
        '.vp-pause-icon{position:absolute;font-size:8rem;color:rgba(255,255,255,.3)}' +
        // Unified Player HUD styles (shared across Video/Photo/Music)
        '.player-hud{position:absolute;bottom:60px;left:80px;right:80px;' +
          'background:rgba(74,85,104,0.95);border-radius:16px;display:flex;flex-direction:column;' +
          'padding:20px 28px;gap:12px;box-shadow:0 8px 40px rgba(0,0,0,.6)}' +
        '.player-hud-top{display:flex;flex-direction:row;justify-content:space-between;align-items:center}' +
        '.player-filename{color:#fff;font-size:1.6rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}' +
        '.player-counter{color:#a0aec0;font-size:1.3rem;margin-left:20px}' +
        '.player-progress{display:flex;flex-direction:row;align-items:center;gap:12px}' +
        '.player-time{color:#a0aec0;font-size:1.1rem;min-width:45px;text-align:center}' +
        '.player-progress-bar{flex:1;height:6px;background:#2d3748;border-radius:3px;overflow:hidden}' +
        '.player-progress-fill{height:100%;background:linear-gradient(90deg,#3182ce,#ffc239);border-radius:3px;transition:width .3s ease-out}' +
        '.player-controls{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:12px;margin-top:8px}' +
        '.player-ctrl-btn{width:60px;height:60px;display:flex;align-items:center;justify-content:center;' +
          'border-radius:8px;cursor:pointer;transition:all .15s;border:2px solid transparent}' +
        '.player-ctrl-btn:hover{background:rgba(255,255,255,.1)}' +
        '.player-ctrl-btn.player-ctrl-selected{background:#3182ce;border-color:#fff}' +
        '.player-ctrl-btn.player-ctrl-off svg{opacity:.5}' +
        '.player-fast-speed{color:#fff;font-size:1.4rem;font-weight:700}' +
        '</style>' +
        '<div class="usb-root">' +
          '<div class="usb-player">' +
            '<div class="usb-title"><span class="usb-dot"></span>USB Media Player</div>' +
            '<div class="usb-stage">' +
              '<div class="usb-idle">' +
                '<div class="usb-idle-icon">&#128190;</div>' +
                '<div class="usb-idle-text">No USB device</div>' +
              '</div>' +
              '<div class="usb-device-list"></div>' +
            '</div>' +
          '</div>' +
          '<div class="usb-fullscreen">' +
            '<div class="usb-split-view">' +
              '<div class="usb-left-panel"></div>' +
              '<div class="usb-right-panel"></div>' +
            '</div>' +
            '<div class="usb-player-view"></div>' +
            '<div class="usb-option-menu"></div>' +
            '<div class="usb-video-info"></div>' +
            '<div class="media-options"></div>' +
            '<div class="media-slidespeed-submenu"></div>' +
            '<div class="music-player-view"></div>' +
            '<div class="photo-player-view"></div>' +
            '<div class="photo-slidespeed-menu"></div>' +
            '<div class="player-slidespeed-menu"></div>' +
            '<div class="photo-player-info"></div>' +
            '<div class="video-info-dialog"></div>' +
            '<div class="video-player-view"></div>' +
          '</div>' +
        '</div>';
      stageEl = el.querySelector('.usb-stage');
      idleEl = el.querySelector('.usb-idle');
      idleTextEl = el.querySelector('.usb-idle-text');
      idleIconEl = el.querySelector('.usb-idle-icon');
      deviceListEl = el.querySelector('.usb-device-list');
      fullscreenEl = el.querySelector('.usb-fullscreen');
      windowEl = el.querySelector('.usb-player');
      splitViewEl = el.querySelector('.usb-split-view');
      leftPanelEl = el.querySelector('.usb-left-panel');
      rightPanelEl = el.querySelector('.usb-right-panel');
      playerViewEl = el.querySelector('.usb-player-view');
      optionMenuEl = el.querySelector('.usb-option-menu');
      videoInfoEl = el.querySelector('.usb-video-info');
      mediaOptionsEl = el.querySelector('.media-options');
      mediaSlidespeedSubmenuEl = el.querySelector('.media-slidespeed-submenu');
      musicPlayerEl = el.querySelector('.music-player-view');
      photoPlayerEl = el.querySelector('.photo-player-view');
      photoSlidespeedMenuEl = el.querySelector('.photo-slidespeed-menu');
      photoPlayerInfoEl = el.querySelector('.photo-player-info');
      playerSlidespeedMenuEl = el.querySelector('.player-slidespeed-menu');
      videoInfoDialogEl = el.querySelector('.video-info-dialog');
      videoPlayerEl = el.querySelector('.video-player-view');
    },

    onShow: function (params) {
      isVisible = true;
      allowExitFullscreen = false;
      // Enter browser fullscreen mode (hide URL bar and Windows chrome)
      var docEl = document.documentElement;
      if (docEl.requestFullscreen) {
        docEl.requestFullscreen().catch(function() {});
      } else if (docEl.webkitRequestFullscreen) {
        docEl.webkitRequestFullscreen();
      } else if (docEl.msRequestFullscreen) {
        docEl.msRequestFullscreen();
      }

      var stored = Shell.store['usb_device_list'];
      if (stored) {
        try {
          var devices = typeof stored === 'string' ? JSON.parse(stored) : stored;
          updateDeviceList(devices);
        } catch (e) {
          updateDeviceList([]);
        }
      } else {
        updateDeviceList([]);
      }
      render();
    },

    onHide: function () {
      isVisible = false;
      // Exit browser fullscreen mode (only when switching away from USB)
      allowExitFullscreen = true;
      if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(function() {});
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          document.msExitFullscreen();
        }
      }

      stopPlaybackTimer();
      currentView = 'idle';
      currentDeviceId = null;
      folderEntries = [];
      currentPath = [];
      navigationStack = [];
      activePanel = 'left';
      selectedCategoryIndex = 0;
      scrollRowOffset = 0;
      currentPlayingFile = null;
      currentPlayingIndex = -1;
      playableFiles = [];
      playbackElapsed = 0;
      playbackDuration = 0;
      isPaused = false;
    },

    onNav: function (act) {
      return handleNavAction(act);
    },

    onVal: function (key, value) {
      if (key === 'usb_device_list') {
        try {
          var devices = typeof value === 'string' ? JSON.parse(value) : value;
          updateDeviceList(devices);
        } catch (e) {
          updateDeviceList([]);
        }
      }
    }
  });

  // PC keyboard event handling - only active when USB Media Player is visible
  if (typeof document !== 'undefined') {
    document.addEventListener('keydown', function (e) {
      if (!isVisible) return;
      // Only handle if no overlay is on top (stack is empty)
      if (Shell.stack.length > 0) return;
      // Ignore keystrokes when typing in input fields (e.g. USB simulation textbox)
      var tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) return;

      var handled = false;
      switch (e.key) {
        case 'ArrowUp':
          handleNavAction('UP');
          handled = true;
          break;
        case 'ArrowDown':
          handleNavAction('DOWN');
          handled = true;
          break;
        case 'ArrowLeft':
          handleNavAction('LEFT');
          handled = true;
          break;
        case 'ArrowRight':
          handleNavAction('RIGHT');
          handled = true;
          break;
        case 'Enter':
          // In split view on a playable file: OK + Play (enter player and start)
          // In playing view: OK toggles pause
          if (currentView === 'split' && activePanel === 'right' && folderEntries.length > 0) {
            var entry = folderEntries[selectedFolderIndex];
            if (!entry.isDirectory && isPlayableFile(entry.name)) {
              if (isMusicFile(entry.name)) {
                openMusicPlayer(entry, false);
              } else if (isPhotoFile(entry.name)) {
                openPhotoPlayer(entry, false);
              } else if (isVideoFile(entry.name)) {
                openVideoPlayer(entry, false);
              } else {
                playFile(entry);
              }
              handled = true;
              break;
            }
          }
          handleNavAction('OK');
          handled = true;
          break;
        case 'b':
        case 'B':
          handleNavAction('BACK');
          handled = true;
          break;
        case 'i':
        case 'I':
          handleNavAction('INFO');
          handled = true;
          break;
        case 'o':
        case 'O':
          handleNavAction('OPTION');
          handled = true;
          break;
        case 'd':
        case 'D':
          // Toggle DEV PANEL visibility
          var devPanel = document.getElementById('dev-panel');
          if (devPanel) {
            devPanel.style.display = devPanel.style.display === 'none' ? 'block' : 'none';
          }
          handled = true;
          break;
      }
      if (handled) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }
})();
