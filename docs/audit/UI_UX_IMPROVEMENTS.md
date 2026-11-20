# UI/UX improvements

| # | Screen | Problem | Change | Status |
|---|---|---|---|---|
| 1 | All screens on phones/tablets | Desktop rules overrode the small-screen rules: content list squeezed beside the menu, page editor cut off, dashboard cards collapsed, top bar buttons cut | Single-column layout under 980 px, normal scrolling dashboard, compact top bar (icons only), tables scroll inside their card, room above the bottom menu | Done, tested at 9 widths |
| 2 | Article and page editors | A second person's save could silently replace your work | Clear message: "Someone else saved this … after you opened it" | Done |
| 3 | All screens | Grey hint text too light to read for many people | Darker grey; orange and green text darkened to readable shades | Done (0 contrast failures) |
| 4 | Image box in the article editor | Screen readers announced a button inside a button | Box is a button only when empty | Done |
| 5 | Page editor filters / preview size | Wrong screen-reader roles | Toggle buttons with pressed state | Done |
| 6 | Sign-in | Database outage showed "Server error" | Plain message saying the CMS cannot reach its database | Done |

Earlier in the project (already delivered): page review workflow, suggested changes for live articles, author field at the top, week calendar, dashboard motion with reduced-motion support, plain field names, edited-only filter, unsaved counter.

Recommended next: a clear "who is editing this now" indicator; an empty-state guide on a brand-new website; keyboard shortcuts list (press `?`).

---

## Round 2 — 19 Nov 2026, evening

- **Notification bell:** shows only what is new; closing it or opening an item clears it; "Mark all as read"; "Show earlier (N)" for seen ones; on phones the window spans the screen.
- **Phones:** content uses the full width (was squeezed into 260 px of a 390 px screen).
- **Safer actions:** Unpublish (4 places) and turning a website off now ask first.
- **No silent buttons:** empty category name explains what is missing; copy buttons say when copying is not possible.
- **Less noise for Editors:** no Sync button and no automatic sync errors; admin-only buttons hidden on the Pages screen.
