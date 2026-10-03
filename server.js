const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const gameState = {
    players: {},
    tables: [
        { id: 1, x: -6, z: -2, occupied: false, order: null, patience: 100 },
        { id: 2, x: -6, z: 2, occupied: false, order: null, patience: 100 },
        { id: 3, x: 6, z: -2, occupied: false, order: null, patience: 100 },
        { id: 4, x: 6, z: 2, occupied: false, order: null, patience: 100 }
    ],
    npcs: [],
    money: 100,
    reputation: 50,
    time: 8, // Bắt đầu lúc 8:00 sáng
    weather: 'SUNNY' // SUNNY, RAINY, SNOWY, WINDY, STORM
};

let nextNpcId = 1;
const menuItems = ['Phở Bò', 'Cơm Tấm', 'Trà Sữa', 'Bánh Mì'];
const weatherList = ['SUNNY', 'RAINY', 'SNOWY', 'WINDY', 'STORM'];

function broadcast(data) {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// Thay đổi thời tiết mỗi 45 giây ngẫu nhiên
setInterval(() => {
    const randomWeather = weatherList[Math.floor(Math.random() * weatherList.length)];
    gameState.weather = randomWeather;
}, 45000);

// Game Loop (30 FPS)
setInterval(() => {
    // Tăng thời gian trong game (1 giây thực = 10 phút trong game)
    gameState.time += 0.005;
    if (gameState.time >= 24) gameState.time = 0; // Reset qua ngày mới

    // 1. Sinh NPC khách hàng (Trời mưa/bão khách có thể ít hơn hoặc nhanh đói hơn)
    const spawnChance = (gameState.weather === 'STORM' || gameState.weather === 'RAINY') ? 0.2 : 0.4;
    const freeTable = gameState.tables.find(t => !t.occupied);
    
    if (freeTable && gameState.npcs.length < gameState.tables.length && Math.random() < spawnChance) {
        freeTable.occupied = true;
        const randomOrder = menuItems[Math.floor(Math.random() * menuItems.length)];
        freeTable.order = randomOrder;
        freeTable.patience = gameState.weather === 'STORM' ? 70 : 100; // Bão khách dễ mất kiên nhẫn hơn

        const npc = {
            id: nextNpcId++,
            tableId: freeTable.id,
            x: 0,
            z: 10,
            targetX: freeTable.x,
            targetZ: freeTable.z,
            state: 'WALKING_TO_TABLE',
            order: randomOrder
        };
        gameState.npcs.push(npc);
    }

    // 2. Cập nhật NPC
    gameState.npcs.forEach((npc, index) => {
        const table = gameState.tables.find(t => t.id === npc.tableId);
        
        if (npc.state === 'WALKING_TO_TABLE') {
            const dx = npc.targetX - npc.x;
            const dz = npc.targetZ - npc.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.2) {
                npc.x = npc.targetX;
                npc.z = npc.targetZ;
                npc.state = 'WAITING';
            } else {
                npc.x += (dx / dist) * 0.1;
                npc.z += (dz / dist) * 0.1;
            }
        } else if (npc.state === 'WAITING') {
            if (table) {
                table.patience -= 1;
                if (table.patience <= 0) {
                    table.occupied = false;
                    table.order = null;
                    table.patience = 100;
                    npc.state = 'LEAVING';
                    npc.targetX = 0;
                    npc.targetZ = 10;
                    gameState.reputation = Math.max(0, gameState.reputation - 5);
                }
            }
        } else if (npc.state === 'LEAVING') {
            const dx = npc.targetX - npc.x;
            const dz = npc.targetZ - npc.z;
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist < 0.2) {
                gameState.npcs.splice(index, 1);
            } else {
                npc.x += (dx / dist) * 0.1;
                npc.z += (dz / dist) * 0.1;
            }
        }
    });

    broadcast({ type: 'STATE_UPDATE', state: gameState });
}, 1000 / 30);

wss.on('connection', (ws) => {
    const playerId = Math.random().toString(36).substring(7);
    gameState.players[playerId] = { x: 0, z: 8, color: '#' + Math.floor(Math.random()*16777215).toString(16) };

    ws.send(JSON.stringify({ type: 'INIT', playerId, state: gameState }));

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'MOVE') {
                if (gameState.players[playerId]) {
                    gameState.players[playerId].x = data.x;
                    gameState.players[playerId].z = data.z;
                }
            } else if (data.type === 'SERVE') {
                const table = gameState.tables.find(t => t.id === data.tableId);
                const npc = gameState.npcs.find(n => n.tableId === data.tableId);
                if (table && table.occupied && npc && npc.state === 'WAITING') {
                    npc.state = 'EATING';
                    table.order = 'Đang ăn...';
                    
                    setTimeout(() => {
                        table.occupied = false;
                        table.order = null;
                        table.patience = 100;
                        npc.state = 'LEAVING';
                        npc.targetX = 0;
                        npc.targetZ = 10;
                        gameState.money += 25; // Thưởng cao hơn chút
                        gameState.reputation = Math.min(100, gameState.reputation + 2);
                        broadcast({ type: 'STATE_UPDATE', state: gameState });
                    }, 3000);
                }
            }
        } catch (e) {
            console.error(e);
        }
    });

    ws.on('close', () => {
        delete gameState.players[playerId];
        broadcast({ type: 'STATE_UPDATE', state: gameState });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Quán ăn mở cửa với Thời tiết động tại: http://localhost:${PORT}`);
});
