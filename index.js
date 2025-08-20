// Copyright 2021 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import app from './app.js';
import { closeRedisConnection } from './Services/redis/redisWASession.js';
import {logger, initLogCorrelation} from './utils/logging.js';
import {fetchProjectId} from './utils/metadata.js';
import { validatePaymentConfig } from './utils/paymentUtils.js';
import dotenv from 'dotenv';
dotenv.config();
/**
 * Initialize app and start Express server
 */

const main = async () => {
  let project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) {
    try {
      project = fetchProjectId();
    } catch (err) {
      logger.warn('Could not fetch Project Id for tracing.');
    }
  }
  // Initialize request-based logger with project Id
  initLogCorrelation(project);

  // Validate payment configuration (optional, don't fail if validation fails)
  try {
    const paymentValidation = validatePaymentConfig();
    if (paymentValidation.errors.length > 0) {
      logger.error('Payment configuration errors found', {
        errors: paymentValidation.errors
      });
      // Don't exit, just log the errors and continue with defaults
    }
    
    if (paymentValidation.warnings.length > 0) {
      logger.warn('Payment configuration warnings', {
        warnings: paymentValidation.warnings
      });
    }
  } catch (error) {
    logger.error('Error validating payment configuration', {
      error: error.message,
      stack: error.stack
    });
    // Don't exit, continue with default configuration
    console.log('Continuing with default payment configuration...');
  }

  // Start server listening on PORT env var
  const PORT = process.env.PORT || 8080;
  app.listen(PORT, () => logger.info(`Listening on port ${PORT}`));
};

/**
 * Listen for termination signal
 */
process.on('SIGTERM', () => {
  // Clean up resources on shutdown
  closeRedisConnection();
  logger.info('Caught SIGTERM.');
  logger.flush();
});

main();
