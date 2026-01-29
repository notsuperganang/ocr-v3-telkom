# Design System Guide - Telkom Contract Extractor

> **Purpose**: This document provides comprehensive design guidelines for developers working on the Telkom Contract Extractor application. Follow these guidelines to maintain design consistency and brand identity throughout the application.

**Last Updated**: January 2026
**Design System**: shadcn/ui (New York variant) + Tailwind CSS v4

---

## Table of Contents

1. [Brand Identity](#1-brand-identity)
2. [Color Palette](#2-color-palette)
3. [Typography](#3-typography)
4. [Spacing & Layout](#4-spacing--layout)
5. [Components](#5-components)
6. [Animation & Motion](#6-animation--motion)
7. [Accessibility](#7-accessibility)
8. [Code Patterns](#8-code-patterns)
9. [Best Practices](#9-best-practices)

---

## 1. Brand Identity

### Telkom Official Colors

The design system is built around **Telkom Indonesia's official brand colors**:

```css
--color-telkom-red: #E42313      /* Primary brand color - use for CTAs, active states */
--color-telkom-grey: #706F6F     /* Secondary color - use for supporting text */
--color-telkom-black: #1D1D1B    /* Text and dark backgrounds */
--color-telkom-white: #FFFFFF    /* Pure white for contrast */
```

### Brand Assets

**Logo Files** (located in `frontend/src/assets/`):
- `logo-telkom.png` - Full logo (vertical)
- `logo-telkom-horizontal.png` - Horizontal variant (use in headers)
- `icon-telkom.png` - Small icon (use in sidebar, favicons)
- `telkom-login.jpeg` - Login page hero image

**Logo Usage Rules**:
- Always maintain proper spacing around the logo (minimum 20px padding)
- Never distort or change logo colors
- Use horizontal variant for wide layouts (desktop headers)
- Use icon variant for compact spaces (collapsed sidebar)

---

## 2. Color Palette

### Theme System

The application uses **CSS custom properties** with OKLCH color space for consistent theming across light and dark modes.

#### Light Theme Colors

```css
/* Primary Colors */
--primary: oklch(0.50 0.24 27)           /* Telkom Red - buttons, links, active states */
--primary-foreground: oklch(1 0 0)       /* White text on primary backgrounds */

/* Background Colors */
--background: oklch(1 0 0)               /* Pure white - main background */
--foreground: oklch(0.16 0 0)            /* Near black - primary text */

/* Surface Colors */
--card: oklch(1 0 0)                     /* White - card backgrounds */
--card-foreground: oklch(0.16 0 0)       /* Dark text on cards */

/* Muted/Secondary */
--muted: oklch(0.96 0 0)                 /* Very light grey - secondary backgrounds */
--muted-foreground: oklch(0.45 0 0)      /* Medium grey - secondary text */

/* Accent Colors */
--accent: oklch(0.50 0.24 27)            /* Same as primary - hover states */
--accent-foreground: oklch(1 0 0)        /* White text on accent */

/* Borders */
--border: oklch(0.90 0 0)                /* Light grey - default borders */
--input: oklch(0.90 0 0)                 /* Input field borders */
--ring: oklch(0.50 0.24 27)              /* Focus ring (primary color) */

/* Semantic Colors */
--destructive: oklch(0.55 0.24 27)       /* Error/delete actions */
--success: oklch(0.65 0.15 145)          /* Success states (green) */
--warning: oklch(0.75 0.15 85)           /* Warning states (amber) */
--info: oklch(0.60 0.15 250)             /* Info states (blue) */
```

#### Dark Theme Colors

```css
/* Primary Colors */
--primary: oklch(0.55 0.24 27)           /* Lighter Telkom Red for dark mode */
--primary-foreground: oklch(0.95 0 0)    /* Off-white text */

/* Background Colors */
--background: oklch(0.16 0 0)            /* Telkom Black - main background */
--foreground: oklch(0.95 0 0)            /* Light text */

/* Surface Colors */
--card: oklch(0.18 0 0)                  /* Slightly lighter than background */
--card-foreground: oklch(0.95 0 0)       /* Light text on cards */

/* Muted/Secondary */
--muted: oklch(0.22 0 0)                 /* Dark grey - secondary backgrounds */
--muted-foreground: oklch(0.60 0 0)      /* Light grey - secondary text */

/* Borders */
--border: oklch(0.25 0 0)                /* Dark grey borders */
```

### Sidebar Colors

Special tokens for sidebar navigation:

```css
--sidebar-primary: oklch(0.50 0.24 27)            /* Telkom Red for active items */
--sidebar-accent: oklch(0.96 0 0)                 /* Light background on hover */
--sidebar-border: oklch(0.90 0 0 / 0.3)           /* Semi-transparent borders */
```

### Using Colors in Code

**CSS/Tailwind Classes**:
```jsx
// Primary color (Telkom Red)
<Button className="bg-primary text-primary-foreground">
  Confirm
</Button>

// Muted backgrounds
<div className="bg-muted text-muted-foreground">
  Secondary content
</div>

// Borders
<Card className="border border-border/70">
  Content
</Card>

// Semantic colors
<Badge className="bg-destructive">Error</Badge>
<Badge className="bg-success">Success</Badge>
<Badge className="bg-warning">Warning</Badge>
```

**Custom Gradients**:
```css
/* Defined in index.css */
.gradient-telkom-red           /* Strong red gradient for headers */
.gradient-telkom-red-subtle    /* Subtle red accent (10% to 5% opacity) */
```

```jsx
// Usage example
<div className="gradient-telkom-red-subtle rounded-t-xl p-4">
  Featured content
</div>
```

---

## 3. Typography

### Font Family

The application uses a **system font stack** for optimal performance and native feel:

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "Segoe UI",
  Roboto,
  "Helvetica Neue",
  Arial,
  sans-serif;
```

**Why system fonts?**
- Zero network requests (instant loading)
- Native look on each platform
- Optimal performance
- Great readability

### Font Sizes

```css
/* Tailwind CSS size scale */
text-xs      /* 0.75rem (12px)  - Labels, captions */
text-sm      /* 0.875rem (14px) - Body text, table cells */
text-base    /* 1rem (16px)     - Form inputs, primary body */
text-lg      /* 1.125rem (18px) - Card titles */
text-xl      /* 1.25rem (20px)  - Section headings */
text-2xl     /* 1.5rem (24px)   - Page headings */
text-3xl     /* 1.875rem (30px) - KPI values */
text-4xl     /* 2.25rem (36px)  - Hero text */
```

### Font Weights

```css
font-medium   /* 500 - Default text weight */
font-semibold /* 600 - Subheadings, emphasis */
font-bold     /* 700 - Headings, KPI values */
```

### Typography Patterns

**KPI Card Values**:
```jsx
<div className="text-3xl font-bold tabular-nums">
  Rp 1,234,567
</div>
```

**Card Labels** (uppercase with letter-spacing):
```jsx
<p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
  Total Revenue
</p>
```

**Body Text**:
```jsx
<p className="text-sm text-foreground">
  Regular paragraph text
</p>
```

**Secondary Text**:
```jsx
<span className="text-xs text-muted-foreground">
  Helper text or descriptions
</span>
```

### Special Typography Utilities

**Tabular Numbers** (for aligned numeric data):
```jsx
<td className="tabular-nums">
  1,234,567
</td>
```

**Truncate** (ellipsis overflow):
```jsx
<p className="truncate max-w-[200px]">
  Very long text that will be cut off...
</p>
```

**Line Clamp**:
```jsx
<p className="line-clamp-2">
  Multi-line text that will be limited to 2 lines with ellipsis
</p>
```

---

## 4. Spacing & Layout

### Spacing Scale

Use Tailwind's spacing scale (1 unit = 0.25rem = 4px):

```css
/* Common spacing values */
p-1    /* 4px   - Minimal padding */
p-2    /* 8px   - Tight spacing */
p-3    /* 12px  - Default spacing */
p-4    /* 16px  - Standard padding */
p-6    /* 24px  - Card padding */
p-8    /* 32px  - Section padding */
p-12   /* 48px  - Large sections */

/* Gap values (grid/flex) */
gap-2  /* 8px   - Tight elements */
gap-4  /* 16px  - Default gap */
gap-6  /* 24px  - Spacious layouts */
```

### Border Radius System

```css
/* Custom radius tokens */
--radius: 0.625rem           /* 10px - base radius */
--radius-sm: 6px             /* Small elements */
--radius-md: 8px             /* Medium elements */
--radius-lg: 10px            /* Large elements */
--radius-xl: 14px            /* Extra large */

/* Usage in Tailwind */
rounded-sm     /* 6px  - Buttons, badges */
rounded-md     /* 8px  - Inputs, small cards */
rounded-lg     /* 10px - Standard cards */
rounded-xl     /* 14px - Large cards */
rounded-[1.25rem] /* 20px - Featured cards (common pattern) */
```

### Shadow System

**Design Tokens**:
```typescript
const designTokens = {
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]"
  }
}
```

**Hover Shadow** (Telkom Red glow):
```jsx
<Card className="hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)] transition-shadow">
  Hoverable card
</Card>
```

**Common Shadow Classes**:
```css
shadow-sm       /* Subtle shadow - buttons */
shadow-md       /* Medium shadow - dropdowns */
shadow-lg       /* Large shadow - modals */
shadow-xl       /* Extra large - prominent elements */
```

### Layout Patterns

**Page Container**:
```jsx
<div className="container mx-auto p-6">
  {/* Page content */}
</div>
```

**Card Grid**:
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  <Card>...</Card>
  <Card>...</Card>
  <Card>...</Card>
</div>
```

**Two-Column Layout** (form + preview):
```jsx
<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
  <div className="col-span-1">Left side</div>
  <div className="col-span-1">Right side</div>
</div>
```

**Stack Layout** (vertical spacing):
```jsx
<div className="space-y-6">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>
```

### Responsive Breakpoints

```css
sm:  /* 640px  - Mobile landscape */
md:  /* 768px  - Tablet */
lg:  /* 1024px - Desktop */
xl:  /* 1280px - Large desktop */
2xl: /* 1536px - Extra large */
```

**Responsive Pattern Example**:
```jsx
<div className="text-sm md:text-base lg:text-lg">
  Responsive text size
</div>
```

---

## 5. Components

### shadcn/ui Components

The application uses **shadcn/ui** components with the **"new-york"** style variant. All components are located in `frontend/src/components/ui/`.

#### Button Component

**Variants**:

```jsx
import { Button } from "@/components/ui/button"

// Default (Telkom Red)
<Button variant="default">Confirm</Button>

// Destructive (Delete actions)
<Button variant="destructive">Delete</Button>

// Outline (Secondary actions)
<Button variant="outline">Cancel</Button>

// Secondary (Muted actions)
<Button variant="secondary">View Details</Button>

// Ghost (Minimal actions)
<Button variant="ghost">Edit</Button>

// Link (Text links)
<Button variant="link">Learn More</Button>
```

**Sizes**:
```jsx
<Button size="sm">Small</Button>
<Button size="default">Default</Button>
<Button size="lg">Large</Button>
<Button size="icon">Icon Only</Button>
```

**Loading State**:
```jsx
<Button disabled className="opacity-50 cursor-not-allowed">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Processing...
</Button>
```

#### Card Component

**Compositional Pattern**:

```jsx
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  CardAction
} from "@/components/ui/card"

<Card className="rounded-[1.25rem] border border-border/70">
  <CardHeader>
    <div className="flex items-start justify-between">
      <div>
        <CardTitle>Card Title</CardTitle>
        <CardDescription>Supporting description</CardDescription>
      </div>
      <CardAction>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </CardAction>
    </div>
  </CardHeader>
  <CardContent>
    {/* Main content */}
  </CardContent>
  <CardFooter>
    {/* Footer actions */}
  </CardFooter>
</Card>
```

**Standard Card Styling**:
```jsx
const designTokens = {
  radius: { xl: "rounded-[1.25rem]" },
  shadow: { sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]" },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90"
  }
}

<Card className={cn(
  designTokens.radius.xl,
  designTokens.shadow.sm,
  designTokens.border,
  "transition-all duration-200 hover:shadow-lg"
)}>
```

#### Badge Component

**Variants**:

```jsx
import { Badge } from "@/components/ui/badge"

<Badge variant="default">Primary</Badge>
<Badge variant="secondary">Secondary</Badge>
<Badge variant="destructive">Error</Badge>
<Badge variant="outline">Outlined</Badge>
```

**Payment Method Badge** (custom pattern):
```jsx
<Badge
  variant="secondary"
  className="min-w-[80px] justify-center capitalize"
>
  {paymentMethod}
</Badge>
```

#### Form Components

**Field Composition**:

```jsx
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Field, FieldError } from "@/components/ui/field"

<Field>
  <Label htmlFor="customer-name">Customer Name</Label>
  <Input
    id="customer-name"
    placeholder="Enter customer name"
    className={errors.customerName ? "border-destructive" : ""}
    aria-invalid={!!errors.customerName}
  />
  {errors.customerName && (
    <FieldError>{errors.customerName.message}</FieldError>
  )}
</Field>
```

**Input Variants**:
```jsx
// Text input
<Input type="text" placeholder="Enter text" />

// Number input (with tabular-nums)
<Input type="number" className="tabular-nums" />

// Disabled state
<Input disabled className="opacity-50 cursor-not-allowed" />

// Error state
<Input
  aria-invalid={true}
  className="border-destructive ring-destructive/20"
/>
```

**Select Component**:
```jsx
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select"

<Select value={value} onValueChange={onChange}>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

**Textarea**:
```jsx
import { Textarea } from "@/components/ui/textarea"

<Textarea
  rows={4}
  placeholder="Enter description"
  className="resize-none"
/>
```

#### Dialog Component

```jsx
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog"

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent className="sm:max-w-[425px]">
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
      <DialogDescription>
        Dialog description or instructions
      </DialogDescription>
    </DialogHeader>
    {/* Dialog content */}
    <DialogFooter>
      <Button variant="outline" onClick={() => setIsOpen(false)}>
        Cancel
      </Button>
      <Button onClick={handleConfirm}>Confirm</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

#### Alert Component

```jsx
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertCircle, CheckCircle2, Info, AlertTriangle } from "lucide-react"

// Info alert
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Information</AlertTitle>
  <AlertDescription>
    This is an informational message.
  </AlertDescription>
</Alert>

// Success alert
<Alert className="border-success/50 bg-success/10">
  <CheckCircle2 className="h-4 w-4 text-success" />
  <AlertTitle className="text-success">Success!</AlertTitle>
  <AlertDescription>Operation completed successfully.</AlertDescription>
</Alert>

// Warning alert
<Alert className="border-warning/50 bg-warning/10">
  <AlertTriangle className="h-4 w-4 text-warning" />
  <AlertTitle className="text-warning">Warning</AlertTitle>
  <AlertDescription>Please review before continuing.</AlertDescription>
</Alert>

// Error alert
<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Error</AlertTitle>
  <AlertDescription>An error occurred.</AlertDescription>
</Alert>
```

#### Table Component

```jsx
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table"

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead className="text-right tabular-nums">Amount</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow className="hover:bg-muted/50 transition-colors">
      <TableCell className="font-medium">Item 1</TableCell>
      <TableCell className="text-right tabular-nums">
        Rp 1,234,567
      </TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### Custom Components

#### KpiCard Component

**Location**: `frontend/src/components/contracts/KpiCard.tsx`

**Usage**:
```jsx
import { KpiCard } from "@/components/contracts/KpiCard"

<KpiCard
  title="Total Revenue"
  value="Rp 1.5 M"
  trend={{
    direction: "up",
    value: 12.5,
    label: "vs last month"
  }}
  icon={TrendingUp}
  loading={false}
/>
```

**Features**:
- Animated entrance with Framer Motion
- Telkom Red accent gradient background (subtle)
- Trend indicators (up/down/neutral with colors)
- Hover lift animation
- Loading skeleton states

#### RichKpiCard Component

**Location**: `frontend/src/components/dashboard/RichKpiCard.tsx`

**Usage**:
```jsx
import { RichKpiCard } from "@/components/dashboard/RichKpiCard"

<RichKpiCard
  title="Revenue Breakdown"
  value="Rp 2.5 M"
  trend={{ direction: "up", value: 15, label: "vs last quarter" }}
  chartData={[
    { name: "Product A", value: 400, color: "#E42313" },
    { name: "Product B", value: 300, color: "#706F6F" }
  ]}
  chartType="currency"
  metrics={[
    { label: "Product A", value: "Rp 1.2 M", variant: "success" },
    { label: "Product B", value: "Rp 900 K", variant: "default" }
  ]}
  detailMetrics={[
    { label: "Growth Rate", value: "15%" },
    { label: "Target", value: "Rp 3 M" }
  ]}
/>
```

**Features**:
- Enhanced KPI with Recharts pie chart integration
- Two-column grid layout (chart left, metrics right)
- Color-coded metric badges (success/warning/info/default)
- Progress bar visualization
- Detail metrics section

#### PaymentMethodBadge Component

**Pattern**:
```jsx
const PaymentMethodBadge = ({ method }) => (
  <Badge
    variant="secondary"
    className="min-w-[80px] justify-center capitalize"
  >
    {method === "satu_kali" ? "Satu Kali" :
     method === "termin" ? "Termin" :
     method === "berulang" ? "Berulang" : method}
  </Badge>
)
```

---

## 6. Animation & Motion

### Framer Motion Library

**Configuration File**: `frontend/src/lib/motion.ts`

The application uses **Framer Motion** (imported as `motion` from "motion/react") for declarative animations.

### Animation Variants

**Standard Variants**:

```typescript
// Fade in with upward movement (entrance animation)
export const fadeInUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.2, ease: "easeOut" }
}

// Simple fade
export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.15 }
}

// Slide down (headers)
export const slideDown = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.22, ease: "easeOut" }
}

// Hover lift
export const hoverLift = {
  whileHover: { y: -2 },
  transition: { duration: 0.15, ease: "easeOut" }
}

// Hover scale
export const hoverScale = {
  whileHover: { scale: 1.02 },
  transition: { duration: 0.15, ease: "easeOut" }
}

// Tap feedback
export const tapScale = {
  whileTap: { scale: 0.98 },
  transition: { duration: 0.1 }
}
```

**Stagger Animations**:

```typescript
// Container for staggered children
export const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
}

