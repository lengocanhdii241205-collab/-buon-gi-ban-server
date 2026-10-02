const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// File lưu dữ liệu giả lập (hoặc theo index/ID người chơi)
const DB_FILE = path.join(__dirname, 'game_database.json');

// Đọc dữ liệu từ file JSON
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            const data = fs.readFileSync(DB_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Lỗi đọc database:", e);
    }
    return {};
}

// Lưu dữ liệu vào file JSON
function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (e) {
        console.error("Lỗi ghi database:", e);
    }
}

// API kiểm tra server hoạt động
app.get('/', (req, res) => {
    res.send('Server Buôn Gì Bán đang chạy ổn định!');
});

// API Lưu game theo ID/Index người chơi
app.post('/api/save', (req, res) => {
    const { playerId, gameState } = req.body;
    if (!playerId) {
        return res.status(400).json({ success: false, message: 'Thiếu playerId (index)' });
    }
    
    let db = loadDB();
    db[playerId] = {
        state: gameState,
        updatedAt: new Date().toISOString()
    };
    saveDB(db);
    
    res.json({ success: true, message: 'Lưu game lên server thành công!' });
});

// API Tải game theo ID/Index người chơi
app.get('/api/load/:playerId', (req, res) => {
    const playerId = req.params.playerId;
    const db = loadDB();
    
    if (db[playerId]) {
        res.json({ success: true, data: db[playerId].state });
    } else {
        res.status(404).json({ success: false, message: 'Không tìm thấy dữ liệu nhân vật này!' });
    }
});

// Xử lý kết nối thời gian thực (Socket.io) nếu muốn chạy song song nhiều người chơi thấy nhau trên bản đồ
io.on('connection', (socket) => {
    console.log(`Người chơi kết nối: ${socket.id}`);

    // Nhận tọa độ di chuyển và phát lại cho các người chơi khác trên bản đồ song song
    socket.on('playerMove', (data) => {
        socket.broadcast.emit('updatePlayerPosition', { id: socket.id, ...data });
    });

    socket.on('disconnect', () => {
        console.log(`Người chơi ngắt kết nối: ${socket.id}`);
        io.broadcast.emit('playerLeave', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server đang chạy tại cổng http://localhost:${PORT}`);
});
