import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import * as constants from '../constants.js';

const storage = new Storage();

export function processDocx(information, folder, fileName) {
    var temp_doc = "./CloudStorage/Bank.docx";
    // Load the docx file as binary content
    const content = fs.readFileSync(
        path.resolve(temp_doc),
        "binary"
    );

    // Unzip the content of the file
    const zip = new PizZip(content);

    // This will parse the template, and will throw an error if the template is
    // invalid, for example, if the template is "{user" (no closing tag)
    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
    });
    temp_doc = "Bank.docx"
        // Call the render function with the form values
    if (temp_doc == "Bank.docx") {
        doc.render({
            info: information
        });
    }

    const buf = doc.getZip().generate({
        type: "nodebuffer",
        compression: "DEFLATE",
    });

    // buf is a nodejs Buffer, you can either write it to a
    // file or res.send it with express for example.
    fs.writeFileSync(`${fileName}.docx`, buf);
    return uploadToCloudBucketNew(folder, `${fileName}.docx`);
}

function uploadToCloudBucket(folder, destinationFile) {

    // Initialize storage
    

    const bucketName = constants.PUBLIC_BUCKET_DEV;
    const bucket = storage.bucket(bucketName)

    // Sending the upload request
    bucket.upload(
        path.resolve(destinationFile), {
            destination: `${folder}/${destinationFile}`,
        },
        function(err, file) {
            if (err) {
                console.error(`Error uploading ${destinationFile}: ${err}`)
            } else {
                file.makePublic(async function(err) {
                    if (err) {
                        console.error(`Error making file public: ${err}`)
                        return err.message;
                    } else {
                        const publicUrl = file.publicUrl()
                        console.log(`Public URL for ${file.name}: ${publicUrl}`)
                        return publicUrl;
                    }
                })

            }
        }
    )
}

async function uploadToCloudBucketNew(folder, destinationFile) {
    const bucketName = constants.PUBLIC_BUCKET_DEV;
    const bucket = storage.bucket(bucketName);
    const filePath = path.resolve(destinationFile);

    try {
        // Upload the file
        const [file] = await bucket.upload(filePath, {
            destination: `${folder}/${path.basename(destinationFile)}`,
            resumable: true,  // Ensure resumable uploads for large files
        });

        console.log(`File ${destinationFile} uploaded successfully.`);

        // Make the file public
        await file.makePublic();
        const publicUrl = file.publicUrl();
        console.log(`Public URL for ${file.name}: ${publicUrl}`);
        return publicUrl;

    } catch (err) {
        console.error(`Error uploading ${destinationFile}: ${err.message}`);
        throw err;  // Re-throw the error if needed
    }
}