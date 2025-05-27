// src/firebase.ts
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔐 Reemplaza estos valores con los de tu proyecto en Firebase Console > Configuración > SDK de Firebase para Web
const firebaseConfig = {
    apiKey: "AIzaSyA1KlO_grfeN674afBo2WHh4tl5LFpg_Y0",
    authDomain: "gestionglobal-9eac8.firebaseapp.com",  
    projectId: "gestionglobal-9eac8",  
    storageBucket: "gestionglobal-9eac8.firebasestorage.app",  
    messagingSenderId: "163163368832",  
    appId: "1:163163368832:web:57e8b3ebb7811e07066565",  
    measurementId: "G-WZQ7TRGHM4"  
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app); 