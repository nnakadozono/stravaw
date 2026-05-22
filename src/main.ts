import "./style.css";

type Sport = "run" | "swim" | "bike" | "other";

type SportTotals = Record<Sport, { seconds: number; distanceMeters: number }>;

type DayMap = Record<string, SportTotals>;

type MonthSummary = Record<
  string,
  Record<Exclude<Sport, "other">, { distanceMeters: number }>
>;

type WorkoutData = {
  generatedAt: string;
  days: DayMap;
  months: MonthSummary;
};

type ThemeName =
  | "May"
  | "Neon"
  | "Apple"
  | "Cyberpunk"
  | "Muted";

type SportTheme = {
  colors: [string, string, string, string];
  cardBackground: string;
  cardBorder: string;
};

const SPORTS: Sport[] = ["run", "swim", "bike", "other"];
const KPI_SPORTS: Exclude<Sport, "other">[] = ["run", "swim", "bike"];
const EXPORT_CELL = 18;
const EXPORT_GAP = 6;
const EXPORT_PADDING = 28;
const EXPORT_LABEL_WIDTH = 74;
const EXPORT_MONTH_HEIGHT = 66;
const EXPORT_FOOTER_HEIGHT = 64;
const THEMES: Record<ThemeName, Record<Sport, SportTheme>> = {
  May: {
    run: {
      colors: ["#d8f5ad", "#a8e06f", "#67c15d", "#3d8b52"],
      cardBackground: "rgb(168 224 111 / 0.14)",
      cardBorder: "rgb(168 224 111 / 0.24)",
    },
    swim: {
      colors: ["#c9f1ff", "#8edfff", "#56b7e6", "#347ea8"],
      cardBackground: "rgb(142 223 255 / 0.14)",
      cardBorder: "rgb(142 223 255 / 0.24)",
    },
    bike: {
      colors: ["#ffd7cf", "#ffab97", "#ea7864", "#b04f42"],
      cardBackground: "rgb(255 171 151 / 0.15)",
      cardBorder: "rgb(255 171 151 / 0.26)",
    },
    other: {
      colors: ["#d8deda", "#b4beb8", "#88948d", "#5f6a64"],
      cardBackground: "rgb(180 190 184 / 0.14)",
      cardBorder: "rgb(180 190 184 / 0.24)",
    },
  },
  Neon: {
    run: {
      colors: ["#8CF0C6", "#3DD9A1", "#1FA97A", "#116B50"],
      cardBackground: "rgb(61 217 161 / 0.14)",
      cardBorder: "rgb(61 217 161 / 0.24)",
    },
    swim: {
      colors: ["#9BE7FF", "#55D6FF", "#1CA7D8", "#126A8C"],
      cardBackground: "rgb(85 214 255 / 0.14)",
      cardBorder: "rgb(85 214 255 / 0.24)",
    },
    bike: {
      colors: ["#FFE08A", "#FFC247", "#D18A1D", "#8A5610"],
      cardBackground: "rgb(255 194 71 / 0.14)",
      cardBorder: "rgb(255 194 71 / 0.24)",
    },
    other: {
      colors: ["#AEB8B5", "#7F8A87", "#59615F", "#39403E"],
      cardBackground: "rgb(127 138 135 / 0.14)",
      cardBorder: "rgb(127 138 135 / 0.24)",
    },
  },
  Apple: {
    run: {
      colors: ["#B8FF6A", "#8DFF2F", "#5FD400", "#347A00"],
      cardBackground: "rgb(141 255 47 / 0.14)",
      cardBorder: "rgb(141 255 47 / 0.24)",
    },
    swim: {
      colors: ["#7EE7FF", "#35C8FF", "#008ED1", "#005B87"],
      cardBackground: "rgb(53 200 255 / 0.14)",
      cardBorder: "rgb(53 200 255 / 0.24)",
    },
    bike: {
      colors: ["#FFB55E", "#FF8A1F", "#D96A00", "#8A4300"],
      cardBackground: "rgb(255 138 31 / 0.14)",
      cardBorder: "rgb(255 138 31 / 0.24)",
    },
    other: {
      colors: ["#C8D0CF", "#8C9593", "#5F6664", "#3C4240"],
      cardBackground: "rgb(140 149 147 / 0.14)",
      cardBorder: "rgb(140 149 147 / 0.24)",
    },
  },
  Cyberpunk: {
    run: {
      colors: ["#6EFFB8", "#00E676", "#00B85C", "#007A3D"],
      cardBackground: "rgb(0 230 118 / 0.14)",
      cardBorder: "rgb(0 230 118 / 0.24)",
    },
    swim: {
      colors: ["#7AF2FF", "#00D9FF", "#0099CC", "#005F80"],
      cardBackground: "rgb(0 217 255 / 0.14)",
      cardBorder: "rgb(0 217 255 / 0.24)",
    },
    bike: {
      colors: ["#FFD86E", "#FFB300", "#D68C00", "#8C5A00"],
      cardBackground: "rgb(255 179 0 / 0.14)",
      cardBorder: "rgb(255 179 0 / 0.24)",
    },
    other: {
      colors: ["#9EA7A4", "#707876", "#4D5452", "#2D3231"],
      cardBackground: "rgb(112 120 118 / 0.14)",
      cardBorder: "rgb(112 120 118 / 0.24)",
    },
  },
  Muted: {
    run: {
      colors: ["#B7D9C5", "#7FB596", "#4F8B69", "#2E5B45"],
      cardBackground: "rgb(127 181 150 / 0.14)",
      cardBorder: "rgb(127 181 150 / 0.24)",
    },
    swim: {
      colors: ["#BDD7E6", "#7FAEC7", "#4B7F9F", "#2A526B"],
      cardBackground: "rgb(127 174 199 / 0.14)",
      cardBorder: "rgb(127 174 199 / 0.24)",
    },
    bike: {
      colors: ["#DCC7A1", "#B8945F", "#8A673B", "#5A4223"],
      cardBackground: "rgb(184 148 95 / 0.14)",
      cardBorder: "rgb(184 148 95 / 0.24)",
    },
    other: {
      colors: ["#B8BDBA", "#8A908D", "#626866", "#3F4442"],
      cardBackground: "rgb(138 144 141 / 0.14)",
      cardBorder: "rgb(138 144 141 / 0.24)",
    },
  },
};
let activeTheme: ThemeName = "May";

