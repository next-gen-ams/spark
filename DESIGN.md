---
name: GMS Executive Project Tracker
description: A frosted executive operating ledger that carries discussions from agenda to owner to follow-up.
colors:
  active-blue: "#007fc8"
  focus-sky: "#009ae6"
  orange-primary: "#ff6632"
  action-blue: "#006fab"
  action-blue-hover: "#005c90"
  coral-atmosphere: "rgb(245 173 145 / .82)"
  sky-atmosphere: "rgb(131 191 229 / .82)"
  lavender-atmosphere: "rgb(173 164 207 / .72)"
  warm-white: "#f4f3ef"
  canvas-mist: "#f4f7f8"
  glass-surface: "rgb(255 255 255 / .66)"
  solid-surface: "#fff"
  ink: "#25282b"
  ink-soft: "#464546"
  ink-muted: "#536076"
  border-cool: "#d8e0e4"
  success-text: "#286450"
  success-wash: "#e4f4ed"
  review-text: "#345f7d"
  review-wash: "#e7f2f9"
  warning-text: "#8b472f"
  warning-wash: "#fff0e8"
typography:
  display:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "clamp(2rem, 4vw, 3.15rem)"
    fontWeight: 760
    lineHeight: 1.02
    letterSpacing: "-.035em"
  headline:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.55rem"
    fontWeight: 740
    lineHeight: 1.18
    letterSpacing: "-.025em"
  title:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1.05rem"
    letterSpacing: "-.015em"
  body:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: "1rem"
    lineHeight: 1.55
  label:
    fontFamily: "DM Sans, PingFang SC, Microsoft YaHei, sans-serif"
    fontSize: ".82rem"
    fontWeight: 700
rounded:
  nav: "10px"
  inset: "12px"
  detail: "14px"
  panel: "16px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "28px"
components:
  button-primary:
    backgroundColor: "{colors.orange-primary}"
    textColor: "{colors.solid-surface}"
    rounded: "{rounded.inset}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "#e85224"
    textColor: "{colors.solid-surface}"
  button-secondary:
    backgroundColor: "#eaf7fd"
    textColor: "#235c7b"
    rounded: "{rounded.inset}"
    padding: "0 16px"
    height: "44px"
  input:
    backgroundColor: "{colors.solid-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inset}"
    padding: "0 12px"
    height: "42px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.nav}"
    padding: "0 11px"
    height: "44px"
  nav-item-active:
    backgroundColor: "#eaf7fd"
    textColor: "#235c7b"
  panel-glass:
    backgroundColor: "{colors.glass-surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  access-gate:
    backgroundColor: "rgb(255 255 255 / .92)"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "30px"
    width: "430px"
  access-gate-primary:
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.solid-surface}"
    rounded: "{rounded.inset}"
    padding: "0 16px"
    height: "50px"
    width: "100%"
  profile-control:
    backgroundColor: "rgb(255 255 255 / .12)"
    textColor: "{colors.solid-surface}"
    rounded: "{rounded.inset}"
    padding: "5px 10px 5px 7px"
    height: "48px"
  status-ready:
    backgroundColor: "{colors.success-wash}"
    textColor: "{colors.success-text}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  status-in-review:
    backgroundColor: "{colors.review-wash}"
    textColor: "{colors.review-text}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
  status-needs-owner:
    backgroundColor: "{colors.warning-wash}"
    textColor: "{colors.warning-text}"
    rounded: "{rounded.pill}"
    padding: "0 8px"
    height: "24px"
---

# Design System: GMS Executive Project Tracker

## Overview

**Creative North Star: "The Executive Operating Ledger"**

The tracker is a calm, accountable workspace rather than a generic metric dashboard. A solid GMS Active Blue header establishes institutional identity; beneath it, a short mist navigation rail and a chronological agenda ledger keep attention on the next discussion, its owner and its follow-up.

The material language is frosted but disciplined. Coral, sky and lavender atmospheric bands sit behind translucent working surfaces, while crisp dividers, moderate radii and compact status marks preserve operational clarity. Decorative effects never compete with meeting preparation or decision capture.

**Key Characteristics:**

