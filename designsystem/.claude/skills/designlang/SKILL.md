---
name: designlang-tokens
description: Use when styling UI for www.tebra.com — references the extracted design system tokens instead of inventing colors, spacing, or typography.
---

# designlang tokens
Source: https://www.tebra.com/
Extracted by designlang v7.0.0 on 2026-04-20T12:59:02.174Z

## Semantic tokens (use these)
- color.action.primary: #ff8d6e
- color.surface.default: #ffffff
- color.text.body: #000000
- radius.control: 1px
- typography.body.fontFamily: __AkkuratLL_8dc0fd

## Regions
- nav
- pricing
- testimonials
- testimonials
- testimonials
- footer
- footer
- footer
- testimonials
- footer
- footer
- footer
- testimonials
- footer
- footer
- footer
- content
- pricing
- nav
- nav
- nav
- nav
- nav
- content
- footer
- content
- content
- content
- content

## How to use
- Prefer `semantic.*` tokens over `primitive.*`.
- Never invent new tokens or hex values; reuse the ones above.
- When a value is missing, pick the closest existing semantic token and flag the gap.
- Reference tokens by their dotted path (e.g. `semantic.color.action.primary`).
