import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCwabw0ObyPYul9bewxt4jEhLeSrLQcG4g",
  authDomain: "gigamapping-c25aa.firebaseapp.com",
  projectId: "gigamapping-c25aa",
  storageBucket: "gigamapping-c25aa.firebasestorage.app",
  messagingSenderId: "952811953109",
  appId: "1:952811953109:web:6dc26164e31cf8e153bb5c",
  measurementId: "G-RV6YP9FSCL"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
