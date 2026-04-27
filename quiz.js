import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, orderBy, limit, setDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

// --- Hàm hiển thị thông báo Toast ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${type === 'success' ? '✅' : type === 'error' ? '❌' : '💡'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => { toast.classList.remove('show'); toast.addEventListener('transitionend', ()=>toast.remove()); }, 3000);
}

let currentUser = null;
let allLevels = []; // Lưu trữ mốc cấp độ

// Lắng nghe trạng thái đăng nhập
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Bạn cần đăng nhập để làm bài!");
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    
    // THỨ TỰ THỰC THI QUAN TRỌNG:
    await fetchLevels();         // 1. Tải mốc Level từ Admin trước
    await loadUserTokens();      // 2. Tải thông tin cá nhân (Cần level để vẽ thanh tiến độ)
    loadLeaderboard();           // 3. Tải Bảng xếp hạng (Cần level để vẽ màu Neon)
    loadQuizzes();               // 4. Tải danh sách bài thi
});

// ================= HỆ THỐNG LEVEL =================
async function fetchLevels() {
    try {
        const q = query(collection(db, "levels"), orderBy("threshold", "asc"));
        const snap = await getDocs(q);
        allLevels = snap.docs.map(docSnap => docSnap.data());
    } catch (error) {
        console.error("Lỗi khi tải Levels (Kiểm tra lại Rules Firestore): ", error);
        // Fallback mặc định nếu lỗi
        allLevels = [{ name: "Tân Thủ", threshold: 0, color: "#95a5a6" }];
    }
}

function calculateLevel(tokens) {
    let currentLv = { name: "Tân Thủ", color: "#95a5a6", threshold: 0 };
    let nextLv = null;

    if (allLevels.length === 0) return { currentLv, nextLv };

    for (let i = 0; i < allLevels.length; i++) {
        if (tokens >= allLevels[i].threshold) {
            currentLv = allLevels[i];
            nextLv = allLevels[i + 1] || null;
        } else {
            nextLv = allLevels[i];
            break;
        }
    }
    return { currentLv, nextLv };
}

// ================= THÔNG TIN CÁ NHÂN =================
async function loadUserTokens() {
    try {
        const snap = await getDoc(doc(db, "users", currentUser.uid));
        if (snap.exists()) {
            const userData = snap.data();
            updateMiniProfile(userData);
        }
    } catch (err) {
        console.error("Lỗi tải thông tin user:", err);
    }
}

function updateMiniProfile(userData) {
    const tokens = userData.tokens || 0;
    const { currentLv, nextLv } = calculateLevel(tokens);
    
    document.getElementById('mini-profile').style.display = 'block';
    document.getElementById('myAvatar').src = userData.photoURL || 'non.png';
    document.getElementById('myName').innerText = userData.username || 'Ẩn danh';
    document.getElementById('myTokens').innerText = tokens;
    
    // Badge & Neon Effect
    const badge = document.getElementById('myLevelBadge');
    badge.innerText = currentLv.name;
    badge.style.color = currentLv.color;
    badge.style.textShadow = `0 0 8px ${currentLv.color}80, 0 0 15px ${currentLv.color}40`; // Neon mềm mại

    // Thanh tiến độ (Level Bar)
    let percent = 100;
    if (nextLv) {
        let diff = nextLv.threshold - currentLv.threshold;
        let progress = tokens - currentLv.threshold;
        percent = Math.min(100, Math.max(0, (progress / diff) * 100));
        document.getElementById('nextLevelInfo').innerText = `Còn ${nextLv.threshold - tokens} 🪙 nữa để thăng cấp ${nextLv.name}`;
    } else {
        document.getElementById('nextLevelInfo').innerText = `🏆 Bạn đã đạt cấp độ tối đa!`;
    }
    
    // Đổi màu thanh level theo màu của level hiện tại
    document.getElementById('myLevelBar').style.background = currentLv.color;
    document.getElementById('myLevelBar').style.boxShadow = `0 0 10px ${currentLv.color}80`;
    
    // Animation thanh chạy
    setTimeout(() => {
        document.getElementById('myLevelBar').style.width = percent + "%";
    }, 300);
}

