// firebase.js
// === Firebase Config ===
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, setLogLevel, collection, onSnapshot, setDoc, doc, getDoc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// ⚠️ Dán config thật của bạn vào đây ↓↓↓
const firebaseConfig = {
    apiKey: "AIzaSyD6Cpm3yF8vsXDDoN3wDzmMxX1tCyADBpg",
    authDomain: "hoctap8a1.firebaseapp.com",
    projectId: "hoctap8a1",
    storageBucket: "hoctap8a1.firebasestorage.app",
    messagingSenderId: "489156845191",
    appId: "1:489156845191:web:f26c6734544b9d799ba222"
};

let app;

// Khởi tạo có điều kiện để tránh lỗi duplicate-app
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App [DEFAULT] initialized successfully in firebase.js.");
} else {
    app = getApp();
    console.log("Firebase App [DEFAULT] reused from existing instance.");
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// ✅ Export tất cả những gì các file khác cần
export { 
    app, 
    auth, 
    db, 
    storage, 
    onAuthStateChanged, 
    signOut,
    signInAnonymously, 
    signInWithCustomToken,
    setLogLevel,
    collection, 
    onSnapshot, 
    setDoc, 
    doc, 
    getDoc, 
    updateDoc,
    deleteDoc
};