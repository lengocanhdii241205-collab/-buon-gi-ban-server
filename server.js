const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

// ================================
// CẤU HÌNH GAME
// ================================

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;

const rooms = new Map();

// ================================
// TẠO MÃ PHÒNG
// ================================

function roomCode() {
  let code;

  do {
    code = Math.random()
      .toString(36)
      .substring(2, 7)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}

// ================================
// GỬI DỮ LIỆU
// ================================

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

// ================================
// GỬI CHO TẤT CẢ NGƯỜI CHƠI
// ================================

function broadcast(room, data, except = null) {
  for (const player of room.players.values()) {
    if (player.ws !== except) {
      send(player.ws, data);
    }
  }
}

// ================================
// HTTP SERVER
// PHỤC VỤ index.html + FILE GAME
// ================================

const server = http.createServer((req, res) => {
  // Bỏ query string, ví dụ ?abc=123
  const requestPath = new URL(
    req.url,
    `http://${req.headers.host}`
  ).pathname;

  // Trang chính
  if (requestPath === "/") {
    serveFile(
      path.join(__dirname, "index.html"),
      res
    );
    return;
  }

  // Các file khác của game
  const safePath = path.normalize(
    requestPath.replace(/^\/+/, "")
  );

  // Chặn truy cập ra ngoài thư mục project
  if (
    safePath.startsWith("..") ||
    path.isAbsolute(safePath)
  ) {
    res.writeHead(403, {
      "Content-Type": "text/plain; charset=utf-8"
    });

    res.end("Forbidden");
    return;
  }

  const filePath = path.join(
    __dirname,
    safePath
  );

  serveFile(filePath, res);
});

// ================================
// PHỤC VỤ FILE
// ================================

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();

  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",

    ".js": "application/javascript; charset=utf-8",
    ".mjs": "application/javascript; charset=utf-8",

    ".css": "text/css; charset=utf-8",

    ".json": "application/json; charset=utf-8",

    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",

    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",

    ".mp4": "video/mp4",
    ".webm": "video/webm"
  };

  const contentType =
    contentTypes[ext] ||
    "application/octet-stream";

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type":
          "text/plain; charset=utf-8"
      });

      res.end(
        `Không tìm thấy file: ${path.basename(filePath)}`
      );

      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "no-cache"
    });

    res.end(data);
  });
}

// ================================
// WEBSOCKET SERVER
// ================================