// Stagger item (child)
export const staggerItem = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.2, ease: "easeOut" }
}

// Faster stagger for tables
export const tableRowStagger = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.05
    }
  }
}
```

### Usage Examples

**Card Entrance Animation**:
```jsx
import { motion } from "motion/react"
import { fadeInUp } from "@/lib/motion"

<motion.div
  initial="initial"
  animate="animate"
  exit="exit"
  variants={fadeInUp}
>
  <Card>Content</Card>
</motion.div>
```

**Staggered List**:
```jsx
import { motion } from "motion/react"
import { staggerContainer, staggerItem } from "@/lib/motion"

<motion.div
  variants={staggerContainer}
  initial="initial"
  animate="animate"
>
  {items.map((item) => (
    <motion.div key={item.id} variants={staggerItem}>
      <Card>{item.name}</Card>
    </motion.div>
  ))}
</motion.div>
```

**Hover Effects**:
```jsx
import { motion } from "motion/react"

// Lift on hover
<motion.div
  whileHover={{ y: -4 }}
  transition={{ duration: 0.2 }}
>
  <Card>Hoverable card</Card>
</motion.div>

// Scale on hover
<motion.button
  whileHover={{ scale: 1.02 }}
  whileTap={{ scale: 0.98 }}
  transition={{ duration: 0.15 }}
