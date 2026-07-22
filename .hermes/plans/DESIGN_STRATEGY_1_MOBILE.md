# Design Spec: Strategy 1 — Mobile-First Tap-to-Book

**Priority:** 🟢 GO (no blockers, highest impact/effort ratio)  
**Target Users:** Students arriving on campus, need a room in <2 min  
**Success Metric:** Booking conversion +30%, session duration +60%, time-to-decision -50%

---

## Problem Statement

**Current:** Room Finder shows 2-column desktop grid; users must:
1. Click card → navigate to Live page (page load)
2. Drill into room on Live page
3. Read occupancy history to decide
4. Total time: 2-5 minutes (often abandons)

**Target:** One-tap booking flow on mobile, <2 min start-to-booked

---

## Design: Screen-by-Screen Wireframes

### Screen 1: Room List (Mobile, 375px)

```
┌─────────────────────────────────┐
│ RoomSense           [Presenter] │
├─────────────────────────────────┤
│ Find a Room                     │
│ Green = available now           │
├─────────────────────────────────┤
│                                 │
│ ┌───────────────────────────┐   │
│ │ ◆ Senaatzaal (PhD hall)  │   │  ← 48px height
│ │ Atlas / Floor 0           │   │  ← Easy tap target
│ │ 0 / 80 people            │   │
│ │ [Book Now]               │   │  ← CTA in thumb zone
│ └───────────────────────────┘   │
│                                 │
│ ┌───────────────────────────┐   │
│ │ ◆ Vergaderzaal Höganäs   │   │
│ │ Atlas / Floor 1           │   │
│ │ 0 / 12 people            │   │
│ │ [Book Now]               │   │
│ └───────────────────────────┘   │
│                                 │
│ [More rooms...]                 │
└─────────────────────────────────┘
```

**Key Changes:**
- ✅ Single column (full-width cards)
- ✅ 48px+ tap targets (buttons, cards)
- ✅ "Book Now" button in thumb-reach zone (bottom 50% of card)
- ✅ No drilling required; booking path visible on card
- ✅ Infinite scroll or pagination (not desktop-style grid)

**CSS:**
```css
.room-cards {
  display: grid;
  grid-template-columns: 1fr;  /* Single column mobile */
  gap: 1rem;
  padding: 0 1rem;
}

.room-card {
  min-height: 120px;  /* ≥48px per touch spec */
  padding: 1.25rem;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.room-card button {
  min-height: 48px;  /* Touch-friendly CTA */
  min-width: 48px;
  border-radius: 4px;
  font-size: 1rem;
}

@media (min-width: 768px) {
  .room-cards {
    grid-template-columns: repeat(2, 1fr);  /* Back to 2-col on desktop */
  }
}
```

---

### Screen 2: Room Detail (Card Expansion)

On tap of card, expand inline (no page load):

```
┌─────────────────────────────────┐
│ RoomSense           [Presenter] │
├─────────────────────────────────┤
│ [← Back to List]                │
├─────────────────────────────────┤
│                                 │
│ Senaatzaal (PhD defense hall)   │ ← Title
│ Atlas, Floor 0                  │
│ Capacity: 80 people             │
│                                 │
│ ┌─────────────────────────────┐ │
│ │ ◆◆◆◆◆ 0/80 (0%)           │ │ ← Occupancy bar
│ │ Available until 5:30 PM      │ │
│ └─────────────────────────────┘ │
│                                 │
│ ⚡ Occupancy Trend              │ ← Sparkline/chart
│ Busy after 2pm (Tue pattern)    │
│                                 │
│ 💬 Reviews                      │
│ 4.8★ "Quiet, great for focus"  │
│ 4.2★ "Far from campus"         │
│                                 │
│ 📍 Distance: 10 min walk       │
│ 🔌 Plug outlets: Yes           │
│ 🌙 Quiet: Yes                  │
│                                 │
│ ┌─────────────────────────────┐ │
│ │  [Book Now (2-min slots)]   │ │ ← Full-width CTA
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Micro-interactions:**
- Card expands smoothly (CSS `transition: height 0.3s ease`)
- Occupancy bar animates when expanded (0% → current %)
- Sparkline chart draws on load (smooth animation)
- Each tap/hover gives <100ms visual feedback

---

### Screen 3: Booking Confirmation

On tap "Book Now", show modal:

```
┌─────────────────────────────────┐
│         Confirm Booking          │
├─────────────────────────────────┤
│                                 │
│ Senaatzaal (PhD hall)           │
│ Floor 0, Capacity 80            │
│                                 │
│ Today, 2:30 PM - 5:30 PM        │
│                                 │
│ ✓ This room is available        │
│ ✓ Estimated 0 people there now  │
│                                 │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │   [✓ Confirm Booking]       │ │ ← Primary CTA
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │   [← Back]                  │ │ ← Secondary
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Why confirmation modal?**
- Prevents accidental bookings on mobile
- Clear "you're about to commit" moment
- Shows 1-2 key facts (room, time, availability)

---

### Screen 4: Success State

After confirming:

