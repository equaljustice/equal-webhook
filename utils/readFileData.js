import axios from 'axios';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { downloadWAFile } from '../whatsApp/whatsAppAPI.js'

function getFileType(url) {
    if (url.endsWith('.pdf')) {
        return 'pdf';
    } else if (url.endsWith('.docx')) {
        return 'docx';
    } else {
        return null;
    }
}
// Function to extract text from a PDF file
async function extractTextFromPDF(data) {
    const parsedData = await pdfParse(data);
    return parsedData.text;
}

// Function to extract text from a DOCX file
async function extractTextFromDOCX(data) {
    const result = await mammoth.extractRawText({ buffer: data });
    return result.value;
}

// Main function to handle both PDF and DOCX files
export async function extractTextFromDocument(url, mime_type, sha256) {
    try {
        // Fetch the document from the URL
        //const response = await axios.get(url, { responseType: 'arraybuffer' });
        const response = await downloadWAFile(url);
        const fileType = mime_type || getFileType(url);

        if (!fileType) {
            throw new Error('Unsupported file type');
        }

        let extractedText;

        if (fileType.endsWith('pdf')) {
            // Example usage
            const documentData = Buffer.from(response);
            const encryptionKey = sha256; // Provided by WhatsApp API
            const ivHex = 'your-initialization-vector-hex'; // IV in hex format provided by WhatsApp API

            processEncryptedPDF(documentData, encryptionKey, ivHex)
        } else if (fileType.endsWith('document')) {
            extractedText = await extractTextFromDOCX(response.data);
        }
        console.log("extracted text", extractedText);
        // Return the extracted text
        return extractedText;

    } catch (error) {
        console.error('Error reading document:', error);
        return null;
    }
}
