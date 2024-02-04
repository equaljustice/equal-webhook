import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from 'fs';
import path from 'path';
import {Storage} from '@google-cloud/storage';

export function processDocx(information) {
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
    fs.writeFileSync(path.resolve("output.docx"), buf);
    return uploadToCloudBucket("output.docx");
}

export function uploadToCloudBucket(destinationFile){

// Initialize storage
const storage = new Storage();

const bucketName = 'ejustice-public-bucket'
const bucket = storage.bucket(bucketName)

// Sending the upload request
bucket.upload(
    path.resolve(destinationFile),
  {
    destination: `letter-to-bank/${destinationFile}`,
  },
  function (err, file) {
    if (err) {
      console.error(`Error uploading ${destinationFile}: ${err}`)
    } else {
      console.log(`${destinationFile} uploaded to ${bucketName}.`)

        // Making file public to the internet
        file.makePublic(async function (err) {
        if (err) {
          console.error(`Error making file public: ${err}`)
          return err.message;
        } else {
          console.log(`File ${file.name} is now public.`)
          const publicUrl = file.publicUrl()
          console.log(`Public URL for ${file.name}: ${publicUrl}`)
          return publicUrl;
        }
       })

    }
  }
)

}