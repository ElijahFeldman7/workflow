import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
    apiKey: "AIzaSyDx-fMuFeUDFouz8xNerhhOUp8hRqr8RrE",
    authDomain: "workflow-4c891.firebaseapp.com",
    projectId: "workflow-4c891",
    storageBucket: "workflow-4c891.appspot.com",
    messagingSenderId: "813578513550",
    appId: "1:813578513550:web:73b745b07af8f3f98eeddf",
    measurementId: "G-06MRVL8L93",
    databaseURL: "https://workflow-4c891-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const database = getDatabase(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    try { await auth.currentUser.reload(); } catch (e) {}
    return result;
  } catch (error) {
    console.error("Error signing in", error);
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
  }
};