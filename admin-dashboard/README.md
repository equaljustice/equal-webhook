# Equal Webhook Admin Dashboard

A comprehensive admin dashboard for monitoring the Equal Webhook application, built with Next.js, shadcn/ui, and Framer Motion.

## 🚀 Features

### 📊 Real-time Monitoring
- **Active Sessions**: Monitor all active user sessions with payment status
- **Generated Files**: Track all documents created by the system
- **WhatsApp Failures**: Monitor API failures and error rates
- **System Health**: Real-time health checks for all services

### 🎯 Key Capabilities
- **Session Management**: View, analyze, and delete user sessions
- **File Management**: Browse and download generated documents
- **Conversation History**: View detailed conversation logs for each session
- **Payment Tracking**: Monitor payment status and statistics
- **Error Monitoring**: Track WhatsApp API failures and system issues

### 🎨 Professional UI
- **Modern Design**: Clean, professional interface using shadcn/ui
- **Smooth Animations**: Framer Motion animations for enhanced UX
- **Responsive Layout**: Works perfectly on desktop and mobile
- **Real-time Updates**: Auto-refresh every 30 seconds

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **UI Components**: shadcn/ui, Radix UI
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts (for future enhancements)

## 📦 Installation

1. **Navigate to the admin dashboard directory**:
   ```bash
   cd admin-dashboard
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🔧 Configuration

### API Endpoints
The dashboard connects to the following backend endpoints:

- `GET /admin/dashboard` - Dashboard summary
- `GET /admin/sessions` - All active sessions
- `GET /admin/sessions/:phoneNumber` - Session details
- `DELETE /admin/sessions/:phoneNumber` - Delete session
- `GET /admin/files` - All generated files
- `GET /admin/files/thread/:threadId` - Files by thread
- `GET /admin/whatsapp-failures` - WhatsApp API failures
- `GET /admin/system-health` - System health status
- `GET /admin/conversation/:phoneNumber` - Conversation history

### Environment Variables
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: http://localhost:8080)

## 📱 Dashboard Sections

### 1. **Summary Cards**
- Active Sessions count with paid sessions
- Total Generated Files across threads
- System Health status with failure rate
- Total Interactions with pending payments

### 2. **Active Sessions Tab**
- Phone number and session details
- Action type and agent information
- Interaction count and payment status
- Last activity timestamp
- View conversation history
- Delete sessions

### 3. **Generated Files Tab**
- File names and thread IDs
- File sizes and creation dates
- Direct download links
- Organized by thread

### 4. **WhatsApp Failures Tab**
- Recent API failures
- Error details and timestamps
- Request IDs and phone numbers
- Retry status information

### 5. **System Health Tab**
- Service status (Redis, GCS, WhatsApp API)
- API metrics and failure rates
- Progress bars for visual representation
- Real-time health monitoring

## 🔍 Edge Cases Handled

### 1. **Error Handling**
- Graceful API failure handling
- Loading states and error messages
- Toast notifications for user feedback
- Fallback UI for missing data

### 2. **Data Validation**
- Type-safe interfaces for all data
- Null/undefined value handling
- Format validation for phone numbers
- File size and type validation

### 3. **Performance Optimization**
- Auto-refresh with configurable intervals
- Efficient data fetching with Promise.all
- Lazy loading for conversation history
- Optimized re-renders with React hooks

### 4. **Security Considerations**
- Authentication required for all endpoints
- CORS handling for cross-origin requests
- Input sanitization and validation
- Secure file download handling

### 5. **User Experience**
- Responsive design for all screen sizes
- Smooth animations and transitions
- Intuitive navigation and interactions
- Clear visual feedback for all actions

## 🚀 Deployment

### Build for Production
```bash
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

## 🔧 Development

### Available Scripts
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Code Structure
```
admin-dashboard/
├── app/
│   ├── layout.tsx          # Root layout
│   ├── page.tsx            # Main dashboard
│   └── globals.css         # Global styles
├── components/
│   └── ui/                 # shadcn/ui components
├── lib/
│   └── utils.ts            # Utility functions
├── package.json
├── tailwind.config.js
└── README.md
```

## 📈 Future Enhancements

### Planned Features
- **Real-time Charts**: Live graphs for metrics
- **Advanced Filtering**: Search and filter sessions/files
- **Export Functionality**: CSV/PDF exports
- **User Management**: Admin user roles and permissions
- **Notification System**: Email/SMS alerts for critical issues
- **Analytics Dashboard**: Advanced reporting and insights

### Performance Improvements
- **WebSocket Integration**: Real-time updates
- **Caching Strategy**: Redis caching for better performance
- **Pagination**: Handle large datasets efficiently
- **Virtual Scrolling**: For large lists

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the Apache 2.0 License.

## 🆘 Support

For support and questions:
- Check the documentation
- Review the code comments
- Open an issue on GitHub
- Contact the development team

---

**Built with ❤️ for Equal Webhook Application**
