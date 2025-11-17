# Chatbot Expired Promotions Fix

## Problem Description

The chatbot was returning expired promotions when customers asked about current promotions. For example, when asking "any promotions available right now?", the bot would respond with promotions that ended on October 31st, 2025, even though those promotions had clearly expired.

### Root Cause

The issue was in how the RAG (Retrieval-Augmented Generation) knowledge sync system filtered promotions before adding them to the vector database:

1. **Time-based filtering was correct** - The code checked if `endsAt >= now`, which should exclude expired promotions
2. **BUT the comparison operator was wrong** - Using `>=` meant promotions that ended at exactly this moment were still included
3. **Status field wasn't reliable** - The code relied on the `status` field being `ACTIVE` or `SCHEDULED`, but the database status wasn't always updated immediately when promotions expired
4. **Stale data in knowledge base** - Once expired promotions were synced into the RAG vector database, they remained there until the next sync

## Files Modified

### 1. `be/src/api/services/ragSync.service.js`

**Changed the `loadPromotions` function:**

**Before:**
```javascript
const whereClause = {
    restaurantId: { [Op.in]: restaurantIds },
    status: { [Op.in]: [PROMOTION_STATUS.ACTIVE, PROMOTION_STATUS.SCHEDULED] }
};

const now = new Date();
whereClause[Op.and] = [
    {
        [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }]
    },
    {
        [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gte]: now } }]  // ❌ Wrong!
    }
];
```

**After:**
```javascript
const now = new Date();

// Only load promotions that are currently valid based on dates
// Don't rely on status field alone as it may not be updated yet
const whereClause = {
    restaurantId: { [Op.in]: restaurantIds },
    [Op.and]: [
        // Must have started (or have no start date)
        {
            [Op.or]: [{ startsAt: null }, { startsAt: { [Op.lte]: now } }]
        },
        // Must not have ended yet (or have no end date)
        {
            [Op.or]: [{ endsAt: null }, { endsAt: { [Op.gt]: now } }]  // ✅ Fixed!
        }
    ],
    // Exclude explicitly expired/inactive promotions
    status: { [Op.notIn]: [PROMOTION_STATUS.EXPIRED, PROMOTION_STATUS.INACTIVE] }
};
```

**Key changes:**
- Changed `endsAt: { [Op.gte]: now }` to `endsAt: { [Op.gt]: now }` - Now excludes promotions that have already ended
- Changed status filter from whitelist to blacklist - More resilient to status update delays
- Added comments explaining the logic

### 2. `be/src/api/services/customer.service.js`

**Fixed two locations in the same file:**

1. **`listActivePromotions` function** - Changed `endsAt: { [Op.gte]: referenceDate }` to `endsAt: { [Op.gt]: referenceDate }`
2. **`claimVoucherForCustomer` function** - Changed `endsAt: { [Op.gte]: now }` to `endsAt: { [Op.gt]: now }`

## How the Fix Works

### Date Comparison Logic

**Old logic (`>=`):**
- A promotion ending at `2025-10-31 23:59:59` would still be considered "active" at `2025-10-31 23:59:59`
- This caused expired promotions to appear in results

**New logic (`>`):**
- A promotion ending at `2025-10-31 23:59:59` is only "active" if current time is BEFORE that time
- At exactly `2025-10-31 23:59:59` or any time after, the promotion is excluded

### Status Field Approach

**Old approach:** 
- Only include `ACTIVE` or `SCHEDULED` promotions
- Problem: Status field may not be updated immediately when a promotion expires

**New approach:**
- Exclude `EXPIRED` or `INACTIVE` promotions (blacklist instead of whitelist)
- More lenient if status updates are delayed
- Date-based filtering is the primary filter

## Testing the Fix

### Manual RAG Sync

To update the chatbot's knowledge base with the corrected promotion data:

```bash
# Option 1: Trigger manual sync via API
curl -X POST http://localhost:3001/api/admin/rag/sync \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Option 2: Trigger sync via admin panel
# Navigate to: Admin Panel > System > Knowledge Sync > "Sync Now"
```

### Verify the Fix

1. **Check RAG sync status:**
   ```bash
   curl http://localhost:3001/api/admin/rag/status \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

2. **Create test promotions:**
   - Create a promotion that ended yesterday
   - Create a promotion that ends tomorrow
   - Run RAG sync
   - Query the chatbot: "What promotions are available?"
   - Expected: Only the future promotion should be mentioned

3. **Check database queries:**
   ```sql
   -- See what promotions would be synced
   SELECT id, name, status, starts_at, ends_at
   FROM promotions
   WHERE restaurant_id = 'YOUR_RESTAURANT_ID'
     AND (ends_at IS NULL OR ends_at > NOW())
     AND status NOT IN ('EXPIRED', 'INACTIVE');
   ```

## Deployment Checklist

- [x] Update `ragSync.service.js` with corrected date filtering
- [x] Update `customer.service.js` with corrected date filtering
- [x] Verify no syntax errors
- [ ] Deploy code changes to server
- [ ] Restart backend service
- [ ] Trigger manual RAG sync to refresh knowledge base
- [ ] Test chatbot with expired promotion queries
- [ ] Monitor RAG sync logs for errors

## Related Systems

### Automatic Expiration Service

The project also has an automatic expiration service (`be/src/api/services/expiration.service.js`) that updates promotion statuses. This fix makes the system more resilient even when that service hasn't run yet.

**To enable automatic expiration:**
```env
# .env
EXPIRATION_JOB_ENABLED=true
EXPIRATION_JOB_INTERVAL_MINUTES=60
```

### RAG Auto-Sync

The RAG system can automatically sync knowledge periodically:

```env
# .env
RAG_AUTO_SYNC_ENABLED=true
RAG_AUTO_SYNC_INTERVAL_MINUTES=60
```

**Recommendation:** Set both to run frequently (e.g., every 30-60 minutes) to ensure chatbot knowledge stays current.

## Prevention

To prevent this issue in the future:

1. **Always use `Op.gt` for "ends at" comparisons** - A promotion that has ended should not be "current"
2. **Don't rely solely on status fields** - Date-based filtering should be the primary filter
3. **Run RAG sync frequently** - Ensures chatbot knowledge stays fresh
4. **Run expiration service frequently** - Keeps database status fields accurate
5. **Add integration tests** - Test that expired promotions don't appear in queries

## Additional Notes

- This fix affects both the RAG knowledge sync and the customer-facing API endpoints
- The chatbot will only reflect changes after a RAG sync is performed
- Old conversations may still reference stale data until the vector database is updated
- Consider adding a "last synced" timestamp visible to customers to manage expectations

## Support

If issues persist after applying this fix:

1. Check RAG service logs: `docker logs omnichannel-rag` (or equivalent)
2. Verify RAG service is running: `curl http://localhost:3001/api/admin/rag/status`
3. Check if vector database has the correct data
4. Manually flush RAG cache: `POST /api/admin/rag/cache/flush`
5. Review promotion records in database for correct dates and statuses