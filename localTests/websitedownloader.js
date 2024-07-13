import axios from 'axios';
import fs from 'fs';
import path from 'path';

async function saveHtmlPage(url, filePath) {
    try {
        const response = await axios.get(url);
        console.log(response);
        fs.writeFileSync(filePath, response.data, 'utf-8');
        console.log(`Saved HTML from ${url} to ${filePath}`);
    } catch (error) {
        console.error(`Error fetching ${url}: ${error.message}`);
    }
}

const urls = [
    'https://studentaid.gov/pslf/',
    'https://studentaid.gov/manage-loans/default'
];

const outputDir = './saved_pages';

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

urls.forEach((url, index) => {
    const urlPath = new URL(url).pathname;
    const fileName = urlPath.split('/').filter(Boolean).pop() || 'index';
    const filePath = path.join(outputDir, `${fileName}.html`);
    saveHtmlPage(url, filePath);
});
