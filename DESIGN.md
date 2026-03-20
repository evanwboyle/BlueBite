# Design System: BlueBite Premium Menu Dashboard
**Project ID:** `16941346146423667866`

## 1. Visual Theme & Atmosphere

The BlueBite Premium interface exudes a **dark, luxurious, and immersive** atmosphere — evoking the feeling of a high-end lounge menu viewed through frosted glass at night. The design philosophy is built on **glassmorphism**: translucent surfaces layered over a deep, subtly glowing background that creates depth without clutter.

The overall mood is **refined, modern, and warm despite its darkness** — achieved through careful use of soft radial glows in teal-navy tones against a near-black canvas, paired with elegant serif typography for headings and clean sans-serif body text. The UI feels like it floats, with every panel and card distinguished by translucency and gentle luminous borders rather than hard edges or heavy shadows.

**Key atmosphere descriptors:** Dark luxe, glassmorphic, immersive depth, warm-cool contrast, floating panels, lounge-inspired elegance.

## 2. Color Palette & Roles

### Background & Surface Colors

| Descriptive Name | Hex / Value | Functional Role |
|---|---|---|
| **Void Black** | `#0a0a0a` | Primary page background; the deepest canvas layer |
| **Teal-Navy Glow** | `#1a2a3a` → `#0d1218` | Radial gradient accents on background; creates subtle warm depth behind glass panels |
| **Deep Ocean Gradient** | `rgba(20, 40, 45, 1)` → `rgba(15, 30, 30, 1)` | Secondary radial glow layer; evokes an underwater luminescence |
| **Whisper Glass** | `rgba(255, 255, 255, 0.03)` | Navigation bar glass fill; barely-there translucency |
| **Breath Glass** | `rgba(255, 255, 255, 0.04)` | Card and container glass fill; slightly more visible than nav |
| **Mist Glass** | `rgba(255, 255, 255, 0.08)` | Modal glass fill; most opaque glass surface for focus states |
| **Fog Glass** | `rgba(255, 255, 255, 0.10)` | Input field backgrounds; interactive glass surfaces |
| **Glass Edge** | `rgba(255, 255, 255, 0.10)` | Default border for all glass surfaces |
| **Glass Edge Bright** | `rgba(255, 255, 255, 0.15)` | Elevated border for modals; slightly more defined edge |
| **Glass Edge Input** | `rgba(255, 255, 255, 0.20)` | Input field borders; most visible edge treatment |

### Accent & Status Colors

| Descriptive Name | Hex / Value | Functional Role |
|---|---|---|
| **Electric Blue** | `#3b82f6` | Primary accent; "Completed" order status badges, active radio/checkbox indicators, selection highlight |
| **Amber Signal** | `#f97316` | Warning/pending accent; "Pending" order status badges and their card borders |
| **Ember Red** | `red-500` at 80% opacity | "Hot" item badge; calls attention to temperature-sensitive items |

### Order Card Tinting

- **Completed orders:** `bb-blue/10` background tint with `bb-blue/40` border — a cool, settled glow
- **Pending orders:** `bb-orange/10` background tint with `bb-orange/40` border — a warm, urgent glow

### Text Hierarchy (White Opacity Scale)

| Opacity | Role |
|---|---|
| `white` (100%) | Primary text: headings, prices, item names |
| `white/80` | Secondary text: customer names, item descriptions, option labels |
| `white/70` | Descriptive body text in modals |
| `white/60` | Tertiary text: customer labels, icon default state |
| `white/50` | Muted labels: "Total" prefix in orders |
| `white/40` | Whisper text: font name annotations, role labels ("Admin"), sub-labels |

### Login Page Colors

| Descriptive Name | Value | Functional Role |
|---|---|---|
| **Deep Sapphire Swirl** | Deep blue marble/fluid art gradient | Full-bleed login background; rich, organic flowing texture |
| **Frosted Crystal** | Semi-transparent white glass | Login card surface; centered focal point with strong blur |
| **Soft Aqua Gradient** | Light blue-to-white gradient | "Sign In" button fill; inviting call-to-action |

