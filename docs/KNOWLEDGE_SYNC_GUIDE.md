# Knowledge Sync Guide: MySQL to Vector Database

## Overview

The Omnichannel system uses a **vector database (Qdrant)** to power the AI chatbot. This database needs to be synchronized with your MySQL data whenever you make changes to:

- **Restaurants** (name, address, hours)
- **Menu Items** (items, prices, descriptions)
- **Promotions** (offers, vouchers, schedules)

---

## Three Ways to Sync Data

### 🔵 Option 1: Manual Sync (On-Demand)

**Best for:** Development, testing, one-off changes

#### How to Use:

**Via Admin Panel:**
1. Log into admin panel: `http://localhost:3000/admin`
2. Navigate to **AI Assistant** tab
3. Click **"Run knowledge sync"** button
4. Wait for "Last sync: [timestamp]" confirmation
5. Click **"Clear chat cache"** to remove old cached responses
6. Refresh customer page and test chatbot

**Via API:**
```bash
curl -X POST http://localhost:3301/api/v1/admin/knowledge/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

**When to Use:**
- After adding/editing a promotion manually
- After bulk importing menu items
- When testing chatbot responses
- During development

---

### 🟢 Option 2: Automatic Scheduled Sync (Recommended)

**Best for:** Production, maintaining up-to-date chatbot knowledge

#### Setup:

**1. Configure Environment Variables:**

Edit your `.env` file (or create it):

```env
# Auto-sync RAG knowledge every 30 minutes
RAG_AUTO_SYNC_ENABLED=true
RAG_AUTO_SYNC_INTERVAL_MINUTES=30

# Auto-expire old promotions every 30 minutes
EXPIRATION_JOB_ENABLED=true
EXPIRATION_JOB_INTERVAL_MINUTES=30

# RAG service connection
RAG_BASE_URL=http://localhost:8081/rag
RAG_ADMIN_KEY=your-secret-key
```

**2. Restart Backend:**

```bash
cd E:\Omnichannel\Omnichannel\be
npm restart
```

**3. Verify It's Running:**

Check backend logs for:
```
Scheduled automatic RAG sync { intervalMinutes: 30 }
Scheduled automatic expiration checks { intervalMinutes: 30 }
```

#### How It Works:

```
Every 30 minutes:
  1. Expiration service runs
     └─> Updates expired promotions: ACTIVE → EXPIRED
     
  2. RAG sync runs
     ├─> Loads current restaurants from MySQL
     ├─> Loads active promotions (not expired)
     ├─> Loads available menu items
     ├─> Converts to text documents
     └─> Upserts to Qdrant vector database
     
  3. Cache flush
     └─> Clears old chatbot responses
```

#### Configuration Options:

| Variable | Default | Description |
|----------|---------|-------------|
| `RAG_AUTO_SYNC_ENABLED` | `false` | Enable/disable automatic sync |
| `RAG_AUTO_SYNC_INTERVAL_MINUTES` | `60` | How often to sync (minutes) |
| `EXPIRATION_JOB_ENABLED` | `false` | Enable/disable auto-expiration |
| `EXPIRATION_JOB_INTERVAL_MINUTES` | `60` | How often to check expirations |

**Recommended Settings:**

- **Development:** `30` minutes (faster feedback)
- **Production:** `60` minutes (balanced)
- **High-traffic:** `15` minutes (more current, more load)

---

### 🟡 Option 3: Real-Time Sync via Database Hooks

**Best for:** Instant updates, critical data changes

#### How It Works:

Database hooks automatically trigger sync when:
- ✅ A promotion is created (`afterCreate`)
- ✅ A promotion is updated (`afterUpdate`)
- ✅ A promotion is deleted (`afterDestroy`)

**Implementation:**

The hooks are already added in `be/src/api/models/promotion.model.js`:

```javascript
hooks: {
    afterCreate: async (promotion) => {
        const { syncRagKnowledge } = await import('../services/ragSync.service.js');
        await syncRagKnowledge({ flushCache: true });
    },
    afterUpdate: async (promotion) => {
        const { syncRagKnowledge } = await import('../services/ragSync.service.js');
        await syncRagKnowledge({ flushCache: true });
    },
    afterDestroy: async (promotion) => {
        const { syncRagKnowledge } = await import('../services/ragSync.service.js');
        await syncRagKnowledge({ flushCache: true });
    }
}
```

**Pros:**
- ✅ Instant updates (< 1 second)
- ✅ No delay for customers
- ✅ Perfect for time-sensitive promotions

**Cons:**
- ⚠️ Syncs on every change (more server load)
- ⚠️ Can slow down bulk operations
- ⚠️ May cause sync conflicts during heavy editing

#### Enable/Disable Hooks:

**To disable (for bulk operations):**

```javascript
// Temporarily disable hooks
await Promotion.update(
    { status: 'EXPIRED' },
    { where: { endsAt: { [Op.lt]: new Date() } }, hooks: false }
);

