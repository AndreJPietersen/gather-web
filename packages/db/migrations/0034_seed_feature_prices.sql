-- The six price rows the pricing page and request screen read — every spot
-- type and duration, with no amount yet (shown as "price on request") until
-- an admin sets real prices at /admin/featured/pricing.
INSERT INTO "feature_prices" ("spot", "duration")
SELECT s.spot::feature_spot, d.duration::feature_duration
FROM (VALUES ('top'), ('rotating')) AS s(spot)
CROSS JOIN (VALUES ('1_week'), ('1_month'), ('3_months')) AS d(duration)
ON CONFLICT DO NOTHING;
