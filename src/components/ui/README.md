# BlueBite UI Component Library

Reusable primitives for the BlueBite glassmorphism design system. These components encode the rules from `DESIGN.md` so you don't have to remember magic values.

## Quick start

```tsx
import { GlassPanel, GlassButton, GlassDivider, Text } from './ui';
```

All components reference CSS custom properties from `src/styles/tokens.css`, which is the single source of truth for colors, radii, blur values, shadows, and typography.

---

## Components

### `<GlassPanel>`

A container with coordinated border-radius and padding — content will never clip the rounded corners.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `level` | `'modal' \| 'card' \| 'surface'` | `'card'` | Glass intensity level |
| `as` | `'div' \| 'section'` | `'div'` | HTML element to render |
| `className` | `string` | `''` | Additional CSS classes |
| `style` | `CSSProperties` | — | Style overrides (merged after base styles) |

**Levels:**

| Level | Background | Blur | Radius | Padding | Use for |
|-------|-----------|------|--------|---------|---------|
| `modal` | `--glass-mist` (0.08) | 25px | 2.5rem | 2.5rem | Top-level modals, login panels |
| `card` | `--glass-breath` (0.04) | 16px | 1.5rem | 1.5rem | Content cards, containers |
| `surface` | `--glass-whisper` (0.03) | 10px | 1.5rem | 1.5rem | Nested inner sections, subtle groupings |

**Nesting rule:** When nesting panels, go one level down. A `modal` contains `card`s or `surface`s. Never nest `modal` inside `modal`.

```tsx
<GlassPanel level="modal">
  <Text variant="title">Settings</Text>
  <GlassPanel level="surface">
    <Text variant="body">Inner content here</Text>
  </GlassPanel>
</GlassPanel>
```

**Why radius + padding are coordinated:**
A rounded corner with `border-radius: 2.5rem` creates a curve that content can overflow if padding is too small. Each level sets `padding >= border-radius` to guarantee content stays inside the visible area. If you override `style={{ padding: '0.5rem' }}` on a `modal`, you'll reintroduce the clipping problem — use a lower level instead.

---

### `<GlassButton>`

Interactive button with hover/focus handled entirely in CSS (no `onMouseEnter`/`onMouseLeave` needed).

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'default' \| 'primary' \| 'accent' \| 'ghost'` | `'default'` | Visual style |
| `className` | `string` | `''` | Additional CSS classes |
| ...rest | `ButtonHTMLAttributes` | — | All native button props (`onClick`, `disabled`, etc.) |

**Variants:**

| Variant | Appearance | Use for |
|---------|-----------|---------|
| `default` | Translucent glass with luminous border | List items, selection buttons, secondary actions |
| `primary` | Aqua-to-white gradient, dark text | Primary CTAs (sign in, submit order) |
| `accent` | Blue gradient with glow | Highlighted actions (confirm, add to cart) |
| `ghost` | Invisible until hovered, red on hover | Destructive/minor actions (sign out, remove) |

```tsx
<GlassButton variant="primary" onClick={handleLogin} className="w-full">
  <LogIn size={20} />
  Login with Yale CAS
</GlassButton>
```

**Styling hover states:** All hover effects are in `GlassButton.css`. To customize, add a new variant to that CSS file rather than adding `onMouseEnter`/`onMouseLeave` handlers.

---

### `<Text>`

Typography component that enforces the DESIGN.md font rules and opacity hierarchy.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'brand' \| 'heading' \| 'title' \| 'body' \| 'label' \| 'whisper'` | `'body'` | Typography style |
| `as` | `ElementType` | auto | Override the HTML element (default chosen per variant) |
| `className` | `string` | `''` | Additional CSS classes |
| `style` | `CSSProperties` | — | Style overrides |

**Variants:**

| Variant | Font | Size | Color | Default tag | Use for |
|---------|------|------|-------|-------------|---------|
| `brand` | Yeseva One | 30px | white 100% | `h1` | "BlueBite" wordmark |
| `heading` | Yeseva One | 36px | white 100% | `h2` | Section headings ("Drinks", "Main") |
| `title` | DM Sans | 20px semibold | white 100% | `h3` | Card titles, modal subtitles |
| `body` | DM Sans | 16px | white 70% | `p` | Descriptions, content text |
| `label` | DM Sans | 14px | white 50% | `p` | Secondary info, captions |
| `whisper` | DM Sans | 10px uppercase | white 40% | `span` | Role labels, annotations |

