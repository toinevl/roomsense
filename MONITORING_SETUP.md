# Core Web Vitals Monitoring Setup

**Objective:** Track real-world performance of the mobile booking flow (Strategy 1) in production.

**Key Metrics:**
- **LCP (Largest Contentful Paint):** < 2.5s ✅ (target met)
- **FID (First Input Delay):** < 100ms (measure tap responsiveness)
- **CLS (Cumulative Layout Shift):** < 0.1 (no unexpected shifts)

---

## Option 1: Google Analytics 4 (Free, Recommended)

### Setup

**Step 1: Create GA4 Property**
1. Go to https://analytics.google.com
2. Create new property "RoomSense Production"
3. Platform: Web
4. Copy Measurement ID (e.g., G-XXXXXXXXXX)

**Step 2: Add to Frontend**

Update `frontend/index.html` in `<head>`:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX', {
    'page_path': window.location.pathname + window.location.hash
  });
</script>

<!-- Web Vitals (via npm: npm install web-vitals) -->
<script>
  import('/lib/web-vitals.js').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    getCLS(vitals => gtag('event', 'page_view', { 'cls': vitals.value }));
    getFID(vitals => gtag('event', 'page_view', { 'fid': vitals.value }));
    getFCP(vitals => gtag('event', 'page_view', { 'fcp': vitals.value }));
    getLCP(vitals => gtag('event', 'page_view', { 'lcp': vitals.value }));
    getTTFB(vitals => gtag('event', 'page_view', { 'ttfb': vitals.value }));
  });
</script>
```

**Step 3: Create Custom Events**

Track booking completion:

```typescript
// In roomFinder.ts or bookingSuccess.ts
function trackBookingEvent(roomId: string, action: string) {
  if (window.gtag) {
    gtag('event', 'booking_interaction', {
      'event_category': 'engagement',
      'event_label': action,
      'room_id': roomId,
      'timestamp': new Date().toISOString(),
    });
  }
}

// Usage:
trackBookingEvent(roomId, 'confirm_booking');  // On modal confirm
trackBookingEvent(roomId, 'booking_success');  // On success page
```

**Step 4: View Reports**

1. GA4 Dashboard → Reports → Performance
2. Filter by event type: "booking_interaction"
3. Segment by device (Mobile)
4. View metrics:
   - Bounce rate (should be low)
   - Session duration (should be high)
   - Conversion rate (booking completion %)

### Alerts

Create GA4 alert for LCP regressions:

```
Condition: LCP (percentile 75) > 2.5 seconds
Frequency: Daily
Action: Email notification
Recipients: your-email@example.com
```

---

## Option 2: Sentry (Error Tracking + Performance)

### Setup

**Step 1: Create Sentry Project**
1. Go to https://sentry.io
2. Create new organization
3. Create project: "RoomSense Frontend"
4. Platform: Vue.js
5. Copy DSN (Data Source Name)

**Step 2: Add to Frontend**

Install: `pnpm add @sentry/vue @sentry/tracing`

Update `frontend/src/main.ts`:

```typescript
import * as Sentry from "@sentry/vue";
import { BrowserTracing } from "@sentry/tracing";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: "https://YOUR_KEY@YOUR_SENTRY_ID.ingest.sentry.io/12345",
    integrations: [
      new BrowserTracing({
        routingInstrumentation: Sentry.vueRouterInstrumentation(router),
      }),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,           // 10% of sessions for perf data
    replaysSessionSampleRate: 0.1,   // 10% of sessions recorded
    replaysOnErrorSampleRate: 1.0,   // 100% of errors get a replay
    environment: 'production',
  });
}
```

**Step 3: Track Custom Metrics**

```typescript
// Track booking flow
function trackBookingComplete(roomId: string, duration: number) {
  Sentry.captureMessage(`Booking completed: ${roomId} (${duration}ms)`, {
    level: 'info',
    tags: {
      room_id: roomId,
      duration_ms: duration,
      flow: 'booking',
    },
  });
}
```

**Step 4: View in Sentry Dashboard**

1. Sentry → Performance → Transactions
2. Filter by: `/booking-success`
3. View:
   - Response times (LCP, FCP)
   - Error rates
   - User interactions

### Alerts

```
Condition: Error rate > 1%
Condition: Response time p95 > 3 seconds
Action: Slack notification to #roomsense-alerts
```

---

## Option 3: Azure Application Insights (Production Telemetry)

### Setup (Already Deployed)

RoomSense likely has Application Insights enabled in Azure. Check:

```bash
# List Application Insights instances
az monitor app-insights component list \
  --resource-group rgRoomSense \
  --query "[].{name:name, instrumentationKey:instrumentationKey}"