- GMS Active Blue identity anchored by the authentic white GMS 10 Years logo.
- DM Sans throughout, with compact labels and decisive display headings.
- A warm-white sticky sidebar beside a ledger-first central workspace.
- Frosted panels over coral, sky and lavender atmospheric fields.
- Crisp 1px separators, moderate corners and restrained shadows.
- Semantic status washes that communicate readiness without visual alarm.

## Colors

The palette pairs GMS Active Blue, Primary Orange and Operational Action Blue with quiet neutral working surfaces; coral, sky and lavender supply atmosphere, while green, cool blue and warm coral washes carry operational state.

### Primary

- **GMS Active Blue** (`#007fc8`): owns the signed-in brand header, access-card masthead and topic-drawer masthead.
- **Focus Sky** (`#009ae6`): marks active navigation, focus cues and functional icons.
- **GMS Primary Orange** (`#ff6632`): drives the signed-in workspace's main actions.
- **Operational Action Blue** (`#006fab`): drives Microsoft access, selected decision tabs and access-recovery actions.
- **Deep Action Blue** (`#005c90`): appears only as the primary-action hover state.

### Secondary

- **Coral Atmosphere** (`rgb(245 173 145 / .82)`): forms the warm left-side ambient band behind the workspace.
- **Sky Atmosphere** (`rgb(131 191 229 / .82)`): forms the cool upper-right ambient band and supports the action-blue family.

### Tertiary

- **Lavender Atmosphere** (`rgb(173 164 207 / .72)`): completes the lower-right ambient field without becoming an interactive accent.

### Neutral

- **Warm Navigation White** (`#f4f3ef`): gives the short sidebar and drawer tabs a grounded, paper-like tone.
- **Canvas Mist** (`#f4f7f8`): provides the cool fallback canvas when blur is unavailable.
- **Frosted Working Surface** (`rgb(255 255 255 / .66)`): holds agenda, decision and reminder panels while allowing the atmospheric field to remain visible.
- **Solid Working White** (`#fff`): gives inputs and detail cells maximum legibility.
- **Executive Ink** (`#25282b`): carries primary body and operational content.
- **Soft Executive Ink** (`#464546`): supports descriptions and inactive navigation.
- **Muted Ledger Ink** (`#536076`): carries metadata, captions and secondary labels.
- **Cool Divider** (`#d8e0e4`): separates navigation groups and form controls with a crisp 1px stroke.

### Named Rules

**The Atmosphere, Not Alert Rule.** Coral, sky and lavender belong to the background field; interactive urgency is expressed through restrained semantic washes, never large saturated blocks.

**The Action Role Rule.** Active Blue brands the shell, Orange drives signed-in workspace actions, and Operational Action Blue is reserved for Microsoft access and selected ledger state.

## Typography

**Display Font:** DM Sans (with PingFang SC, Microsoft YaHei and sans-serif fallbacks)  
**Body Font:** DM Sans (with PingFang SC, Microsoft YaHei and sans-serif fallbacks)

**Character:** A single variable sans family gives the workspace a modern executive voice without introducing editorial flourish. Dense metadata stays quiet; meeting and drawer titles become decisive through weight, scale and tight tracking rather than a second typeface.

### Hierarchy

- **Display** (weight 760, `clamp(2rem, 4vw, 3.15rem)`, line-height 1.02): page-level meeting and backlog titles.
- **Headline** (weight 740, `1.55rem`, line-height 1.18): the selected discussion title inside the side drawer.
- **Title** (`1.05rem`, letter-spacing `-.015em`): agenda, readiness and reminder panel headings.
- **Body** (`1rem`, line-height 1.55): introductions and explanatory copy, generally constrained to about 680px.
- **Label** (weight 700, `.82rem`): dates, form labels and operational metadata.

### Named Rules

**The Ledger Voice Rule.** Keep interface copy in sentence case and use weight before colour to establish hierarchy; reserve tabular numerals for counts, agenda order and time values.

## Layout

The desktop workspace is capped at 1480px and arranged as a 210px sticky sidebar plus a flexible main region with a 24px gutter. The meeting view then divides into a flexible agenda ledger and a 300px readiness rail with a 22px gap. Page padding is responsive through `clamp(20px, 4vw, 58px)`.

