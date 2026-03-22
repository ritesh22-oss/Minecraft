const YEARS = ["2024", "2025", "2026"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const VALID_MIME = ["image/jpeg", "image/png"];
const CAPTION_LIMIT = 140;
/** localStorage key for persisted timeline (base64 images + captions) */
const STORAGE_KEY = "mc_memories_timeline_v1";

const loadingScreen = document.getElementById("loading-screen");
const mainContent = document.getElementById("main-content");
const loadingProgress = document.querySelector(".loading-progress");
const loadingText = document.getElementById("loading-text");
const backgroundMusic = document.getElementById("background-music");
const container = document.getElementById("timeline-container");
const toggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
const tabs = document.querySelectorAll(".timeline-tab");

const addPhotoBtn = document.getElementById("add-photo-btn");
const photoInput = document.getElementById("photo-input");
const photoModal = document.getElementById("photo-modal");
const closePhotoModalBtn = document.getElementById("close-photo-modal");
const cancelPhotoBtn = document.getElementById("cancel-photo-btn");
const photoPreview = document.getElementById("photo-preview");
const photoLoading = document.getElementById("photo-loading");
const photoYear = document.getElementById("photo-year");
const photoCaption = document.getElementById("photo-caption");
const savePhotoBtn = document.getElementById("save-photo-btn");
const photoError = document.getElementById("photo-error");

const loadingTips = [
  "Loading Minecraft Memories...",
  "Generating terrain...",
  "Mining diamonds...",
  "Building memories...",
  "Exploring caves..."
];

/** Default memories (file paths). Replaced by localStorage when present. */
const DEFAULT_TIMELINE = {
  "2024": [
    { id: "seed-2024-0", img: "home.png", caption: "Our First House - Jan 2024" }
  ],
  "2025": [
    { id: "seed-2025-0", img: "assets/images/castle.png", caption: "The Castle Project - Feb 2025" }
  ],
  "2026": []
};

/** Live data — hydrated from localStorage or defaults */
const timelineData = JSON.parse(JSON.stringify(DEFAULT_TIMELINE));

/** Pending upload: base64 data URL from FileReader (set after file pick, cleared on close/save) */
const addPhotoState = {
  pendingBase64: ""
};

let currentYear = "2024";

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function generateId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Ensure every entry has a stable id (for delete + localStorage round-trips).
 */
function ensureEntryIds() {
  YEARS.forEach((year) => {
    const list = timelineData[year];
    if (!Array.isArray(list)) return;
    list.forEach((entry, index) => {
      if (!entry.id) entry.id = `legacy-${year}-${index}-${generateId()}`;
    });
  });
}

/**
 * Load timeline from localStorage. Falls back to in-memory defaults if missing/invalid.
 */
function loadTimelineFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    YEARS.forEach((y) => {
      if (Array.isArray(parsed[y])) {
        timelineData[y] = parsed[y];
      }
    });
    ensureEntryIds();
  } catch (e) {
    console.warn("Could not load saved photos:", e);
  }
}

/**
 * Persist full timeline (all years) — images stored as base64 strings in JSON.
 */
function persistTimelineToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(timelineData));
  } catch (e) {
    console.error(e);
    alert("Could not save to storage. It may be full — try a smaller image.");
    throw e;
  }
}

function showError(message) {
  photoError.textContent = message;
  photoError.classList.remove("hidden");
}

function clearError() {
  photoError.textContent = "";
  photoError.classList.add("hidden");
}

function setPhotoLoading(isLoading) {
  photoLoading.classList.toggle("hidden", !isLoading);
}

function resetAddPhotoState() {
  addPhotoState.pendingBase64 = "";
  photoCaption.value = "";
  savePhotoBtn.disabled = true;
  photoPreview.classList.add("hidden");
  photoPreview.removeAttribute("src");
  clearError();
}

function populateYearOptions() {
  photoYear.innerHTML = "";
  YEARS.forEach((year) => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    photoYear.appendChild(option);
  });
  photoYear.value = currentYear;
}

/**
 * Read file as base64 data URL (requirement: FileReader).
 */
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("FileReader failed"));
    reader.readAsDataURL(file);
  });
}

function deletePhoto(year, id) {
  const list = timelineData[year];
  if (!list) return;
  const idx = list.findIndex((e) => e.id === id);
  if (idx < 0) return;
  if (!window.confirm("Delete this photo?")) return;
  list.splice(idx, 1);
  persistTimelineToStorage();
  renderTimeline(year);
}

function createEntry(entry, index, year) {
  const entryDiv = document.createElement("div");
  entryDiv.className = "timeline-entry";
  entryDiv.innerHTML = `
    <div class="timeline-entry-media">
      <img src="${entry.img}" alt="Memory ${index + 1}" />
      <button type="button" class="delete-photo-btn" data-photo-id="${entry.id}" title="Delete photo" aria-label="Delete photo">
        <i class="fa-solid fa-trash"></i>
      </button>
    </div>
    <p class="caption">${escapeHtml(entry.caption)}</p>
    <button type="button" class="like-btn"><i class="fa-solid fa-heart"></i></button>
  `;
  entryDiv.querySelector(".like-btn").addEventListener("click", (event) => {
    event.currentTarget.classList.toggle("liked");
  });
  entryDiv.querySelector(".delete-photo-btn").addEventListener("click", () => {
    deletePhoto(year, entry.id);
  });
  return entryDiv;
}

