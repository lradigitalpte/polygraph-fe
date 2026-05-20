# Design Language: Tebra - EHR and practice management software built for private practices

> Extracted from `https://www.tebra.com/` on April 20, 2026
> 2000 elements analyzed

This document describes the complete design language of the website. It is structured for AI/LLM consumption — use it to faithfully recreate the visual design in any framework.

## Color Palette

### Primary Colors

| Role | Hex | RGB | HSL | Usage Count |
|------|-----|-----|-----|-------------|
| Primary | `#ff8d6e` | rgb(255, 141, 110) | hsl(13, 100%, 72%) | 24 |
| Secondary | `#004952` | rgb(0, 73, 82) | hsl(187, 100%, 16%) | 123 |
| Accent | `#3860be` | rgb(56, 96, 190) | hsl(222, 54%, 48%) | 4 |

### Neutral Colors

| Hex | HSL | Usage Count |
|-----|-----|-------------|
| `#000000` | hsl(0, 0%, 0%) | 360 |
| `#232323` | hsl(0, 0%, 14%) | 192 |
| `#ffffff` | hsl(0, 0%, 100%) | 59 |
| `#555555` | hsl(0, 0%, 33%) | 31 |
| `#dcdcdc` | hsl(0, 0%, 86%) | 9 |
| `#8ca7a2` | hsl(169, 13%, 60%) | 6 |
| `#696969` | hsl(0, 0%, 41%) | 6 |
| `#000a0c` | hsl(190, 100%, 2%) | 5 |
| `#c5d6d7` | hsl(183, 18%, 81%) | 4 |
| `#767676` | hsl(0, 0%, 46%) | 3 |
| `#bbbbbb` | hsl(0, 0%, 73%) | 1 |

### Background Colors

Used on large-area elements: `#ffffff`, `#004952`, `#f5f8f8`, `#8ca7a2`, `#ebf0ef`, `#f6f8f8`, `#f8f3eb`, `#fdfbfb`, `#ff8d6e`, `#efefef`, `#000000`

### Text Colors

Text color palette: `#000000`, `#003a43`, `#232323`, `#004952`, `#f8f3eb`, `#2b2b2b`, `#ffffff`, `#555555`, `#3860be`, `#696969`

### Gradients

```css
background-image: linear-gradient(90deg, rgb(255, 141, 110) 0.17%, rgb(248, 243, 235) 187.97%);
```

### Full Color Inventory

| Hex | Contexts | Count |
|-----|----------|-------|
| `#003a43` | text, border | 2377 |
| `#f8f3eb` | text, border, background | 666 |
| `#000000` | text, border, background | 360 |
| `#232323` | text, border | 192 |
| `#004952` | background, text, border | 123 |
| `#ffffff` | background, border, text | 59 |
| `#555555` | text, border | 31 |
| `#ff8d6e` | background, border | 24 |
| `#dcdcdc` | background, border | 9 |
| `#27455c` | background | 8 |
| `#8ca7a2` | background | 6 |
| `#696969` | text, border | 6 |
| `#000a0c` | text, border | 5 |
| `#c5d6d7` | border | 4 |
| `#3860be` | text, border, background | 4 |
| `#767676` | background, border | 3 |
| `#e0d3c8` | background | 1 |
| `#3a6d71` | border | 1 |
| `#32ae88` | border | 1 |
| `#468254` | background | 1 |
| `#bbbbbb` | border | 1 |
| `#6aaae4` | background | 1 |

## Typography

### Font Families

- **__AkkuratLL_8dc0fd** — used for all (1118 elements)
- **__Lora_e96844** — used for body (718 elements)
- **Times New Roman** — used for body (147 elements)
- **Poppins** — used for body (11 elements)
- **Arial** — used for body (4 elements)
- **__AkkuratMonoLL_c826bb** — used for body (2 elements)

### Type Scale

