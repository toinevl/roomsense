# Design Spec: Strategy 2 — Social Presence & Network Effects

**Priority:** 🟡 YELLOW (depends on legal GDPR/FERPA review)  
**Target Users:** Students wanting to know where friends are; team leads wanting team awareness  
**Success Metric:** Session duration +40%, NPS +35 points, booking frequency +25%, referral rate 15%+

---

## Problem Statement

**Current:** Rooms are data silos; no context on "who's around"
- Student books a study pod alone (no sense of community)
- Team lead can't see where team is distributed
- No incentive to return (no social pull)

**Target:** Show presence + build network effects = stickiness

---

## Core Principle: Privacy-First Design

**Non-negotiable:**
- ✅ Presence is OPT-IN only (not default)
- ✅ Users control who can see them (friends / team / public)
- ✅ Data retention: 24-hour auto-delete
- ✅ No named tracking visible unless shared explicitly
- ✅ Clear privacy policy link in UI

---

## Design: Presence Indicators

### Option A: Avatar Stack on Room Card (Recommended)

Shows live presence inline on every room card:

```
┌─────────────────────────────────┐
│ ◆ Senaatzaal (PhD hall)         │
│ Atlas / Floor 0                 │
│ 0 / 80 people                   │
│                                 │
│ [👤 👤 👤]  3 friends viewing  │ ← Hover → see names
│ [Book Now]                      │
└─────────────────────────────────┘
```

**Interaction:**
- Hover/tap avatars → reveal names (only if they enabled sharing)
- Tap name → see "Jane is also looking at rooms in Atlas"
- No CTA needed; info is contextual

**Why this works:**
- Social proof on every room ("people like me are here")
- Non-intrusive (avatars small, bottom of card)
- Builds FOMO (✓ positive, drives booking)

---

### Option B: Friends Near Me (Separate Tab)

Standalone view for team awareness:

```
┌─────────────────────────────────┐
│ RoomSense   [Live] [Finder] [Me]│  ← New tab
├─────────────────────────────────┤
│ Friends Near Me                 │
├─────────────────────────────────┤
│                                 │
│ Jane ✓ (Quiet Pod 3, Floor 2)  │ ← Tap to see room
│ Tom ✓ (Boardroom 2, Floor 1)   │
│ Sarah 👤 (Looking at rooms)    │ ← Status: searching
│                                 │
│ Your Building: Atlas            │
│ 5 teammates are here today      │ ← Aggregate stat
│                                 │
│ Suggested collab:               │
│ "Jane + Tom are in adjacent     │
│  rooms. Quiet pods good for    │
│  pair study?"                   │
│                                 │
└─────────────────────────────────┘
```

**Why this works:**
- Dedicated UI for team awareness
- Enables "find a buddy" flow
- Not noisy (separate tab, not on every room)

---

### Recommended Hybrid: Avatar Stack + Friends Tab

**MVP:** Ship avatar stack on cards (week 1)  
**Phase 2:** Add dedicated Friends tab (week 3)

---

## Room Reviews & Ratings

Add user-generated content to reduce friction on "which room is best":

```
┌─────────────────────────────────┐
│ Senaatzaal (PhD hall)           │
│ 4.8★ (23 reviews)               │ ← Star cluster
│ Atlas / Floor 0 / Capacity 80   │
│                                 │
│ Top reviews:                    │
│ 5★ "Quiet, great for focus"    │
│ 5★ "Lots of outlets"           │
│ 4★ "A bit cold in winter"      │
│                                 │
│ [See all 23 reviews]            │ ← Expandable
│                                 │
│ [★★★★☆ Write a review]         │ ← Incentivize
└─────────────────────────────────┘
```

**Rating Schema:**
- Star rating (1-5)
- Optional photo (room amenities)
- Text comment (max 200 chars)
- Tags: #quiet #outlets #whiteboard #cold #wifi

**Why this works:**
- Social proof ("others rate this room 4.8★")
- Attribute-level feedback (helps future users pick for their needs)
- User-generated content builds community

