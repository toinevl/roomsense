# Design Spec: Strategy 3 — AI Recommendations & Gamification

**Priority:** 🟡 YELLOW (data timing — MVP rule-based, ML upgrade week 5+)  
**Target Users:** Indecisive students (takes >20sec to pick a room); power users (repeat bookers)  
**Success Metric:** Time-to-decision -50%, DAU +30%, booking frequency +25%, recommendation CTR >35%

---

## Problem Statement

**Current:** User faces 30+ rooms; spends 20+ seconds deciding (often abandons)
- No personalization → feels random
- No guidance → analysis paralysis
- No retention incentive → one-time booker

**Target:** "You always book Quiet Pod 3 on Tuesdays. It's free now." → Book in <10sec

---

## MVP Strategy: Rule-Based (Week 1, 1 dev-day)

Start with rules (not ML). Upgrade to ML predictions in week 5 when data is ready.

```
Recommendation Algorithm (Rule-Based):
┌─────────────────────────────────────────┐
│ 1. Has this user booked before?         │
│    YES → Show their 3 most-booked rooms │
│    NO → Go to Step 2                    │
│                                         │
│ 2. What time is it?                     │
│    → Show rooms popular at this hour    │
│       (e.g., "Study pods busy now")     │
│                                         │
│ 3. No history, first-time user?         │
│    → Default to: Most Popular +         │
│       Closest + Cheapest                │
│                                         │
│ 4. Score & rank:                        │
│    repeat_room_score * 50% +            │
│    time_popularity * 30% +              │
│    distance * 20%                       │
│                                         │
│ → Show top recommendation as HERO card  │
│ → Show 2 alternatives below              │
└─────────────────────────────────────────┘
```

**Implementation:** SQL query + simple scoring in backend (2-4 hours)

---

## Design: Recommendation UI

### Hero Recommendation Card (Top of List)

Always show the #1 match prominently:

```
┌─────────────────────────────────┐
│ 🎯 Best Match For You           │ ← Label
│                                 │
│ ◆ Senaatzaal (PhD hall)        │ ← Room name
│ Atlas / Floor 0                 │
│                                 │
│ ⭐ Why recommended:             │
│ "You book this every Tuesday    │ ← Personalization (why)
│  at this time. Available        │
│  now until 5:30 PM."            │
│                                 │
│ ◆◆◆◆◆ ░░░░░░░░░ 0/80 (0%)     │ ← Occupancy bar
│                                 │
│ ┌─────────────────────────────┐ │
│ │ [🚀 Book Now - 1 Tap]       │ │ ← Primary CTA
│ └─────────────────────────────┘ │
│ [See why] ← tooltip on hover    │
│                                 │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Also Consider:                  │ ← Secondary recs
│                                 │
│ ◆ Quiet Pod 3 (your #2 fave)  │
│   Floor 2 · 3/12 people        │
│                                 │
│ ◆ Boardroom 1 (trending now)   │
│   Floor 1 · 1/8 people         │
│                                 │
│ [See all rooms]                 │
└─────────────────────────────────┘
```

**Why Prominent:**
- Hero card uses 50% screen real estate (forces attention)
- Color: Brand accent (not default gray)
- Copy explains *why* (builds trust)
- 1-tap CTA (no second-guessing)

### Recommendation Reasoning (Hover/Tap)

```
Why is Senaatzaal recommended?

✓ You booked this room 5 times
  (more than any other)
  
✓ You always book it on Tuesdays
  at 2-4pm (today is Tuesday, 2:30pm)
  
✓ It's currently available
  (0/80 people)
  
✓ Not crowded right now
  (usually fills after 3pm)

Based on 12 of your bookings.
[Customize preferences]
```

---

## Occupancy Prediction UI

Add "future state" to help users decide:

```
┌──────────────────────────┐
│ Occupancy Now & Later    │
│                          │
│ Now (2:30pm)    5/80     │ ← Current
│ ◆◆◆◆◆░░░░░░░░░░░ (6%)   │
│                          │
│ In 30 min (3pm) 15/80    │ ← Predicted
│ ◆◆◆◆◆◆◆◆◆░░░░░░░ (19%)  │
│                          │
│ In 1 hour (3:30pm)       │
│ ◆◆◆◆◆◆◆◆◆◆◆◆░░░░░ (30%) │
│                          │
│ 💡 Stays quiet for 1hr,  │
│    fills after 3pm       │
│    (booking now is smart)│
└──────────────────────────┘
```

**How it works:**
- Show 3 time horizons (now, +30min, +1hr)
- Trend line helps user pick timing
- Copy explains pattern ("fills after 3pm")

---

## Streak & Gamification

### Streak Counter (Persistent in Nav)

Always visible, building habit:

```
RoomSense   [Menu]    3-day streak 🔥
```

Or below hero recommendation:

