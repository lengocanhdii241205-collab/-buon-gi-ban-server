const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const rooms = new Map();

const market = {
  bread:  { name: "Bánh mì", base: 20, stock: 100, demand: 1 },
  milk:   { name: "Sữa",     base: 30, stock: 100, demand: 1 },
  tea:    { name: "Trà",     base: 25, stock: 100, demand: 1 },
  orange: { name: "Cam",     base: 15, stock: 100, demand: 1 },
  fish:   { name: "Cá",      base: 40, stock: 100, demand: 1 },
  cake:   { name: "Bánh",    base: 50, stock: 100, demand: 1 }
};

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

function makeRoomCode() {
  let code;

  do {
    code = Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase();
  } while (rooms.has(code));

  return code;
}

function makePlayer(ws, name, gender) {
  return {
    id: makeId(),
    ws,
    name: name || "Người chơi",
    gender: gender || "female",

    x: 640,
    y: 360,

    money: 1000,

    inventory: {
      bread: 0,
      milk: 0,
      tea: 0,
      orange: 0,
      fish: 0,
      cake: 0
    },

    bike: false
  };
}

function publicPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    gender: player.gender,
    x: player.x,
    y: player.y,
    money: player.money,
    inventory: player.inventory,
    bike: player.bike
  };
}

function send(ws, data) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data, except = null) {
  for (const player of room.players.values()) {
    if (player.ws !== except) {
      send(player.ws, data);
    }
  }
}

function broadcastAll(room, data) {
  for (const player of room.players.values()) {
    send(player.ws, data);
  }
}

function getPrice(item) {
  const scarcity = 1 + (1 - item.stock / 100) * 0.5;
  const demandEffect = item.demand;

  return Math.max(
    5,
    Math.round(item.base * scarcity * demandEffect)
  );
}

function marketData() {
  const result = {};

  for (const [id, item] of Object.entries(market)) {
    result[id] = {
      name: item.name,
      price: getPrice(item),
      stock: item.stock,
      demand: item.demand
    };
  }

  return result;
}

/* =========================
   HTTP SERVER
========================= */

const server = http.createServer((req, res) => {
  let filePath;

  if (req.url === "/" || req.url === "/index.html") {
    filePath = path.join(__dirname, "index.html");
  } else {
    filePath = path.join(__dirname, req.url);
  }

  filePath = path.normalize(filePath);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("Không tìm thấy file");
      return;
    }

    let contentType = "text/html; charset=utf-8";

    if (filePath.endsWith(".js")) {
      contentType = "text/javascript; charset=utf-8";
    }

    if (filePath.endsWith(".css")) {
      contentType = "text/css; charset=utf-8";
    }

    if (filePath.endsWith(".json")) {
      contentType = "application/json; charset=utf-8";
    }

    res.writeHead(200, {
      "Content-Type": contentType
    });

    res.end(data);
  });
});

/* =========================
   WEBSOCKET
========================= */

const wss = new WebSocket.Server({
  server
});

