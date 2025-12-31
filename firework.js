const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
let fireworks = [];
let currentScript = [];
let startTime = 0;
let isPlaying = false;

function resize() {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.parentElement.clientWidth || window.innerWidth;
    const h = canvas.parentElement.clientHeight || window.innerHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + "px"; canvas.style.height = h + "px";
    ctx.scale(dpr, dpr);
}
window.addEventListener("resize", resize);
resize();

class Particle {
    constructor(x, y, color, vx, vy, life, sparkle) {
        this.x = x; this.y = y; this.vx = vx; this.vy = vy;
        this.color = color; this.life = life; this.maxLife = life;
        this.sparkle = sparkle; this.alpha = 1;
    }
    update() {
        this.vx *= 0.95; this.vy *= 0.95; this.vy += 0.08;
        this.x += this.vx; this.y += this.vy; this.life--;
        this.alpha = Math.max(0, this.life / this.maxLife);
    }
    draw() {
        if (this.sparkle && Math.random() > 0.5) return;
        ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, 1.5, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
}

class Firework {
    constructor(data) {
        this.data = data;
        const w = canvas.width / (window.devicePixelRatio || 1);
        const h = canvas.height / (window.devicePixelRatio || 1);
        this.x = data.x * w; this.y = h;
        this.targetY = data.y * h;
        this.color = data.color;
        this.exploded = false; this.particles = [];
    }
    update() {
        if (!this.exploded) {
            this.y -= 10;
            if (this.y <= this.targetY) { this.explode(); this.exploded = true; }
        } else {
            this.particles.forEach(p => p.update());
            this.particles = this.particles.filter(p => p.life > 0);
        }
    }
    explode() {
    if (this.data.type === 'text') {
        const tempCanvas = document.createElement("canvas");
        const tCtx = tempCanvas.getContext("2d");
        const txt = (this.data.text || "").toUpperCase();
        
        // Tự động điều chỉnh kích thước canvas theo độ dài chữ
        const fontSize = 70;
        tCtx.font = `bold ${fontSize}px Arial`;
        const metrics = tCtx.measureText(txt);
        tempCanvas.width = metrics.width + 20;
        tempCanvas.height = fontSize + 20;

        // Vẽ lại lần nữa sau khi set width/height
        tCtx.fillStyle = "white";
        tCtx.font = `bold ${fontSize}px Arial`;
        tCtx.textAlign = "center";
        tCtx.textBaseline = "middle";
        tCtx.fillText(txt, tempCanvas.width / 2, tempCanvas.height / 2);

        const imgData = tCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height).data;
        const step = txt.length > 5 ? 5 : 3; // Chữ dài thì thưa hạt hơn để tránh lag

        for (let y = 0; y < tempCanvas.height; y += step) {
            for (let x = 0; x < tempCanvas.width; x += step) {
                if (imgData[(y * tempCanvas.width + x) * 4 + 3] > 128) {
                    // Chia nhỏ vận tốc để chữ bung ra mượt mà
                    const vx = (x - tempCanvas.width / 2) / 8;
                    const vy = (y - tempCanvas.height / 2) / 8;
                    this.particles.push(new Particle(this.x, this.y, this.color, vx, vy, 120));
                }
            }
        }
    } else {
        // Nổ chùm bình thường nhưng tăng số lượng hạt cho "đã"
        for (let i = 0; i < 120; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 10 + 2;
            this.particles.push(new Particle(this.x, this.y, this.color, Math.cos(angle)*speed, Math.sin(angle)*speed, 100));
        }
    }
}
    draw() {
        if (!this.exploded) {
            ctx.fillStyle = "white"; ctx.beginPath(); ctx.arc(this.x, this.y, 3, 0, Math.PI * 2); ctx.fill();
        } else this.particles.forEach(p => p.draw());
    }
}

window.runFireworkScript = (script) => {
    currentScript = script.map(it => ({...it, fired: false, currentLoop: 1}));
    startTime = performance.now(); fireworks = []; isPlaying = true;
};

function animate() {
    ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (isPlaying) {
        let elapsed = (performance.now() - startTime) / 1000;
        currentScript.forEach(item => {
            if (elapsed >= item.s && !item.fired && item.currentLoop <= (item.loopCount || 1)) {
                fireworks.push(new Firework(item)); item.fired = true;
            }
        });
    }
    fireworks.forEach((f, i) => {
        f.update(); f.draw();
        if (f.exploded && f.particles.length === 0) {
            let src = currentScript.find(it => it.s === f.data.s && it.x === f.data.x);
            if (src && src.currentLoop < src.loopCount) { src.currentLoop++; src.fired = false; }
            fireworks.splice(i, 1);
        }
    });
    requestAnimationFrame(animate);
}
animate();