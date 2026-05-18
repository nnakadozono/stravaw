import unittest

from scripts.aggregate import aggregate_activities, map_sport


class AggregateActivitiesTest(unittest.TestCase):
    def test_maps_known_and_unknown_sports(self):
        self.assertEqual(map_sport({"sport_type": "Run"}), "run")
        self.assertEqual(map_sport({"sport_type": "TrailRun"}), "run")
        self.assertEqual(map_sport({"sport_type": "Swim"}), "swim")
        self.assertEqual(map_sport({"sport_type": "VirtualRide"}), "bike")
        self.assertEqual(map_sport({"sport_type": "WeightTraining"}), "other")

    def test_combines_same_day_same_sport_and_uses_local_date(self):
        data = aggregate_activities(
            [
                {
                    "sport_type": "Run",
                    "start_date_local": "2026-05-18T06:00:00Z",
                    "moving_time": 1200,
                    "distance": 4000.2,
                },
                {
                    "sport_type": "Run",
                    "start_date_local": "2026-05-18T19:00:00Z",
                    "moving_time": 900,
                    "distance": 3000.3,
                },
            ],
            generated_at="2026-05-18T00:00:00Z",
        )

        run = data["days"]["2026-05-18"]["run"]
        self.assertEqual(run["seconds"], 2100)
        self.assertEqual(run["distanceMeters"], 7000)

    def test_monthly_kpi_excludes_other(self):
        data = aggregate_activities(
            [
                {"sport_type": "Ride", "start_date_local": "2026-05-01T08:00:00Z", "moving_time": 3600, "distance": 25000},
                {"sport_type": "Swim", "start_date_local": "2026-05-02T08:00:00Z", "moving_time": 1800, "distance": 1500},
                {"sport_type": "Workout", "start_date_local": "2026-05-03T08:00:00Z", "moving_time": 1200, "distance": 500},
            ],
            generated_at="2026-05-18T00:00:00Z",
        )

        month = data["months"]["2026-05"]
        self.assertEqual(set(month.keys()), {"run", "swim", "bike"})
        self.assertEqual(month["bike"]["distanceMeters"], 25000)
        self.assertEqual(month["swim"]["distanceMeters"], 1500)
        self.assertEqual(data["days"]["2026-05-03"]["other"]["seconds"], 1200)


if __name__ == "__main__":
    unittest.main()