>
  Click me
</motion.button>
```

**Loading Skeleton**:
```jsx
// Use Tailwind's animate-pulse
<div className="animate-pulse">
  <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
  <div className="h-4 bg-muted rounded w-1/2"></div>
</div>
```

### Animation Best Practices

1. **Respect User Preferences**:
   - The `index.css` includes `prefers-reduced-motion` support
   - Disable animations for users who prefer reduced motion

2. **Duration Guidelines**:
   - **Quick interactions**: 0.1s - 0.15s (buttons, hovers)
   - **Standard transitions**: 0.2s - 0.25s (cards, modals)
   - **Entrance animations**: 0.2s - 0.3s (page loads)
   - **Stagger delays**: 0.05s - 0.08s between items

3. **Easing Functions**:
   - Use `ease-out` for entrances (objects decelerating into view)
   - Use `ease-in` for exits (objects accelerating out)
   - Use `ease-in-out` for continuous movements

4. **Performance**:
   - Animate `transform` and `opacity` (GPU-accelerated)
   - Avoid animating `width`, `height`, `top`, `left` (causes reflows)
   - Use `will-change` sparingly for complex animations

---

## 7. Accessibility

### Focus Management

**Focus Ring Pattern**:
```typescript
const designTokens = {
  focusRing: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80"
}
```

**Apply to interactive elements**:
```jsx
<button className={designTokens.focusRing}>
  Accessible Button
