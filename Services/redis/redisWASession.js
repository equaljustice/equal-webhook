import { createClient } from 'redis';
import { logger } from '../../utils/logging.js';

const client = createClient({
    password: process.env.Redis_pass,
    socket: {
        host: process.env.Redis_host,
        port: 11212
    }
});
// Connect the client
await client.connect();

// Function to save a session as a JSON object in Redis
export async function saveSession(phoneNumber, threadId, action, agentType, targetAgent) {
    try {
        // Create the session object
        const session = {
            threadId: threadId,
            action: action,
            agentType: agentType,
            targetAgent: targetAgent
        };

        // Store the session object as a JSON string in Redis
        await client.set(phoneNumber, JSON.stringify(session));
        console.log(`Session saved for phone number: ${phoneNumber}`);
    } catch (error) {
        console.error('Error saving session to Redis:', error);
        return null;
    }
}

// Function to get the session JSON object from Redis
export async function getSession(phoneNumber) {
    try {
        // Get the session string from Redis
        const sessionString = await client.get(phoneNumber);

        if (sessionString) {
            // Parse the JSON string back into an object
            const session = JSON.parse(sessionString);
            logger.info(`Session retrieved for phone number: ${phoneNumber} : ${session}`);
            return session;
        } else {
            console.log(`No session found for phone number: ${phoneNumber}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error retrieving session from Redis: ${error}`);
        return null
    }
}


export async function deleteSession(phoneNumber) {
    try {
        const session = await getSession(phoneNumber);
        if(session){
        const result = await client.del(phoneNumber);

        if (result === 1) {
            console.log(`Session for phone number ${phoneNumber} deleted successfully.`);
        } else {
            console.log(`Session for phone number ${phoneNumber} does not exist.`);
        }
        return session;
    }
    return null;
    } catch (error) {
        logger.error(`Error deleting session from Redis: ${error}`);
        return null;
    }
}
// Close the Redis connection when done
export async function closeRedisConnection() {
    await client.quit();
}