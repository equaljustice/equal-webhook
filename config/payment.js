/**
 * Payment Configuration
 * Centralized configuration for payment-related settings and logic
 */

const paymentConfig = {
    // Free interactions before payment is required
    freeInteractions: 10,
    
    // Access duration after payment (in hours)
    accessDurationHours: 2,
    
    // Test phone numbers that bypass payment (for development/testing)
    // Note: These should be user phone numbers (from), not phone_number_id
    testPhoneNumbers: ['918130363763', '91971794491', '919650938605'],
    
    // Debug mode for additional logging
    debugMode: process.env.PAYMENT_DEBUG === 'true',
    
    // Whitelist phone from environment (optional)
    whitelistPhone: process.env.PAYMENT_WHITELIST_PHONE || null,
    
    /**
     * Initialize payment config with logging
     */
    init() {
        console.log('Payment Configuration Initialized:', {
            freeInteractions: this.freeInteractions,
            accessDurationHours: this.accessDurationHours,
            accessDurationSeconds: this.getAccessDurationSeconds(),
            accessDurationMs: this.getAccessDurationMs(),
            testPhoneNumbers: this.testPhoneNumbers.length,
            debugMode: this.debugMode,
            whitelistPhone: this.whitelistPhone,
            paymentEnabled: this.isPaymentEnabled(),
            timestamp: new Date().toISOString()
        });
    },
    
    /**
     * Check if user has free interactions remaining
     * @param {Object} session - User session object
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {boolean} - True if user has free interactions remaining
     */
    hasFreeInteractionsRemaining(session, userPhoneNumber) {
        // Test phone numbers bypass payment
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            console.log(`User ${userPhoneNumber} is whitelisted - bypassing payment check`);
            return true;
        }
        
        // Validate session object
        if (!session || typeof session.interactions !== 'number') {
            console.warn('Invalid session object in hasFreeInteractionsRemaining:', session);
            return false;
        }
        
        // Check if user is within free interaction limit
        const hasRemaining = session.interactions <= this.freeInteractions;
        console.log(`User ${userPhoneNumber} - Interactions: ${session.interactions}/${this.freeInteractions}, HasRemaining: ${hasRemaining}`);
        return hasRemaining;
    },
    
    /**
     * Get remaining free interactions for user
     * @param {Object} session - User session object
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {number} - Number of remaining free interactions
     */
    getRemainingFreeInteractions(session, userPhoneNumber) {
        // Test phone numbers have unlimited interactions
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            return 999;
        }
        
        const remaining = this.freeInteractions - session.interactions;
        return Math.max(0, remaining);
    },
    
    /**
     * Check if payment is required but link hasn't been sent yet
     * @param {Object} session - User session object
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {boolean} - True if payment link should be sent
     */
    isPaymentRequiredButNotSent(session, userPhoneNumber) {
        // Test phone numbers bypass payment
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            return false;
        }
        
        // Check if exceeded free interactions and payment link not sent
        return (
            session.interactions > this.freeInteractions &&
            session.payment &&
            session.payment.transaction.status === 'pending' &&
            !session.payment.linkSent
        );
    },
    
    /**
     * Check if payment link was already sent but payment not completed
     * @param {Object} session - User session object
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {boolean} - True if waiting for payment completion
     */
    isPaymentLinkAlreadySent(session, userPhoneNumber) {
        // Test phone numbers bypass payment
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            return false;
        }
        
        // Check if payment link was sent but payment not completed
        return (
            session.interactions > this.freeInteractions &&
            session.payment &&
            session.payment.transaction.status === 'pending' &&
            session.payment.linkSent === true
        );
    },
    
    /**
     * Check if user has paid and can continue using the service
     * @param {Object} session - User session object
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {boolean} - True if user can access paid features
     */
    hasValidPayment(session, userPhoneNumber) {
        // Test phone numbers bypass payment
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            return true;
        }
        
        // Check if payment was successful
        return session.payment && session.payment.transaction.status === 'success';
    },
    
    /**
     * Check if user needs to complete payment
     * @param {Object} session - User session object
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {boolean} - True if payment is pending
     */
    isPaymentPending(session, userPhoneNumber) {
        // Test phone numbers bypass payment
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            return false;
        }
        
        return (
            session.payment &&
            session.payment.transaction.status === 'pending' &&
            session.interactions > this.freeInteractions
        );
    },
    
    /**
     * Get access duration in seconds for Redis expiration
     * @returns {number} - Access duration in seconds
     */
    getAccessDurationSeconds() {
        return this.accessDurationHours * 60 * 60; // Convert hours to seconds
    },
    
    /**
     * Get access duration in milliseconds for JavaScript date calculations
     * @returns {number} - Access duration in milliseconds
     */
    getAccessDurationMs() {
        return this.accessDurationHours * 60 * 60 * 1000; // Convert hours to milliseconds
    },
    
    /**
     * Check if payment is globally enabled (for feature flags)
     * @returns {boolean} - True if payment is enabled
     */
    isPaymentEnabled() {
        // Check environment variable, default to true
        return process.env.PAYMENT_ENABLED !== 'false';
    },
    
    /**
     * Check if phone number is whitelisted (bypass payment)
     * @param {string} userPhoneNumber - User's phone number (from field, not phone_number_id)
     * @returns {boolean} - True if phone is whitelisted
     */
    isPhoneWhitelisted(userPhoneNumber) {
        // Check test phone numbers
        if (this.testPhoneNumbers.includes(userPhoneNumber)) {
            console.log(`Phone ${userPhoneNumber} is whitelisted via testPhoneNumbers`);
            return true;
        }
        
        // Check environment whitelist
        const whitelistPhone = process.env.PAYMENT_WHITELIST_PHONE;
        if (whitelistPhone && whitelistPhone.trim() === userPhoneNumber) {
            console.log(`Phone ${userPhoneNumber} is whitelisted via environment variable`);
            return true;
        }
        
        console.log(`Phone ${userPhoneNumber} is NOT whitelisted`);
        return false;
    }
};

export default paymentConfig;