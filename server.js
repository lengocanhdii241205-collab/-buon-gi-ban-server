const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// --- QUẢN LÝ TRẠNG THÁI TOÀN CỤC (WORLD STATE) ---
const gameState = {
  world: {
    day: 1,
    time: 8, // 0 - 24h
    weather: 'Sunny', // 'Sunny', 'Cloudy', 'LightRain', 'HeavyRain', 'Storm'
    windSpeed: 5
  },
  players: {},
  npcs: [],
  vehicles: [],
  buildings: [
    { id: 'b1', name: 'Quán Cà Phê Mây', type: 'Cafe', x: -30, z: -30, price: 5000, rentedBy: null },
    { id: 'b2', name: 'Siêu Thị Mini', type: 'Supermarket', x: 30, z: -30, price: 12000, rentedBy: null },
    { id: 'b3', name: 'Khách Sạn Biển', type: 'Hotel', x: -30, z: 30, price: 25000, rentedBy: null },
    { id: 'b4', name: 'Quán Trà Sữa GenZ', type: 'Boba', x: 30, z: 30, price: 8000, rentedBy: null }
  ],
  market: {
    'Rau củ': { buy: 10, sell: 8 },
    'Gạo': { buy: 20, sell: 16 },
    'Cà phê': { buy: 15, sell: 12 },
    'Trà sữa': { buy: 25, sell: 20 },
    'Thịt': { buy: 40, sell: 32 },
    'Cá': { buy: 35, sell: 28 },
    'Nước': { buy: 5, sell: 4 }
  }
};

// Khởi tạo NPCs thành phố
const npcRoles = ['Khách hàng', 'Khách du lịch', 'Cư dân', 'Công nhân', 'Học sinh', 'Giao hàng'];
for (let i = 0; i < 20; i++) {
  gameState.npcs.push({
    id: `npc_${i}`,
    name: `NPC ${i + 1}`,
    role: npcRoles[i % npcRoles.length],
    x: (Math.random() - 0.5) * 180,
    z: (Math.random() - 0.5) * 180,
    dir: Math.random() * Math.PI * 2
  });
}

// Vòng lặp thời gian & thời tiết
setInterval(() => {
  gameState.world.time += 0.05;
  if (gameState.world.time >= 24) {
    gameState.world.time = 0;
    gameState.world.day += 1;
  }
  
  // Ngẫu nhiên chuyển đổi thời tiết
  if (Math.random() < 0.01) {
    const weathers = ['Sunny', 'Cloudy', 'LightRain', 'HeavyRain', 'Storm'];
    gameState.world.weather = weathers[Math.floor(Math.random() * weathers.length)];
  }

  // Cập nhật di chuyển NPC
  gameState.npcs.forEach(npc => {
    npc.x += Math.sin(npc.dir) * 0.2;
    npc.z += Math.cos(npc.dir) * 0.2;
    if (Math.abs(npc.x) > 90 || Math.abs(npc.z) > 90) {
      npc.dir += Math.PI;
    }
  });

  // Biến động giá thị trường nhỏ
  for (let key in gameState.market) {
    const change = (Math.random() - 0.5) * 0.4;
    gameState.market[key].buy = Math.max(2, +(gameState.market[key].buy + change).toFixed(1));
    gameState.market[key].sell = Math.max(1, +(gameState.market[key].buy * 0.8).toFixed(1));
  }
}, 1000);

// Quản lý kết nối WebSocket
wss.on('connection', (ws) => {
  let playerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);

      if (data.type === 'JOIN') {
        playerId = data.id;
        gameState.players[playerId] = {
          id: playerId,
          name: data.name,
          gender: data.gender,
          x: 0,
          y: 0,
          z: 0,
          rotY: 0,
          money: 1000,
          energy: 100,
          hunger: 100,
          job: 'Tự do',
          onBike: false,
          inventory: { 'Rau củ': 2, 'Nước': 5 }
        };
        ws.send(JSON.stringify({ type: 'INIT_RESPONSE', id: playerId }));
      }

      if (data.type === 'MOVE' && playerId && gameState.players[playerId]) {
        const p = gameState.players[playerId];
        p.x = data.x;
        p.y = data.y;
        p.z = data.z;
        p.rotY = data.rotY;
        p.onBike = data.onBike;
      }

      if (data.type === 'TOGGLE_BIKE' && playerId && gameState.players[playerId]) {
        gameState.players[playerId].onBike = !gameState.players[playerId].onBike;
      }

      if (data.type === 'BUY_ITEM' && playerId && gameState.players[playerId]) {
        const p = gameState.players[playerId];
        const item = data.item;
        const price = gameState.market[item]?.buy || 0;
        if (p.money >= price) {
          p.money -= price;
          p.inventory[item] = (p.inventory[item] || 0) + 1;
        }
      }

      if (data.type === 'SELL_ITEM' && playerId && gameState.players[playerId]) {
        const p = gameState.players[playerId];
        const item = data.item;
        const price = gameState.market[item]?.sell || 0;
        if (p.inventory[item] && p.inventory[item] > 0) {
          p.inventory[item] -= 1;
          p.money += price;
        }
      }

      if (data.type === 'CHAT') {
        broadcast({ type: 'CHAT', sender: data.sender, msg: data.msg });
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', () => {
    if (playerId) delete gameState.players[playerId];
  });
});

// Broadcast dữ liệu liên tục 20hz cho các client
setInterval(() => {
  broadcast({ type: 'STATE_UPDATE', state: gameState });
}, 50);

function broadcast(data) {
  const payload = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

server.listen(PORT, () => {
  console.log(`Server "Buon Gi Ban" dang chay tai: http://localhost:${PORT}`);
});
