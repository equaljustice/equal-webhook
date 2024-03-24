import fs from 'fs';
import path from 'path';

// Function to retrieve all files in the root directory
function getAllFilesInRootDirectory(rootDir) {
    const files = fs.readdirSync(rootDir);
    return files.filter(file => fs.statSync(path.join(rootDir, file)).isFile());
}

// Create an HTTP server
export const getSysFiles = async(req, res) => {
    
        // Get all files in the root directory
        const rootDir = path.resolve('./'); // Assuming the root directory is the current directory
        const files = getAllFilesInRootDirectory(rootDir);

        // Display the list of files with download links
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.write('<h1>List of Files</h1>');
        res.write('<ul>');
        files.forEach(file => {
            res.write(`<li>${file} - <a href="/downloadSysFile?file=${file}">Download</a></li>`);
        });
        res.write('</ul>');
        res.end();
    } 
  export  const downloadSysFiles = async(req, res) =>{
   
        const query = new URLSearchParams(req.url.split('?')[1]);
        const fileName = query.get('file');
        const filePath = path.join('./', fileName);

        // Check if the file exists and send it for download
        if (fs.existsSync(filePath)) {
            res.writeHead(200, {
                'Content-Type': 'application/octet-stream',
                'Content-Disposition': `attachment; filename=${fileName}`
            });
            const fileStream = fs.createReadStream(filePath);
            fileStream.pipe(res);
        } else {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('File not found');
        }
    }