---

## Consent & Opt-In Flow

First-time user sees this after signup/login:

```
┌─────────────────────────────────┐
│ Turn on Friend Presence?         │
├─────────────────────────────────┤
│                                 │
│ See where your friends are      │
│ booking rooms. (Boost your      │
│ study group coordination!)      │
│                                 │
│ Privacy:                        │
│ • Your location shared only     │
│   with friends                  │
│ • Auto-deleted after 24 hours   │
│ • You can turn it off anytime   │
│                                 │
│ [Read Privacy Policy]           │
│                                 │
├─────────────────────────────────┤
│ ┌─────────────────────────────┐ │
│ │ [✓ Turn On]  [Not Now]      │ │
│ └─────────────────────────────┘ │
│                                 │
└─────────────────────────────────┘
```

**Key Copy Details:**
- Benefit first ("See where friends are")
- Privacy second (reassure with specifics)
- Easy opt-out ("turn it off anytime")
- Policy link (trust)

**Settings Page:**

```
Privacy Settings
├─ Friend Presence
│  ☑ Show my location to friends
│  [Friends list: Jane, Tom, Sarah, ...]
│  
├─ Data Retention
│  ⏱ Auto-delete after 24 hours
│
├─ Who Can See Me
│  ○ Friends only (selected)
│  ○ Team members
│  ○ Everyone
│
├─ Notifications
│  ☑ Notify when friends book
│  ☑ Notify when room fills up
│
└─ Data Export / Delete
   [Download my data]
   [Delete all my presence history]
```

---

## Notification Design

**When to notify:**

| Event | Notification | Frequency |
|-------|---|---|
| Friend books a room | "Jane just booked Quiet Pod 3" | Immediate (or digest) |
| Room fills up | "Your favorite room is now 90% full" | Real-time, once per hour |
| Friend is looking | "Sarah is browsing rooms in Atlas" | Optional (can mute) |
| Collab opportunity | "Jane & Tom are near you" | 1x per day (not spammy) |

**Notification Format (In-App Toast):**

```
┌─────────────────────────────────┐
│ 👤 Jane booked Quiet Pod 3      │
│ → Tap to see room               │
│ [✕ Dismiss]                    │
└─────────────────────────────────┘
```

**Not Emails/Push Yet:** MVP is in-app only (avoid notification fatigue)

---

## Component Breakdown (Backend + Frontend)

### Backend Changes

#### New Tables/Models

```sql
-- User presence tracking
UserPresence (
  userId: string (PK)
  lastSeenRoomId: string (FK to Rooms)
  status: 'searching' | 'booked' | 'offline'
  visibleToFriends: boolean
  updatedAt: timestamp
)

-- Friend relationships
Friendships (
  userId: string (PK1)
  friendId: string (PK2)
  status: 'accepted' | 'pending' | 'blocked'
  createdAt: timestamp
)

-- Room reviews
RoomReviews (
  reviewId: string (PK)
  roomId: string (FK)
  userId: string (FK)
  rating: 1-5
  comment: text (max 200 chars)
  tags: string[] (e.g., ['quiet', 'outlets'])
  photoUrl?: string
  createdAt: timestamp
  helpfulCount: int (others found this useful)
)

-- User privacy settings
UserPrivacySettings (
  userId: string (PK)
  presenceEnabled: boolean
  visibleTo: 'friends' | 'team' | 'public'
  notificationsEnabled: boolean
  dataRetentionDays: 1-30 (default 1)
)
```

#### New API Endpoints

```
GET /api/presence?building=atlas
  → [{userId, roomId, status, friendName (if friend)}]
  
GET /api/users/{id}/friends
  → [{friendId, friendName, recentRoom, lastSeen}]
  
POST /api/reviews
  → Create room review
  
GET /api/rooms/{id}/reviews
  → [{rating, comment, tags, authorName, helpfulCount}]

PATCH /api/users/{id}/privacy-settings
  → Update presence, visibility, notifications
```

### Frontend Components

