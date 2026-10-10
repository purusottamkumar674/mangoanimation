# FROOTI - Mango. Full volume.

A complete responsive, scroll-controlled product landing page, built from the video supplied in this conversation. The actual bottle rotation, cap opening, and pouring shots come from that video.

## Sabse pehle: website kaise kholein

1. ZIP ko download karke **Extract All** karein. ZIP ke andar se seedha HTML mat kholein.
2. Extracted `frooti-scroll-website` folder kholein.
3. `index.html` ko Chrome ya Edge mein open karein.
4. Neeche scroll karein. Bottle move karegi. Scroll rokein: bottle rukegi. Upar scroll karein: sequence reverse hoga.

Normal preview ke liye installation, API key, paid library, ya build command ki zaroorat nahi hai. Optional Google Fonts need an internet connection; built-in system fonts are used when offline.

### Recommended local-server preview

Node.js installed hai to folder ke terminal mein:

```sh
node server.js
```

Browser mein open karein:

```text
http://127.0.0.1:3000
```

Windows par `START-WEBSITE.bat` bhi use kar sakte hain. Server ko stop karne ke liye us terminal mein `Ctrl+C` dabayein. `npm install` is project ke liye required nahi hai. `npm start` is an optional alias for `node server.js`.

Port 3000 busy ho to PowerShell mein:

```powershell
$env:PORT=3001
node server.js
```

Then open `http://127.0.0.1:3001`.

## What is included

- Yellow, dark-green, cream, and mango-orange art direction.
- A full-screen sticky hero with four scroll-controlled chapters: The Icon, The Twist, The Pour, and The Feeling.
- The supplied film converted into 243 transparent WebP frames for each responsive resolution tier.
- Forward and reverse scrubbing. The first frame remains still before scrolling.
- Scene-based typography, background-color changes, orbit motion, a progress indicator, and chapter navigation.
- A three-card product section, scroll-driven parallax, and a scroll-driven typography strip.
- An interactive three-tab "Your moment" section, closing section, and replay link.
- Responsive navigation, an instructions dialog, keyboard controls, a skip link, and a reduced-motion setting.
- Original MP4 and original product image preserved in the assets folder.

## The important animation rule

There is no `video.play()`, autoplay, looping video, timer-driven bottle rotation, or endlessly running animation loop. The scroll position is the animation clock:

```text
progress = (scrollY - sceneStart) / sceneScrollDistance
frame    = round(progress * (frameCount - 1))
```

Rendering is scheduled on a scroll/resize event or when the requested frame finishes loading. There is no smoothing that continues advancing frames after scrolling stops. A slow connection may delay the arrival of a requested frame, but the sequence never advances on its own.

Clicking a chapter or an anchor intentionally changes the page's scroll position. This is navigation, not autoplay. The "Motion off" control and the operating system's reduced-motion preference hold the product at its first frame while allowing the page content to be explored.

## How the supplied video is used

`assets/video/frooti-original.mp4` is the untouched uploaded video. The running website displays frames extracted from it, rather than seeking a normally playing video element. This makes reverse scrolling and exact stopping independent of autoplay permissions.

The source is a portrait film. Its neutral studio backdrop has been removed from the extracted frames so the product sits inside the page design. The source camera framing, label details, perspective, and any original crops remain part of the supplied footage; missing parts of a cropped bottle have not been invented. Canvas edge feathering softens the original frame boundaries.

The MP4 is retained for editing; it is not automatically downloaded by the live page. The page loads nearby WebP frames as needed. Desktop frames are 640 x 1252; mobile frames are 384 x 751. The JavaScript holds at most 30 desktop or 18 mobile frame-image references in its cache. Browser-managed memory use is separate and may vary.

## Files

```text
frooti-scroll-website/
  index.html                  Complete landing page
  css/styles.css              Responsive layout, colors, typography
  js/app.js                   Scroll engine and all interactions
  js/sequence.js              Generated frame configuration
  assets/frames/desktop/      243 desktop WebP frames
  assets/frames/mobile/       243 mobile WebP frames
  assets/images/             Product stills, source image, favicon
  assets/video/              Original uploaded MP4
  server.js                  Dependency-free local preview server
  package.json               Optional start and syntax-check commands
  START-WEBSITE.bat           Windows launcher
  tools/build_frames.py      Optional asset regeneration utility
  tools/requirements.txt     Packages needed only to rebuild frames
  README.md                  Setup and editing instructions
  QA_REPORT.md               Checks performed and test limitations
  LICENSE-NOTES.md           Asset and branding notes
```

## Change text, colors, or scroll length

Edit the copy and navigation in `index.html`. Edit the root color variables in `css/styles.css`:

```css
--green: #153d2c;
--yellow: #ffed28;
--cream: #f5f2e9;
--orange: #ffa333;
```

The hero's scene colors are also defined in `colorStops` inside `js/app.js`; change these when changing the art direction. Typography uses optional Google Fonts with local system fallbacks. No font files are distributed in this ZIP.

The `.experience` height controls how far the user scrolls through the film. It is `700svh` on desktop and `660svh` on mobile. Increasing that value slows the film per pixel of scroll; reducing it makes the film faster per pixel.

Chapter positions are in `chapterTargets` in `js/app.js`. Scene opacity, horizontal bottle placement, and color transitions are also defined there. The three moment-tab texts are in the `moments` array.

## Replacing the video later (optional)

Do not merely replace the MP4: the visible animation uses the extracted frame folders. Regenerate them after changing the video.

From the project folder, with Python 3.10+ installed:

```sh
python -m pip install -r tools/requirements.txt
python tools/build_frames.py "path/to/your-new-video.mp4"
```

For footage that does not have a neutral white/grey studio background:

```sh
python tools/build_frames.py "path/to/your-new-video.mp4" --keep-background
```

This updates both frame tiers, the poster, editorial stills, and `js/sequence.js`. It also stores the new original MP4. Adjust chapter timing, copy, and layout for different footage. Keep a backup before regenerating assets.

## Hosting

This is a static site. Publish `index.html`, `css`, `js`, and `assets` together, retaining their relative folder paths. No database, server-rendering framework, environment secrets, or build output is required. `server.js` is for local preview; a normal static web host can serve the production files.

Use HTTPS for a public site. Test the deployed URL on actual phones and a slower connection. The site has not been deployed to a public domain as part of this ZIP delivery.

## Scope

This delivery is the complete animated frontend experience, not an ecommerce backend. It does not include payment processing, accounts, an admin panel, inventory, or order handling. No fake checkout or non-working purchase button has been added.
