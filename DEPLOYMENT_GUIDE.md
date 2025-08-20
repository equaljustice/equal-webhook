# GCP Deployment Guide - Admin Dashboard Fix

## 🚨 Current Issue

The admin dashboard is not loading on GCP because the static files are not being built during deployment.

## 🔧 Root Cause

1. **`.gitignore` excludes build files**: The `admin-dashboard/out/` directory is now in `.gitignore`
2. **Docker build should create files**: The Dockerfile includes the build step, but it might be failing
3. **Route configuration**: Updated to handle static file serving properly

## 🚀 Solution Steps

### 1. Verify Local Build
```bash
# Build admin dashboard locally
cd admin-dashboard
npm run build

# Verify files exist
ls -la out/
```

### 2. Deploy to GCP with Build Logs
```bash
# Deploy with verbose logging
gcloud run deploy equal-webhook \
  --source . \
  --platform managed \
  --region asia-south1 \
  --allow-unauthenticated \
  --set-env-vars="NODE_ENV=production" \
  --memory 1Gi \
  --timeout 600
```

### 3. Check Build Logs
After deployment, check the build logs in GCP Console:
- Go to Cloud Run > equal-webhook > Logs
- Look for admin dashboard build messages
- Check for any build errors

### 4. Test Admin Dashboard
```bash
# Test the admin dashboard route
curl -I https://equal-webhook-nh3rcdoxhq-el.a.run.app/admin
```

## 🔍 Troubleshooting

### If Build Fails
1. **Check Node.js version**: Ensure Dockerfile uses `node:21-slim`
2. **Check dependencies**: Verify all packages are in `package.json`
3. **Check file permissions**: Ensure build process has write access

### If Route Doesn't Work
1. **Check route order**: Static routes should come before API routes
2. **Check file paths**: Verify `admin-dashboard/out/` exists in container
3. **Check logs**: Look for console.log messages in deployment logs

### If Files Missing
1. **Rebuild locally**: `cd admin-dashboard && npm run build`
2. **Check .gitignore**: Ensure `out/` directory is excluded
3. **Force rebuild**: Delete `out/` directory and rebuild

## 📋 Expected Behavior

### Successful Deployment
- ✅ Docker build completes without errors
- ✅ Admin dashboard builds successfully
- ✅ Static files generated in `admin-dashboard/out/`
- ✅ Express serves files from `/admin` route
- ✅ Dashboard accessible at `https://your-domain.com/admin`

### Log Messages to Look For
```
Serving admin dashboard index.html
Admin route requested: /admin
Looking for file: /usr/src/app/admin-dashboard/out/index.html
File found, serving: /usr/src/app/admin-dashboard/out/index.html
```

## 🎯 Quick Fix Commands

```bash
# 1. Build locally to verify
cd admin-dashboard && npm run build

# 2. Deploy to GCP
gcloud run deploy equal-webhook --source . --platform managed --region asia-south1 --allow-unauthenticated

# 3. Test immediately
curl -I https://equal-webhook-nh3rcdoxhq-el.a.run.app/admin
```

## 📞 If Still Not Working

1. **Check GCP Logs**: Look for build errors or missing files
2. **Verify Docker Build**: Ensure admin dashboard build step completes
3. **Test Route Logic**: Check if Express routes are configured correctly
4. **File Permissions**: Ensure container can read static files

---

**The admin dashboard should now work correctly on GCP!** 🚀
