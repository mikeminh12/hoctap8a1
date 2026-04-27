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

    document.getElementById('question-progress').innerText = `Tiến độ: ${data.currentQuestion + 1}/${quizQuestions.length}`;

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
        showFinalWinner();
    }
}

// 5. HIỂN THỊ CÂU HỎI
function renderQuestion(index) {
    if (!isDataLoaded || !quizQuestions[index]) return;
    const q = quizQuestions[index];

    const qTextEl = document.getElementById('q-text');
    qTextEl.innerText = `Câu ${index + 1}: ${q.text}`;
    qTextEl.style.color = "#2c3e50";

    const optsContainer = document.getElementById('options-container');
    optsContainer.innerHTML = '';
    document.getElementById('answer-feedback').innerHTML = ''; // Clear feedback

    q.options.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.innerText = opt;
        btn.style.color = "#333";
        btn.onclick = () => handleAnswer(opt, q.correctAnswer);
        optsContainer.appendChild(btn);
    });

    // Nếu đã có người thắng vòng này hoặc hết thời gian, khóa nút
    if (roomData.winner || timeLeft <= 0) {
        disableAllOptions();
        showNextButton();
    }

    startQuestionTimer();
}

// 6. XỬ LÝ KHI BẤM ĐÁP ÁN
async function handleAnswer(selected, correct) {
    disableAllOptions();

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
    btn.style = "background: #3498db; color: white; margin-top: 20px; padding: 10px 25px;";
    btn.innerText = "Tiếp theo ➔";
    
    btn.onclick = async () => {
        btn.disabled = true;
        btn.innerText = "Chờ mọi người...";
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

function showFinalWinner() {
    // Tìm người điểm cao nhất từ bảng xếp hạng hiện tại để hiện lên màn hình kết thúc
    const players = document.querySelectorAll('.player-item');
    if(players.length > 0) {
        document.getElementById('winner-name').innerText = "Chúc mừng các bạn đã hoàn thành!";
    }
}