const SPORT_THRESHOLDS_MINUTES: Record<Sport, [number, number, number, number, number]> = {
  run: [0, 40, 60, 80, 100],
  swim: [0, 40, 50, 60, 70],
  bike: [0, 60, 90, 120, 150],
  other: [0, 40, 60, 80, 100],
};

const SPORT_LABELS: Record<Sport, string> = {
  run: "Run",
  swim: "Swim",
  bike: "Bike",
  other: "Other",
};
const DEFAULT_THEME: ThemeName = "May";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

const appRoot = app;
activeTheme = themeFromUrl();

load().catch((error: unknown) => {
  appRoot.innerHTML = `<div class="shell"><div class="error">Failed to load workout data.</div></div>`;
  console.error(error);
});

async function load(): Promise<void> {
  const response = await fetchWorkoutData();
  const data = (await response.json()) as WorkoutData;
  render(data);
}

async function fetchWorkoutData(): Promise<Response> {
  const response = await fetch("/data.json", { cache: "no-store" });
  if (!response.ok) {
    const sampleResponse = await fetch("/sample-data.json", { cache: "no-store" });
    if (sampleResponse.ok) {
      return sampleResponse;
    }
    throw new Error(`data.json returned ${response.status}`);
  }
  return response;
}

function render(data: WorkoutData): void {
  const today = formatDateKey(new Date());
  const weeks = buildWeeks(data.days, today);
  appRoot.replaceChildren(buildShell(data, weeks, today));
}