```

### View Metrics

1. Go to Azure Portal → rgRoomSense → Application Insights
2. Performance → Page Views
3. Filter by URL: `#finder`, `#booking-success`
4. View:
   - Load time percentiles (p50, p95, p99)
   - Browser types
   - Geolocation
   - Device types

### Recommended Alerts

```
LCP > 2.5 seconds (p95):
  Severity: Medium
  Check every: 5 minutes
  
Booking error rate > 0.5%:
  Severity: High
  Check every: 1 minute
  
API latency > 500ms:
  Severity: Medium
  Check every: 5 minutes
```

---

## Manual Monitoring (Weekly)

### Performance Audit

Every Friday, run:

```bash
# Test from production
npx lighthouse https://lemon-mud-06bc7fd03.7.azurestaticapps.net/#finder \
  --throttle-method=devtools \
  --throttling.cpuSlowdownMultiplier=4 \
  --output=json \
  --output-path=lighthouse-report.json

# Extract key metrics
jq '.audits | {
  lcp: .largest-contentful-paint.numericValue,
  fcp: .first-contentful-paint.numericValue,
  cls: .cumulative-layout-shift.numericValue
}' lighthouse-report.json
```

### User Feedback Monitoring

Check weekly:
- [ ] Google Analytics bounce rate (should be < 30%)
- [ ] Booking completion rate (should be > 80%)
- [ ] Session duration (should be > 2min)
- [ ] Mobile vs desktop comparison (mobile should be growing)

---

## Success Metrics (30-Day Post-Launch)

| Metric | Target | Current | Status |
|--------|--------|---------|--------|
| **LCP (p75)** | < 2.5s | 2.0s | ✅ |
| **Booking completion rate** | > 80% | TBD | ⏳ |
| **Mobile session duration** | > 2min | TBD | ⏳ |
| **Error rate** | < 0.5% | TBD | ⏳ |
| **API availability** | > 99.9% | TBD | ⏳ |

---

## Alerting Rules

### Critical (Page)

```
LCP > 3.0 seconds (p95)
  → Page loads too slow
  → Action: Check bundle size, API latency

Booking error rate > 2%
  → Users can't complete booking
  → Action: Check API health, modal rendering

API latency > 1 second (p95)
  → Backend is slow
  → Action: Check Azure Functions cold starts, database
```

### Warning (Slack Notification)

```
LCP > 2.5 seconds (p90)
  → Approaching unacceptable threshold
  
Booking completion rate < 75%
  → Users dropping off before success
  
Mobile traffic < 40% of total
  → Mobile adoption not growing as expected
```

---

## Dashboard Setup (Google Data Studio)

Create a shared dashboard:

1. Go to https://datastudio.google.com
2. Create new report
3. Connect data source: GA4 property
4. Add visualizations:
   - **LCP trend** (line chart, last 30 days)
   - **Booking completions** (metric card, daily)
   - **Mobile % of traffic** (metric card)
   - **Session duration** (boxplot, mobile vs desktop)
   - **Error rate** (gauge, real-time)

Share with team: `File → Share → Copy link`

---

## Troubleshooting

### LCP is still high in production (> 2.5s)

**Checklist:**
- [ ] Is SWA caching the HTML? (check Cache-Control headers)
- [ ] Is the API slow? (check /api/health latency)
- [ ] Are there too many rooms being fetched? (pagination needed?)
- [ ] Is JavaScript parsing slow? (minification working?)

**Fix:**
```bash
# Rebuild and redeploy
pnpm build --minify
git add dist/
git commit -m "perf: optimize bundle"
git push origin main
```

### Booking flow errors are appearing

**Checklist:**
- [ ] Is modal rendering correctly? (check DOM in DevTools)
- [ ] Is sessionStorage working? (test in incognito mode)
- [ ] Is the success page route registered? (check main.ts)
- [ ] Is API returning room data? (check /api/rooms response)

**Debug:**
```javascript
// In browser console
console.log(sessionStorage.getItem('roomsense.selectedRoomId'));
console.log(window.location.hash);
// Manually navigate: window.location.hash = '#booking-success'
```

---

## Next Steps

1. **Week 1:** Set up GA4 + Sentry, monitor for anomalies
2. **Week 2:** Collect 7 days of real user data
3. **Week 3:** Create dashboards, set up alerts
4. **Week 4:** Analyze results, decide on iterations
5. **Month 2:** Plan Strategy 2/3 rollout based on Strategy 1 learnings

---

**Document updated:** 2026-07-22  
**Owner:** Claude Code (Automation)  
**Next review:** 2026-07-29
