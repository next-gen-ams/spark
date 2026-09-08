---
name: GMS Executive Project Tracker
description: A frosted executive operating ledger that carries discussions from agenda to owner to follow-up.
colors:
  brand-navy: "#243e63"
  action-blue: "#006fab"
  action-blue-hover: "#005c90"
  coral-atmosphere: "rgb(245 173 145 / .82)"
  sky-atmosphere: "rgb(131 191 229 / .82)"
  lavender-atmosphere: "rgb(173 164 207 / .72)"
  warm-white: "#f4f3ef"
  canvas-mist: "#eef2f8"
  glass-surface: "rgb(255 255 255 / .54)"
  solid-surface: "#fff"
  ink: "#2c3345"
  ink-soft: "#4b596d"
  ink-muted: "#536076"
  border-cool: "#ccd5e1"
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
    backgroundColor: "{colors.action-blue}"
    textColor: "{colors.solid-surface}"
    rounded: "{rounded.inset}"
    padding: "0 16px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.action-blue-hover}"
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

The tracker is a calm, accountable workspace rather than a generic metric dashboard. A solid GMS navy header establishes institutional identity; beneath it, a short warm-white navigation rail and a chronological agenda ledger keep attention on the next discussion, its owner and its follow-up.

The material language is frosted but disciplined. Coral, sky and lavender atmospheric bands sit behind translucent working surfaces, while crisp dividers, moderate radii and compact status marks preserve operational clarity. Decorative effects never compete with meeting preparation or decision capture.

**Key Characteristics:**

- GMS navy identity anchored by the authentic white GMS 10 Years logo.
- DM Sans throughout, with compact labels and decisive display headings.
- A warm-white sticky sidebar beside a ledger-first central workspace.
- Frosted panels over coral, sky and lavender atmospheric fields.
- Crisp 1px separators, moderate corners and restrained shadows.
- Semantic status washes that communicate readiness without visual alarm.

## Colors

The palette pairs institutional navy and action blue with warm neutral working surfaces; coral, sky and lavender supply atmosphere, while green, cool blue and warm coral washes carry operational state.

### Primary

- **GMS Institutional Navy** (`#243e63`): owns the brand header, key headings and the topic-drawer masthead.
- **Operational Action Blue** (`#006fab`): marks primary actions, active navigation, focus cues and functional icons.
- **Deep Action Blue** (`#005c90`): appears only as the primary-action hover state.

### Secondary

- **Coral Atmosphere** (`rgb(245 173 145 / .82)`): forms the warm left-side ambient band behind the workspace.
- **Sky Atmosphere** (`rgb(131 191 229 / .82)`): forms the cool upper-right ambient band and supports the action-blue family.

### Tertiary

- **Lavender Atmosphere** (`rgb(173 164 207 / .72)`): completes the lower-right ambient field without becoming an interactive accent.

### Neutral

- **Warm Navigation White** (`#f4f3ef`): gives the short sidebar and drawer tabs a grounded, paper-like tone.
- **Canvas Mist** (`#eef2f8`): provides the cool fallback canvas when blur is unavailable.
- **Frosted Working Surface** (`rgb(255 255 255 / .54)`): holds agenda, readiness and reminder panels while allowing the atmospheric field to remain visible.
- **Solid Working White** (`#fff`): gives inputs and detail cells maximum legibility.
- **Executive Ink** (`#2c3345`): carries primary body and operational content.
- **Soft Executive Ink** (`#4b596d`): supports descriptions and inactive navigation.
- **Muted Ledger Ink** (`#536076`): carries metadata, captions and secondary labels.
- **Cool Divider** (`#ccd5e1`): separates navigation groups and form controls with a crisp 1px stroke.

### Named Rules

**The Atmosphere, Not Alert Rule.** Coral, sky and lavender belong to the background field; interactive urgency is expressed through restrained semantic washes, never large saturated blocks.

**The One Action Blue Rule.** Use action blue for genuine controls, focus and current state; do not scatter it across passive decoration.

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

Spacing uses an 8px-led rhythm with compact 4px increments where dense operational controls need them. Agenda rows are deliberately generous at a minimum 88px high, while buttons and core controls preserve a 42–44px touch target.

**The Next Decision Rule.** The agenda ledger remains the widest and most legible surface; supporting readiness and reminder controls must not outgrow the work they explain.

## Elevation & Depth

Depth is a hybrid of tonal atmosphere, translucent surfaces and restrained ambient shadow. Core panels use a 26px blur with 120% saturation over the fixed background field; the warm-white sidebar uses the same material treatment but keeps a visible white edge. Solid forms and drawer cells stay opaque for reading precision.

### Shadow Vocabulary

- **Brand Header** (`0 8px 30px rgb(17 34 58 / .18)`): separates the institutional masthead from the workspace.
- **Working Panel** (`0 16px 40px rgb(37 58 85 / .11)`): gives agenda and meeting-support surfaces a quiet ambient lift.
- **Primary Action** (`0 8px 22px rgb(0 111 171 / .18)`): reinforces the one dominant action without turning it into a floating object.
- **Field Lift** (`0 4px 14px rgb(37 58 85 / .07)`): distinguishes the search input inside a translucent toolbar.
- **Modal** (`0 28px 80px rgb(24 42 65 / .22)`): reserves the strongest elevation for temporary decision-making layers.

### Named Rules

**The Working Glass Rule.** Blur belongs to stable workspace surfaces, not every control; forms and detail cells remain solid, and the no-blur fallback returns panels to Canvas Mist.

## Shapes

The form language is moderately rounded and compact: navigation rows use 10px corners, inputs and inset tiles use 12px, structured detail groups use 14px, and primary panels use 16px. Pills and count bubbles use fully rounded ends. Thin 1px borders and row dividers do most of the structural work; clipped panel edges keep ledger separators clean.

## Components

### Buttons

- **Shape:** Compact and assured, with 12px corners and a 44px minimum height for workspace actions.
- **Primary:** Operational Action Blue with white text, 16px horizontal padding and a restrained blue ambient shadow.
- **Hover / Focus:** Hover shifts to Deep Action Blue; focus uses the shared blue ring, and reduced-motion users receive near-instant transitions.
- **Secondary / Ghost:** Secondary actions use a pale sky field with blue-grey text and a cool border where additional separation is needed. Header ghost actions use translucent white against navy.

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

### Agenda Ledger Row

The signature row uses an 88px minimum height, a fixed two-digit order column, a flexible title-and-metadata column, duration and a directional chevron. Fine 1px dividers create continuity; hover adds a white veil and nudges the chevron 3px toward the detail drawer. Keyboard focus stays inside the row with a 3px inset blue outline.

### Topic Drawer Tabs

The 640px topic drawer uses a navy masthead, a warm-white 52px tab rail and a solid cool-white body. Tabs are square to the rail and identify the active section with a 3px action-blue underline, keeping overview, decision and reminders close to the selected agenda item.

## Do's and Don'ts

### Do:

- **Do** keep the authentic white GMS 10 Years logo on the solid navy header.
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
