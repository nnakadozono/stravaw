from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Literal, TypedDict

Sport = Literal["run", "swim", "bike", "other"]
SPORTS: tuple[Sport, ...] = ("run", "swim", "bike", "other")
KPI_SPORTS: tuple[Sport, ...] = ("run", "swim", "bike")

RUN_TYPES = {"run", "trailrun", "virtualrun"}
SWIM_TYPES = {"swim"}
BIKE_TYPES = {"ride", "virtualride", "mountainbikeride", "gravelride", "ebikeride", "emountainbikeride"}


class Metric(TypedDict):
    seconds: int
    distanceMeters: float


def empty_day() -> Dict[Sport, Metric]:
    return {sport: {"seconds": 0, "distanceMeters": 0.0} for sport in SPORTS}


def map_sport(activity: Dict[str, Any]) -> Sport:
    raw_type = str(activity.get("sport_type") or activity.get("type") or "").replace("_", "").lower()
    if raw_type in RUN_TYPES:
        return "run"
    if raw_type in SWIM_TYPES:
        return "swim"
    if raw_type in BIKE_TYPES:
        return "bike"
    return "other"


def local_date(activity: Dict[str, Any]) -> str:
    raw_date = activity.get("start_date_local")
    if not raw_date:
        raise ValueError(f"Activity {activity.get('id', '<unknown>')} is missing start_date_local")
    return str(raw_date)[:10]


def aggregate_activities(activities: Iterable[Dict[str, Any]], generated_at: str | None = None) -> Dict[str, Any]:
    days: Dict[str, Dict[Sport, Metric]] = defaultdict(empty_day)
    months: Dict[str, Dict[Sport, Dict[str, float]]] = defaultdict(
        lambda: {sport: {"distanceMeters": 0.0} for sport in KPI_SPORTS}
    )

    for activity in activities:
        sport = map_sport(activity)
        date_key = local_date(activity)
        month_key = date_key[:7]
        seconds = int(activity.get("moving_time") or activity.get("elapsed_time") or 0)
        distance = float(activity.get("distance") or 0)

        days[date_key][sport]["seconds"] += seconds
        days[date_key][sport]["distanceMeters"] += distance
        if sport in KPI_SPORTS:
            months[month_key][sport]["distanceMeters"] += distance

    return {
        "generatedAt": generated_at or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "days": {date: round_day(day) for date, day in sorted(days.items())},
        "months": {month: round_month(summary) for month, summary in sorted(months.items())},
    }


def round_day(day: Dict[Sport, Metric]) -> Dict[Sport, Dict[str, int]]:
    return {
        sport: {
            "seconds": int(day[sport]["seconds"]),
            "distanceMeters": int(round(day[sport]["distanceMeters"])),
        }
        for sport in SPORTS
    }


def round_month(summary: Dict[Sport, Dict[str, float]]) -> Dict[Sport, Dict[str, int]]:
    return {
        sport: {"distanceMeters": int(round(summary[sport]["distanceMeters"]))}
        for sport in KPI_SPORTS
    }