```
┌─────────────────────────────────┐
│ 🔥 3-day booking streak!        │ ← Celebrate
│                                 │
│ ▓▓▓░ Day 4/7 (tomorrow's goal)  │ ← Progress bar
│                                 │
│ "Come back tomorrow to reach    │
│  your personal record (7 days)" │ ← Positive framing
│                                 │
└─────────────────────────────────┘
```

**Key Details:**
- ✅ Celebrate existing streaks ("3-day!")
- ✅ Positive copy ("come back" not "don't lose")
- ✅ Personal, not competitive (no leaderboard)
- ✅ Survive one missed day gracefully:
  - Day 1, 2, 3: Booked every day ✓
  - Day 4: Missed (travel) — show "3-day streak (paused)"
  - Day 5: Book again → Resume streak

---

## Feature Unlock System

Unlock power features through engagement (not hollow points):

### Unlock UI

```
┌─────────────────────────────────┐
│ ✨ You Unlocked a New Feature!  │
│                                 │
│ 📅 Advanced Scheduling          │
│ You can now book up to 2 weeks  │
│ in advance.                     │
│                                 │
│ ✓ You've completed 5 bookings   │
│   (trigger for unlock)          │
│                                 │
│ [Try It Now] [Remind Me Later]  │
│                                 │
└─────────────────────────────────┘
```

### Feature Unlock Progression

| Booking # | Feature Unlocked | Value |
|-----------|---|---|
| 5 | Advanced Scheduling (+2 weeks ahead) | Convenience |
| 10 | Room Comparison (side-by-side trends) | Analytics |
| 15 | Priority Notification (+1 min notice) | Scarcity |
| 20 | Bulk Booking (repeat slots) | Efficiency |
| 3 reviews | Verified Reviewer badge | Status |
| 7-day streak | Streak Saver (pause without losing) | Retention |

**Why this works:**
- Each unlock is *actually useful* (not decoration)
- Progression is visible ("unlock at 5 bookings")
- Motivation is earning features, not chasing points

---

## Personalization Tiers

### Tier 1: Cold-Start (New User)

No booking history? Show defaults:

```
🎯 Best Match For You

Most Popular Room Today:
  Study Pod 7 (40 bookings this week)
  
Closest to You:
  Quiet Pod 3 (8 min walk)
  
Most Affordable:
  Flex Room 2 ($0, first booking free)

[See all rooms]
```

**Copy:** "We're learning your preferences..."

### Tier 2: Personalized (3-7 Bookings)

User has some history:

```
🎯 Best Match For You

Your Favorite Rooms:
  1. Senaatzaal (5 bookings)
  2. Quiet Pod 3 (3 bookings)
  3. Study Nook B (2 bookings)

This Hour's Popular:
  Boardroom 1 (trending now)

Distance from You:
  Quiet Pod 3 (8 min walk)
```

**Copy:** "Your personalized recommendations are ready!"

### Tier 3: Expert Mode (10+ Bookings)

Power users with rich history:

```
🎯 Best Match For You

Based on 23 bookings, you prefer:
  • Quiet spaces (92%)
  • Near outlets (85%)
  • Small groups (<10 capacity) (78%)
  
Senaatzaal matches 3/3 preferences.
Currently 0/80. Typically fills after 3pm.
```

**ML Integration:** Replace rule-based scoring with collaborative filtering (week 5)

---

## ML Upgrade Path (Week 5+)

### When Data is Ready (8+ weeks)

```
Recommendation Score v2.0 (ML):

Input: User's 25+ bookings + room attributes
Model: Collaborative filtering (user-user similarity)
Output: Predicted rating (1-5) for each room
Rank: Sort by predicted rating
Show: Top 1 as hero, 2-3 as alternatives

Improvements:
• Learns room preference (quiet vs. social)
• Accounts for time-of-week patterns
• Discovers new rooms (not just repeats)
• Handles cold-start with fallback rules
```

### Occupancy Prediction v2.0 (ML)

```
Instead of: "Room fills after 3pm (average)"
Show: "This room fills after 3pm on Tuesdays,
       but not on Thursdays. Today (Tuesday)
       expect peak at 4:15pm."

Accuracy target: 75%+ on holdout test set
```

---

## Component Breakdown (Frontend + Backend)

### Backend Changes

#### New Endpoints

```
GET /api/recommendations?userId={id}&now={timestamp}
  → {
      hero: {
        roomId, name, why: string, score: float
      },
      alternatives: [{roomId, name, why, score}]
    }

GET /api/occupancy/prediction?roomId={id}&roomId={timestamp}
  → {
      now: {occupancy, capacity},
      +30min: {predicted_occupancy, confidence},
      +60min: {predicted_occupancy, confidence}
    }

GET /api/users/{id}/streak
  → {
      current: 3,
      record: 7,
      isBroken: false,
      message: string
    }

POST /api/users/{id}/booking
  → Creates booking + increments streak

GET /api/users/{id}/unlocks
  → [{feature, unlocked_at, level}]
```

