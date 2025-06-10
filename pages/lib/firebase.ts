// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBENQA78R3HF1GgOrQ7j7PdB-oaVh32ra8",
  authDomain: "webdh-730dc.firebaseapp.com",
  projectId: "webdh-730dc",
  storageBucket: "webdh-730dc.firebasestorage.app",
  messagingSenderId: "906410641968",
  appId: "1:906410641968:web:066a8eb792880cbc75fbf5",
  measurementId: "G-76LPXYJHMF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);