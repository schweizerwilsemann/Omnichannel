# Auto-Expiration Service

## Overview

The auto-expiration service automatically updates the status of promotions and vouchers when they expire or become active based on their scheduled dates.

## Features

### 1. **Automatic Promotion Expiration**
- Promotions with `status: ACTIVE` or `SCHEDULED` are automatically set to `EXPIRED` when `endsAt` date is reached
- Runs continuously in the background

### 2. **Automatic Promotion Activation**
- Promotions with `status: SCHEDULED` are automatically set to `ACTIVE` when `startsAt` date is reached
- Only activates if the promotion hasn't already expired

### 3. **Automatic Voucher Expiration**
- Vouchers with `status: ACTIVE` are automatically set to `INACTIVE` when `validUntil` date is reached
- Prevents customers from claiming expired vouchers

## Configuration

### Environment Variables

Add these to your `.env` file:

```env
# Enable/disable the expiration job (default: true)
EXPIRATION_JOB_ENABLED=true

# How often to run expiration checks in minutes (default: 60)
EXPIRATION_JOB_INTERVAL_MINUTES=60
```

### Default Behavior

- **Enabled by default**: The job runs automatically when the server starts
- **Runs every 60 minutes**: Checks are performed every hour
- **Immediate check on startup**: First check runs immediately when server starts

## How It Works

### Scheduled Execution

The service uses `setInterval` to run checks periodically:

```javascript
// Configured in src/index.js
scheduleExpirationJob(intervalMinutes);
```

### Check Logic

1. **Activate Scheduled Promotions**
   ```sql
   UPDATE promotions
   SET status = 'ACTIVE'
   WHERE status = 'SCHEDULED'
     AND startsAt <= NOW()
     AND (endsAt IS NULL OR endsAt > NOW())
   ```

2. **Expire Promotions**
   ```sql
   UPDATE promotions
   SET status = 'EXPIRED'
   WHERE status IN ('ACTIVE', 'SCHEDULED')
     AND endsAt IS NOT NULL
     AND endsAt < NOW()
   ```

3. **Expire Vouchers**
   ```sql
   UPDATE vouchers
   SET status = 'INACTIVE'
   WHERE status = 'ACTIVE'
     AND validUntil IS NOT NULL
     AND validUntil < NOW()
   ```

## API Endpoints

### Manually Trigger Expiration Check

**Endpoint:** `POST /api/v1/expiration/trigger`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "message": "Expiration checks completed",
  "results": {
    "timestamp": "2025-01-12T10:30:00.000Z",
    "promotionsExpired": 3,
    "promotionsActivated": 2,
    "vouchersExpired": 5
  }
}
```

**Use Cases:**
- Testing the expiration logic
- Running checks immediately after bulk data imports
- Manual intervention when needed

### Get Expiration Job Status

**Endpoint:** `GET /api/v1/expiration/status`

**Authentication:** Required (Admin only)

**Response:**
```json
{
  "isScheduled": true
}
```

## Logging

The service logs all activities for monitoring:

### Debug Logs
```
Running expiration checks
No promotions to expire
No vouchers to expire
```

### Info Logs
```
Expired promotions: count=3, promotionIds=[...]
Activated scheduled promotions: count=2, promotionIds=[...]
Expired vouchers: count=5, voucherIds=[...]
Expiration checks completed: {...}
Scheduled automatic expiration checks: intervalMinutes=60
```

### Error Logs
```
Failed to expire promotions: {...}
Scheduled expiration check failed: {...}
```

## Best Practices

### 1. **Set Appropriate Intervals**
```env
# For high-traffic production (check every 15 minutes)
EXPIRATION_JOB_INTERVAL_MINUTES=15

# For development (check every 5 minutes for faster testing)
EXPIRATION_JOB_INTERVAL_MINUTES=5

# For low-traffic environments (check every hour)
EXPIRATION_JOB_INTERVAL_MINUTES=60
```

### 2. **Monitor Logs**
- Check logs regularly to ensure the job is running
- Look for error patterns
- Monitor the count of expired items

### 3. **Handle Edge Cases**

**Promotions without end dates:**
- Will never auto-expire
- Must be manually set to EXPIRED or ARCHIVED

**Vouchers without validUntil dates:**
- Will never auto-expire
- Must be manually set to INACTIVE

**Timezone considerations:**
- All dates are stored in UTC in the database
- The `endsAt`, `startsAt`, and `validUntil` dates should be in UTC
- The service compares against `new Date()` which is in UTC

### 4. **Testing**

```javascript
// Test manually via API
POST /api/v1/expiration/trigger

// Test via code
import { runExpirationChecks } from './services/expiration.service.js';
await runExpirationChecks();
```

## Disabling the Service

If you need to disable auto-expiration:

```env
EXPIRATION_JOB_ENABLED=false
```

Or programmatically:

```javascript
import { stopExpirationJob } from './services/expiration.service.js';
stopExpirationJob();
```

## Implementation Files

- **Service:** `src/api/services/expiration.service.js`
- **Controller:** `src/api/controllers/expiration.controller.js`
- **Routes:** `src/api/routes/expiration.routes.js`
- **Config:** `src/config/env.js`
- **Startup:** `src/index.js`

## Troubleshooting

### Issue: Promotions/Vouchers Not Expiring

**Check:**
1. Is the job enabled? `EXPIRATION_JOB_ENABLED=true`
2. Check server logs for errors
3. Verify dates are in correct format (ISO 8601)
4. Ensure dates are in UTC
5. Call `GET /api/v1/expiration/status` to verify job is running

### Issue: Job Running Too Frequently/Infrequently

**Solution:**
Adjust `EXPIRATION_JOB_INTERVAL_MINUTES` in your `.env` file

### Issue: Manual Trigger Not Working

**Check:**
1. Authentication token is valid
2. User has admin permissions
3. Check response for error details

## Example Workflow

### Creating a Time-Limited Promotion

```javascript
// Create promotion that starts immediately and ends in 7 days
const promotion = {
  restaurantId: "...",
  name: "Weekend Special",
  status: "ACTIVE",
  startsAt: new Date(),
  endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  vouchers: [...]
};

// The promotion will automatically expire after 7 days
// No manual intervention needed!
```

### Creating a Scheduled Promotion

```javascript
// Create promotion that starts in 2 days and runs for 5 days
const promotion = {
  restaurantId: "...",
  name: "Black Friday Sale",
  status: "SCHEDULED",
  startsAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
  endsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  vouchers: [...]
};

// Will automatically activate in 2 days
// Will automatically expire in 7 days
```

## Performance Considerations

- **Database Load:** Minimal - only updates records that need status changes
- **Memory Usage:** Very low - uses simple setInterval
- **CPU Usage:** Negligible - runs only periodically
- **Network:** No external API calls

## Future Enhancements

Potential improvements for the future:

1. **Email Notifications:** Notify admins when promotions expire
2. **Slack/Discord Integration:** Send alerts to team channels
3. **Analytics:** Track expiration patterns and effectiveness
4. **Auto-Archive:** Automatically archive expired promotions after X days
5. **Grace Period:** Allow vouchers to be used for X minutes after expiration
6. **Custom Schedules:** Different intervals for different times of day

## Support

For issues or questions, check:
- Server logs: Look for "expiration" related messages
- Database: Verify promotion/voucher dates and statuses
- Configuration: Ensure environment variables are set correctly