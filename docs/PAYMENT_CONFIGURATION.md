# Payment Configuration Guide

This document explains how to configure the payment system in the Equal Webhook application.

## Overview

The payment system can be completely controlled through environment variables, allowing you to:
- Enable/disable payment functionality globally
- Configure free interaction limits
- Set up phone number whitelists
- Adjust access duration after payment
- Enable debug logging

## Environment Variables

### Core Configuration

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `PAYMENT_ENABLED` | boolean | `true` | Master switch for payment functionality |
| `PAYMENT_FREE_INTERACTIONS` | integer | `10` | Number of free interactions before payment is required |
| `PAYMENT_ACCESS_DURATION_HOURS` | integer | `2` | Duration of access after successful payment (in hours) |
| `PAYMENT_DEBUG_MODE` | boolean | `false` | Enable detailed payment flow logging |
| `PAYMENT_WHITELIST_PHONE` | string | `""` | Single phone ID that bypasses payment |

### Configuration Examples

#### Disable Payment Completely
```bash
PAYMENT_ENABLED=false
```

#### Increase Free Interactions
```bash
PAYMENT_FREE_INTERACTIONS=20
```

#### Extend Access Duration
```bash
PAYMENT_ACCESS_DURATION_HOURS=4
```

#### Whitelist Specific Phone
```bash
PAYMENT_WHITELIST_PHONE=359476970593209
```

#### Enable Debug Mode
```bash
PAYMENT_DEBUG_MODE=true
```

## Payment Flow Logic

### When Payment is Required

Payment is required when ALL of the following conditions are met:

1. **Payment is globally enabled** (`PAYMENT_ENABLED=true`)
2. **Phone is not whitelisted** (not equal to `PAYMENT_WHITELIST_PHONE`)
3. **User has exceeded free interactions** (interactions > `PAYMENT_FREE_INTERACTIONS`)
4. **Payment is not already successful** (payment status ≠ 'success')

### Payment Bypass Scenarios

Payment is automatically bypassed when:

- `PAYMENT_ENABLED=false` (global disable)
- Phone number matches whitelist
- Emergency mode is activated
- Test mode is enabled

### Session Management

- **Free interactions**: Tracked in Redis session
- **Payment status**: Stored in session with transaction details
- **Access duration**: Configurable via `PAYMENT_ACCESS_DURATION_HOURS`
- **Session expiration**: Automatically set based on access duration

## Implementation Details

### Configuration Loading

The payment configuration is loaded at application startup:

```javascript
// config/payment.js
class PaymentConfig {
    constructor() {
        this.enabled = this.parseBoolean(process.env.PAYMENT_ENABLED, true);
        this.freeInteractions = this.parseInt(process.env.PAYMENT_FREE_INTERACTIONS, 10);
        // ... other config
    }
}
```

### Payment Checks

Payment logic is centralized in utility functions:

```javascript
// utils/paymentUtils.js
export function shouldBypassPayment(session, phoneNumberId, context = {}) {
    if (!paymentConfig.isPaymentEnabled()) return true;
    if (paymentConfig.isPhoneWhitelisted(phoneNumberId)) return true;
    // ... other checks
}
```

### Integration Points

The payment system integrates with:

1. **WhatsApp Webhook** (`Webhook/WAWebhookNew.js`)
   - Checks payment status before processing messages
   - Sends payment requests when needed
   - Handles payment status updates

2. **Redis Session Management** (`Services/redis/redisWASession.js`)
   - Stores payment status and interaction count
   - Manages session expiration based on payment

3. **WhatsApp API** (`whatsApp/whatsAppAPI.js`)
   - Sends payment orders with configurable expiration
   - Handles payment status notifications

## Monitoring and Health Checks

### Health Check Endpoint

Payment configuration is included in the health check:

```
GET /health/whatsapp
```

Response includes payment configuration status:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "status": "healthy",
  "checks": {
    "paymentConfig": {
      "status": "info",
      "data": {
        "enabled": true,
        "freeInteractions": 10,
        "accessDurationHours": 2,
                 "debugMode": false,
         "whitelistPhone": "359476970593209",
         "whitelistPhoneSet": true
      }
    }
  }
}
```

### Logging

Payment-related events are logged with appropriate levels:

- **INFO**: Configuration loading, payment bypasses, successful payments
- **DEBUG**: Detailed payment flow (when `PAYMENT_DEBUG_MODE=true`)
- **ERROR**: Payment failures, configuration errors

## Edge Cases and Error Handling

### Configuration Validation

The application validates payment configuration on startup:

- Checks for required environment variables
- Validates numeric values (non-negative, reasonable ranges)
- Warns about potential issues (long access durations, empty whitelist entries)

### Error Scenarios

1. **Payment Gateway Errors**: Graceful handling with retry logic
2. **Configuration Errors**: Application startup fails with clear error messages
3. **Session Expiration**: Automatic cleanup and user notification
4. **Whitelist Format Errors**: Warnings logged, invalid entries ignored

### Fallback Behavior

When payment is disabled:
- All users get unlimited free interactions
- No payment requests are sent
- Session management continues normally
- All functionality remains available

## Security Considerations

### Whitelist Management

- Phone numbers in whitelist bypass ALL payment checks
- Use with caution in production environments
- Consider implementing additional validation for whitelist entries

### Configuration Security

- Environment variables should be properly secured
- Avoid hardcoding sensitive values
- Use different configurations for different environments

### Session Security

- Session data includes payment status and should be protected
- Redis connections should be secured
- Session expiration prevents indefinite access

## Testing

### Test Scenarios

1. **Payment Disabled**: Verify unlimited access
2. **Payment Enabled**: Verify payment flow after free interactions
3. **Whitelisted Phone**: Verify bypass behavior
4. **Payment Success**: Verify access duration
5. **Payment Failure**: Verify error handling
6. **Session Expiration**: Verify cleanup

### Test Configuration

```bash
# Test with payment disabled
PAYMENT_ENABLED=false

# Test with minimal free interactions
PAYMENT_FREE_INTERACTIONS=1

# Test with debug logging
PAYMENT_DEBUG_MODE=true

# Test with whitelist
PAYMENT_WHITELIST_PHONE=test_phone_id
```

## Migration Guide

### From Hardcoded Values

If migrating from hardcoded payment logic:

1. Add environment variables to your deployment
2. Update configuration to match current behavior
3. Test thoroughly in staging environment
4. Deploy with monitoring enabled

### Configuration Changes

When changing payment configuration:

1. Update environment variables
2. Restart application
3. Monitor logs for configuration validation
4. Verify behavior with test users

## Troubleshooting

### Common Issues

1. **Payment not working**: Check `PAYMENT_ENABLED` setting
2. **Users charged too early**: Verify `PAYMENT_FREE_INTERACTIONS` value
3. **Access expires too quickly**: Check `PAYMENT_ACCESS_DURATION_HOURS`
4. **Whitelist not working**: Verify phone number format

### Debug Mode

Enable debug mode for detailed logging:

```bash
PAYMENT_DEBUG_MODE=true
```

This will log:
- Payment bypass reasons
- Charge check details
- Configuration loading
- Session state changes

### Health Check

Use the health check endpoint to verify configuration:

```bash
curl http://your-app/health/whatsapp
```

Check the `paymentConfig` section for current settings.
