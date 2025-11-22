// friend.js

// Nhóm 1: Import các đối tượng và hàm đã được export từ tệp firebase.js của bạn
import { 
    db, 
    collection, 
    query, 
    where, 
    getDocs, 
    setDoc, 
    doc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot 
} from './firebase.js';

// Nhóm 2: Import serverTimestamp cho các giao dịch Firestore
import { 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";


// --- CÁC BIẾN VÀ HELPER ---

// Helper: Lấy thông tin người dùng đã đăng nhập từ Local Storage
const getLoggedInUser = () => {
    const userString = localStorage.getItem("user");
    return userString ? JSON.parse(userString) : null;
};

const currentUser = getLoggedInUser();
if (!currentUser) {
    alert("Vui lòng đăng nhập để xem danh sách bạn bè.");
    location.href = "login.html";
}

const currentUsername = currentUser.username;
const allUsersList = document.getElementById('all-users-list');
const friendsList = document.getElementById('friends-list');
const requestsList = document.getElementById('requests-list');
const userSearchInput = document.getElementById('user-search-input');

// Hàm tạo ID phòng chat DM (sắp xếp tên để đảm bảo ID duy nhất)
const getDMId = (user1, user2) => {
    return [user1, user2].sort().join('_');
}

// 💡 Lưu ý: Hàm showToast này nên được đặt trong tệp dùng chung như nav.js, nhưng tôi đặt ở đây để tiện sử dụng.
const showToast = (message, type = 'info') => {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('hide');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
}


// --- 1. HÀM RENDER (Hiển thị) ---

const renderActionButton = (targetUsername, friendship) => {
    if (!friendship) {
        // Chưa có mối quan hệ -> Gửi lời mời
        return `<button class="btn-primary btn-sm" onclick="sendFriendRequest('${targetUsername}')">Kết bạn</button>`;
    }
    
    if (friendship.status === 'pending') {
        if (friendship.sender === currentUsername) {
            // Tôi đã gửi lời mời
            return `<button class="btn-neutral btn-sm" disabled>Đã gửi lời mời</button>`;
        } else {
            // Tôi nhận được lời mời -> Nút hiển thị trong renderFriendsAndRequests
            return ''; 
        }
    }
    
    if (friendship.status === 'accepted') {
        // Đã là bạn bè -> Nhắn tin
        return `<button class="btn-secondary btn-sm" onclick="startDM('${targetUsername}')">Nhắn tin</button>`;
    }
    
    return '';
}

const renderAllUsers = (users, friendships) => {
    allUsersList.innerHTML = '';
    // Lọc bỏ chính người dùng hiện tại
    const filteredUsers = users.filter(u => u.username !== currentUsername); 
    
    if (filteredUsers.length === 0) {
        allUsersList.innerHTML = `<p class="loading-message">Không có người dùng nào khác.</p>`;
        return;
    }

    filteredUsers.forEach(user => {
        // Tìm trạng thái kết bạn giữa tôi và user này
        const friendship = friendships.find(f => 
            (f.user1 === currentUsername && f.user2 === user.username) || 
            (f.user2 === currentUsername && f.user1 === user.username)
        );
        
        const card = document.createElement('div');
        card.classList.add('user-card');
        card.innerHTML = `
            <span>${user.username}</span>
            <div class="user-actions">
                ${renderActionButton(user.username, friendship)}
            </div>
        `;
        allUsersList.appendChild(card);
    });
}

const renderFriendsAndRequests = (friendships) => {
    friendsList.innerHTML = '';
    requestsList.innerHTML = '';
    let hasFriends = false;
    let hasRequests = false;
    
    friendships.forEach(f => {
        if (f.status === 'accepted') {
            hasFriends = true;
            const friendUsername = f.user1 === currentUsername ? f.user2 : f.user1;
            const card = document.createElement('div');
            card.classList.add('user-card', 'friend');
            card.innerHTML = `
                <span>⭐ ${friendUsername}</span>
                <div class="user-actions">
                    <button class="btn-secondary btn-sm" onclick="startDM('${friendUsername}')">Nhắn tin</button>
                </div>
            `;
            friendsList.appendChild(card);
            
        } else if (f.status === 'pending' && f.user2 === currentUsername) {
            // Lời mời gửi đến tôi (tôi là user2)
            hasRequests = true;
            const senderUsername = f.sender;
            const card = document.createElement('div');
            card.classList.add('user-card', 'request');
            card.innerHTML = `
                <span>👉 ${senderUsername}</span>
                <div class="user-actions">
                    <button class="btn-secondary btn-sm" onclick="acceptFriendRequest('${f.id}')">Chấp nhận</button>
                    <button class="btn-delete btn-sm" onclick="declineFriendRequest('${f.id}')">Xóa</button>
                </div>
            `;
            requestsList.appendChild(card);
        }
    });

    if (!hasFriends) {
        friendsList.innerHTML = `<p class="loading-message">Bạn chưa có người bạn nào.</p>`;
    }
    if (!hasRequests) {
        requestsList.innerHTML = `<p class="loading-message">Không có lời mời nào.</p>`;
    }
}


// --- 2. HÀM TẢI DỮ LIỆU (Đã sửa lỗi quyền) ---

const loadData = async (searchQuery = '') => {
    try {
        // --- TẢI TẤT CẢ USER ---
        let userQuery = query(collection(db, 'users'));
        if (searchQuery) {
            // Tìm kiếm prefix
            userQuery = query(userQuery, where('username', '>=', searchQuery), where('username', '<=', searchQuery + '\uf8ff'));
        }
        
        const usersSnap = await getDocs(userQuery);
        const users = usersSnap.docs.map(d => d.data());
        
        // --- TẢI TRẠNG THÁI BẠN BÈ (SỬ DỤNG HAI QUERY) ---
        // Query 1: Tôi là user1
        const q1 = query(collection(db, 'friendships'), where('user1', '==', currentUsername));
        const snap1 = await getDocs(q1);

        // Query 2: Tôi là user2
        const q2 = query(collection(db, 'friendships'), where('user2', '==', currentUsername));
        const snap2 = await getDocs(q2);
        
        // Hợp nhất kết quả từ 2 truy vấn
        const allFriendships = [...snap1.docs, ...snap2.docs].map(d => ({ id: d.id, ...d.data() }));

        // Cập nhật giao diện
        renderAllUsers(users, allFriendships);
        renderFriendsAndRequests(allFriendships);
        
        // Lắng nghe sự thay đổi của lời mời (user1/user2) và reload data
        // Lưu ý: Các listener này sẽ tự động gọi loadData khi có sự thay đổi trong friendships
        onSnapshot(q1, () => loadData(userSearchInput.value.trim()));
        onSnapshot(q2, () => loadData(userSearchInput.value.trim()));

    } catch (error) {
        console.error("Lỗi khi tải dữ liệu bạn bè:", error);
        allUsersList.innerHTML = `<p class="chat-error">Lỗi: Không thể tải dữ liệu. (${error.message})</p>`;
    }
}


// --- 3. HÀM XỬ LÝ HÀNH ĐỘNG (Được gắn vào window để HTML gọi) ---

window.sendFriendRequest = async (targetUsername) => {
    if (targetUsername === currentUsername) return;

    try {
        const dmId = getDMId(currentUsername, targetUsername);
        
        // Sắp xếp username để gán user1 và user2 cho đúng
        const [u1, u2] = [currentUsername, targetUsername].sort(); 

        await setDoc(doc(db, 'friendships', dmId), {
            user1: u1,
            user2: u2,
            participants: [currentUsername, targetUsername],
            sender: currentUsername, // Người gửi là người dùng hiện tại
            status: 'pending',
            createdAt: serverTimestamp()
        });
        showToast(`Đã gửi lời mời đến ${targetUsername}.`, 'success');

    } catch (e) {
        console.error("Lỗi gửi lời mời:", e);
        showToast("Lỗi: Không thể gửi lời mời kết bạn.", 'error');
    }
}

window.acceptFriendRequest = async (friendshipId) => {
    try {
        const friendshipRef = doc(db, 'friendships', friendshipId);
        await updateDoc(friendshipRef, {
            status: 'accepted'
        });
        showToast("Đã chấp nhận lời mời. Hai bạn đã là bạn bè!", 'success');
    } catch (e) {
        console.error("Lỗi chấp nhận lời mời:", e);
        showToast("Lỗi: Không thể chấp nhận lời mời.", 'error');
    }
}

window.declineFriendRequest = async (friendshipId) => {
    try {
        await deleteDoc(doc(db, 'friendships', friendshipId));
        showToast("Đã từ chối lời mời kết bạn.", 'info');
    } catch (e) {
        console.error("Lỗi từ chối lời mời:", e);
        showToast("Lỗi: Không thể từ chối lời mời.", 'error');
    }
}

window.startDM = (targetUsername) => {
    const dmId = getDMId(currentUsername, targetUsername);
    // Chuyển hướng đến trang chat, dùng tham số dmId để chỉ định phòng chat riêng
    location.href = `chat.html?dm=${dmId}`;
}


// --- 4. KHỞI TẠO ---

// Hàm tìm kiếm
userSearchInput.addEventListener('input', () => {
    loadData(userSearchInput.value.trim());
});

// Load dữ liệu khi trang được tải lần đầu
loadData();