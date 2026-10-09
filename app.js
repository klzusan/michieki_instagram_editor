/**
 * 道の駅インスタ投稿用 画像エディタ (Michieki Instagram Editor)
 * Client-side Canvas Image Editor & Batch JSZip Generator
 */

(function () {
  'use strict';

  // --- App State ---
  const state = {
    images: [], // { id, file, originalName, baseName, dataUrl, imgElement, width, height, isSquare }
    selectedThumbnailId: null,
    activePreviewImageId: null,
    bgColor: { r: 230, g: 255, b: 230 },
    stations: [],
    customStations: [],
    fontFamily: 'HuiFontP29',
    fontLoaded: false,
    cropperInstance: null,
    currentCroppingImageId: null,
  };

  // --- DOM Elements ---
  const dropzone = document.getElementById('dropzone');
  const imageFileInput = document.getElementById('imageFileInput');
  const imageCountBadge = document.getElementById('imageCountBadge');
  const imageGalleryGrid = document.getElementById('imageGalleryGrid');
  const emptyGalleryNotice = document.getElementById('emptyGalleryNotice');

  // Color inputs
  const bgColorPicker = document.getElementById('bgColorPicker');
  const colorR = document.getElementById('colorR');
  const colorG = document.getElementById('colorG');
  const colorB = document.getElementById('colorB');
  const resetColorBtn = document.getElementById('resetColorBtn');

  // Form inputs
  const regionSelect = document.getElementById('regionSelect');
  const customRegionInput = document.getElementById('customRegionInput');
  const stationNumberInput = document.getElementById('stationNumberInput');
  const stationNameInput = document.getElementById('stationNameInput');
  const autocompleteList = document.getElementById('autocompleteList');
  const prefectureInput = document.getElementById('prefectureInput');
  const municipalityInput = document.getElementById('municipalityInput');
  const registerStationBtn = document.getElementById('registerStationBtn');
  const registerFeedback = document.getElementById('registerFeedback');

  // Preview elements
  const thumbnailPreviewCanvas = document.getElementById('thumbnailPreviewCanvas');
  const emptyPreview = document.getElementById('emptyPreview');
  const previewBadge = document.getElementById('previewBadge');
  const previewDimension = document.getElementById('previewDimension');
  const clearThumbnailBtn = document.getElementById('clearThumbnailBtn');
  const specsBar = document.getElementById('specsBar');

  // Download elements
  const downloadZipBtn = document.getElementById('downloadZipBtn');
  const downloadStatusText = document.getElementById('downloadStatusText');
  const progressBarContainer = document.getElementById('progressBarContainer');
  const progressBarFill = document.getElementById('progressBarFill');

  // Font elements
  const fontStatusDot = document.getElementById('fontStatusDot');
  const fontStatusText = document.getElementById('fontStatusText');
  const fontFileInput = document.getElementById('fontFileInput');

  // Modals
  const cropModal = document.getElementById('cropModal');
  const cropperImage = document.getElementById('cropperImage');
  const closeCropModalBtn = document.getElementById('closeCropModalBtn');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const applyCropBtn = document.getElementById('applyCropBtn');
  const revertCropBtn = document.getElementById('revertCropBtn');

  // Crop Rotation elements
  const cropRotationValue = document.getElementById('cropRotationValue');
  const cropRotationSlider = document.getElementById('cropRotationSlider');
  const cropRotateMinusOneBtn = document.getElementById('cropRotateMinusOneBtn');
  const cropRotateMinusPointOneBtn = document.getElementById('cropRotateMinusPointOneBtn');
  const cropRotatePlusPointOneBtn = document.getElementById('cropRotatePlusPointOneBtn');
  const cropRotatePlusOneBtn = document.getElementById('cropRotatePlusOneBtn');
  const cropRotateLeft90Btn = document.getElementById('cropRotateLeft90Btn');
  const cropRotateRight90Btn = document.getElementById('cropRotateRight90Btn');
  const cropRotateResetBtn = document.getElementById('cropRotateResetBtn');

  // Rotation state tracking for active cropper modal
  let currentBaseAngle = 0;
  let currentFineAngle = 0;

  const openCustomStationsBtn = document.getElementById('openCustomStationsBtn');
  const customStationsModal = document.getElementById('customStationsModal');
  const closeCustomStationsModalBtn = document.getElementById('closeCustomStationsModalBtn');
  const closeCustomStationsBtn2 = document.getElementById('closeCustomStationsBtn2');
  const clearAllCustomStationsBtn = document.getElementById('clearAllCustomStationsBtn');
  const customStationsList = document.getElementById('customStationsList');

  // --- Initialization ---
  async function init() {
    loadCustomStations();
    await loadStationsDatabase();
    checkFontStatus();
    updateColorUI();
    renderGallery();
  }

  // --- Font Management ---
  async function checkFontStatus() {
    try {
      if (document.fonts) {
        // Attempt to check if HuiFontP29 is loaded
        const loaded = await document.fonts.load('16px HuiFontP29');
        if (loaded && loaded.length > 0) {
          setFontStatus(true, 'ふい字P 読み込み完了');
          return;
        }
      }
    } catch (e) {
      console.warn('Font check error:', e);
    }
    // Fallback status
    setFontStatus(false, '標準フォント代替中（フォント選択可）');
  }

  function setFontStatus(isLoaded, text) {
    state.fontLoaded = isLoaded;
    fontStatusText.textContent = text;
    if (isLoaded) {
      fontStatusDot.className = 'status-indicator loaded';
    } else {
      fontStatusDot.className = 'status-indicator fallback';
    }
    drawPreview();
  }

  // Handle local font file upload
  fontFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const buffer = await file.arrayBuffer();
      const font = new FontFace('HuiFontP29', buffer);
      await font.load();
      document.fonts.add(font);
      setFontStatus(true, `「${file.name}」適用中`);
    } catch (err) {
      console.error('Failed to load font:', err);
      alert('フォントファイルの読み込みに失敗しました。有効な.ttfまたは.otfファイルか確認してください。');
    }
  });

  // --- Roadside Stations Database & Learning ---
  async function loadStationsDatabase() {
    try {
      // Load manifest of regional prefecture files (no-cache to avoid stale manifest in browser cache)
      let files = [];
      const manifestRes = await fetch(`data/manifest.json?t=${Date.now()}`, { cache: 'no-cache' });
      if (manifestRes.ok) {
        files = await manifestRes.json();
      } else {
        // Fallback file list
        files = [
          'data/kinki/st_shiga.json',
          'data/kinki/st_kyoto.json',
          'data/kinki/st_osaka.json',
          'data/kinki/st_hyogo.json',
          'data/kinki/st_nara.json',
          'data/kinki/st_wakayama.json',
          'data/kinki/st_mie.json',
          'data/chubu/st_fukui.json',
          'data/kanto/st_gunma.json',
          'data/kanto/st_chiba.json',
          'data/kanto/st_ibaraki.json',
          'data/kanto/st_tokyo.json',
          'data/chugoku/st_okayama.json',
          'data/shikoku/st_kagawa.json',
          'data/kyushu/st_kumamoto.json',
          'data/hokkaido/st_hokkaido.json'
        ];
      }

      // Fetch each prefecture file in parallel
      const results = await Promise.allSettled(
        files.map(async (filePath) => {
          const res = await fetch(`${filePath}?t=${Date.now()}`, { cache: 'no-cache' });
          if (res.ok) {
            return await res.json();
          }
          return [];
        })
      );

      const allStations = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allStations.push(...r.value);
        }
      }

      state.stations = allStations;
      console.log(`Loaded ${state.stations.length} roadside stations across prefectures.`);
    } catch (e) {
      console.warn('Could not load station databases, using local state:', e);
      state.stations = [];
    }
  }

  function loadCustomStations() {
    try {
      const saved = localStorage.getItem('michieki_custom_stations');
      if (saved) {
        state.customStations = JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error reading localStorage custom stations:', e);
    }
  }

  function saveCustomStation(station) {
    if (!station || !station.name) return false;
    const cleanName = station.name.trim();
    if (!cleanName) return false;

    const existingCustomIdx = state.customStations.findIndex(
      (s) => s.name.trim().toLowerCase() === cleanName.toLowerCase()
    );

    if (existingCustomIdx >= 0) {
      // Update existing custom entry
      state.customStations[existingCustomIdx] = {
        ...state.customStations[existingCustomIdx],
        region: station.region || getSelectedRegion(),
        prefecture: station.prefecture || '',
        municipality: station.municipality || '',
        updatedAt: new Date().toISOString(),
      };
      try {
        localStorage.setItem(
          'michieki_custom_stations',
          JSON.stringify(state.customStations)
        );
      } catch (e) {
        console.error('Error saving to localStorage:', e);
      }
      return true;
    }

    const newEntry = {
      name: cleanName,
      kana: station.kana || '',
      region: station.region || getSelectedRegion(),
      prefecture: station.prefecture || '',
      municipality: station.municipality || '',
      custom: true,
      createdAt: new Date().toISOString(),
    };
    state.customStations.unshift(newEntry);
    try {
      localStorage.setItem(
        'michieki_custom_stations',
        JSON.stringify(state.customStations)
      );
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
    return true;
  }

  function deleteCustomStation(index) {
    state.customStations.splice(index, 1);
    try {
      localStorage.setItem(
        'michieki_custom_stations',
        JSON.stringify(state.customStations)
      );
    } catch (e) { }
    renderCustomStationsModalList();
  }

  function clearAllCustomStations() {
    if (confirm('登録されたすべてのカスタム道の駅を削除しますか？')) {
      state.customStations = [];
      localStorage.removeItem('michieki_custom_stations');
      renderCustomStationsModalList();
    }
  }

  // --- Autocomplete Logic ---
  function getCombinedStations() {
    return [...state.customStations, ...state.stations];
  }

  stationNameInput.addEventListener('input', (e) => {
    const query = e.target.value.trim().toLowerCase();
    if (!query) {
      autocompleteList.hidden = true;
      autocompleteList.innerHTML = '';
      return;
    }

    const allStations = getCombinedStations();
    const currentRegion = getSelectedRegion();

    // Filter matching stations
    const matches = allStations.filter((s) => {
      const name = (s.name || '').toLowerCase();
      const kana = (s.kana || '').toLowerCase();
      const pref = (s.prefecture || '').toLowerCase();
      const city = (s.municipality || '').toLowerCase();
      return (
        name.includes(query) ||
        kana.includes(query) ||
        pref.includes(query) ||
        city.includes(query)
      );
    });

    // Prioritize stations matching current selected region
    matches.sort((a, b) => {
      const aRegion = a.region === currentRegion ? 1 : 0;
      const bRegion = b.region === currentRegion ? 1 : 0;
      return bRegion - aRegion;
    });

    renderAutocompleteItems(matches.slice(0, 10));
  });

  function renderAutocompleteItems(items) {
    if (items.length === 0) {
      autocompleteList.hidden = true;
      autocompleteList.innerHTML = '';
      return;
    }

    autocompleteList.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      li.className = 'autocomplete-item';
      li.innerHTML = `
        <div>
          <div class="station-meta-main">${escapeHtml(item.name)}</div>
          <div class="station-meta-sub">${escapeHtml(item.region || '')} / ${escapeHtml(item.prefecture || '')} ${escapeHtml(item.municipality || '')}</div>
        </div>
        ${item.custom ? '<span class="label-tag">学習済</span>' : ''}
      `;

      li.addEventListener('click', () => {
        selectStationItem(item);
      });
      autocompleteList.appendChild(li);
    });

    autocompleteList.hidden = false;
  }

  function selectStationItem(item) {
    stationNameInput.value = item.name;
    if (item.prefecture) prefectureInput.value = item.prefecture;
    if (item.municipality) municipalityInput.value = item.municipality;
    if (item.region) {
      setRegionValue(item.region);
    }

    autocompleteList.hidden = true;
    autocompleteList.innerHTML = '';
    drawPreview();
  }

  // Close autocomplete on click outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-group')) {
      autocompleteList.hidden = true;
    }
  });

  // Manual registration via button click
  registerStationBtn.addEventListener('click', () => {
    const name = stationNameInput.value.trim();
    if (!name) {
      alert('道の駅名を入力してください');
      stationNameInput.focus();
      return;
    }

    const saved = saveCustomStation({
      name: name,
      prefecture: prefectureInput.value.trim(),
      municipality: municipalityInput.value.trim(),
      region: getSelectedRegion(),
    });

    if (saved) {
      registerFeedback.textContent = '✅ 登録しました！';
    } else {
      registerFeedback.textContent = 'ℹ️ 既に登録済みです';
    }
    registerFeedback.hidden = false;
    setTimeout(() => {
      registerFeedback.hidden = true;
    }, 2500);

    drawPreview();
  });

  // --- Region Helpers ---
  function getSelectedRegion() {
    if (regionSelect.value === 'custom') {
      return customRegionInput.value.trim() || '近畿';
    }
    return regionSelect.value;
  }

  function setRegionValue(region) {
    const options = Array.from(regionSelect.options).map((o) => o.value);
    if (options.includes(region)) {
      regionSelect.value = region;
      customRegionInput.classList.add('hidden');
    } else {
      regionSelect.value = 'custom';
      customRegionInput.value = region;
      customRegionInput.classList.remove('hidden');
    }
  }

  regionSelect.addEventListener('change', () => {
    if (regionSelect.value === 'custom') {
      customRegionInput.classList.remove('hidden');
      customRegionInput.focus();
    } else {
      customRegionInput.classList.add('hidden');
    }
    drawPreview();
  });

  customRegionInput.addEventListener('input', () => drawPreview());
  stationNumberInput.addEventListener('input', () => drawPreview());
  stationNameInput.addEventListener('input', () => drawPreview());
  prefectureInput.addEventListener('input', () => drawPreview());
  municipalityInput.addEventListener('input', () => drawPreview());

  // --- Color Helpers ---
  function rgbToHex(r, g, b) {
    return (
      '#' +
      [r, g, b]
        .map((x) => {
          const hex = Math.max(0, Math.min(255, x)).toString(16);
          return hex.length === 1 ? '0' + hex : hex;
        })
        .join('')
    );
  }

  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
      : { r: 230, g: 255, b: 230 };
  }

  function updateColorUI() {
    bgColorPicker.value = rgbToHex(state.bgColor.r, state.bgColor.g, state.bgColor.b);
    colorR.value = state.bgColor.r;
    colorG.value = state.bgColor.g;
    colorB.value = state.bgColor.b;
  }

  bgColorPicker.addEventListener('input', (e) => {
    state.bgColor = hexToRgb(e.target.value);
    colorR.value = state.bgColor.r;
    colorG.value = state.bgColor.g;
    colorB.value = state.bgColor.b;
    drawPreview();
  });

  [colorR, colorG, colorB].forEach((input) => {
    input.addEventListener('input', () => {
      state.bgColor.r = parseInt(colorR.value, 10) || 0;
      state.bgColor.g = parseInt(colorG.value, 10) || 0;
      state.bgColor.b = parseInt(colorB.value, 10) || 0;
      bgColorPicker.value = rgbToHex(state.bgColor.r, state.bgColor.g, state.bgColor.b);
      drawPreview();
    });
  });

  resetColorBtn.addEventListener('click', () => {
    state.bgColor = { r: 230, g: 255, b: 230 };
    updateColorUI();
    drawPreview();
  });

  // --- Image Handling & Upload ---
  dropzone.addEventListener('click', () => {
    imageFileInput.click();
  });

  // Comprehensively prevent browser from navigating or opening dropped files in new tabs
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((eventName) => {
    window.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
    document.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
    }, false);
  });

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
  });

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  // Also support dropping anywhere on the page for supreme user convenience
  window.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  });

  imageFileInput.addEventListener('change', (e) => {
    if (e.target && e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
    imageFileInput.value = ''; // Reset input to allow re-selection
  });

  async function handleFiles(files) {
    if (!files || files.length === 0) return;

    const validFiles = Array.from(files).filter((f) => {
      if (!f) return false;
      const type = (f.type || '').toLowerCase();
      const name = (f.name || '').toLowerCase();
      return type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|heic|svg)$/i.test(name);
    });

    if (validFiles.length === 0) {
      alert('画像ファイル（PNG, JPEG, WEBPなど）を選択してください。');
      return;
    }

    for (const file of validFiles) {
      await addImageFile(file);
    }

    // Set active preview to first image if none active
    if (!state.activePreviewImageId && state.images.length > 0) {
      state.activePreviewImageId = state.images[0].id;
    }

    renderGallery();
    updateDownloadButtonState();
    drawPreview();
  }

  function addImageFile(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const img = new Image();
        img.onload = () => {
          const isSquare = Math.abs(img.naturalWidth - img.naturalHeight) <= 2;
          const baseName = file.name.replace(/\.[^/.]+$/, '');
          const newImgObj = {
            id: 'img_' + Math.random().toString(36).substr(2, 9),
            file: file,
            originalName: file.name,
            baseName: baseName,
            originalDataUrl: dataUrl,
            originalWidth: img.naturalWidth,
            originalHeight: img.naturalHeight,
            originalIsSquare: isSquare,
            dataUrl: dataUrl,
            imgElement: img,
            width: img.naturalWidth,
            height: img.naturalHeight,
            isSquare: isSquare,
            isCropped: false,
            cropData: null,
            cropRotate: 0,
            baseAngle: 0,
            fineAngle: 0,
          };
          state.images.push(newImgObj);
          resolve();
        };
        img.onerror = () => {
          console.warn('Image element failed to decode:', file.name);
          resolve();
        };
        img.src = dataUrl;
      };
      reader.onerror = () => {
        console.warn('FileReader failed to read:', file.name);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }

  function removeImage(id) {
    state.images = state.images.filter((img) => img.id !== id);
    if (state.selectedThumbnailId === id) {
      state.selectedThumbnailId = null;
    }
    if (state.activePreviewImageId === id) {
      state.activePreviewImageId = state.images.length > 0 ? state.images[0].id : null;
    }
    renderGallery();
    updateDownloadButtonState();
    drawPreview();
  }

  // --- Cropper Modal & Rotation Logic ---
  function updateRotationDisplay() {
    const total = currentBaseAngle + currentFineAngle;
    cropRotationValue.textContent = `${total >= 0 ? '+' : ''}${total.toFixed(1)}°`;
  }

  function applyRotationToCropper() {
    const total = currentBaseAngle + currentFineAngle;
    if (state.cropperInstance) {
      state.cropperInstance.rotateTo(total);
    }
    updateRotationDisplay();
  }

  cropRotationSlider.addEventListener('input', () => {
    currentFineAngle = parseFloat(cropRotationSlider.value) || 0;
    applyRotationToCropper();
  });

  cropRotateMinusOneBtn.addEventListener('click', () => {
    currentFineAngle = Math.max(-45, Math.min(45, Math.round((currentFineAngle - 1) * 10) / 10));
    cropRotationSlider.value = currentFineAngle;
    applyRotationToCropper();
  });

  cropRotateMinusPointOneBtn.addEventListener('click', () => {
    currentFineAngle = Math.max(-45, Math.min(45, Math.round((currentFineAngle - 0.1) * 10) / 10));
    cropRotationSlider.value = currentFineAngle;
    applyRotationToCropper();
  });

  cropRotatePlusPointOneBtn.addEventListener('click', () => {
    currentFineAngle = Math.max(-45, Math.min(45, Math.round((currentFineAngle + 0.1) * 10) / 10));
    cropRotationSlider.value = currentFineAngle;
    applyRotationToCropper();
  });

  cropRotatePlusOneBtn.addEventListener('click', () => {
    currentFineAngle = Math.max(-45, Math.min(45, Math.round((currentFineAngle + 1) * 10) / 10));
    cropRotationSlider.value = currentFineAngle;
    applyRotationToCropper();
  });

  cropRotateLeft90Btn.addEventListener('click', () => {
    currentBaseAngle = (currentBaseAngle - 90) % 360;
    applyRotationToCropper();
  });

  cropRotateRight90Btn.addEventListener('click', () => {
    currentBaseAngle = (currentBaseAngle + 90) % 360;
    applyRotationToCropper();
  });

  cropRotateResetBtn.addEventListener('click', () => {
    currentBaseAngle = 0;
    currentFineAngle = 0;
    cropRotationSlider.value = 0;
    applyRotationToCropper();
  });

  function openCropModal(imageId) {
    const imgObj = state.images.find((i) => i.id === imageId);
    if (!imgObj) return;

    state.currentCroppingImageId = imageId;
    currentBaseAngle = imgObj.baseAngle || 0;
    currentFineAngle = imgObj.fineAngle || 0;
    cropRotationSlider.value = currentFineAngle;
    updateRotationDisplay();

    // Show revert button only if previously cropped
    revertCropBtn.hidden = !imgObj.isCropped;

    // Use original uncropped source image to prevent multi-crop degradation
    cropperImage.src = imgObj.originalDataUrl || imgObj.dataUrl;
    cropModal.hidden = false;

    if (state.cropperInstance) {
      state.cropperInstance.destroy();
      state.cropperInstance = null;
    }

    // Initialize Cropper.js with 1:1 aspect ratio
    state.cropperInstance = new Cropper(cropperImage, {
      aspectRatio: 1,
      viewMode: 1,
      autoCropArea: 0.9,
      responsive: true,
      guides: true,
      highlight: true,
      movable: true,
      zoomable: true,
      rotatable: true,
      ready() {
        const total = currentBaseAngle + currentFineAngle;
        if (total !== 0) {
          state.cropperInstance.rotateTo(total);
        }
        if (imgObj.cropData) {
          state.cropperInstance.setData(imgObj.cropData);
        }
      },
    });
  }

  function closeCropModal() {
    cropModal.hidden = true;
    if (state.cropperInstance) {
      state.cropperInstance.destroy();
      state.cropperInstance = null;
    }
    state.currentCroppingImageId = null;
  }

  closeCropModalBtn.addEventListener('click', closeCropModal);
  cancelCropBtn.addEventListener('click', closeCropModal);

  // Revert back to original uncropped image
  revertCropBtn.addEventListener('click', () => {
    if (!state.currentCroppingImageId) return;
    const imgObj = state.images.find((i) => i.id === state.currentCroppingImageId);
    if (!imgObj) return;

    const origImg = new Image();
    origImg.onload = () => {
      imgObj.dataUrl = imgObj.originalDataUrl;
      imgObj.imgElement = origImg;
      imgObj.width = imgObj.originalWidth;
      imgObj.height = imgObj.originalHeight;
      imgObj.isSquare = imgObj.originalIsSquare;
      imgObj.isCropped = false;
      imgObj.cropData = null;
      imgObj.cropRotate = 0;
      imgObj.baseAngle = 0;
      imgObj.fineAngle = 0;

      closeCropModal();
      renderGallery();
      drawPreview();
    };
    origImg.src = imgObj.originalDataUrl;
  });

  applyCropBtn.addEventListener('click', () => {
    if (!state.cropperInstance || !state.currentCroppingImageId) return;

    const imgObj = state.images.find((i) => i.id === state.currentCroppingImageId);
    if (!imgObj) return;

    const croppedCanvas = state.cropperInstance.getCroppedCanvas({
      imageSmoothingEnabled: true,
      imageSmoothingQuality: 'high',
    });
    if (!croppedCanvas) return;

    const cropData = state.cropperInstance.getData();
    const croppedDataUrl = croppedCanvas.toDataURL('image/png');
    const newImg = new Image();
    newImg.onload = () => {
      imgObj.dataUrl = croppedDataUrl;
      imgObj.imgElement = newImg;
      imgObj.width = newImg.naturalWidth;
      imgObj.height = newImg.naturalHeight;
      imgObj.isSquare = true;
      imgObj.isCropped = true;
      imgObj.cropData = cropData;
      imgObj.cropRotate = currentBaseAngle + currentFineAngle;
      imgObj.baseAngle = currentBaseAngle;
      imgObj.fineAngle = currentFineAngle;

      closeCropModal();
      renderGallery();
      drawPreview();
    };
    newImg.src = croppedDataUrl;
  });

  // --- UI Rendering ---
  function renderGallery() {
    imageCountBadge.textContent = `${state.images.length}枚選択中`;

    if (state.images.length === 0) {
      emptyGalleryNotice.style.display = 'block';
      imageGalleryGrid.querySelectorAll('.image-card').forEach((el) => el.remove());
      return;
    }

    emptyGalleryNotice.style.display = 'none';
    imageGalleryGrid.querySelectorAll('.image-card').forEach((el) => el.remove());

    state.images.forEach((img) => {
      const isThumb = state.selectedThumbnailId === img.id;
      const isPreviewing = state.activePreviewImageId === img.id;
      const card = document.createElement('div');
      card.className = `image-card ${isThumb ? 'is-thumbnail' : ''} ${isPreviewing ? 'is-previewing' : ''}`;
      card.id = `card_${img.id}`;
      card.setAttribute('title', 'クリックでプレビュー表示');

      card.innerHTML = `
        <div class="image-card-thumb-wrap">
          <img src="${img.dataUrl}" alt="${escapeHtml(img.originalName)}">
          <div class="image-card-badges">
            ${isThumb ? '<span class="badge-tag badge-thumbnail">★ サムネイル</span>' : ''}
            ${isPreviewing ? '<span class="badge-tag" style="background: rgba(59, 130, 246, 0.9);">👀 プレビュー中</span>' : ''}
            <span class="badge-tag ${img.isCropped ? 'badge-ratio-ok' : (img.isSquare ? 'badge-ratio-ok' : 'badge-ratio-warn')}">
              ${img.isCropped ? '✂️ トリミング済' : (img.isSquare ? '1:1 正方形' : '⚠️ 非正方形')}
            </span>
          </div>
          <button class="image-card-delete-btn" title="画像を削除" data-id="${img.id}">&times;</button>
        </div>
        <div class="image-card-content">
          <div class="image-card-name" title="${escapeHtml(img.originalName)}">${escapeHtml(img.originalName)}</div>
          <div class="image-card-dim">${img.width} × ${img.height} px</div>
          
          <label class="image-card-radio-label" title="${isThumb ? 'クリックでサムネイル解除' : 'クリックでサムネイルに指定'}">
            <input type="radio" name="thumbnailRadio" value="${img.id}" ${isThumb ? 'checked' : ''}>
            <span>${isThumb ? '★ サムネイル（解除）' : 'サムネイルに指定'}</span>
          </label>

          <button class="crop-action-btn ${img.isCropped ? 'btn-recrop' : (img.isSquare ? 'btn-square-crop' : 'btn-warn-crop')}" data-crop-id="${img.id}">
            ${img.isCropped ? '✂️ トリミング・回転を再調整' : (img.isSquare ? '✂️ トリミング・回転調整' : '📐 正方形にトリミング')}
          </button>
        </div>
      `;

      // Click card to preview
      card.addEventListener('click', (e) => {
        if (e.target.closest('.image-card-delete-btn') || e.target.closest('.crop-action-btn') || e.target.closest('.image-card-radio-label')) {
          return;
        }
        state.activePreviewImageId = img.id;
        renderGallery();
        drawPreview();
      });

      // Event listener: Delete button
      card.querySelector('.image-card-delete-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage(img.id);
      });

      // Event listener: Thumbnail toggle / radio click
      const radioLabel = card.querySelector('.image-card-radio-label');
      radioLabel.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault(); // prevent native radio un-toggle prevention
        if (state.selectedThumbnailId === img.id) {
          // Deselect thumbnail
          state.selectedThumbnailId = null;
        } else {
          // Select as thumbnail
          state.selectedThumbnailId = img.id;
          state.activePreviewImageId = img.id;
        }
        renderGallery();
        drawPreview();
      });

      // Event listener: Crop button
      const cropBtn = card.querySelector('.crop-action-btn');
      if (cropBtn) {
        cropBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openCropModal(img.id);
        });
      }

      imageGalleryGrid.appendChild(card);
    });
  }

  function updateDownloadButtonState() {
    const hasImages = state.images.length > 0;
    downloadZipBtn.disabled = !hasImages;
    if (hasImages) {
      downloadStatusText.textContent = `合計 ${state.images.length} 枚の画像を処理して1つのZIPにまとめます`;
    } else {
      downloadStatusText.textContent = '画像を1枚以上追加するとダウンロードが有効になります';
    }
  }

  // Clear thumbnail button
  if (clearThumbnailBtn) {
    clearThumbnailBtn.addEventListener('click', () => {
      state.selectedThumbnailId = null;
      renderGallery();
      drawPreview();
    });
  }

  // --- Realtime Preview Canvas Drawing ---
  function drawPreview() {
    let previewImg = state.images.find((i) => i.id === state.activePreviewImageId);
    if (!previewImg) {
      if (state.selectedThumbnailId) {
        previewImg = state.images.find((i) => i.id === state.selectedThumbnailId);
      } else if (state.images.length > 0) {
        previewImg = state.images[0];
      }
    }

    if (!previewImg) {
      emptyPreview.style.display = 'flex';
      thumbnailPreviewCanvas.style.display = 'none';
      previewBadge.textContent = '画像未選択';
      previewBadge.className = 'preview-badge';
      previewDimension.textContent = '-';
      if (clearThumbnailBtn) clearThumbnailBtn.hidden = true;
      return;
    }

    state.activePreviewImageId = previewImg.id;
    emptyPreview.style.display = 'none';
    thumbnailPreviewCanvas.style.display = 'block';

    const isThumbnail = previewImg.id === state.selectedThumbnailId;
    if (clearThumbnailBtn) {
      clearThumbnailBtn.hidden = !state.selectedThumbnailId;
    }

    if (isThumbnail) {
      // Thumbnail Preview Mode (1.4x)
      previewBadge.textContent = '★ サムネイル プレビュー';
      previewBadge.className = 'preview-badge active';
      const x = previewImg.width;
      const canvasSize = Math.round(1.4 * x);
      previewDimension.textContent = `${canvasSize} × ${canvasSize} px (1.4x)`;

      if (specsBar) {
        specsBar.innerHTML = `
          <div class="spec-pill"><span>キャンバス:</span> 1.4x × 1.4x</div>
          <div class="spec-pill"><span>上部ベゼル:</span> 0.1x</div>
          <div class="spec-pill"><span>情報エリア:</span> 0.3x</div>
          <div class="spec-pill"><span>メイン文字:</span> 0.07x (太字)</div>
          <div class="spec-pill"><span>サブ文字:</span> 0.056x (太字)</div>
        `;
      }

      renderThumbnailCanvas(thumbnailPreviewCanvas, previewImg, {
        region: getSelectedRegion(),
        number: stationNumberInput.value.trim() || 'xx',
        name: stationNameInput.value.trim() || '道の駅名',
        prefecture: prefectureInput.value.trim() || '都道府県',
        municipality: municipalityInput.value.trim() || '市町村',
        bgColor: state.bgColor,
      });
    } else {
      // Main Post Preview Mode (1.2x)
      previewBadge.textContent = '本投稿 プレビュー';
      previewBadge.className = 'preview-badge mode-main-post';
      const x = previewImg.width;
      const canvasSize = Math.round(1.2 * x);
      previewDimension.textContent = `${canvasSize} × ${canvasSize} px (1.2x)`;

      if (specsBar) {
        specsBar.innerHTML = `
          <div class="spec-pill"><span>キャンバス:</span> 1.2x × 1.2x</div>
          <div class="spec-pill"><span>画像配置:</span> 中央 (余白 0.1x)</div>
          <div class="spec-pill"><span>背景色:</span> RGB(${state.bgColor.r}, ${state.bgColor.g}, ${state.bgColor.b})</div>
        `;
      }

      renderMainPostCanvas(thumbnailPreviewCanvas, previewImg, state.bgColor);
    }
  }

  // Function alias for backward compatibility
  function drawThumbnailPreview() {
    drawPreview();
  }

  /**
   * Core Thumbnail Drawing Logic according to precise specifications:
   * - Canvas: 1.4x * 1.4x
   * - Top bezel: 0.1x
   * - Centered horizontally (left margin = (1.4x - x)/2 = 0.2x)
   * - Background: RGB
   * - Font size: Main = 0.07x, Sub = 0.056x
   * - Text in bottom area (0.2x height):
   *   Line 1: 道の駅巡り(近畿) #(番号)
   *   Line 2: (道の駅名)
   *   Line 3: (都道府県) (市町村)
   * - All center aligned, pure black text
   */
  function renderThumbnailCanvas(canvas, imgObj, params) {
    const x = imgObj.width;
    const canvasSize = Math.round(1.4 * x);

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');

    // 1. Fill background with specified RGB color
    ctx.fillStyle = `rgb(${params.bgColor.r}, ${params.bgColor.g}, ${params.bgColor.b})`;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // 2. Place image: centered horizontally, top bezel = 0.1x
    const imgX = Math.round(0.2 * x);
    const imgY = Math.round(0.1 * x);
    ctx.drawImage(imgObj.imgElement, imgX, imgY, x, x);

    // 3. Information area text drawing
    // Area Y: 1.1x to 1.4x (height 0.3x, center at 1.25x)
    const fontMainSize = Math.round(0.07 * x);
    const fontSubSize = Math.round(0.056 * x);
    const fontFam = `"${state.fontFamily}", "Noto Sans JP", sans-serif`;

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const centerX = canvasSize / 2;

    // Distribute 3 lines gracefully inside the 0.3x information area:
    // Line 1 center: 1.170x
    // Line 2 center: 1.250x
    // Line 3 center: 1.330x
    const line1Y = Math.round(1.170 * x);
    const line2Y = Math.round(1.250 * x);
    const line3Y = Math.round(1.330 * x);

    // Thick bold text drawer using stroke + fill
    function drawBoldText(text, yCoord, fontSize) {
      ctx.font = `bold ${fontSize}px ${fontFam}`;
      const strokeW = Math.max(1.5, Math.round(fontSize * 0.04));
      ctx.lineWidth = strokeW;
      ctx.strokeStyle = '#000000';
      ctx.fillStyle = '#000000';
      ctx.strokeText(text, centerX, yCoord);
      ctx.fillText(text, centerX, yCoord);
    }

    // Line 1: 道の駅巡り(地域)#(番号)
    const line1Text = `道の駅巡り(${params.region})#${params.number}`;
    drawBoldText(line1Text, line1Y, fontSubSize);

    // Line 2: (道の駅名)
    const line2Text = params.name;
    drawBoldText(line2Text, line2Y, fontMainSize);

    // Line 3: (都道府県) (市町村)
    const line3Text = `${params.prefecture} ${params.municipality}`.trim();
    drawBoldText(line3Text, line3Y, fontSubSize);
  }

  /**
   * Core Main Post Drawing Logic:
   * - Canvas: 1.2x * 1.2x
   * - Image centered horizontally & vertically (margins = 0.1x)
   * - Background: RGB
   */
  function renderMainPostCanvas(canvas, imgObj, bgColor) {
    const x = imgObj.width;
    const canvasSize = Math.round(1.2 * x);

    canvas.width = canvasSize;
    canvas.height = canvasSize;

    const ctx = canvas.getContext('2d');

    // Fill background
    ctx.fillStyle = `rgb(${bgColor.r}, ${bgColor.g}, ${bgColor.b})`;
    ctx.fillRect(0, 0, canvasSize, canvasSize);

    // Center image
    const offset = Math.round(0.1 * x);
    ctx.drawImage(imgObj.imgElement, offset, offset, x, x);
  }

  // --- Batch ZIP Creation & Download ---
  downloadZipBtn.addEventListener('click', async () => {
    if (state.images.length === 0) return;

    downloadZipBtn.disabled = true;
    progressBarContainer.hidden = false;
    progressBarFill.style.width = '0%';
    downloadStatusText.textContent = '画像加工中... しばらくお待ちください';

    try {
      const zip = new JSZip();
      const usedFilenames = new Map();

      const thumbnailParams = {
        region: getSelectedRegion(),
        number: stationNumberInput.value.trim() || '01',
        name: stationNameInput.value.trim() || '道の駅名',
        prefecture: prefectureInput.value.trim() || '都道府県',
        municipality: municipalityInput.value.trim() || '市町村',
        bgColor: state.bgColor,
      };

      const offscreenCanvas = document.createElement('canvas');

      for (let i = 0; i < state.images.length; i++) {
        const imgObj = state.images[i];
        const isThumbnail = imgObj.id === state.selectedThumbnailId;

        // Render appropriate canvas
        if (isThumbnail) {
          renderThumbnailCanvas(offscreenCanvas, imgObj, thumbnailParams);
        } else {
          renderMainPostCanvas(offscreenCanvas, imgObj, state.bgColor);
        }

        // Deduplicate file name
        let base = imgObj.baseName;
        let count = usedFilenames.get(base) || 0;
        let finalFilename = '';
        if (count === 0) {
          finalFilename = `${base}_edited.png`;
        } else {
          finalFilename = `${base}_${count}_edited.png`;
        }
        usedFilenames.set(base, count + 1);

        // Convert canvas to blob & add to zip
        const blob = await new Promise((res) => offscreenCanvas.toBlob(res, 'image/png'));
        zip.file(finalFilename, blob);

        // Update progress
        const percent = Math.round(((i + 1) / state.images.length) * 80);
        progressBarFill.style.width = `${percent}%`;
        downloadStatusText.textContent = `加工中 (${i + 1} / ${state.images.length}枚)...`;
      }

      downloadStatusText.textContent = 'ZIPファイルを生成しています...';
      progressBarFill.style.width = '90%';

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      progressBarFill.style.width = '100%';

      // Trigger download
      const stationTag = (stationNameInput.value.trim() || 'michieki').replace(/[\s\/\\?%*:|"<>]/g, '_');
      const zipFileName = `michieki_${stationTag}_posts.zip`;

      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = zipFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);

      downloadStatusText.textContent = `🎉 ダウンロードが完了しました！（${zipFileName}）`;
    } catch (err) {
      console.error('Batch generation error:', err);
      alert('ZIPの生成中にエラーが発生しました。コンソールをご確認ください。');
      downloadStatusText.textContent = 'エラーが発生しました';
    } finally {
      downloadZipBtn.disabled = false;
      setTimeout(() => {
        progressBarContainer.hidden = true;
      }, 3000);
    }
  });

  // --- Custom Stations Modal ---
  openCustomStationsBtn.addEventListener('click', () => {
    renderCustomStationsModalList();
    customStationsModal.hidden = false;
  });

  closeCustomStationsModalBtn.addEventListener('click', () => {
    customStationsModal.hidden = true;
  });

  closeCustomStationsBtn2.addEventListener('click', () => {
    customStationsModal.hidden = true;
  });

  clearAllCustomStationsBtn.addEventListener('click', clearAllCustomStations);

  function renderCustomStationsModalList() {
    customStationsList.innerHTML = '';
    if (state.customStations.length === 0) {
      customStationsList.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: #94a3b8; font-size: 0.85rem;">
          手入力で学習された道の駅はまだありません。<br>
          フォームに新しい駅を入力して保存すると自動的にここに記録されます。
        </div>
      `;
      return;
    }

    state.customStations.forEach((s, idx) => {
      const row = document.createElement('div');
      row.className = 'custom-station-row';
      row.innerHTML = `
        <div>
          <div class="custom-station-title">${escapeHtml(s.name)}</div>
          <div class="custom-station-sub">${escapeHtml(s.region || '')} / ${escapeHtml(s.prefecture || '')} ${escapeHtml(s.municipality || '')}</div>
        </div>
        <button class="delete-station-btn" data-index="${idx}" title="削除">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      `;

      row.querySelector('.delete-station-btn').addEventListener('click', () => {
        deleteCustomStation(idx);
      });

      customStationsList.appendChild(row);
    });
  }

  // --- Utility ---
  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Run app
  init();
})();
