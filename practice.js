import { auth, db } from './firebase.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const urlParams = new URLSearchParams(window.location.search);
const quizId = urlParams.get('id');

let currentUser = null;
let questions = [];
let currentQuestionIndex = 0;
let correctAnswersCount = 0;
let localTimerInterval = null;
let timeLeft = 60;
let totalTimeTaken = 0;

// ================= 1. KIỂM TRA ĐĂNG NHẬP & TẢI DỮ LIỆU =================
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert("Bạn cần đăng nhập để ôn tập!");
        window.location.href = "login.html";
        return;
    }
    currentUser = user;
    
    const playersList = document.getElementById('players-list');
    if (playersList) {
        playersList.innerHTML = `
            <li class="player-item">
                <span>👤 ${currentUser.displayName || 'Ẩn danh'}</span>
                <span class="player-score" id="my-score">0 điểm</span>
            </li>
        `;
    }

    await loadPractice();
});

async function loadPractice() {
    if (!quizId) {
        alert("Không tìm thấy mã bài tập!");
        return;
    }
    
    try {
        const docSnap = await getDoc(doc(db, "quizzes", quizId));
        if (docSnap.exists()) {
            const data = docSnap.data();
            questions = data.questions || [];
            questions = shuffleArray(questions);
        } else {
            alert("Không tìm thấy bài quiz!");
        }
    } catch (err) {
        console.error("Lỗi khi tải bài tập:", err);
    }
}

// ================= 2. BẤM NÚT SẴN SÀNG =================
document.getElementById('btn-ready').addEventListener('click', () => {
    if (questions.length === 0) {
        alert("Bài tập chưa có dữ liệu hoặc đang tải!");
        return;
    }
    
    document.getElementById('waiting-screen').style.display = 'none';
    document.getElementById('countdown-screen').style.display = 'flex';
    
    let count = 3;
    const countEl = document.getElementById('start-countdown');
    countEl.innerText = count;
    
    const iv = setInterval(() => {
        count--;
        if (count > 0) {
            countEl.innerText = count;
        } else {
            clearInterval(iv);
            document.getElementById('countdown-screen').style.display = 'none';
            document.getElementById('question-screen').style.display = 'block';
            renderQuestion();
        }
    }, 1000);
});

function shuffleArray(array) {
    const newArr = [...array];
    for (let i = newArr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
    }
    return newArr;
}

// ================= 3. RENDER CÂU HỎI VÀ ANIMATION =================
function renderQuestion() {
    if (currentQuestionIndex >= questions.length) {
        finishPractice();
        return;
    }

    const q = questions[currentQuestionIndex];
    
    // --- 1. Cập nhật thanh Progress Bar ---
    const progressPercent = (currentQuestionIndex / questions.length) * 100;
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = progressPercent + '%';

    // --- 2. Kích hoạt hiệu ứng Animation trượt ---
    const questionContent = document.getElementById('question-content');
    if (questionContent) {
        questionContent.classList.remove('fade-in-right');
        void questionContent.offsetWidth; // Force DOM reflow để kích hoạt lại animation
        questionContent.classList.add('fade-in-right');
    }

    // --- 3. Đổ dữ liệu text ---
    const qTextEl = document.getElementById('q-text');
    qTextEl.innerText = `Câu ${currentQuestionIndex + 1}/${questions.length}: ${q.text || q.question}`; 
    
    const optionsContainer = document.getElementById('options-container');
    optionsContainer.innerHTML = '';
    
    const feedback = document.getElementById('answer-feedback');
    if (feedback) feedback.innerHTML = '';
    
    // Nút tiếp theo
    let nextBtn = document.getElementById('btn-next');
    if (!nextBtn) {
        nextBtn = document.createElement('button');
        nextBtn.id = 'btn-next';
        nextBtn.className = 'btn';
        nextBtn.innerText = 'Tiếp theo (Phím Space)';
        nextBtn.style.marginTop = '20px';
        nextBtn.style.background = '#3498db';
        nextBtn.style.color = 'white';
        nextBtn.style.padding = '10px 20px';
        nextBtn.style.fontSize = '1.1rem';
        nextBtn.style.cursor = 'pointer';
        nextBtn.style.border = 'none';
        nextBtn.style.borderRadius = '8px';
        nextBtn.onclick = () => {
            currentQuestionIndex++;
            renderQuestion();
        };
        document.getElementById('question-content').appendChild(nextBtn);
    }
    nextBtn.style.display = 'none';

    const shuffledOptions = shuffleArray(q.options);

    shuffledOptions.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.dataset.option = opt;
        btn.innerHTML = `<span class="key-hint" style="background:#eee; padding:2px 8px; border-radius:4px; margin-right:10px;">${idx + 1}</span> ${opt}`;
        
        btn.onclick = () => checkAnswer(btn, opt, q.correctAnswer);
        optionsContainer.appendChild(btn);
    });

    startTimer();
}

