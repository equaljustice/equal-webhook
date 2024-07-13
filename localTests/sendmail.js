import { createTransport } from 'nodemailer';

// Replace with your email service details
const senderEmail = 'adonia';
const apiKey = 'cc08af718e48558fab15a88033092753-us4';

// Email recipient and content
const recipientEmail = 'chetan.aps@alchemis.ai';
const subject = 'Email with HTML content';
const htmlContent = `
  <!DOCTYPE html>
  <html>
    <body>
      <p>This is an email with HTML content.</p>
      <p><b>You can format the text with bold and other styles.</b></p>
    </body>
  </html>
`;

// Create a Nodemailer transporter object
const transporter = createTransport({
    host: 'smtp.mandrillapp.com',
    port: 465, // Use port 465 for SSL
    secure: true, // Use true for port 465
    auth: {
      user: 'chetan',  // Username can be any string (recommended: primary email)
      pass: apiKey,                       // Password is your Mandrill API key
    },
  });
  

// Define the email options
const mailOptions = {
  from: senderEmail,
  to: recipientEmail,
  subject: subject,
  html: htmlContent,
};

// Send the email
transporter.sendMail(mailOptions, (error, info) => {
  if (error) {
    console.error(error);
  } else {
    console.log(`Email sent: ${info.response}`);
  }
});
