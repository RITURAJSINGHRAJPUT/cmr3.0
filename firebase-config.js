// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-database.js";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAyV1sE5BIxOJU5qvAbZQgj2CVT4CSpSvE",
    authDomain: "dht11-477bb.firebaseapp.com",
    projectId: "dht11-477bb",
    storageBucket: "dht11-477bb.firebasestorage.app",
    messagingSenderId: "450274295898",
    appId: "1:450274295898:web:361522b4cb96f0b3939863"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const rtdb = getDatabase(app); // Keeping RTDB for sensor config/live defaults if needed

export { app, db, rtdb };