| Size (px) | Size (rem) | Weight | Line Height | Letter Spacing | Used On |
|-----------|------------|--------|-------------|----------------|---------|
| 68px | 4.25rem | 400 | 81.6px | -2.72px | h1 |
| 60px | 3.75rem | 400 | 72px | -2.4px | h2, span, br |
| 50px | 3.125rem | 700 | normal | normal | div |
| 48px | 3rem | 400 | 57.6px | -1.44px | h2, span |
| 36px | 2.25rem | 400 | 43.2px | -0.72px | h3, h2 |
| 26.32px | 1.645rem | 700 | 36.848px | normal | div, p |
| 24px | 1.5rem | 300 | 34px | normal | div, h3, p, span |
| 22px | 1.375rem | 400 | 26.4px | -0.44px | span, h3, h5, h6 |
| 21px | 1.3125rem | 500 | 24px | normal | div, svg, path, p |
| 18px | 1.125rem | 400 | 29px | normal | li, span, p, button |
| 16px | 1rem | 400 | 18.4px | normal | html, head, meta, link |
| 15.82px | 0.9888rem | 400 | 24.521px | normal | div, p |
| 15.3px | 0.9563rem | 400 | normal | normal | span |
| 14.4px | 0.9rem | 700 | 14.4px | 0.144px | button, svg, title, g |
| 14px | 0.875rem | 300 | 20px | normal | p, div, span, h4 |

### Heading Scale

```css
h1 { font-size: 68px; font-weight: 400; line-height: 81.6px; }
h2 { font-size: 60px; font-weight: 400; line-height: 72px; }
h2 { font-size: 48px; font-weight: 400; line-height: 57.6px; }
h3 { font-size: 36px; font-weight: 400; line-height: 43.2px; }
h3 { font-size: 24px; font-weight: 300; line-height: 34px; }
h3 { font-size: 22px; font-weight: 400; line-height: 26.4px; }
h3 { font-size: 18px; font-weight: 400; line-height: 29px; }
h2 { font-size: 16px; font-weight: 400; line-height: 18.4px; }
h4 { font-size: 14px; font-weight: 300; line-height: 20px; }
```

### Body Text

```css
body { font-size: 18px; font-weight: 400; line-height: 29px; }
```

### Font Weights in Use

`400` (1813x), `300` (134x), `700` (32x), `500` (12x), `600` (9x)

## Spacing

**Base unit:** 2px

| Token | Value | Rem |
|-------|-------|-----|
| spacing-1 | 1px | 0.0625rem |
| spacing-15 | 15px | 0.9375rem |
| spacing-30 | 30px | 1.875rem |
| spacing-35 | 35px | 2.1875rem |
| spacing-40 | 40px | 2.5rem |
| spacing-47 | 47px | 2.9375rem |
| spacing-52 | 52px | 3.25rem |
| spacing-56 | 56px | 3.5rem |
| spacing-64 | 64px | 4rem |
| spacing-78 | 78px | 4.875rem |
| spacing-103 | 103px | 6.4375rem |
| spacing-107 | 107px | 6.6875rem |
| spacing-116 | 116px | 7.25rem |
| spacing-136 | 136px | 8.5rem |
| spacing-145 | 145px | 9.0625rem |
| spacing-180 | 180px | 11.25rem |
| spacing-184 | 184px | 11.5rem |
| spacing-199 | 199px | 12.4375rem |
| spacing-268 | 268px | 16.75rem |
| spacing-308 | 308px | 19.25rem |

## Border Radii

| Label | Value | Count |
|-------|-------|-------|
| xs | 1px | 8 |
| sm | 4px | 2 |
| md | 7px | 2 |
| md | 10px | 1 |
| lg | 16px | 4 |
| xl | 20px | 4 |
| xl | 24px | 14 |
| full | 30px | 3 |
| full | 50px | 5 |
| full | 57px | 20 |
| full | 60px | 1 |
| full | 100px | 29 |

## Box Shadows

**xs (inset)** — blur: 0px
```css
box-shadow: rgb(220, 220, 220) 0px -1px 0px 0px inset;
```

**md** — blur: 5px
```css
box-shadow: rgb(199, 197, 199) -3px -3px 5px -2px;
```

**md** — blur: 10px
```css
box-shadow: rgb(153, 153, 153) 0px 2px 10px -3px;
```

**md** — blur: 12px
```css
box-shadow: rgb(199, 197, 199) 0px 0px 12px 2px;
```

**md** — blur: 8px
```css
box-shadow: rgba(0, 0, 0, 0.2) 0px 4px 8px 0px;
```

**md** — blur: 10px
```css
box-shadow: rgba(0, 0, 0, 0.15) 0px 5px 10px 0px;
```

**lg** — blur: 18px
```css
box-shadow: rgba(0, 0, 0, 0.2) 0px 0px 18px 0px;
```

