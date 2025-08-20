import { createClient } from 'redis';

/* const client = createClient({
    password: process.env.Redis_pass,
    socket: {
        host: process.env.Redis_host,
        port: 11212
    }
}); 
// Connect the client
await client.connect();

export async function getThreadId(phoneNumber) {
    try {
        // Check if the thread ID already exists for the given phone number
        const existingThreadId = await client.get(phoneNumber);
        if (existingThreadId) {
            return existingThreadId;
        } return null;
    } catch (error) {
        console.error('Error interacting with Redis:', error);
    }
}

export async function saveThreadId(phoneNumber, threadId) {
    try {
        await client.set(phoneNumber, threadId, {
            EX: 172800 // 2 days in seconds
        });
        console.log(`Thread created and stored for phone number: ${phoneNumber}, Thread ID: ${threadId}`);
        
        // Enhanced logging for thread storage
        const logData = {
            event: 'thread_stored_in_redis',
            phoneNumber: phoneNumber,
            threadId: threadId,
            storageType: 'redis',
            expirationSeconds: 172800,
            timestamp: new Date().toISOString()
        };
        console.log('Thread storage log:', JSON.stringify(logData));
        
        return threadId;
    } catch (error) {
        console.error('Error interacting with Redis:', error);
        throw error;
    }
}

export async function deleteThread(phoneNumber) {
    try {
        const existingThreadId = await getThreadId(phoneNumber);
        const result = await client.del(phoneNumber);

        if (result === 1) {
            console.log(`Thread for phone number ${phoneNumber} deleted successfully.`);
        } else {
            console.log(`Thread for phone number ${phoneNumber} does not exist.`);
        }
        return existingThreadId;
    } catch (error) {
        console.error('Error deleting thread from Redis:', error);
    }
}
// Close the Redis connection when done
export async function closeRedisConnection() {
    await client.quit();
}
    */