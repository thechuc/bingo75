const socket = io();
let playerID = 0;
let hasBingo = false;
const sound = document.getElementById("winSound");
window.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const session = urlParams.get('session');
    if (session) {
        document.getElementById('sessionId').value = session;
    }
});

document.getElementById('joinBtn').onclick = () => {
    const name = document.getElementById('playerName').value.trim();
    const session = document.getElementById('sessionId').value.trim() || 'default';
    if (!name) return alert('Nhập tên!');
    socket.emit('joinSession', { sessionId: session, playerName: name });
};

socket.on('cardAssigned', ({ card, playerName, playerId }) => {
    playerID = playerId;
    document.getElementById('joinArea').style.display = 'none';
    document.getElementById('gameArea').style.display = 'block';
    document.getElementById('playerLabel').textContent = `Xin chào ${playerName}`;
    renderCard(card, playerId);
});

socket.on('numberCalled', num => {
    if (hasBingo == true) return;
    const badge = document.createElement('span');
    badge.className = 'badge bg-danger';
    badge.textContent = num;
    document.getElementById('calledNumbers').appendChild(badge);

    document.querySelectorAll('td').forEach(td => {
        if (td.textContent == num) td.classList.add('marked');
    });
});

socket.on('winnerAnnounced', ({ players }) => {
    const box = document.getElementById('winnerBox');
    box.classList.remove('d-none');
    let name = ``;
    players.forEach(({ player, bingoCells }) => {
        name = `${player.name}`;
        if (playerID == player.id) {
            hasBingo = true;
            bingoCells.forEach(cell => {
                const selector = `[data-row="${cell.r}"][data-col="${cell.c}"]`;
                const td = document.querySelector(selector);
                if (td) td.classList.add('bingo'); // class 'bingo' có thể đổi màu riêng
            });
            // Phát nhạc chiến thắng
            if (sound) {
                sound.currentTime = 0;
                sound.play().catch(e => console.warn("Autoplay blocked:", e));
            }
            showWinnerName();
            // Bắn pháo hoa
            launchFireworksWithTwinkle();
        }
    });
    box.innerHTML = `🎉 Người thắng: <strong>${name}</strong>`;
});

function showWinnerName() {
    const modal = document.getElementById("winnerModal");
    modal.classList.remove("hidden");
}

