# BookDate Card Stack Animations

**Status:** ✅ Implemented | Pure CSS card stack with smooth exit/advance animations

## Overview
Visual card stack (3 visible cards) with GPU-accelerated animations. Top card swipes away, remaining cards advance forward smoothly.

## Key Components

### CardStack.tsx
- **Location:** `src/components/bookdate/CardStack.tsx`
- **Purpose:** Orchestrates 3-card stack rendering and animation lifecycle
- **Props:**
  - `recommendations: any[]` - Full recommendations array
  - `currentIndex: number` - Index of current top card
  - `onSwipe: (action, markedAsKnown?) => void` - Swipe handler (API call)
  - `onSwipeComplete: () => void` - Called after animations finish

**Animation Flow:**
1. User swipes → `handleSwipeStart` triggered
2. Exit animation starts (400ms) → API call
3. Exit completes → `visibleCards` array updated to exclude exited card
4. Advance animation starts (350ms) → Cards move from positions 1,2,3 to 0,1,2
5. Advance completes → `onSwipeComplete` called → `currentIndex` incremented

**State Management:**
- `isExiting: boolean` - Exit animation in progress
- `exitDirection: 'left' | 'right' | 'up'` - Which exit animation to play
- `isAdvancing: boolean` - Advance animation in progress

**Visible Cards Logic:**
- **Normal:** Shows cards at `[currentIndex, currentIndex+1, currentIndex+2]` with `stackPosition` 0, 1, 2
- **During Advance:** Shows cards at `[currentIndex+1, currentIndex+2, currentIndex+3]` with `stackPosition` 0, 1, 2 and `fromPosition` 1, 2, 3
  - This excludes the exited card and prevents snapping
  - `fromPosition` determines which advance animation to apply

### RecommendationCard.tsx Updates
- **New Props:**
  - `stackPosition?: number` - 0=top, 1=middle, 2=bottom (default: 0)
  - `isAnimating?: boolean` - Disables gestures during animations (default: false)
  - `isDraggable?: boolean` - Only top card accepts input (default: true)

**Behavior:**
- Swipe handlers disabled when `!isDraggable || isAnimating`
- Desktop buttons hidden when `stackPosition !== 0`
- Drag offset only updates for top card

### page.tsx Updates
- **Changed:** Import `CardStack` instead of `RecommendationCard`
- **Added:** `handleSwipeComplete()` callback
- **Modified:** `handleSwipe()` no longer increments `currentIndex` (delegated to `handleSwipeComplete`)

## CSS Animations

**Location:** `src/app/globals.css`

### Exit Animations (400ms, ease-in-out)
```css
.animate-exit-left   /* translate(-150%, 50px) rotate(-25deg) */
.animate-exit-right  /* translate(150%, 50px) rotate(25deg) */
.animate-exit-up     /* translate(0, -120%) scale(0.8) */
```

### Advance Animations (350ms, bounce easing)
```css
.animate-advance-to-top     /* scale(0.95→1.0), translateY(-12px→0) */
.animate-advance-to-middle  /* scale(0.90→0.95), translateY(-24px→-12px) */
.animate-enter              /* scale(0.85→0.90), translateY(-36px→-24px) */
```

### Stack Position Classes (Static)
```css
.card-stack-position-0  /* z-50, scale(1.0), translateY(0), opacity(1.0) */
.card-stack-position-1  /* z-40, scale(0.95), translateY(-12px), opacity(0.95) */
.card-stack-position-2  /* z-30, scale(0.90), translateY(-24px), opacity(0.90) */
```

### Performance Optimizations
```css
.card-stack-container  /* perspective: 1000px, preserve-3d */
.card-stack-item       /* will-change: transform, opacity */
```

## Animation Timing

| Phase | Duration | Easing | Description |
|-------|----------|--------|-------------|
| Exit | 400ms | ease-in-out | Top card swipes away |
| Advance | 350ms | cubic-bezier(0.34, 1.56, 0.64, 1) | Cards move forward (slight bounce) |
| Total | 750ms | - | Full swipe cycle |

**Staggering:** Advance animations start after exit completes (sequential, not overlapping).

## Edge Cases Handled

### Rapid Swipes
- **Problem:** User swipes again during animation
- **Solution:** `isAnimating` flag blocks gestures and button clicks
- **Code:** `CardStack.handleSwipeStart()` checks `isExiting || isAdvancing`

