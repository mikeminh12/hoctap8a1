// nav.js
// ✅ Chỉ import các đối tượng và hàm đã được export từ file cục bộ
import { auth, onAuthStateChanged, signOut } from './firebase.js';

const userInfo = document.getElementById("user-info");

onAuthStateChanged(auth, (user) => {
    if (user) {
        // Tên hiển thị ưu tiên, nếu không có thì dùng phần trước @ của email
        const userName = user.displayName || (user.email ? user.email.split("@")[0] : 'Người dùng');
        
        userInfo.innerHTML = `
            <span>Xin chào, <b>${userName}</b></span>

            <button id="logout-btn">Đăng xuất</button>
        `;
        document.getElementById("logout-btn").onclick = async () => {
            await signOut(auth);
            localStorage.clear();
            window.location.href = "index.html";
        };
    } else {
        userInfo.innerHTML = `
            <button id="login-btn">Đăng nhập</button>
            <button id="register-btn">Đăng ký</button>
        `;
        document.getElementById("login-btn").onclick = () => location.href = "login.html";
        document.getElementById("register-btn").onclick = () => location.href = "login.html";
    }
});