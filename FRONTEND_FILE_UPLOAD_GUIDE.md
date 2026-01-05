# Frontend File Upload & Chat Integration Guide

## Overview

This guide explains how to implement a file upload feature that enables document-based chat functionality. After a user successfully uploads a document (PDF/DOCX/image), they can chat with the assistant about that document.

## Backend API Endpoints

### 1. Upload Document

**Endpoint:** `POST /api/assistant/upload-document`  
**Auth:** Required (JWT token in header)  
**Content-Type:** `multipart/form-data`

**Request:**

- Form field name: `document`
- File types: PDF, DOCX, JPEG, PNG
- Max size: 50MB

**Response:**

```json
{
  "fileId": "files/abc123xyz",
  "fileName": "document.pdf",
  "message": "File uploaded successfully"
}
```

### 2. Send Message (with file)

**Endpoint:** `POST /api/assistant/send-message`  
**Auth:** Required (JWT token in header)  
**Content-Type:** `application/json`

**Request:**

```json
{
  "sessionId": "session_id_here",
  "userMessage": "Analyze this Will document",
  "fileId": "files/abc123xyz" // Optional - include if file was uploaded
}
```

**Response:**

```json
{
  "reply": "Assistant's response text..."
}
```

## Frontend Implementation Steps

### Step 1: Create File Upload Component

