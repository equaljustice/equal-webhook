export async function checkFileAvailability(fileURL) {
    try {
        // ⚡ VALIDATION: Ensure URL is provided and valid
        if (!fileURL || typeof fileURL !== 'string') {
            console.error('Invalid file URL provided:', fileURL);
            return false;
        }
        
        // ⚡ URL VALIDATION: Basic URL format check
        try {
            new URL(fileURL);
        } catch (urlError) {
            console.error('Invalid URL format:', fileURL, urlError.message);
            return false;
        }
        
        console.log(`Checking file availability: ${fileURL}`);
        
        // Make a fetch request to the file URL with timeout
        const response = await fetch(fileURL, {
            method: 'HEAD', // Use HEAD for faster response (no body download)
            timeout: 10000, // 10 second timeout
            headers: {
                'User-Agent': 'EqualJustice-FileChecker/1.0'
            }
        });

        if (response.ok) {
            const contentLength = response.headers.get('content-length');
            console.log(`File is available - Status: ${response.status}, Size: ${contentLength || 'unknown'} bytes`);
            return true;
        } else {
            // File is not available yet
            console.log(`File is not available yet - Status: ${response.status} ${response.statusText}. Retrying...`);
            return false;
        }
    } catch (error) {
        // ⚡ BETTER ERROR HANDLING: Log specific error types
        if (error.name === 'AbortError' || error.code === 'ECONNABORTED') {
            console.error('File availability check timed out:', fileURL);
        } else if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
            console.error('Network error checking file availability:', fileURL, error.message);
        } else {
            console.error('Error checking file availability:', fileURL, error.message);
        }
        return false;
    }
}