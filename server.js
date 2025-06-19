const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.static('public'));
const PORT = process.env.PORT || 3000;

// sessions = { sessionId: { players: {}, calledNumbers: [] } }
const sessions = {};
const numbersPool = {};
const calledNumbers = {};

function createBingoCard() {
    const colRanges = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
    const card = [];
    for (let col of ['B', 'I', 'N', 'G', 'O']) {
        let nums = Array.from({ length: colRanges[col][1] - colRanges[col][0] + 1 },
            (_, i) => colRanges[col][0] + i);
        nums.sort(() => Math.random() - 0.5);
        card.push(col === 'N' ? nums.slice(0, 4) : nums.slice(0, 5));
    }

    let grid = Array(5).fill(0).map(() => Array(5).fill(null));
    for (let c = 0; c < 5; c++) {
        for (let r = 0; r < 5; r++) {
            const idx = (c === 2 && r > 1) ? r - 1 : r;
            grid[r][c] = (c === 2 && r === 2) ? 'FREE' : card[c][idx];
            const val = grid[r][c];
        }
    }
    return grid;
}

io.on('connection', socket => {
    socket.on('joinSession', ({ sessionId, playerName }) => {
        if (!sessions[sessionId]) {
            sessions[sessionId] = {
                players: {},
                calledNumbers: [],
                playerNextID: 0,
            };
        }
        const isHost = playerName === '[HOST]';
        if (!isHost) {
            const card = createBingoCard();
            let playerId = sessions[sessionId].playerNextID++;
            sessions[sessionId].players[socket.id] = {
                name: playerName,
                id: playerId,
                sockid: socket.id,
                card,
                marks: Array(5).fill(0).map(() => Array(5).fill(false)),
                win: false
            };
            io.to(socket.id).emit('cardAssigned', { card, playerName, playerId });
            socket.join(sessionId);
            updatePlayerList(sessionId);
        } else {
            sessions[sessionId].players[socket.id] = { name: '[HOST]' };
            socket.join(sessionId);
        }
    });
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    socket.on('startSpin', async sessionId => {
        const session = sessions[sessionId];
        if (!session) return;
        const pool = Array.from({ length: 75 }, (_, i) => i + 1)
            .filter(n => !session.calledNumbers.includes(n));
        if (pool.length === 0) return;

        // 💤 Delay 10 giây trước khi gửi số thật
        await sleep(1000);

        const number = pool[Math.floor(Math.random() * pool.length)];
        session.calledNumbers.push(number);
        io.to(sessionId).emit('numberCalled', number);
        let bingoCount = 0;
        let playersWin = [];

        for (const [sid, player] of Object.entries(session.players)) {
            if (!player.card || player.win) continue;
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 5; c++) {
                    if (player.card[r][c] === number) {
                        player.marks[r][c] = true;
                    }
                    if (player.card[r][c] === 'FREE') {
                        player.marks[r][c] = true;
                    }
                }
            }
            let bingoCells = [];
            const m = player.marks;
            // Kiểm tra hàng
            for (let r = 0; r < 5; r++) {
                if (m[r].every(v => v)) {
                    bingoCells = Array.from({ length: 5 }, (_, c) => ({ r, c }));
                    break;
                }
            }

            // Kiểm tra cột
            if (bingoCells.length === 0) {
                for (let c = 0; c < 5; c++) {
                    if (m.every(row => row[c])) {
                        bingoCells = Array.from({ length: 5 }, (_, r) => ({ r, c }));
                        break;
                    }
                }
            }

            // Kiểm tra chéo chính
            if (bingoCells.length === 0 && [0, 1, 2, 3, 4].every(i => m[i][i])) {
                bingoCells = Array.from({ length: 5 }, (_, i) => ({ r: i, c: i }));
            }

            // Kiểm tra chéo phụ
            if (bingoCells.length === 0 && [0, 1, 2, 3, 4].every(i => m[i][4 - i])) {
                bingoCells = Array.from({ length: 5 }, (_, i) => ({ r: i, c: 4 - i }));
            }

            if (bingoCells.length > 0) {
                player.win = true;
                bingoCount++;
                playersWin.push({ player: player, bingoCells: bingoCells });
            }
        }

        if (bingoCount > 0) {
            io.to(sessionId).emit('winnerAnnounced', {
                players: playersWin
            });
        }
    });

    socket.on('disconnect', () => {
        for (const sessionId of Object.keys(sessions)) {
            if (sessions[sessionId].players[socket.id]) {
                delete sessions[sessionId].players[socket.id];
                updatePlayerList(sessionId);
            }
        }
    });

    function updatePlayerList(sessionId) {
        const session = sessions[sessionId];
        if (!session) return;
        const names = Object.values(session.players)
            .filter(p => p.name !== '[HOST]')
            .map(p => p.name);
        io.to(sessionId).emit('playerListUpdate', names);
    }
});

server.listen(PORT, () => console.log(`🚀 Bingo server running on port ${PORT}`));
