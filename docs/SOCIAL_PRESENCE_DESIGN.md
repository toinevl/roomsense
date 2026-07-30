# RoomSense Social Presence & Network Effects — UX Design Strategy

**Version:** 1.0  
**Date:** 2026-07-21  
**Status:** Ready for implementation  
**Goal:** Increase session duration +40%, NPS +35, booking frequency +25%, referral rate 15%+

---

## Executive Summary

RoomSense currently shows rooms as isolated data points. This strategy adds **social awareness** — showing who's booking nearby, enabling collaboration discovery, and building campus community — while maintaining strict privacy controls.

**Core insight:** Real-time presence isn't about surveillance; it's about serendipity. When you see a friend is also in the building, you're more likely to book a nearby room to collaborate. The feature succeeds if it feels **social, not creepy**.

**Key constraints:**
- GDPR/FERPA compliant (opt-in)
- Privacy-first: minimal tracking, no permanent identity logs
- Works on existing API surface (Rooms, Occupancy, Reservations)
- Phased rollout: MVP (presence only) → Phase 2 (reviews) → Phase 3 (team awareness)

---

## 1. Presence Indicators UI

**Problem:** A student opens RoomSense on Monday and sees "Atlas 4th Floor available." They don't know if anyone they know is there.

**Solution:** Subtle presence badges showing friend activity, without identifying individuals until they explicitly connect.

### 1.1 Three-Tier Presence Model

```
Tier 1: Anonymous aggregate ("3 others in this building right now")
Tier 2: Friend presence (with opt-in friend list)
Tier 3: Team presence (department/course cohort, if enrolled)
```

### 1.2 Layout Option A: Card Badge (Recommended MVP)

```
┌─────────────────────────────────────────┐
│ Atlas Building, Floor 4                 │
│ Conference Room 4.12                    │
│                                         │
│ Occupancy: 4/12 (33%)                   │
│ ████░░░░░░░░░                           │
│                                         │
│ 🟢 3 friends here    [×××]  ← avatars  │
│ Now booking ↓                          │
│ 09:00-10:30 — Jane (focus pod)         │
│ 10:30-12:00 — You can join             │
│                                         │
│ [View Details] [Book Now]              │
└─────────────────────────────────────────┘
```

**On tap/hover** → expand to see names (if opted in):

```
Friends in this building:
  ✓ Jane Doe (Quiet Pod 3, 09:00-11:00)
  ✓ Tom Chen (Boardroom 2, now)
  ✓ Sarah Williams (Flex seating, now)
```

### 1.3 Layout Option B: "Friends Near Me" Dedicated Tab

```
┌─ RoomSense ────────────┐
│ [Dashboard][Live][Friends][Browse]    │
│                                       │
│ Friends Near Me                       │
│ ═══════════════════════              │
│                                       │
│ 🟢 Jane Doe                          │
│   Atlas 4th Floor                    │
│   Booking: Quiet Pod 3               │
│   Until: 11:00 • 25 min left        │
│   [Join Near Her] [Message]          │
│                                       │
│ 🟢 Tom Chen                          │
│   Flux Building                      │
│   Occupancy: Boardroom 2             │
│   Now • Likely free at 11:30        │
│   [Book Nearby] [Message]            │
│                                       │
│ ⚪ 5 others in Atlas (not friends)   │
│   Could grow your network            │
│                                       │
└───────────────────────────────────────┘
```

### 1.4 Live Activity Feed (Secondary)

```
┌─ Activity ──────────────────────────┐
│ 09:47 — Jane just booked Quiet Pod 3 │
│         (You book nearby?)             │
│ 09:45 — Tom started a session in      │
│         Atlas 4th, Boardroom 2        │
│ 09:40 — Sarah finished her booking    │
│         (Want to collaborate later?)   │
└────────────────────────────────────────┘
```

**Choice for MVP:** Option A (card badge) is lowest friction. Add Option B in Phase 2.

---

## 2. Friend Discovery & Notifications

**Problem:** "How do I add friends?" "How do I let them know I'm here?"

### 2.1 Friend Consent Model (GDPR/FERPA Compliant)

```
┌────────────────────────────────────────┐
│ LOCATION SHARING                       │
│ ════════════════════════════════════   │
│                                        │
│ "Turn on Friend Presence"              │
│                                        │
│ Let friends see:                       │
│  ☐ When you're in a building           │
│  ☐ Which room you're in (if public)    │
│  ☐ Your current booking status         │
│  ☐ How long until you're free          │
│                                        │
│ Who can see:                           │
│  ◉ Friends only                        │
│  ○ Friends + my team                   │
│  ○ Anyone (public campus presence)     │
│                                        │
│ Data is deleted after:                 │
│  ◉ 24 hours                            │
│  ○ End of session only                 │
│                                        │
│ [Enable] [Privacy Policy]              │
└────────────────────────────────────────┘
```

