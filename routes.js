//const APIrouter = require('express').Router();
import express from 'express';
import { getCities, getStates } from './UI-APIs/StateCity.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { openQnAFineTuned } from './Webhook/DFQnA.js';
import { createDocWithFineTuned } from './Webhook/DFWebhook.js';
import { authenticate, authenticateToken } from './Services/authenticate.js';
import { listFiles, downloadFile } from './UI-APIs/getGCSFiles.js';
import { getWhatsAppMsg, verifywhatsapp } from './Webhook/WAWebhookNew.js';
import { validateWhatsAppConfig, getWhatsAppAPIMetrics } from './whatsApp/whatsAppAPI.js';
import { getPaymentConfigSummary } from './utils/paymentUtils.js';
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
        
        // Overall health status
        const allChecksHealthy = Object.values(healthCheck.checks)
            .every(check => check.status === 'healthy');
        
        healthCheck.status = allChecksHealthy ? 'healthy' : 'unhealthy';
        
        const statusCode = allChecksHealthy ? 200 : 503;
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
// Export the router
export default APIrouter;