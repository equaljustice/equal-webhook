# GCP Deployment with Admin Dashboard

## 🚀 Automatic Deployment

Your admin dashboard is now **automatically included** in your GCP deployment. No additional steps required!

## 📋 What's Included

### Docker Build Process
The Dockerfile now automatically:
1. ✅ Installs backend dependencies
2. ✅ Installs dashboard dependencies  
3. ✅ Builds the admin dashboard as static files
4. ✅ Serves both API and dashboard from the same container

### Access URLs
- **Backend API**: `https://your-gcp-domain.com`
- **Admin Dashboard**: `https://your-gcp-domain.com/admin`

## 🔧 Automatic Base URL Detection

The admin dashboard now **automatically detects** its base URL from the browser window:

```javascript
// Automatically detects: https://your-gcp-domain.com
const API_BASE = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080';
```

### Benefits:
- ✅ **No Environment Variables**: No need to set `NEXT_PUBLIC_API_URL`
- ✅ **Automatic Detection**: Works on any domain automatically
- ✅ **Production Ready**: Adapts to any deployment URL
- ✅ **Zero Configuration**: Works out of the box

## 🚀 Deployment Commands

### Deploy to GCP Cloud Run
```bash
# Build and deploy (dashboard builds automatically)
gcloud run deploy equal-webhook \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated
```

### Or use your existing deployment method
The dashboard will be automatically included in any Docker-based deployment.

## 📊 Dashboard Features in Production

Once deployed, you can:

### Monitor Real-time Activity
- **Active Sessions**: View all current user sessions
- **Payment Status**: Track successful/pending payments
- **Interaction Counts**: Monitor user engagement

### File Management
- **Generated Documents**: Browse all created files
- **Download Links**: Direct access to documents
- **Thread Organization**: Files grouped by conversation

### System Health
- **WhatsApp API**: Monitor failure rates and errors
- **Redis Status**: Check database connectivity
- **GCS Status**: Verify file storage health

### Error Tracking
- **API Failures**: View recent WhatsApp errors
- **Request IDs**: Track specific failure instances
- **Retry Status**: Monitor error recovery

## 🔍 Access Control

The admin dashboard requires authentication. Make sure your GCP deployment includes:
- JWT token validation
- Proper authentication middleware
- Secure session management

## 🐛 Troubleshooting

### Dashboard not loading?
1. Check if build was successful in Docker logs
2. Verify `/admin` route is accessible
3. Check authentication is working

### API calls failing?
1. Verify the dashboard is served from the same domain as your API
2. Check CORS settings
3. Ensure authentication tokens are valid

### Build errors in GCP?
1. Check Docker build logs
2. Verify all files are included in deployment
3. Ensure Node.js version compatibility

## 📈 Monitoring Benefits

With the admin dashboard in production, you can:

- **Real-time Monitoring**: See live user activity
- **Issue Detection**: Identify problems before users report them
- **Performance Tracking**: Monitor system health and API success rates
- **User Analytics**: Track session patterns and payment success
- **File Management**: Monitor document generation and downloads

## 🔄 Updates

To update the dashboard:
1. **Modify code** in `admin-dashboard/`
2. **Redeploy** to GCP (dashboard rebuilds automatically)
3. **No manual steps** required

---

**Your admin dashboard is now production-ready with automatic base URL detection!**
