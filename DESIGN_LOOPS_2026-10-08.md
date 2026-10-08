# きまぐれダーツ旅 — 2026-10-08 design reviews

Request: improve the adopted Ren direction through about ten review/change loops. Preserve the 1,432-place selection, history, saved places, public sources and old-page compatibility.

1. **Experience** — Live main-page review showed an abstract dartboard despite the adopted geographic Ren direction. Replaced it with selectable prefecture outlines and coordinate-based GSI tile throws. The needle, candidate points and eventual city share one Mercator projection. Candidate and state checks pass.
2. **Visual hierarchy** — The previous main CSS accumulated competing overrides. Replaced it with a coherent warm paper / pale sea / copper palette, photo beside the two-line headline, map left and controls right. Flattened card decoration and matched result/history typography. Initial code check and build pass; live visual review is next.

The temporary `public/qa/design-review.html` is a same-origin iframe for visual review at 375, 390 and 768px. It will be removed before the final release.