### 2.2 Friend List Widget

```
┌─ Friends ──────────────────────────────┐
│ [+Add Friend]                          │
│                                        │
│ Visibility: Friends Only ▼             │
│                                        │
│ Currently Sharing:                     │
│  ✓ Jane Doe   (Can see your location)  │
│  ✓ Tom Chen   (Can see your location)  │
│  ✓ Sarah W.   (Can see your location)  │
│                                        │
│ Add Friends:                           │
│ [+] Search by name                     │
│ [+] Copy invite link                   │
│ [+] QR code                            │
│                                        │
│ Privacy Timeline:                      │
│ Your location data is deleted after:   │
│ • 24 hours (auto-cleanup, 04:00 UTC)  │
│ • Opt-out anytime (above toggles)      │
└────────────────────────────────────────┘
```

### 2.3 Notification Design

**Real-time vs. batched:** We recommend **batched, non-intrusive** (every 5 min) to avoid notification fatigue.

```
When Jane books a room:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In-app badge (silent, no push):
  🔔 Jane just booked Quiet Pod 3 on Floor 4 (5 min ago)
     [See Room]  [Book Nearby]

Push notification (once per 30 min, user opt-in):
  "Jane is in Atlas 4th Floor. Room nearby?"

Notification center archive (readable, not dismissed):
  🔔 10:45 — Jane booked Quiet Pod 3
  🔔 10:30 — Tom started session in Boardroom 2
  🔔 10:15 — Sarah free from Atlas 2nd
```

**Key decision:** NO real-time push (causes FOMO + notification spam). Instead: in-app badge + once-per-30min push opt-in.

---

## 3. Room Reviews & Ratings

**Problem:** "Is Atlas 4.12 actually quiet? Does it have a working whiteboard? Is the coffee nearby?"

### 3.1 Review Schema

```typescript
// @roomsense/shared/types.ts

export const ReviewSchema = z.object({
  roomId: z.string(),
  authorId: z.string().or(z.literal('anonymous')), // User ID or "anonymous"
  rating: z.number().int().min(1).max(5),           // Star rating
  title: z.string().min(3).max(50),                 // "Quiet & focused"
  body: z.string().min(10).max(500),                // "Great for deep work..."
  tags: z.array(z.enum([
    'quiet', 'noisy', 'fast-wifi', 'slow-wifi',
    'great-whiteboard', 'broken-equipment', 
    'near-bathrooms', 'near-food', 'temperature-cold', 'temperature-hot',
    'good-lighting', 'dim', 'wheelchair-accessible', 'group-friendly'
  ])),
  photoUrl: z.string().url().optional(),            // One photo max
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type Review = z.infer<typeof ReviewSchema>
```

### 3.2 Review UI — Room Detail Page

```
┌─ Atlas 4.12 – Conference Room ──────────────────┐
│ Capacity: 12 | Floor: 4 | Building: Atlas      │
│                                                  │
│ ⭐⭐⭐⭐ 4.2 / 5 (24 reviews)  [Sort: Recent]     │
│                                                  │
│ Quick tags:                                      │
│  ✓ Quiet (8x) | Fast WiFi (7x) | Whiteboard (6x)│
│  ✗ Can be noisy (3x)                             │
│                                                  │
│ Reviews:                                         │
│ ───────────────────────────────────────────────  │
│ ⭐⭐⭐⭐⭐ 5                  3 days ago          │
│ "Perfect for quiet work!"                        │
│ Tags: #quiet #fast-wifi #good-lighting          │
│ By: Anonymous                                    │
│ [Helpful +5] [Report]                            │
│                                                  │
│ ⭐⭐⭐⭐ 4                   1 week ago           │
│ "Whiteboard pens were dry when I arrived"       │
│ Tags: #whiteboard                                │
│ By: Jane D.                                      │
│ Photo: [📷 whiteboard-dry.jpg]                   │
│ [Helpful +2] [Report]                            │
│                                                  │
│ [Leave a Review] [Write]                        │
└──────────────────────────────────────────────────┘
```

### 3.3 Review Submission Flow

```
┌─ Write a Review ───────────────────────────────┐
│                                                 │
│ Room: Atlas 4.12 (Conference)                  │
│ Your visit: 2026-07-21, 09:00-10:30           │
│                                                 │
│ How was your experience?                        │
│ ☆ ☆ ☆ ☆ ☆  ← click to set (1-5)             │
│                                                 │
│ Title (required):                              │
│ [Great for group work              ]           │
│                                                 │
│ Comment (optional):                            │
│ [Lots of space, natural lighting, though │
│  could use better ventilation - got    │
│  warm at 10:30.                         │
│                                                 │
│ Tags (pick 3-5):                               │
│ ☐ Quiet          ☐ Noisy                       │
│ ☑ Group-friendly ☑ Good lighting              │
│ ☑ Large tables   ☐ Wheelchair access           │
│                                                 │
│ Add a photo (optional):                        │
│ [📷 Add photo]  Max 2MB                        │
│                                                 │
│ Share as:                                      │
│ ◉ Anonymous                                     │
│ ○ Jane Doe (visible to friends only)           │
│                                                 │
│ [Cancel] [Submit Review]                       │
└─────────────────────────────────────────────────┘
```

