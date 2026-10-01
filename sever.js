const http = require('http');
const express = require('express');
const { Server } = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

let worldState = {
    day: 1,
    hour: 8,
    minute: 0,
    weather: 'Nắng',
    marketPrices: {
        'Rau củ': 10, 'Gạo': 15, 'Cà phê': 25, 'Trà sữa': 30,
        'Đồ ăn': 20, 'Nước': 5, 'Cá': 40, 'Thịt': 50
    }
};

let players = {};
let npcs = [
    { id: 'npc_1', name: 'Bà Ba', type: 'Cư dân', x: 12, z: 15, dir: 1 },
    { id: 'npc_2', name: 'Anh Tuấn', type: 'Công nhân', x: -25, z: 10, dir: -1 },
    { id: 'npc_3', name: 'Lan', type: 'Khách du lịch', x: 8, z: -20, dir: 1 },
    { id: 'npc_4', name: 'Minh', type: 'Nhân viên giao hàng', x: -15, z: -18, dir: -1 }
];

let vehicles = [
    { id: 'v_1', type: 'Ô tô', x: 0, z: -45, speed: 0.25, dir: 1 },
    { id: 'v_2', type: 'Xe buýt', x: 0, z: 45, speed: 0.15, dir: -1 },
    { id: 'v_3', type: 'Taxi', x: -45, z: 0, speed: 0.3, dir: 1 },
    { id: 'v_4', type: 'Xe đạp', x: 25, z: 25, speed: 0.1, dir: 1 }
];

let businesses = {
    'b_cafe': { id: 'b_cafe', name: 'Quán Cà Phê Phố', type: 'Quán cà phê', owner: null, level: 1, funds: 2000, revenue: 0, reputation: 50, employees: [], stock: {'Cà phê': 50}, furniture: [], isOpen: false },
    'b_food': { id: 'b_food', name: 'Quán Ăn Nhanh', type: 'Quán ăn', owner: null, level: 1, funds: 3000, revenue: 0, reputation: 50, employees: [], stock: {'Đồ ăn': 50, 'Nước': 30}, furniture: [], isOpen: false },
    'b_hotel': { id: 'b_hotel', name: 'Khách Sạn Ánh Dương', type: 'Khách sạn', owner: null, level: 1, funds: 10000, revenue: 0, reputation: 60, employees: [], stock: {}, furniture: [], isOpen: true },
    'b_market': { id: 'b_market', name: 'Siêu Thị Tiện Lợi', type: 'Siêu thị', owner: null, level: 1, funds: 8000, revenue: 0, reputation: 55, employees: [], stock: {'Rau củ': 100, 'Gạo': 100}, furniture: [], isOpen: true }
};

setInterval(() => {
    worldState.minute += 5;
    if (worldState.minute >= 60) {
        worldState.minute = 0;
        worldState.hour += 1;
        if (worldState.hour >= 24) {
            worldState.hour = 0;
            worldState.day += 1;
        }
    }
    if (worldState.minute === 0) {
        const weathers = ['Nắng', 'Nhiều mây', 'Mưa nhẹ', 'Mưa lớn', 'Bão', 'Gió lớn'];
        if (Math.random() < 0.3) worldState.weather = weathers[Math.floor(Math.random() * weathers.length)];
        for (let item in worldState.marketPrices) {
            let diff = Math.floor(Math.random() * 5) - 2;
            worldState.marketPrices[item] = Math.max(5, worldState.marketPrices[item] + diff);
        }
    }

    npcs.forEach(n => {
        n.x += n.dir * 0.08;
        if (Math.abs(n.x) > 50) n.dir *= -1;
    });

    vehicles.forEach(v => {
        v.x += v.speed * v.dir;
        if (Math.abs(v.x) > 120) v.dir *= -1;
    });
}, 500);

wss.on('connection', (ws) => {
    let playerId = null;

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            if (data.type === 'join') {
                playerId = 'p_' + Math.random().toString(36).substr(2, 6);
                players[playerId] = {
                    id: playerId,
                    name: data.name || 'Cư dân',
                    gender: data.gender || 'Nam',
                    x: 0, y: 0, z: 5, rotY: 0,
                    money: 5000, energy: 100, hunger: 100,
                    job: 'Tự do',
                    inventory: { 'Rau củ': 10, 'Gạo': 10, 'Cà phê': 5 },
                    onBike: false, anim: 'idle'
                };
                ws.send(JSON.stringify({ type: 'init', id: playerId }));
            } else if (data.type === 'update_pos' && playerId && players[playerId]) {
                let p = players[playerId];
                p.x = data.x; p.y = data.y; p.z = data.z;
                p.rotY = data.rotY; p.onBike = data.onBike; p.anim = data.anim;
            } else if (data.type === 'buy_market') {
                let p = players[playerId];
                let cost = worldState.marketPrices[data.item] * data.qty;
                if (p && p.money >= cost) {
                    p.money -= cost;
                    p.inventory[data.item] = (p.inventory[data.item] || 0) + data.qty;
                    ws.send(JSON.stringify({ type: 'notify', msg: `Mua thành công ${data.qty} ${data.item}!` }));
                } else {
                    ws.send(JSON.stringify({ type: 'notify', msg: 'Không đủ tiền thanh toán!' }));
                }
            } else if (data.type === 'manage_business') {
                let b = businesses[data.businessId];
                let p = players[playerId];
                if (b && p) {
                    if (data.action === 'buy' && b.owner === null && p.money >= 5000) {
                        p.money -= 5000;
                        b.owner = playerId;
                        ws.send(JSON.stringify({ type: 'notify', msg: `Sở hữu thành công ${b.name}!` }));
                    } else if (data.action === 'toggle' && b.owner === playerId) {
                        b.isOpen = !b.isOpen;
                        ws.send(JSON.stringify({ type: 'notify', msg: `Trạng thái: ${b.isOpen ? 'Mở cửa' : 'Đóng cửa'}` }));
                    }
                }
            } else if (data.type === 'chat') {
                let name = players[playerId] ? players[playerId].name : 'Ẩn danh';
                wss.clients.forEach(client => {
                    if (client.readyState === ws.OPEN) {
                        client.send(JSON.stringify({ type: 'chat', sender: name, msg: data.msg }));
                    }
                });
            }
        } catch (e) { console.error(e); }
    });

    ws.on('close', () => { if (playerId) delete players[playerId]; });
});

setInterval(() => {
    const packet = JSON.stringify({
        type: 'state',
        world: worldState,
        players: players,
        npcs: npcs,
        vehicles: vehicles,
        businesses: businesses
    });
    wss.clients.forEach(client => {
        if (client.readyState === ws.OPEN) client.send(packet);
    });
}, 50);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server đang chạy tại http://localhost:${PORT}`);
});
