import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged, User } from "firebase/auth";
import { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, where, orderBy, Timestamp, updateDoc, setDoc } from "firebase/firestore";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import type { Document as AppDocument } from "@shared/schema";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app: ReturnType<typeof initializeApp> | null = null;
let auth: ReturnType<typeof getAuth> | null = null;
let db: ReturnType<typeof getFirestore> | null = null;
let storage: ReturnType<typeof getStorage> | null = null;

export function initializeFirebase() {
  if (!app && firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
  }
  return { app, auth, db, storage };
}

export function getFirebaseAuth() {
  if (!auth) {
    initializeFirebase();
  }
  return auth;
}

export function getFirebaseDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

export function getFirebaseStorage() {
  if (!storage) {
    initializeFirebase();
  }
  return storage;
}

export async function signInWithGoogle() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase not initialized");
  
  const provider = new GoogleAuthProvider();
  const result = await signInWithPopup(auth, provider);
  return result.user;
}

export async function signInWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase not initialized");
  
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signUpWithEmail(email: string, password: string) {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase not initialized");
  
  const result = await createUserWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function signOut() {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase not initialized");
  
  await firebaseSignOut(auth);
}

export function onAuthChange(callback: (user: User | null) => void) {
  const auth = getFirebaseAuth();
  if (!auth) return () => {};
  
  return onAuthStateChanged(auth, callback);
}

export async function saveProject(project: Omit<AppDocument, "id">) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase not initialized");
  
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new Error("User not authenticated");
  
  const docRef = await addDoc(collection(db, "projects"), {
    ...project,
    userId: auth.currentUser.uid,
    createdAt: Timestamp.now().toMillis().toString(),
    updatedAt: Timestamp.now().toMillis().toString(),
  });
  
  return docRef.id;
}

export async function getProjects(): Promise<AppDocument[]> {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase not initialized");
  
  const auth = getFirebaseAuth();
  if (!auth?.currentUser) throw new Error("User not authenticated");
  
  const q = query(
    collection(db, "projects"),
    where("userId", "==", auth.currentUser.uid),
    orderBy("createdAt", "desc")
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
  })) as AppDocument[];
}

export async function deleteProject(projectId: string) {
  const db = getFirebaseDb();
  if (!db) throw new Error("Firebase not initialized");

  await deleteDoc(doc(db, "projects", projectId));
}

export async function saveImageMetadata(imageUrl: string, prompt: string, settings: any = {}): Promise<string> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();
  if (!db) throw new Error("Firebase not initialized");
  if (!auth?.currentUser) throw new Error("User not authenticated");

  // Save image metadata to Firestore (not uploading the actual file to avoid CORS issues)
  const docRef = await addDoc(collection(db, "images"), {
    userId: auth.currentUser.uid,
    imageUrl: imageUrl,
    prompt: prompt,
    settings: settings,
    createdAt: Timestamp.now().toMillis().toString(),
    updatedAt: Timestamp.now().toMillis().toString(),
  });

  return docRef.id;
}

export async function saveDocument(documentData: {
  type: string;
  title: string;
  topic: string;
  content: any;
  settings: any;
  language?: string;
}): Promise<string> {
  const db = getFirebaseDb();
  const auth = getFirebaseAuth();

  if (!db) throw new Error("Firebase not initialized");
  if (!auth?.currentUser) throw new Error("User not authenticated");

  // Check if a document with the same title and type already exists
  const docsRef = collection(db, "documents");
  const q = query(
    docsRef,
    where("userId", "==", auth.currentUser.uid),
    where("type", "==", documentData.type),
    where("title", "==", documentData.title)
  );

  const existingDocs = await getDocs(q);

  if (!existingDocs.empty) {
    // Update existing document
    const existingDocId = existingDocs.docs[0].id;
    const docRef = doc(db, "documents", existingDocId);
    await updateDoc(docRef, {
      topic: documentData.topic,
      content: documentData.content,
      settings: documentData.settings,
      language: documentData.language || "en",
      updatedAt: Timestamp.now().toMillis().toString(),
    });

    return existingDocId;
  }

  // Create new document if none exists
  const documentToSave = {
    userId: auth.currentUser.uid,
    type: documentData.type,
    title: documentData.title,
    topic: documentData.topic,
    content: documentData.content,
    settings: documentData.settings,
    language: documentData.language || "en",
    createdAt: Timestamp.now().toMillis().toString(),
    updatedAt: Timestamp.now().toMillis().toString(),
  };

  const docRef = await addDoc(collection(db, "documents"), documentToSave);
  return docRef.id;
}

// Export for backward compatibility
export const uploadImage = saveImageMetadata;

initializeFirebase();
