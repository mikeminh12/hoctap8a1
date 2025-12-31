// === Firebase Config ===
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, signInAnonymously, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore, setLogLevel, collection, onSnapshot, setDoc, doc, getDoc, updateDoc, deleteDoc, query, getDocs, where } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// 🚀 QUAN TRỌNG: Thêm import này để dùng Realtime Database
import { getDatabase, ref, set, onValue, onDisconnect } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyD6Cpm3yF8vsXDDoN3wDzmMxX1tCyADBpg",
    authDomain: "hoctap8a1.firebaseapp.com",
    projectId: "hoctap8a1",
    storageBucket: "hoctap8a1.firebasestorage.app",
    messagingSenderId: "489156845191",
    appId: "1:489156845191:web:f26c6734544b9d799ba222",
    databaseURL: "https://hoctap8a1-default-rtdb.asia-southeast1.firebasedatabase.app"
};

let app;
if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
    console.log("Firebase App [DEFAULT] initialized.");
} else {
    app = getApp();
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// 🚀 Khởi tạo Realtime Database
const rtdb = getDatabase(app);

export { 
    app, 
    auth, 
    db, 
    storage, 
    rtdb, // ✅ Phải export rtdb ở đây
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
    deleteDoc,
    query, 
    getDocs, 
    where,
    // Export các hàm database để file viewer dùng được luôn
    ref, set, onValue, onDisconnect 
};