# Admin Dashboard Setup with Docker

## 🚀 Quick Setup

The admin dashboard is now **automatically built** when you deploy with Docker. No manual build step required!

### 1. Run with Docker (includes dashboard build)
```bash
docker-compose up --build
```

### 2. Access the Dashboard
- **Backend API**: http://localhost:8080
- **Admin Dashboard**: http://localhost:8080/admin

## 📁 File Structure
```
equal-webhook/
├── admin/                    # Backend API endpoints
│   └── adminAPI.js
├── admin-dashboard/          # Frontend dashboard
│   ├── app/
│   ├── components/
│   ├── out/                  # Built static files (auto-generated)
│   └── package.json
├── routes.js                 # Updated with admin routes
├── Dockerfile               # Updated with dashboard build
└── docker-compose.yml       # Updated port mapping
```

## 🔧 How It Works

1. **Automatic Build**: Dockerfile automatically builds the dashboard
2. **Static Files**: Next.js dashboard built as static files in `admin-dashboard/out/`
3. **Express Serving**: Your existing Express app serves the dashboard at `/admin`
4. **API Integration**: Dashboard calls your backend API endpoints
5. **Single Container**: Everything runs in one Docker container
6. **Auto URL Detection**: Dashboard automatically detects its base URL from browser window

## 🎯 Features Available

- **Session Monitoring**: View all active sessions
- **File Management**: Browse generated documents
- **WhatsApp Failures**: Track API errors
- **System Health**: Monitor service status
- **Real-time Updates**: Auto-refresh every 30 seconds
- **Zero Configuration**: Works automatically on any domain

## 🚀 GCP Deployment

The admin dashboard is now **automatically included** in your GCP deployment:

1. **Build and Deploy** as usual with your existing GCP setup
2. **Dashboard Available** at `https://your-gcp-domain.com/admin`
3. **No Additional Steps** required
4. **No Environment Variables** needed for base URL

### Automatic Base URL Detection
The dashboard automatically detects its base URL:
```javascript
// Automatically works on any domain
const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
```

## 🔄 Development Workflow

### Local Development
1. **Make changes** to dashboard code in `admin-dashboard/`
2. **Rebuild** Docker: `docker-compose up --build`
3. **Test** at http://localhost:8080/admin

### Production Deployment
1. **Push code** to your repository
2. **Deploy** to GCP (dashboard builds automatically)
3. **Access** at `https://your-gcp-domain.com/admin`

## 🐛 Troubleshooting

### Dashboard not loading?
- Check if build was successful: `ls admin-dashboard/out/`
- Rebuild Docker: `docker-compose up --build`
- Check logs: `docker-compose logs`

### API calls failing?
- Verify backend is running: `curl http://localhost:8080/health/whatsapp`
- Check authentication is working
- Verify API endpoints are accessible

### Build errors in Docker?
- Check Node.js version in Dockerfile (21-slim)
- Verify all dependencies are in package.json
- Check for missing files in admin-dashboard/

## 📊 Dashboard Capabilities

As an application owner, you can now:
- Monitor real-time user sessions
- Track document generation
- Identify WhatsApp API issues
- Manage user sessions
- Analyze system performance
- View conversation histories

## 🔧 Docker Build Process

The Dockerfile now includes:
```dockerfile
# Build the admin dashboard
RUN cd admin-dashboard && \
    npm ci && \
    npm run build
```

This ensures:
- ✅ Dashboard is always built in production
- ✅ No manual build steps required
- ✅ Consistent deployment across environments
- ✅ Works seamlessly with GCP Cloud Run
- ✅ Automatic base URL detection for any domain

---

**Your admin dashboard is now fully integrated with Docker and ready for GCP deployment!**