function buildShell(data: WorkoutData, weeks: string[][], today: string): HTMLElement {
  const shell = el("section", "shell");
  let selectedDate = "";
  let detail: HTMLElement | null = null;
  const calendar = el("section", "calendar");
  const detailSlot = el("section", "detail-slot");
  const kpi = buildKpis(data);

  const renderSelection = (nextDate: string): void => {
    selectedDate = selectedDate === nextDate ? "" : nextDate;
    calendar.classList.toggle("has-selection", selectedDate !== "");

    for (const day of calendar.querySelectorAll<HTMLButtonElement>(".day")) {
      const isSelected = day.dataset.date === selectedDate;
      day.classList.toggle("is-selected", isSelected);
      day.setAttribute("aria-pressed", String(isSelected));
    }

    detail = selectedDate ? buildDetail(selectedDate, data.days[selectedDate], () => renderSelection(selectedDate)) : null;
    detailSlot.replaceChildren(...(detail ? [detail] : []));
  };

  calendar.append(buildCalendarHeader());

  for (const week of weeks) {
    const weekRow = el("div", "week");
    weekRow.dataset.month = monthKeyForWeek(week);
    weekRow.append(el("div", "month-label", monthLabelForWeek(week)));
    for (const date of week) {
      if (date > today) {
        weekRow.append(el("div", "future-day"));
      } else {
        weekRow.append(buildDayButton(date, data.days[date], renderSelection));
      }
    }
    calendar.append(weekRow);
  }

  attachKpiScrollSync(kpi, calendar, data);
  shell.append(
    buildHeader(
      data.generatedAt,
      () => shareWorkoutImage(data, weeks, today),
      () => downloadWorkoutImage(data, weeks, today),
    ),
    kpi,
    calendar,
    buildCalendarActions(data),
    detailSlot,
  );
  return shell;
}