// ================= 4. THỜI GIAN =================
function startTimer() {
    clearInterval(localTimerInterval);
    timeLeft = 60; 
    const timerDisplays = document.querySelectorAll('.timer');
    timerDisplays.forEach(el => el.innerText = timeLeft);

    localTimerInterval = setInterval(() => {
        timeLeft--;
        timerDisplays.forEach(el => el.innerText = timeLeft);
        totalTimeTaken++;
        
        if (timeLeft <= 0) {
            clearInterval(localTimerInterval);
            handleTimeOut();
        }
    }, 1000);
}

// ================= 5. KIỂM TRA ĐÁP ÁN =================
function checkAnswer(selectedBtn, selectedOption, correctAnswer) {
    clearInterval(localTimerInterval); 
    
    const buttons = document.querySelectorAll('.option-btn');
    buttons.forEach(btn => btn.disabled = true);
    
    const feedback = document.getElementById('answer-feedback');
    
    if (selectedOption === correctAnswer) {
        selectedBtn.classList.add('correct');
        selectedBtn.style.background = '#d4edda';
        selectedBtn.style.borderColor = '#28a745';
        if (feedback) {
            feedback.innerText = '✅ Chính xác!';
            feedback.style.color = '#28a745';
        }
        correctAnswersCount++;
        const scoreEl = document.getElementById('my-score');
        if (scoreEl) scoreEl.innerText = `${correctAnswersCount} điểm`;
    } else {
        selectedBtn.classList.add('wrong');
        selectedBtn.style.background = '#f8d7da';
        selectedBtn.style.borderColor = '#dc3545';
        if (feedback) {
            feedback.innerText = '❌ Sai rồi!';
            feedback.style.color = '#dc3545';
        }
        
        buttons.forEach(btn => {
            if (btn.dataset.option === correctAnswer) {
                btn.style.background = '#d4edda';
                btn.style.borderColor = '#28a745';
            }
        });
    }
    document.getElementById('btn-next').style.display = 'inline-block';
}

function handleTimeOut() {
    const q = questions[currentQuestionIndex];
    const buttons = document.querySelectorAll('.option-btn');
    
    buttons.forEach(btn => {
        btn.disabled = true;
        if (btn.dataset.option === q.correctAnswer) {
            btn.style.background = '#d4edda';
            btn.style.borderColor = '#28a745';
        }
    });
    
    const feedback = document.getElementById('answer-feedback');
    if (feedback) {
        feedback.innerText = '⏰ Hết giờ!';
        feedback.style.color = '#e74c3c';
    }
    document.getElementById('btn-next').style.display = 'inline-block';
}

// ================= 6. LƯU BẢNG XẾP HẠNG =================
async function finishPractice() {
    document.getElementById('question-screen').style.display = 'none';
    const resScreen = document.getElementById('result-screen');
    resScreen.style.display = 'flex';
    resScreen.style.flexDirection = 'column';
    resScreen.style.alignItems = 'center';
    
    // Đầy thanh tiến trình lúc kết thúc
    const progressBar = document.getElementById('progress-bar');
    if (progressBar) progressBar.style.width = '100%';

    resScreen.innerHTML = `
        <h1 style="color: #f39c12; font-size: 3rem;">🎉 HOÀN THÀNH ÔN TẬP 🎉</h1>
        <h2>Điểm của bạn: <span style="color:#2ecc71">${correctAnswersCount}</span> / ${questions.length}</h2>
        <p style="font-size: 1.2rem; margin-top: 10px;">⏳ Thời gian làm bài: ${totalTimeTaken} giây</p>
        <p style="color: #7f8c8d; font-style: italic; margin-top: 15px;">(Chế độ ôn tập: Lưu kết quả xếp hạng nhưng không cộng Token)</p>
        <button class="btn" onclick="window.location.href='quiz-detail.html?id=${quizId}'" style="margin-top:25px; padding: 15px 30px; background: #3498db; color: white; font-size: 1.2rem; border-radius:8px; border:none; cursor:pointer;">🏆 Xem bảng xếp hạng</button>
    `;

    try {
        const qCount = query(collection(db, `quiz_leaderboards/${quizId}/records`), where("uid", "==", currentUser.uid));
        const countSnap = await getDocs(qCount);
        const attempts = countSnap.size + 1;

        await addDoc(collection(db, `quiz_leaderboards/${quizId}/records`), {
            uid: currentUser.uid,
            displayName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'Ẩn danh'),
            score: correctAnswersCount,
            totalQuestions: questions.length,
            timeTaken: totalTimeTaken,
            attempts: attempts,
            timestamp: serverTimestamp()
        });
    } catch (err) {
        console.error("Lỗi lưu kết quả:", err);
    }
}

// ================= 7. LẮNG NGHE PHÍM TẮT =================
document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const options = document.querySelectorAll('.option-btn');
    const nextBtn = document.getElementById('btn-next');
    const keyMap = { 'Digit1': 0, 'Numpad1': 0, 'Digit2': 1, 'Numpad2': 1, 'Digit3': 2, 'Numpad3': 2, 'Digit4': 3, 'Numpad4': 3 };

    if (e.code in keyMap) {
        const index = keyMap[e.code];
        if (options[index] && !options[index].disabled) {
            options[index].click(); 
        }
    }

    if (e.code === 'Space') {
        if (nextBtn && nextBtn.style.display !== 'none') {
            e.preventDefault(); 
            nextBtn.click();
        }
    }
});