## 3. Typography Rules

### Font Families

- **Headings & Brand:** "Yeseva One" (serif) — An elegant, high-contrast display serif with strong personality. Used for the "BlueBite Premium" wordmark, section headings ("Drinks", "Main"), item titles in modals ("Gourmet Burger"), and the orders panel heading.
- **Body & Interface:** "DM Sans" (sans-serif, weights 400/500/700) — A clean, geometric sans-serif with excellent legibility at small sizes. Used for all body text, prices, descriptions, labels, buttons, and form elements.

### Typography Scale

| Element | Font | Size | Weight | Character |
|---|---|---|---|---|
| Brand wordmark | Yeseva One | `text-3xl` (30px) | Regular | Tight tracking (`tracking-tight`) |
| Section headings | Yeseva One | `text-4xl` (36px) | Regular | Natural tracking |
| Modal item title | Yeseva One | `text-5xl` (48px) | Regular | Tight leading (`leading-tight`) |
| Orders panel heading | Yeseva One | `text-3xl` (30px) | Regular | Natural tracking |
| Order heading | DM Sans | Base | Bold (700) | Default |
| Item name on card | DM Sans | `text-lg` (18px) | Medium (500) | Default |
| Price | DM Sans | `text-xl` (20px) | Bold (700) | Default |
| Body description | DM Sans | `text-lg` (18px) | Regular (400) | Relaxed leading |
| Modifier options | DM Sans | Base (16px) | Regular (400) | Default |
| Status badges | DM Sans | `text-[10px]` | Bold (700) | All-caps, wide tracking (`tracking-wide`) |
| Role label ("Admin") | DM Sans | `text-[10px]` | Regular | All-caps, widest tracking (`tracking-widest`) |

## 4. Component Stylings

### Glass Cards (Menu Items, Containers)
- **Shape:** Generously rounded corners (`border-radius: 1.5rem / 24px`)
- **Background:** Near-invisible translucent white fill (`rgba(255,255,255, 0.04)`)
- **Border:** Hairline luminous edge (`1px solid rgba(255,255,255, 0.1)`)
- **Depth:** `backdrop-filter: blur(16px)` — content behind softly diffuses
- **Hover:** Border brightens to `white/30`; smooth `transition-all`
- **Padding:** Comfortable `1rem` (16px) internal spacing

### Glass Navigation Bar
- **Shape:** Subtly rounded (`border-radius: 1.25rem / 20px`)
- **Background:** Barely-there translucency (`rgba(255,255,255, 0.03)`)
- **Depth:** Stronger blur (`backdrop-filter: blur(20px)`)
- **Padding:** Generous horizontal (`px-8`) and vertical (`py-4`) breathing room

### Glass Modal (Item Detail)
- **Shape:** Dramatically rounded (`border-radius: 2.5rem / 40px`)
- **Background:** Most opaque glass layer (`rgba(255,255,255, 0.08)`)
- **Border:** Slightly brighter edge (`rgba(255,255,255, 0.15)`)
- **Depth:** Maximum blur (`backdrop-filter: blur(25px)`) with heavy shadow (`0 8px 32px rgba(0,0,0, 0.8)`)
- **Overlay:** `bg-black/60` with `backdrop-blur-md` behind modal
- **Layout:** Two-column — square image left, customization options right

### Buttons
- **Icon buttons (header):** Square with rounded corners (`rounded-xl / 12px`), `40x40px`, `bg-white/5` with luminous border, hover brightens to `bg-white/10`
- **Add buttons (+):** Square with rounded corners (`rounded-lg / 8px`), `40x40px`, same glass treatment, appears on card hover
- **Add to Order (modal):** Full-width glass pill (`rounded-2xl / 16px`), `56px` tall, glass-input styling, text split between label and price
- **Quantity selector:** Glass pill container with minus/plus buttons (`rounded-xl` inner), centered number display