**lg** — blur: 10.1px
```css
box-shadow: rgba(0, 0, 0, 0.1) 0px 10.1px 10.1px -5.05px, rgba(0, 0, 0, 0.04) 0px 20.2px 25.25px -5.05px;
```

**xl** — blur: 40px
```css
box-shadow: rgba(43, 43, 43, 0.16) 0px 16px 40px 0px;
```

**xl** — blur: 60.28px
```css
box-shadow: rgba(0, 0, 0, 0.07) -2.47px 4.94px 60.28px 0px;
```

## CSS Custom Properties

### Spacing

```css
--containerPadding: 80px;
```

### Other

```css
--containerBaseWidth: 1280px;
--containerWidth: calc(var(--containerBaseWidth) + 2 * var(--containerPadding));
--gutter: 16px;
--app-height: 100vh;
--navBannerHeight: 64px;
```

### Dependencies

```css
--containerWidth: --containerBaseWidth,--containerPadding;
```

### Semantic

```css
success: [object Object];
warning: [object Object];
error: [object Object];
info: [object Object];
```

## Breakpoints

| Name | Value | Type |
|------|-------|------|
| xs | 374px | max-width |
| 400px | 400px | min-width |
| sm | 425px | max-width |
| sm | 426px | min-width |
| sm | 480px | max-width |
| sm | 500px | max-width |
| sm | 530px | max-width |
| 550px | 550px | min-width |
| sm | 600px | max-width |
| sm | 640px | max-width |
| md | 768px | min-width |
| 860px | 860px | max-width |
| 896px | 896px | max-width |
| lg | 960px | min-width |
| lg | 969px | max-width |
| lg | 1024px | max-width |
| lg | 1040px | min-width |
| lg | 1060px | max-width |
| 1140px | 1140px | max-width |
| 1141px | 1141px | min-width |
| 1142px | 1142px | max-width |
| 1200px | 1200px | max-width |
| xl | 1230px | max-width |
| xl | 1280px | max-width |
| xl | 1310px | max-width |
| 1360px | 1360px | max-width |
| 1420px | 1420px | max-width |
| 1440px | 1440px | max-width |
| 1660px | 1660px | max-width |
| 1920px | 1920px | max-width |
| 2280px | 2280px | min-width |

## Transitions & Animations

**Easing functions:** `[object Object]`, `[object Object]`, `[object Object]`, `[object Object]`

**Durations:** `0.3s`, `0.15s`, `0.6s`, `0.2s`, `0.4s`, `0.33s`, `0.9s`, `0.8s`, `0.7s`, `0.35s`, `0.25s`, `0.1s`

### Common Transitions

```css
transition: all;
transition: 0.3s linear;
transition: background-color 0.3s ease-in-out;
transition: background-color 0.15s ease-in-out;
transition: transform 0.6s cubic-bezier(0.94, 0.01, 0.08, 0.99), opacity 0.6s cubic-bezier(0.94, 0.01, 0.08, 0.99), visibility 0.6s cubic-bezier(0.94, 0.01, 0.08, 0.99);
transition: box-shadow 0.3s ease-in-out;
transition: color 0.2s ease-in-out;
transition: background 0.4s cubic-bezier(0.8, 0, 0.2, 1);
transition: border-color 0.2s ease-in-out;
transition: stroke 0.2s ease-in-out;
```

### Keyframe Animations

