// chat.js
// Nhóm 1: Import các đối tượng và hàm đã được export từ tệp firebase.js của bạn
import { db, collection, onSnapshot, query, orderBy, limit } from './firebase.js';

// Nhóm 2: Import các hàm Firestore cần thiết trực tiếp từ SDK
import { 
    serverTimestamp, 
    addDoc 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


const messagesContainer = document.getElementById('messages-container');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const loginAlert = document.getElementById('login-alert');
const pageTitle = document.querySelector('.container h2'); // Lấy tiêu đề trang

// Helper: Lấy thông tin người dùng đã đăng nhập
const getLoggedInUser = () => {
    const userString = localStorage.getItem("user");
    return userString ? JSON.parse(userString) : null;
};

// Helper: Lấy tham số DM từ URL
const urlParams = new URLSearchParams(window.location.search);
const dmId = urlParams.get('dm'); // Lấy ID phòng chat riêng (nếu có)

const currentUser = getLoggedInUser();

// --- XÁC ĐỊNH BỘ SƯU TẬP CHAT ---
let chatCollectionName = dmId ? `dms/${dmId}/messages` : "chats";

if (dmId) {
    // Nếu là chat riêng, cập nhật tiêu đề
    const users = dmId.split('_');
    const otherUser = users.find(u => u !== currentUser.username);
    if (pageTitle) {
        pageTitle.innerHTML = `🔒 Chat riêng với ${otherUser}`;
    }
}


// --- 1. Kiểm tra và xử lý trạng thái đăng nhập ---
if (!currentUser || !currentUser.username) {
    messagesContainer.innerHTML = '<p class="chat-warning">Bạn cần đăng nhập để xem lịch sử chat và gửi tin nhắn.</p>';
    messageForm.style.display = 'none';
    loginAlert.style.display = 'block';
} else {
    // Đã đăng nhập
    messageForm.style.display = 'flex';
    loginAlert.style.display = 'none';
    
    const messagesRef = collection(db, chatCollectionName);
    const q = query(messagesRef, orderBy("createdAt", "asc"), limit(50));

    // --- 2. Lắng nghe tin nhắn theo thời gian thực (Realtime Listener) ---
    const unsubscribe = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';
        
        snapshot.forEach(doc => {
            const msg = doc.data();
            const username = msg.username || 'Người dùng ẩn danh';
            const isMyMessage = username === currentUser.username;
            
            const timestamp = msg.createdAt ? new Date(msg.createdAt.toDate()) : new Date();
            const timeString = timestamp.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

            const messageElement = document.createElement('div');
            messageElement.classList.add('message');
            messageElement.classList.add(isMyMessage ? 'my-message' : 'other-message');

            messageElement.innerHTML = `
                <div class="message-content">
                    <span class="message-username">${isMyMessage ? 'Bạn' : username}</span>
                    <p>${msg.text}</p>
                    <span class="message-time">${timeString}</span>
                </div>
            `;
            messagesContainer.appendChild(messageElement);
        });

        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, (error) => {
        console.error("Lỗi khi tải tin nhắn: ", error);
        messagesContainer.innerHTML = '<p class="chat-error">Không thể tải tin nhắn. Vui lòng kiểm tra kết nối.</p>';
    });

    // --- 3. Xử lý gửi tin nhắn ---
    messageForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const text = messageInput.value.trim();
        if (text === "") return;
        
        const sendBtn = document.getElementById('send-btn');
        sendBtn.disabled = true;

        try {
            await addDoc(messagesRef, {
                username: currentUser.username,
                text: text,
                createdAt: serverTimestamp()
            });
            
            messageInput.value = '';
        } catch (e) {
            console.error("Lỗi khi gửi tin nhắn: ", e);
        } finally {
            sendBtn.disabled = false;
        }
    });
}