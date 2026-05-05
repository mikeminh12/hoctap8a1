import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, setDoc, updateDoc, onSnapshot, increment } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room');

let currentUser = null;
let roomData = null;
let quizQuestions = []; 
let isDataLoaded = false;
let localTimerInterval = null;
let timeLeft = 60;
let quizTokenReward = 0;   // Phần thưởng base của bài quiz
let tokenAwarded = false;  // Chống cộng token nhiều lần trong cùng session
let lastRenderedIndex = -1;

const roomRef = doc(db, "rooms", roomId);
const playersRef = doc(db, `rooms/${roomId}/players_sub`, "list");

// 1. KHỞI CHẠY & KIỂM TRA ĐĂNG NHẬP
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Bạn cần đăng nhập để tham gia!");
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    document.getElementById('room-id-display').innerText = roomId;
    
    await joinRoom();
    listenToRoom();
});

// 2. GIA NHẬP PHÒNG & TẢI DỮ LIỆU (GIỐNG QUIZING.HTML)
async function joinRoom() {
    try {
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
            alert("Phòng không tồn tại!");
            window.location.href = "quiz.html";
            return;
        }

        const quizId = roomSnap.data().quizId;
        const quizDoc = await getDoc(doc(db, "quizzes", quizId));

        if (quizDoc.exists()) {
            quizQuestions = quizDoc.data().questions || [];
            quizTokenReward = quizDoc.data().tokenReward || 0; // Lưu phần thưởng base
            isDataLoaded = true;
        }

        // Đăng ký người chơi vào danh sách
        await setDoc(playersRef, {
            [currentUser.uid]: {
                name: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Người chơi'),
                score: 0,
                isReady: false,
                status: 'active',
                wantsNext: false // Trạng thái bấm nút "Tiếp theo"
            }
        }, { merge: true });

    } catch (error) {
        console.error("Lỗi joinRoom:", error);
    }
}

// 3. LẮNG NGHE SỰ KIỆN REALTIME
function listenToRoom() {
    onSnapshot(roomRef, (docSnap) => {
        if(!docSnap.exists()) return;
        roomData = docSnap.data();
        handleRoomState(roomData);
    });

    onSnapshot(playersRef, (docSnap) => {
        if(!docSnap.exists()) return;
        const players = docSnap.data();
        renderLeaderboard(players);
        checkGlobalConditions(players);
    });
}

// 4. QUẢN LÝ TRẠNG THÁI MÀN HÌNH
function handleRoomState(data) {
    const screens = ['waiting-screen', 'countdown-screen', 'question-screen', 'result-screen'];
    screens.forEach(s => document.getElementById(s).style.display = 'none');

    if (data.status === 'waiting') {
        document.getElementById('waiting-screen').style.display = 'flex';
    } else if (data.status === 'countdown') {
        document.getElementById('countdown-screen').style.display = 'flex';
        startBigCountdown();
    } else if (data.status === 'playing') {
        document.getElementById('question-screen').style.display = 'block';
        renderQuestion(data.currentQuestion);
    } else if (data.status === 'finished') {
        document.getElementById('result-screen').style.display = 'flex';
        awardTokens(); // Cộng token cho tất cả người chơi
        showFinalWinner();
    }
}

// Lưu ý: Nhớ đảm bảo bạn đã khai báo biến này ở đầu file quiz-solo.js
// let lastRenderedIndex = -1;

