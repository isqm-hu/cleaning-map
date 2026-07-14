const REQUIRED_HEADERS = [
  "Dátum",
  "Felhasználó",
  "Szakmai csoport",
  "Esemény típusa",
  "Helység útvonal",
  "Helység neve",
];

const INKSCAPE_NS = "http://www.inkscape.org/namespaces/inkscape";
const DAY_MS = 24 * 60 * 60 * 1000;
const ACTIVE_WINDOW_MS = 15 * 60 * 1000;

const COLORS = {
  pending: "#eef4ea",
  pendingStroke: "#a6d735",
  morning: "#a6d735",
  evening: "#f2a23a",
  night: "#42a6ff",
  stale: "#8b938c",
  staleStroke: "#d4dbd2",
};

const DARK_COLORS = {
  morning: "#5f7d16",
  evening: "#a45c13",
  night: "#1265a6",
};

const TRANSLATIONS = window.ISQM_TRANSLATIONS || {};
const DEFAULT_LANGUAGE = "hu";
const LANGUAGE_LOCALES = {
  hu: "hu-HU",
  en: "en-US",
  de: "de-DE",
  cs: "cs-CZ",
  pl: "pl-PL",
};

const state = {
  svgLoaded: false,
  csvLoaded: false,
  maps: [],
  activeMapIndex: -1,
  csvFiles: [],
  svgName: "",
  csvName: "",
  svgEl: null,
  roomsLayer: null,
  roomElements: new Map(),
  roomDisplayById: new Map(),
  events: [],
  invalidRows: [],
  csvRoomIds: new Set(),
  csvDisplayById: new Map(),
  allUsers: [],
  selectedUsers: new Set(),
  roomMeta: new Map(),
  roomSearch: "",
  currentActiveByUser: new Map(),
  fullStartMs: null,
  fullEndMs: null,
  selectedDate: "",
  scope: "day",
  shiftMode: "three",
  timelineStartMs: null,
  timelineEndMs: null,
  currentMs: null,
  currentByRoom: new Map(),
  speed: 1,
  playing: false,
  rafId: null,
  lastFrameAt: null,
  zoom: 1,
  panMode: false,
  spacePressed: false,
  panSession: null,
  mapFocus: false,
  timelineCollapsed: false,
  staleEnabled: true,
  audioEnabled: false,
  audioContext: null,
  hoveredRoomId: null,
  language: getInitialLanguage(),
  status: { key: "waitingFiles", params: {}, isError: false },
};

const els = {
  svgInput: document.getElementById("svgInput"),
  csvInput: document.getElementById("csvInput"),
  svgFileName: document.getElementById("svgFileName"),
  csvFileName: document.getElementById("csvFileName"),
  mapSelect: document.getElementById("mapSelect"),
  mapPrevButton: document.getElementById("mapPrevButton"),
  mapNextButton: document.getElementById("mapNextButton"),
  focusMapSwitcher: document.getElementById("focusMapSwitcher"),
  focusMapSelect: document.getElementById("focusMapSelect"),
  focusMapPrevButton: document.getElementById("focusMapPrevButton"),
  focusMapNextButton: document.getElementById("focusMapNextButton"),
  timelineToggleButton: document.getElementById("timelineToggleButton"),
  languageSelect: document.getElementById("languageSelect"),
  svgRoomCount: document.getElementById("svgRoomCount"),
  csvRoomCount: document.getElementById("csvRoomCount"),
  matchCount: document.getElementById("matchCount"),
  activeRoomCount: document.getElementById("activeRoomCount"),
  statusBox: document.getElementById("statusBox"),
  periodLabel: document.getElementById("periodLabel"),
  clockLabel: document.getElementById("clockLabel"),
  mapViewport: document.getElementById("mapViewport"),
  mapCanvas: document.getElementById("mapCanvas"),
  roomTooltip: document.getElementById("roomTooltip"),
  timeSlider: document.getElementById("timeSlider"),
  timelineScale: document.getElementById("timelineScale"),
  playButton: document.getElementById("playButton"),
  playLabel: document.getElementById("playLabel"),
  restartButton: document.getElementById("restartButton"),
  dateInput: document.getElementById("dateInput"),
  customSpeed: document.getElementById("customSpeed"),
  roomSearch: document.getElementById("roomSearch"),
  clearSearchButton: document.getElementById("clearSearchButton"),
  searchSummary: document.getElementById("searchSummary"),
  searchResults: document.getElementById("searchResults"),
  userFilterList: document.getElementById("userFilterList"),
  userFilterSummary: document.getElementById("userFilterSummary"),
  selectAllUsersButton: document.getElementById("selectAllUsersButton"),
  clearUsersButton: document.getElementById("clearUsersButton"),
  legend: document.getElementById("legend"),
  eventList: document.getElementById("eventList"),
  zoomInButton: document.getElementById("zoomInButton"),
  zoomOutButton: document.getElementById("zoomOutButton"),
  fitButton: document.getElementById("fitButton"),
  focusButton: document.getElementById("focusButton"),
  panButton: document.getElementById("panButton"),
  mapTitle: document.getElementById("mapTitle"),
  currentDayLabel: document.getElementById("currentDayLabel"),
  audioToggle: document.getElementById("audioToggle"),
  staleToggle: document.getElementById("staleToggle"),
};

let dateTimeFormatter = createDateTimeFormatter();
let timeFormatter = createTimeFormatter();

els.svgInput.addEventListener("change", handleSvgFile);
els.csvInput.addEventListener("change", handleCsvFile);
els.mapSelect.addEventListener("change", () => setActiveMap(Number(els.mapSelect.value)));
els.mapPrevButton.addEventListener("click", () => stepMap(-1));
els.mapNextButton.addEventListener("click", () => stepMap(1));
els.focusMapSelect.addEventListener("change", () => setActiveMap(Number(els.focusMapSelect.value)));
els.focusMapPrevButton.addEventListener("click", () => stepMap(-1));
els.focusMapNextButton.addEventListener("click", () => stepMap(1));
els.timelineToggleButton.addEventListener("click", toggleTimelinePanel);
els.languageSelect.addEventListener("change", () => setLanguage(els.languageSelect.value));
els.timeSlider.addEventListener("input", handleSliderInput);
els.playButton.addEventListener("click", togglePlayback);
els.restartButton.addEventListener("click", restartTimeline);
els.dateInput.addEventListener("change", handleDateChange);
els.customSpeed.addEventListener("input", () => setSpeed(els.customSpeed.value));
els.zoomInButton.addEventListener("click", () => setZoom(state.zoom + 0.15));
els.zoomOutButton.addEventListener("click", () => setZoom(state.zoom - 0.15));
els.fitButton.addEventListener("click", () => setZoom(1));
els.focusButton.addEventListener("click", toggleMapFocus);
els.panButton.addEventListener("click", togglePanMode);
els.roomSearch.addEventListener("input", handleSearchInput);
els.clearSearchButton.addEventListener("click", clearSearch);
els.selectAllUsersButton.addEventListener("click", selectAllUsers);
els.clearUsersButton.addEventListener("click", clearUsers);
els.audioToggle.addEventListener("change", handleAudioToggle);
els.staleToggle.addEventListener("change", handleStaleToggle);
els.mapViewport.addEventListener("mousedown", startPan);
els.mapViewport.addEventListener("wheel", handleMapWheel, { passive: false });
window.addEventListener("mousemove", movePan);
window.addEventListener("mouseup", endPan);
window.addEventListener("keydown", handleKeyDown);
window.addEventListener("keyup", handleKeyUp);
document.addEventListener("fullscreenchange", handleFullscreenChange);

document.querySelectorAll("[data-scope]").forEach((button) => {
  button.addEventListener("click", () => setScope(button.dataset.scope));
});

document.querySelectorAll("[data-shift-mode]").forEach((button) => {
  button.addEventListener("click", () => setShiftMode(button.dataset.shiftMode));
});

