# Environment Variables Setup Guide

This guide will help you set up all required environment variables for the MultiDocUI project.

## Quick Start

1. Copy the `.env.example` file to create your own `.env` file:
   ```bash
   cp .env.example .env
   ```

2. Fill in your API keys in the `.env` file (see instructions below)

3. Restart the development server to load the new environment variables

## Required Environment Variables

### 1. Google Gemini AI API Key

**Variable:** `GEMINI_API_KEY`

**Purpose:** Used for AI-powered content generation (reports, presentations, papers)

**How to get it:**
1. Go to [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the key and paste it into your `.env` file

```env
GEMINI_API_KEY=your_actual_api_key_here
```

### 2. Pixabay API Key

**Variable:** `PIXABAY_API_KEY`

**Purpose:** Used to fetch royalty-free images for presentations and documents

**How to get it:**
1. Go to [Pixabay API Documentation](https://pixabay.com/api/docs/)
2. Sign up for a free Pixabay account
3. Navigate to the API section to get your API key
4. Copy the key and paste it into your `.env` file

```env
PIXABAY_API_KEY=your_actual_api_key_here
```

### 3. Firebase Configuration

**Variables:**
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_APP_ID`

**Purpose:** Used for user authentication and project storage

**How to get it:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select an existing one
3. Go to Project Settings (gear icon) → General
4. Scroll down to "Your apps" section
5. Click "Add app" and select Web (</>) if you haven't already
6. Copy the config values:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
```

**Note:** Firebase variables must be prefixed with `VITE_` to be accessible in the client-side code.

### 4. Database URL (Optional)

**Variable:** `DATABASE_URL`

**Purpose:** Required only if you want to enable Stripe payment integration

**Format:**
```env
DATABASE_URL=postgresql://user:password@host:port/database
```

This is optional for basic functionality.

## Configuration Variables

### NODE_ENV

**Variable:** `NODE_ENV`

**Purpose:** Specifies the environment (development/production)

**Default:** `development`

```env
NODE_ENV=development
```

### PORT

**Variable:** `PORT`

**Purpose:** Specifies the port number for the server

**Default:** `5000`

```env
PORT=5000
```

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already listed in `.gitignore`
- Keep your API keys secret and don't share them publicly
- Rotate your keys periodically for better security
- Use different keys for development and production environments

## Troubleshooting

### Application not loading environment variables

1. Make sure your `.env` file is in the root directory of the project
2. Restart the development server after making changes to `.env`
3. Check that there are no syntax errors in your `.env` file
4. Ensure variable names match exactly (case-sensitive)

### Firebase errors

- Make sure all three Firebase variables are set correctly
- Verify that Firebase Authentication is enabled in your Firebase Console
- Check that Firestore Database is created and configured

### AI generation not working

- Verify your `GEMINI_API_KEY` is valid and active
- Check the Google AI Studio dashboard for any usage limits or quota issues
- Ensure you have an active internet connection

### Images not loading in presentations

- Verify your `PIXABAY_API_KEY` is valid
- Check that you haven't exceeded Pixabay's rate limits (5,000 requests/hour for free tier)

## Need Help?

If you encounter any issues with environment setup, please check:
1. This guide for correct configuration
2. The `.env.example` file for reference
3. Console logs for specific error messages