const wss = new WebSocket.Server({
  server
});

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();

  console.log("WebSocket client connected:", id);

  // ================================
  // NHẬN DỮ LIỆU
  // ================================

  ws.on("message", (raw) => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch (error) {
      send(ws, {
        type: "error",
        message: "Dữ liệu không hợp lệ."
      });

      return;
    }

    // ================================
    // TẠO PHÒNG
    // ================================

    if (data.type === "createRoom") {
      const code = roomCode();

      const player = {
        id,
        ws,

        name: String(
          data.name || "Người chơi"
        ).slice(0, 18),

        gender:
          data.gender === "female"
            ? "female"
            : "male",

        x: 640,
        y: 360,

        money: 1000,

        reputation: 50,

        shops: 0
      };

      rooms.set(code, {
        players: new Map([
          [id, player]
        ])
      });

      ws.room = code;
      ws.playerId = id;

      console.log(
        `Phòng ${code} được tạo bởi ${player.name}`
      );

      send(ws, {
        type: "roomCreated",

        room: code,

        player: publicPlayer(player),

        gameWidth: GAME_WIDTH,

        gameHeight: GAME_HEIGHT
      });

      return;
    }

    // ================================
    // VÀO PHÒNG
    // ================================

    if (data.type === "joinRoom") {
      const code = String(
        data.room || ""
      )
        .trim()
        .toUpperCase();

      const room = rooms.get(code);

      if (!room) {
        send(ws, {
          type: "error",
          message: "Không tìm thấy phòng."
        });

        return;
      }

      const player = {
        id,
        ws,

        name: String(
          data.name || "Người chơi"
        ).slice(0, 18),

        gender:
          data.gender === "female"
            ? "female"
            : "male",

        x: 640,
        y: 360,

        money: 1000,

        reputation: 50,

        shops: 0
      };

      room.players.set(id, player);

      ws.room = code;
      ws.playerId = id;

      console.log(
        `${player.name} vào phòng ${code}`
      );

      // Gửi cho người vừa vào
      send(ws, {
        type: "joined",

        room: code,

        player: publicPlayer(player),

        players: [
          ...room.players.values()
        ].map(publicPlayer),

        gameWidth: GAME_WIDTH,

        gameHeight: GAME_HEIGHT
      });

      // Báo cho người chơi khác
      broadcast(
        room,
        {
          type: "playerJoined",

          player: publicPlayer(player)
        },
        ws
      );

      return;
    }

    // ================================
    // KIỂM TRA PHÒNG
    // ================================

    const room = rooms.get(ws.room);

    if (!room) {
      send(ws, {
        type: "error",
        message: "Bạn chưa vào phòng."
      });

      return;
    }

    const player = room.players.get(
      ws.playerId
    );

    if (!player) {
      return;
    }

    // ================================
    // DI CHUYỂN
    // ================================

    if (data.type === "move") {
      player.x = clamp(
        Number(data.x),
        20,
        GAME_WIDTH - 20
      );

      player.y = clamp(
        Number(data.y),
        20,
        GAME_HEIGHT - 20
      );

      broadcast(
        room,
        {
          type: "playerMoved",

          player: publicPlayer(player)
        },
        ws
      );

      return;
    }

    // ================================
    // CHẠY XE ÔM
    // ================================

    if (data.type === "bike") {
      const gain =
        50 +
        Math.floor(
          Math.random() * 101
        );

      player.money += gain;

      player.reputation = Math.min(
        100,
        player.reputation + 1
      );

      send(ws, {
        type: "moneyUpdate",

        money: player.money,

        reputation:
          player.reputation,

        shops: player.shops,

        message:
          `🛵 Hoàn thành chuyến xe! +${gain}đ`
      });

      return;
    }

    // ================================
    // MUA SẠP
    // ================================

    if (data.type === "buyShop") {
      const price = 500;

      if (player.money < price) {
        send(ws, {
          type: "message",

          message:
            "Không đủ tiền mua sạp."
        });

        return;
      }

      player.money -= price;

      player.shops++;

      send(ws, {
        type: "moneyUpdate",

        money: player.money,

        reputation:
          player.reputation,

        shops: player.shops,

        message:
          "🎉 Mua sạp thành công!"
      });

      return;
    }
  });

  // ================================
  // NGẮT KẾT NỐI
  // ================================

  ws.on("close", () => {
    console.log(
      "WebSocket client disconnected:",
      id
    );

    const room = rooms.get(ws.room);

    if (!room) {
      return;
    }

    const player = room.players.get(
      ws.playerId
    );

    room.players.delete(
      ws.playerId
    );

    if (player) {
      broadcast(room, {
        type: "playerLeft",

        id: player.id
      });
    }

    // Không còn ai thì xóa phòng
    if (room.players.size === 0) {
      rooms.delete(ws.room);

      console.log(
        `Phòng ${ws.room} đã được xóa`
      );
    }
  });

  // ================================
  // LỖI WEBSOCKET
  // ================================

  ws.on("error", (error) => {
    console.error(
      "WebSocket error:",
      error.message
    );
  });
});

// ================================
// CHUYỂN PLAYER THÀNH DỮ LIỆU CÔNG KHAI
// ================================

function publicPlayer(player) {
  return {
    id: player.id,

    name: player.name,

    gender: player.gender,

    x: player.x,

    y: player.y,

    money: player.money,

    reputation:
      player.reputation,

    shops: player.shops
  };
}

// ================================
// GIỚI HẠN VỊ TRÍ
// ================================

function clamp(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(
    min,
    Math.min(max, value)
  );
}

// ================================
// KHỞI ĐỘNG SERVER
// ================================

server.listen(PORT, () => {
  console.log(
    `Buôn Gì Bán server chạy tại port ${PORT}`
  );

  console.log(
    `Game size: ${GAME_WIDTH}x${GAME_HEIGHT}`
  );

  console.log(
    `Web: http://localhost:${PORT}`
  );
});

// ================================
// XỬ LÝ LỖI SERVER
// ================================

server.on("error", (error) => {
  console.error(
    "HTTP server error:",
    error
  );
});
      

      

        
      