### <3 Cards Remaining
- **Problem:** Not enough cards to fill stack
- **Solution:** `CardStack` renders only available cards (0-3)
- **Behavior:** Stack naturally shrinks as user approaches end

### Undo Functionality
- **Problem:** Undo reverses card to top, but animations may be in progress
- **Solution:** `useEffect` in `CardStack` resets animation states when `currentIndex` changes externally
- **Code:** `useEffect(() => { setIsExiting(false); ... }, [currentIndex])`

### Empty State
- **Problem:** No cards to render
- **Solution:** `CardStack` returns `null`, `page.tsx` shows empty state UI
- **Trigger:** `currentIndex >= recommendations.length`

## Mobile Performance

**Target:** 60fps on mobile devices

**Optimizations:**
- GPU-accelerated properties only (`transform`, `opacity`, not `left/top/width`)
- `will-change: transform, opacity` hints browser to optimize
- `backface-visibility: hidden` prevents rendering artifacts
- No layout shift (cards positioned absolutely)

**Tested On:**
- Chrome (desktop + mobile)
- Safari (iOS + macOS)
- Firefox

## User Experience

**Visual Hierarchy:**
- Top card: Full size, interactive, clear visuals
- Card 2: 95% scale, 95% opacity, visible but de-emphasized
- Card 3: 90% scale, 90% opacity, subtle depth cue

**Swipe Directions:**
- Left: Reject (red overlay, rotate left)
- Right: Request (green overlay, confirm toast, rotate right)
- Up: Dismiss (blue overlay, shrink up)

**Toast Confirmation:**
- Right swipe triggers toast modal
- User chooses: "Request" or "Mark as Liked"
- Card exit animation plays after choice

## Integration with Existing Features

### Settings Widget
- **Status:** No changes required
- **Behavior:** Opens over card stack, gestures disabled when modal open

### Undo Button
- **Status:** Works with stack
- **Behavior:** Triggers `loadRecommendations()` → Cards re-render from API
- **Animation:** No special animation (instant reset to fresh state)

### Progress Indicator
- **Status:** No changes required
- **Display:** Shows `currentIndex + 1 / recommendations.length`

### Desktop Buttons
- **Status:** Updated to disable during animations
- **Code:** `disabled={isAnimating}` in `RecommendationCard.tsx:217-234`

## Troubleshooting

### Cards Not Stacking
- **Check:** CSS classes applied correctly in `CardStack.tsx`
- **Verify:** `card-stack-position-{0,1,2}` classes present in `globals.css`
- **Debug:** Inspect z-index values (50, 40, 30)

### Cards Snapping Instead of Animating
- **Root Cause:** Exited card still in `visibleCards` array during advance phase
- **Fix:** During `isAdvancing`, `visibleCards` starts from `currentIndex + 1` (skips exited card)
- **Verify:** Check `CardStack.tsx:71-97` - advance branch excludes card at `currentIndex`

### Animations Not Playing
- **Check:** Exit/advance animation classes applied during state transitions
- **Verify:** `animationClass` computed correctly based on `card.fromPosition` during advance
- **Debug:** Console log `isExiting`, `exitDirection`, `isAdvancing`, `visibleCards`

### Gestures Not Working
- **Check:** `isDraggable` prop passed correctly (only true for top card)
- **Verify:** `isAnimating` not stuck in true state
- **Debug:** Check `CardStack` animation state machine

### Performance Issues
- **Check:** Animations targeting only `transform` and `opacity`
- **Verify:** `will-change` applied to `.card-stack-item`
- **Test:** Chrome DevTools Performance tab (60fps target)

## Related Files

- **Documentation:** `documentation/features/bookdate-prd.md` (BookDate feature spec)
- **Components:** `src/components/bookdate/LoadingScreen.tsx`, `SettingsWidget.tsx`
- **API:** `src/app/api/bookdate/swipe/route.ts`

## Future Enhancements (Not Implemented)

- **Preload Card 4:** Load image for 4th card in stack (currently loads on-demand)
- **Spring Physics:** Replace CSS easing with spring animations for more natural feel
- **Haptic Feedback:** Vibrate on swipe (requires Web Vibration API)
- **Parallax Effect:** Cards shift slightly on device tilt (requires DeviceOrientation API)