document.querySelectorAll("[data-speed]").forEach((button) => {
  button.addEventListener("click", () => setSpeed(button.dataset.speed));
});

els.languageSelect.value = state.language;
applyTranslations();
setStatusKey("waitingFiles");
renderLegend();
updateMapSwitcher();
updateControls();
updateSourceLabels();
updateTimeLabels();
updateTimelineToggle();
renderCurrent();

function getInitialLanguage() {
  try {
    const saved = localStorage.getItem("isqm-cleaning-map-language");
    if (saved && TRANSLATIONS[saved]) return saved;
  } catch {
    // Local storage can be unavailable in some embedded browser contexts.
  }
  const browserLanguage = String(navigator.language || "").slice(0, 2).toLowerCase();
  return TRANSLATIONS[browserLanguage] ? browserLanguage : DEFAULT_LANGUAGE;
}

function getLocale() {
  return LANGUAGE_LOCALES[state.language] || LANGUAGE_LOCALES[DEFAULT_LANGUAGE];
}

function t(key, params = {}) {
  const dictionary = TRANSLATIONS[state.language] || TRANSLATIONS[DEFAULT_LANGUAGE] || {};
  const fallback = TRANSLATIONS[DEFAULT_LANGUAGE] || {};
  const template = dictionary[key] ?? fallback[key] ?? key;
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

function applyTranslations() {
  document.documentElement.lang = state.language;
  document.title = t("documentTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-title]").forEach((node) => {
    node.title = t(node.dataset.i18nTitle);
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((node) => {
    node.setAttribute("placeholder", t(node.dataset.i18nPlaceholder));
  });

  [...els.languageSelect.options].forEach((option) => {
    option.textContent = option.value.toUpperCase();
    option.title = TRANSLATIONS[option.value]?.languageName || option.value.toUpperCase();
  });
}

function setLanguage(language) {
  if (!TRANSLATIONS[language]) return;
  state.language = language;
  try {
    localStorage.setItem("isqm-cleaning-map-language", language);
  } catch {
    // Best-effort preference persistence.
  }

  dateTimeFormatter = createDateTimeFormatter();
  timeFormatter = createTimeFormatter();
  applyTranslations();
  if (state.svgLoaded && state.csvLoaded) {
    updateJoinStatus();
  } else {
    setStatusFromState();
  }
  updatePlayButton();
  updateSourceLabels();
  updateMapSwitcher();
  updateTimelineToggle();
  updateUserFilterSummary();
  renderLegend();
  renderCurrent();
  updateTimeLabels();
}

function createDateTimeFormatter() {
  return new Intl.DateTimeFormat(getLocale(), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function createTimeFormatter() {
  return new Intl.DateTimeFormat(getLocale(), {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function handleSvgFile(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;

  try {
    stopPlayback();
    const loadedMaps = [];
    const errors = [];

    for (const file of files) {
      try {
        const text = await file.text();
        loadedMaps.push(parseSvgMap(text, file.name));
      } catch (error) {
        errors.push({ name: file.name, message: error.message });
      }
    }

    if (!loadedMaps.length) {
      throw new Error(errors[0]?.message || t("badSvg"));
    }

    state.maps = loadedMaps;
    state.svgLoaded = true;
    setActiveMap(0, { skipRender: true });

    if (errors.length) {
      setStatusKey("svgLoadedWithErrors", { count: loadedMaps.length, errors: errors.length }, true);
    } else if (loadedMaps.length === 1) {
      setStatusKey("svgLoaded", { name: loadedMaps[0].name });
    } else {
      setStatusKey("svgLoadedMulti", { count: loadedMaps.length });
    }
  } catch (error) {
    resetSvgState();
    els.svgFileName.textContent = t("badSvg");
    setStatusText(error.message, true);
  } finally {
    updateJoinStatus();
    updateControls();
    renderCurrent();
  }
}

async function handleCsvFile(event) {
  const files = [...(event.target.files || [])];
  if (!files.length) return;

  try {
    stopPlayback();
    const parsedFiles = [];
    const errors = [];

    for (const file of files) {
      try {
        const text = await file.text();
        parsedFiles.push(parseCsvFile(text, file.name));
      } catch (error) {
        errors.push({ name: file.name, message: error.message });
      }
    }

    if (!parsedFiles.length) {
      throw new Error(errors[0]?.message || t("badCsv"));
    }

    loadCsvPayloads(parsedFiles);

    if (errors.length) {
      setStatusKey("csvLoadedWithErrors", { count: parsedFiles.length, errors: errors.length }, true);
    } else if (parsedFiles.length === 1) {
      setStatusKey("csvLoaded", { name: parsedFiles[0].name });
    } else {
      setStatusKey("csvLoadedMulti", { count: parsedFiles.length, events: state.events.length });
    }
  } catch (error) {
    resetCsvState();
    els.csvFileName.textContent = t("badCsv");
    setStatusText(error.message, true);
  } finally {
    updateJoinStatus();
    updateControls();
    renderCurrent();
  }
}

function loadSvg(text, fileName) {
  state.maps = [parseSvgMap(text, fileName)];
  state.svgLoaded = true;
  setActiveMap(0, { skipRender: true });
}

function parseSvgMap(text, fileName) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(text, "image/svg+xml");
  const parserError = parsed.querySelector("parsererror");

  if (parserError) {
    throw new Error(t("svgXmlError"));
  }

  const sourceSvg = parsed.documentElement;
  if (!sourceSvg || sourceSvg.nodeName.toLowerCase() !== "svg") {
    throw new Error(t("svgDocError"));
  }

  sanitizeSvg(sourceSvg);
  const svg = document.importNode(sourceSvg, true);
  const roomsLayer = findRoomsLayer(svg);

  if (!roomsLayer) {
    throw new Error(t("noRoomsLayer"));
  }

  const roomElements = collectRoomElements(roomsLayer);
  if (!roomElements.size) {
    throw new Error(t("noRoomIds"));
  }

  const map = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: fileName,
    svg,
    roomsLayer,
    roomElements,
    roomDisplayById: buildRoomDisplayMap(roomElements),
    zoom: 1,
  };

  prepareSvgRoomStyles(map);
  return map;
}

function setActiveMap(index, options = {}) {
  if (!state.maps.length) {
    resetSvgState();
    return;
  }

  const requestedIndex = Number.isFinite(index) ? index : 0;
  const nextIndex = clamp(requestedIndex, 0, state.maps.length - 1);
  const map = state.maps[nextIndex];
  state.activeMapIndex = nextIndex;
  state.svgLoaded = true;
  state.svgName = map.name;
  state.svgEl = map.svg;
  state.roomsLayer = map.roomsLayer;
  state.roomElements = map.roomElements;
  state.roomDisplayById = map.roomDisplayById;
  state.zoom = map.zoom || 1;

  els.mapCanvas.innerHTML = "";
  els.mapCanvas.append(map.svg);

  updateSourceLabels();
  updateMapSwitcher();
  setZoom(state.zoom);
  window.setTimeout(() => {
    els.mapViewport.scrollLeft = 0;
    els.mapViewport.scrollTop = 0;
  }, 0);

  if (!options.skipRender) {
    updateJoinStatus();
    updateControls();
    renderCurrent();
  }
}

function stepMap(direction) {
  if (state.maps.length < 2) return;
  const nextIndex = (state.activeMapIndex + direction + state.maps.length) % state.maps.length;
  setActiveMap(nextIndex);
}

function resetSvgState() {
  state.svgLoaded = false;
  state.maps = [];
  state.activeMapIndex = -1;
  state.svgName = "";
  state.svgEl = null;
  state.roomsLayer = null;
  state.roomElements = new Map();
  state.roomDisplayById = new Map();
  state.zoom = 1;
  els.svgRoomCount.textContent = "0";
  renderEmptyMap();
  updateSourceLabels();
  updateMapSwitcher();
}

function renderEmptyMap() {
  els.mapCanvas.innerHTML = "";
  const empty = document.createElement("div");
  const title = document.createElement("strong");
  const detail = document.createElement("span");
  empty.className = "empty-state";
  title.dataset.i18n = "emptyMapTitle";
  detail.dataset.i18n = "emptyMapText";
  title.textContent = t("emptyMapTitle");
  detail.textContent = t("emptyMapText");
  empty.append(title, detail);
  els.mapCanvas.append(empty);
}

function updateMapSwitcher() {
  renderMapSelectOptions(els.mapSelect);
  renderMapSelectOptions(els.focusMapSelect);

  const hasMaps = state.maps.length > 0;
  const hasMultipleMaps = state.maps.length > 1;
  els.mapSelect.disabled = !hasMaps;
  els.focusMapSelect.disabled = !hasMaps;
  els.mapPrevButton.disabled = !hasMultipleMaps;
  els.mapNextButton.disabled = !hasMultipleMaps;
  els.focusMapPrevButton.disabled = !hasMultipleMaps;
  els.focusMapNextButton.disabled = !hasMultipleMaps;
}

function renderMapSelectOptions(select) {
  select.innerHTML = "";

  if (!state.maps.length) {
    const option = document.createElement("option");
    option.value = "-1";
    option.textContent = t("noMapOption");
    select.append(option);
  } else {
    state.maps.forEach((map, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${index + 1}. ${map.name}`;
      select.append(option);
    });
    select.value = String(state.activeMapIndex);
  }
}

function updateSourceLabels() {
  if (!state.maps.length) {
    els.svgFileName.textContent = t("none");
  } else if (state.maps.length === 1) {
    els.svgFileName.textContent = state.maps[0].name;
  } else {
    els.svgFileName.textContent = `${t("mapCount", { count: state.maps.length })} · ${state.svgName}`;
  }

  if (!state.csvFiles.length) {
    els.csvFileName.textContent = t("none");
  } else if (state.csvFiles.length === 1) {
    els.csvFileName.textContent = state.csvFiles[0];
  } else {
    els.csvFileName.textContent = `${t("csvCount", { count: state.csvFiles.length })} · ${t("eventCount", { count: state.events.length })}`;
  }

  if (els.mapTitle) els.mapTitle.textContent = state.svgName || t("noMapOption");
}

function sanitizeSvg(svg) {
  svg.querySelectorAll("script, foreignObject, iframe, object, embed").forEach((node) => node.remove());

  const walker = document.createTreeWalker(svg, NodeFilter.SHOW_ELEMENT);
  let node = walker.currentNode;
  while (node) {
    [...node.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on") || ((name === "href" || name.endsWith(":href")) && value.startsWith("javascript:"))) {
        node.removeAttribute(attr.name);
      }
    });
    node = walker.nextNode();
  }
}

function findRoomsLayer(svg) {
  return [...svg.querySelectorAll("g, svg")].find((node) => {
    const label = getInkscapeLabel(node);
    return label === "_rooms" || node.id === "_rooms" || node.getAttribute("data-layer") === "_rooms";
  });
}

function collectRoomElements(layer) {
  const roomElements = new Map();
  const shapes = layer.querySelectorAll("path, rect, polygon, polyline, circle, ellipse, line");

  shapes.forEach((shape) => {
    const displayId = findRoomIdForShape(shape, layer);
    if (!displayId) return;

    const normalized = normalizeRoomId(displayId);
    if (!normalized) return;

    shape.dataset.roomId = normalized;
    shape.dataset.roomLabel = displayId;

    if (!roomElements.has(normalized)) {
      roomElements.set(normalized, []);
    }
    roomElements.get(normalized).push(shape);
  });

  return roomElements;
}

function findRoomIdForShape(shape, layer) {
  let node = shape;
  while (node && node !== layer.parentElement) {
    if (node !== layer) {
      const candidate = readRoomId(node);
      if (candidate) return candidate;
    }
    if (node === layer) break;
    node = node.parentElement;
  }
  return null;
}

function readRoomId(node) {
  const directAttributes = [
    "room_id",
    "room-id",
    "data-room-id",
    "data-room_id",
    "data-roomid",
  ];

  for (const name of directAttributes) {
    const value = cleanRoomId(node.getAttribute(name), "direct");
    if (value) return value;
  }

  const label = cleanRoomId(getInkscapeLabel(node) || node.getAttribute("label"), "label");
  if (label) return label;

  const id = cleanRoomId(node.getAttribute("id"), "id");
  if (id) return id;

  return null;
}

function getInkscapeLabel(node) {
  return node.getAttribute("inkscape:label") || node.getAttributeNS(INKSCAPE_NS, "label");
}

function cleanRoomId(value, source) {
  if (!value) return null;

  let clean = String(value).trim();
  const bracketMatch = clean.match(/^\[([^\]]+)\]/);
  if (bracketMatch) clean = bracketMatch[1].trim();

  if (!clean || clean === "_rooms") return null;
  if (source === "id") clean = clean.replace(/^h(?=\d)/i, "");
  if ((source === "id" || source === "label") && !looksLikeRoomId(clean)) return null;

  return clean;
}

function looksLikeRoomId(value) {
  return /\d/.test(value) && !/^(path|rect|circle|ellipse|line|polyline|polygon|g|layer)\d*$/i.test(value);
}

function normalizeRoomId(value) {
  const clean = cleanRoomId(value, "direct");
  return clean ? canonicalizeRoomId(clean.replace(/^h(?=\d)/i, "")) : "";
}

function canonicalizeRoomId(value) {
  return String(value)
    .trim()
    .toLocaleLowerCase("hu-HU")
    .replace(/([0-9])[/_ ]([a-z])$/i, "$1$2");
}

function buildRoomDisplayMap(roomElements) {
  const labels = new Map();
  roomElements.forEach((elements, roomId) => {
    labels.set(roomId, elements[0]?.dataset.roomLabel || roomId);
  });
  return labels;
}

function prepareSvgRoomStyles(map) {
  map.roomElements.forEach((elements, roomId) => {
    elements.forEach((shape) => {
      shape.classList.add("isqm-room");
      shape.style.opacity = "1";
      shape.style.fill = COLORS.pending;
      shape.style.fillOpacity = "0.035";
      shape.style.stroke = COLORS.pendingStroke;
      shape.style.strokeOpacity = "0.32";
      shape.style.strokeWidth = shape.style.strokeWidth || "0.55";
      shape.style.vectorEffect = "non-scaling-stroke";
      shape.style.pointerEvents = "auto";

      shape.addEventListener("mouseenter", (event) => showRoomTooltip(roomId, event));
      shape.addEventListener("mousemove", (event) => positionTooltip(event));
      shape.addEventListener("mouseleave", hideRoomTooltip);
    });
  });
}

function loadCsv(text, fileName) {
  loadCsvPayloads([parseCsvFile(text, fileName)]);
}

function parseCsvFile(text, fileName) {
  const delimiter = detectDelimiter(text);
  const rows = parseDelimited(text, delimiter);
  if (!rows.length) {
    throw new Error(t("emptyCsv"));
  }

  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  const headerIndex = new Map(headers.map((header, index) => [header, index]));
  const missingHeaders = REQUIRED_HEADERS.filter((header) => !headerIndex.has(header));

  if (missingHeaders.length) {
    throw new Error(t("missingCsvHeader", { headers: missingHeaders.join(", ") }));
  }

  const events = [];
  const invalidRows = [];

  rows.slice(1).forEach((cells, index) => {
    if (cells.every((cell) => !String(cell).trim())) return;

    const rowNumber = index + 2;
    const dateText = getCell(cells, headerIndex, "Dátum");
    const roomText = getCell(cells, headerIndex, "Helység neve");
    const date = parseCsvDate(dateText);
    const roomIdRaw = extractRoomId(roomText);
    const roomId = normalizeRoomId(roomIdRaw);

    if (!date || !roomId) {
      invalidRows.push(rowNumber);
      return;
    }

    events.push({
      rowNumber,
      timeMs: date.getTime(),
      dateText,
      roomId,
      roomLabel: roomIdRaw,
      roomName: roomText,
      user: getCell(cells, headerIndex, "Felhasználó") || t("unknown"),
      group: getCell(cells, headerIndex, "Szakmai csoport"),
      eventType: getCell(cells, headerIndex, "Esemény típusa"),
      roomPath: getCell(cells, headerIndex, "Helység útvonal"),
      sourceFile: fileName,
    });
  });

  if (!events.length) {
    throw new Error(t("noCsvEvents"));
  }

  events.sort((a, b) => a.timeMs - b.timeMs);

  return { name: fileName, events, invalidRows };
}

function loadCsvPayloads(payloads) {
  const seen = new Set();
  const events = [];
  const invalidRows = [];

  payloads.forEach((payload) => {
    payload.invalidRows.forEach((rowNumber) => invalidRows.push({ fileName: payload.name, rowNumber }));
    payload.events.forEach((event) => {
      const key = [event.timeMs, event.roomId, event.user, event.eventType, event.roomName].join("\u001f");
      if (seen.has(key)) return;
      seen.add(key);
      events.push(event);
    });
  });

  if (!events.length) {
    throw new Error(t("noCsvEvents"));
  }

  events.sort((a, b) => a.timeMs - b.timeMs);

  state.csvLoaded = true;
  state.csvFiles = payloads.map((payload) => payload.name);
  state.csvName = state.csvFiles.length === 1 ? state.csvFiles[0] : t("csvCount", { count: state.csvFiles.length });
  state.events = events;
  state.invalidRows = invalidRows;
  state.csvRoomIds = new Set(events.map((event) => event.roomId));
  state.csvDisplayById = new Map();
  state.roomMeta = buildRoomMeta(events);
  state.allUsers = [...new Set(events.map((event) => event.user))].sort((a, b) => a.localeCompare(b, getLocale()));
  state.selectedUsers = new Set(state.allUsers);
  events.forEach((event) => {
    if (!state.csvDisplayById.has(event.roomId)) {
      state.csvDisplayById.set(event.roomId, event.roomLabel);
    }
  });

  const firstEvent = events[0];
  const lastEvent = events[events.length - 1];
  state.fullStartMs = getServiceDayStart(firstEvent.timeMs);
  state.fullEndMs = getServiceDayStart(lastEvent.timeMs) + DAY_MS;
  state.selectedDate = formatDateKey(state.fullStartMs);

  updateSourceLabels();
  els.csvRoomCount.textContent = String(state.csvRoomIds.size);
  els.dateInput.min = formatDateKey(state.fullStartMs);
  els.dateInput.max = formatDateKey(state.fullEndMs - DAY_MS);
  els.dateInput.value = state.selectedDate;

  renderUserFilters();
  updateTimelineBounds(true);
}

function resetCsvState() {
  state.csvLoaded = false;
  state.csvFiles = [];
  state.csvName = "";
  state.events = [];
  state.invalidRows = [];
  state.csvRoomIds = new Set();
  state.csvDisplayById = new Map();
  state.allUsers = [];
  state.selectedUsers = new Set();
  state.roomMeta = new Map();
  state.currentActiveByUser = new Map();
  state.fullStartMs = null;
  state.fullEndMs = null;
  state.selectedDate = "";
  state.timelineStartMs = null;
  state.timelineEndMs = null;
  state.currentMs = null;
  state.currentByRoom = new Map();
  els.csvRoomCount.textContent = "0";
  els.matchCount.textContent = "0";
  els.activeRoomCount.textContent = "0";
  els.eventList.innerHTML = "";
  els.userFilterList.innerHTML = "";
  updateSourceLabels();
  updateUserFilterSummary();
  updateTimelineBounds(true);
}

function buildRoomMeta(events) {
  const meta = new Map();

  events.forEach((event) => {
    if (!meta.has(event.roomId)) {
      meta.set(event.roomId, {
        labels: new Set(),
        names: new Set(),
        paths: new Set(),
      });
    }

    const entry = meta.get(event.roomId);
    entry.labels.add(event.roomLabel);
    entry.names.add(stripRoomPrefix(event.roomName));
    if (event.roomPath) entry.paths.add(event.roomPath);
  });

  return meta;
}

function detectDelimiter(text) {
  const firstLine = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] || "";
  const candidates = [";", "\t", ","];
  return candidates
    .map((delimiter) => ({
      delimiter,
      count: firstLine.split(delimiter).length - 1,
    }))
    .sort((a, b) => b.count - a.count)[0].delimiter;
}

function parseDelimited(text, delimiter) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (!inQuotes && (char === "\n" || char === "\r")) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);

  return rows.filter((cells, index) => index === 0 || cells.some((value) => String(value).trim() !== ""));
}

function getCell(cells, headerIndex, header) {
  const index = headerIndex.get(header);
  return index === undefined ? "" : String(cells[index] ?? "").trim();
}

function parseCsvDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const iso = text.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:?\d{2})?$/
  );

  if (iso) {
    const [, year, month, day, hour, minute, second = "0", millis = "0", zone] = iso;
    if (zone) {
      const parsed = new Date(text);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }
    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(millis.padEnd(3, "0"))
    );
  }

  const fallback = new Date(text);
  return Number.isNaN(fallback.getTime()) ? null : fallback;
}

function extractRoomId(roomName) {
  const match = String(roomName || "").match(/\[([^\]]+)\]/);
  return match ? match[1].trim() : "";
}

function setScope(scope) {
  state.scope = scope;
  document.querySelectorAll("[data-scope]").forEach((button) => {
    const active = button.dataset.scope === scope;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  updateTimelineBounds(true);
  updateControls();
  renderCurrent();
}

function setShiftMode(mode) {
  state.shiftMode = mode;
  document.querySelectorAll("[data-shift-mode]").forEach((button) => {
    const active = button.dataset.shiftMode === mode;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderLegend();
  renderCurrent();
}

function setSpeed(value) {
  const parsed = Number(value);
  state.speed = Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  els.customSpeed.value = String(state.speed);

  document.querySelectorAll("[data-speed]").forEach((button) => {
    const active = Number(button.dataset.speed) === state.speed;
    button.classList.toggle("is-active", active);
  });
}

function handleDateChange() {
  if (!els.dateInput.value) return;
  state.selectedDate = els.dateInput.value;
  if (state.scope !== "day") setScope("day");
  updateTimelineBounds(true);
  renderCurrent();
}

function updateTimelineBounds(resetCurrent = false) {
  if (!state.csvLoaded) {
    state.timelineStartMs = null;
    state.timelineEndMs = null;
    state.currentMs = null;
    els.timeSlider.min = "0";
    els.timeSlider.max = "0";
    els.timeSlider.value = "0";
    renderTimelineScale();
    return;
  }

  if (state.scope === "period") {
    state.timelineStartMs = state.fullStartMs;
    state.timelineEndMs = state.fullEndMs;
  } else {
    const selected = state.selectedDate || formatDateKey(state.fullStartMs);
    state.timelineStartMs = getServiceDayStartFromKey(selected);
    state.timelineEndMs = state.timelineStartMs + DAY_MS;
  }

  const maxSeconds = Math.max(0, Math.round((state.timelineEndMs - state.timelineStartMs) / 1000));
  els.timeSlider.min = "0";
  els.timeSlider.max = String(maxSeconds);

  if (
    resetCurrent ||
    state.currentMs === null ||
    state.currentMs < state.timelineStartMs ||
    state.currentMs > state.timelineEndMs
  ) {
    state.currentMs = state.timelineStartMs;
  }

  syncSliderToTime();
  updateTimeLabels();
  renderTimelineScale();
}

function handleSliderInput() {
  if (!state.csvLoaded || state.timelineStartMs === null) return;
  const seconds = Number(els.timeSlider.value);
  setCurrentTime(state.timelineStartMs + seconds * 1000);
}

function setCurrentTime(timeMs) {
  if (state.timelineStartMs === null || state.timelineEndMs === null) return;
  state.currentMs = clamp(timeMs, state.timelineStartMs, state.timelineEndMs);
  syncSliderToTime();
  renderCurrent();
}

function syncSliderToTime() {
  if (state.timelineStartMs === null || state.currentMs === null) return;
  els.timeSlider.value = String(Math.round((state.currentMs - state.timelineStartMs) / 1000));
}

function togglePlayback() {
  if (state.playing) {
    stopPlayback();
  } else {
    startPlayback();
  }
}

function startPlayback() {
  if (!state.csvLoaded || state.timelineStartMs === null || state.timelineEndMs === null) return;
  if (state.currentMs >= state.timelineEndMs) setCurrentTime(state.timelineStartMs);

  state.playing = true;
  state.lastFrameAt = null;
  updatePlayButton();
  state.rafId = requestAnimationFrame(playbackFrame);
}

function stopPlayback() {
  state.playing = false;
  state.lastFrameAt = null;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  state.rafId = null;
  updatePlayButton();
}

function playbackFrame(timestamp) {
  if (!state.playing) return;

  if (state.lastFrameAt === null) {
    state.lastFrameAt = timestamp;
  }

  const deltaSeconds = (timestamp - state.lastFrameAt) / 1000;
  state.lastFrameAt = timestamp;
  const previousTime = state.currentMs;
  const nextTime = state.currentMs + deltaSeconds * 1000 * state.speed;
  pingEventsBetween(previousTime, nextTime);
  setCurrentTime(nextTime);

  if (state.currentMs >= state.timelineEndMs) {
    stopPlayback();
    return;
  }

  state.rafId = requestAnimationFrame(playbackFrame);
}

function restartTimeline() {
  if (!state.csvLoaded || state.timelineStartMs === null) return;
  setCurrentTime(state.timelineStartMs);
}

function updatePlayButton() {
  els.playButton.classList.toggle("is-playing", state.playing);
  els.playLabel.textContent = state.playing ? t("pause") : t("play");
}

function handleAudioToggle() {
  state.audioEnabled = els.audioToggle.checked;
  if (state.audioEnabled) {
    ensureAudioContext();
  }
}

function handleStaleToggle() {
  state.staleEnabled = els.staleToggle.checked;
  renderLegend();
  renderCurrent();
}

function ensureAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!state.audioContext) state.audioContext = new AudioContextClass();
  if (state.audioContext.state === "suspended") state.audioContext.resume();
  return state.audioContext;
}

function pingEventsBetween(startMs, endMs) {
  if (!state.audioEnabled || !state.playing || !state.csvLoaded) return;
  if (endMs <= startMs) return;

  const hasEvent = state.events.some(
    (event) =>
      event.timeMs > startMs &&
      event.timeMs <= endMs &&
      event.timeMs >= state.timelineStartMs &&
      event.timeMs <= state.timelineEndMs &&
      isUserAllowed(event)
  );

  if (hasEvent) playPing();
}

function playPing() {
  const context = ensureAudioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const now = context.currentTime;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, now);
  oscillator.frequency.exponentialRampToValueAtTime(1320, now + 0.035);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.08, now + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.12);
}

function renderCurrent() {
  if (!state.svgLoaded) {
    if (!state.csvLoaded || state.currentMs === null) {
      state.currentByRoom = new Map();
      state.currentActiveByUser = new Map();
      els.activeRoomCount.textContent = "0";
      els.eventList.innerHTML = "";
    }
    applySearchState();
    updateTimeLabels();
    return;
  }

  clearRooms();

  if (!state.csvLoaded || state.currentMs === null) {
    state.currentByRoom = new Map();
    state.currentActiveByUser = new Map();
    els.activeRoomCount.textContent = "0";
    els.eventList.innerHTML = "";
    applySearchState();
    updateTimeLabels();
    return;
  }

  const dayStart = getServiceDayStart(state.currentMs);
  const latestByRoom = new Map();
  const countByRoom = new Map();
  const lastByRoom = new Map();
  const activeByUser = new Map();
  const activeEvents = [];

  for (const event of state.events) {
    if (event.timeMs > state.currentMs) break;
    if (!isUserAllowed(event)) continue;
    lastByRoom.set(event.roomId, event);
    if (event.timeMs >= dayStart) {
      latestByRoom.set(event.roomId, event);
      countByRoom.set(event.roomId, (countByRoom.get(event.roomId) || 0) + 1);
      activeEvents.push(event);
      if (state.currentMs - event.timeMs <= ACTIVE_WINDOW_MS) {
        activeByUser.set(event.user, event);
      }
    }
  }

  state.currentByRoom = latestByRoom;
  state.currentActiveByUser = activeByUser;
  let matchedActive = 0;

  if (state.staleEnabled) {
    state.roomElements.forEach((elements, roomId) => {
      const lastEvent = lastByRoom.get(roomId);
      const ageMs = lastEvent ? state.currentMs - lastEvent.timeMs : Infinity;
      if (ageMs >= DAY_MS) {
        paintStaleRoom(elements, getStaleLevel(ageMs));
      }
    });
  }

  latestByRoom.forEach((event, roomId) => {
    const elements = state.roomElements.get(roomId);
    if (!elements) return;
    matchedActive += 1;
    paintRoom(elements, getEventColor(event), true, countByRoom.get(roomId) || 1);
  });

  activeByUser.forEach((event) => {
    const elements = state.roomElements.get(event.roomId);
    if (!elements) return;
    paintActiveRoom(elements, event, countByRoom.get(event.roomId) || 1);
  });

  els.activeRoomCount.textContent = String(matchedActive);
  renderEventList(activeEvents.slice(-6).reverse());
  applySearchState();
  updateTimeLabels();
}

function clearRooms() {
  state.roomElements.forEach((elements) => {
    paintRoom(elements, COLORS.pending, false);
  });
}

function paintRoom(elements, color, active, count = 1) {
  const fillOpacity = active ? getCompletionOpacity(count) : 0.035;

  elements.forEach((shape) => {
    shape.style.fill = color;
    shape.style.fillOpacity = String(fillOpacity);
    shape.style.stroke = active ? color : COLORS.pendingStroke;
    shape.style.strokeOpacity = active ? "0.95" : "0.32";
    shape.style.strokeWidth = active ? String(clamp(0.7 + count * 0.16, 0.9, 1.65)) : "0.55";
  });
}

function paintStaleRoom(elements, level) {
  const fillOpacity = clamp(0.26 + level * 0.18, 0.44, 0.96);
  const strokeOpacity = clamp(0.42 + level * 0.12, 0.56, 1);
  const strokeWidth = clamp(0.62 + level * 0.18, 0.8, 1.7);

  elements.forEach((shape) => {
    shape.style.fill = COLORS.stale;
    shape.style.fillOpacity = String(fillOpacity);
    shape.style.stroke = COLORS.staleStroke;
    shape.style.strokeOpacity = String(strokeOpacity);
    shape.style.strokeWidth = String(strokeWidth);
  });
}

function getCompletionOpacity(count) {
  return clamp(0.28 + count * 0.24, 0.52, 0.98);
}

function getStaleLevel(ageMs) {
  if (!Number.isFinite(ageMs)) return 4;
  return Math.max(1, Math.floor(ageMs / DAY_MS));
}

function paintActiveRoom(elements, event, count = 1) {
  const darkColor = getEventDarkColor(event);
  const baseColor = getEventColor(event);
  const opacity = clamp(getCompletionOpacity(count) + 0.08, 0.82, 1);

  elements.forEach((shape) => {
    shape.style.fill = baseColor;
    shape.style.fillOpacity = String(opacity);
    shape.style.stroke = darkColor;
    shape.style.strokeOpacity = "1";
    shape.style.strokeWidth = "2.4";
  });
}

function getEventColor(event) {
  if (state.shiftMode === "one") return COLORS.morning;

  const hour = new Date(event.timeMs).getHours();
  if (hour >= 6 && hour < 14) return COLORS.morning;
  if (hour >= 14 && hour < 22) return COLORS.evening;
  return COLORS.night;
}

function getEventDarkColor(event) {
  if (state.shiftMode === "one") return DARK_COLORS.morning;

  const hour = new Date(event.timeMs).getHours();
  if (hour >= 6 && hour < 14) return DARK_COLORS.morning;
  if (hour >= 14 && hour < 22) return DARK_COLORS.evening;
  return DARK_COLORS.night;
}

function getShiftName(event) {
  if (state.shiftMode === "one") return t("oneShiftName");
  const hour = new Date(event.timeMs).getHours();
  if (hour >= 6 && hour < 14) return t("morning");
  if (hour >= 14 && hour < 22) return t("afternoon");
  return t("night");
}

function renderEventList(events) {
  els.eventList.innerHTML = "";
  events.forEach((event) => {
    const item = document.createElement("li");
    const button = document.createElement("button");
    item.style.borderLeftColor = getEventColor(event);

    const title = document.createElement("strong");
    title.textContent = `[${event.roomLabel}] ${stripRoomPrefix(event.roomName)}`;

    const detail = document.createElement("span");
    detail.textContent = `${formatTime(event.timeMs)} · ${event.user || t("unknown")} · ${getShiftName(event)}`;

    button.type = "button";
    const mapIndex = findMapIndexForRoom(event.roomId);
    button.disabled = mapIndex === -1;
    button.title = mapIndex !== -1 ? t("openRoomTitle") : t("missingRoomTitle");
    button.addEventListener("click", () => openRoomOnMap(event.roomId));
    button.append(title, detail);
    item.append(button);
    els.eventList.append(item);
  });
}

function isUserAllowed(event) {
  if (!state.allUsers.length) return true;
  return state.selectedUsers.has(event.user);
}

function renderUserFilters() {
  els.userFilterList.innerHTML = "";

  state.allUsers.forEach((user) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    const text = document.createElement("span");

    input.type = "checkbox";
    input.value = user;
    input.checked = state.selectedUsers.has(user);
    input.addEventListener("change", () => {
      if (input.checked) {
        state.selectedUsers.add(user);
      } else {
        state.selectedUsers.delete(user);
      }
      updateUserFilterSummary();
      renderCurrent();
    });

    text.textContent = user;
    label.append(input, text);
    els.userFilterList.append(label);
  });

  updateUserFilterSummary();
}

function updateUserFilterSummary() {
  if (!state.allUsers.length) {
    els.userFilterSummary.textContent = t("usersAfterCsv");
    return;
  }

  const selectedCount = state.selectedUsers.size;
  if (selectedCount === state.allUsers.length) {
    els.userFilterSummary.textContent = t("allUsersVisible", { count: selectedCount });
  } else if (selectedCount === 0) {
    els.userFilterSummary.textContent = t("noSelectedUsers");
  } else {
    els.userFilterSummary.textContent = t("selectedUsers", { selected: selectedCount, total: state.allUsers.length });
  }
}

function selectAllUsers() {
  state.selectedUsers = new Set(state.allUsers);
  renderUserFilters();
  renderCurrent();
}

function clearUsers() {
  state.selectedUsers = new Set();
  renderUserFilters();
  renderCurrent();
}

function handleSearchInput() {
  state.roomSearch = els.roomSearch.value;
  renderCurrent();
}

function clearSearch() {
  state.roomSearch = "";
  els.roomSearch.value = "";
  renderCurrent();
}

function getRoomSearchMatches() {
  const query = foldSearchText(state.roomSearch);
  if (!query) return null;

  const mapRoomIds = state.maps.flatMap((map) => [...map.roomElements.keys()]);
  const roomIds = new Set([...mapRoomIds, ...state.roomMeta.keys()]);
  const matches = new Set();

  roomIds.forEach((roomId) => {
    const meta = state.roomMeta.get(roomId);
    const display = getRoomLabel(roomId);
    const haystack = [
      roomId,
      display,
      ...(meta ? [...meta.labels, ...meta.names, ...meta.paths] : []),
    ]
      .map(foldSearchText)
      .join(" ");

    if (haystack.includes(query)) {
      matches.add(roomId);
    }
  });

  return matches;
}

function applySearchState() {
  const matches = getRoomSearchMatches();

  if (!matches) {
    els.searchSummary.textContent = t("noActiveSearch");
    renderSearchResults(null);
    return;
  }

  let svgMatchCount = 0;
  state.roomElements.forEach((elements, roomId) => {
    const isMatch = matches.has(roomId);
    const isActive = state.currentByRoom.has(roomId);
    if (isMatch) svgMatchCount += 1;

    elements.forEach((shape) => {
      if (isMatch) {
        shape.style.stroke = "#ffffff";
        shape.style.strokeOpacity = "1";
        shape.style.strokeWidth = "1.25";
        if (!isActive) shape.style.fillOpacity = "0.2";
      } else {
        shape.style.strokeOpacity = "0.12";
        shape.style.fillOpacity = isActive ? "0.18" : "0.012";
      }
    });
  });

  els.searchSummary.textContent = t("searchSummary", { svg: svgMatchCount, data: matches.size });
  renderSearchResults(matches);
}

function renderSearchResults(matches) {
  els.searchResults.innerHTML = "";
  if (!matches) return;

  const sorted = [...matches].sort((a, b) => getRoomLabel(a).localeCompare(getRoomLabel(b), getLocale()));
  sorted.slice(0, 20).forEach((roomId) => {
    const row = document.createElement("div");
    const text = document.createElement("div");
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    const button = document.createElement("button");
    const glyph = document.createElement("span");
    const meta = state.roomMeta.get(roomId);
    const names = meta ? [...meta.names].filter(Boolean) : [];
    const mapIndex = findMapIndexForRoom(roomId);
    const mapName = mapIndex >= 0 ? state.maps[mapIndex].name : "";

    row.className = "search-result";
    title.textContent = `[${getRoomLabel(roomId)}]`;
    detail.textContent = names[0] || (mapIndex >= 0 ? t("svgMatch") : t("csvOnly"));
    if (mapName && mapIndex !== state.activeMapIndex) {
      detail.textContent = `${detail.textContent} · ${mapName}`;
    }
    button.className = "tool-action";
    button.type = "button";
    button.disabled = mapIndex === -1;
    button.title = t("centerRoom");
    button.setAttribute("aria-label", t("centerRoomAria", { room: getRoomLabel(roomId) }));
    button.addEventListener("click", () => openRoomOnMap(roomId));
    glyph.className = "target-glyph";
    glyph.setAttribute("aria-hidden", "true");

    button.append(glyph);
    text.append(title, detail);
    row.append(text, button);
    els.searchResults.append(row);
  });

  if (sorted.length > 20) {
    const note = document.createElement("div");
    note.className = "compact-note";
    note.textContent = t("moreSearchResults", { count: sorted.length - 20 });
    els.searchResults.append(note);
  }
}

function getRoomLabel(roomId) {
  if (state.roomDisplayById.has(roomId)) return state.roomDisplayById.get(roomId);

  const mapWithRoom = state.maps.find((map) => map.roomDisplayById.has(roomId));
  return mapWithRoom?.roomDisplayById.get(roomId) || state.csvDisplayById.get(roomId) || roomId;
}

function findMapIndexForRoom(roomId) {
  return state.maps.findIndex((map) => map.roomElements.has(roomId));
}

function openRoomOnMap(roomId) {
  const mapIndex = state.roomElements.has(roomId) ? state.activeMapIndex : findMapIndexForRoom(roomId);
  if (mapIndex === -1) return;

  if (mapIndex !== state.activeMapIndex) {
    setActiveMap(mapIndex);
    window.setTimeout(() => centerRoom(roomId), 80);
    return;
  }

  centerRoom(roomId);
}

function centerRoom(roomId) {
  const elements = state.roomElements.get(roomId);
  if (!elements?.length) return;

  const rect = getElementsRect(elements);
  if (!rect.width || !rect.height) return;

  const viewportRect = els.mapViewport.getBoundingClientRect();
  const widthScale = (viewportRect.width * 0.5) / rect.width;
  const heightScale = (viewportRect.height * 0.5) / rect.height;
  const nextZoom = clamp(state.zoom * Math.min(widthScale, heightScale), 1, 8);

  setZoom(nextZoom);
  window.setTimeout(() => {
    centerElementsInViewport(elements);
  }, 60);
}

function centerElementsInViewport(elements) {
  const rect = getElementsRect(elements);
  const viewportRect = els.mapViewport.getBoundingClientRect();
  const elementCenterX = rect.left + rect.width / 2;
  const elementCenterY = rect.top + rect.height / 2;
  const viewportCenterX = viewportRect.left + viewportRect.width / 2;
  const viewportCenterY = viewportRect.top + viewportRect.height / 2;

  els.mapViewport.scrollLeft += elementCenterX - viewportCenterX;
  els.mapViewport.scrollTop += elementCenterY - viewportCenterY;
}

function getElementsRect(elements) {
  const bounds = elements.reduce(
    (acc, element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: Math.min(acc.left, rect.left),
        top: Math.min(acc.top, rect.top),
        right: Math.max(acc.right, rect.right),
        bottom: Math.max(acc.bottom, rect.bottom),
      };
    },
    { left: Infinity, top: Infinity, right: -Infinity, bottom: -Infinity }
  );

  return {
    ...bounds,
    width: Math.max(0, bounds.right - bounds.left),
    height: Math.max(0, bounds.bottom - bounds.top),
  };
}

function foldSearchText(value) {
  return String(value || "")
    .toLocaleLowerCase("hu-HU")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function renderLegend() {
  els.legend.innerHTML = "";
  const items =
    state.shiftMode === "one"
      ? [{ label: "06:00-06:00", className: "swatch-morning" }]
      : [
          { label: "06:00-14:00", className: "swatch-morning" },
          { label: "14:00-22:00", className: "swatch-evening" },
          { label: "22:00-06:00", className: "swatch-night" },
        ];

  if (state.staleEnabled) {
    items.push(
      { label: t("stale24"), className: "swatch-stale-light" },
      { label: t("stale48"), className: "swatch-stale-strong" }
    );
  }

  items.forEach((item) => {
    const row = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = `swatch ${item.className}`;
    row.append(swatch, item.label);
    els.legend.append(row);
  });
}

function updateJoinStatus() {
  els.svgRoomCount.textContent = String(state.roomElements.size);
  els.csvRoomCount.textContent = String(state.csvRoomIds.size);

  if (!state.svgLoaded || !state.csvLoaded) {
    els.matchCount.textContent = "0";
    return;
  }

  const matched = [...state.csvRoomIds].filter((roomId) => state.roomElements.has(roomId));
  const unmatched = [...state.csvRoomIds].filter((roomId) => !state.roomElements.has(roomId));
  els.matchCount.textContent = `${matched.length}/${state.csvRoomIds.size}`;

  const invalidText = state.invalidRows.length ? ` ${t("invalidCsvRows", { count: state.invalidRows.length })}` : "";
  const unmatchedText = unmatched.length
    ? ` ${t("unmatchedRooms", {
        rooms: unmatched
        .slice(0, 8)
        .map((roomId) => state.csvDisplayById.get(roomId) || roomId)
        .join(", ") + (unmatched.length > 8 ? "..." : ""),
      })}`
    : ` ${t("allRoomsMatched")}`;

  setStatusText(`${t("readyPrefix")} ${t("matchedRooms", { matched: matched.length, total: state.csvRoomIds.size })}${unmatchedText}${invalidText}`);
}

function updateControls() {
  const hasCsv = state.csvLoaded;
  const hasSvg = state.svgLoaded;
  els.timeSlider.disabled = !hasCsv;
  els.playButton.disabled = !hasCsv;
  els.restartButton.disabled = !hasCsv;
  els.dateInput.disabled = !hasCsv || state.scope === "period";
  els.zoomInButton.disabled = !hasSvg;
  els.zoomOutButton.disabled = !hasSvg;
  els.fitButton.disabled = !hasSvg;
  els.focusButton.disabled = !hasSvg;
  els.panButton.disabled = !hasSvg;
  updateMapSwitcher();
  els.selectAllUsersButton.disabled = !hasCsv;
  els.clearUsersButton.disabled = !hasCsv;
  if (!hasSvg && state.panMode) state.panMode = false;
  if (!hasSvg && state.mapFocus) setMapFocus(false);
  updatePanMode();
}

function updateTimeLabels() {
  if (!state.csvLoaded || state.timelineStartMs === null || state.currentMs === null) {
    els.periodLabel.textContent = t("noDataLoaded");
    els.clockLabel.textContent = "--:--:--";
    if (els.currentDayLabel) els.currentDayLabel.textContent = "--";
    return;
  }

  const start = formatDateTime(state.timelineStartMs);
  const end = formatDateTime(state.timelineEndMs);
  const currentDay = formatDateKey(getServiceDayStart(state.currentMs));

  els.periodLabel.textContent = `${start} - ${end}`;
  els.clockLabel.textContent = formatDateTime(state.currentMs);
  if (els.currentDayLabel) els.currentDayLabel.textContent = t("currentDayStatus", { day: currentDay });
}

function renderTimelineScale() {
  if (!els.timelineScale) return;
  els.timelineScale.innerHTML = "";

  if (!state.csvLoaded || state.timelineStartMs === null || state.timelineEndMs === null) return;

  const duration = state.timelineEndMs - state.timelineStartMs;
  if (duration <= 0) return;

  const addMark = (timeMs, className, label = "") => {
    if (timeMs < state.timelineStartMs || timeMs > state.timelineEndMs) return;

    const mark = document.createElement("i");
    mark.className = `time-mark ${className}`;
    mark.style.left = `${((timeMs - state.timelineStartMs) / duration) * 100}%`;

    if (label) {
      const text = document.createElement("span");
      text.textContent = label;
      mark.append(text);
    }

    els.timelineScale.append(mark);
  };

  if (state.scope === "day") {
    for (let minute = 0; minute <= 24 * 60; minute += 15) {
      const timeMs = state.timelineStartMs + minute * 60 * 1000;
      const date = new Date(timeMs);
      const isHour = minute % 60 === 0;
      const isHalf = minute % 30 === 0;
      const label = isHour ? `${String(date.getHours()).padStart(2, "0")}` : "";
      addMark(timeMs, isHour ? "is-major" : isHalf ? "is-minor" : "is-micro", label);
    }
    return;
  }

  for (let dayStart = state.timelineStartMs; dayStart <= state.timelineEndMs; dayStart += DAY_MS) {
    addMark(dayStart, "is-major", formatShortDate(dayStart));
    addMark(dayStart + 8 * 60 * 60 * 1000, "is-minor");
    addMark(dayStart + 16 * 60 * 60 * 1000, "is-minor");
  }
}

function showRoomTooltip(roomId, event) {
  state.hoveredRoomId = roomId;
  setRoomHover(roomId, true);

  const currentEvent = state.currentByRoom.get(roomId);
  const label = state.roomDisplayById.get(roomId) || roomId;
  const meta = state.roomMeta.get(roomId);
  const knownName = meta ? [...meta.names].find(Boolean) : "";
  const name = currentEvent ? stripRoomPrefix(currentEvent.roomName) : knownName;
  const status = currentEvent
    ? `${formatDateTime(currentEvent.timeMs)} · ${currentEvent.user || t("unknown")} · ${getShiftName(currentEvent)}`
    : t("noCompletedTask");
  const activeUsers = [...state.currentActiveByUser.entries()]
    .filter(([, activeEvent]) => activeEvent.roomId === roomId)
    .map(([user]) => user);

  els.roomTooltip.innerHTML = "";
  const title = document.createElement("strong");
  title.textContent = name ? `[${label}] ${name}` : `[${label}]`;
  const detail = document.createElement("span");
  detail.textContent = activeUsers.length ? `${status} · ${t("activeUsers", { users: activeUsers.join(", ") })}` : status;
  els.roomTooltip.append(title, detail);
  els.roomTooltip.hidden = false;
  positionTooltip(event);
}

function positionTooltip(event) {
  if (els.roomTooltip.hidden) return;
  const offset = 14;
  const tooltipRect = els.roomTooltip.getBoundingClientRect();
  let left = event.clientX + offset;
  let top = event.clientY + offset;

  if (left + tooltipRect.width > window.innerWidth - 10) {
    left = event.clientX - tooltipRect.width - offset;
  }
  if (top + tooltipRect.height > window.innerHeight - 10) {
    top = event.clientY - tooltipRect.height - offset;
  }

  els.roomTooltip.style.left = `${Math.max(10, left)}px`;
  els.roomTooltip.style.top = `${Math.max(10, top)}px`;
}

function hideRoomTooltip() {
  if (state.hoveredRoomId) setRoomHover(state.hoveredRoomId, false);
  state.hoveredRoomId = null;
  els.roomTooltip.hidden = true;
}

function setRoomHover(roomId, active) {
  const elements = state.roomElements.get(roomId) || [];
  elements.forEach((shape) => shape.classList.toggle("is-hover", active));
}

function setZoom(value) {
  state.zoom = clamp(value, 0.4, 8);
  if (state.maps[state.activeMapIndex]) {
    state.maps[state.activeMapIndex].zoom = state.zoom;
  }
  if (state.svgEl) {
    state.svgEl.style.width = `${state.zoom * 100}%`;
  }
}

function setZoomAtPoint(value, clientX, clientY) {
  if (!state.svgEl) {
    setZoom(value);
    return;
  }

  const oldRect = state.svgEl.getBoundingClientRect();
  const relativeX = oldRect.width ? (clientX - oldRect.left) / oldRect.width : 0.5;
  const relativeY = oldRect.height ? (clientY - oldRect.top) / oldRect.height : 0.5;

  setZoom(value);

  const newRect = state.svgEl.getBoundingClientRect();
  const newClientX = newRect.left + newRect.width * relativeX;
  const newClientY = newRect.top + newRect.height * relativeY;
  els.mapViewport.scrollLeft += newClientX - clientX;
  els.mapViewport.scrollTop += newClientY - clientY;
}

async function toggleMapFocus() {
  await setMapFocus(!state.mapFocus);
}

async function setMapFocus(active) {
  state.mapFocus = active;
  document.body.classList.toggle("map-focus", active);
  els.focusButton.classList.toggle("is-active", active);
  els.focusButton.setAttribute("aria-pressed", String(active));
  updateTimelineToggle();

  if (active) {
    try {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browser may deny fullscreen from file/in-app context; CSS focus mode still works.
    }
    return;
  }

  if (document.fullscreenElement && document.exitFullscreen) {
    try {
      await document.exitFullscreen();
    } catch {
      // Ignore fullscreen exit failures; CSS mode is already disabled.
    }
  }
}

function toggleTimelinePanel() {
  state.timelineCollapsed = !state.timelineCollapsed;
  updateTimelineToggle();
}

function updateTimelineToggle() {
  document.body.classList.toggle("timeline-collapsed", state.timelineCollapsed);
  els.timelineToggleButton.setAttribute("aria-pressed", String(state.timelineCollapsed));
  const label = state.timelineCollapsed ? t("showTimeline") : t("hideTimeline");
  els.timelineToggleButton.title = label;
  els.timelineToggleButton.setAttribute("aria-label", label);
}

function handleFullscreenChange() {
  if (!document.fullscreenElement && state.mapFocus) {
    state.mapFocus = false;
    document.body.classList.remove("map-focus");
    els.focusButton.classList.remove("is-active");
    els.focusButton.setAttribute("aria-pressed", "false");
  }
}

function handleMapWheel(event) {
  if (!event.ctrlKey || !state.svgLoaded) return;

  event.preventDefault();
  const factor = Math.exp(-event.deltaY * 0.0015);
  setZoomAtPoint(state.zoom * factor, event.clientX, event.clientY);
}

function togglePanMode() {
  state.panMode = !state.panMode;
  updatePanMode();
}

function updatePanMode() {
  if (!state.svgLoaded) state.panMode = false;
  els.panButton.classList.toggle("is-active", state.panMode);
  els.panButton.setAttribute("aria-pressed", String(state.panMode));
  els.mapViewport.classList.toggle("is-pan-mode", state.panMode || state.spacePressed);
  els.mapViewport.classList.toggle("is-space-pan", state.spacePressed);
}

function startPan(event) {
  if ((!state.panMode && !state.spacePressed) || !state.svgLoaded || event.button !== 0) return;

  state.panSession = {
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: els.mapViewport.scrollLeft,
    scrollTop: els.mapViewport.scrollTop,
  };
  els.mapViewport.classList.add("is-panning");
  hideRoomTooltip();
  event.preventDefault();
}

function movePan(event) {
  if (!state.panSession) return;

  const deltaX = event.clientX - state.panSession.startX;
  const deltaY = event.clientY - state.panSession.startY;
  els.mapViewport.scrollLeft = state.panSession.scrollLeft - deltaX;
  els.mapViewport.scrollTop = state.panSession.scrollTop - deltaY;
}

function endPan() {
  if (!state.panSession) return;
  state.panSession = null;
  els.mapViewport.classList.remove("is-panning");
}

function handleKeyDown(event) {
  if (event.code === "Escape" && state.mapFocus) {
    setMapFocus(false);
    return;
  }

  if (event.code !== "Space" || isEditableTarget(event.target)) return;
  if (!state.spacePressed) {
    state.spacePressed = true;
    updatePanMode();
  }
  event.preventDefault();
}

function handleKeyUp(event) {
  if (event.code !== "Space") return;
  state.spacePressed = false;
  updatePanMode();
  if (state.panSession) endPan();
}

function isEditableTarget(target) {
  if (!target) return false;
  const tagName = target.tagName?.toLowerCase();
  return tagName === "input" || tagName === "textarea" || tagName === "select" || target.isContentEditable;
}

function getServiceDayStart(timeMs) {
  const date = new Date(timeMs);
  date.setHours(6, 0, 0, 0);
  if (timeMs < date.getTime()) date.setDate(date.getDate() - 1);
  return date.getTime();
}

function getServiceDayStartFromKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day, 6, 0, 0, 0).getTime();
}

function formatDateKey(timeMs) {
  const date = new Date(timeMs);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(timeMs) {
  return dateTimeFormatter.format(new Date(timeMs));
}

function formatTime(timeMs) {
  return timeFormatter.format(new Date(timeMs));
}

function formatShortDate(timeMs) {
  const date = new Date(timeMs);
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, "0")}`;
}

function stripRoomPrefix(roomName) {
  return String(roomName || "").replace(/^\[[^\]]+\]\s*/, "");
}

function setStatusText(message, isError = false) {
  state.status = { key: null, params: { message }, isError };
  els.statusBox.textContent = message;
  els.statusBox.classList.toggle("is-error", isError);
}

function setStatusKey(key, params = {}, isError = false) {
  state.status = { key, params, isError };
  setStatusFromState();
}

function setStatusFromState() {
  const status = state.status || { key: "waitingFiles", params: {}, isError: false };
  els.statusBox.textContent = status.key ? t(status.key, status.params) : status.params.message || "";
  els.statusBox.classList.toggle("is-error", Boolean(status.isError));
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
