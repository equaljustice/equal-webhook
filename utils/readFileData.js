import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

// Function to delete a file from local storage
export function deleteFile(filePath) {
    return new Promise((resolve, reject) => {
        fs.unlink(filePath, (err) => {
            if (err) {
                console.error(`Error deleting the file: ${filePath}`, err);
                reject(err);
            } else {
                console.log(`File ${filePath} deleted successfully.`);
                resolve();
            }
        });
    });
}


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
export async function extractTextFromDocument(filePath, mime_type) {
    if (!filePath) {
        console.log("Null FilePath");
        return;
    }
    try {
        const dataBuffer = fs.readFileSync(filePath);
        const fileType = mime_type || getFileType(url);

        if (!fileType) {
            throw new Error('Unsupported file type');
        }

        let extractedText;

        if (fileType.endsWith('pdf')) {
            extractedText = await extractTextFromPDF(dataBuffer)
        } else if (fileType.endsWith('document')) {
            extractedText = await extractTextFromDOCX(dataBuffer);
        }
        console.log("extracted text", extractedText);
        // Return the extracted text
        return extractedText;

    } catch (error) {
        console.error('Error reading document:', error);
        return null;
    }
}
