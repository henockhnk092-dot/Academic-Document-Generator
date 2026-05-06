# Firebase Firestore Rules Deployment

## ⚠️ IMPORTANT: Deploy Firestore Rules

The Firestore security rules have been updated to include the `images` collection. You MUST deploy these rules to Firebase for the save functionality to work.

## Error You're Seeing
```
FirebaseError: Missing or insufficient permissions.
```

This error occurs because the Firestore rules haven't been deployed yet.

## How to Deploy

### Option 1: Using Firebase Console (Recommended for Quick Fix)

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project: **academic-document-generator**
3. Click on **Firestore Database** in the left sidebar
4. Click on the **Rules** tab
5. Copy the contents of `firestore.rules` file
6. Paste into the Firebase Console rules editor
7. Click **Publish**

### Option 2: Using Firebase CLI

1. Make sure Firebase CLI is installed:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase (if not already):
   ```bash
   firebase login
   ```

3. Initialize Firebase in your project (if not already):
   ```bash
   firebase init
   ```
   - Select **Firestore**
   - Use the existing `firestore.rules` file

4. Deploy the rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

## Current Rules (firestore.rules)

The rules now include:
- ✅ `projects` collection - for saved documents
- ✅ `documents` collection - for document metadata
- ✅ **`images` collection** - **NEW** - for saved images
- ✅ `users` collection - for user settings

All collections restrict read/write to authenticated users and their own data only.

## Backend 500 Errors

You're also seeing these errors:
```
GET http://localhost:5000/api/documents/user/demo-user 500 (Internal Server Error)
GET http://localhost:5000/api/projects/user/demo-user 500 (Internal Server Error)
```

These are separate backend issues. The database server may not be properly configured or the database connection is failing. Check:

1. Database connection in `server/storage.ts`
2. Server logs for detailed error messages
3. Environment variables for database credentials
