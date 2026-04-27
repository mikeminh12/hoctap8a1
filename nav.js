import { auth, onAuthStateChanged, signOut, db, doc, getDoc } from './firebase.js';

// Đường dẫn đến hình ảnh avatar mặc định bạn cung cấp
const DEFAULT_AVATAR_PATH = 'non.png';

const userSection = document.getElementById("user-section");

onAuthStateChanged(auth, async (user) => {
  if (user) {
    // Nếu đã đăng nhập → avatar + dropdown
    const avatarSrc = user.photoURL || DEFAULT_AVATAR_PATH;
    
    // Lấy tên người dùng. Ưu tiên displayName, sau đó là phần trước @ của email, cuối cùng là 'bạn'.
    const userName = user.displayName || (user.email ? user.email.split('@')[0] : 'bạn');

    userSection.innerHTML = `
      <div class="user-menu-container">
        <span class="welcome-text">Xin chào, ${userName}</span>
        <img id="avatar" src="${avatarSrc}" alt="Ảnh đại diện người dùng" class="avatar">
        <div class="user-dropdown" id="user-dropdown">
          <a href="account.html">Tài khoản</a>
          <a href="#" id="logout-btn">Đăng xuất</a>
          <a href="admin.html" id="admin-panel" class="hidden">Admin Panel</a>
        </div>
      </div>
    `;

    const avatarEl = document.getElementById("avatar");
    const userDropdown = document.getElementById("user-dropdown");
    const logoutBtn = document.getElementById("logout-btn");
    const adminPanel = document.getElementById("admin-panel");

    // Click để toggl (ẩn/hiện) dropdown
    avatarEl.addEventListener("click", (e) => { // <-- Thêm đối số e
        e.stopPropagation(); // <-- FIX: Ngăn click lan ra document
        userDropdown.classList.toggle("active");
    });
    
    // Tự động đóng dropdown khi click ra ngoài
    document.addEventListener('click', function(event) {
        // Chỉ đóng nếu click bên ngoài userSection VÀ dropdown đang mở
        if (!userSection.contains(event.target) && userDropdown.classList.contains('active')) {
            userDropdown.classList.remove('active');
        }
    });


    // Kiểm tra admin từ Firestore
    const uid = user.uid;
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    if (data.role === "admin") {
      // Nếu là admin, gỡ class "hidden" để hiển thị
      adminPanel.classList.remove("hidden");
    } else {
      // Nếu không phải admin, đảm bảo class "hidden" được thêm vào
      adminPanel.classList.add("hidden"); 
    }

    // Logout
    logoutBtn.onclick = async () => {
      await signOut(auth);
      localStorage.clear();
      window.location.href = "index.html";
    };

  } else {
    // Nếu chưa đăng nhập → hiển thị nút đăng nhập / đăng ký
    userSection.innerHTML = `
      <button class="btn btn-login" id="login-btn">Đăng nhập</button>
      <button class="btn btn-register" id="register-btn">Đăng ký</button>
    `;

    document.getElementById("login-btn").onclick = () => location.href = "login.html";
    document.getElementById("register-btn").onclick = () => location.href = "login.html";
  }
});

// --- Theme toggle ---
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeLink = document.getElementById("theme-style"); 

let currentTheme = localStorage.getItem("theme") || "light";
themeLink.href = currentTheme === "dark" ? "dark.css" : "style.css";
themeToggleBtn.textContent = currentTheme === "dark" ? "☀️" : "🌙";

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
  localStorage.setItem("theme", currentTheme);
});