</button>
```

### Form Validation States

**Error State Pattern**:
```jsx
<Input
  aria-invalid={!!errors.fieldName}
  aria-describedby={errors.fieldName ? "field-error" : undefined}
  className={cn(
    "transition-colors",
    errors.fieldName && "border-destructive ring-destructive/20"
  )}
/>
{errors.fieldName && (
  <p id="field-error" className="text-xs text-destructive mt-1">
    {errors.fieldName.message}
  </p>
)}
```

### ARIA Attributes

**Required Fields**:
```jsx
<Label htmlFor="customer-name">
  Customer Name <span className="text-destructive">*</span>
</Label>
<Input
  id="customer-name"
  required
  aria-required="true"
/>
```

**Disabled Elements**:
```jsx
<Button disabled aria-disabled="true">
  Submit
</Button>
```

**Loading States**:
```jsx
<Button disabled aria-busy="true">
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>
```

### Semantic HTML

**Use semantic elements**:
```jsx
// Good
<main>
  <section>
    <h1>Page Title</h1>
    <article>Content</article>
  </section>
</main>

// Avoid
<div>
  <div>
    <div className="text-2xl font-bold">Page Title</div>
    <div>Content</div>
  </div>
</div>
```

### Keyboard Navigation

**Ensure keyboard accessibility**:
- All interactive elements must be keyboard accessible
- Use `tabIndex={0}` for custom interactive elements
- Use `tabIndex={-1}` to programmatically focus elements
- Provide keyboard shortcuts for common actions

**Skip Links** (for navigation):
```jsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground"
>
  Skip to main content