### Status Badges
- **Shape:** Slightly rounded (`rounded / 4px`) — compact pill shape
- **Size:** Tiny (`text-[10px]`), bold, uppercase with wide tracking
- **Completed:** Solid Electric Blue (`#3b82f6`) background
- **Pending:** Solid Amber Signal (`#f97316`) background

### Order Cards
- **Shape:** Rounded (`rounded-2xl / 16px`)
- **Background:** Color-tinted glass — blue/10 for completed, orange/10 for pending
- **Border:** Color-tinted edge — blue/40 or orange/40
- **Divider:** Subtle horizontal rule (`h-px bg-white/10`) between header and content
- **Item list text:** Italic, `white/80`

### Form Controls (Radio & Checkbox)
- **Size:** `20x20px` (`w-5 h-5`)
- **Background:** `bg-white/10` — blends with glass surfaces
- **Border:** `border-white/30` — slightly more visible than card borders
- **Active color:** `text-blue-500` — Electric Blue fill when selected
- **No focus ring:** Clean, minimal (`focus:ring-0`)
- **Labels:** Hover brightens from `white/80` to full white

### Image Containers
- **Card images:** `aspect-video` ratio, `rounded-xl` (12px), `overflow-hidden`, `bg-zinc-800` fallback
- **Modal images:** `aspect-square` ratio, `rounded-3xl` (24px), heavy shadow (`shadow-2xl`)

### "Hot" Item Badge
- **Position:** Absolute, top-right of card (`top-6 right-6`)
- **Style:** `bg-red-500/80` with backdrop blur, tiny uppercase bold text

### Login Page Components
- **Login card:** Frosted glass panel, centered on deep blue swirling background
- **Input fields:** Frosted glass inputs with subtle borders, rounded
- **Sign In button:** Soft aqua-to-white gradient, pill-shaped, centered

### Custom Scrollbar
- **Width:** Ultra-thin (`4px`)
- **Track:** Nearly invisible (`rgba(255,255,255, 0.05)`), rounded
- **Thumb:** Subtle (`rgba(255,255,255, 0.2)`), rounded, brightens on hover to `0.3`

## 5. Layout Principles

### Spacing Strategy
- **Page padding:** `24px` (`p-6`) around entire viewport
- **Component gaps:** `24px` (`gap-6`) between all major elements (header, content grid, cards)
- **Section spacing:** `48px` (`mb-12`) between menu categories (Drinks → Main)
- **Heading-to-content:** `32px` (`mb-8`) below section headings
- **Card internal padding:** `16px` (`p-4`) for menu cards, `24px` (`p-6`) for sidebar, `32px` (`p-8`) for main content area
- **Max content width:** `1600px`, centered with `mx-auto`

### Grid System
- **Main layout:** 4-column grid (`grid-cols-4`) — menu occupies 3 columns, orders sidebar occupies 1
- **Menu item grid:** Responsive 1→2→3 columns (`grid-cols-1 md:grid-cols-2 xl:grid-cols-3`)
- **Modal layout:** Two-column flex — equal halves (image 50%, options 50%)

### Whitespace Philosophy
The design uses **generous negative space** within glass containers to let content breathe against the dark background. The translucent borders and subtle glows act as spatial separators rather than heavy dividers, creating a sense of layered depth. Content is never cramped — there is always breathing room between elements, reinforcing the premium lounge aesthetic.

### Responsive Approach
- Desktop-first design (`lg:` breakpoint for grid layout)
- Menu grid collapses gracefully: 3 → 2 → 1 columns
- Modal switches from side-by-side to stacked on smaller screens
- Sidebar stacks below menu on mobile

### Background Layering (Bottom to Top)
1. **Fluid background** — Fixed, full-viewport radial gradients in teal-navy
2. **Glow effect** — Fixed, large soft radial gradient for ambient warmth
3. **Content layer** — Relative, z-10, contains all glass panels
4. **Modal overlay** — Fixed, z-50, black/60 with backdrop blur
