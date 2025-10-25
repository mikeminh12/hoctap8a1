import { auth } from './firebase.js';
import { onAuthStateChanged, signOut } 
  from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

const userInfo = document.getElementById("user-info");

onAuthStateChanged(auth, (user) => {
  if (user) {
    userInfo.innerHTML = `
      <span>Xin chào, <b>${user.displayName || user.email.split("@")[0]}</b></span>

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