### 3.4 Moderation & Trust

- **Require booking verification:** User can only review if they booked the room (verified via Reservations table).
- **Anonymous option:** All reviews can be submitted anonymously. Named reviews visible only to friends.
- **Report flow:** Users can report reviews for spam/abuse (flags for admin review).
- **Helpful votes:** Community helps surface credible reviews (no downvotes, only positive signals).

---

## 4. Team Workspace Awareness

**Problem:** "Is my research group in the building today? Can I collaborate with them?"

### 4.1 Team View (Phase 2)

```
┌─ Team Tab ──────────────────────────────────┐
│                                              │
│ Your Team: AI Lab (TU/e)                    │
│ ═════════════════════════════════════       │
│                                              │
│ 🟢 Prof. van der Meer (Advisor)             │
│    Office: Atlas 5th, 503                   │
│    Status: Available (office hours open)    │
│    Last seen: 30 min ago                    │
│    [Start a session together]               │
│                                              │
│ 🟢 Jelle Poos (Lab mate)                    │
│    Current: Quiet Pod 2, Atlas 4th          │
│    Activity: Booking until 10:30            │
│    How to reach: Can you join?              │
│    [Send notification]                      │
│                                              │
│ ⚪ Alex Chen (Team)                         │
│    Last activity: 2 hours ago, Atlas        │
│    Probably: Office or home                 │
│    [Check in later?]                        │
│                                              │
│ Recent team workspace patterns:             │
│ • Mon/Wed/Fri 09:00-11:00: Atlas 4th        │
│ • Tue/Thu 14:00-16:00: Flux 2nd              │
│                                              │
└──────────────────────────────────────────────┘
```

### 4.2 Team Discovery

**Problem:** How does a team initially form?

1. **Automatic (course roster):** If TU/e integrates course rosters, auto-add classmates (with opt-out).
2. **Manual (invite):** User sends invite link; invitee accepts.
3. **Open enrollment:** Join a public team (e.g., "AI Lab Slack", "Design Studio").

### 4.3 Office Hours

```
┌─ Prof. van der Meer ──────────────────────────┐
│ Office Hours                                  │
│ Mon 10:00-12:00 | Wed 14:00-16:00             │
│ Fri 16:00-17:30                               │
│                                               │
│ When office hours start:                      │
│  [Notify me]  [Add to my calendar]            │
│                                               │
│ Your availability:                            │
│  ✓ Can make Mon 10:00-12:00                   │
│  ✗ Can't make Wed 14:00-16:00                 │
│  ✓ Can make Fri 16:00-17:30                   │
│                                               │
│ Reserved desk in: Atlas 5.503 (Office)        │
│ Navigation: [Get directions]                  │
│                                               │
└───────────────────────────────────────────────┘
```

---

## 5. Privacy-First Design

**Principle:** Users always know what data we're tracking and why. Defaults are private; opt-in unlocks social.

### 5.1 Privacy Settings Hierarchy

```
┌─ Privacy Settings ──────────────────────────────┐
│                                                  │
│ Location Sharing (1/3 sections completed)       │
│                                                  │
│ ■■■■■░░░░░░░░░  [Help]                         │
│                                                  │
│ ▸ Location Sharing                              │
│  Your presence data (building + room):          │
│  ☑ Shared with friends                          │
│  ☑ Deleted after 24 hours                       │
│  ☑ Not used for targeting/analytics             │
│  ☑ Can opt out anytime (below)                  │
│                                                  │
│  [⚙ Manage Location Sharing] ▶                  │
│                                                  │
│ ▸ Profile Visibility                            │
│  Your name/photo shown to:                      │
│  ○ Friends only                                 │
│  ○ Campus community (anyone w/ TU/e email)     │
│  ○ Everyone (public)                            │
│                                                  │
│  [⚙ Edit Profile] ▶                             │
│                                                  │
│ ▸ Review Attribution                            │
│  When you write a review:                       │
│  ◉ Post as "Anonymous"                          │
│  ○ Post as "Jane D." (visible to friends)       │
│  ○ Post with photo                              │
│                                                  │
│ Data Retention                                  │
│ ───────────────────────                        │
│ Location data: deleted after 24 hours (auto)   │
│ Reviews: kept indefinitely (you can edit/del)  │
│ Booking history: kept for your records         │
│                                                  │
│ ⚠ We never:                                    │
│ • Track your exact seat location                │
│ • Record arrival/departure timestamps           │
│ • Use location for profiling or targeting       │
│ • Sell location data to 3rd parties             │
│                                                  │
│ [Request my data] [Delete my data] [FAQ]       │
└──────────────────────────────────────────────────┘
```

