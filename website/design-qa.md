# Aaron Skills design QA

Date: 2026-10-17

final result: passed

## Comparison target and evidence

- Source visual truth: `design/source-homepage.png`, the user's selected first
  homepage concept, 1024 × 1536 pixels.
- Implementation: `http://127.0.0.1:4183/`, English default, home route, no dialog.
- Final browser capture: `.artifacts/desktop-final.png` (1112 × 1686 pixels).
  Verified CSS viewport: 1024 × 900, document height 1551 CSS pixels.
- Density: the in-app browser retained its existing 0.92 zoom and reported DPR
  0.9200000167. Its capture painted content at one pixel per CSS pixel but added
  empty canvas on the right and bottom. Cropping that empty canvas, without
  resizing content, produces `.artifacts/desktop-final-css.png` (1024 × 1551).
- Full-view comparison: `.artifacts/comparison-final.jpg`, source on the left,
  implementation on the right at equal 1024-pixel widths. The 15-pixel document
  height difference is acceptable: it preserves real text and interactive links.
- Focused comparisons: `.artifacts/comparison-final-hero.jpg` and
  `.artifacts/comparison-final-skills.jpg`; these expose the headline wrapping,
  navigation, buttons, art crop, skill titles, descriptions and footer clearly.
- The source and rendered implementation were opened together in these combined
  images before assessing fidelity. A standalone rendered copy is retained at
  `design/rendered-homepage.webp`.

## Findings

No actionable P0/P1/P2 findings remain. The following P3 differences are accepted
for this preview:

- Independent illustrations preserve the selected ceramic/copper/glass direction
  but differ in individual miniature screens, props and island shapes. These are
  intentional asset variations, not exact copies of the source's raster details.
- The source image does not identify an exact font. Self-hosted Inter is a close
  visual match; small weight and glyph differences remain. The real headline has
  the same three-line wrapping and ink/copper hierarchy at the comparison width.
- The live background is slightly cleaner and less textured than the source.
  Adding raster grain is optional polish, not necessary for readability or style.

## Required fidelity surfaces

- **Fonts and typography:** checked Inter's weights, headline size, line height,
  tight tracking, small uppercase labels, navigation and paragraph wrapping.
  Chinese uses explicit system fallbacks. No clipped or truncated copy observed.
- **Spacing and layout rhythm:** checked the 74-pixel header, 574-pixel hero,
  309-pixel workflow, aligned page margins, three skill columns, image scales,
  section dividers, and footer. Compared the full page and focused regions.
- **Colors and tokens:** warm `#f7f4ec`, dark `#15202a`, copper `#b3462d`, subtle
  borders, muted future labels and copper available labels preserve the source.
  Primary actions and focus indicators remain distinct from the background.
- **Images:** seven actual generated raster illustrations, compressed transparent
  WebP, about 1.2 MB total. Inspected subjects, scale, sharpness, transparent edges
  and soft shadows. No decorative illustration was replaced with CSS/SVG shapes.
  Standard arrow/close icons come from Phosphor. All images loaded successfully.
- **Copy/content:** hero, workflow and three card descriptions follow the mock.
  Understand/Build/Verify are visibly labelled future direction; only the three
  current Demo skills are marked available. Detail dialogs describe actual inputs,
  outputs, manual sharing, silent-by-default video and optional narration.
  English and Chinese copy and accessible labels were checked in the browser.

## Comparison history and fixes

1. **Initial desktop — blocked, P2:** oversized header/hero, oversized illustration
   and loose section spacing changed the above-the-fold proportions. Evidence:
   `.artifacts/comparison-before-css.jpg` and `desktop-before-css.png`.
   Fixed the intermediate desktop breakpoint's type sizes, margins, hero height,
   workflow height, art scale and section rhythm. Post-fix:
   `.artifacts/comparison-refined-css.jpg`; final comparison confirms the fixes.
2. **Tablet — blocked, P2:** at 768 CSS pixels the illustration competed with the
   headline and overlapped text. Evidence: `.artifacts/tablet-top.png`.
   Changed the stacked-layout breakpoint to 900 pixels and kept the image below
   the copy. Post-fix: `.artifacts/tablet-final-top.png` and `tablet-final.png`.
3. **Narrow phone — blocked, P2:** the 320-pixel primary CTA wrapped its label.
   Evidence: `.artifacts/narrow-en.png`. Added `white-space: nowrap` and reduced
   action padding/gap below 380 pixels. Post-fix: `narrow-final-css.png`; both
   actions fit and document width equals the 320-pixel viewport.
4. **Mobile dialog — blocked, P2:** opening a skill after scrolling could obscure
   the close button. Evidence: `.artifacts/mobile-detail.png`. Replaced background
   scrolling with saved-position body locking in a layout effect; restore the
   scroll position on close. Post-fix: `mobile-detail-final.png` and
   `mobile-zh-detail-final.png`; close remains visible, Escape works, focus returns.
5. **Final pass — passed:** combined full-view and focused desktop comparisons
   show no remaining P0/P1/P2 differences. Phone, tablet and wide desktop checks
   retain the same composition and readable hierarchy appropriate to each width.

## Interaction and technical verification

- Browser widths checked: 320, 390, 768, 1024 and 1440 CSS pixels. No horizontal
  overflow; the 1440-pixel page is approximately 2155 pixels tall.
- English/Chinese switch updates both visible text and document language;
  `?lang=zh` is supported. Skill titles remain their recognizable English names.
- Workflow and Skills section links navigate to real page sections.
- All three skill buttons open distinct native dialogs with relevant content and
  real repository/documentation URLs. Close button, Escape and focus restoration
  were exercised; the native dialog provides modal keyboard focus behavior.
- Links to GitHub, installation and Aaron's site have valid source destinations;
  external account actions were not required for this preview.
- Hover/focus styling, skip link, heading order, image alternatives and reduced
  motion handling were reviewed. Formal assistive-technology certification and
  real-device testing outside the local browser have not been performed.
- Browser error/warning log checked after final reload: no entries.
- Final Vite 6.4.4 build: passed. Hosting-adapter tests: 4 passed.
- npm dependency audit: zero reported vulnerabilities after compatible patches.
- Existing Demo runtime/package manifests are unchanged. No deployment occurred.

## Implementation checklist

- [x] Reproduce the selected visual direction with real page elements and assets.
- [x] Clearly distinguish future workflow stages and current available skills.
- [x] Support real navigation, details, bilingual copy and responsive layouts.
- [x] Resolve recorded P2 visual and interaction findings; compare revised output.
- [x] Build and verify the local preview; retain browser evidence and source art.

## Follow-up polish

Optional: fine-tune subtle paper texture and individual illustration props after
user review. Motion is intentionally restrained and respects reduced motion.

## Image delivery follow-up (2026-10-17)

Compared the accepted production frame with the responsive-image build at equal
2056-pixel width and a 1112-pixel content crop (DPR 2). Full-view evidence:
`.artifacts/performance-comparison.jpg`. The composition, font, copy and palette
are unchanged; small workflow assets retain clean alpha edges. A 390 × 844 DPR 1
production-build check selected the 480-pixel hero, retained readable detail,
showed no overflow, and passed language/dialog navigation. Evidence:
`.artifacts/performance-phone-built.png`. No actionable P0/P1/P2 differences.
See `performance.md` for byte counts, cache scope and measurement limits.

final result: passed