// 5. HIỂN THỊ CÂU HỎI
function renderQuestion(index) {
    if (!isDataLoaded || !quizQuestions[index]) return;
    const q = quizQuestions[index];

    // ---------------------------------------------------------
    // PHẦN 1: CHỈ CHẠY KHI CHUYỂN SANG CÂU HỎI MỚI (VẼ GIAO DIỆN)
    // ---------------------------------------------------------
    if (lastRenderedIndex !== index) {
        lastRenderedIndex = index; // Cập nhật lại vết câu hỏi hiện tại

        // --- 1.1 CẬP NHẬT THANH TIẾN TRÌNH ---
        const totalQuestions = quizQuestions.length;
        const currentQ = index + 1;
        
        const progressText = document.getElementById('progress-text');
        const progressFill = document.getElementById('progress-fill');
        
        if (progressText && progressFill) {
            progressText.innerHTML = `<span>Tiến trình</span> <span>${currentQ} / ${totalQuestions}</span>`;
            // Tính toán phần trăm và kéo dài thanh tiến trình
            const percent = (currentQ / totalQuestions) * 100;
            progressFill.style.width = `${percent}%`;
        }

        // --- 1.2 ANIMATION TRƯỢT/FADE CÂU HỎI ---
        const qScreen = document.getElementById('question-screen');
        qScreen.classList.remove('fade-enter');
        void qScreen.offsetWidth; // Kích hoạt reflow để reset CSS animation
        qScreen.classList.add('fade-enter');

        // --- 1.3 HIỂN THỊ NỘI DUNG CÂU HỎI ---
        const qTextEl = document.getElementById('q-text');
        qTextEl.innerText = `Câu ${index + 1}: ${q.text}`;
        qTextEl.style.color = "#2c3e50";

        // --- 1.4 HIỂN THỊ CÁC ĐÁP ÁN (KÈM PHÍM TẮT) ---
        const optsContainer = document.getElementById('options-container');
        optsContainer.innerHTML = ''; // Xóa các nút cũ
        document.getElementById('answer-feedback').innerHTML = ''; // Xóa thông báo cũ

        q.options.forEach((opt, idx) => {
            const btn = document.createElement('button');
            btn.className = 'option-btn';
            
            // Lưu giá trị gốc vào dataset để dễ dàng so sánh và bôi màu đúng/sai sau này
            btn.dataset.option = opt; 
            
            // Thêm nút gợi ý phím tắt (1, 2, 3, 4) vào HTML của nút
            btn.innerHTML = `<span class="key-hint">${idx + 1}</span> ${opt}`;
            
            // Lắng nghe sự kiện click
            btn.onclick = () => handleAnswer(opt, q.correctAnswer);
            optsContainer.appendChild(btn);
        });

        // Bắt đầu đếm ngược thời gian cho câu hỏi mới
        startQuestionTimer();
    }

    // ---------------------------------------------------------
    // PHẦN 2: CHẠY LIÊN TỤC KHI CÓ CẬP NHẬT TỪ FIREBASE (ĐỒNG BỘ)
    // ---------------------------------------------------------
    // Nếu trong phòng đã có người thắng câu này (trả lời đúng) HOẶC hết thời gian
    if (roomData && (roomData.winner || timeLeft <= 0)) {
        disableAllOptions(); // Khóa tất cả các nút
        showNextButton();    // Hiện nút "Tiếp theo (Space)"
        
        // Tìm và tự động bôi xanh đáp án đúng cho mọi người cùng thấy
        const buttons = document.querySelectorAll('.option-btn');
        buttons.forEach(btn => {
            if (btn.dataset.option === q.correctAnswer) {
                btn.classList.add('correct');
            }
        });
    }
}

// 6. XỬ LÝ KHI BẤM ĐÁP ÁN
async function handleAnswer(selected, correct) {
    disableAllOptions();

    // --- CẬP NHẬT GIAO DIỆN (ĐỔI MÀU ĐÚNG/SAI) ---
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(btn => {
        const optValue = btn.dataset.option;
        if (optValue === correct) {
            // Luôn bôi xanh đáp án đúng
            btn.classList.add('correct'); 
        } else if (optValue === selected) {
            // Nếu đáp án đang xét không phải đáp án đúng mà lại là đáp án user đã chọn -> Bôi đỏ
            btn.classList.add('wrong'); 
        }
    });
    // ---------------------------------------------

    // Xử lý điểm số trên Firebase
    if (selected === correct) {
        const roomSnap = await getDoc(roomRef);
        if (roomSnap.data().winner === null) {
            // Bạn là người nhanh nhất
            await updateDoc(roomRef, { winner: currentUser.uid });
            await updateDoc(playersRef, { [`${currentUser.uid}.score`]: increment(1) });
            showFeedback("✅ Bạn đã giành điểm!", "#28a745");
        } else {
            showFeedback("😢 Đúng nhưng chậm mất rồi!", "#f39c12");
        }
    } else {
        showFeedback("❌ Sai rồi! Bạn bị mất lượt.", "#e74c3c");
        await updateDoc(playersRef, { [`${currentUser.uid}.status`]: 'wrong' });
    }
    
    showNextButton();
}