function renderTimeline(year) {
  currentYear = year;
  container.innerHTML = "";
  const items = timelineData[year] || [];
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "caption";
    empty.textContent = "No photos yet for this year. Add one!";
    container.appendChild(empty);
    return;
  }
  items.forEach((entry, index) => {
    container.appendChild(createEntry(entry, index, year));
  });
}

function setTheme(mode) {
  document.body.classList.remove("light", "dark");
  document.body.classList.add(mode);
  if (themeIcon) {
    themeIcon.className = mode === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
  localStorage.setItem("theme", mode);
}

function startLoadingAnimation() {
  if (backgroundMusic) {
    backgroundMusic.play().catch(() => {});
  }
  let progress = 0;
  const textInterval = setInterval(() => {
    loadingText.textContent = loadingTips[Math.floor(Math.random() * loadingTips.length)];
  }, 1200);
  const progressInterval = setInterval(() => {
    progress += 2.5;
    loadingProgress.style.width = `${Math.min(progress, 100)}%`;
    if (progress >= 100) {
      clearInterval(textInterval);
      clearInterval(progressInterval);
      loadingScreen.classList.add("fade-out");
      mainContent.classList.remove("hidden");
      setTimeout(() => {
        loadingScreen.style.display = "none";
      }, 1000);
    }
  }, 70);
}

function openModal() {
  photoModal.classList.remove("hidden");
}

function closeModal() {
  photoModal.classList.add("hidden");
  resetAddPhotoState();
}

function validateFile(file) {
  if (!file) return "No file selected.";
  if (!VALID_MIME.includes(file.type)) return "Only JPG and PNG are allowed.";
  if (file.size > MAX_SIZE_BYTES) return "File is too large. Max size is 5MB.";
  return "";
}

async function loadSelectedImage(file) {
  const errorMessage = validateFile(file);
  if (errorMessage) {
    showError(errorMessage);
    photoInput.value = "";
    return;
  }
  clearError();
  setPhotoLoading(true);
  savePhotoBtn.disabled = true;
  try {
    // Requirement: base64 via FileReader — show immediately in modal
    const dataUrl = await readFileAsDataURL(file);
    addPhotoState.pendingBase64 = dataUrl;
    photoPreview.src = dataUrl;
    photoPreview.classList.remove("hidden");
    savePhotoBtn.disabled = false;
    openModal();
  } catch {
    showError("Could not read this image. Try another one.");
    resetAddPhotoState();
  } finally {
    setPhotoLoading(false);
    photoInput.value = "";
  }
}

function savePhoto() {
  if (!addPhotoState.pendingBase64) {
    showError("No image loaded.");
    return;
  }
  setPhotoLoading(true);
  clearError();
  try {
    const year = photoYear.value;
    const caption = photoCaption.value.trim().slice(0, CAPTION_LIMIT);
    const safeCaption = caption || "Untitled memory";

    if (!timelineData[year]) timelineData[year] = [];
    timelineData[year].unshift({
      id: generateId(),
      img: addPhotoState.pendingBase64,
      caption: safeCaption
    });

    persistTimelineToStorage();

    const activeTab = document.querySelector(".timeline-tab.active");
    if (activeTab) activeTab.classList.remove("active");
    const targetTab = document.querySelector(`.timeline-tab[data-timeline="${year}"]`);
    if (targetTab) targetTab.classList.add("active");

    renderTimeline(year);
    closeModal();
  } catch {
    showError("Could not save this image. Try again.");
  } finally {
    setPhotoLoading(false);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadTimelineFromStorage();
  startLoadingAnimation();
  populateYearOptions();
  const savedTheme = localStorage.getItem("theme") || "light";
  setTheme(savedTheme);
  renderTimeline(currentYear);
});

toggle.addEventListener("click", () => {
  setTheme(document.body.classList.contains("light") ? "dark" : "light");
});

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    const active = document.querySelector(".timeline-tab.active");
    if (active) active.classList.remove("active");
    tab.classList.add("active");
    renderTimeline(tab.dataset.timeline);
  });
});

addPhotoBtn.addEventListener("click", () => photoInput.click());
photoInput.addEventListener("change", (event) => {
  const file = event.target.files && event.target.files[0];
  if (file) loadSelectedImage(file);
});

closePhotoModalBtn.addEventListener("click", closeModal);
cancelPhotoBtn.addEventListener("click", closeModal);
savePhotoBtn.addEventListener("click", savePhoto);

photoCaption.addEventListener("input", () => {
  if (photoCaption.value.length > CAPTION_LIMIT) {
    photoCaption.value = photoCaption.value.slice(0, CAPTION_LIMIT);
  }
});
