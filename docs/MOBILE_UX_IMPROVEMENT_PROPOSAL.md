# Mobile UX Improvement Proposal: Fine Sort Interface

**Role:** Mobile UX Expert / Senior Frontend Dev
**Date:** 2025-12-21
**Context:** Fine Sort Page (Pyramid Grid + Deck)

## 1. Executive Summary

The current mobile interface faces a critical challenge common in complex productivity apps: **Vertical Space Scarcity**.
By splitting the screen approx. 60/40 between the Grid and the Deck, we compromise both:

- The **Grid** is too small to see the "Big Picture", forcing constant panning.
- The **Deck** context is visually heavy, yet only shows 1.5 rows of cards.

**Recommendation:** Move from a "Split Screen" model to a **"Mode-Based"** or **"Focus Flow"** model where the interface adapts to the user's intent (Picking vs. Placing).

---

## 2. Identified Pain Points

### A. Vertical Constraint (The "Keyhole" Effect)

As seen in the screenshots, the functional grid area is often occluded by the Deck. Users act through a "keyhole," moving the grid behind a static overlay.

- _Impact_: Disorientation. Hard to compare cards placed at top vs. bottom.

### B. Disconnected Interaction

1. User selects a Pile (Tab).
2. User scrolls carousel to find a card.
3. User taps a card.
4. **Friction**: The user now needs to place the card, but the Deck stays fully open, occupying 40% of the screen with content that is now irrelevant (other cards).

### C. Visual Redundancy

- The "Selectionnez -> Placez" instruction takes ~50px.
- The 3 "Pile Tabs" take ~60px.
- These controls remain prominent even when they are not the primary focus (e.g., when trying to find a slot for a selected card).

---

## 3. Proposed Solutions

### Solution A: The "Focus Flow" (Dynamic Deck) ⭐ _Recommended_

Automate the maximizing/minimizing of the deck based on the interaction state.

**Behavior:**

1.  **Idle / Browsing**: Deck is **OPEN** (height ~40%). Grid is pushed up.
2.  **Card Selected**: Deck **COLLAPSES** automatically to a specific **"Active Card HUD"** (height ~80px).
    - _Result_: Grid expands to 90% screen height.
    - _Benefit_: Maximum space to place the card.
3.  **Card Placed**: Deck **RE-OPENS** automatically to show the next cards.
    - _Flow_: Tap Card -> Screen Clears (Animates down) -> Tap Slot -> Deck Slides Up.

### Solution B: Compact UI (The "Toolbar" Approach)

Aggressively reduce the static footprint of the deck.

**Changes:**

1.  **Merge Instruction & Tabs**:
    - Remove the dedicated "Instruction" bar.
    - Use a concise "Segmented Control" for Piles (Red/Gray/Green) on the same row as the "Reset" button (or in a floating bar).
2.  **Horizontal Card Aspect**:
    - Change mobile cards from "Vertical" (3:4) to "Horizontal" or "Square" to reduce the necessary carousel height.
    - Text can flow better in a wider, shorter card on mobile.
3.  **Transparent Overlay**:
    - Make the deck background semi-transparent blur (`backdrop-blur-md`) so users can vaguely see grid context behind it.

### Solution C: Haptic & Micro-interactions

Enhance the "Feel" to compensate for the small screen.

- **Vibration**: Light haptic tick when dragging over a valid slot.
- **Snap**: Stronger magnetic snap visualization (slot highlights) when a card is selected, guiding the eye.

---

## 4. Implementation Plan

### Phase 1: Quick Wins (Compact UI)

1.  Refine `GridSort.tsx` layout.
2.  Reduce height of Pile/Deck headers.
3.  Implement "Active Card" overlay that covers the deck tabs (saving ~60px).

### Phase 2: Focus Flow (State Logic)

1.  Modify `useFineSortDrag` or `GridSort` state to track `isPlacingMode`.
2.  Animate Deck height based on `isPlacingMode`.
    - `selectedCard !== null` => `height: 100px` (HUD).
    - `selectedCard === null` => `height: 350px` (Browser).

## 5. Mockup Description (Focus Mode)

**State: Card Selected**

```
+--------------------------------------------------+
|  Exemple d'étude                        (Global) |
|                                                  |
|           [   Grid Area Expanded   ]             |
|           [   Full Visibility      ]             |
|           [                        ]             |
|                                                  |
+--------------------------------------------------+
| [X]  S05:  "This is the selected card..."        |  <-- HUD Bar
+--------------------------------------------------+
```

_The Pile tabs and other cards are hidden._

**State: Browsing**

```
+--------------------------------------------------+
|  Exemple d'étude                        (Global) |
|           [   Grid Area Compact    ]             |
+--------------------------------------------------+
| [ Disagree ] [ Neutral ] [ Agree ]               |  <-- Tabs
| [ Card 1 ] [ Card 2 ] [ Card 3 ]                 |
| [ Card 4 ] ...                                   |
+--------------------------------------------------+
```

---

_Ready to implement Phase 1 & 2 upon validation._
