import { logger } from './logging.js';
import paymentConfig from '../config/payment.js';

/**
 * Payment Utility Functions
 * Handles edge cases and provides additional payment logic
 */

/**
 * Check if payment should be completely bypassed for any reason
 */
export function shouldBypassPayment(session, phoneNumberId, context = {}) {
    // Check if payment is globally disabled
    if (!paymentConfig.isPaymentEnabled()) {
        logger.info('Payment bypassed - globally disabled', {
            phoneNumberId,
            context
        });
        return true;
    }

    // Check if phone is whitelisted
    if (paymentConfig.isPhoneWhitelisted(phoneNumberId)) {
        logger.info('Payment bypassed - phone whitelisted', {
            phoneNumberId,
            context
        });
        return true;
    }

    // Check for emergency bypass scenarios
    if (context.emergencyMode || context.testMode) {
        logger.info('Payment bypassed - emergency/test mode', {
            phoneNumberId,
            context
        });
        return true;
    }

    return false;
}

/**
 * Get appropriate response message based on payment status and remaining interactions
 */
export function getPaymentStatusMessage(session, phoneNumberId) {
    const remainingInteractions = paymentConfig.getRemainingFreeInteractions(session, phoneNumberId);
    
    if (shouldBypassPayment(session, phoneNumberId)) {
        return {
            message: 'You have unlimited access to our services.',
            type: 'unlimited'
        };
    }

    if (remainingInteractions === Infinity) {
        return {
            message: 'You have unlimited free interactions.',
            type: 'unlimited'
        };
    }

    if (remainingInteractions > 0) {
        return {
            message: `You have ${remainingInteractions} free interaction${remainingInteractions === 1 ? '' : 's'} remaining.`,
            type: 'free_remaining'
        };
    }

    if (session?.payment?.transaction?.status === 'success') {
        const accessDurationText = paymentConfig.accessDurationHours === 1 ? '1 hour' : `${paymentConfig.accessDurationHours} hours`;
        return {
            message: `Payment successful! You have access for the next ${accessDurationText}.`,
            type: 'paid'
        };
    }

    if (session?.payment?.transaction?.status === 'pending') {
        return {
            message: 'Payment is pending. Please complete the payment to continue.',
            type: 'pending'
        };
    }

    return {
        message: 'Free interactions exhausted. Payment required to continue.',
        type: 'payment_required'
    };
}

/**
 * Validate payment configuration on startup
 */
export function validatePaymentConfig() {
    const errors = [];
    const warnings = [];

    // Check required environment variables
    if (process.env.PAYMENT_ENABLED === undefined) {
        warnings.push('PAYMENT_ENABLED not set, using default: true');
    }

    if (process.env.PAYMENT_FREE_INTERACTIONS === undefined) {
        warnings.push('PAYMENT_FREE_INTERACTIONS not set, using default: 10');
    }

    // Validate numeric values
    if (paymentConfig.freeInteractions < 0) {
        errors.push('PAYMENT_FREE_INTERACTIONS must be non-negative');
    }

    if (paymentConfig.accessDurationHours <= 0) {
        errors.push('PAYMENT_ACCESS_DURATION_HOURS must be positive');
    }

    if (paymentConfig.accessDurationHours > 24) {
        warnings.push('PAYMENT_ACCESS_DURATION_HOURS is set to more than 24 hours');
    }

    // Validate whitelist format
    if (process.env.PAYMENT_WHITELIST_PHONES) {
        const phones = process.env.PAYMENT_WHITELIST_PHONES.split(',');
        for (const phone of phones) {
            if (phone.trim().length === 0) {
                warnings.push('Empty phone number found in PAYMENT_WHITELIST_PHONES');
            }
        }
    }

    return { errors, warnings };
}

/**
 * Get payment configuration summary for monitoring
 */
export function getPaymentConfigSummary() {
    return {
        enabled: paymentConfig.isPaymentEnabled(),
        freeInteractions: paymentConfig.freeInteractions,
        accessDurationHours: paymentConfig.accessDurationHours,
        debugMode: paymentConfig.debugMode,
        whitelistPhonesCount: paymentConfig.whitelistPhones.length,
        accessDurationMs: paymentConfig.getAccessDurationMs(),
        accessDurationSeconds: paymentConfig.getAccessDurationSeconds()
    };
}

/**
 * Handle payment-related errors gracefully
 */
export function handlePaymentError(error, context = {}) {
    const errorInfo = {
        message: error.message,
        stack: error.stack,
        context,
        timestamp: new Date().toISOString()
    };

    // Log error with appropriate level
    if (error.code === 'PAYMENT_GATEWAY_ERROR') {
        logger.error('Payment gateway error', errorInfo);
        return {
            success: false,
            message: 'Payment service temporarily unavailable. Please try again later.',
            retryable: true
        };
    }

    if (error.code === 'PAYMENT_CONFIG_ERROR') {
        logger.error('Payment configuration error', errorInfo);
        return {
            success: false,
            message: 'Payment system configuration error. Please contact support.',
            retryable: false
        };
    }

    // Default error handling
    logger.error('Unexpected payment error', errorInfo);
    return {
        success: false,
        message: 'An unexpected error occurred. Please try again.',
        retryable: true
    };
}

/**
 * Check if session needs to be refreshed based on payment status
 */
export function shouldRefreshSession(session, phoneNumberId) {
    if (!session) return true;

    // If payment is disabled or phone is whitelisted, always allow
    if (shouldBypassPayment(session, phoneNumberId)) {
        return false;
    }

    // If payment was successful, check if access duration has expired
    if (session.payment?.transaction?.status === 'success') {
        const sessionAge = Date.now() - (session.lastActivity || Date.now());
        const maxAge = paymentConfig.getAccessDurationMs();
        
        if (sessionAge > maxAge) {
            logger.info('Session expired due to payment access duration', {
                phoneNumberId,
                sessionAge,
                maxAge
            });
            return true;
        }
    }

    return false;
}

/**
 * Get payment bypass reason for logging
 */
export function getPaymentBypassReason(session, phoneNumberId, context = {}) {
    if (!paymentConfig.isPaymentEnabled()) {
        return 'payment_globally_disabled';
    }

    if (paymentConfig.isPhoneWhitelisted(phoneNumberId)) {
        return 'phone_whitelisted';
    }

    if (context.emergencyMode) {
        return 'emergency_mode';
    }

    if (context.testMode) {
        return 'test_mode';
    }

    return 'none';
}