```jsx
// FileUploadComponent.jsx
import { useState } from "react";
import axios from "axios";

const FileUploadComponent = ({ onUploadSuccess, sessionId }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [fileId, setFileId] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      // Validate file type
      const allowedTypes = [
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "image/jpeg",
        "image/png",
        "image/jpg",
      ];

      if (!allowedTypes.includes(selectedFile.type)) {
        setUploadError(
          "Invalid file type. Only PDF, DOCX, and images are allowed."
        );
        return;
      }

      // Validate file size (50MB)
      if (selectedFile.size > 50 * 1024 * 1024) {
        setUploadError("File size must be less than 50MB.");
        return;
      }

      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadError("Please select a file first.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append("document", file);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/assistant/upload-document`,
        formData,
        {
          headers: {
            "jwt-token": localStorage.getItem("jwtToken"), // Or your auth method
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const uploadedFileId = response.data.fileId;
      setFileId(uploadedFileId);

      // Notify parent component
      if (onUploadSuccess) {
        onUploadSuccess(uploadedFileId, response.data.fileName);
      }

      // Show success message
      alert(`File "${response.data.fileName}" uploaded successfully!`);
    } catch (error) {
      setUploadError(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to upload file. Please try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="file-upload-container">
      <div className="upload-section">
        <input
          type="file"
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
          onChange={handleFileChange}
          disabled={uploading}
          className="file-input"
        />

        {file && (
          <div className="file-info">
            <p>Selected: {file.name}</p>
            <p>Size: {(file.size / 1024 / 1024).toFixed(2)} MB</p>
          </div>
        )}

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          className="upload-button"
        >
          {uploading ? "Uploading..." : "Upload Document"}
        </button>

        {uploadError && (
          <div
            className="error-message"
            style={{ color: "red", marginTop: "10px" }}
          >
            {uploadError}
          </div>
        )}

        {fileId && (
          <div
            className="success-message"
            style={{ color: "green", marginTop: "10px" }}
          >
            ✓ File uploaded successfully! You can now start chatting.
          </div>
        )}
      </div>
    </div>
  );
};

export default FileUploadComponent;
```

### Step 2: Create Chat Component (with file support)

```jsx
// ChatComponent.jsx
import { useState, useRef, useEffect } from "react";
import axios from "axios";

const ChatComponent = ({ sessionId, fileId }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Show initial message if file is uploaded
  useEffect(() => {
    if (fileId && messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "I have received your document. How would you like me to analyze it?",
        },
      ]);
    }
  }, [fileId]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || sending) return;

    const userMessage = inputMessage.trim();
    setInputMessage("");

    // Add user message to chat
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setSending(true);

    try {
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/api/assistant/send-message`,
        {
          sessionId: sessionId,
          userMessage: userMessage,
          fileId: fileId || undefined, // Include fileId if available
        },
        {
          headers: {
            "jwt-token": localStorage.getItem("jwtToken"),
            "Content-Type": "application/json",
          },
        }
      );

      // Add assistant response to chat
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: response.data.reply,
        },
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error.response?.data?.error || error.message}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-container">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${
              msg.role === "user" ? "user-message" : "assistant-message"
            }`}
          >
            <div className="message-content">{msg.content}</div>
          </div>
        ))}
        {sending && (
          <div className="message assistant-message">
            <div className="message-content">Thinking...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-container">
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
          placeholder={
            fileId ? "Ask me about your document..." : "Type your message..."
          }
          disabled={sending}
          className="message-input"
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !inputMessage.trim()}
          className="send-button"
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatComponent;
```

### Step 3: Main Page Component (Combining Both)

```jsx
// DocumentChatPage.jsx
import { useState } from "react";
import FileUploadComponent from "./FileUploadComponent";
import ChatComponent from "./ChatComponent";

const DocumentChatPage = ({ sessionId }) => {
  const [uploadedFileId, setUploadedFileId] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  const handleUploadSuccess = (fileId, fileName) => {
    setUploadedFileId(fileId);
    setUploadedFileName(fileName);
  };

  return (
    <div className="document-chat-page">
      <h1>Document Analysis Chat</h1>

      {/* File Upload Section */}
      <div className="upload-section-wrapper">
        <h2>Step 1: Upload Your Document</h2>
        <FileUploadComponent
          onUploadSuccess={handleUploadSuccess}
          sessionId={sessionId}
        />
      </div>

      {/* Chat Section - Only show if file is uploaded */}
      {uploadedFileId && (
        <div className="chat-section-wrapper">
          <h2>Step 2: Chat About Your Document</h2>
          <div className="file-info-banner">
            📄 Analyzing: <strong>{uploadedFileName}</strong>
          </div>
          <ChatComponent sessionId={sessionId} fileId={uploadedFileId} />
        </div>
      )}

      {!uploadedFileId && (
        <div className="info-message">
          Please upload a document to start chatting.
        </div>
      )}
    </div>
  );
};

export default DocumentChatPage;
```

### Step 4: Basic Styling (CSS)

```css
/* styles.css */
.document-chat-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.upload-section-wrapper {
  margin-bottom: 30px;
  padding: 20px;
  border: 2px dashed #ccc;
  border-radius: 8px;
  background-color: #f9f9f9;
}

.file-upload-container {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.file-input {
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  cursor: pointer;
}

.file-info {
  padding: 10px;
  background-color: #e8f4f8;
  border-radius: 4px;
}

.upload-button {
  padding: 12px 24px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.upload-button:hover:not(:disabled) {
  background-color: #45a049;
}

.upload-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.chat-section-wrapper {
  margin-top: 30px;
}

.file-info-banner {
  padding: 15px;
  background-color: #e3f2fd;
  border-left: 4px solid #2196f3;
  margin-bottom: 20px;
  border-radius: 4px;
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 600px;
  border: 1px solid #ddd;
  border-radius: 8px;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #f5f5f5;
}

.message {
  margin-bottom: 15px;
  display: flex;
}

.user-message {
  justify-content: flex-end;
}

.assistant-message {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 12px 16px;
  border-radius: 12px;
  word-wrap: break-word;
}

.user-message .message-content {
  background-color: #007bff;
  color: white;
}

.assistant-message .message-content {
  background-color: white;
  color: #333;
  border: 1px solid #ddd;
}

.input-container {
  display: flex;
  padding: 15px;
  background-color: white;
  border-top: 1px solid #ddd;
}

.message-input {
  flex: 1;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}

.send-button {
  margin-left: 10px;
  padding: 12px 24px;
  background-color: #007bff;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 16px;
}

.send-button:hover:not(:disabled) {
  background-color: #0056b3;
}

.send-button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

.error-message {
  color: #d32f2f;
  padding: 10px;
  background-color: #ffebee;
  border-radius: 4px;
}

.success-message {
  color: #2e7d32;
  padding: 10px;
  background-color: #e8f5e9;
  border-radius: 4px;
}

.info-message {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}
```

## Implementation Checklist

- [ ] Install axios: `npm install axios`
- [ ] Create FileUploadComponent with file validation
- [ ] Create ChatComponent with fileId support
- [ ] Create main page component combining both
- [ ] Add error handling for upload failures
- [ ] Add loading states for better UX
- [ ] Style components appropriately
- [ ] Test with different file types (PDF, DOCX, images)
- [ ] Test error scenarios (large files, wrong types)
- [ ] Ensure JWT token is properly stored and sent

## Key Features to Implement

1. **File Upload**

   - Drag & drop support (optional enhancement)
   - Progress indicator during upload
   - File type and size validation
   - Success/error feedback

2. **Chat Interface**

   - Message history display
   - Auto-scroll to latest message
   - Loading indicator while waiting for response
   - File context indicator (show when file is attached)

3. **User Experience**
   - Clear step-by-step flow (Upload → Chat)
   - Disable chat until file is uploaded
   - Show uploaded file name in chat
   - Handle session expiration gracefully

## Testing Scenarios

1. **Happy Path:**

   - Upload PDF → Get fileId → Start chat → Send message with fileId → Receive response

2. **Error Cases:**

   - Upload file > 50MB → Show error
   - Upload unsupported file type → Show error
   - Upload without authentication → Handle 401
   - Send message without fileId → Should still work (normal chat)

3. **Edge Cases:**
   - Upload same file twice → Should work
   - Upload file, then upload different file → Replace fileId
   - Network error during upload → Show retry option

## Notes

- The `fileId` from upload response should be stored and passed to all subsequent chat messages
- If user uploads a new file, replace the old `fileId` with the new one
- The backend automatically includes file analysis instructions when `fileId` is provided
- File cleanup happens automatically on the backend (temp files are deleted after upload)