</a>
```

### Reduced Motion Support

**CSS** (already in `index.css`):
```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

**JavaScript Detection**:
```typescript
const prefersReducedMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)"
).matches

// Conditionally apply animations
<motion.div
  animate={prefersReducedMotion ? {} : { y: -4 }}
>
```

---

## 8. Code Patterns

### Component Structure Template

```tsx
import { FC } from "react"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { fadeInUp } from "@/lib/motion"

interface MyComponentProps {
  title: string
  description?: string
  className?: string
  // Add more props as needed
}

export const MyComponent: FC<MyComponentProps> = ({
  title,
  description,
  className
}) => {
  return (
    <motion.div
      variants={fadeInUp}
      initial="initial"
      animate="animate"
      className={cn("relative", className)}
    >
      <Card className="rounded-[1.25rem] border border-border/70">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </CardHeader>
        <CardContent>
          {/* Component content */}
        </CardContent>
      </Card>
    </motion.div>
  )
}
```

### Design Tokens Pattern

**Define reusable tokens**:
```typescript
const designTokens = {
  radius: {
    sm: "rounded-sm",
    md: "rounded-md",
    lg: "rounded-lg",
    xl: "rounded-[1.25rem]"
  },
  shadow: {
    sm: "shadow-[0_10px_30px_-18px_rgba(15,23,42,0.45)]",
    hover: "hover:shadow-[0_18px_48px_-32px_rgba(215,25,32,0.55)]"
  },
  border: "border border-border/70",
  surface: {
    base: "bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/90"
  },
  focusRing: "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d71920]/80"
}
```