// ================= DANH SÁCH BÀI THI =================
async function loadQuizzes() {
    const list = document.getElementById('quizList');
    list.innerHTML = '<div style="text-align:center; padding: 20px; color:#95a5a6;">⏳ Đang tải danh sách bài thi...</div>';
    
    try {
        const q = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        list.innerHTML = '';

        if (snap.empty) {
            list.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding: 20px;">Hiện chưa có bài tập nào.</p>';
            return;
        }

        for (const docSnap of snap.docs) {
            const d = docSnap.data();
            const quizId = docSnap.id;
            
            // Lấy lịch sử làm bài
            const historySnap = await getDoc(doc(db, `users/${currentUser.uid}/completed_quizzes`, quizId));
            const historyData = historySnap.exists() ? historySnap.data() : null;
            
            const attemptsDone = historyData ? (historyData.attempts || 1) : 0;
            const limit = d.attemptsLimit || 1;
            const canDoMore = attemptsDone < limit;

            const div = document.createElement('div');
            div.className = 'quiz-card';
            div.style.borderLeft = attemptsDone > 0 ? "5px solid #2ecc71" : "5px solid #3498db";
            // Thêm chút style để card nhìn gọn gàng hơn
            div.style.padding = "15px";
            div.style.marginBottom = "15px";
            div.style.background = "#fff";
            div.style.borderRadius = "8px";
            div.style.boxShadow = "0 2px 4px rgba(0,0,0,0.05)";

            // Xây dựng khối HTML chứa các nút bấm
            let buttonsHTML = '';
            
            if (attemptsDone > 0) {
                buttonsHTML += `<button class="action-btn btn-delete" style="background:#e0e6ed; color:#2c3e50; border:none; padding: 8px 12px; border-radius: 6px; cursor:pointer;" onclick="window.location.href='quizing.html?id=${quizId}&mode=review'">👁️ Xem lại</button>`;
            }
            
            if (canDoMore) {
                buttonsHTML += `<button class="action-btn btn-view" style="background:#3498db; color:white; border:none; padding: 8px 12px; border-radius: 6px; cursor:pointer;" onclick="window.location.href='quizing.html?id=${quizId}'">▶️ ${attemptsDone > 0 ? 'Làm tiếp' : 'Bắt đầu'}</button>`;
            }

            // Nút Chơi Solo được thêm vào đây
            buttonsHTML += `<button class="action-btn" style="background:#e67e22; color:white; border:none; padding: 8px 12px; border-radius: 6px; cursor:pointer;" onclick="createSoloRoom('${quizId}')">⚔️ Chơi Solo</button>`;

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 15px;">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; color:#2c3e50;">${d.title} ${attemptsDone > 0 ? '✅' : ''}</h3>
                        <p style="margin:8px 0 0 0; color:#7f8c8d; font-size:0.9rem;">
                            🪙 Thưởng: <b style="color:#f39c12;">${d.tokenReward || 0}</b> | ⏰ ${d.timeLimit || 15}p | 🔄 Lượt: ${attemptsDone}/${limit}
                        </p>
                    </div>
                    <div style="display:flex; gap:10px; flex-wrap: wrap;">
                        ${buttonsHTML}
                    </div>
                </div>
            `;
            list.appendChild(div);
        }
    } catch (err) {
        list.innerHTML = '<p style="color:#e74c3c; text-align:center; padding: 20px;">❌ Lỗi tải bài thi. Vui lòng thử lại.</p>';
        console.error("Lỗi khi load danh sách quiz:", err);
    }
}

// ================= TẠO PHÒNG CHƠI SOLO =================
// Dùng window. để có thể gọi được từ hàm onclick dạng string trong innerHTML
window.createSoloRoom = async function(quizId) {
    if (!currentUser) return showToast("Vui lòng đăng nhập!", "error");
    
    // Tạo ID phòng ngẫu nhiên 6 ký tự
    const roomId = 'ROOM_' + Math.random().toString(36).substring(2, 8).toUpperCase();
    
    try {
        showToast("Đang tạo phòng...", "info");
        
        // Lưu thông tin phòng lên Firestore
        // Lưu ý: Đảm bảo bạn đã import setDoc từ firebase-firestore.js ở đầu file quiz.js
        await setDoc(doc(db, "rooms", roomId), {
            roomId: roomId,
            quizId: quizId,
            hostId: currentUser.uid,
            status: 'waiting', 
            currentQuestion: 0,
            questionStartTime: null,
            winner: null,
            createdAt: new Date()
        });

        // Chuyển hướng vào phòng chờ
        window.location.href = `quiz-solo.html?room=${roomId}`;
    } catch (err) {
        console.error("Lỗi tạo phòng:", err);
        showToast("Lỗi tạo phòng: " + err.message, "error");
    }
};

// ================= BẢNG XẾP HẠNG =================
// ================= BẢNG XẾP HẠNG HIỆN ĐẠI =================
async function loadLeaderboard() {
    await fetchLevels(); // Lấy dữ liệu cấp độ
    const tbody = document.getElementById('leaderboardBody');
    if (!tbody) return;
    
    try {
        const q = query(collection(db, "users"), orderBy("tokens", "desc"), limit(10));
        const snap = await getDocs(q);
        tbody.innerHTML = '';
        
        let rank = 1;
        snap.forEach(docSnap => {
            const d = docSnap.data();
            const tokens = d.tokens || 0;
            const { currentLv } = calculateLevel(tokens);
            
            // Xác định Icon và class cho Top 3
            let rankDisplay = rank;
            let rankClass = '';
            if (rank === 1) { rankDisplay = '🥇'; rankClass = 'top-1'; }
            else if (rank === 2) { rankDisplay = '🥈'; rankClass = 'top-2'; }
            else if (rank === 3) { rankDisplay = '🥉'; rankClass = 'top-3'; }

            const div = document.createElement('div');
            div.className = 'lb-item';
            div.innerHTML = `
    <div class="lb-rank ${rankClass}">${rankDisplay}</div>
    
    <img class="lb-avatar" src="${d.photoURL || 'non.png'}" style="border: 2px solid ${currentLv.color};">
    
    <div class="lb-info user-name-wrapper" 
         onmouseenter="showLevelTooltip(this)" 
         onmouseleave="hideLevelTooltip(this)" 
         onmousemove="moveLevelTooltip(event, this)">
         
        <span class="lb-name neon-text" style="color:${currentLv.color}; text-shadow: 0 0 5px ${currentLv.color}60;">
            ${d.username || 'Ẩn danh'}
        </span>
        
        <span class="lb-level" style="color: ${currentLv.color}; opacity: 0.9;">
            🛡️ ${currentLv.name}
        </span>

        <div class="level-tooltip">
            <div style="font-size: 1rem; font-weight: bold; margin-bottom: 8px; padding-bottom: 5px; border-bottom: 1px solid rgba(255,255,255,0.2);">
                👤 ${d.username || 'Ẩn danh'}
            </div>
            <b style="color:${currentLv.color}">🛡️ ${currentLv.name}</b><br>
            Mốc đạt: ${currentLv.threshold} 🪙<br>
            Đang có: <b style="color:#f1c40f;">${tokens} 🪙</b>
        </div>
    </div>

    <div class="lb-tokens">${tokens} 🪙</div>
`;
            tbody.appendChild(div);
            rank++;
        });
        
        if (snap.empty) {
            tbody.innerHTML = '<div style="text-align:center; padding:30px; color:#95a5a6;">Chưa có học sinh nào.</div>';
        }
    } catch (err) {
        console.error("Lỗi khi tải Leaderboard:", err);
        tbody.innerHTML = '<div style="text-align:center; padding:30px; color:red;">❌ Lỗi tải bảng xếp hạng.</div>';
    }
}



// ================= HIỆU ỨNG TOOLTIP BÁM CHUỘT =================
window.showLevelTooltip = function(el) {
    const tooltip = el.querySelector('.level-tooltip');
    if(tooltip) tooltip.style.display = 'block';
};

window.hideLevelTooltip = function(el) {
    const tooltip = el.querySelector('.level-tooltip');
    if(tooltip) tooltip.style.display = 'none';
};

window.moveLevelTooltip = function(e, el) {
    const tooltip = el.querySelector('.level-tooltip');
    if(tooltip) {
        // Tọa độ chuột cộng thêm 15px để thẻ không che mất con trỏ chuột
        let x = e.clientX + 15;
        let y = e.clientY + 15;
        
        // Chống tràn màn hình (Nếu thẻ đi quá mép phải hoặc mép dưới)
        if (x + 200 > window.innerWidth) x = e.clientX - 215; // Lật sang trái
        if (y + 100 > window.innerHeight) y = e.clientY - 115; // Lật lên trên

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }
};