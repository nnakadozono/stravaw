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

    detail = selectedDate ? buildDetail(selectedDate, data.days[selectedDate]) : null;
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
  shell.append(buildHeader(data.generatedAt), kpi, calendar, detailSlot);
  return shell;
}

function buildHeader(generatedAt: string): HTMLElement {
  const topbar = el("header", "topbar");
  const titleWrap = el("div");
  titleWrap.append(el("h1", undefined, "Stravaw"));
  topbar.append(titleWrap, el("div", "updated", `Updated ${formatDateTime(generatedAt)}`));
  return topbar;
}

function buildKpis(data: WorkoutData): HTMLElement {
  const currentMonth = latestMonthKey(data);
  const kpi = el("section", "kpi");

  const monthCard = el("article", "kpi-month");
  monthCard.append(
    el("div", "kpi-label", ""),
    el("div", "kpi-value", "Month"),
  );
  kpi.append(monthCard);

  for (const sport of KPI_SPORTS) {
    const card = el("article", "kpi-card");
    card.classList.add(`kpi-${sport}`);
    card.append(
      el("div", "kpi-label", SPORT_LABELS[sport].toUpperCase()),
      el("div", "kpi-value", "0.0km"),
    );
    kpi.append(card);
  }

  updateKpis(kpi, data, currentMonth);
  return kpi;
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
    button.append(buildDayArtwork(activeSports, totals));
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

function buildDayArtwork(sports: Sport[], totals: SportTotals): SVGSVGElement {
  const colors = sports.map((sport) => colorForSport(sport, opacityForSeconds(totals[sport].seconds)));
  const svg = svgEl("svg");
  svg.classList.add("day-art");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const shapes =
    colors.length === 1
      ? [["0,0 100,0 100,100 0,100"]]
      : colors.length === 2
        ? [["0,0 100,0 0,100"], ["100,0 100,100 0,100"]]
        : colors.length === 3
          ? [["0,0 50,0 50,50 0,100"], ["50,0 100,0 100,100 50,50"], ["0,100 50,50 100,100"]]
          : [["0,0 100,0 50,50"], ["100,0 100,100 50,50"], ["100,100 0,100 50,50"], ["0,100 0,0 50,50"]];

  shapes.forEach(([points], index) => {
    const polygon = svgEl("polygon");
    polygon.setAttribute("points", points);
    polygon.setAttribute("fill", colors[index]);
    svg.append(polygon);
  });

  return svg;
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

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS("http://www.w3.org/2000/svg", tag);
}