// Then manually sync once after bulk update
await syncRagKnowledge();
```

---

## What Data Gets Synced?

### 1. Restaurant Information

**From MySQL table:** `restaurants`

**Synced fields:**
- Restaurant name
- Status (ACTIVE/INACTIVE)
- Timezone
- Address (formatted as single string)
- Business hours (formatted by day)

**Example document:**
```
Restaurant profile: Bella Vista Restaurant
Status: ACTIVE
Timezone: America/New_York
Address: 123 Main St, New York, NY 10001, USA
Business hours:
  Monday: 11:00–22:00
  Tuesday: 11:00–22:00
  Wednesday: 11:00–22:00
  ...
```

---

### 2. Menu Items

**From MySQL tables:** `menu_categories`, `menu_items`

**Synced fields:**
- Item name
- Restaurant name
- Category name
- Price (converted to USD)
- Description
- SKU
- Prep time (in seconds)

**Filters:**
- ✅ Only `isActive = true` categories
- ✅ Only `isAvailable = true` items

**Example document:**
```
Menu item: Lobster Bisque
Restaurant: Bella Vista Restaurant
Category: Soups & Salads
Price (USD): 12.99
Description: Rich and creamy lobster bisque with cognac and fresh herbs
SKU: SOU001
Prep time: 600 seconds
```

---

### 3. Promotions

**From MySQL table:** `promotions`

**Synced fields:**
- Promotion name
- Restaurant name
- Headline
- Description
- Schedule (start and end dates)
- CTA label and URL (if set)

**Filters:**
- ✅ `startsAt <= now` (already started)
- ✅ `endsAt > now` (not yet ended)
- ✅ `status NOT IN ['EXPIRED', 'INACTIVE']`

**Example document:**
```
Promotion: New voucher for this weekend
Restaurant: Bella Vista Restaurant
Headline: Make your weekend so fantastic
Details: Claim your seat, stack the table, and enjoy bigger discounts the more you dine.
Schedule: 2025-11-12T03:03:00.000Z → 2025-11-20T03:03:00.000Z
```

---

## Troubleshooting

### Issue: Changes Don't Appear in Chatbot

**Checklist:**

1. **Did the sync run successfully?**
   - Check admin panel: "Last sync: [recent time]"
   - Check backend logs for "Knowledge sync completed"

2. **Did you clear the cache?**
   - Old answers are cached for 10 minutes by default
   - Click "Clear chat cache" in admin panel

3. **Are you using a new chat session?**
   - Refresh the customer page completely
   - Don't reuse old chat sessions

4. **Is the data in MySQL correct?**
   ```sql
   SELECT * FROM promotions WHERE status = 'ACTIVE';
   ```

5. **Is the RAG service running?**
   ```bash
   curl http://localhost:8081/rag/
   # Should return: {"message": "RAG service is running."}
   ```

6. **Check backend is running:**
   ```bash
   curl http://localhost:3301/health
   # Should return: {"status": "ok"}
   ```

---

### Issue: Sync Fails with "RAG service URL is not configured"

**Solution:**

Add to `.env`:
```env
RAG_BASE_URL=http://localhost:8081/rag
RAG_ADMIN_KEY=your-secret-key
```

Then restart backend.

---

### Issue: Sync Completes but Document Count Doesn't Increase

**Possible causes:**

1. **Data doesn't meet filter criteria:**
   - Promotions expired (`endsAt < now`)
   - Menu items not available (`isAvailable = false`)
   - Restaurant not active (`status = 'INACTIVE'`)

2. **Documents already exist (upsert):**
   - The sync uses deterministic IDs
   - Existing documents are updated, not duplicated
   - Document count stays same = normal behavior ✅

3. **Run debug script:**
   ```bash
   node src/scripts/debugRagSync.js
   ```

---

### Issue: "Address already in use" Error (RAG Service)

**Cause:** RAG service is already running

**Solution:**

```bash
# Find the process
ps aux | grep "python.*run.py"

# Kill it
kill <PID>

# Or use pkill
pkill -f "python.*run.py"

