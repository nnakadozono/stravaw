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

const SPORTS: Sport[] = ["run", "swim", "bike", "other"];
const KPI_SPORTS: Exclude<Sport, "other">[] = ["run", "swim", "bike"];
const SPORT_COLORS: Record<Sport, string> = {
  run: "44 181 98",
  swim: "68 162 255",
  bike: "245 166 35",
  other: "148 156 154",
};

const SPORT_LABELS: Record<Sport, string> = {
  run: "Run",
  swim: "Swim",
  bike: "Bike",
  other: "Other",
};

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing app root");
}

const appRoot = app;

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
  const weeks = buildWeeks(data.days);
  appRoot.replaceChildren(buildShell(data, weeks));
}

function buildShell(data: WorkoutData, weeks: string[][]): HTMLElement {
  const shell = el("section", "shell");
  let selectedDate = "";
  let detail: HTMLElement | null = null;
  const calendar = el("section", "calendar");
  const detailSlot = el("section", "detail-slot");

  const renderSelection = (nextDate: string): void => {
    selectedDate = selectedDate === nextDate ? "" : nextDate;
    calendar.classList.toggle("has-selection", selectedDate !== "");

    for (const day of calendar.querySelectorAll<HTMLButtonElement>(".day")) {
      const isSelected = day.dataset.date === selectedDate;
      day.classList.toggle("is-selected", isSelected);
      day.setAttribute("aria-pressed", String(isSelected));
    }

    detail = selectedDate ? buildDetail(selectedDate, data.days[selectedDate]) : null;
    detailSlot.replaceChildren(...(detail ? [detail] : []));
  };

  calendar.append(buildCalendarHeader());

  for (const week of weeks) {
    const weekRow = el("div", "week");
    weekRow.append(el("div", "month-label", monthLabelForWeek(week)));
    for (const date of week) {
      weekRow.append(buildDayButton(date, data.days[date], renderSelection));
    }
    calendar.append(weekRow);
  }

  shell.append(buildHeader(data.generatedAt), buildKpis(data), calendar, detailSlot);
  return shell;
}

function buildHeader(generatedAt: string): HTMLElement {
  const topbar = el("header", "topbar");
  const titleWrap = el("div");
  titleWrap.append(el("p", "eyebrow", "Strava"), el("h1", undefined, "Workout"));
  topbar.append(titleWrap, el("div", "updated", `Updated ${formatDateTime(generatedAt)}`));
  return topbar;
}

function buildKpis(data: WorkoutData): HTMLElement {
  const currentMonth = Object.keys(data.months).sort().reverse()[0];
  const month = currentMonth ? data.months[currentMonth] : undefined;
  const kpi = el("section", "kpi");
  const monthCard = el("article", "kpi-month");
  monthCard.append(
    el("div", "kpi-label", currentMonth ? formatYear(currentMonth) : ""),
    el("div", "kpi-value", currentMonth ? formatMonthName(currentMonth) : "Month"),
  );
  kpi.append(monthCard);

  for (const sport of KPI_SPORTS) {
    const distance = month?.[sport]?.distanceMeters ?? 0;
    const card = el("article", "kpi-card");
    card.append(
      el("div", "kpi-label", SPORT_LABELS[sport].toUpperCase()),
      el("div", "kpi-value", formatKpiDistance(distance)),
    );
    kpi.append(card);
  }

  return kpi;
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
  if (activeSports.length > 0) {
    for (const sport of activeSports) {
      const seconds = totals?.[sport]?.seconds ?? 0;
      const segment = el("span", "segment");
      segment.style.background = colorForSport(sport, opacityForSeconds(seconds));
      button.append(segment);
    }
  }
  button.append(el("span", "day-date", dayOfMonth(date)));

  button.addEventListener("click", () => onSelect(date));
  return button;
}

function buildDetail(date: string, totals: SportTotals | undefined): HTMLElement {
  const detail = el("aside", "detail");
  const totalSeconds = SPORTS.reduce((sum, sport) => sum + (totals?.[sport]?.seconds ?? 0), 0);
  const header = el("div", "detail-header");
  header.append(el("h2", undefined, formatLongDate(date)), el("div", "detail-total", formatDuration(totalSeconds)));

  const rows = el("div", "rows");
  for (const sport of SPORTS) {
    const sportTotal = totals?.[sport] ?? { seconds: 0, distanceMeters: 0 };
    const row = el("div", "sport-row");
    const name = el("div");
    const swatch = el("span", "sport-swatch");
    swatch.style.background = colorForSport(sport, 0.9);
    name.append(swatch, document.createTextNode(SPORT_LABELS[sport]));

    const bar = el("div", "bar");
    const fill = el("div", "bar-fill");
    fill.style.width = `${Math.min(100, (sportTotal.seconds / 7200) * 100)}%`;
    fill.style.background = colorForSport(sport, opacityForSeconds(sportTotal.seconds));
    bar.append(fill);

    row.append(name, bar, el("div", sportTotal.seconds > 0 ? undefined : "muted", `${formatDuration(sportTotal.seconds)} · ${formatDistance(sportTotal.distanceMeters, sport)}`));
    rows.append(row);
  }

  detail.append(header, rows);
  return detail;
}

function buildWeeks(days: DayMap): string[][] {
  const keys = Object.keys(days).sort();
  const newest = keys.at(-1) ?? formatDateKey(new Date());
  const oldest = keys[0] ?? newest;
  const start = startOfWeek(parseDateKey(oldest));
  const end = startOfWeek(parseDateKey(newest));
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

function opacityForSeconds(seconds: number): number {
  if (seconds <= 0) return 0;
  if (seconds < 20 * 60) return 0.36;
  if (seconds < 45 * 60) return 0.54;
  if (seconds < 90 * 60) return 0.72;
  return 0.94;
}

function colorForSport(sport: Sport, opacity: number): string {
  return `rgb(${SPORT_COLORS[sport]} / ${opacity})`;
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

function monthLabelForWeek(week: string[]): string {
  const firstOfMonth = week.find((date) => parseDateKey(date).getDate() === 1);
  return firstOfMonth ? shortMonth(firstOfMonth) : "";
}

function shortMonth(date: string): string {
  return new Intl.DateTimeFormat("en", { month: "short" }).format(parseDateKey(date));
}

function formatMonthName(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en", { month: "short" }).format(new Date(year, monthIndex - 1, 1));
}

function formatYear(month: string): string {
  return month.slice(0, 4);
}

function formatLongDate(date: string): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseDateKey(date));
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
