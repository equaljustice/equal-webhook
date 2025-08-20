import { createClient } from 'redis';
import { Storage } from '@google-cloud/storage';
import { logger } from '../utils/logging.js';
import * as constants from '../constants.js';
import { getWhatsAppAPIMetrics } from '../whatsApp/whatsAppAPI.js';
import { getPaymentConfigSummary } from '../utils/paymentUtils.js';

const client = createClient({
    url: process.env.Redis_url
});

const storage = new Storage();

// Initialize Redis connection
try {
    await client.connect();
} catch (error) {
    logger.error('Failed to connect to Redis for admin API:', error);
}

/**
 * Get all active sessions from Redis
 */
export async function getAllSessions() {
    try {
        const keys = await client.keys('*');
        const sessions = [];
        
        for (const key of keys) {
            try {
                const sessionData = await client.get(key);
                if (sessionData) {
                    const session = JSON.parse(sessionData);
                    sessions.push({
                        phoneNumber: key,
                        ...session,
                        lastActivity: new Date().toISOString(),
                        sessionAge: Date.now() - (session.lastActivity || Date.now())
                    });
                }
            } catch (error) {
                logger.warn(`Failed to parse session for key ${key}:`, error);
            }
        }
        
        return {
            success: true,
            data: sessions,
            total: sessions.length,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error fetching sessions:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get session details by phone number
 */
export async function getSessionByPhone(phoneNumber) {
    try {
        const sessionData = await client.get(phoneNumber);
        if (!sessionData) {
            return {
                success: false,
                error: 'Session not found',
                timestamp: new Date().toISOString()
            };
        }
        
        const session = JSON.parse(sessionData);
        return {
            success: true,
            data: {
                phoneNumber,
                ...session,
                lastActivity: new Date().toISOString(),
                sessionAge: Date.now() - (session.lastActivity || Date.now())
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error(`Error fetching session for ${phoneNumber}:`, error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get all files from Google Cloud Storage
 */
export async function getAllFiles() {
    try {
        const bucketName = constants.PUBLIC_BUCKET_DEV;
        const [files] = await storage.bucket(bucketName).getFiles();
        
        const fileList = files.map(file => ({
            name: file.name,
            size: file.metadata?.size || 0,
            contentType: file.metadata?.contentType || 'unknown',
            timeCreated: file.metadata?.timeCreated || null,
            updated: file.metadata?.updated || null,
            publicUrl: file.publicUrl(),
            threadId: file.name.split('/')[0] || 'unknown',
            fileName: file.name.split('/').pop() || file.name
        }));
        
        // Group files by threadId
        const filesByThread = fileList.reduce((acc, file) => {
            if (!acc[file.threadId]) {
                acc[file.threadId] = [];
            }
            acc[file.threadId].push(file);
            return acc;
        }, {});
        
        return {
            success: true,
            data: {
                files: fileList,
                filesByThread,
                totalFiles: fileList.length,
                totalThreads: Object.keys(filesByThread).length
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error fetching files:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get files by thread ID
 */
export async function getFilesByThread(threadId) {
    try {
        const bucketName = constants.PUBLIC_BUCKET_DEV;
        const [files] = await storage.bucket(bucketName).getFiles({ prefix: threadId });
        
        const fileList = files.map(file => ({
            name: file.name,
            size: file.metadata?.size || 0,
            contentType: file.metadata?.contentType || 'unknown',
            timeCreated: file.metadata?.timeCreated || null,
            updated: file.metadata?.updated || null,
            publicUrl: file.publicUrl(),
            fileName: file.name.split('/').pop() || file.name
        }));
        
        return {
            success: true,
            data: {
                threadId,
                files: fileList,
                totalFiles: fileList.length
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error(`Error fetching files for thread ${threadId}:`, error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get WhatsApp API failures and metrics
 */
export async function getWhatsAppFailures() {
    try {
        const metrics = getWhatsAppAPIMetrics();
        const paymentConfig = getPaymentConfigSummary();
        
        return {
            success: true,
            data: {
                metrics,
                paymentConfig,
                failureRate: metrics.totalCalls > 0 ? (metrics.failedCalls / metrics.totalCalls) * 100 : 0,
                lastFailure: metrics.lastFailureTime || null,
                recentFailures: metrics.recentFailures || []
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error fetching WhatsApp failures:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get system health and status
 */
export async function getSystemHealth() {
    try {
        const metrics = getWhatsAppAPIMetrics();
        const paymentConfig = getPaymentConfigSummary();
        
        // Check Redis connectivity
        let redisStatus = 'unknown';
        try {
            await client.ping();
            redisStatus = 'healthy';
        } catch (error) {
            redisStatus = 'unhealthy';
        }
        
        // Check Google Cloud Storage connectivity
        let gcsStatus = 'unknown';
        try {
            const bucketName = constants.PUBLIC_BUCKET_DEV;
            await storage.bucket(bucketName).getMetadata();
            gcsStatus = 'healthy';
        } catch (error) {
            gcsStatus = 'unhealthy';
        }
        
        const failureRate = metrics.totalCalls > 0 ? (metrics.failedCalls / metrics.totalCalls) * 100 : 0;
        
        return {
            success: true,
            data: {
                overallStatus: (redisStatus === 'healthy' && gcsStatus === 'healthy' && failureRate < 10) ? 'healthy' : 'degraded',
                services: {
                    redis: redisStatus,
                    googleCloudStorage: gcsStatus,
                    whatsAppAPI: failureRate < 10 ? 'healthy' : 'degraded'
                },
                metrics: {
                    ...metrics,
                    failureRate: failureRate.toFixed(2)
                },
                paymentConfig,
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error fetching system health:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get conversation history (simulated - would need to be implemented with actual message storage)
 */
export async function getConversationHistory(phoneNumber, limit = 50) {
    try {
        // This is a placeholder - in a real implementation, you'd store messages in Redis or a database
        const session = await getSessionByPhone(phoneNumber);
        
        if (!session.success) {
            return {
                success: false,
                error: 'Session not found',
                timestamp: new Date().toISOString()
            };
        }
        
        // Simulated conversation history
        const conversation = [
            {
                id: 1,
                type: 'user',
                content: 'Hi, I need help with a bank issue',
                timestamp: new Date(Date.now() - 3600000).toISOString()
            },
            {
                id: 2,
                type: 'assistant',
                content: 'Hello! I can help you with bank-related issues. Please select from the options below.',
                timestamp: new Date(Date.now() - 3500000).toISOString()
            },
            {
                id: 3,
                type: 'user',
                content: 'ATM fraud',
                timestamp: new Date(Date.now() - 3400000).toISOString()
            },
            {
                id: 4,
                type: 'assistant',
                content: 'I understand you\'re dealing with ATM fraud. Let me help you create the necessary documents.',
                timestamp: new Date(Date.now() - 3300000).toISOString()
            }
        ];
        
        return {
            success: true,
            data: {
                phoneNumber,
                session: session.data,
                conversation: conversation.slice(0, limit),
                totalMessages: conversation.length
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error(`Error fetching conversation history for ${phoneNumber}:`, error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Delete a session
 */
export async function deleteSession(phoneNumber) {
    try {
        const result = await client.del(phoneNumber);
        
        if (result === 1) {
            logger.info(`Admin deleted session for phone number: ${phoneNumber}`);
            return {
                success: true,
                message: 'Session deleted successfully',
                timestamp: new Date().toISOString()
            };
        } else {
            return {
                success: false,
                error: 'Session not found',
                timestamp: new Date().toISOString()
            };
        }
    } catch (error) {
        logger.error(`Error deleting session for ${phoneNumber}:`, error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

/**
 * Get dashboard summary statistics
 */
export async function getDashboardSummary() {
    try {
        const [sessions, files, health] = await Promise.all([
            getAllSessions(),
            getAllFiles(),
            getSystemHealth()
        ]);
        
        const activeSessions = sessions.success ? sessions.data.length : 0;
        const totalFiles = files.success ? files.data.totalFiles : 0;
        const totalThreads = files.success ? files.data.totalThreads : 0;
        
        // Calculate payment statistics
        const paymentStats = sessions.success ? sessions.data.reduce((stats, session) => {
            if (session.payment?.transaction?.status === 'success') {
                stats.successfulPayments++;
            } else if (session.payment?.transaction?.status === 'pending') {
                stats.pendingPayments++;
            }
            stats.totalInteractions += session.interactions || 0;
            return stats;
        }, { successfulPayments: 0, pendingPayments: 0, totalInteractions: 0 }) : { successfulPayments: 0, pendingPayments: 0, totalInteractions: 0 };
        
        return {
            success: true,
            data: {
                activeSessions,
                totalFiles,
                totalThreads,
                systemHealth: health.success ? health.data.overallStatus : 'unknown',
                paymentStats,
                whatsAppMetrics: health.success ? health.data.metrics : {},
                timestamp: new Date().toISOString()
            },
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        logger.error('Error fetching dashboard summary:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}
