import { logger } from '../utils/logging.js';

/**
 * Payment Configuration Manager
 * Centralizes all payment-related settings and provides utility functions
 */
class PaymentConfig {
    constructor() {
        try {
            this.enabled = this.parseBoolean(process.env.PAYMENT_ENABLED, true);
            this.freeInteractions = this.parseInt(process.env.PAYMENT_FREE_INTERACTIONS, 10);
            this.accessDurationHours = this.parseInt(process.env.PAYMENT_ACCESS_DURATION_HOURS, 2);
            this.debugMode = this.parseBoolean(process.env.PAYMENT_DEBUG_MODE, false);
            this.whitelistPhone = this.parseWhitelist(process.env.PAYMENT_WHITELIST_PHONE);
            
            this.logConfiguration();
        } catch (error) {
            // Fallback to default configuration if any error occurs
            console.warn('Error loading payment configuration, using defaults:', error.message);
            this.enabled = true;
            this.freeInteractions = 10;
            this.accessDurationHours = 2;
            this.debugMode = false;
            this.whitelistPhone = null;
            
            this.logConfiguration();
        }
    }

    /**
     * Parse boolean environment variable with fallback
     */
    parseBoolean(value, defaultValue = false) {
        try {
            if (value === undefined || value === null) return defaultValue;
            if (typeof value === 'boolean') return value;
            if (typeof value === 'string') {
                const lowerValue = value.toLowerCase().trim();
                return lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes';
            }
            return defaultValue;
        } catch (error) {
            console.warn('Error parsing boolean value:', value, 'using default:', defaultValue);
            return defaultValue;
        }
    }

    /**
     * Parse integer environment variable with fallback
     */
    parseInt(value, defaultValue = 0) {
        try {
            if (value === undefined || value === null) return defaultValue;
            const parsed = parseInt(value, 10);
            return isNaN(parsed) ? defaultValue : parsed;
        } catch (error) {
            console.warn('Error parsing integer value:', value, 'using default:', defaultValue);
            return defaultValue;
        }
    }

    /**
     * Parse whitelist phone from string
     */
    parseWhitelist(value) {
        try {
            if (!value) return null;
            const phone = value.trim();
            return phone.length > 0 ? phone : null;
        } catch (error) {
            console.warn('Error parsing whitelist phone:', value, 'using null');
            return null;
        }
    }

    /**
     * Log current payment configuration
     */
    logConfiguration() {
        try {
            logger.info('Payment configuration loaded', {
                enabled: this.enabled,
                freeInteractions: this.freeInteractions,
                accessDurationHours: this.accessDurationHours,
                debugMode: this.debugMode,
                            whitelistPhone: this.whitelistPhone ? '[SET]' : '[NOT_SET]',
            whitelistPhoneValue: this.debugMode ? this.whitelistPhone : '[REDACTED]'
            });
        } catch (error) {
            // Fallback logging if logger is not available
            console.log('Payment configuration loaded with defaults:', {
                enabled: this.enabled,
                freeInteractions: this.freeInteractions,
                accessDurationHours: this.accessDurationHours,
                debugMode: this.debugMode,
                whitelistPhone: this.whitelistPhone ? '[SET]' : '[NOT_SET]'
            });
        }
    }

    /**
     * Check if payment is enabled globally
     */
    isPaymentEnabled() {
        return this.enabled;
    }

    /**
     * Check if a phone number is whitelisted (bypasses payment)
     */
    isPhoneWhitelisted(phoneNumberId) {
        return this.whitelistPhone === phoneNumberId;
    }

    /**
     * Check if user should be charged based on interactions and payment status
     */
    shouldChargeUser(session, phoneNumberId) {
        // If payment is disabled globally, never charge
        if (!this.isPaymentEnabled()) {
            if (this.debugMode) {
                logger.debug('Payment disabled globally - no charge required', {
                    phoneNumberId,
                    interactions: session?.interactions
                });
            }
            return false;
        }

        // If phone is whitelisted, never charge
        if (this.isPhoneWhitelisted(phoneNumberId)) {
            if (this.debugMode) {
                logger.debug('Phone whitelisted - no charge required', {
                    phoneNumberId,
                    interactions: session?.interactions
                });
            }
            return false;
        }

        // Check if user has exceeded free interactions
        const hasExceededFreeLimit = session && session.interactions > this.freeInteractions;
        
        // Check if payment is pending or not successful
        const paymentNotSuccessful = !session?.payment?.transaction?.status || 
                                   session.payment.transaction.status !== 'success';

        const shouldCharge = hasExceededFreeLimit && paymentNotSuccessful;

        if (this.debugMode) {
            logger.debug('Payment charge check', {
                phoneNumberId,
                interactions: session?.interactions,
                freeInteractions: this.freeInteractions,
                hasExceededFreeLimit,
                paymentStatus: session?.payment?.transaction?.status,
                paymentNotSuccessful,
                shouldCharge
            });
        }

        return shouldCharge;
    }

    /**
     * Check if user has free interactions remaining
     */
    hasFreeInteractionsRemaining(session, phoneNumberId) {
        // If payment is disabled or phone is whitelisted, always has free interactions
        if (!this.isPaymentEnabled() || this.isPhoneWhitelisted(phoneNumberId)) {
            return true;
        }

        return session && session.interactions <= this.freeInteractions;
    }

    /**
     * Get the number of free interactions remaining
     */
    getRemainingFreeInteractions(session, phoneNumberId) {
        if (!this.isPaymentEnabled() || this.isPhoneWhitelisted(phoneNumberId)) {
            return Infinity; // Unlimited free interactions
        }

        if (!session) return this.freeInteractions;
        return Math.max(0, this.freeInteractions - session.interactions);
    }

    /**
     * Check if payment is required but not yet sent
     */
    isPaymentRequiredButNotSent(session, phoneNumberId) {
        if (!this.shouldChargeUser(session, phoneNumberId)) {
            return false;
        }

        return session?.payment?.transaction?.status === 'pending' && !session?.payment?.linkSent;
    }

    /**
     * Check if payment link was already sent
     */
    isPaymentLinkAlreadySent(session, phoneNumberId) {
        if (!this.shouldChargeUser(session, phoneNumberId)) {
            return false;
        }

        return session?.payment?.linkSent === true;
    }

    /**
     * Get access duration in milliseconds
     */
    getAccessDurationMs() {
        return this.accessDurationHours * 60 * 60 * 1000;
    }

    /**
     * Get access duration in seconds (for WhatsApp API)
     */
    getAccessDurationSeconds() {
        return this.accessDurationHours * 60 * 60;
    }
}

// Create singleton instance
const paymentConfig = new PaymentConfig();

export default paymentConfig;