// 7. LOGIC NÚT "TIẾP THEO"
function showNextButton() {
    const feedback = document.getElementById('answer-feedback');
    if (document.getElementById('btn-next-question')) return; // Tránh tạo trùng

    const btn = document.createElement('button');
    btn.id = 'btn-next-question';
    btn.className = 'btn';
    btn.style = "background: #3498db; color: white; margin-top: 20px; padding: 10px 25px; display: inline-flex; align-items: center; justify-content: center; gap: 10px;";
    
    // Thêm gợi ý phím Space
    btn.innerHTML = `Tiếp theo ➔ <span class="key-hint" style="margin: 0;">Space</span>`;
    
    btn.onclick = async () => {
        btn.disabled = true;
        btn.innerHTML = "Chờ mọi người...";
        await updateDoc(playersRef, { [`${currentUser.uid}.wantsNext`]: true });
    };
    feedback.appendChild(btn);
}

// 8. KIỂM TRA ĐIỀU KIỆN CHUYỂN CÂU/BẮT ĐẦU
async function checkGlobalConditions(playersObj) {
    const uids = Object.keys(playersObj);
    if (uids.length === 0) return;

    // A. Kiểm tra tất cả sẵn sàng (Màn hình chờ)
    if (roomData?.status === 'waiting' && roomData.hostId === currentUser.uid) {
        if (uids.every(id => playersObj[id].isReady)) {
            await updateDoc(roomRef, { status: 'countdown' });
        }
    }

    // B. Kiểm tra tất cả đã bấm "Tiếp theo"
    const allWantsNext = uids.every(id => playersObj[id].wantsNext);
    if (allWantsNext && roomData?.status === 'playing' && roomData.hostId === currentUser.uid) {
        // Reset trạng thái wantsNext cho tất cả để sang câu mới
        const resetData = {};
        uids.forEach(id => {
            resetData[`${id}.wantsNext`] = false;
            resetData[`${id}.status`] = 'active';
        });
        await updateDoc(playersRef, resetData);
        nextQuestion();
    }
}

async function nextQuestion() {
    let nextIdx = roomData.currentQuestion + 1;
    if (nextIdx >= quizQuestions.length) {
        await updateDoc(roomRef, { status: 'finished' });
    } else {
        await updateDoc(roomRef, { 
            currentQuestion: nextIdx, 
            winner: null,
            questionStartTime: new Date() 
        });
    }
}

// --- CÁC HÀM HỖ TRỢ KHÁC ---

function startQuestionTimer() {
    clearInterval(localTimerInterval);
    timeLeft = 60;
    localTimerInterval = setInterval(() => {
        timeLeft--;
        if (timeLeft <= 0) {
            clearInterval(localTimerInterval);
            disableAllOptions();
            showNextButton();
        }
        updateTimerDisplay();
    }, 1000);
}

function updateTimerDisplay() {
    const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
    const s = (timeLeft % 60).toString().padStart(2, '0');
    document.getElementById('question-timer').innerText = `${m}:${s}`;
}

function disableAllOptions() {
    document.querySelectorAll('.option-btn').forEach(b => b.disabled = true);
}

function showFeedback(msg, color) {
    const fb = document.getElementById('answer-feedback');
    fb.innerHTML = `<div style="color: ${color}">${msg}</div>`;
}

function startBigCountdown() {
    let count = 3;
    const el = document.getElementById('start-countdown');
    const iv = setInterval(async () => {
        count--;
        if(count <= 0) {
            clearInterval(iv);
            if(roomData.hostId === currentUser.uid) {
                await updateDoc(roomRef, { status: 'playing', questionStartTime: new Date() });
            }
        } else { el.innerText = count; }
    }, 1000);
}

document.getElementById('btn-ready').onclick = async () => {
    await updateDoc(playersRef, { [`${currentUser.uid}.isReady`]: true });
};

function renderLeaderboard(playersObj) {
    const list = document.getElementById('players-list');
    list.innerHTML = '';
    const sorted = Object.entries(playersObj).sort((a,b) => b[1].score - a[1].score);
    sorted.forEach(([uid, data]) => {
        const nextIcon = data.wantsNext ? ' ✅' : '';
        list.innerHTML += `
            <li class="player-item">
                <span>${data.name}${nextIcon}</span>
                <span class="player-score">${data.score} đ</span>
            </li>`;
    });
}

