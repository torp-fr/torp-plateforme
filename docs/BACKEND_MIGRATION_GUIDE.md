# Backend Migration Guide: Mock → Supabase

This guide explains how to migrate from mock services to real Supabase backend.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Supabase Project](#step-1-create-supabase-project)
4. [Step 2: Apply Database Schema](#step-2-apply-database-schema)
5. [Step 3: Configure Authentication](#step-3-configure-authentication)
6. [Step 4: Setup Storage](#step-4-setup-storage)
7. [Step 5: Update Environment Variables](#step-5-update-environment-variables)
8. [Step 6: Test the Migration](#step-6-test-the-migration)
9. [Step 7: Deploy to Production](#step-7-deploy-to-production)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The TORP application currently uses mock services for development. This guide will help you migrate to real Supabase backend services.

**What's been prepared:**
- ✅ Supabase client configuration (`src/lib/supabase.ts`)
- ✅ TypeScript types for database (`src/types/supabase.ts`)
- ✅ Complete database schema (`supabase/migrations/001_initial_schema.sql`)
- ✅ Real service implementations:
  - `SupabaseAuthService` - Authentication
  - `SupabaseDevisService` - Devis management
  - `SupabaseProjectService` - Project management
- ✅ Service factory for automatic switching (`src/services/api/index.ts`)

**What you need to do:**
1. Create Supabase project
2. Apply database schema
3. Configure authentication and storage
4. Update environment variables

---

## Prerequisites

- Node.js 18+ installed
- npm or yarn
- A Supabase account (free tier works)
- Basic SQL knowledge (helpful but not required)

---

## Step 1: Create Supabase Project

1. **Go to Supabase Dashboard**
   - Visit https://supabase.com
   - Sign up or log in
   - Click "New Project"

2. **Create Project**
   ```
   Organization: Choose or create one
   Name: torp-production (or your preferred name)
   Database Password: [Generate a strong password and save it securely]
   Region: Choose closest to your users (e.g., eu-west-1 for Europe)
   Pricing Plan: Free (can upgrade later)
   ```

3. **Wait for Project Setup** (takes ~2 minutes)

4. **Get Your Credentials**
   - Go to Settings → API
   - Copy:
     - **Project URL**: `https://xxxxxxxxxxxxx.supabase.co`
     - **anon/public key**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

   ⚠️ **Save these securely** - you'll need them for environment variables!

---

## Step 2: Apply Database Schema

1. **Open SQL Editor**
   - In Supabase Dashboard, go to SQL Editor
   - Click "New Query"

2. **Copy Migration SQL**
   - Open `supabase/migrations/001_initial_schema.sql`
   - Copy the entire file content

3. **Run Migration**
   - Paste the SQL into the Supabase SQL Editor
   - Click "Run" (bottom right)
   - Wait for success message: "Success. No rows returned"

4. **Verify Tables Created**
   - Go to Table Editor
   - You should see 8 tables:
     - ✅ users
     - ✅ companies
     - ✅ projects
     - ✅ devis
     - ✅ payments
     - ✅ notifications
     - ✅ market_data
     - ✅ activity_logs

5. **Check Functions**
   - Go to Database → Functions
   - You should see:
     - `calculate_torp_score`
     - `assign_grade`

---

## Step 3: Configure Authentication

1. **Enable Email Provider**
   - Go to Authentication → Providers
   - Enable "Email" provider
   - Configuration:
     - ✅ Enable email provider
     - ✅ Confirm email: Enabled (recommended)
     - Email templates: Customize if desired

2. **Configure Email Templates** (Optional but recommended)
   - Go to Authentication → Email Templates
   - Customize:
     - Confirm signup
     - Magic link
     - Reset password

3. **Set Site URL** (Important for production)
   - Go to Authentication → URL Configuration
   - Site URL: `https://your-domain.com` (for production)
   - Redirect URLs: Add allowed redirect URLs

4. **OAuth Providers** (Optional - can add later)
   - Go to Authentication → Providers
   - Enable providers you want:
     - Google (recommended for B2C)
     - GitHub
     - Others as needed

---

## Step 4: Setup Storage

1. **Create Storage Buckets**
   - Go to Storage
   - Create new bucket:
     ```
     Name: devis-uploads
     Public: No (private)
     File size limit: 10MB
     Allowed MIME types: application/pdf, image/jpeg, image/png, application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document
     ```

2. **Create Additional Buckets** (Optional)
   - `company-documents` - For company verification docs
   - `avatars` - For user profile pictures

3. **Set Storage Policies**

   For `devis-uploads` bucket, add these policies:

   **Policy 1: Users can upload to their own folder**
   ```sql
   CREATE POLICY "Users can upload devis"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (
     bucket_id = 'devis-uploads' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   **Policy 2: Users can view their own files**
   ```sql
   CREATE POLICY "Users can view own devis"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (
     bucket_id = 'devis-uploads' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

   **Policy 3: Users can delete their own files**
   ```sql
   CREATE POLICY "Users can delete own devis"
   ON storage.objects FOR DELETE
   TO authenticated
   USING (
     bucket_id = 'devis-uploads' AND
     auth.uid()::text = (storage.foldername(name))[1]
   );
   ```

---

## Step 5: Update Environment Variables

### Local Development

1. **Create `.env.local`** (or update existing `.env`)
   ```bash
   # Copy from .env.example
   cp .env.example .env.local
   ```

2. **Update with Supabase credentials**
   ```bash
   # Authentication - SWITCH TO SUPABASE
   VITE_AUTH_PROVIDER=supabase

   # Supabase Configuration - ADD YOUR CREDENTIALS
   VITE_SUPABASE_URL=https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx

   # Disable mock API
   VITE_MOCK_API=false
   ```

3. **Restart dev server**
   ```bash
   npm run dev
   ```

### Vercel Production

1. **Go to Vercel Dashboard**
   - Open your project: https://vercel.com/your-project
   - Go to Settings → Environment Variables

2. **Add Environment Variables**
   ```
   VITE_AUTH_PROVIDER = supabase
   VITE_SUPABASE_URL = https://xxxxxxxxxxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxx
   VITE_MOCK_API = false
   VITE_APP_ENV = production
   VITE_DEBUG_MODE = false
   ```

3. **Redeploy**
   - Trigger a new deployment (or it will auto-deploy on next commit)

---

## Step 6: Test the Migration

### Test Authentication

1. **Register a new user**
   ```bash
   # Start dev server
   npm run dev

   # Navigate to http://localhost:5173/register
   # Fill out the form and submit
   ```

2. **Check Supabase**
   - Go to Authentication → Users
   - You should see the new user
   - Go to Table Editor → users
   - You should see the user profile

3. **Test Login**
   - Log out
   - Log in with the credentials
   - Should work without errors

### Test Project Creation

1. **Create a project**
   ```bash
   # Navigate to /projects or /analyze
   # Create a new project
   ```

2. **Verify in Supabase**
   - Go to Table Editor → projects
   - You should see the new project

### Test Devis Upload

1. **Upload a devis file**
   ```bash
   # Navigate to a project
   # Upload a PDF or image file
   ```

2. **Verify in Supabase**
   - Go to Storage → devis-uploads
   - You should see the uploaded file
   - Go to Table Editor → devis
   - You should see the devis record

### Check Service Status

1. **Open browser console**
   ```javascript
   // If VITE_DEBUG_MODE=true, you should see:
   [Services] Configuration: {
     mode: 'real',
     authProvider: 'supabase',
     services: {
       auth: 'SupabaseAuthService',
       devis: 'SupabaseDevisService',
       project: 'SupabaseProjectService'
     }
   }
   ```

---

## Step 7: Deploy to Production

1. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: Enable Supabase backend services"
   git push origin main
   ```

2. **Verify Vercel Deployment**
   - Check build logs
   - Test authentication on production
   - Test file uploads

3. **Enable Features Gradually**
   - Start with authentication only
   - Then enable project management
   - Then enable devis uploads
   - Monitor for errors in Supabase logs

---

## Troubleshooting

### Issue: "Invalid API key" error

**Cause:** Wrong Supabase credentials

**Fix:**
1. Double-check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
2. Make sure you copied the "anon/public" key, not the service_role key
3. Restart dev server after changing .env

### Issue: "Row Level Security policy violation"

**Cause:** RLS policies not allowing the operation

**Fix:**
1. Check the SQL migration was fully executed
2. Go to Table Editor → Select table → Policies tab
3. Verify policies exist and are enabled
4. Test the policy in SQL Editor:
   ```sql
   SELECT auth.uid(); -- Should return your user ID when logged in
   ```

### Issue: "Storage bucket not found"

**Cause:** Storage bucket not created or wrong name

**Fix:**
1. Go to Storage in Supabase
2. Create bucket named exactly `devis-uploads`
3. Make sure it's private (not public)

### Issue: "Authentication session not found"

**Cause:** Session expired or not persisted

**Fix:**
1. Check localStorage in browser dev tools
2. Should have `supabase.auth.token` key
3. Try logout and login again
4. Check Supabase Auth logs for errors

### Issue: File uploads failing

**Cause:** Storage policies or bucket configuration

**Fix:**
1. Check Storage policies are created (Step 4)
2. Verify file size is under 10MB
3. Check file type is allowed
4. Check browser console for specific error

### Issue: "Services still using mock"

**Cause:** Environment variables not loaded

**Fix:**
1. Verify `.env.local` exists and has correct values
2. Restart dev server completely (Ctrl+C, then `npm run dev`)
3. Check browser console for service status log
4. Clear browser cache and localStorage

### Getting More Help

- **Supabase Docs**: https://supabase.com/docs
- **Supabase Discord**: https://discord.supabase.com
- **Project Issues**: Check `/docs/TROUBLESHOOTING.md`

---

## Next Steps After Migration

Once migration is complete:

1. **Phase 3: AI/LLM Integration**
   - Integrate OpenAI or Claude for real devis analysis
   - Implement TORP scoring algorithm
   - Add AI chat assistant

2. **Phase 4: Data & Scraping**
   - Populate market_data table with real pricing
   - Implement company data scraping
   - Set up SIRET verification

3. **Phase 5: Payments**
   - Integrate Stripe
   - Implement escrow system
   - Add payment stages

See `ROADMAP.md` for full roadmap.

---

## Rollback Plan

If you need to rollback to mock services:

1. **Update environment variables**
   ```bash
   VITE_AUTH_PROVIDER=mock
   VITE_MOCK_API=true
   ```

2. **Restart server**
   ```bash
   npm run dev
   ```

3. **Services will automatically switch back to mock mode**

The service factory (`src/services/api/index.ts`) handles the switching automatically based on environment variables.
