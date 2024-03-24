import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import fs from 'fs';
import path from 'path';
import { Storage } from '@google-cloud/storage';
import * as constants from '../constants.js';
import OpenAI from 'openai';
let processDocxCallCount = 0;
export function processDocx(information, folder, fileName) {
    processDocxCallCount++;
    if (processDocxCallCount === 2) {
        processDocxhindi(information, folder, fileName);
    }
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
    return uploadToCloudBucket(folder, `${fileName}.docx`);
}

function uploadToCloudBucket(folder, destinationFile) {

    // Initialize storage
    const storage = new Storage();

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

async function processDocxhindi(information, folder, fileName) {
    information = "Translate the following text to Hindi:" + information;
    console.log(information);
    var translation_response = await openAiCompletionWithGPT3_5(information);
    console.log(translation_response);
    information = translation_response.choices[0].message.content;
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
    fileName += "Hindi";
    fs.writeFileSync(`${fileName}.docx`, buf);
    return uploadToCloudBucket(folder, `${fileName}.docx`);
}

async function openAiCompletionWithGPT3_5(message, temperature = 0.5, top_p = 0.9, frequency_penalty = 0.2, presence_penalty = 0) {
    const openai = new OpenAI(process.env.OPENAI_API_KEY);
    const completionResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-16k",
        messages: [{
                role: "system",
                content: "Translate the following text to Hindi:"
            },
            {
                role: "user",
                content: message
            }
        ],
        temperature: temperature,
        max_tokens: 4096,
        n: 1,
        top_p: top_p,
        frequency_penalty: frequency_penalty,
        presence_penalty: presence_penalty,
    });
    return completionResponse;
}