/**
 * ========================================
 * ❄️ SNOW EFFECT - HIỆU ỨNG TUYẾT RƠI
 * File: snow-effect.js
 * ========================================
 */

// Tạo hiệu ứng tuyết rơi
function createSnowflakes() {
    document.getElementById('snow-container')?.remove();

    const snowContainer = document.createElement('div');
    snowContainer.id = 'snow-container';
    document.body.appendChild(snowContainer);

    const snowflakeCount = 50;

    for (let i = 0; i < snowflakeCount; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.textContent = '❄';

        snowflake.style.left = Math.random() * 100 + 'vw';
        snowflake.style.top = Math.random() * 100 + 'vh';

        // 💥 FIX DÍNH ĐẦU TRANG
        snowflake.style.animationDelay = -(Math.random() * 20) + 's';

        const drift = (Math.random() - 0.5) * 100;
        snowflake.style.setProperty('--drift', drift + 'px');

        snowContainer.appendChild(snowflake);
    }
}

window.addEventListener('load', createSnowflakes);
/*======================================*/
/* EFFECT CLICK */
function snowBurst(x, y) {
    const count = 35;

    for (let i = 0; i < count; i++) {
        const flake = document.createElement('div');
        flake.className = 'snow-burst';
        flake.textContent = '❄';

        flake.style.left = x + 'px';
        flake.style.top = y + 'px';
        flake.style.fontSize = Math.random() * 14 + 8 + 'px';

        const angle = Math.random() * Math.PI * 2;
        const distance = Math.random() * 50 + 100;

        flake.style.setProperty('--x', Math.cos(angle) * distance + 'px');
        flake.style.setProperty('--y', Math.sin(angle) * distance + 'px');

        document.body.appendChild(flake);

        flake.addEventListener('animationend', () => flake.remove());
    }
}

// Click chuột
window.addEventListener('click', (e) => {
    snowBurst(e.clientX, e.clientY);
});