**Use with `cn()` helper**:
```jsx
import { cn } from "@/lib/utils"

<Card className={cn(
  designTokens.radius.xl,
  designTokens.shadow.sm,
  designTokens.border,
  "transition-all duration-200",
  designTokens.shadow.hover
)}>
```

### Currency Formatting

**Use the `formatCurrency` helper**:
```typescript
import { formatCurrency } from "@/lib/utils"

// Compact format (default)
formatCurrency(1_500_000)         // "Rp 1,5 Jt"
formatCurrency(2_300_000_000)     // "Rp 2,3 M"

// Full format
formatCurrency(1_234_567, "full") // "Rp 1.234.567"
```

### Conditional Styling

**Use `cn()` for conditional classes**:
```jsx
import { cn } from "@/lib/utils"

<div className={cn(
  "px-4 py-2 rounded-lg",
  isActive && "bg-primary text-primary-foreground",
  isDisabled && "opacity-50 cursor-not-allowed",
  size === "large" && "text-lg",
  className // Allow override from props
)}>
```

### Loading States

**Loading Button**:
```jsx
import { Loader2 } from "lucide-react"

<Button disabled={isLoading}>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  {isLoading ? "Processing..." : "Submit"}
</Button>
```

**Loading Card Skeleton**:
```jsx
const LoadingCard = () => (
  <Card className="rounded-[1.25rem]">
    <CardHeader>
      <div className="animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-muted rounded w-3/4"></div>
      </div>
    </CardHeader>
    <CardContent>
      <div className="animate-pulse space-y-2">
        <div className="h-4 bg-muted rounded"></div>
        <div className="h-4 bg-muted rounded w-5/6"></div>
      </div>
    </CardContent>
  </Card>
)
```

