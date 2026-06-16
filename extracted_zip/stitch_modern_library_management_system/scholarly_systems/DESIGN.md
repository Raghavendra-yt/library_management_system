---
name: Scholarly Systems
colors:
  surface: '#fbf8fa'
  surface-dim: '#dcd9db'
  surface-bright: '#fbf8fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f4'
  surface-container: '#f0edef'
  surface-container-high: '#eae7e9'
  surface-container-highest: '#e4e2e3'
  on-surface: '#1b1b1d'
  on-surface-variant: '#45474c'
  inverse-surface: '#303032'
  inverse-on-surface: '#f3f0f2'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#1e1200'
  on-tertiary: '#ffffff'
  tertiary-container: '#35260c'
  on-tertiary-container: '#a38c6a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fadfb8'
  tertiary-fixed-dim: '#ddc39d'
  on-tertiary-fixed: '#271902'
  on-tertiary-fixed-variant: '#564427'
  background: '#fbf8fa'
  on-background: '#1b1b1d'
  surface-variant: '#e4e2e3'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  mono-sm:
    fontFamily: Geist
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  page_padding: 24px
  element_gap: 16px
  stack_gap_sm: 8px
  section_margin: 32px
  container_max_width: 1440px
---

## Brand & Style
The design system is engineered for utility, clarity, and institutional trust. It serves a library management environment where data density and legibility are paramount. The aesthetic follows a **Corporate / Modern** direction, utilizing a flat UI approach with intentional whitespace to reduce cognitive load during administrative tasks. 

The emotional response should be one of organized efficiency. By combining a "Deep Slate Navy" foundation with clear, semantic status indicators, the interface guides the user through complex workflows—such as cataloging and circulation—without visual friction.

## Colors
The palette is anchored by **Deep Slate Navy**, used for high-level navigation and primary headers to establish a strong structural frame. 

- **Surface Strategy:** The primary background is a clean white, while a light gray (`#F8FAFC`) is used for secondary containers, sidebar backgrounds, and table headers to create subtle separation.
- **Semantic Logic:** State-based colors are used strictly for status. **Emerald Green** indicates "Available" or "Check-in Success." **Amber** signals "Loaned" or "Pending." **Soft Crimson** is reserved for critical "Overdue," "Fines," or "System Errors."

## Typography
The system uses **Inter** for its exceptional legibility in data-heavy environments and its neutral, professional character. 

- **Scale:** A tight typographic scale ensures that large amounts of metadata (ISBNs, call numbers, titles) can fit on a single screen without sacrificing hierarchy.
- **Data Display:** For technical strings like ISBNs or barcodes, a monospaced font (Geist) may be used within the `mono-sm` role to ensure character alignment.
- **Contrast:** High-level headers use `600` or `700` weights in Slate Navy to provide clear entry points for the eye.

## Layout & Spacing
The layout follows a **Fixed-Fluid Hybrid** model. Navigation sidebars are fixed-width (260px), while the main content area is fluid up to a maximum width of 1440px to prevent excessive line lengths in data tables.

- **Rhythm:** A consistent 8px grid governs the spacing. Standard page padding is set to 24px, while internal component gaps (like items in a list or fields in a form) are set to 16px.
- **Breakpoints:**
  - **Desktop (1024px+):** 12-column grid, 24px margins, 16px gutters.
  - **Tablet (768px - 1023px):** 8-column grid, 24px margins, 16px gutters. Sidebar collapses to icons.
  - **Mobile (<767px):** 4-column grid, 16px margins, 12px gutters. Navigation moves to a bottom bar or hamburger menu.

## Elevation & Depth
To maintain a modern, flat aesthetic, the design system utilizes **Tonal Layers** supplemented by very subtle **Ambient Shadows**.

- **Z-Index 0 (Base):** Light gray background surfaces.
- **Z-Index 1 (Cards/Content):** White surfaces with a 1px border (`#E2E8F0`) and a soft shadow (0px 1px 3px rgba(0,0,0,0.05)).
- **Z-Index 2 (Interactive):** Hovered cards or buttons, featuring a slightly more pronounced shadow (0px 4px 6px rgba(0,0,0,0.07)).
- **Overlays:** Modals and dropdowns use a sharp 1px border and a medium diffusion shadow to lift them clearly above the data grid.

## Shapes
The shape language is "Rounded," utilizing a standard radius of **8px** for most UI components like buttons, input fields, and cards. This softens the professional tone and provides a more approachable feel for daily users.

- **Small elements:** Checkboxes and tags use a 4px radius.
- **Large elements:** Modals and main content containers use a 12px (`rounded-lg`) radius to establish them as primary architectural containers.

## Components
- **Buttons:** Primary buttons use the Deep Slate Navy background with white text. Secondary buttons use a light gray outline or ghost style.
- **Status Chips:** Small badges with a light tinted background and dark foreground text. (e.g., Available: Light Emerald background, Dark Emerald text).
- **Data Tables:** High-density rows (48px height) with subtle dividers. The header row should be `#F1F5F9` with `label-md` typography.
- **Input Fields:** 8px rounded corners with a 1px Slate-200 border. On focus, the border shifts to Slate Navy or a primary blue accent.
- **Cards:** Used for book previews. Features a 1px border, 8px corner radius, and a subtle bottom shadow.
- **Search Bar:** A prominent global search bar in the header with a soft gray background and an inset search icon.