```
┌─────────────────────────────────┐
│ ✓ Booking Confirmed!             │
├─────────────────────────────────┤
│                                 │
│ 🎉 Senaatzaal (PhD hall)        │
│ Floor 0                         │
│                                 │
│ Today, 2:30 PM - 5:30 PM        │
│                                 │
│ ✓ Your room is ready            │
│ → 10 min walk from Library      │
│ → Building Atlas, 2nd door      │
│                                 │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │   [✓ Find Another Room]     │ │ ← Quick re-book
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │   [Add to Calendar]         │ │ ← Export
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │   [Share with Friends]      │ │ ← Social
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Key:** Quick secondary actions (re-book, export, share) to drive repeat visits.

---

## Real-Time Occupancy Visualization

**Current:** Static "0/80 people" text  
**Proposed:** Animated indicator with three formats (test all):

### Option A: Horizontal Progress Bar

```
◆◆◆◆◆ ░░░░░░░░░ 0/80 (0%)
```

Smooth animation when occupancy changes:
```css
.occupancy-bar {
  width: calc(var(--occupancy-pct) * 1%);
  background: linear-gradient(90deg, #19c37d 0%, #ffb703 50%, #ff6b6b 100%);
  transition: width 0.6s ease-out;
  height: 8px;
  border-radius: 4px;
}
```

**Color zones:**
- 0-33%: Green (#19c37d) — plenty of space
- 33-66%: Amber (#ffb703) — getting full
- 66-100%: Red (#ff6b6b) — nearly full

### Option B: Circular Gauge

```
    ┌──────────┐
    │          │
    │    ◆ 0%  │  ← Center shows percentage
    │          │  ← Ring fills as occupancy grows
    └──────────┘
```

### Option C: Numeric + Emoji

```
0 / 80 people 🟢  ← Green dot
5 / 80 people 🟡  ← Yellow dot
65 / 80 people 🔴  ← Red dot
```

**Recommendation:** Option A (horizontal bar) — familiar, shows trend, animates well on mobile.

---

## Performance Targets

| Metric | Target | How to Measure |
|--------|--------|---|
| Load time (LCP) | <2s on 3G | DevTools throttle to "Slow 3G" |
| Tap response | <100ms feedback | Visual frame inspector |
| Animation FPS | 60fps (no jank) | Chrome DevTools Performance tab |
| Bundle size (mobile) | <50KB gzip | `npm run build` + inspect dist |

**Optimization checklist:**
- [ ] Lazy-load room images (if added)
- [ ] Debounce scroll events (infinite scroll)
- [ ] Cache room data for 1 min (reduce API calls)
- [ ] Minimize CSS (remove unused grid styles on mobile)

---

## Component Breakdown (Frontend Implementation)

### New Components

#### 1. `RoomCard` (Mobile-Optimized)

```typescript
interface RoomCardProps {
  room: Room & { occupancy: number };
  onBook: (roomId: string) => void;
  expanded?: boolean;
  onExpand?: (roomId: string) => void;
}

// Used in room list (Screen 1)
// Shows: name, location, occupancy, [Book Now] button
// On click: expands to show details (Screen 2)
```

#### 2. `OccupancyIndicator`

```typescript
interface OccupancyIndicatorProps {
  occupancy: number;
  capacity: number;
  trend?: 'up' | 'down' | 'stable';
  animate?: boolean;  // Smooth transition on change
}

// Three variants: bar, gauge, numeric
// Animates when occupancy changes
```

#### 3. `BookingConfirmation`

```typescript
interface BookingConfirmationProps {
  room: Room;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

// Modal overlay (Screen 3)
// Shows room, time, availability
// Prevents accidental booking
```

#### 4. `SuccessState`

```typescript
interface SuccessStateProps {
  room: Room;
  bookingId: string;
  onContinueShopping?: () => void;  // Find another room
  onShare?: () => void;             // Social share
}

// Celebration UI (Screen 4)
// Quick secondary actions
```

---

## Usability Test Plan

**Target:** 5 student participants, 15 min each

**Task 1: Cold Start**
> "You just arrived on campus with 5 minutes before your study group meeting. Find and book a quiet study room as fast as you can."

**Success Criteria:**
- Completes booking in <2 min
- No confusion on "how to book"
- Finds room details without drilling to separate page
- Taps confirm button (not accidental)

**Task 2: Repeat Booking**
> "The first room was perfect. You want to book it again tomorrow at the same time. Go."

**Success Criteria:**
- Takes <1 min (even faster on repeat)
- Remembers room from history (if available)

**Task 3: Occupancy Understanding**
> "Look at this room. Tell me: is it busy right now? Will it get busier later?"

**Success Criteria:**
- Correctly reads occupancy bar
- Understands occupancy trend (sparkline helps)

**Metrics to Collect:**
- Time to complete each task
- System Usability Scale (SUS) score — target >72
- Net Promoter Score (NPS) — target >30
- Errors / backtracking / confusion moments

---

## Success Criteria for Launch

✅ **MVP (Week 2-3):**
- [ ] Single-column room list
- [ ] 48px+ tap targets
- [ ] 1-tap "Book Now" flow
- [ ] Confirmation modal
- [ ] <2s load on 3G
- [ ] Usability test SUS >72

✅ **Nice-to-Haves (Post-Launch):**
- [ ] Occupancy sparkline/trend chart
- [ ] Room review stars
- [ ] Distance/walk time
- [ ] "Add to Calendar" export
- [ ] Share booking with friends

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| "Book Now" too prominent → accidental bookings | Confirmation modal (small friction OK) |
| Mobile performance slow | Lazy-load images, cache data, profile bundle size |
| Users don't understand occupancy bar | Add tooltip: "This room is X% full; usually quieter after 3pm" |
| Confirmation modal feels like extra click | Show it only once; remember preference for repeat users |

