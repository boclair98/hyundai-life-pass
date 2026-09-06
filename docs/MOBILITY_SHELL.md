# Mobility workspace — 2026-09-06

The application now uses a viewport-height workspace, not a separate cinematic
landing page above a conventional dashboard. Existing vehicle, charging, care,
drive and journal logic remains unchanged.

- Header and mobile navigation occupy their own flex rows; only main scrolls.
- The Hyundai account action stays visible at 320px and wider.
- Four existing AI concept images crossfade on destination changes. They are
  decorative, not representations of a user's actual vehicle.
- Background layers stay mounted. There is no automatic slideshow or timer.
- Reduced-motion disables panel and background transitions.
- Page changes reset the workspace scroll position; legal links remain in its footer.
- Primary buttons explicitly pair white text with Hyundai navy. Prior inherited
  navy text on navy buttons made the connect and parking actions unreadable.

## Verification

- Production build passes; existing request retry tests pass (4/4).
- Browser: 320px and 390px layouts have no document or workspace horizontal overflow.
- At 390×844: header y=0..68, main y=68..778, mobile nav y=778..844;
  account action remains inside the header.
- Home shortcuts reach charging and the selected parking tab; the background
  switches to the corresponding loaded image and workspace scroll resets.
- Connection modal opens, closes, and remains usable at 320px. No login submitted.
- Live charging data is displayed through the existing production read-only API.
  Local development has no Kakao runtime key; the live map must be checked on deployment.
- 1440px desktop layout inspected visually; no horizontal overflow.
- Browser console has no warnings or errors during these navigation checks.

No account credentials, vehicle writes, geolocation permissions, or hosting
environment variables were changed. This is not a load test or end-to-end OAuth test.
