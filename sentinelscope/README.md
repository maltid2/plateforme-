# SentinelScope — Landing Page

A premium, dark, futuristic marketing landing page for a fictional
cybersecurity product, **SentinelScope** — a continuous attack surface
intelligence platform.

The visual identity, copy, illustrations, and layout are original. Only
generic UX conventions (sticky navbar, feature grid, FAQ accordion, etc.)
are reused — no real brand's assets, wording, or design are copied.

## Tech stack

- **Next.js 14** (App Router)
- **React 18** + **TypeScript**
- **Tailwind CSS 3.4**
- **Framer Motion 11** for scroll and interaction animations
- **Lucide React** for icons

## Getting started

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build
npm run start    # serve the production build
```

## Sections

1. **Navbar** — sticky, blurs and gains a border on scroll, animated mobile menu
2. **Hero** — animated fictional dashboard (risk ring, sparkline, live alerts, count-ups)
3. **Trust bar** — social proof stats (count-up) and fictional company names
4. **Problem** — the visibility gap, with an interactive live asset map (solve/ignore a finding)
5. **Features** — six-card platform grid with hover lift and colored glows
6. **Product** — "From detection to decision" three-step flow with an animated line and a finding-detail card
7. **Modules** — five tabbed modules (Attack Surface, Code, Cloud, Testing, Defend) with animated panel transitions
8. **Integrations** — dual marquee rows (opposite directions, pause on hover, edge fade)
9. **Security & compliance** — animated shield illustration and posture badges
10. **Testimonials** — carousel with prev/next controls and dot indicators
11. **FAQ** — accessible accordion (one open at a time, `aria-expanded`, keyboard focus)
12. **Final CTA** — animated grid and halo background
13. **Footer** — link columns, social links with `aria-label`, status indicator

## Accessibility & performance

- Reveal animations use `IntersectionObserver` / Framer Motion `whileInView`
  so work happens only when a section enters the viewport.
- A global `prefers-reduced-motion` rule disables animations for users who
  request it; the count-up component also snaps to its final value.
- Interactive elements expose hover, focus-visible, and active states.
- Fully responsive from 320px through large desktop widths, with no
  horizontal overflow.

> All content is fictional and for demonstration only.