### Empty States

```jsx
import { FileX } from "lucide-react"

const EmptyState = ({ title, description, action }) => (
  <div className="flex flex-col items-center justify-center p-12 text-center">
    <div className="rounded-full bg-muted p-6 mb-4">
      <FileX className="h-12 w-12 text-muted-foreground" />
    </div>
    <h3 className="text-lg font-semibold mb-2">{title}</h3>
    <p className="text-sm text-muted-foreground mb-6 max-w-sm">
      {description}
    </p>
    {action}
  </div>
)

// Usage
<EmptyState
  title="No contracts found"
  description="Upload your first contract PDF to get started."
  action={<Button>Upload Contract</Button>}
/>
```

---

## 9. Best Practices

### 1. Use Design Tokens

**Always define reusable design tokens** instead of repeating class names:

```tsx
// Good
const designTokens = {
  card: "rounded-[1.25rem] border border-border/70 shadow-sm"
}

<Card className={designTokens.card}>

// Avoid
<Card className="rounded-[1.25rem] border border-border/70 shadow-sm">
```

### 2. Consistent Spacing

**Use consistent spacing values** across components:

```tsx
// Good - uses Tailwind scale
<div className="space-y-6">
  <Card className="p-6">
    <div className="space-y-4">

// Avoid - arbitrary values
<div style={{ marginBottom: "23px" }}>
```

### 3. Semantic Color Usage

**Use semantic color tokens** instead of hardcoding:

```tsx
// Good
<Badge className="bg-success text-success-foreground">Active</Badge>
<Alert variant="destructive">Error message</Alert>

// Avoid
<Badge className="bg-green-500 text-white">Active</Badge>
<Alert className="bg-red-100 border-red-500">Error message</Alert>
```

### 4. Accessible Forms

**Always include proper labels and error states**:

```tsx
// Good
<Field>
  <Label htmlFor="email">Email *</Label>
  <Input
    id="email"
    type="email"
    aria-invalid={!!errors.email}
    aria-describedby={errors.email ? "email-error" : undefined}
  />
  {errors.email && (
    <FieldError id="email-error">{errors.email.message}</FieldError>
  )}
</Field>

// Avoid
<input type="email" placeholder="Email" />
```