function buildHeader(
  generatedAt: string,
  onShare: () => Promise<void>,
  onDownload: () => Promise<void>,
): HTMLElement {
  const topbar = el("header", "topbar");
  const titleWrap = el("div");
  titleWrap.append(el("h1", undefined, "Stravaw"));
  const actions = el("div", "topbar-actions");
  const buttons = el("div", "topbar-buttons");
  buttons.append(
    buildIconButton("Share image", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m0-12 4 4m-4-4-4 4M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>`, onShare),
    buildIconButton("Download image", `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v11m0 0 4-4m-4 4-4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>`, onDownload),
  );
  actions.append(buttons, el("div", "updated", `Updated ${formatDateTime(generatedAt)}`));
  topbar.append(titleWrap, actions);
  return topbar;
}

function buildIconButton(label: string, icon: string, onClick: () => Promise<void>): HTMLButtonElement {
  const button = el("button", "icon-button") as HTMLButtonElement;
  button.type = "button";
  button.ariaLabel = label;
  button.title = label;
  button.innerHTML = icon;
  button.addEventListener("click", () => {
    void onClick().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error(error);
    });
  });
  return button;
}

function buildKpis(data: WorkoutData): HTMLElement {
  const currentMonth = latestMonthKey(data);
  const kpi = el("section", "kpi");
  kpi.tabIndex = 0;
  kpi.setAttribute("role", "button");
  kpi.setAttribute("aria-expanded", "false");
  kpi.setAttribute("aria-label", "Monthly KPI history");
  kpi.addEventListener("click", () => toggleKpiHistory(kpi));
  kpi.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleKpiHistory(kpi);
    }
  });

  const monthCard = el("article", "kpi-month");
  monthCard.append(
    el("div", "kpi-label", ""),
    el("div", "kpi-value", "Month"),
    buildKpiMonthHistory(data),
  );
  kpi.append(monthCard);

  for (const sport of KPI_SPORTS) {
    const card = el("article", "kpi-card");
    applySportCardTheme(card, sport);
    card.append(
      el("div", "kpi-label", SPORT_LABELS[sport].toUpperCase()),
      el("div", "kpi-value", "0.0km"),
      buildKpiHistory(data, sport),
    );
    kpi.append(card);
  }

  updateKpis(kpi, data, currentMonth);
  return kpi;
}

function buildKpiMonthHistory(data: WorkoutData): HTMLElement {
  const history = el("div", "kpi-history");
  const months = Object.keys(data.months).sort().reverse();
  for (const monthKey of months) {
    const row = el("div", "kpi-history-row kpi-history-month-row", formatMonthYearShort(monthKey));
    history.append(row);
  }
  return history;
}

function buildKpiHistory(data: WorkoutData, sport: Exclude<Sport, "other">): HTMLElement {
  const history = el("div", "kpi-history");
  const months = Object.keys(data.months).sort().reverse();
  for (const monthKey of months) {
    const row = el("div", "kpi-history-row");
    row.append(el("strong", undefined, formatKpiDistance(data.months[monthKey]?.[sport]?.distanceMeters ?? 0)));
    history.append(row);
  }
  return history;
}

function toggleKpiHistory(kpi: HTMLElement): void {
  const isExpanded = !kpi.classList.contains("is-expanded");
  kpi.classList.toggle("is-expanded", isExpanded);
  kpi.setAttribute("aria-expanded", String(isExpanded));
}

function buildCalendarActions(data: WorkoutData): HTMLElement {
  const actions = el("div", "calendar-actions");
  const dataLink = el("a", "data-link", "data.json") as HTMLAnchorElement;
  dataLink.href = "/data.json";
  dataLink.download = "data.json";
  actions.append(dataLink, buildThemePicker(data));
  return actions;
}

function buildThemePicker(data: WorkoutData): HTMLElement {
  const wrap = el("label", "theme-picker");
  wrap.append(el("span", undefined, "Theme"));
  const select = el("select") as HTMLSelectElement;
  for (const themeName of Object.keys(THEMES) as ThemeName[]) {
    const option = el("option") as HTMLOptionElement;
    option.value = themeName;
    option.textContent = themeName;
    option.selected = themeName === activeTheme;
    select.append(option);
  }
  select.addEventListener("change", () => {
    activeTheme = select.value as ThemeName;
    updateThemeUrl(activeTheme);
    render(data);
  });
  wrap.append(select);
  return wrap;
}

function themeFromUrl(): ThemeName {
  return parseThemeName(new URLSearchParams(window.location.search).get("theme")) ?? DEFAULT_THEME;
}

function parseThemeName(value: string | null): ThemeName | null {
  if (!value) return null;
  return (Object.keys(THEMES) as ThemeName[]).find((themeName) => themeName.toLowerCase() === value.toLowerCase()) ?? null;
}

function updateThemeUrl(themeName: ThemeName): void {
  const url = new URL(window.location.href);
  if (themeName === DEFAULT_THEME) {
    url.searchParams.delete("theme");
  } else {
    url.searchParams.set("theme", themeName);
  }
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
}

function applySportCardTheme(card: HTMLElement, sport: Sport): void {
  const theme = THEMES[activeTheme][sport];
  card.style.background = theme.cardBackground;
  card.style.borderColor = theme.cardBorder;
}

function attachKpiScrollSync(kpi: HTMLElement, calendar: HTMLElement, data: WorkoutData): void {
  let activeMonth = latestMonthKey(data);
  let scheduled = false;

  const sync = (): void => {
    scheduled = false;
    const nextMonth = visibleMonth(calendar) ?? activeMonth;
    if (nextMonth !== activeMonth) {
      activeMonth = nextMonth;
      updateKpis(kpi, data, activeMonth);
    }
  };

  const requestSync = (): void => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(sync);
  };

  window.addEventListener("scroll", requestSync, { passive: true });
  window.addEventListener("resize", requestSync);
  requestSync();
}

function visibleMonth(calendar: HTMLElement): string | undefined {
  const weeks = [...calendar.querySelectorAll<HTMLElement>(".week")];
  if (weeks.length === 0) return undefined;

  const targetY = Math.max(112, window.innerHeight * 0.22);
  const visibleWeek =
    weeks.find((week) => {
      const rect = week.getBoundingClientRect();
      return rect.top <= targetY && rect.bottom >= targetY;
    }) ??
    weeks.reduce((closest, week) => {
      const closestDistance = Math.abs(closest.getBoundingClientRect().top - targetY);
      const weekDistance = Math.abs(week.getBoundingClientRect().top - targetY);
      return weekDistance < closestDistance ? week : closest;
    });

  return visibleWeek.dataset.month;
}

function updateKpis(kpi: HTMLElement, data: WorkoutData, monthKey: string): void {
  const month = data.months[monthKey];
  const cards = [...kpi.children] as HTMLElement[];
  const monthCard = cards[0];
  monthCard.querySelector(".kpi-label")!.textContent = monthKey ? formatYear(monthKey) : "";
  monthCard.querySelector(".kpi-value")!.textContent = monthKey ? formatMonthName(monthKey) : "Month";

  KPI_SPORTS.forEach((sport, index) => {
    const distance = month?.[sport]?.distanceMeters ?? 0;
    cards[index + 1].querySelector(".kpi-value")!.textContent = formatKpiDistance(distance);
  });
}

function buildCalendarHeader(): HTMLElement {
  const header = el("div", "calendar-header");
  header.append(el("div", "month-spacer"));
  for (const label of ["M", "T", "W", "T", "F", "S", "S"]) {
    header.append(el("div", "weekday-label", label));
  }
  return header;
}

function buildDayButton(
  date: string,
  totals: SportTotals | undefined,
  onSelect: (date: string) => void,
): HTMLElement {
  const button = el("button", "day") as HTMLButtonElement;
  button.type = "button";
  button.dataset.date = date;
  button.ariaLabel = `${date} workout detail`;
  button.setAttribute("aria-pressed", "false");

  const activeSports = SPORTS.filter((sport) => (totals?.[sport]?.seconds ?? 0) > 0);
  if (totals && activeSports.length > 0) {
    button.classList.add("has-activity");
    button.append(buildDayArtwork(activeSports, totals));
  } else {
    button.classList.add("is-rest");
  }
  button.append(el("span", "day-date", dayOfMonth(date)));

  button.addEventListener("click", () => onSelect(date));
  return button;
}

function buildDetail(date: string, totals: SportTotals | undefined, onClose: () => void): HTMLElement {
  const detail = el("aside", "detail");
  detail.addEventListener("click", onClose);
  const totalSeconds = SPORTS.reduce((sum, sport) => sum + (totals?.[sport]?.seconds ?? 0), 0);
  const header = el("div", "detail-header");
  header.append(el("h2", undefined, formatLongDate(date)), el("div", "detail-total", formatDuration(totalSeconds)));

  const rows = el("div", "rows");
  for (const sport of SPORTS) {
    const sportTotal = totals?.[sport] ?? { seconds: 0, distanceMeters: 0 };
    const row = el("div", "sport-row");
    const name = el("div");
    const swatch = el("span", "sport-swatch");
    swatch.style.background = colorForSportLevel(sport, 0);
    name.append(swatch, document.createTextNode(SPORT_LABELS[sport]));

    const bar = el("div", "bar");
    const fill = el("div", "bar-fill");
    fill.style.width = `${Math.min(100, (sportTotal.seconds / 7200) * 100)}%`;
    fill.style.background = colorForSportSeconds(sport, sportTotal.seconds);
    bar.append(fill);

    row.append(name, bar, el("div", sportTotal.seconds > 0 ? undefined : "muted", `${formatDuration(sportTotal.seconds)} · ${formatDistance(sportTotal.distanceMeters, sport)}`));
    rows.append(row);
  }

  detail.append(header, rows);
  return detail;
}

function buildWeeks(days: DayMap, today: string): string[][] {
  const keys = Object.keys(days).sort();
  const newest = keys.at(-1) ?? formatDateKey(new Date());
  const oldest = keys[0] ?? newest;
  const start = startOfWeek(parseDateKey(oldest));
  const end = startOfWeek(parseDateKey(newest > today ? newest : today));
  const weeks: string[][] = [];

  for (const weekStart = new Date(end); weekStart >= start; weekStart.setDate(weekStart.getDate() - 7)) {
    const week: string[] = [];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + offset);
      week.push(formatDateKey(date));
    }
    weeks.push(week);
  }

  return weeks;
}

function startOfWeek(date: Date): Date {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

function levelForSeconds(sport: Sport, seconds: number): 0 | 1 | 2 | 3 {
  const minutes = seconds / 60;
  const thresholds = SPORT_THRESHOLDS_MINUTES[sport];
  if (minutes < thresholds[1]) return 0;
  if (minutes < thresholds[2]) return 1;
  if (minutes < thresholds[3]) return 2;
  return 3;
}

function colorForSportSeconds(sport: Sport, seconds: number): string {
  return colorForSportLevel(sport, levelForSeconds(sport, seconds));
}

function colorForSportLevel(sport: Sport, level: 0 | 1 | 2 | 3): string {
  return THEMES[activeTheme][sport].colors[level];
}

function buildDayArtwork(sports: Sport[], totals: SportTotals): HTMLElement {
  const colors = sports.map((sport) => colorForSportSeconds(sport, totals[sport].seconds));
  const art = el("span", "day-art");
  art.setAttribute("aria-hidden", "true");

  const shapes =
    colors.length === 1
      ? [["polygon(0 0, 100% 0, 100% 100%, 0 100%)"]]
      : colors.length === 2
        ? [["polygon(0 0, 100% 0, 0 100%)"], ["polygon(100% 0, 100% 100%, 0 100%)"]]
        : colors.length === 3
          ? [["polygon(0 0, 50% 0, 50% 50%, 0 100%)"], ["polygon(50% 0, 100% 0, 100% 100%, 50% 50%)"], ["polygon(0 100%, 50% 50%, 100% 100%)"]]
          : [["polygon(0 0, 100% 0, 50% 50%)"], ["polygon(100% 0, 100% 100%, 50% 50%)"], ["polygon(100% 100%, 0 100%, 50% 50%)"], ["polygon(0 100%, 0 0, 50% 50%)"]];

  shapes.forEach(([clipPath], index) => {
    const region = el("span", "day-region");
    region.style.background = colors[index];
    region.style.clipPath = clipPath;
    art.append(region);
  });

  return art;
}

async function shareWorkoutImage(data: WorkoutData, weeks: string[][], today: string): Promise<void> {
  const blob = await renderWorkoutImageBlob(data, weeks, today);
  const fileName = `stravaw-${today}.png`;
  const file = new File([blob], fileName, { type: "image/png" });

  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      files: [file],
      title: "Stravaw",
    });
    return;
  }

  downloadBlob(blob, fileName);
}

async function downloadWorkoutImage(data: WorkoutData, weeks: string[][], today: string): Promise<void> {
  const blob = await renderWorkoutImageBlob(data, weeks, today);
  downloadBlob(blob, `stravaw-${today}.png`);
}

function renderWorkoutImageBlob(data: WorkoutData, weeks: string[][], today: string): Promise<Blob> {
  return canvasToBlob(buildWorkoutImage(data, weeks, today));
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to render image"));
      }
    }, "image/png");
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function buildWorkoutImage(data: WorkoutData, weeks: string[][], today: string): HTMLCanvasElement {
  const exportWeeks = [...weeks].reverse();
  const columnStep = EXPORT_CELL + EXPORT_GAP;
  const width = EXPORT_PADDING * 2 + EXPORT_LABEL_WIDTH + exportWeeks.length * columnStep - EXPORT_GAP;
  const gridHeight = 7 * EXPORT_CELL + 6 * EXPORT_GAP;
  const height = EXPORT_PADDING * 2 + EXPORT_MONTH_HEIGHT + gridHeight + EXPORT_FOOTER_HEIGHT;
  const scale = Math.max(2, Math.ceil(window.devicePixelRatio || 1));
  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");
  if (!context) return canvas;

  context.scale(scale, scale);
  context.fillStyle = "#101414";
  context.fillRect(0, 0, width, height);

  const gridX = EXPORT_PADDING + EXPORT_LABEL_WIDTH;
  const titleY = EXPORT_PADDING + 26;
  const monthY = EXPORT_PADDING + 54;
  const gridY = EXPORT_PADDING + EXPORT_MONTH_HEIGHT;
  const panelX = EXPORT_PADDING;
  const panelY = EXPORT_PADDING;
  const panelWidth = width - EXPORT_PADDING * 2;
  const panelHeight = height - EXPORT_PADDING * 2;

  drawRoundedRect(context, panelX, panelY, panelWidth, panelHeight, 8, "#111818");

  context.fillStyle = "#cbd7cf";
  context.font = "600 18px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  context.fillText("Stravaw", panelX + 18, titleY);

  context.fillStyle = "#9fb0a6";
  context.font = "12px Inter, system-ui, sans-serif";
  context.fillText(`Updated ${formatExportDateTime(data.generatedAt)}`, panelX + 18, panelY + panelHeight - 26);

  drawExportMonths(context, exportWeeks, gridX, monthY, columnStep);
  drawExportWeekdays(context, gridY);

  exportWeeks.forEach((week, weekIndex) => {
    week.forEach((date, dayIndex) => {
      const x = gridX + weekIndex * columnStep;
      const y = gridY + dayIndex * columnStep;
      if (date > today) return;
      drawExportDay(context, x, y, data.days[date]);
    });
  });

  drawExportSportLegend(context, panelX + panelWidth - 342, panelY + panelHeight - 32);

  return canvas;
}

function drawExportMonths(
  context: CanvasRenderingContext2D,
  weeks: string[][],
  gridX: number,
  y: number,
  columnStep: number,
): void {
  weeks.forEach((week, index) => {
    const firstOfMonth = week.find((date) => parseDateKey(date).getDate() === 1);
    if (firstOfMonth) {
      const previousMonthDate = weeks
        .slice(0, index)
        .flat()
        .filter((date) => parseDateKey(date).getDate() === 1)
        .at(-1);
      if (!previousMonthDate || firstOfMonth.slice(0, 4) !== previousMonthDate.slice(0, 4)) {
        context.fillStyle = "rgba(203, 215, 207, 0.56)";
        context.font = "10px Inter, system-ui, sans-serif";
        context.textBaseline = "middle";
        context.fillText(firstOfMonth.slice(0, 4), gridX + index * columnStep, y - 16);
      }
      context.fillStyle = "#cbd7cf";
      context.font = "14px Inter, system-ui, sans-serif";
      context.textBaseline = "middle";
      context.fillText(shortMonth(firstOfMonth), gridX + index * columnStep, y);
    }
  });
}

function drawExportWeekdays(context: CanvasRenderingContext2D, gridY: number): void {
  context.fillStyle = "#cbd7cf";
  context.font = "14px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  [
    ["MON", 0],
    ["WED", 2],
    ["FRI", 4],
  ].forEach(([label, index]) => {
    context.fillText(String(label), EXPORT_PADDING + 18, gridY + Number(index) * (EXPORT_CELL + EXPORT_GAP) + EXPORT_CELL / 2);
  });
}

function drawExportDay(context: CanvasRenderingContext2D, x: number, y: number, totals: SportTotals | undefined): void {
  drawRoundedRect(context, x, y, EXPORT_CELL, EXPORT_CELL, 4, "#1b2423");
  const activeSports = SPORTS.filter((sport) => (totals?.[sport]?.seconds ?? 0) > 0);
  if (!totals || activeSports.length === 0) return;

  context.save();
  roundedRectPath(context, x, y, EXPORT_CELL, EXPORT_CELL, 4);
  context.clip();

  const colors = activeSports.map((sport) => colorForSportSeconds(sport, totals[sport].seconds));
  if (colors.length === 1) {
    context.fillStyle = colors[0];
    context.fillRect(x, y, EXPORT_CELL, EXPORT_CELL);
  } else if (colors.length === 2) {
    drawTriangle(context, colors[0], x, y, x + EXPORT_CELL, y, x, y + EXPORT_CELL);
    drawTriangle(context, colors[1], x + EXPORT_CELL, y, x + EXPORT_CELL, y + EXPORT_CELL, x, y + EXPORT_CELL);
  } else if (colors.length === 3) {
    drawPolygon(context, colors[0], [
      [x, y],
      [x + EXPORT_CELL / 2, y],
      [x + EXPORT_CELL / 2, y + EXPORT_CELL / 2],
      [x, y + EXPORT_CELL],
    ]);
    drawPolygon(context, colors[1], [
      [x + EXPORT_CELL / 2, y],
      [x + EXPORT_CELL, y],
      [x + EXPORT_CELL, y + EXPORT_CELL],
      [x + EXPORT_CELL / 2, y + EXPORT_CELL / 2],
    ]);
    drawTriangle(context, colors[2], x, y + EXPORT_CELL, x + EXPORT_CELL / 2, y + EXPORT_CELL / 2, x + EXPORT_CELL, y + EXPORT_CELL);
  } else {
    drawTriangle(context, colors[0], x, y, x + EXPORT_CELL, y, x + EXPORT_CELL / 2, y + EXPORT_CELL / 2);
    drawTriangle(context, colors[1], x + EXPORT_CELL, y, x + EXPORT_CELL, y + EXPORT_CELL, x + EXPORT_CELL / 2, y + EXPORT_CELL / 2);
    drawTriangle(context, colors[2], x + EXPORT_CELL, y + EXPORT_CELL, x, y + EXPORT_CELL, x + EXPORT_CELL / 2, y + EXPORT_CELL / 2);
    drawTriangle(context, colors[3], x, y + EXPORT_CELL, x, y, x + EXPORT_CELL / 2, y + EXPORT_CELL / 2);
  }

  context.restore();
}

function drawExportSportLegend(context: CanvasRenderingContext2D, x: number, y: number): void {
  context.font = "12px Inter, system-ui, sans-serif";
  context.textBaseline = "middle";
  SPORTS.forEach((sport, index) => {
    const itemX = x + index * 80;
    drawRoundedRect(context, itemX, y - 7, 14, 14, 3, colorForSportLevel(sport, 2));
    context.fillStyle = "#9fb0a6";
    context.fillText(SPORT_LABELS[sport], itemX + 20, y);
  });
}

function drawRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke?: string,
): void {
  context.beginPath();
  roundedRectPath(context, x, y, width, height, radius);
  context.fillStyle = fill;
  context.fill();
  if (stroke) {
    context.strokeStyle = stroke;
    context.lineWidth = 1;
    context.stroke();
  }
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.lineTo(x + width - radius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + radius);
  context.lineTo(x + width, y + height - radius);
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  context.lineTo(x + radius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - radius);
  context.lineTo(x, y + radius);
  context.quadraticCurveTo(x, y, x + radius, y);
  context.closePath();
}

function drawTriangle(
  context: CanvasRenderingContext2D,
  fill: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  x3: number,
  y3: number,
): void {
  drawPolygon(context, fill, [
    [x1, y1],
    [x2, y2],
    [x3, y3],
  ]);
}

function drawPolygon(context: CanvasRenderingContext2D, fill: string, points: [number, number][]): void {
  context.beginPath();
  points.forEach(([pointX, pointY], index) => {
    if (index === 0) {
      context.moveTo(pointX, pointY);
    } else {
      context.lineTo(pointX, pointY);
    }
  });
  context.closePath();
  context.fillStyle = fill;
  context.fill();
}

function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function dayOfMonth(date: string): string {
  return String(parseDateKey(date).getDate());
}

function latestMonthKey(data: WorkoutData): string {
  return Object.keys(data.months).sort().reverse()[0] ?? "";
}

function monthKeyForWeek(week: string[]): string {
  const counts = new Map<string, number>();
  for (const date of week) {
    const month = date.slice(0, 7);
    counts.set(month, (counts.get(month) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0].localeCompare(a[0]))[0][0];
}

function monthLabelForWeek(week: string[]): string {
  const firstOfMonth = week.find((date) => parseDateKey(date).getDate() === 1);
  return firstOfMonth ? shortMonth(firstOfMonth) : "";
}

function shortMonth(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(parseDateKey(date)).toUpperCase();
}

function formatMonthName(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short" })
    .format(new Date(year, monthIndex - 1, 1))
    .toUpperCase();
}

function formatMonthYearShort(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short", year: "2-digit" }).format(
    new Date(year, monthIndex - 1, 1),
  );
}

function formatYear(month: string): string {
  return month.slice(0, 4);
}

function formatLongDate(date: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).formatToParts(parseDateKey(date));
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((datePart) => datePart.type === type)?.value ?? "";
  return `${part("weekday")} ${part("month")} ${part("day")}, ${part("year")}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatExportDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0m";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

function formatDistance(distanceMeters: number, sport: Sport): string {
  if (distanceMeters <= 0) return sport === "swim" ? "0 m" : "0.0 km";
  if (sport === "swim" && distanceMeters < 10000) return `${Math.round(distanceMeters)} m`;
  return `${(distanceMeters / 1000).toFixed(1)} km`;
}

function formatKpiDistance(distanceMeters: number): string {
  return `${(distanceMeters / 1000).toFixed(1)}km`;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
