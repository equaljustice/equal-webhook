import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { convertMarkdownToWhatsApp } from './markdownToWA.js';

export async function sendWatsAppReplyText(textResponse, to, message_id) {
textResponse = await convertMarkdownToWhatsApp(textResponse);
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "recipient_type": "individual",
    "to": to,
    "type": "text",
    "text": {
      "preview_url": false,
      "body": textResponse
    }
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://graph.facebook.com/v20.0/382211174979358/messages',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.WhatsApp_Token
    },
    data: data
  };

  axios.request(config)
    .then((response) => {
      console.log("sent reply text: ", to, textResponse, JSON.stringify(response.data));
    })
    .catch((error) => {
      console.log(error);
    });
}

export async function markAsRead(message_id, message) {
  let data = JSON.stringify({
    "messaging_product": "whatsapp",
    "status": "read",
    "message_id": message_id
  });

  let config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://graph.facebook.com/v20.0/382211174979358/messages',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.WhatsApp_Token
    },
    data: data
  };

  axios.request(config)
    .then((response) => {
    })
    .catch((error) => {
      console.log(error);
    });
}

export async function getWAMediaURL(mediaId, phoneId) {
  try {
    let config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: `https://graph.facebook.com/v20.0/${mediaId}?phone_number_id=${phoneId}`,
      headers: {
        'Authorization': process.env.WhatsApp_Token
      }
    };

    const response = await axios.request(config)
    console.log("media", response.data)
    return response.data;
  } catch (error) {
    console.log(error);
  }

}

export async function downloadWAFile(mediaUrl, filename) {
  return new Promise((resolve, reject) => {
    try {
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: mediaUrl,
        headers: {
          'Authorization': process.env.WhatsApp_Token,
        },
        responseType: 'stream',
      };

      axios
        .request(config)
        .then((response) => {
          const mediaPath = path.resolve(
            './CloudStorage',
            filename
          ); // Add appropriate file extension like .pdf or .jpg

          const writer = fs.createWriteStream(mediaPath);

          response.data.pipe(writer);

          writer.on('finish', () => {
            console.log('Media file downloaded and saved to local storage.');
            resolve(mediaPath); // Resolve the promise with the file path
          });

          writer.on('error', (err) => {
            console.error('Error saving the media file:', err);
            reject(err); // Reject the promise if there's an error
          });
        })
        .catch((error) => {
          console.error('Error downloading the media file:', error);
          reject(error); // Reject the promise if download fails
        });
    } catch (error) {
      reject(error); // Catch any other errors and reject the promise
    }
  });
}