import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

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
    list.innerHTML = '⏳ Đang tải...';
    
    try {
        const q = query(collection(db, "quizzes"), orderBy("createdAt", "desc"));
        const snap = await getDocs(q);
        list.innerHTML = '';

        if (snap.empty) {
            list.innerHTML = '<p style="color:#7f8c8d;">Hiện chưa có bài tập nào.</p>';
            return;
        }

        for (const docSnap of snap.docs) {
            const d = docSnap.data();
            const historySnap = await getDoc(doc(db, `users/${currentUser.uid}/completed_quizzes`, docSnap.id));
            const historyData = historySnap.exists() ? historySnap.data() : null;
            
            const attemptsDone = historyData ? (historyData.attempts || 1) : 0;
            const limit = d.attemptsLimit || 1;
            const canDoMore = attemptsDone < limit;

            const div = document.createElement('div');
            div.className = 'quiz-card';
            div.style.borderLeft = attemptsDone > 0 ? "5px solid #2ecc71" : "5px solid #3498db";

            div.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <h3 style="margin:0; font-size:1.15rem; color:#2c3e50;">${d.title} ${attemptsDone > 0 ? '✅' : ''}</h3>
                        <p style="margin:8px 0 0 0; color:#7f8c8d; font-size:0.9rem;">
                            🪙 Thưởng: <b>${d.tokenReward}</b> | ⏰ ${d.timeLimit || 15}p | 🔄 Lượt: ${attemptsDone}/${limit}
                        </p>
                    </div>
                    <div style="display:flex; gap:10px;">
                        ${attemptsDone > 0 ? `<button class="action-btn btn-delete" style="background:#e0e6ed; color:#2c3e50; border:none;" onclick="window.location.href='quizing.html?id=${docSnap.id}&mode=review'">👁️ Xem lại</button>` : ''}
                        ${canDoMore ? `<button class="action-btn btn-view" onclick="window.location.href='quizing.html?id=${docSnap.id}'">▶️ ${attemptsDone > 0 ? 'Làm tiếp' : 'Bắt đầu'}</button>` : ''}
                    </div>
                </div>
            `;
            list.appendChild(div);
        }
    } catch (err) {
        list.innerHTML = '<p style="color:red;">Lỗi tải bài thi.</p>';
        console.error(err);
    }
}

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