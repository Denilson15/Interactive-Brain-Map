# Project Standards

This file defines how Claude should work in this repo. Treat it as
standing instruction: follow it on every task without being re-asked.
Keep this file lean — it loads every session, so add new skills or
rules only when a real need surfaces, not speculatively.

## Working style
- Audit before editing. On any non-trivial change, read the relevant
    files first and explain the plan before writing code. Wait for my
    approval before large changes.
- Discuss architecture before implementing. For any decision that
    affects scalability, hosting, cost, security, or vendor lock-in
    (adding a backend, choosing a database, picking a framework, adding
    a paid service), lay out the options and tradeoffs and let me
    decide. I am learning these tradeoffs — explain the "why," don't
    just pick.
- Work in small, reviewable commits with clear, descriptive messages.
- Use branches for new work; never edit live in a way I can't roll
    back.
- Never break existing functionality. Verify the build passes and the
    app runs before calling a change done.
- When you introduce a new tool, library, or pattern, add a one-line
    note on what it does and why we chose it.

## Design (build like a product someone would pay for)
- Modern, clean, professional. Restrained, not flashy — signal quality
    and trustworthiness, not novelty.
- Consistent design system: one type scale, a defined color palette
    with semantic tokens, a consistent spacing scale, reusable
    components.
- Fully responsive, designed mobile-first: must look right on laptop,
    tablet, and phone.
- Handle all states: loading, empty, and error — not just the happy
    path.
- Respect prefers-reduced-motion; animations enhance, never distract.
- Use the frontend-design and design-system skills.

## Accessibility (also a legal matter — see Legal below)
- WCAG 2.1 AA as the baseline target.
- Keyboard-navigable throughout; visible focus states.
- Semantic HTML and ARIA/screen-reader labels, including on
    interactive 3D/canvas elements.
- Color contrast: 4.5:1 body text, 3:1 large text and UI.
- Run the accessibility-review skill before any UI work is "done."

## Performance (buyers feel slowness before they see features)
- Fast first load: lazy-load heavy assets (3D models, images),
    code-split, compress assets.
- Watch bundle size; flag anything that bloats it.
- Aim for strong Core Web Vitals (LCP, CLS, INP).
- Test on a weak device, not just a strong one — 3D leans on the GPU
    and performance varies widely across phones.

## SEO & discoverability
- Semantic HTML structure (one h1, logical heading order, landmarks).
- Per-page title and meta description; Open Graph and Twitter cards
    for shareable links.
- Structured data (schema.org JSON-LD) where it fits the content.
- sitemap.xml and robots.txt.
- Meaningful alt text on images; descriptive link text.
- Fast load and mobile-friendliness (both are ranking factors).

## Marketability
- Clear value proposition above the fold: what it is, who it's for,
    why it's better — in one glance.
- An obvious primary call-to-action on each key page.
- A landing/home experience that could convert a first-time visitor.
- Trust signals: clarity, polish, no broken states.

## Legal & compliance
California-based. Not legal advice — confirm with a lawyer before
selling or collecting real user data.
- Privacy (CCPA/CPRA): if the site collects any personal data (emails,
    accounts, saved progress), users get rights to know, delete, and
    opt out. Add a privacy policy and terms before collecting anything.
    While static and collecting nothing, this does not apply.
- Minors: if users under 13 are possible, COPPA applies and is strict.
    Simplest early approach — collect no data from minors at all.
    Education tools touching schools may trigger additional
    student-privacy rules.
- Accessibility as compliance: public sites in CA fall under the ADA
    and the Unruh Act; inaccessible sites draw complaints. WCAG AA
    above is protective, not just polish.
- Asset licensing: any 3D models, textures, images, or data not made
    by me must have licenses permitting commercial use. Verify before
    selling.

## Testing & reliability
- Automated tests for core functionality so changes don't silently
    break features (e.g. Vitest for units, Playwright for end-to-end).
    Scale testing to the project; a simple static page needs little.
- Cross-browser and cross-device checks for anything GPU-dependent.

## Documentation
- Every project has a thorough, clear README scaled to the project:
    - Apps: what it is, who it's for, how to run it, how it works, the
        stack.
    - Simple static pages: what it is, who it's for, and what it was
        optimized for — skip "how it works."
- Keep the README current with what the project actually is; update it
    whenever the project meaningfully changes.
- Do not label code or READMEs as "made by AI" — it's redundant.

## Scope discipline
- Ship one polished thing rather than half-building many. Resist
    adding features mid-project; note new ideas for a later phase.

## Code style
- 4-space indentation (4 spaces = one tab).
- Max line length: 80 characters. Wrap code, comments, and Markdown
    prose to stay under it.
- Line breaks wherever they improve readability.
- Clear names over clever ones; comment the non-obvious, not the
    obvious.
- Use TypeScript when the project has real logic (state, data flow,
    APIs, multiple contributors); otherwise JavaScript is fine. This
    is about type-checking only — it never limits styling or animation
    tools (e.g. Tailwind, GSAP, Motion, modern CSS). Choose those for
    the design, not the language.