At 1120px, the sidebar contracts to 178px and the readiness rail to 260px. At 900px, persistent navigation becomes a mobile sheet, the page returns to one main column and readiness panels share two columns. At 680px, meeting actions stack, the agenda hides duration, rows reflow for wrapping titles, forms become single-column and the readiness rail becomes one column.

Before workspace verification, the app becomes a full-height access stage (`100dvh`) with one centered card capped at 430px. Desktop stage padding is 32px by 18px; at 680px and below it becomes 18px by 14px, the Active Blue masthead contracts from 72px to 66px, and body padding contracts from 30px to 24px by 20px. The card remains vertically centred and does not expose the workspace underneath.

The signed-in header is 76px high on desktop and 68px at tablet size. On mobile, the logo remains visible while the divider, product name and status badge recede; the account control retains the verified Graph display name within a 150px maximum, hides its secondary label and chevron, and truncates the visible name at 92px.

Spacing uses an 8px-led rhythm with compact 4px increments where dense operational controls need them. Agenda rows are deliberately generous at a minimum 88px high, while buttons and core controls preserve a 42–44px touch target.

**The Next Decision Rule.** The agenda ledger remains the widest and most legible surface; supporting readiness and reminder controls must not outgrow the work they explain.

## Elevation & Depth

Depth is a hybrid of tonal atmosphere, translucent surfaces and restrained ambient shadow. Core panels use a 26px blur with 120% saturation over the fixed background field; the warm-white sidebar uses the same material treatment but keeps a visible white edge. Solid forms and drawer cells stay opaque for reading precision.

### Shadow Vocabulary

- **Brand Header** (`0 8px 30px rgb(0 127 200 / .2)`): separates the Active Blue masthead from the workspace.
- **Working Panel** (`0 16px 40px rgb(37 40 43 / .1)`): gives agenda and meeting-support surfaces a quiet ambient lift.
- **Primary Action** (`0 8px 22px rgb(255 102 50 / .22)`): reinforces the signed-in workspace's Orange primary action without turning it into a floating object.
- **Field Lift** (`0 4px 14px rgb(37 58 85 / .07)`): distinguishes the search input inside a translucent toolbar.
- **Modal** (`0 28px 80px rgb(24 42 65 / .22)`): reserves the strongest elevation for temporary decision-making layers.
- **Access Gate** (`0 24px 70px rgb(37 58 85 / .15)`): lifts the single Microsoft entry card from the quiet authentication canvas.
- **Account Menu** (`0 18px 48px rgb(24 42 65 / .2)`): separates the verified Graph identity and sign-out action from the Active Blue header.

### Named Rules

**The Working Glass Rule.** Blur belongs to stable workspace surfaces, not every control; forms and detail cells remain solid, and the no-blur fallback returns panels to Canvas Mist.

## Shapes

The form language is moderately rounded and compact: navigation rows use 10px corners, inputs and inset tiles use 12px, structured detail groups and the account menu use 14px, and primary panels including the access card use 16px. Pills, avatars and count bubbles use fully rounded ends. Thin 1px borders and row dividers do most of the structural work; clipped panel edges keep ledger separators clean.

## Components

### Buttons

- **Shape:** Compact and assured, with 12px corners and a 44px minimum height for workspace actions.
- **Primary:** Signed-in workspace actions use GMS Primary Orange with white text, 16px horizontal padding and a restrained orange ambient shadow. The access gate deliberately uses Operational Action Blue for its 50px, full-width Microsoft action.
- **Hover / Focus:** Workspace actions deepen to `#e85224`; access actions shift to Deep Action Blue. Both use the shared sky focus ring, and reduced-motion users receive near-instant transitions.
- **Secondary / Ghost:** Secondary actions use a pale sky field with blue-grey text and a cool border where additional separation is needed. Header controls use translucent white against Active Blue.

### Chips

- **Style:** Status chips are 24px high pills with compact 8px horizontal padding, a 1px tinted border and a small state icon.
- **State:** Ready uses a green wash, In review uses a cool-blue wash and Needs owner uses a warm-coral wash. Chips describe state; they are not decorative tags.

### Cards / Containers

