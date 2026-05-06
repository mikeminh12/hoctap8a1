import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { collection, query, orderBy, limit, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
window.quizId = urlParams.get('id');

let currentUser = null;
let allLevels = [];

// ================= LẮNG NGHE TRẠNG THÁI ĐĂNG NHẬP =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Bạn cần đăng nhập để xem trang này!");
        window.location.href = "login.html";
        return;
    }
    
    currentUser = user;

    // Chạy tuần tự các chức năng y hệt bên quiz.js
    await fetchLevels();
    await loadUserTokens();
    loadLeaderboard();
    
    // Tải thông tin của bảng xếp hạng chi tiết bài quiz
    initPage();
});

// ================= HỆ THỐNG LEVEL =================
async function fetchLevels() {
    try {
        const q = query(collection(db, "levels"), orderBy("threshold", "asc"));
        const snap = await getDocs(q);
        allLevels = snap.docs.map(docSnap => docSnap.data());
    } catch (error) {
        console.error("Lỗi khi tải Levels: ", error);
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

// ================= THÔNG TIN CÁ NHÂN (SIDEBAR) =================
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
    
    const badge = document.getElementById('myLevelBadge');
    badge.innerText = currentLv.name;
    badge.style.color = currentLv.color;
    badge.style.textShadow = `0 0 8px ${currentLv.color}80, 0 0 15px ${currentLv.color}40`;

    let percent = 100;
    if (nextLv) {
        let diff = nextLv.threshold - currentLv.threshold;
        let progress = tokens - currentLv.threshold;
        percent = Math.min(100, Math.max(0, (progress / diff) * 100));
        document.getElementById('nextLevelInfo').innerText = `Còn ${nextLv.threshold - tokens} 🪙 nữa để thăng cấp ${nextLv.name}`;
    } else {
        document.getElementById('nextLevelInfo').innerText = `🏆 Bạn đã đạt cấp độ tối đa!`;
    }
    
    document.getElementById('myLevelBar').style.background = currentLv.color;
    document.getElementById('myLevelBar').style.boxShadow = `0 0 10px ${currentLv.color}80`;
    
    setTimeout(() => {
        document.getElementById('myLevelBar').style.width = percent + "%";
    }, 300);
}

// ================= BẢNG XẾP HẠNG MINI (SIDEBAR) =================
async function loadLeaderboard() {
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
        let x = e.clientX + 15;
        let y = e.clientY + 15;
        
        if (x + 200 > window.innerWidth) x = e.clientX - 215; 
        if (y + 100 > window.innerHeight) y = e.clientY - 115; 

        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';
    }
};

// ================= LOGIC BẢNG XẾP HẠNG CHI TIẾT BÀI TẬP =================
async function initPage() {
    if (!window.quizId) {
        alert("Không tìm thấy mã bài tập!");
        window.location.href = 'quiz.html';
        return;
    }

    // 1. Lấy thông tin tiêu đề bài Quiz
    try {
        const quizSnap = await getDoc(doc(db, "quizzes", window.quizId));
        if (quizSnap.exists()) {
            document.getElementById('quizTitle').innerText = `🏆 BXH: ${quizSnap.data().title}`;
            document.getElementById('quizSubtitle').innerText = "Thành tích cao nhất của các thành viên lớp 8A1";
        }
    } catch (err) {
        console.error("Lỗi lấy thông tin quiz:", err);
    }

    // 2. Tải bảng xếp hạng chi tiết
    loadDetailLeaderboard();
}

// ================= LOGIC BẢNG XẾP HẠNG CHI TIẾT BÀI TẬP =================
async function loadDetailLeaderboard() {
    const tbody = document.getElementById('detailLeaderboard');
    try {
        // Lấy records từ sub-collection, sắp xếp theo điểm cao giảm dần, thời gian tăng dần
        const q = query(
            collection(db, `quiz_leaderboards/${window.quizId}/records`), 
            orderBy('score', 'desc'), 
            orderBy('timeTaken', 'asc')
        );
        
        const snap = await getDocs(q);
        let html = '';
        let rank = 1;

        if (snap.empty) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:30px;">Chưa có dữ liệu xếp hạng cho bài này.</td></tr>';
            return;
        }

        // Dùng for...of để có thể await việc lấy thông tin username mới nhất từ bảng users
        for (const docSnap of snap.docs) {
            const data = docSnap.data();
            
            // 1. Tên mặc định lấy từ lịch sử lưu
            let finalName = data.displayName || 'Ẩn danh';

            // 2. Đối chiếu lấy 'username' chuẩn từ collection 'users'
            if (data.uid) {
                try {
                    const userSnap = await getDoc(doc(db, "users", data.uid));
                    if (userSnap.exists()) {
                        const uData = userSnap.data();
                        // Ưu tiên hiển thị username, nếu không có thì lấy displayName, cuối cùng là tên lịch sử
                        finalName = uData.username || uData.displayName || finalName;
                    }
                } catch (e) {
                    console.error("Lỗi lấy thông tin user cho BXH:", e);
                }
            }

            // 3. Render giao diện hạng
            let rankDisplay = '';
            if (rank === 1) rankDisplay = '<span class="rank-icon">🥇</span>';
            else if (rank === 2) rankDisplay = '<span class="rank-icon">🥈</span>';
            else if (rank === 3) rankDisplay = '<span class="rank-icon">🥉</span>';
            else rankDisplay = `<span class="rank-text">#${rank}</span>`;

            html += `
                <tr>
                    <td class="text-center">${rankDisplay}</td>
                    <td><span class="student-name">${finalName}</span></td>
                    <td><b style="color: var(--success);">${data.score}</b> / ${data.totalQuestions}</td>
                    <td>${data.timeTaken} giây</td>
                    <td><span class="attempts-tag">${data.attempts || 1} lần</span></td>
                </tr>
            `;
            rank++;
        }
        
        tbody.innerHTML = html;
    } catch (err) {
        console.error("Lỗi tải BXH:", err);
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red; padding:20px;">Lỗi khi tải bảng xếp hạng.</td></tr>';
    }
}