**pulse**
```css
@keyframes pulse {
  0% { transform: scale(0); }
  20% { transform: scale(1.1); }
  40% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  60% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

**pulseInOut**
```css
@keyframes pulseInOut {
  0% { transform: scale(0); }
  10% { transform: scale(1.1); }
  20% { transform: scale(0.95); }
  25% { transform: scale(1.05); }
  30% { transform: scale(1); }
  80% { transform: scale(1); }
  100% { transform: scale(0); }
}
```

**pulseNext**
```css
@keyframes pulseNext {
  0% { transform: scale(1); }
  3% { transform: scale(0.5); }
  6% { transform: scale(1.1); }
  8% { transform: scale(0.95); }
  10% { transform: scale(1.05); }
  12% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

**styles_pulse__zGA2g**
```css
@keyframes styles_pulse__zGA2g {
  0% { transform: scale(0); }
  20% { transform: scale(1.1); }
  40% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  60% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

**styles_pulseInOut__pKJQ3**
```css
@keyframes styles_pulseInOut__pKJQ3 {
  0% { transform: scale(0); }
  10% { transform: scale(1.1); }
  20% { transform: scale(0.95); }
  25% { transform: scale(1.05); }
  30% { transform: scale(1); }
  80% { transform: scale(1); }
  100% { transform: scale(0); }
}
```

**styles_pulseNext__iMZRV**
```css
@keyframes styles_pulseNext__iMZRV {
  0% { transform: scale(1); }
  3% { transform: scale(0.5); }
  6% { transform: scale(1.1); }
  8% { transform: scale(0.95); }
  10% { transform: scale(1.05); }
  12% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

**Container_pulse__PI3OD**
```css
@keyframes Container_pulse__PI3OD {
  0% { transform: scale(0); }
  20% { transform: scale(1.1); }
  40% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  60% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

**Container_pulseInOut__epg0R**
```css
@keyframes Container_pulseInOut__epg0R {
  0% { transform: scale(0); }
  10% { transform: scale(1.1); }
  20% { transform: scale(0.95); }
  25% { transform: scale(1.05); }
  30% { transform: scale(1); }
  80% { transform: scale(1); }
  100% { transform: scale(0); }
}
```

**Container_pulseNext__sCPwC**
```css
@keyframes Container_pulseNext__sCPwC {
  0% { transform: scale(1); }
  3% { transform: scale(0.5); }
  6% { transform: scale(1.1); }
  8% { transform: scale(0.95); }
  10% { transform: scale(1.05); }
  12% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

**Col_pulse__vMVy_**
```css
@keyframes Col_pulse__vMVy_ {
  0% { transform: scale(0); }
  20% { transform: scale(1.1); }
  40% { transform: scale(0.95); }
  50% { transform: scale(1.05); }
  60% { transform: scale(1); }
  100% { transform: scale(1); }
}
```

## Component Patterns

Detected UI component patterns and their most common styles:

### Buttons (60 instances)

```css
.button {
  background-color: rgb(255, 141, 110);
  color: rgb(0, 58, 67);
  font-size: 16px;
  font-weight: 400;
  padding-top: 5px;
  padding-right: 22px;
  border-radius: 57px;
}
```

### Cards (136 instances)

```css
.card {
  background-color: rgb(255, 255, 255);
  border-radius: 0px;
  box-shadow: rgba(43, 43, 43, 0.16) 0px 16px 40px 0px;
  padding-top: 0px;
  padding-right: 0px;
}
```

### Inputs (8 instances)

```css
.input {
  background-color: rgb(255, 255, 255);
  color: rgb(0, 0, 0);
  border-color: rgb(0, 0, 0);
  border-radius: 0px;
  font-size: 16px;
  padding-top: 0px;
  padding-right: 0px;
}
```

### Links (156 instances)

```css
.link {
  color: rgb(248, 243, 235);
  font-size: 18px;
  font-weight: 400;
}
```

### Navigation (284 instances)

```css
.navigatio {
  background-color: rgb(255, 255, 255);
  color: rgb(0, 58, 67);
  padding-top: 0px;
  padding-bottom: 0px;
  padding-left: 0px;
  padding-right: 0px;
  position: static;
  box-shadow: rgba(43, 43, 43, 0.16) 0px 16px 40px 0px;
}
```

### Footer (283 instances)

```css
.foote {
  background-color: rgb(0, 73, 82);
  color: rgb(248, 243, 235);
  padding-top: 0px;
  padding-bottom: 0px;
  font-size: 18px;
}
```

### Modals (9 instances)

```css
.modal {
  background-color: rgb(255, 255, 255);
  border-radius: 0px;
  box-shadow: rgba(0, 0, 0, 0.07) -2.47px 4.94px 60.28px 0px;
  padding-top: 0px;
  padding-right: 0px;
  max-width: 842px;
}
```

### Dropdowns (471 instances)

```css
.dropdown {
  background-color: rgb(255, 255, 255);
  border-radius: 0px;
  box-shadow: rgba(43, 43, 43, 0.16) 0px 16px 40px 0px;
  border-color: rgb(248, 243, 235);
  padding-top: 0px;
}
```

### Badges (20 instances)

```css
.badge {
  color: rgb(0, 58, 67);
  font-size: 16px;
  font-weight: 400;
  padding-top: 0px;
  padding-right: 0px;
  border-radius: 0px;
}
```

### Avatars (6 instances)

```css
.avatar {
  border-radius: 0px;
}
```

### Tabs (3 instances)

```css
.tab {
  background-color: rgb(235, 240, 241);
  color: rgb(0, 58, 67);
  font-size: 16px;
  font-weight: 400;
  padding-top: 16px;
  padding-right: 40px;
  border-color: rgb(0, 58, 67);
  border-radius: 100px;
}
```

### Accordions (54 instances)

```css
.accordion {
  background-color: rgba(140, 167, 162, 0.16);
  color: rgb(0, 58, 67);
  font-size: 16px;
  padding-top: 0px;
  padding-right: 0px;
  border-color: rgba(0, 73, 82, 0.88);
}
```

### Switches (9 instances)

```css
.switche {
  background-color: rgb(118, 118, 118);
  border-radius: 0px;
  border-color: rgb(0, 0, 0);
}
```

## Component Clusters

Reusable component instances grouped by DOM structure and style similarity:

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(35, 35, 35);
  padding: 5px 22px 5px 22px;
  border-radius: 57px;
  border: 1px solid rgba(0, 0, 0, 0);
  font-size: 18px;
  font-weight: 400;
```

### Button — 2 instances, 2 variants

**Variant 1** (1 instance)

```css
  background: rgb(235, 240, 241);
  color: rgb(0, 58, 67);
  padding: 16px 40px 16px 40px;
  border-radius: 100px;
  border: 0px none rgb(0, 58, 67);
  font-size: 16px;
  font-weight: 400;
```

**Variant 2** (1 instance)

```css
  background: rgb(0, 73, 82);
  color: rgb(248, 243, 235);
  padding: 16px 40px 16px 40px;
  border-radius: 100px;
  border: 0px none rgb(248, 243, 235);
  font-size: 16px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgb(235, 240, 241);
  color: rgb(0, 58, 67);
  padding: 16px 40px 16px 40px;
  border-radius: 100px;
  border: 0px none rgb(0, 58, 67);
  font-size: 16px;
  font-weight: 400;
```

### Button — 2 instances, 1 variant

**Variant 1** (2 instances)

```css
  background: rgba(255, 255, 255, 0.72);
  color: rgb(0, 73, 82);
  padding: 5px 5px 5px 5px;
  border-radius: 4px;
  border: 1px solid rgb(0, 73, 82);
  font-size: 18px;
  font-weight: 400;
```

### Button — 5 instances, 1 variant

**Variant 1** (5 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(0, 58, 67);
  padding: 24px 64px 24px 16px;
  border-radius: 0px;
  border: 0px none rgb(0, 58, 67);
  font-size: 16px;
  font-weight: 400;
```

### Button — 6 instances, 3 variants

**Variant 1** (2 instances)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(0, 73, 82);
  padding: 5px 22px 5px 22px;
  border-radius: 57px;
  border: 1px solid rgb(0, 73, 82);
  font-size: 18px;
  font-weight: 400;
```

**Variant 2** (2 instances)

```css
  background: rgb(239, 239, 239);
  color: rgb(0, 0, 0);
  padding: 1px 6px 1px 6px;
  border-radius: 0px;
  border: 2px outset rgb(0, 0, 0);
  font-size: 16px;
  font-weight: 400;
```

**Variant 3** (2 instances)

```css
  background: rgb(0, 73, 82);
  color: rgb(255, 255, 255);
  padding: 12px 10px 12px 10px;
  border-radius: 2px;
  border: 1px solid rgb(0, 73, 82);
  font-size: 11.382px;
  font-weight: 600;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgb(255, 255, 255);
  color: rgb(0, 0, 0);
  padding: 0px 0px 0px 0px;
  border-radius: 50%;
  border: 0px none rgb(0, 0, 0);
  font-size: 16px;
  font-weight: 400;
```

### Button — 1 instance, 1 variant

**Variant 1** (1 instance)

```css
  background: rgba(0, 0, 0, 0);
  color: rgb(0, 58, 67);
  padding: 15px 30px 15px 30px;
  border-radius: 0px;
  border: 0px none rgb(0, 58, 67);
  font-size: 14px;
  font-weight: 400;
```

## Layout System

**5 grid containers** and **340 flex containers** detected.

### Container Widths

| Max Width | Padding |
|-----------|---------|
| 1440px | 20px |
| 632px | 0px |
| 732px | 0px |
| 100% | 0px |
| 416px | 40px |
| 420px | 0px |
| 741px | 0px |
| 1145px | 0px |
| 1100px | 0px |
| 1280px | 0px |
| 848px | 0px |
| 842px | 0px |
| 650px | 0px |

### Grid Column Patterns

| Columns | Usage Count |
|---------|-------------|
| 3-column | 2x |
| 1-column | 2x |
| 2-column | 1x |

### Grid Templates

```css
grid-template-columns: 362.656px 362.672px 362.656px;
gap: 16px;
grid-template-columns: 64px 1152px 64px;
grid-template-columns: 50% 50%;
grid-template-columns: 100%;
grid-template-columns: 100%;
```

### Flex Patterns

| Direction/Wrap | Count |
|----------------|-------|
| row/nowrap | 264x |
| column/nowrap | 60x |
| row/wrap | 16x |

**Gap values:** `0px 11.67px`, `10px`, `12px`, `16px`, `22px`, `24px`, `32px`, `40px`, `48px`, `4px`, `6px`, `8px`

## Accessibility (WCAG 2.1)

**Overall Score: 100%** — 19 passing, 0 failing color pairs

### Passing Color Pairs

| Foreground | Background | Ratio | Level |
|------------|------------|-------|-------|
| `#232323` | `#ff8d6e` | 6.95:1 | AAA |
| `#ffffff` | `#004952` | 10.12:1 | AAA |
| `#232323` | `#f8f3eb` | 14.23:1 | AAA |
| `#004952` | `#ffffff` | 10.12:1 | AAA |

## Design System Score

**Overall: 75/100 (Grade: C)**

| Category | Score |
|----------|-------|
| Color Discipline | 92/100 |
| Typography Consistency | 40/100 |
| Spacing System | 85/100 |
| Shadow Consistency | 90/100 |
| Border Radius Consistency | 65/100 |
| Accessibility | 100/100 |
| CSS Tokenization | 75/100 |

**Strengths:** Tight, disciplined color palette, Well-defined spacing scale, Clean elevation system, Strong accessibility compliance, Good CSS variable tokenization

**Issues:**
- 6 font families — consider limiting to 2 (heading + body)
- 23 distinct font sizes — consider a tighter type scale
- 345 !important rules — prefer specificity over overrides
- 92% of CSS is unused — consider purging
- 12466 duplicate CSS declarations

## Gradients

**1 unique gradients** detected.

| Type | Direction | Stops | Classification |
|------|-----------|-------|----------------|
| linear | 90deg | 2 | brand |

```css
background: linear-gradient(90deg, rgb(255, 141, 110) 0.17%, rgb(248, 243, 235) 187.97%);
```

## Z-Index Map

**14 unique z-index values** across 4 layers.

| Layer | Range | Elements |
|-------|-------|----------|
| modal | 9999,2147483647 | div, div.o.n.e.t.r.u.s.t.-.p.c.-.d.a.r.k.-.f.i.l.t.e.r. .o.t.-.f.a.d.e.-.i.n, div.o.t.C.e.n.t.e.r.R.o.u.n.d.e.d. .d.e.f.a.u.l.t. .o.t.-.w.o.-.t.i.t.l.e. .v.e.r.t.i.c.a.l.-.a.l.i.g.n.-.c.o.n.t.e.n.t |
| dropdown | 123,123 | div.T.b.r.N.a.v.b.a.r.-.P.h.o.n.e.B.u.t.t.o.n.C.o.n.t.e.n.t |
| sticky | 10,99 | div.L.e.f.t.R.i.g.h.t._.P.l.a.y.I.c.o.n._._.C.P.z.J.Q, button.B.u.t.t.o.n._.B.u.t.t.o.n._._.S.k.n.y.z. .B.u.t.t.o.n._.B.u.t.t.o.n.-.-.s.e.c.o.n.d.a.r.y._._.H.P.e.p.s. .B.u.t.t.o.n._.B.u.t.t.o.n.-.-.s.q.u.a.r.e._._.K.p.w.t.L. .B.u.t.t.o.n._.B.u.t.t.o.n.-.-.l.a.r.g.e._._.i.J.B.3.t. .A.r.r.o.w.B.u.t.t.o.n._.B.u.t.t.o.n._._.f.p.y.m.f. .S.l.i.d.e.r.W.r.a.p.p.e.r._.B.u.t.t.o.n._._.S.R.3.4.C. .S.l.i.d.e.r.W.r.a.p.p.e.r._.B.u.t.t.o.n.-.-.c.e.n.t.e.r.e.d._._.K.H.5.R.O. .S.l.i.d.e.r.W.r.a.p.p.e.r._.B.u.t.t.o.n.-.-.c.e.n.t.e.r.e.d.-.l.e.f.t._._.a.C.e.l.r. .c.t.a. .s.e.c.o.n.d.a.r.y, button.B.u.t.t.o.n._.B.u.t.t.o.n._._.S.k.n.y.z. .B.u.t.t.o.n._.B.u.t.t.o.n.-.-.s.e.c.o.n.d.a.r.y._._.H.P.e.p.s. .B.u.t.t.o.n._.B.u.t.t.o.n.-.-.s.q.u.a.r.e._._.K.p.w.t.L. .B.u.t.t.o.n._.B.u.t.t.o.n.-.-.l.a.r.g.e._._.i.J.B.3.t. .A.r.r.o.w.B.u.t.t.o.n._.B.u.t.t.o.n._._.f.p.y.m.f. .S.l.i.d.e.r.W.r.a.p.p.e.r._.B.u.t.t.o.n._._.S.R.3.4.C. .S.l.i.d.e.r.W.r.a.p.p.e.r._.B.u.t.t.o.n.-.-.c.e.n.t.e.r.e.d._._.K.H.5.R.O. .S.l.i.d.e.r.W.r.a.p.p.e.r._.B.u.t.t.o.n.-.-.c.e.n.t.e.r.e.d.-.r.i.g.h.t._._.R._.P.G.4. .c.t.a. .s.e.c.o.n.d.a.r.y |
| base | 0,3 | img.C.a.r.d._.C.a.r.d.B.a.c.k.g.r.o.u.n.d._._.b.X.V.F.H, img.C.a.r.d._.S.t.a.r.E.m.p.t.y._._.B.z.R.C.O, img.C.a.r.d._.S.t.a.r.E.m.p.t.y._._.B.z.R.C.O |

**Issues:**
- [object Object]

## SVG Icons

**42 unique SVG icons** detected. Dominant style: **outlined**.

| Size Class | Count |
|------------|-------|
| xs | 1 |
| sm | 7 |
| md | 33 |
| xl | 1 |

**Icon colors:** `#003A43`, `#004952`, `#FF8D6E`, `white`, `#054A53`, `#FF8D6A`, `#004953`, `#F68C70`, `inherit`

## Font Files

| Family | Source | Weights | Styles |
|--------|--------|---------|--------|
| __AkkuratLL_8dc0fd | self-hosted | 300, 400, 700, 900 | normal, italic |
| __AkkuratMonoLL_c826bb | self-hosted | 400, 700 | normal, italic |
| __Lora_e96844 | self-hosted | 400 700 | normal |
| Inter | google-fonts | 400, 700 | normal |
| Poppins | google-fonts | 400, 600, 700 | normal |
| Open Sans | google-fonts | 400 | normal |
| Work Sans | google-fonts | 400, 500 | normal |

**Google Fonts URL:** `https://fonts.googleapis.com/css?family=Open%2BSans:400|Inter:400|Poppins:400&display=swap`

## Image Style Patterns

| Pattern | Count | Key Styles |
|---------|-------|------------|
| thumbnail | 104 | objectFit: fill, borderRadius: 0px, shape: square |
| general | 6 | objectFit: cover, borderRadius: 24px, shape: pill |
| hero | 3 | objectFit: cover, borderRadius: 0px, shape: square |
| gallery | 2 | objectFit: cover, borderRadius: 0px, shape: square |

**Aspect ratios:** 1:1 (86x), 4:3 (11x), 5:1 (9x), 16:9 (3x), 1.18:1 (2x), 4.3:1 (1x), 3.43:1 (1x), 4.77:1 (1x)

## Quick Start

To recreate this design in a new project:

1. **Install fonts:** Add `__AkkuratLL_8dc0fd` from Google Fonts or your font provider
2. **Import CSS variables:** Copy `variables.css` into your project
3. **Tailwind users:** Use the generated `tailwind.config.js` to extend your theme
4. **Design tokens:** Import `design-tokens.json` for tooling integration
