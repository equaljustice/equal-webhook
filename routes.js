//const APIrouter = require('express').Router();
import express from 'express';
import path from 'path';
import { getCities, getStates } from './UI-APIs/StateCity.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { openQnAFineTuned } from './Webhook/DFQnA.js';
import { createDocWithFineTuned } from './Webhook/DFWebhook.js';
import { authenticate, authenticateToken } from './Services/authenticate.js';
import { listFiles, downloadFile } from './UI-APIs/getGCSFiles.js';
import { getWhatsAppMsg, verifywhatsapp } from './Webhook/WAWebhookNew.js';
import { validateWhatsAppConfig, getWhatsAppAPIMetrics } from './whatsApp/whatsAppAPI.js';
import { getPaymentConfigSummary } from './utils/paymentUtils.js';
import { 
    getAllSessions, 
    getSessionByPhone, 
    getAllFiles, 
    getFilesByThread, 
    getWhatsAppFailures, 
    getSystemHealth, 
    getConversationHistory, 
    deleteSession, 
    getDashboardSummary 
} from './admin/adminAPI.js';
const APIrouter = express.Router();

APIrouter.use('/getStates', getStates);
APIrouter.use('/getCities/:stateCode', getCities);
APIrouter.post('/webhook_QnAFineTuned', openQnAFineTuned);
APIrouter.post('/webhook_createDocWithFineTuned', createDocWithFineTuned);
APIrouter.post('/whatsappMessage', getWhatsAppMsg);
APIrouter.get('/whatsappMessage', verifywhatsapp);

// ⚡ HEALTH CHECK: Monitor WhatsApp API configuration and connectivity
APIrouter.get('/health/whatsapp', (req, res) => {
    const healthCheck = {
        timestamp: new Date().toISOString(),
        status: 'unknown',
        checks: {}
    };
    
    try {
        // Check WhatsApp configuration
        const configValidation = validateWhatsAppConfig();
        healthCheck.checks.configuration = {
            status: configValidation.valid ? 'healthy' : 'unhealthy',
            errors: configValidation.errors
        };
        
        // Include API metrics
        const metrics = getWhatsAppAPIMetrics();
        healthCheck.checks.apiMetrics = {
            status: 'info',
            data: metrics
        };
        
        // Include payment configuration
        const paymentConfig = getPaymentConfigSummary();
        healthCheck.checks.paymentConfig = {
            status: 'info',
            data: paymentConfig
        };
        
        // Check for recent WhatsApp API failures
        const recentFailures = metrics.failedCalls || 0;
        const totalCalls = metrics.totalCalls || 0;
        const failureRate = totalCalls > 0 ? (recentFailures / totalCalls) * 100 : 0;
        
        healthCheck.checks.whatsappConnectivity = {
            status: failureRate < 10 ? 'healthy' : 'degraded',
            data: {
                failureRate: `${failureRate.toFixed(2)}%`,
                recentFailures,
                totalCalls,
                lastFailure: metrics.lastFailureTime || 'none'
            }
        };
        
        // Overall health status
        const criticalChecks = ['configuration', 'whatsappConnectivity'];
        const allCriticalChecksHealthy = criticalChecks
            .every(check => healthCheck.checks[check]?.status === 'healthy');
        
        healthCheck.status = allCriticalChecksHealthy ? 'healthy' : 'degraded';
        
        const statusCode = allCriticalChecksHealthy ? 200 : 503;
        res.status(statusCode).json(healthCheck);
        
    } catch (error) {
        healthCheck.status = 'error';
        healthCheck.error = error.message;
        res.status(503).json(healthCheck);
    }
});
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
APIrouter.get('/secured', (req, res) => {
  res.sendFile(path.join(__dirname, 'secured.html'));
})
// Route to handle file download
APIrouter.get('/download/:threadId/:filename', (req, res) => {

  res.redirect(`https://storage.googleapis.com/ejustice-public-bucket/${req.params.threadId}/${req.params.filename}.docx?time=${new Date().getTime()}`);
});
APIrouter.get('/list-files/:folder', authenticateToken, listFiles);
APIrouter.get('/downloadFile/:folder/:filename', downloadFile);
APIrouter.post('/login', authenticate);

// Admin Dashboard Routes
APIrouter.get('/admin/dashboard', authenticateToken, async (req, res) => {
    try {
        const summary = await getDashboardSummary();
        res.json(summary);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/sessions', authenticateToken, async (req, res) => {
    try {
        const sessions = await getAllSessions();
        res.json(sessions);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/sessions/:phoneNumber', authenticateToken, async (req, res) => {
    try {
        const session = await getSessionByPhone(req.params.phoneNumber);
        res.json(session);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.delete('/admin/sessions/:phoneNumber', authenticateToken, async (req, res) => {
    try {
        const result = await deleteSession(req.params.phoneNumber);
        res.json(result);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/files', authenticateToken, async (req, res) => {
    try {
        const files = await getAllFiles();
        res.json(files);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/files/thread/:threadId', authenticateToken, async (req, res) => {
    try {
        const files = await getFilesByThread(req.params.threadId);
        res.json(files);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/whatsapp-failures', authenticateToken, async (req, res) => {
    try {
        const failures = await getWhatsAppFailures();
        res.json(failures);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/system-health', authenticateToken, async (req, res) => {
    try {
        const health = await getSystemHealth();
        res.json(health);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

APIrouter.get('/admin/conversation/:phoneNumber', authenticateToken, async (req, res) => {
    try {
        const conversation = await getConversationHistory(req.params.phoneNumber, req.query.limit);
        res.json(conversation);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Admin Dashboard Route - Serve the built Next.js app
APIrouter.get('/admin*', (req, res) => {
    // Remove /admin prefix from the request path
    const filePath = req.path.replace('/admin', '');
    
    // Default to index.html if no specific file is requested
    const finalPath = filePath === '/' ? '/index.html' : filePath;
    
    // Serve static files from the admin-dashboard/out directory
    res.sendFile(path.join(process.cwd(), 'admin-dashboard/out', finalPath));
});

// Export the router
export default APIrouter;