```tsx
<Text variant="brand">BlueBite</Text>
<Text variant="label" className="text-center">Yale Buttery Ordering System</Text>
<Text variant="title" as="p">{currentUser.netId}</Text>
```

---

### `<GlassDivider>`

A 1px horizontal line using `--border-color-default`.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `''` | Additional CSS classes (e.g. margin) |

```tsx
<GlassDivider className="my-6" />
```

---

## Design tokens (`src/styles/tokens.css`)

All visual values are defined as CSS custom properties on `:root`. Reference them in any CSS or inline style:

```css
.my-custom-element {
  background: var(--glass-breath);
  border: var(--border-glass);
  border-radius: var(--radius-card);
  backdrop-filter: var(--blur-md);
  color: var(--text-secondary);
  font-family: var(--font-body);
  transition: all var(--duration-normal) var(--ease-glass);
}
```

### Token categories

| Category | Examples | Purpose |
|----------|---------|---------|
| `--font-*` | `--font-heading`, `--font-body` | Typography families |
| `--glass-*` | `--glass-whisper` through `--glass-fog` | Surface background opacities |
| `--border-*` | `--border-glass`, `--border-color-hover` | Edge treatments |
| `--blur-*` | `--blur-sm` through `--blur-xl` | Backdrop filter intensities |
| `--shadow-*` | `--shadow-glass`, `--shadow-glow-blue` | Depth and glow effects |
| `--radius-*` | `--radius-modal`, `--radius-card`, `--radius-button` | Corner rounding |
| `--padding-*` | `--padding-modal`, `--padding-card` | Coordinated with radii |
| `--text-*` | `--text-primary` through `--text-whisper` | White opacity scale |
| `--accent-*` | `--accent-blue`, `--accent-orange` | Status and highlight colors |
| `--ease-*`, `--duration-*` | `--ease-glass`, `--duration-normal` | Animation timing |

---

## Common patterns

### Adding a new page with glass styling

```tsx
export function MyPage() {
  return (
    <div className="relative h-screen w-full" style={{ background: 'var(--color-void)' }}>
      <GlassPanel level="modal" className="max-w-lg mx-auto mt-20">
        <Text variant="heading">Page Title</Text>
        <GlassDivider className="my-6" />
        <GlassPanel level="surface">
          <Text variant="body">Content goes here</Text>
        </GlassPanel>
        <GlassButton variant="primary" className="w-full mt-6">
          Take Action
        </GlassButton>
      </GlassPanel>
    </div>
  );
}
```

### Adding a new button variant

1. Add the variant name to the `ButtonVariant` type in `GlassButton.tsx`
2. Add the class mapping in `VARIANT_CLASS`
3. Add CSS rules in `GlassButton.css`:

```css
.glass-btn--danger {
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.glass-btn--danger:hover {
  background: rgba(239, 68, 68, 0.3);
  box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
}
```

### Adding a new text variant

1. Add the variant name to the `TextVariant` type in `Text.tsx`
2. Add the style object in `VARIANT_STYLES`
3. Add the default HTML tag in `DEFAULT_TAG`

---

## Anti-patterns to avoid

| Don't | Do instead |
|-------|-----------|
| `style={{ fontFamily: '"DM Sans"' }}` | `<Text variant="body">` or `font-family: var(--font-body)` |
| `style={{ background: 'rgba(255,255,255,0.08)' }}` | `<GlassPanel level="modal">` or `background: var(--glass-mist)` |
| `onMouseEnter={(e) => e.target.style.color = 'red'}` | Use CSS `:hover` or add a `GlassButton` variant |
| `style={{ borderRadius: '2.5rem', padding: '1rem' }}` | `<GlassPanel level="modal">` (padding is coordinated) |
| `backdrop-filter: blur(25px)` inline | `backdrop-filter: var(--blur-xl)` |
| Nesting `<GlassPanel level="modal">` inside another modal | Use `level="surface"` for inner panels |
| Overriding padding on a GlassPanel to a value smaller than its radius | Use a lower `level` that matches your space needs |
