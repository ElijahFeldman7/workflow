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
export const googleProvider = new firebase.auth.GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
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