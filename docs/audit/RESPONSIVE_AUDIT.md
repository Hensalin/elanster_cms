# Responsive audit

Widths: 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920 px. Check: no sideways scrolling, nothing cut off, usable controls (screenshots reviewed at 375 and 768). Script: `tests/ui-resp.mjs`.

| Screen | Before | After |
|---|---|---|
| CMS dashboard | Cards collapsed on phones (fixed one-screen height) | Normal scrolling page, single column |
| CMS content list | Menu and list side by side, list cut off | Menu becomes a row of tabs above the list; table scrolls inside its card |
| CMS page editor | Fields and preview side by side, fields cut off | Fields above the preview |
| CMS article editor | Usable | Author field stacks on phones |
| CMS top bar | Buttons cut off at the right | Icons only on phones (search, bell, account, +) |
| CMS account, activity | Usable | Room above the bottom menu |
| Website: home, about, blog, article, contact, give, events, church life | No overflow at any width | No change needed |

Result: 54/54 CMS and 72/72 website checks without overflow.

---

## Round 2 — 19 Nov 2026, evening

| Width | Dashboard | Content | Media | Websites | Account | Bell window |
|---|---|---|---|---|---|---|
| 320 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 375 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 390 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 430 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 560 | ✓ | ✓ | ✓ | ✓ | ✓ | – |
| 768 | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| 1024 / 1280 / 1440 / 1920 | ✓ | ✓ | ✓ | ✓ | ✓ | – |

✓ = no sideways scrolling, content starts at the edge on phones (≤ 560 px) and uses the width. Fixed this round: content squeezed on phones (R2-10), bell window off-screen on phones (R2-09). We Are Zion: 28 pages at 1366 px and 390 px, no sideways scrolling.