### Frontend Components

#### 1. `RecommendationCard`

```typescript
interface RecommendationCardProps {
  recommendation: {
    roomId: string;
    name: string;
    why: string;  // "You always book this..."
    score: number;  // 0-100
  };
  occupancy: OccupancyData;
  onBook: (roomId) => void;
}
```

#### 2. `OccupancyPrediction`

```typescript
interface OccupancyPredictionProps {
  roomId: string;
  now: {occupancy: number; capacity: number};
  predictions: Array<{
    timeAhead: number;  // minutes
    predicted: number;
    confidence: number;  // 0-100
  }>;
  trend: string;  // "fills after 3pm"
}
```

#### 3. `StreakCounter`

```typescript
interface StreakCounterProps {
  current: number;
  record: number;
  isBroken: boolean;
  nextMilestone: number;
  onClaim?: () => void;  // If unlockable today
}
```

#### 4. `FeatureUnlock`

```typescript
interface FeatureUnlockProps {
  feature: string;
  description: string;
  trigger: string;  // "5 bookings"
  onTry: () => void;
  onDismiss: () => void;
}
```

#### 5. `Personalization` (Pages/Logic)

```typescript
// In roomFinder.ts, on component render:
const recommendedRoomId = getUserRecommendation(userId);
const alternatives = getAlternativeRecs(userId, 2);
const streakData = getUserStreak(userId);
const unlockedFeatures = getFeatureUnlocks(userId);

// Render hero card + streak + notifications
```

---

## Usability Test Plan

**Target:** 5 think-aloud tests (15 min each)

**Task 1: Cold Start**
> "You're new to the app. Book a room based on the recommendation. Why did you trust it?"

**Success:** 
- Uses hero recommendation (not browsing all 30 rooms)
- Understands "why recommended"
- Books in <30 sec

**Task 2: Occupancy Prediction**
> "You see two rooms recommended. One fills at 3pm, one at 5pm. Which do you pick and why?"

**Success:**
- Correctly interprets prediction chart
- Mentions time strategy ("I'll be done by 3pm")

**Task 3: Streak**
> "You have a 3-day streak. How does this feel? Would you come back tomorrow?"

**Success:**
- Positive emotion (not guilt)
- >70% say "yes, motivated to continue"

**Task 4: Feature Unlock**
> "You just unlocked Advanced Scheduling. What would you do with it?"

**Success:**
- Understands the feature value
- Doesn't feel "pointless reward"

**Metrics:**
- CTR on hero recommendation (target 40%+)
- Time-to-decision (target <15 sec vs 25 sec baseline)
- Streak engagement (target >60% return rate)
- Feature unlock adoption (target >70% try it)
- Repeat booking rate (target +25%)

---

## Launch Roadmap

| Week | What | Effort |
|------|------|--------|
| 1 | Rule-based recommendations (hero card) | 1-2 days |
| 2 | Streak counter + feature unlocks | 2-3 days |
| 3 | Occupancy prediction (rule-based) | 1 day |
| 4 | A/B test: recs on vs. off | (no code) |
| 5 | Train ML models (data ready now) | 3-5 days |
| 6 | Deploy ML recommendations | 1-2 days |
| 7-8 | Measure improvement + iterate | (analysis) |

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Recommendations wrong (new user) | Fallback to popular/closest; rules > ML |
| Streaks create guilt/shame | Always frame positive ("come back"); allow pause |
| Unlocks feel hollow | Only unlock *useful* features; avoid cosmetic rewards |
| Prediction inaccurate (<70%) | Show confidence level; explain uncertainty ("based on past 2 weeks") |
| ML model overfits to seed data | 20% holdout test set; retrain weekly on new data |
| Cold-start problem persists | Rules-based recommendation for <5 bookings; acceptable |

---

## Success Criteria for Launch

✅ **MVP Rule-Based (Week 1-3):**
- [ ] Hero recommendation card (top of room list)
- [ ] Streak counter (persistent in nav)
- [ ] Feature unlock system (3 unlocks available)
- [ ] Rule-based occupancy prediction
- [ ] Usability test SUS >72

✅ **A/B Test (Week 4-5):**
- [ ] 30% of users get recommendations; 70% control
- [ ] Measure: CTR 40%+, time-to-decision -50%, DAU +30%
- [ ] Statistical significance p<0.05

✅ **ML Upgrade (Week 5-6):**
- [ ] 8+ weeks data available & clean
- [ ] ML model trained; 75%+ accuracy on test set
- [ ] Deploy ML recommendations
- [ ] Remeasure improvements

---

## Long-Term (Q3+)

- Real-time collaborative filtering (personalize for 1000+ users)
- Room attribute learning ("users like me prefer quiet pods")
- Social recommendations ("Jane booked this room, might you like it?")
- Smart batch booking ("Book Tue-Thu study pods, auto-cancel Thu if not needed")

