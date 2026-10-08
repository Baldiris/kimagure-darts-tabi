# きまぐれダーツ旅 — 2026-10-08 design reviews

Request: improve the adopted Ren direction through about ten review/change loops. Preserve the 1,432-place selection, history, saved places, public sources and old-page compatibility.

1. **Experience** — Live main-page review showed an abstract dartboard despite the adopted geographic Ren direction. Replaced it with selectable prefecture outlines and coordinate-based GSI tile throws. The needle, candidate points and eventual city share one Mercator projection. Candidate and state checks pass.
2. **Visual hierarchy** — The previous main CSS accumulated competing overrides. Replaced it with a coherent warm paper / pale sea / copper palette, photo beside the two-line headline, map left and controls right. Flattened card decoration and matched result/history typography. Initial code checks and build passed; the subsequent deployed reviews are recorded below.

A temporary same-origin iframe was used to review 375px and 390px layouts. Both copies of `qa/design-review.html` were removed from the final release.

3. **Map affordance and hero rhythm** — First deployed review showed a photo caption separated by excess white space and no visible prefecture name while targeting the map. Tightened hero row heights and added a name/count on hover and keyboard focus. Kept the photograph's attribution visible.
4. **Geographic detail** — The Okinawa-only outline was too schematic. Selected prefectures now preview real GSI tiles and all eligible town coordinates before throwing. Added projection tests for every national/regional/prefecture scope at 346×355, 390×355 and 832×575; markers and tiles coincide within 0.00001px and all 1,432 destinations remain inside the viewport.
5. **Landing** — A live throw reached the result quickly. Added a 1.3-second pause on the landed needle and town label, distinct flight/landing button text, and a shorter controlled flight. Reduced-motion users still receive the result directly.
6. **Result** — Live high-resolution review of Takahata showed four redundant landing labels and Google Maps below the fold. Made the municipality the single H1, moved map actions before notes, and shifted the map's marker toward the visible upper area. Reused bundled coordinates instead of fetching them again; tile errors now have explicit fallback text.
7. **Facts** — The same review rendered government data as small, uniform paragraphs. Give park/district names, crops, production values and land area distinct typographic roles. Preserve years, units, estimate labels, ranks, source URLs and the original data.
8. **Mobile** — At 375px, the default select text was clipped and the fixed action covered part of the controls. Removed repeated counts from native select options and placed controls before the map. Kept 16px native input text and bottom padding around the fixed throw action. Deployed reviews at 375 and 390px confirmed that both native selectors remain visible and do not overlap the fixed action.
9. **Ren parity** — Source review found its disappearing dart used a centered wrapper rather than the needle tip and highlighted the winning point during flight. Adopted the same needle SVG/anchor, defer the winner until landing, use native region/prefecture selectors, avoid immediate repeats, and match the landing pause and serif second headline line. Its selection audit page remains available.
10. **Release review** — Native selects provide full keyboard access. The optional outline map now has one tab stop, arrow/Home/End navigation and focus transfer to the prefecture select after choosing a province. Live throw, result, save, history, mobile overflow and cached-page assets were reviewed. The final evidence and remaining limitation are recorded below.

## Deployed verification

- Main: ArrowRight moved focus from Okinawa to Kagoshima with one map tab stop. The first live review found focus loss during hover; memoizing the inserted SVG fixed it, and the repeated keyboard review kept focus on the map.
- Main: a Kagoshima throw reached Setouchi. All 15 destination-map tiles loaded. Google Maps was visible before the notes; government facts retained their sources and units. Save state persisted through the saved filter and a history reopen, independently of another saved destination.
- Mobile: 375px and 390px iframe reviews showed the controls before the map, no clipped native selector labels, and clearance above the fixed throw button. Browser scrollbars made the actual content widths smaller, providing a stricter overflow check.
- Ren: Shikoku → Kochi showed 20 eligible places; a throw reached Umaji. All 20 map tiles loaded. The destination-map action switched to zoom 11 and could restore the full scope.
- `npm run check` and `npm run build` passed after the last main JavaScript fix. The coordinate checks cover national, regional and all 47 prefecture scopes at three viewport sizes. All six legacy late-loaded facts assets still exist, and prior published JS/CSS assets are retained.
- The Ren review then found an invisible needle: its zero-width anchor caused the more specific generic `.map-stage svg` sizing to produce a zero-width SVG. The final CSS uses `.map-stage .ren-real-dart` for explicit desktop/mobile dimensions and a new stylesheet URL. The public and built copies are identical; animation and tip coordinates are preserved.
- A follow-up deployed check after the confirmation environment recovered completed the final visual review. Desktop Ren reached Kitagawa and showed the needle visibly anchored to the town. Its width is explicitly 152px and landed opacity is 1. At 375px and 390px review widths, Ren reached Aki and kept its 126px needle visible, with no horizontal overflow.

## Final closure — 2026-10-08

- Rechecked main keyboard navigation: ArrowRight focuses Kagoshima with one map tab stop; Enter chooses it and transfers focus to the prefecture select.
- A new main throw reached Kikai. Saved it, reloaded the page, and reopened its result from the saved filter. Save state remained true throughout.
- Rechecked main mobile at 375px and 390px: actual content widths 360px and 375px equal the document scroll widths. The native selects end at y=372.375px, above the fixed action at y=714px.
- Visually inspected the main desktop landing page, the mobile layout, and the post-fix Ren needle on desktop and mobile. Desktop landing and needle confirmation images were captured from the public site.
- Removed both temporary QA files again after the final mobile review. The final release only closes verification records and removes the review surface; it does not alter the verified main or Ren implementation.
