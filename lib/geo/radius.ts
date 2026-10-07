/**
 * `support_services.coverage_area_radius` has been written in two units: the profile form
 * stores METRES (default 5000, shown as 5 km), older/other paths stored kilometres. Values of
 * 1000 or more are metres; anything smaller is already kilometres. Everything that needs a
 * distance (matching, display) must go through this.
 */
export function radiusToKm(radius: number | null | undefined): number | null {
	if (radius == null || !isFinite(radius) || radius <= 0) return null;
	return radius >= 1000 ? radius / 1000 : radius;
}