- **Corner Style:** Primary panels use 16px corners; inset summaries use 12–14px.
- **Background:** Agenda and meeting-support panels use Frosted Working Surface; form fields and detail cells use Solid Working White.
- **Shadow Strategy:** Stable panels receive the quiet Working Panel shadow; modal and sheet layers receive stronger separation.
- **Border:** Frosted content panels are borderless, but the sidebar, controls and internal divisions use crisp 1px strokes.
- **Internal Padding:** Dense panels use 20px; drawer panels and headers use 24–28px.

### Inputs / Fields

- **Style:** Solid white field, cool 1px border, 12px corner and 42–44px height. Search reserves 36px on the left for its icon.
- **Focus:** Border changes to Operational Action Blue with a translucent 3px ring.
- **Error / Disabled:** Invalid fields use the destructive red token and ring; disabled fields reduce opacity and block pointer interaction.

### Navigation

The desktop rail is a short sticky warm-white glass surface. Items are 44px high with 10px corners, muted ink at rest, a white veil on hover and pale sky with stronger blue text and icon for the active view. At 900px and below, navigation moves into a left sheet while the top-level content retains the same selection model.

### Brand Header

The shipped header is a solid GMS Active Blue band (`#007fc8`) with a 76px desktop minimum height, a 68px tablet minimum height and the authentic white GMS 10 Years logo. Its shadow uses the same blue family (`0 8px 30px rgb(0 127 200 / .2)`) so identity remains crisp without reverting to navy.

### Microsoft Access Gate

The gate is intentionally minimal: one centered 430px card, one Active Blue brand masthead, one Microsoft mark, one state-specific heading and explanation, one dominant action or progress/configuration notice, and one short assurance block. It supports disconnected, checking, authentication error, unconfigured and workspace-error states. Only the workspace-error state adds the verified profile row and a quiet sign-out alternative; no dashboard previews, feature lists or marketing copy appear before access is verified.

### Header Account Control and Menu

After Microsoft Graph verifies the user, the header replaces a generic sign-in label with a 48px translucent account control containing a 34px initials avatar, the Graph display name, a quiet “Microsoft account” label and a chevron. Opening the control rotates the chevron and reveals a 286px solid menu with the verified display name and email, followed by one 40px sign-out item. Long identity strings truncate rather than widening the header.

**The Verified Workspace Rule.** Render the operating ledger only after both Microsoft profile verification and shared-workspace access succeed; every earlier state stays inside the centred gate.

### Agenda Ledger Row

The signature row uses an 88px minimum height, a fixed two-digit order column, a flexible title-and-metadata column, duration and a directional chevron. Fine 1px dividers create continuity; hover adds a white veil and nudges the chevron 3px toward the detail drawer. Keyboard focus stays inside the row with a 3px inset blue outline.

### Topic Drawer Tabs

The 640px topic drawer uses an Active Blue masthead, a warm-white 52px tab rail and a solid cool-white body. Tabs are square to the rail and identify the active section with a 3px Focus Sky underline, keeping decision and reminder work close to the selected agenda item.

## Do's and Don'ts

### Do:

- **Do** keep the authentic white GMS 10 Years logo on the solid Active Blue header and access-card masthead.
- **Do** keep the pre-authentication experience to one centred card with one dominant Microsoft action.
- **Do** use the Microsoft Graph display name in the signed-in account control and show the email only inside the account menu or a relevant error state.
- **Do** preserve the ledger sequence: order, discussion, state, owner, duration and entry to detail.
- **Do** use 1px dividers and muted metadata to make dense information scannable.
- **Do** reserve the 16px panel radius for major surfaces and 10–14px radii for nested controls.
- **Do** keep controls keyboard-operable with visible blue focus treatment and respect reduced motion.

### Don't:

- **Don't** replace the operating ledger with generic KPI cards or decorative dashboard tiles.
- **Don't** use coral, sky or lavender atmospheric colours as competing primary actions.
- **Don't** apply frosted blur to forms, detail cells or every small control.
- **Don't** introduce oversized pills, excessive shadows or ornamental gradients inside operational content.
- **Don't** imply that sample data or simulated Microsoft integrations are live.
- **Don't** reveal the operating ledger until both the Microsoft profile and shared workspace access have been verified.
- **Don't** add feature lists, dashboard previews or promotional content to the access gate.