### 5. Component Composition

**Prefer composition over props drilling**:

```tsx
// Good
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardAction>
      <Button>Action</Button>
    </CardAction>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>

// Avoid
<Card
  title="Title"
  action={<Button>Action</Button>}
  content="Content"
/>
```

### 6. TypeScript Types

**Always define proper TypeScript interfaces**:

```tsx
// Good
interface CustomerCardProps {
  customer: {
    name: string
    npwp?: string
    address: string
  }
  onEdit?: () => void
  className?: string
}

export const CustomerCard: FC<CustomerCardProps> = ({ ... }) => {

// Avoid
export const CustomerCard = (props: any) => {
```

### 7. Performance Optimization

**Optimize re-renders and animations**:

```tsx
// Good - memoized components
import { memo } from "react"

export const ExpensiveCard = memo(({ data }) => {
  return <Card>{/* Complex rendering */}</Card>
})

// Good - GPU-accelerated animations
<motion.div
  animate={{ opacity: 1, transform: "translateY(0)" }}
>

// Avoid - CPU-intensive animations
<motion.div
  animate={{ width: "100%", height: "200px" }}
>
```

### 8. Responsive Design

**Always consider mobile-first design**:

```tsx
// Good
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <Card className="p-4 md:p-6">
    <h2 className="text-lg md:text-xl lg:text-2xl">

// Avoid - desktop-only layouts
<div className="grid grid-cols-3">
  <Card className="p-6">
```

### 9. Icon Usage

**Use Lucide React icons consistently**:

```tsx
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react"

// Good - consistent sizing
<CheckCircle2 className="h-4 w-4 text-success" />

// Avoid - inconsistent sizing
<CheckCircle2 style={{ fontSize: "17px" }} />
```

### 10. Error Handling UI

**Provide clear error feedback**:

```tsx
// Good
{error && (
  <Alert variant="destructive">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Error</AlertTitle>
    <AlertDescription>
      {error.message || "An unexpected error occurred. Please try again."}
    </AlertDescription>
  </Alert>
)}

// Avoid
{error && <p className="text-red-500">Error!</p>}
```

---

## Quick Reference Card

### Common Patterns Cheat Sheet

```tsx
// Card with hover effect
<Card className="rounded-[1.25rem] border border-border/70 shadow-sm hover:shadow-lg transition-all">

// Primary button
<Button variant="default" className={designTokens.focusRing}>

// Muted text
<p className="text-sm text-muted-foreground">

// Uppercase label
<span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">

// Numeric value (aligned)
<span className="tabular-nums font-semibold">

// Grid layout (responsive)
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

// Stack layout (vertical)
<div className="space-y-6">

// Flex layout (horizontal)
<div className="flex items-center gap-4">

// Loading state
<Button disabled>
  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
  Loading...
</Button>

// Error input
<Input
  aria-invalid={true}
  className="border-destructive ring-destructive/20"
/>

// Currency formatting
{formatCurrency(1_500_000)} // "Rp 1,5 Jt"

// Animation entrance
<motion.div variants={fadeInUp} initial="initial" animate="animate">
```

---

## Resources

### Documentation Links

- **Tailwind CSS**: https://tailwindcss.com/docs
- **shadcn/ui**: https://ui.shadcn.com
- **Radix UI**: https://www.radix-ui.com
- **Framer Motion**: https://www.framer.com/motion
- **Lucide Icons**: https://lucide.dev

### Project Files

- **Design Tokens**: `frontend/src/lib/motion.ts`, `frontend/src/lib/utils.ts`
- **Global Styles**: `frontend/src/index.css`
- **shadcn Config**: `frontend/components.json`
- **Component Library**: `frontend/src/components/ui/`
- **Custom Components**: `frontend/src/components/` (subdirectories)

### Need Help?

When building new components:

1. Check if a shadcn/ui component exists first
2. Review similar existing components in the codebase
3. Use design tokens from this guide
4. Test accessibility (keyboard navigation, screen readers)
5. Test responsiveness (mobile, tablet, desktop)
6. Add loading and error states
7. Document any new patterns

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Maintained By**: Development Team
