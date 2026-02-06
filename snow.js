/**
 * ========================================
 * 🌼 TET EFFECT - HOA MAI & PHÁO HOA
 * ========================================
 */

// 1. TẠO HOA MAI RƠI (Dựa trên code tuyết của bạn)
function createApricotBlossoms() {
    const containerId = 'tet-container';
    document.getElementById(containerId)?.remove();

    const container = document.createElement('div');
    container.id = containerId;
    document.body.appendChild(container);

    const flowerCount = 30; // Số lượng hoa vừa phải
    const symbols = ['✿', '✽', '✾']; // Ký tự hoa

    for (let i = 0; i < flowerCount; i++) {
        const flower = document.createElement('div');
        flower.className = 'hoamai';
        flower.textContent = symbols[Math.floor(Math.random() * symbols.length)];

        // Vị trí ngẫu nhiên
        flower.style.left = Math.random() * 100 + 'vw';
        
        // --- GIỮ LOGIC HAY CỦA BẠN: Delay âm để hoa xuất hiện ngay ---
        // Thời gian rơi từ 10s đến 25s cho tự nhiên
        const duration = Math.random() * 15 + 10;
        flower.style.animationDuration = duration + 's';
        
        // Delay âm giúp hoa rải đều màn hình ngay khi F5
        flower.style.animationDelay = -(Math.random() * 20) + 's';

        // Độ trôi ngang (Drift)
        const drift = (Math.random() - 0.5) * 150; // Trôi tầm -75px đến 75px
        flower.style.setProperty('--drift', drift + 'px');

        container.appendChild(flower);
    }
}

// Chạy hiệu ứng hoa mai khi load
window.addEventListener('load', createApricotBlossoms);

function launchFirework(x, y) {
    const rocket = document.createElement('div');
    rocket.className = 'firework-rocket';
    
    // Tên lửa xuất phát từ đáy màn hình
    rocket.style.left = x + 'px';
    rocket.style.top = window.innerHeight + 'px';
    
    // Quãng đường bay thẳng tới vị trí chuột
    const distY = y - window.innerHeight;
    rocket.style.setProperty('--flyY', distY + 'px');

    document.body.appendChild(rocket);

    // Ngay khi kết thúc animation bay (0.3s) là nổ liền
    rocket.addEventListener('animationend', () => {
        createExplosion(x, y);
        rocket.remove();
    });
}

function createExplosion(x, y) {
    const count = 40;
    const colors = ['#FFD700', '#FF3366', '#00FF99', '#00CCFF', '#FF66FF', '#FFFFFF'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    for (let i = 0; i < count; i++) {
        const p = document.createElement('div');
        p.className = 'firework-particle';
        p.style.left = x + 'px';
        p.style.top = y + 'px';
        p.style.backgroundColor = color;
        p.style.boxShadow = `0 0 10px ${color}`;

        // Nổ bung tròn 360 độ, không cộng thêm trọng lực
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * 150 + 50; // Lực nổ mạnh
        
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        p.style.setProperty('--x', tx + 'px');
        p.style.setProperty('--y', ty + 'px');

        document.body.appendChild(p);
        p.addEventListener('animationend', () => p.remove());
    }
}

// Click là bắn vút lên nổ liền
window.addEventListener('mousedown', (e) => {
    launchFirework(e.clientX, e.clientY);
});