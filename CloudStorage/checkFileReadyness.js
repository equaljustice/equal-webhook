export async function checkFileAvailability(fileURL) {
    try {
        // Make a fetch request to the file URL
        const response = await fetch(fileURL);

        if (response.ok) {
            return true;
            // break;  // exit the loop when the file is available
        } else {
            // File is not available yet
            console.log('File is not available yet. Retrying...');
            return false;
        }
    } catch (error) {
        console.error('Error checking file availability:', error);
        return false;
    }
}