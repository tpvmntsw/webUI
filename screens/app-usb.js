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

  var usbDevices = [];
  var selectedDeviceIndex = 0;
  // 'idle' | 'devices' | 'split' | 'playing' | 'option-menu' | 'video-info'
  var currentView = 'idle';
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
    if (imageExts.indexOf(ext) !== -1) return 5; // 5 sec for photos
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
        { name: 'Playlists', isDirectory: true },
        { name: 'Podcasts', isDirectory: true },
        { name: 'Audiobooks', isDirectory: true },
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
        { name: 'Electronic Mix', isDirectory: true }
      ],
      Playlists: [
        { name: 'favorites.m3u', isDirectory: false },
        { name: 'workout.m3u', isDirectory: false },
        { name: 'relaxing.m3u', isDirectory: false },
        { name: 'party.m3u', isDirectory: false }
      ],
      Podcasts: [
        { name: 'tech_talk_ep01.mp3', isDirectory: false },
        { name: 'tech_talk_ep02.mp3', isDirectory: false },
        { name: 'news_daily.mp3', isDirectory: false }
      ],
      Audiobooks: [
        { name: 'novel_chapter01.mp3', isDirectory: false },
        { name: 'novel_chapter02.mp3', isDirectory: false },
        { name: 'self_help_intro.mp3', isDirectory: false }
      ],
      'Rock Classics': [
        { name: 'track01_legendary.mp3', isDirectory: false },
        { name: 'track02_anthem.mp3', isDirectory: false },
        { name: 'track03_ballad.mp3', isDirectory: false }
      ],
      'Jazz Collection': [
        { name: 'smooth_jazz_01.flac', isDirectory: false },
        { name: 'bebop_classic.flac', isDirectory: false }
      ],
      'Pop Hits 2024': [
        { name: 'summer_hit.mp3', isDirectory: false },
        { name: 'dance_anthem.mp3', isDirectory: false },
        { name: 'ballad_2024.mp3', isDirectory: false }
      ],
      'Electronic Mix': [
        { name: 'techno_01.mp3', isDirectory: false },
        { name: 'house_02.mp3', isDirectory: false },
        { name: 'trance_03.flac', isDirectory: false }
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
    if (!idleEl || !deviceListEl || !splitViewEl || !playerViewEl || !optionMenuEl || !videoInfoEl) return;

    idleEl.style.display = 'none';
    deviceListEl.style.display = 'none';
    splitViewEl.style.display = 'none';
    playerViewEl.style.display = 'none';
    optionMenuEl.style.display = 'none';
    videoInfoEl.style.display = 'none';

    if (currentView === 'idle' || (currentView === 'devices' && usbDevices.length === 0)) {
      idleEl.style.display = 'flex';
      if (idleTextEl) idleTextEl.textContent = 'No USB device';
      if (idleIconEl) {
        idleIconEl.innerHTML = '&#128190;';
        idleIconEl.style.color = '#5b6577';
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
    }
  }

  function renderDeviceList() {
    if (!deviceListEl) return;
    var html = '<div class="usb-section-title">USB Devices</div>';
    for (var i = 0; i < usbDevices.length; i++) {
      var device = usbDevices[i];
      var cls = 'usb-list-item' + (i === selectedDeviceIndex ? ' usb-selected' : '');
      var displayName = device.label || device.name || ('USB Device ' + (i + 1));
      html += '<div class="' + cls + '" data-index="' + i + '">' +
        '<span class="usb-list-icon">&#128190;</span>' +
        '<span class="usb-list-name">' + escapeHtml(displayName) + '</span>' +
        '</div>';
    }
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
    var statusText = isPaused ? 'Paused' : 'Playing';
    var statusIcon = isPaused ? '&#10074;&#10074;' : '&#9654;';
    var fileIcon = getFileIcon(currentPlayingFile.name);

    playerViewEl.innerHTML =
      '<div class="usb-player-content">' +
        '<div class="usb-player-icon">' + fileIcon + '</div>' +
        '<div class="usb-player-info">' +
          '<div class="usb-player-filename">' + escapeHtml(currentPlayingFile.name) + '</div>' +
          '<div class="usb-player-status' + (isPaused ? ' usb-paused' : '') + '">' + statusIcon + ' ' + statusText + '</div>' +
          '<div class="usb-player-progress">' +
            '<div class="usb-progress-bar"><div class="usb-progress-fill" style="width:' + progressPercent + '%"></div></div>' +
            '<div class="usb-progress-time"><span>' + formatDuration(playbackElapsed) + '</span><span>' + formatDuration(playbackDuration) + '</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="usb-player-mode">' + modeInfo.icon + ' ' + modeInfo.name + '</div>' +
      '<div class="usb-player-counter">' + (currentPlayingIndex + 1) + ' / ' + playableFiles.length + '</div>';
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

  function loadCategoryContent(categoryId) {
    var categoryData = MOCK_DATA[categoryId] || {};
    folderEntries = categoryData['root'] || [];
    selectedFolderIndex = 0;
    scrollRowOffset = 0;
    currentPath = [];
    navigationStack = [];
  }

  function moveSelectionVertical(dir) {
    if (currentView === 'devices') {
      if (usbDevices.length === 0) return;
      selectedDeviceIndex = (selectedDeviceIndex + dir + usbDevices.length) % usbDevices.length;
      renderDeviceList();
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
        // Move by row (GRID_COLS items per row)
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
          playFile(entry);
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
          scrollRowOffset = prev.scrollOffset || 0;
          updateScrollOffset();
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
        case 'OK':
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
            playFile(entry);
            return true;
          }
        }
        return false;
      case 'OPTION':
        // Option key in split view - could show playback mode preview
        return false;
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
        '.usb-idle-icon{font-size:6rem;opacity:.6}' +
        '.usb-idle-text{font-size:1.8rem}' +
        '.usb-device-list{position:absolute;inset:0;overflow-y:auto;padding:24px;display:none}' +
        '.usb-section-title{color:#8a94a6;font-size:1.2rem;padding:12px 16px;margin-bottom:12px;' +
          'border-bottom:1px solid #2a3140;text-transform:uppercase;letter-spacing:1px}' +
        '.usb-list-item{display:flex;align-items:center;padding:20px 24px;margin:10px 0;' +
          'background:#161a22;border:2px solid #2a3140;border-radius:14px;color:#e6ebf2;cursor:pointer;transition:all .15s}' +
        '.usb-list-item:hover{background:#1d2430;border-color:#3a86ff}' +
        '.usb-list-item.usb-selected{background:#3a86ff;color:#fff;border-color:#3a86ff}' +
        '.usb-list-icon{font-size:2.5rem;margin-right:20px;min-width:48px;text-align:center}' +
        '.usb-list-name{font-size:1.5rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
        '.usb-empty{color:#8a94a6;text-align:center;padding:60px;font-size:1.5rem}' +
        // Split view styles
        '.usb-split-view{position:absolute;inset:0;display:none;flex-direction:row}' +
        '.usb-left-panel{width:280px;background:#11151c;border-right:2px solid #2a3140;' +
          'display:flex;flex-direction:column;justify-content:center;padding:20px 0}' +
        '.usb-right-panel{flex:1;background:#0d0f14;display:flex;flex-direction:column;overflow:hidden}' +
        '.usb-cat-item{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'padding:20px 16px;margin:10px 16px;border-radius:16px;color:#8a94a6;cursor:pointer;' +
          'transition:all .15s;border:2px solid transparent}' +
        '.usb-cat-item:hover{background:#1d2430;color:#e6ebf2}' +
        '.usb-cat-item.usb-cat-selected{background:#1d2430;color:#e6ebf2;border-color:#3a86ff}' +
        '.usb-cat-item.usb-cat-active{background:#3a86ff;color:#fff;border-color:#3a86ff}' +
        '.usb-cat-icon{font-size:4.2rem;margin-bottom:12px;transition:transform .25s ease}' +
        '.usb-cat-item.usb-cat-active .usb-cat-icon{transform:scale(1.1)}' +
        '.usb-cat-name{font-size:1.5rem;font-weight:600;text-align:center;transition:transform .25s ease}' +
        '.usb-cat-item.usb-cat-active .usb-cat-name{transform:scale(1.1)}' +
        '.usb-right-header{background:#11151c;color:#ffc239;padding:16px 24px;font-size:1.3rem;' +
          'font-weight:600;border-bottom:1px solid #2a3140;letter-spacing:.5px}' +
        '.usb-right-content-wrapper{flex:1;display:flex;flex-direction:row;overflow:hidden;position:relative}' +
        '.usb-right-content{flex:1;overflow:hidden;padding:16px;display:flex;flex-direction:column}' +
        '.usb-file-grid{display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(3,1fr);' +
          'gap:12px;flex:1;align-content:start}' +
        '.usb-file-item{display:flex;flex-direction:column;align-items:center;justify-content:center;' +
          'padding:16px 8px;background:#161a22;border:3px solid #2a3140;border-radius:16px;color:#e6ebf2;' +
          'cursor:pointer;transition:all .15s;min-height:0}' +
        '.usb-file-item:hover{background:#1d2430;border-color:#3a86ff}' +
        '.usb-file-item.usb-file-selected{background:#3a86ff;color:#fff;border-color:#fff}' +
        '.usb-file-icon{font-size:3rem;margin-bottom:8px;transition:transform .25s ease}' +
        '.usb-file-item.usb-file-selected .usb-file-icon{transform:scale(1.3)}' +
        '.usb-file-name{font-size:1.1rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
          'max-width:100%;text-align:center;transition:transform .25s ease}' +
        '.usb-file-item.usb-file-selected .usb-file-name{transform:scale(1.5)}' +
        '.usb-scrollbar-track{position:absolute;right:4px;top:16px;bottom:16px;width:6px;' +
          'background:rgba(42,49,64,0.3);border-radius:3px}' +
        '.usb-scrollbar-thumb{position:absolute;width:100%;background:rgba(138,148,166,0.4);' +
          'border-radius:3px;transition:top .15s ease-out}' +
        // Player view styles
        '.usb-player-view{position:absolute;inset:0;display:none;flex-direction:column;' +
          'align-items:center;justify-content:center;background:#0a0c10;padding:40px}' +
        '.usb-player-content{display:flex;flex-direction:column;align-items:center;gap:24px}' +
        '.usb-player-icon{font-size:8rem;opacity:.8}' +
        '.usb-player-info{text-align:center}' +
        '.usb-player-filename{color:#e6ebf2;font-size:2rem;font-weight:600;margin-bottom:8px}' +
        '.usb-player-status{color:#3a86ff;font-size:1.2rem;margin-bottom:20px}' +
        '.usb-player-status.usb-paused{color:#ffc239}' +
        '.usb-player-progress{width:500px}' +
        '.usb-progress-bar{height:6px;background:#2a3140;border-radius:3px;overflow:hidden}' +
        '.usb-progress-fill{height:100%;background:linear-gradient(90deg,#3a86ff,#ffc239);' +
          'border-radius:3px;transition:width .3s ease-out}' +
        '.usb-progress-time{display:flex;justify-content:space-between;color:#8a94a6;font-size:0.9rem;margin-top:8px}' +
        '.usb-player-mode{position:absolute;top:20px;right:24px;background:#3a86ff;color:#fff;' +
          'padding:8px 16px;border-radius:20px;font-size:1rem}' +
        '.usb-player-counter{position:absolute;top:20px;left:24px;color:#8a94a6;font-size:1rem}' +
        '.usb-player-hint{position:absolute;bottom:20px;color:#8a94a6;font-size:0.9rem}' +
        // Option menu styles
        '.usb-option-menu{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(4px)}' +
        '.usb-option-dialog{background:#161a22;border:2px solid #3a86ff;border-radius:16px;' +
          'padding:24px;min-width:400px;box-shadow:0 8px 40px rgba(0,0,0,.8)}' +
        '.usb-option-title{color:#ffc239;font-size:1.5rem;font-weight:600;margin-bottom:20px;text-align:center}' +
        '.usb-option-item{display:flex;align-items:center;padding:16px 20px;margin:8px 0;' +
          'background:#0d0f14;border:2px solid #2a3140;border-radius:12px;color:#e6ebf2;cursor:pointer;transition:all .15s}' +
        '.usb-option-item:hover{background:#1d2430;border-color:#3a86ff}' +
        '.usb-option-item.usb-option-selected{background:#3a86ff;color:#fff;border-color:#fff}' +
        '.usb-option-item.usb-option-current{border-color:#ffc239}' +
        '.usb-option-icon{font-size:1.5rem;margin-right:16px;min-width:32px;text-align:center}' +
        '.usb-option-name{font-size:1.2rem;font-weight:600;margin-right:12px}' +
        '.usb-option-desc{flex:1;color:#8a94a6;font-size:0.9rem}' +
        '.usb-option-check{color:#ffc239;font-size:1.2rem;margin-left:auto}' +
        '.usb-option-hint{color:#8a94a6;font-size:0.85rem;text-align:center;margin-top:16px;padding-top:16px;border-top:1px solid #2a3140}' +
        // Video info dialog styles
        '.usb-video-info{position:absolute;inset:0;display:none;align-items:center;justify-content:center;' +
          'background:rgba(0,0,0,.7);backdrop-filter:blur(4px)}' +
        '.usb-video-info-dialog{background:#4a5568;border:2px solid #718096;border-radius:12px;' +
          'padding:24px 32px;min-width:380px;box-shadow:0 8px 40px rgba(0,0,0,.8)}' +
        '.usb-video-info-title{color:#e2e8f0;font-size:1.6rem;font-weight:600;margin-bottom:20px}' +
        '.usb-video-info-content{margin-bottom:24px}' +
        '.usb-video-info-row{color:#e2e8f0;font-size:1.2rem;margin:8px 0;line-height:1.6}' +
        '.usb-video-info-label{color:#e2e8f0;font-weight:600}' +
        '.usb-video-info-close{display:block;width:100%;background:#3182ce;color:#fff;border:none;' +
          'border-radius:24px;padding:12px 24px;font-size:1.1rem;font-weight:600;cursor:pointer;' +
          'transition:background .15s}' +
        '.usb-video-info-close:hover{background:#2b6cb0}' +
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
              '<div class="usb-split-view">' +
                '<div class="usb-left-panel"></div>' +
                '<div class="usb-right-panel"></div>' +
              '</div>' +
              '<div class="usb-player-view"></div>' +
              '<div class="usb-option-menu"></div>' +
              '<div class="usb-video-info"></div>' +
            '</div>' +
          '</div>' +
        '</div>';
      stageEl = el.querySelector('.usb-stage');
      idleEl = el.querySelector('.usb-idle');
      idleTextEl = el.querySelector('.usb-idle-text');
      idleIconEl = el.querySelector('.usb-idle-icon');
      deviceListEl = el.querySelector('.usb-device-list');
      splitViewEl = el.querySelector('.usb-split-view');
      leftPanelEl = el.querySelector('.usb-left-panel');
      rightPanelEl = el.querySelector('.usb-right-panel');
      playerViewEl = el.querySelector('.usb-player-view');
      optionMenuEl = el.querySelector('.usb-option-menu');
      videoInfoEl = el.querySelector('.usb-video-info');
    },

    onShow: function (params) {
      isVisible = true;
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
})();
