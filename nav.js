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
// --- Chuyển theme ---
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeLink = document.getElementById("theme-style");

// Lấy theme đang lưu trong localStorage (nếu có)
let currentTheme = localStorage.getItem("theme") || "light";

// Gán lại CSS tương ứng khi load
themeLink.href = currentTheme === "dark" ? "dark.css" : "style.css";
themeToggleBtn.textContent = currentTheme === "dark" ? "☀️" : "🌙";

// Khi bấm nút thì đổi theme
themeToggleBtn.addEventListener("click", () => {
  if (currentTheme === "light") {
    themeLink.href = "dark.css";
    themeToggleBtn.textContent = "☀️";
    currentTheme = "dark";
  } else {
    themeLink.href = "style.css";
    themeToggleBtn.textContent = "🌙";
    currentTheme = "light";
  }

  // Lưu lại để lần sau vẫn giữ theme cũ
  localStorage.setItem("theme", currentTheme);
});
