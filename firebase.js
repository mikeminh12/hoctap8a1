// === Firebase Config ===
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-storage.js";

// Dán config thật của ông vào đây ↓↓↓
const firebaseConfig = {
  apiKey: "AIzaSyD6Cpm3yF8vsXDDoN3wDzmMxX1tCyADBpg",
  authDomain: "hoctap8a1.firebaseapp.com",
  projectId: "hoctap8a1",
  storageBucket: "hoctap8a1.firebasestorage.app",
  messagingSenderId: "489156845191",
  appId: "1:489156845191:web:f26c6734544b9d799ba222"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { app, auth, db, storage };