// 9. PHÂN PHÁT TOKEN KHI KẾT THÚC
async function awardTokens() {
    // Mỗi instance chỉ chạy một lần (chống snapshot gọi lại nhiều lần)
    if (tokenAwarded) return;
    tokenAwarded = true;

    try {
        const playersSnap = await getDoc(playersRef);
        if (!playersSnap.exists()) return;

        const players = playersSnap.data();
        const uids = Object.keys(players);
        if (uids.length === 0 || quizTokenReward <= 0) return;

        // Tìm người có điểm cao nhất
        let maxScore = -1;
        uids.forEach(uid => {
            if (players[uid].score > maxScore) maxScore = players[uid].score;
        });

        const participationToken = Math.round(quizTokenReward * 0.5);  // 50% cho tất cả
        const winnerBonusToken = Math.round(quizTokenReward * 1.5);    // 150% cho người thắng

        // Cộng token cho từng người chơi
        const promises = uids.map(async (uid) => {
            const userRef = doc(db, "users", uid);
            const isWinner = maxScore > 0 && players[uid].score === maxScore;

            if (isWinner) {
                // Người thắng: nhận 150% (đã bao gồm phần tham gia)
                await updateDoc(userRef, { tokens: increment(winnerBonusToken) });
                // Ghi nhớ token nhận được vào players_sub để hiển thị
                await updateDoc(playersRef, { [`${uid}.tokensEarned`]: winnerBonusToken, [`${uid}.isWinner`]: true });
            } else {
                // Người còn lại: nhận 50%
                await updateDoc(userRef, { tokens: increment(participationToken) });
                await updateDoc(playersRef, { [`${uid}.tokensEarned`]: participationToken, [`${uid}.isWinner`]: false });
            }
        });

        await Promise.all(promises);
    } catch (err) {
        console.error("Lỗi cộng token:", err);
    }
}

function showFinalWinner() {
    // Lấy snapshot players để hiển thị kết quả token
    const unsubscribe = onSnapshot(playersRef, (docSnap) => {
        if (!docSnap.exists()) return;
        const players = docSnap.data();

        // Kiểm tra đã có dữ liệu tokensEarned chưa (awardTokens chạy xong)
        const allAwarded = Object.values(players).every(p => p.tokensEarned !== undefined);
        if (!allAwarded) return;

        unsubscribe(); // Dừng lắng nghe sau khi đã có đủ dữ liệu

        // Tìm người thắng (điểm cao nhất)
        const sorted = Object.entries(players).sort((a, b) => b[1].score - a[1].score);
        const [winnerUid, winnerData] = sorted[0];

        // Hiển thị người thắng
        const winnerEl = document.getElementById('winner-name');
        if (winnerData.score > 0) {
            const crown = winnerUid === currentUser.uid ? " 👑 Đó là bạn!" : "";
            winnerEl.innerText = `🏆 ${winnerData.name} dẫn đầu với ${winnerData.score} điểm!${crown}`;
        } else {
            winnerEl.innerText = "Chúc mừng các bạn đã hoàn thành!";
        }

        // Hiển thị token của người chơi hiện tại
        const myData = players[currentUser.uid];
        if (myData && myData.tokensEarned !== undefined) {
            const tokenEl = document.getElementById('winner-name');
            const myTokenMsg = document.createElement('div');
            myTokenMsg.style = "margin-top: 12px; font-size: 1.1rem; color: #f39c12;";

            if (myData.isWinner) {
                myTokenMsg.innerHTML = `🥇 Bạn thắng! Nhận <b>+${myData.tokensEarned} 🪙</b> (150% phần thưởng)`;
            } else {
                myTokenMsg.innerHTML = `🎖️ Tham gia hoàn thành! Nhận <b>+${myData.tokensEarned} 🪙</b> (50% phần thưởng)`;
            }

            tokenEl.parentNode.insertBefore(myTokenMsg, tokenEl.nextSibling);
        }
    });
}
// --- LẮNG NGHE PHÍM TẮT (KEYBOARD SHORTCUTS) ---
document.addEventListener('keydown', (e) => {
    // Chỉ kích hoạt khi đang ở màn hình chơi
    if (roomData?.status !== 'playing') return;

    const options = document.querySelectorAll('.option-btn');
    const nextBtn = document.getElementById('btn-next-question');

    // Xử lý phím 1, 2, 3, 4 (chọn đáp án)
    if (['1', '2', '3', '4'].includes(e.key)) {
        const index = parseInt(e.key) - 1;
        // Kiểm tra xem nút có tồn tại và chưa bị disable hay không
        if (options[index] && !options[index].disabled) {
            options[index].click();
        }
    }

    // Xử lý phím Space (bấm nút Tiếp theo)
    if (e.code === 'Space') {
        if (nextBtn && !nextBtn.disabled) {
            e.preventDefault(); // Ngăn chặn hành vi cuộn trang mặc định của phím Space
            nextBtn.click();
        }
    }
});