# Restart
cd chat-infrastructure/rag_service
python3 run.py --reload
```

---

## Advanced: Verifying Vector Database

### Check Qdrant Directly

**Get collection info:**
```bash
curl http://localhost:6333/collections/restaurant-faq
```

**Count documents:**
```bash
curl http://localhost:6333/collections/restaurant-faq | grep points_count
```

**List documents:**
```bash
curl -X POST http://localhost:6333/collections/restaurant-faq/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"limit": 100, "with_payload": true}'
```

**Find promotion documents:**
```bash
curl -X POST http://localhost:6333/collections/restaurant-faq/points/scroll \
  -H 'Content-Type: application/json' \
  -d '{"limit": 100, "with_payload": true}' \
  | grep -o '"source_id":"promotion[^"]*"'
```

---

## Performance Considerations

### Sync Duration

Typical sync times:
- **1 restaurant, 50 items, 2 promotions:** ~2-5 seconds
- **5 restaurants, 200 items, 10 promotions:** ~10-15 seconds
- **10 restaurants, 500 items, 20 promotions:** ~30-45 seconds

### Server Load

- **Manual sync:** Minimal (triggered rarely)
- **Scheduled sync (30 min):** Low (runs 48 times/day)
- **Real-time hooks:** Medium-High (runs on every change)

### Recommendations

**Development:**
- Manual sync OR
- Scheduled every 30 minutes

**Production (low-traffic):**
- Scheduled every 60 minutes

**Production (high-traffic):**
- Scheduled every 30 minutes
- Consider real-time hooks for critical promotions

---

## Testing Your Sync

### Test Script

```bash
cd be
node src/scripts/testSync.js
```

**What it does:**
1. ✅ Loads restaurants from MySQL
2. ✅ Loads active promotions
3. ✅ Builds promotion documents
4. ✅ Sends to RAG service
5. ✅ Verifies in Qdrant
6. ✅ Shows success/failure

### Manual Test Flow

1. **Create a test promotion:**
   - Admin panel → Promotions → Add Promotion
   - Set status: ACTIVE
   - Set dates: Today → 1 week from now

2. **Run sync:**
   - Admin panel → AI Assistant → "Run knowledge sync"
   - Wait for "Last sync: [just now]"

3. **Clear cache:**
   - Click "Clear chat cache"

4. **Test chatbot:**
   - Customer page → Chat
   - Ask: "what promotions are available?"
   - Expected: Should mention your test promotion

5. **Update promotion:**
   - Change headline
   - Run sync again
   - Ask chatbot → Should reflect new headline

6. **Delete promotion:**
   - Delete from admin panel
   - Run sync
   - Ask chatbot → Should no longer appear

---

## Best Practices

### ✅ Do's

- ✅ Use scheduled sync for production (set and forget)
- ✅ Clear cache after sync when testing
- ✅ Monitor sync status in admin panel
- ✅ Keep sync interval balanced (30-60 min)
- ✅ Use manual sync during development
- ✅ Test chatbot in new sessions after sync

### ❌ Don'ts

- ❌ Don't sync too frequently (< 15 minutes)
- ❌ Don't forget to clear cache when testing
- ❌ Don't run manual sync during scheduled sync
- ❌ Don't use real-time hooks for bulk operations
- ❌ Don't test in same chat session after sync

---

## Summary

| Method | When to Use | Delay | Server Load |
|--------|-------------|-------|-------------|
| **Manual** | Development, testing | Instant (you control) | Minimal |
| **Scheduled** | Production (recommended) | Up to X minutes | Low |
| **Real-time** | Critical updates | < 1 second | Medium-High |

**Recommended Setup for Production:**

```env
RAG_AUTO_SYNC_ENABLED=true
RAG_AUTO_SYNC_INTERVAL_MINUTES=30
EXPIRATION_JOB_ENABLED=true
EXPIRATION_JOB_INTERVAL_MINUTES=30
```

This ensures:
- ✅ Chatbot knowledge stays current (max 30-min delay)
- ✅ Expired promotions automatically removed
- ✅ Minimal server load
- ✅ No manual intervention needed

---

## Related Documentation

- `CHATBOT_EXPIRED_PROMOTIONS_FIX.md` - Date filtering fix
- `RAG_UPSERT_FIX.md` - Vector database upsert issue
- `AUTO_EXPIRATION.md` - Automatic expiration service
- `FIX_NOW.md` - Quick troubleshooting guide

---

**Last Updated:** 2025-11-12  
**Status:** ✅ Production Ready