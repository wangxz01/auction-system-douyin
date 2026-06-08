package controllers

import "math"

func centsToFloat(cents int64) float64 {
	return float64(cents) / 100
}

func floatToCents(v float64) int64 {
	return int64(math.Round(v * 100))
}

func centsOrLegacy(cents int64, legacy float64) int64 {
	if cents > 0 {
		return cents
	}
	return floatToCents(legacy)
}

func optionalCentsOrLegacy(cents *int64, legacy *float64) *int64 {
	if cents != nil {
		return cents
	}
	if legacy == nil {
		return nil
	}
	v := floatToCents(*legacy)
	return &v
}