wss.on("connection", (ws) => {
  let currentRoom = null;
  let currentPlayer = null;

  send(ws, {
    type: "connected",
    message: "Đã kết nối server"
  });

  ws.on("message", (raw) => {
    let data;

    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    /* =====================
       CREATE ROOM
    ===================== */

    if (data.type === "createRoom") {
      const roomCode = makeRoomCode();

      const room = {
        code: roomCode,
        players: new Map()
      };

      const player = makePlayer(
        ws,
        data.name,
        data.gender
      );

      room.players.set(player.id, player);

      rooms.set(roomCode, room);

      currentRoom = room;
      currentPlayer = player;

      send(ws, {
        type: "roomCreated",
        room: roomCode,
        player: publicPlayer(player),
        market: marketData()
      });

      return;
    }

    /* =====================
       JOIN ROOM
    ===================== */

    if (data.type === "joinRoom") {
      const roomCode = String(data.room || "")
        .trim()
        .toUpperCase();

      const room = rooms.get(roomCode);

      if (!room) {
        send(ws, {
          type: "error",
          message: "Không tìm thấy phòng!"
        });

        return;
      }

      const player = makePlayer(
        ws,
        data.name,
        data.gender
      );

      room.players.set(player.id, player);

      currentRoom = room;
      currentPlayer = player;

      send(ws, {
        type: "roomJoined",
        room: room.code,
        player: publicPlayer(player),
        players: Array.from(room.players.values())
          .filter(p => p.id !== player.id)
          .map(publicPlayer),
        market: marketData()
      });

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

    /* =====================
       MOVE
    ===================== */

    if (
      data.type === "move" &&
      currentRoom &&
      currentPlayer
    ) {
      const x = Number(data.x);
      const y = Number(data.y);

      if (Number.isFinite(x)) {
        currentPlayer.x = Math.max(
          20,
          Math.min(1260, x)
        );
      }

      if (Number.isFinite(y)) {
        currentPlayer.y = Math.max(
          20,
          Math.min(700, y)
        );
      }

      currentPlayer.bike = !!data.bike;

      broadcast(
        currentRoom,
        {
          type: "playerMoved",
          player: publicPlayer(currentPlayer)
        },
        ws
      );

      return;
    }

    /* =====================
       BUY
    ===================== */

    if (
      data.type === "buy" &&
      currentRoom &&
      currentPlayer
    ) {
      const itemId = data.item;
      const item = market[itemId];

      if (!item) {
        return;
      }

      const price = getPrice(item);

      if (item.stock <= 0) {
        send(ws, {
          type: "error",
          message: "Mặt hàng này đã hết!"
        });

        return;
      }

      if (currentPlayer.money < price) {
        send(ws, {
          type: "error",
          message: "Không đủ tiền!"
        });

        return;
      }

      currentPlayer.money -= price;
      currentPlayer.inventory[itemId] += 1;

      item.stock -= 1;
      item.demand = Math.min(
        2,
        item.demand + 0.02
      );

      send(ws, {
        type: "transaction",
        action: "buy",
        item: itemId,
        price,
        player: publicPlayer(currentPlayer),
        market: marketData()
      });

      broadcast(
        currentRoom,
        {
          type: "playerUpdated",
          player: publicPlayer(currentPlayer)
        },
        ws
      );

      broadcast(
        currentRoom,
        {
          type: "market",
          market: marketData()
        }
      );

      return;
    }

    /* =====================
       SELL
    ===================== */

    if (
      data.type === "sell" &&
      currentRoom &&
      currentPlayer
    ) {
      const itemId = data.item;
      const item = market[itemId];

      if (!item) {
        return;
      }

      if (currentPlayer.inventory[itemId] <= 0) {
        send(ws, {
          type: "error",
          message: "Bạn không có mặt hàng này!"
        });

        return;
      }

      const price = Math.max(
        1,
        Math.round(getPrice(item) * 0.8)
      );

      currentPlayer.inventory[itemId] -= 1;
      currentPlayer.money += price;

      item.stock += 1;

      item.demand = Math.max(
        0.7,
        item.demand - 0.02
      );

      send(ws, {
        type: "transaction",
        action: "sell",
        item: itemId,
        price,
        player: publicPlayer(currentPlayer),
        market: marketData()
      });

      broadcast(
        currentRoom,
        {
          type: "playerUpdated",
          player: publicPlayer(currentPlayer)
        },
        ws
      );

      broadcast(
        currentRoom,
        {
          type: "market",
          market: marketData()
        }
      );

      return;
    }

    /* =====================
       CHAT
    ===================== */

    if (
      data.type === "chat" &&
      currentRoom &&
      currentPlayer
    ) {
      const message = String(data.message || "")
        .trim()
        .slice(0, 200);

      if (!message) {
        return;
      }

      broadcastAll(currentRoom, {
        type: "chat",
        playerId: currentPlayer.id,
        name: currentPlayer.name,
        message
      });

      return;
    }

    /* =====================
       BIKE
    ===================== */

    if (
      data.type === "bike" &&
      currentRoom &&
      currentPlayer
    ) {
      currentPlayer.bike = !!data.enabled;

      broadcastAll(currentRoom, {
        type: "playerUpdated",
        player: publicPlayer(currentPlayer)
      });

      return;
    }
  });

  /* =========================
     DISCONNECT
  ========================= */

  ws.on("close", () => {
    if (!currentRoom || !currentPlayer) {
      return;
    }

    currentRoom.players.delete(currentPlayer.id);

    broadcastAll(currentRoom, {
      type: "playerLeft",
      id: currentPlayer.id
    });

    if (currentRoom.players.size === 0) {
      rooms.delete(currentRoom.code);
    }
  });
});

/* =========================
   MARKET UPDATE
========================= */

setInterval(() => {
  for (const item of Object.values(market)) {
    const change =
      (Math.random() - 0.5) * 0.12;

    item.demand = Math.max(
      0.7,
      Math.min(
        1.5,
        item.demand + change
      )
    );

    const stockChange =
      Math.floor(Math.random() * 11) - 5;

    item.stock = Math.max(
      10,
      Math.min(
        100,
        item.stock + stockChange
      )
    );
  }

  for (const room of rooms.values()) {
    broadcastAll(room, {
      type: "market",
      market: marketData()
    });
  }
}, 8000);

/* =========================
   START
========================= */

server.listen(PORT, () => {
  console.log("================================");
  console.log("BUÔNG GÌ BÁN - SERVER");
  console.log("Game size: 1280x720");
  console.log(`Web: http://localhost:${PORT}`);
  console.log("Multiplayer: WebSocket");
  console.log("================================");
});