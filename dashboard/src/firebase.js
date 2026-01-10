import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/database'; 

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

const app = !firebase.apps.length 
  ? firebase.initializeApp(firebaseConfig) 
  : firebase.app();

export const auth = app.auth();         
export const database = app.database();

// Create and configure the provider
export const googleProvider = new firebase.auth.GoogleAuthProvider();

// IMPORTANT: This scope allows the app to add events to the user's calendar
googleProvider.addScope('https://www.googleapis.com/auth/calendar.events');

export const signInWithGoogle = async () => {
  try {
    // This will now trigger a popup that includes the Calendar permission request
    await auth.signInWithPopup(googleProvider);
  } catch (error) {
    console.error("Error signing in", error);
  }
};

export const logout = async () => {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error signing out", error);
  }
};