# Quality checks

## Result

**89 / 89 automated checks passed.** JavaScript syntax checks also passed.

## Checks performed

- The product starts on frame zero and remains stationary when the page is idle.
- Forward scrolling and reverse scrolling select the correct target frames.
- An idle page does not run a perpetual animation repaint loop.
- The motion switch disables the sequence; re-enabling it follows the current scroll position.
- All four chapter controls select the appropriate position in the source film.
- The instructions dialog opens and dismisses with Escape.
- Moment tabs change their content and support arrow-key navigation.
- Replay returns to the first frame.
- Mobile navigation opens, follows the chosen section, and closes afterwards.
- System reduced-motion preference is honored.
- The mobile image-resolution tier is selected for a new mobile-sized page.
- The desktop decoded-image reference cache stays within its configured limit.
- No uncaught JavaScript errors occurred during the test sequence.
- No horizontal page overflow or hero-headline clipping at the tested sizes.
- Both asset sequences contain 243 continuously numbered frames.
- The retained MP4 has the same SHA-256 checksum as the supplied MP4.
- Local server routes return successful responses and MP4 byte-range requests work.
- No font binaries are included in the package.

## Viewports exercised

320 x 568, 375 x 667, 390 x 844, 540 x 800, 768 x 1024, 1024 x 768, 1440 x 900, and 1920 x 1080. All four hero chapters were inspected for headline clipping at each size.

## Method and limits

Automated interactions were exercised in Chromium using an in-memory preview. Because this environment restricts browser navigation to local URLs, relative asset URLs were replaced in the test harness with identical in-memory asset bytes; the application's interaction and animation logic was unchanged. The dependency-free HTTP server was tested separately through actual HTTP requests.

Desktop and mobile-size screenshots were visually inspected. This is not a claim of testing on physical iPhones, physical Android devices, Safari, every browser version, or a live public deployment. Optional online fonts were unavailable in the preview environment, so the screenshots use the shipped local-font fallback strategy.

Final deployment should be checked on the target devices and network conditions. Visible camera crops and source-media details belong to the supplied film.