### 5.2 Trust & Transparency FAQ (Linked from All Social Features)

**Key Q&A already in Trust page (#34); this extends it:**

```
Q: Does RoomSense track my location with GPS?
A: No. We only know which room you booked through the booking system.
   If a room shows "occupied," it's because someone booked it, not because
   we're tracking their movements. Occupancy counts come from Terabee 
   infrared sensors—no cameras, no GPS.

Q: Can my teacher see where I am?
A: No, unless you share your friend list with them. Teachers can see
   aggregated, anonymized room usage (e.g., "50% of this classroom's
   bookings are ghost meetings"), but never individual student presence.

Q: Will this data be sold to advertisers?
A: No. Location data is deleted after 24 hours. Reviews (like "good WiFi")
   help the campus, not advertisers.

Q: Can I turn off presence sharing at any time?
A: Yes. Go to Settings → Privacy → Location Sharing and toggle off.
   Friends will see "Offline" immediately.

Q: What if I don't want to use the social features?
A: You don't have to. All social features are opt-in. The room finder,
   dashboard, and live view work without sharing your location.
```

### 5.3 Consent UI on First Login (Banner)

```
┌──────────────────────────────────────────────────┐
│ 👋 Welcome to RoomSense Social!                  │
│                                                   │
│ See which friends are booking nearby & collaborate│
│                                                   │
│ We respect your privacy:                          │
│ • Friend presence is opt-in                       │
│ • Your location is never tracked with GPS         │
│ • Data is deleted after 24 hours                  │
│ • No data is sold or used for targeting          │
│                                                   │
│ [Enable Social Features] [Learn More] [Skip]     │
└──────────────────────────────────────────────────┘
```

---

## 6. Gamification: Social Proof, Not Leaderboards

**Principle:** Increase engagement through community reinforcement, NOT competition.

### 6.1 Anti-Leaderboard: Social Proof Model

```
❌ DON'T do this (shame-inducing):
┌─ Top Bookers This Month ───────┐
│ 1. Jane — 47 bookings           │
│ 2. Tom — 43 bookings            │
│ 3. Sarah — 38 bookings          │
│ ...                              │
│ 🔴 You: 12 bookings (🔻low)    │
└─────────────────────────────────┘

✅ DO this (social proof, inclusive):
┌─ Your Campus This Week ──────────┐
│ 🎉 2,347 classmates booked rooms!│
│ 📈 That's 23% more than last week│
│                                   │
│ 🟢 You've kept a 3-day streak!   │
│   Come back tomorrow to reach 4  │
│   (Top streak: 12 days!)          │
│                                   │
│ 💪 5 of your friends also came   │
│   You're building community      │
│                                   │
│ [Continue the streak] [Invite]   │
└───────────────────────────────────┘
```

### 6.2 Streak Mechanic

**What triggers a streak?**
- Booking a room on a new day (doesn't have to be consecutive; weekly streak is fine).
- Visual: badge appears in profile when active.

```
Your Streak: 🔥 5 days
└─ Sat: Booked ✓
   Sun: (skip ok)
   Mon: Booked ✓
   Tue: (skip ok)
   Wed: Booked ✓
   Thu: Booked ✓
   Fri: Booked ✓  ← current

Longest streak: 🏆 12 days (spring semester)
```

### 6.3 Community Milestones (No Ranking)

```
┌─ Campus Milestones ─────────────────────┐
│                                          │
│ 🏫 Atlas Building                        │
│   500 bookings this month! 🎉           │
│   (Up from 420 last month)               │
│                                          │
│ 🎯 "Quiet Pod Day"                       │
│   100 people are booking Quiet Pods     │
│   today. Maybe you'll find a study    │
│   buddy? Join in!                       │
│                                          │
│ 👥 "Team AI Lab grew to 15 people!"    │
│    Nice growth. Recommend to colleagues?│
│                                          │
│ 💚 "Your team had 3 book-together       │
│    sessions this week! Collaboration    │
│    is working."                         │
│                                          │
└──────────────────────────────────────────┘
```

---

## 7. Component Breakdown

Implementation roadmap for Phase 2 (Social features). Phase 1 is current flagship (finder/report/wrapped/trust).

### 7.1 Frontend Components (TypeScript, no framework)

```
PresenceIndicator
├─ Props: 
│  ├─ roomId: string
│  ├─ friendCount: number (cached, not real-time)
│  ├─ onViewFriends: () => void
│  └─ onBookNearby: (friendId: string) => void
├─ State: expanded (show friend names?)
└─ Behavior: Click badge → expand; tap friend → zoom to their room

AvatarStack
├─ Props:
│  ├─ friends: Friend[]
│  ├─ maxVisible: number (default 3)
│  └─ size: 'small' | 'medium' | 'large'
├─ Render: Overlapping circles; +N more if overflow
└─ Behavior: Hover → tooltip with names

FriendsNearMeTab
├─ Props:
│  ├─ friends: Friend[]
│  ├─ proximity: 'same-building' | 'same-floor'
│  └─ onNavigateTo: (roomId) => void
├─ Sections:
│  ├─ Active (booking now)
│  ├─ Soon (bookings < 30 min away)
│  └─ Later (bookings > 30 min away)
└─ Updates: 5-min polling

ReviewCard
├─ Props:
│  ├─ review: Review
│  ├─ isAuthor: boolean
│  ├─ onEdit: () => void
│  └─ onReport: () => void
├─ Render: Star rating, title, snippet, tags, author (or "anonymous")
└─ Interaction: Tap to expand; helpful vote

ReviewSubmitForm
├─ Props:
│  ├─ roomId: string
│  ├─ bookingId: string (proof of visit)
│  └─ onSubmit: (review: Review) => void
├─ Fields: Rating, title, body, tags, photo, attribution
└─ Validation: zod schema from shared types

ConsentModal
├─ Props:
│  ├─ onEnable: () => void
│  ├─ onSkip: () => void
│  └─ onDetails: () => void
├─ Render: First-login banner
└─ Behavior: Persist choice in localStorage

PrivacySettingsPage
├─ Sections:
│  ├─ Location Sharing toggle + friend visibility
│  ├─ Profile visibility (friends/campus/public)
│  ├─ Review attribution default
│  └─ Data download/delete
└─ Persist: User preference table in backend

TeamAwarenessWidget
├─ Props:
│  ├─ teamId: string
│  ├─ members: TeamMember[]
│  └─ onJoinSession: (memberId) => void
├─ Sections:
│  ├─ Active members (in building now)
│  ├─ Upcoming office hours
│  └─ Team workspace patterns
└─ Updates: 10-min polling

ActivityFeed
├─ Props:
│  ├─ activities: Activity[]
│  ├─ limit: number
│  └─ onNavigateTo: (roomId) => void
├─ Render: Chronological list (newest first)
└─ Behavior: Archive/dismiss, not persistent

FriendListManager
├─ Sections:
│  ├─ Current friends (with visibility toggle per friend)
│  ├─ Pending invites (sent/received)
│  └─ Search/add new
├─ Import options:
│  └─ Invite link, QR code, search by name
└─ Persist: FriendLinks table in backend
```

### 7.2 Backend API Endpoints (New)

```typescript
// Presence (5-min cache)
GET /api/presence/friends
  Query: ?limit=10
  Response: Array<{ friendId, name, roomId, buildingId, bookingUntil, lastUpdate }>

GET /api/presence/team/:teamId
  Response: Array<TeamMember & { present: boolean, lastSeenTs }>

// Reviews
POST /api/reviews
  Body: { roomId, rating, title, body, tags, photoUrl?, authorAnon: boolean }
  Auth: User must have a past booking for this room (verified via Reservations)
  Response: { reviewId, createdAt }

GET /api/rooms/:roomId/reviews
  Query: ?sort=recent|helpful&limit=20
  Response: Array<Review & { helpfulCount, reported: boolean }>

PUT /api/reviews/:reviewId
  Body: Partial<Review> (author only)
  Response: { reviewId, updatedAt }

DELETE /api/reviews/:reviewId
  Auth: Author only
  Response: { deleted: true }

POST /api/reviews/:reviewId/report
  Body: { reason: string }
  Response: { reported: true }

// Friends
POST /api/friends/invite
  Body: { friendEmail }
  Response: { inviteId, inviteUrl }

GET /api/friends/invites
  Response: { sent: Invite[], received: Invite[] }

POST /api/friends/:friendId/accept
  Response: { friendId, connectedAt }

DELETE /api/friends/:friendId
  Response: { deleted: true }

PUT /api/friends/:friendId/visibility
  Body: { canSeeLive: boolean, seeMyTeam: boolean }
  Response: { friendId, visibility }

// Privacy
GET /api/user/privacy
  Response: { locationSharing, profileVisibility, reviewAttribution, dataRetention }

PUT /api/user/privacy
  Body: Partial<PrivacySettings>
  Response: PrivacySettings

POST /api/user/data-export
  Response: { exported: true, downloadUrl }

DELETE /api/user/data
  Auth: User confirmation required (2FA or email link)
  Response: { deleted: true }

// Teams (Phase 2)
POST /api/teams
  Body: { name, description, members: string[] }
  Response: { teamId, createdAt }

GET /api/teams/:teamId
  Response: Team & { members: TeamMember[], presence: Array<{memberId, currentRoom}> }

POST /api/teams/:teamId/members/:memberId
  Body: { role: 'admin'|'member' }
  Response: { memberId, teamId, role }

PUT /api/teams/:teamId/office-hours
  Body: { memberId, times: Array<{day: string, startTime, endTime}> }
  Response: OfficeHours[]
```

### 7.3 Data Model (Azure Tables)

```
Tables to create:

UserPrivacy
├─ PartitionKey: userId
├─ RowKey: 'settings'
└─ Fields:
   ├─ locationSharingEnabled: boolean
   ├─ friendVisibility: 'friends-only'|'campus'|'public'
   ├─ reviewAttributionDefault: 'anonymous'|'named'
   ├─ dataRetentionDays: number
   └─ lastUpdated: datetime

FriendLinks
├─ PartitionKey: userId
├─ RowKey: friendId
└─ Fields:
   ├─ connectedAt: datetime
   ├─ invitedBy: userId
   ├─ canSeeLive: boolean
   ├─ lastInteraction: datetime
   └─ relationship: 'active'|'pending'

Reviews
├─ PartitionKey: roomId
├─ RowKey: `${createdAtTs}_${authorId}`
└─ Fields:
   ├─ authorId: string (nullable → 'anonymous')
   ├─ rating: 1-5
   ├─ title: string
   ├─ body: string
   ├─ tags: Array<string>
   ├─ photoUrl: string (optional)
   ├─ helpfulCount: number
   ├─ flagCount: number
   ├─ status: 'active'|'flagged'|'deleted'
   └─ updatedAt: datetime

Teams
├─ PartitionKey: teamId
├─ RowKey: 'meta'
└─ Fields:
   ├─ name: string
   ├─ description: string
   ├─ createdAt: datetime
   ├─ createdBy: userId
   └─ memberCount: number

TeamMembers
├─ PartitionKey: teamId
├─ RowKey: memberId
└─ Fields:
   ├─ email: string
   ├─ joinedAt: datetime
   ├─ role: 'admin'|'member'
   ├─ officeHoursJson: string (serialized)
   └─ lastSeen: datetime

Notifications
├─ PartitionKey: userId
├─ RowKey: `${createdAtTs}_${sourceId}`
└─ Fields:
   ├─ type: 'friend-joined'|'friend-booking'|'team-office-hours'
   ├─ sourceId: string (friendId/teamId)
   ├─ data: JSON
   ├─ read: boolean
   ├─ createdAt: datetime
   └─ expiresAt: datetime (30 days auto-delete)
```

---

## 8. Usability Test Plan

### 8.1 Research Goals

1. **Adoption:** Would students/staff opt in? Why/why not?
2. **Friction:** Is the consent flow too complex?
3. **Value:** Does presence info actually change booking behavior?
4. **Creepiness threshold:** When does social feel intrusive?
5. **Reviews:** Would users contribute? Would they trust reviews?

### 8.2 Participant Profile

- **5 participants** (mix of TU/e students + staff)
  - 2 frequent room bookers (3+ per week)
  - 2 occasional bookers (1 per week)
  - 1 staff member (office holder)

### 8.3 Test Tasks & Observations

#### Session 1: Consent & Discovery (15 min)

**Task:** "You're opening RoomSense for the first time. Walk me through turning on friend presence."

**Observe:**
- Do they read the consent text or skip it?
- What privacy concern (if any) makes them hesitate?
- How many clicks to enable?
- Do they understand what data is shared?

**Success criteria:**
- User can enable in < 2 clicks
- User can articulate at least 2 privacy protections
- Tone feels reassuring, not defensive

#### Session 2: Finding Friends (10 min)

**Task:** "Add Jane as a friend. Then find where she is right now."

**Observe:**
- Do they use search, invite link, or QR code?
- How intuitive is "Jane is in Atlas 4th, Quiet Pod 3"?
- Would they actually book nearby?

**Success criteria:**
- Task completes in < 90 seconds
- User says "Yes, I'd book nearby" without prompting
- No confusion about what data is visible

#### Session 3: Room Details & Reviews (15 min)

**Task:** "You just finished a 90-min session in Atlas 4.12. Rate the room and leave a review. What would you mention?"

**Observe:**
- Do they submit anonymous or named?
- What details matter? (WiFi, noise, equipment)
- Would they upload a photo?
- Do they read existing reviews first?

**Success criteria:**
- Review submitted in < 3 min
- User mentions at least 2 practical details
- User trusts 3-4 star reviews as "probably real"

#### Session 4: Team Presence (10 min)

**Task:** "It's Monday 10am. Your research group has office hours with the prof. Show me how you'd join them."

**Observe:**
- Can they find their team?
- Would they book a room nearby vs. office?
- Does knowing the prof's office-hour time influence them?

**Success criteria:**
- User locates team member in < 60 seconds
- User says "Yes, I'd go to the building" or "Yes, I'd book nearby"

#### Session 5: Privacy Reassurance (5 min)

**Debrief questions:**
- "On a scale of 1-10, how comfortable are you with RoomSense knowing which room you booked?"
- "What would make you turn this off?"
- "Would you invite friends to use this?"

### 8.4 Metrics & Rubric

| Goal | Metric | Target | Red Flag |
|------|--------|--------|----------|
| **Adoption** | % who enable on first login | >70% | <50% |
| **Friction** | Median clicks to enable | <2 clicks | >3 clicks |
| **Privacy comfort** | "Would turn off if..." reasons | Security/stalking | Mild discomfort → churn |
| **Value** | "Would book nearby if friend present" | >70% say yes | <50% |
| **Trust in reviews** | "Would trust 4-5 star reviews" | >80% | <60% |
| **Referral intent** | "Would invite friends" | >60% | <40% |

### 8.5 Iteration Triggers

- **If <50% enable:** Redesign consent flow (banner is too scary)
- **If >3 clicks to enable:** Simplify settings nesting
- **If <50% would book nearby:** Presence indicator not compelling; increase avatar visibility
- **If users want anonymity in reviews:** Make default anonymous (currently named)
- **If privacy concerns >> value:** Pivot to team-only MVP (skip campus-wide presence)

---

## 9. Phased Rollout

### Phase 1 (Current): Flagship Features
- ✅ Room finder (students)
- ✅ Semester report (leadership)
- ✅ RoomSense Wrapped (viral)
- ✅ Trust & Transparency (de-risk)

### Phase 2 (Social MVP, 3 weeks)
**Depends on:** Phase 1 feedback + user research (#35 in wishlist)

- Week 1: Backend (APIs, tables, seed data with mock friends/reviews)
- Week 2: Frontend (consent, presence badge, friend list, basic reviews)
- Week 3: Testing, iteration, deploy

**Deliverables:**
- Presence badges on room cards
- Friend list + invite flow
- Review submission & viewing
- Privacy settings page
- Usability testing report + iterate

**Not in Phase 2:**
- Activity feed (Phase 3)
- Team awareness (Phase 3)
- Notifications (Phase 3)

### Phase 3 (Social Growth, 4 weeks)
- Outlook integration → team rosters auto-populated
- Office-hours calendar
- Activity feed + notifications
- Presenter mode for team demos

### Phase 4+ (Future)
- AI recommendations ("Try this room, it matches your preferences")
- Gamification (streaks, milestones)
- Real Microsoft Graph adapter for calendar sync

---

## 10. Research Insights from Discord/Slack/Figma

### What Makes Real-Time Presence Feel Good (Not Creepy)

| Feature | Good | Bad |
|---------|------|-----|
| **When to show presence** | "Jane is online" (fuzzy) | "Jane viewed page X at 14:32" (exact) |
| **Activity granularity** | "In a room" (coarse) | "Typing in room X" (too detailed) |
| **Persistence** | "Deleted after 24h" (automatic) | "Permanent record" (haunting) |
| **Opt-out** | One toggle (easy) | Multi-step process (friction) |
| **Defaults** | Friends only (safe) | Public (scary) |
| **Avatars** | Initials only (lightweight) | Full photos (intimate) |

**Discord does this right:** Presence is "Online/Idle/Do Not Disturb," not "What are you doing right now?" Deleted on logout.

**Slack does this right:** Desktop/mobile/online status is optional; "Currently editing X document" is context-specific, not ambient.

**Figma does this right:** Live cursors show "Jane is here" + color, but no persistent log of Jane's edits. Disappears on disconnect.

**What kills it:** Snapchat-style "last seen" timestamps. People feel watched, not connected.

### Implication for RoomSense

- **Show:** "Jane is in Atlas 4th" (coarse building/floor)
- **Don't show:** Exact entry time, how long she's been there, what she's editing
- **Delete:** All presence data after 24 hours (automatic, in background)
- **Opt-out:** One toggle; instant effect
- **Default:** Friends only, named reviews can be anonymous
- **No leaderboards:** Shows only social proof, not rankings

---

## 11. Success Metrics (KPIs)

Measured at 4 weeks post-launch:

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Session duration** | +40% | Google Analytics avg session time |
| **NPS** | +35 points | In-app survey (0-10 scale) |
| **Booking frequency** | +25% per user | Reservations API count/user |
| **Referral rate** | 15%+ | "Invite a friend" action tracking |
| **Opt-in rate** | >70% | Privacy settings telemetry |
| **Review contribution** | >20% of users | Reviews table row count / users |
| **"Book nearby" CTR** | >15% | Frontend analytics (presence badge → booking) |
| **Privacy concern churn** | <5% | Users who disable after enabling |

---

## 12. Implementation Roadmap

```
Week 1 (API + Data)
├─ Create backend tables (Reviews, FriendLinks, UserPrivacy, Teams)
├─ Implement Review POST/GET/PUT/DELETE endpoints
├─ Implement FriendLinks invite flow
├─ Seed mock friends + reviews into dev environment

Week 2 (Frontend)
├─ ConsentModal on first login
├─ PresenceIndicator badge component
├─ FriendsNearMeTab
├─ ReviewCard + ReviewSubmitForm
├─ PrivacySettingsPage
├─ Wire up API client to all new endpoints

Week 3 (Polish + Testing)
├─ Usability testing (5 participants, Session 1-5)
├─ Iterate based on findings
├─ E2E tests for core flows (add friend, submit review, enable presence)
├─ Accessibility audit (WCAG 2.1 AA)

Week 4 (Deploy + Monitoring)
├─ Deploy to staging (behind feature flag)
├─ Smoke test all new flows
├─ Deploy to production (gradual rollout: 10% → 50% → 100%)
├─ Monitor KPIs, error rates, support tickets
├─ Activate post-launch survey (NPS)
```

---

## 13. Files to Create / Modify

**Backend:**
- `api/src/functions/reviews.ts` — POST/GET/PUT/DELETE reviews
- `api/src/functions/friends.ts` — invite, add, remove friends
- `api/src/functions/presence.ts` — GET friends nearby, team presence
- `api/src/functions/privacy.ts` — GET/PUT user privacy settings
- `api/src/functions/teams.ts` (Phase 3) — team CRUD + office hours
- `api/src/adapters/teamsSync.ts` (Phase 3) — Outlook calendar + roster adapter

**Frontend:**
- `frontend/src/components/PresenceIndicator.ts`
- `frontend/src/components/AvatarStack.ts`
- `frontend/src/components/FriendsNearMeTab.ts`
- `frontend/src/components/ReviewCard.ts`
- `frontend/src/components/ReviewSubmitForm.ts`
- `frontend/src/components/ConsentModal.ts`
- `frontend/src/pages/privacySettings.ts`
- `frontend/src/pages/reviews.ts` (dedicated reviews browse page)
- `frontend/src/pages/friendList.ts`
- `frontend/src/lib/presence.ts` — poll friends, cache
- `frontend/src/lib/reviews.ts` — fetch/submit reviews
- `frontend/src/styles/social.css` — new component styles

**Shared:**
- `packages/shared/src/types.ts` — add Review, Friend, PrivacySettings, Team types
- `packages/shared/src/reviews.schema.ts` — zod validation

**Documentation:**
- `docs/social-presence-design.md` (this file)
- `docs/api-social-endpoints.md` — API reference for new endpoints
- `docs/privacy-model.md` — detailed privacy architecture

---

## Appendix: Wireframe Summary

```
Landing Page (unchanged)
└─ Room Cards
   ├─ [MVP] Presence badge: "3 friends here" with avatars
   ├─ Star rating badge (if reviews exist)
   └─ [Tap] Expands to full details

Room Detail Page (new)
├─ [Current] Occupancy graph + drill-in
├─ [NEW] ⭐ Reviews section
│  ├─ Average rating + count
│  ├─ Tag cloud (quiet, WiFi, etc.)
│  └─ Review list (sortable, anonymity preserved)
└─ [NEW] [Leave a Review] button

Main Nav (new tab)
├─ [Current] Dashboard | Live | Architecture
├─ [NEW] | Friends | Settings
└─ [Phase 3] | Team | Notifications

Privacy Settings (new page)
├─ Location sharing toggle
├─ Friend visibility
├─ Review attribution
├─ Data retention info
└─ Data download/delete

Friend List (new page)
├─ Current friends + add/remove
├─ Invite mechanisms (link, QR, search)
├─ Pending invites
└─ Per-friend visibility controls
```

---

## Final Notes

This design prioritizes **trust over features.** A user who opts in only when they understand the privacy model is worth 10x more than users who don't understand what they're sharing.

**Next step:** User research (#35) to validate these concepts. Don't build the full thing without talking to actual students/staff first.

**Questions to validate:**
1. "Would you share your room booking with friends? Why/why not?"
2. "Would you trust reviews left by classmates?"
3. "How would you want to discover new friends on campus?"
4. "Does RoomSense knowing which room you booked feel invasive?"

---

**Document version:** 1.0  
**Status:** Ready for UX implementation  
**Next phase:** User research interviews (#35)  
**Owner:** Claude (frontend)  
**Reviewers:** Toine (product), Hermes (backend estimation)