#### 1. `PresenceIndicator`

```typescript
interface PresenceIndicatorProps {
  room: Room;
  onlineUsers?: Array<{
    userId: string;
    friendName?: string;  // Only if friend shared
    status: 'booking' | 'viewing';
  }>;
  currentUserFriendsOnly?: boolean;  // Respect privacy settings
}

// Shows avatar stack on room card
// Hover → reveal names
// Tap name → show user profile / room
```

#### 2. `ConsentModal`

```typescript
interface ConsentModalProps {
  onAccept: () => void;
  onDismiss: () => void;
}

// First-time presence consent flow
// Clear privacy policy link
```

#### 3. `RoomReviews`

```typescript
interface RoomReviewsProps {
  roomId: string;
  reviews: RoomReview[];
  onSubmit: (rating, comment, tags) => void;
  canReview: boolean;  // Has user booked this room?
}

// Expandable reviews section on room detail
// Only verified bookers can rate
```

#### 4. `FriendsNearMe` (Phase 2)

```typescript
interface FriendsNearMeProps {
  currentBuilding?: string;
  friends?: Array<{
    friendId;
    name;
    currentRoom;
    status;
    lastSeen;
  }>;
  onSelectFriend: (friendId) => void;
}

// Separate tab showing friends + locations
```

---

## Usability Test Plan

**Target:** 5 user interviews + 2 weeks data collection

**Interview Script (20 min):**

**Q1:** "Would you be comfortable sharing your location with friends so they know which room you're in?"
- Scale 1-5
- Follow-up: "What would make you uncomfortable?"

**Q2:** "If you saw that your friend Jane just booked a room, would you book nearby to study together?"
- Yes / No / Maybe
- Follow-up: "How often would this be useful?"

**Q3:** "Would you leave a review of a room you just studied in? What would motivate you?"
- Incentives: XP points? Unlock? Raffle? Recognition?

**Task:** "Turn on friend presence. Show me your friends. See where Jane is."
- Success criteria: Completes in <1 min, understands privacy settings

**Metrics:**
- % opt-in to presence (target >60%)
- % who enable notifications (target >40%)
- Reviews per 100 bookings (target >15)
- Friends feature engagement (tap count)

---

## Privacy & Compliance Checklist

Before launch, **must have:**

- [ ] Legal review: GDPR consent + FERPA compliance (student data)
- [ ] Data residency: Where is presence data stored? (EU student data = EU servers)
- [ ] Retention policy: Auto-delete after 24 hours (documented)
- [ ] User rights: Export/delete own data (GDPR requirement)
- [ ] Encryption: Presence in transit (HTTPS) + at rest (consider)
- [ ] Audit logs: Track who accessed presence data (for accountability)
- [ ] Privacy policy updated: Clear language on presence tracking
- [ ] Opt-out path: Easy to disable, no dark patterns

---

## Launch Rollout

**Week 1:** Avatar stack on cards (no backend presence yet — just mock)  
**Week 2:** Legal review; if OK, enable real presence  
**Week 3:** Add Friends tab, notifications, reviews  
**Week 4:** A/B test: presence on vs. off  

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Users feel tracked/creepy | Privacy-first UI; clear "friends only"; easy toggle off |
| Legal blocks named presence | Aggregate counts ("3 people viewing") instead of names |
| Notifications spam users | Batching (digest), per-event muting, frequency caps |
| Reviews become negative rants | Moderation queue; helpful-vote counter; block spam keywords |
| Presence data leaked | Encryption + access logs + 24hr auto-delete + legal holds |

---

## Success Criteria for Launch

✅ **MVP (Week 2-3):**
- [ ] Avatar stack on room cards
- [ ] Consent modal at signup
- [ ] Privacy settings page
- [ ] In-app presence (real data from backend)
- [ ] Usability test SUS >72

✅ **Phase 2 (Week 3-4):**
- [ ] Friends tab
- [ ] In-app notifications
- [ ] Room reviews (basic)
- [ ] A/B test: measure session duration +40% lift

