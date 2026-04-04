# Design System Specification: The Luminous Void

## 1. Overview & Creative North Star
This design system is built upon the Creative North Star of **"The Luminous Void."** It is an editorial approach to spatial computing on the web, where knowledge isn't just displayed—it is unearthed. We move away from the "flat web" by blending the weightless translucency of Apple visionOS, the clinical precision of Linear, and the utility-first speed of Raycast.

The system rejects the traditional rigid grid in favor of **intentional asymmetry** and **tonal depth**. Elements should feel as though they are suspended in a deep, atmospheric environment. We achieve a premium feel through high-contrast typography scales, multi-layered glass surfaces, and a total rejection of standard decorative lines.

---

## 2. Colors & Surface Architecture
The color palette is rooted in the deep shadows of the cosmos, punctuated by "Cyber" and "Emerald" pulses that represent AI activity and user focus.

### The Surface Hierarchy
Depth is the primary navigator. Instead of using lines to separate content, we use the **Surface Tiering** model.
*   **Base Layer:** `surface` (#0b1326) acts as the infinite background.
*   **Sectioning:** Use `surface_container_low` for large structural areas.
*   **Interaction Hubs:** Use `surface_container_high` for primary interactive modules.
*   **Floating Elements:** Use `surface_container_highest` for elements that sit closest to the user (modals, tooltips).

### The "No-Line" Rule
**Explicit Instruction:** 1px solid borders for sectioning are strictly prohibited. Boundaries must be defined solely through background color shifts or subtle tonal transitions. For example, a `surface_container_low` card sitting on a `surface` background creates a natural edge without a line.

### The "Glass & Gradient" Rule
To achieve the premium VisionOS aesthetic, all floating panels must utilize **Glassmorphism**:
*   **Fill:** `surface_variant` at 40%–60% opacity.
*   **Effect:** `backdrop-filter: blur(40px) saturate(150%)`.
*   **Signature Textures:** Main CTAs and Hero backgrounds should utilize a smooth linear gradient from `primary` (#8ed5ff) to `primary_container` (#38bdf8) at a 135° angle to provide "visual soul."

---

## 3. Typography: Editorial Authority
The typography system balances the warmth of **Manrope** (Display/Headlines) with the technical precision of **Inter** (Body) and the utilitarian "data" feel of **Space Grotesk** (Labels).

*   **Display (Manrope):** Set with tight letter-spacing (-0.04em) and generous leading. Use `display-lg` to create "Hero Moments" where the type is the primary visual anchor.
*   **Body (Inter):** Highly legible, optimized for long-form study sessions. Use `body-md` for standard text and `body-lg` for introductory paragraphs.
*   **Labels (Space Grotesk):** All-caps, slightly tracked out (+0.05em). These are used for "System States" and metadata, lending a high-tech, instrument-panel aesthetic.

---

## 4. Elevation & Depth (The Z-Axis)
We do not use "drop shadows" in the traditional sense; we use **Ambient Occlusion** and **Tonal Stacking**.

### The Layering Principle
Place a `surface_container_lowest` card inside a `surface_container_low` section to create a "sunken" effect. Conversely, place a `surface_container_highest` card on a `surface` background to create "lift."

### Ambient Shadows
When an element must float, shadows must be extra-diffused:
*   **Color:** Use `on_surface` at 6% opacity.
*   **Blur:** 60px to 100px.
*   **Spread:** -10px (to keep the shadow tucked under the object).

### The "Ghost Border" Fallback
If a border is required for accessibility in input states, use a **Ghost Border**:
*   **Token:** `outline_variant` at 15% opacity.
*   **Effect:** Add a 1px inner-glow using the `primary` token at 10% opacity for a subtle "energized" edge.

---

## 5. Components

### 3D Floating Cards
*   **Radius:** `lg` (2rem) or `xl` (3rem).
*   **Style:** `surface_container_low` with a 40px backdrop blur.
*   **Hover State:** Increase elevation by shifting to `surface_container_high` and adding a 2px "rim light" using a gradient stroke (Top-Left: `primary`, Bottom-Right: transparent).

### Buttons
*   **Primary:** Solid gradient (`primary` to `primary_container`). 
*   **Secondary:** Glass-filled (`surface_variant` at 30%) with a Ghost Border.
*   **Shape:** `full` (pill-shaped) to contrast against the softer `xl` radius of the containers.
*   **Interaction:** On hover, a subtle `glow` using the `primary` token (blur 20px, 20% opacity).

### Input Fields
*   **Visual:** No background color—only a `surface_container_lowest` fill.
*   **State:** On focus, the container transitions to a `primary` Ghost Border and the text uses `primary_fixed`.
*   **Separation:** No dividers in forms; use `spacing-xl` to group related inputs.

### AI Knowledge Nodes (Chips)
*   **Visual:** `secondary_container` background with `on_secondary_container` text.
*   **Active State:** Use `tertiary` (#4ee6aa) with a soft outer glow to indicate "AI Processing" or "Active Study."

---

## 6. Do's and Don'ts

### Do
*   **Do** use overlapping elements. A glass panel should partially obscure a background gradient to showcase the blur effect.
*   **Do** use `display-lg` typography as a decorative element (e.g., background watermarks at 5% opacity).
*   **Do** use vertical white space (32px+) to separate list items rather than lines.

### Don't
*   **Don't** use 100% opaque, high-contrast borders. It breaks the "Luminous Void" immersion.
*   **Don't** use pure black (#000000) for shadows. Always tint shadows with the `on_surface` color.
*   **Don't** use sharp corners. Everything in this system must feel "haptic" and organic, hence the minimum 24px (`lg`) radius for cards.
*   **Don't** clutter the UI. If a screen feels busy, increase the background `surface` area and let the typography breathe.