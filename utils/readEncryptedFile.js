import crypto from 'crypto';
import pdfParse from 'pdf-parse';

// Function to decrypt the file using AES-256-CBC with SHA-256 key
function decryptFile(data, encryptionKey, iv) {
    const key = crypto.createHash('sha256').update(encryptionKey).digest();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted;
}

// Function to extract text from a decrypted PDF buffer
async function extractTextFromPDF(dataBuffer) {
    const parsedData = await pdfParse(dataBuffer);
    return parsedData.text;
}

// Main function to handle the encrypted PDF buffer
async function processEncryptedPDF(data, encryptionKey, ivHex) {
    try {
        // Convert the IV from hex to Buffer
        const iv = Buffer.from(ivHex, 'hex');

        // Decrypt the data buffer
        const decryptedData = decryptFile(data, encryptionKey, iv);

        // Extract text from the decrypted PDF buffer
        const extractedText = await extractTextFromPDF(decryptedData);

        // Return the extracted text
        return extractedText;

    } catch (error) {
        console.error('Error processing encrypted PDF:', error);
        return null;
    }
}

