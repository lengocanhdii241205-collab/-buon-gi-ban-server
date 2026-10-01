const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 3000;

// ================================
// CẤU HÌNH GAME MÀN HÌNH NGANG
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
// ================================

const server = http.createServer((req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/plain; charset=utf-8"
  });

  res.end("Buôn Gì Bán - Multiplayer Server - Landscape 1280x720");
});

// ================================
// WEBSOCKET SERVER
// ================================

const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();

  // ================================
  // NHẬN DỮ LIỆU TỪ GAME
  // ================================

  ws.on("message", (raw) => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
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

        // Vị trí giữa màn hình ngang 1280x720
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

      send(ws, {
        type: "roomCreated",

        room: code,

        player: publicPlayer(player),

        // Thông tin kích thước game
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
      ).toUpperCase();

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

        // Vị trí giữa màn hình ngang
        x: 640,
        y: 360,

        money: 1000,

        reputation: 50,

        shops: 0
      };

      room.players.set(id, player);

      ws.room = code;
      ws.playerId = id;

      // Gửi danh sách người chơi cho người vừa vào
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

      // Báo cho những người khác
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
      return;
    }

    const player = room.players.get(
      ws.playerId
    );

    if (!player) {
      return;
    }

    // ================================
    // DI CHUYỂN NHÂN VẬT
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
  // NGƯỜI CHƠI THOÁT
  // ================================

  ws.on("close", () => {
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
    }
  });
});

// ================================
// CHUYỂN PLAYER THÀNH DỮ LIỆU CÔNG KHAI
// ================================

function publicPlayer(p) {
  return {
    id: p.id,

    name: p.name,

    gender: p.gender,

    x: p.x,

    y: p.y,

    money: p.money,

    reputation:
      p.reputation,

    shops: p.shops
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
});