function launchFireworksWithTwinkle() {
    const canvas = document.getElementById("realFireworks");
    const ctx = canvas.getContext("2d");

    // Thiết lập kích thước canvas một lần duy nhất
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    const colors = ['#fff', '#ffd700', '#00e5ff', '#ff4081', '#f8f8f8', '#39ff14', '#ff6f61', '#7b68ee'];

    const rockets = [];
    const particles = [];
    const MAX_ROCKETS = 6;
    const MAX_PARTICLES = 150;

    // Tạo rocket mới (tia bắn lên)
    function createRocket() {
        if (rockets.length >= MAX_ROCKETS) return;
        const color = colors[Math.floor(Math.random() * colors.length)];
        rockets.push({
            x: Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
            y: canvas.height,
            vx: (Math.random() - 0.5) * 2,
            vy: -(Math.random() * 7 + 13), // tốc độ bắn lên nhanh
            alpha: 1,
            radius: 3,
            color,
            exploded: false,
            trail: [],
            maxTrailLength: 10
        });
    }

    // Tạo explosion nhiều hạt nhiều màu sắc
    function createExplosion(x, y) {
        const count = 40;
        if (particles.length + count > MAX_PARTICLES) return;
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * 2 * Math.PI;
            const speed = Math.random() * 4 + 2;
            const radius = Math.random() * 1.5 + 0.2;
            const color = colors[Math.floor(Math.random() * colors.length)];
            particles.push({
                x,
                y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                alpha: 1,
                radius,
                color,
                gravity: 0.15,
                trail: [],
                maxTrailLength: 12,
                twinklePhase: Math.random() * Math.PI * 3
            });
        }
    }

    function updateRockets() {
        for (let i = rockets.length - 1; i >= 0; i--) {
            const r = rockets[i];

            r.x += r.vx;
            r.y += r.vy;
            r.vy += 0.1; // trọng lực nhỏ kéo chậm rocket

            // Lưu vệt trail
            r.trail.push({ x: r.x, y: r.y });
            if (r.trail.length > r.maxTrailLength) r.trail.shift();

            // Nổ khi đạt đỉnh hoặc lên cao đủ
            if (!r.exploded && (r.vy >= 0 || r.y < canvas.height / 3)) {
                r.exploded = true;
                createExplosion(r.x, r.y);
                rockets.splice(i, 1);
                continue;
            }

            r.alpha -= 0.01;
            if (r.alpha <= 0) rockets.splice(i, 1);
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];

            p.x += p.vx;
            p.y += p.vy;
            p.vy += p.gravity;

            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > p.maxTrailLength) p.trail.shift();

            p.alpha -= 0.015;
            p.twinklePhase += 0.1;

            if (p.alpha <= 0) particles.splice(i, 1);
        }
    }

    function drawTrails(points, color, alpha, lineWidth, shadowBlur) {
        if (points.length < 2) return;
        ctx.save();
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = shadowBlur;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        for (let i = 0; i < points.length - 1; i++) {
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[i + 1].x, points[i + 1].y);
        }
        ctx.stroke();
        ctx.restore();
    }

    function draw() {
        // Clear canvas với alpha nhỏ tạo đuôi mờ dần
        ctx.fillStyle = "rgba(0, 0, 0, 0.15)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Vẽ rocket
        rockets.forEach(r => {
            drawTrails(r.trail, r.color, r.alpha * 0.7, r.radius * 2, 12);

            ctx.save();
            ctx.globalAlpha = r.alpha;
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.fillStyle = r.color;
            ctx.shadowColor = r.color;
            ctx.shadowBlur = 20;
            ctx.fill();
            ctx.restore();
        });

        // Vẽ particles explosion
        particles.forEach(p => {
            const twinkleAlpha = 0.5 + 0.5 * Math.sin(p.twinklePhase);

            drawTrails(p.trail, p.color, p.alpha * twinkleAlpha * 0.8, p.radius * 2, 18);

            ctx.save();
            ctx.globalAlpha = p.alpha * twinkleAlpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 25;
            ctx.fill();
            ctx.restore();

            // Chấm nhỏ lấp lánh ngẫu nhiên
            if (Math.random() < 0.3 && p.trail.length) {
                const glitterPos = p.trail[Math.floor(Math.random() * p.trail.length)];
                ctx.save();
                ctx.globalAlpha = p.alpha * (0.3 + 0.7 * Math.random());
                ctx.fillStyle = p.color;
                ctx.shadowColor = p.color;
                ctx.shadowBlur = 15;
                ctx.beginPath();
                ctx.arc(glitterPos.x, glitterPos.y, p.radius / 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });
    }

    function animate() {
        updateRockets();
        updateParticles();
        draw();
        requestAnimationFrame(animate);
    }

    function triggerFireworks() {
        canvas.style.display = 'block';
        const interval = setInterval(() => {
            createRocket();
        }, 600);

        setTimeout(() => {
            clearInterval(interval);
            canvas.style.display = 'none';
            const modal = document.getElementById("winnerModal");
            modal.classList.add("hidden");

            if (sound) {
                sound.pause();
                sound.currentTime = 0;
            }
        }, 20000);
    }

    animate();
    triggerFireworks();
}
// Highlight đường Bingo thắng
function highlightWinner(winners) {
    winners.forEach(({ cardIndex, winPositions }) => {
        winPositions.forEach(([r, c]) => {
            const cell = document.querySelector(`#card-${cardIndex} td[data-row="${r}"][data-col="${c}"]`);
            if (cell) cell.classList.add('bingo');
        });
    });
}
function renderCard(grid, id) {
    const cardsContainer = document.getElementById('cardContainer');
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card-bingo';
    cardDiv.id = 'card-' + id;

    let html = `<table><thead><tr>`;
    ['B', 'I', 'N', 'G', 'O'].forEach(c => {
        html += `<th>${c}</th>`;
    });
    html += `</tr></thead><tbody>`;

    for (let r = 0; r < 5; r++) {
        html += '<tr>';
        for (let c = 0; c < 5; c++) {
            const val = grid[r][c];
            if (val === 'FREE') {
                html += `<td class="free marked" data-row="${r}" data-col="${c}">FREE</td>`;
            } else {
                html += `<td data-row="${r}" data-col="${c}">${val}</td>`;
            }
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    cardDiv.innerHTML = html;
    cardsContainer.appendChild(cardDiv);
}
