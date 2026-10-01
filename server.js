const express = require("express");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = Number(process.env.PORT) || 3000;

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================================================
   GAME CONFIG
========================================================= */

const WORLD_SIZE = 220;
const TICK_RATE = 100; // 10 lần / giây
const STATE_RATE = 200; // gửi state 5 lần / giây

const WEATHER_LIST = [
  "sunny",
  "cloudy",
  "light_rain",
  "heavy_rain",
  "storm",
  "windy"
];

const JOBS = [
  "Tự do",
  "Freelancer",
  "Tài xế xe máy",
  "Nhân viên nhà hàng",
  "Đầu bếp",
  "Barista",
  "Nhân viên cửa hàng",
  "Nhân viên siêu thị",
  "Nhân viên khách sạn",
  "Nhân viên giao hàng"
];

const ITEMS = [
  "Rau củ",
  "Gạo",
  "Cà phê",
  "Trà sữa",
  "Đồ ăn",
  "Nước",
  "Cá",
  "Thịt"
];

const FURNITURE = [
  { id: "table", name: "Bàn", price: 100 },
  { id: "chair", name: "Ghế", price: 60 },
  { id: "fridge", name: "Tủ lạnh", price: 500 },
  { id: "stove", name: "Bếp", price: 450 },
  { id: "pot", name: "Nồi", price: 120 },
  { id: "coffee_machine", name: "Máy pha cà phê", price: 900 },
  { id: "milk_tea_machine", name: "Máy trà sữa", price: 850 },
  { id: "counter", name: "Quầy", price: 400 },
  { id: "tv", name: "TV", price: 700 },
  { id: "speaker", name: "Loa", price: 300 },
  { id: "light", name: "Đèn", price: 80 },
  { id: "plant", name: "Cây cảnh", price: 70 },
  { id: "painting", name: "Tranh", price: 150 },
  { id: "trash_can", name: "Thùng rác", price: 40 },
  { id: "ac", name: "Máy lạnh", price: 1200 }
];

/* =========================================================
   HELPERS
========================================================= */

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function safeNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function safeString(value, fallback = "") {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, 200);
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function send(ws, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  try {
    ws.send(JSON.stringify(data));
  } catch (err) {
    console.error("WebSocket send error:", err.message);
  }
}

function broadcast(data) {
  const message = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (err) {
        console.error("Broadcast error:", err.message);
      }
    }
  }
}

function notify(ws, success, text) {
  send(ws, {
    type: "NOTIF",
    success: Boolean(success),
    text: String(text)
  });
}

function createInventory() {
  return {
    "Rau củ": 2,
    "Gạo": 0,
    "Cà phê": 0,
    "Trà sữa": 0,
    "Đồ ăn": 0,
    "Nước": 3,
    "Cá": 0,
    "Thịt": 0
  };
}

/* =========================================================
   WORLD STATE
========================================================= */

const gameState = {
  world: {
    day: 1,
    time: 8.0,
    weather: "sunny",
    weatherTimer: 0
  },

  players: {},

  npcs: [],

  vehicles: [],

  buildings: [],

  market: {
    "Rau củ": { buy: 10, sell: 15 },
    "Gạo": { buy: 20, sell: 28 },
    "Cà phê": { buy: 15, sell: 25 },
    "Trà sữa": { buy: 18, sell: 30 },
    "Đồ ăn": { buy: 25, sell: 40 },
    "Nước": { buy: 5, sell: 10 },
    "Cá": { buy: 35, sell: 50 },
    "Thịt": { buy: 40, sell: 60 }
  },

  businesses: {
    biz_1: {
      id: "biz_1",
      name: "Quán Cà Phê Phố",
      type: "Quán cà phê",
      x: -30,
      z: -30,
      owner: null,
      ownerId: null,
      rented: false,
      rentPrice: 500,
      buyPrice: 5000,
      level: 1,
      vault: 0,
      revenue: 0,
      reputation: 50,
      open: false,
      priceMultiplier: 1,
      inventory: {
        "Cà phê": 20
      },
      furniture: [
        "Bàn",
        "Ghế",
        "Máy pha cà phê"
      ],
      employees: []
    },

    biz_2: {
      id: "biz_2",
      name: "Siêu Thị Mini",
      type: "Siêu thị",
      x: 30,
      z: -30,
      owner: null,
      ownerId: null,
      rented: false,
      rentPrice: 1200,
      buyPrice: 12000,
      level: 1,
      vault: 0,
      revenue: 0,
      reputation: 50,
      open: false,
      priceMultiplier: 1,
      inventory: {
        "Rau củ": 50,
        "Gạo": 50,
        "Nước": 50
      },
      furniture: [
        "Quầy",
        "Tủ lạnh"
      ],
      employees: []
    },

    biz_3: {
      id: "biz_3",
      name: "Khách Sạn Sài Gòn",
      type: "Khách sạn",
      x: -30,
      z: 30,
      owner: null,
      ownerId: null,
      rented: false,
      rentPrice: 3000,
      buyPrice: 30000,
      level: 1,
      vault: 0,
      revenue: 0,
      reputation: 50,
      open: false,
      priceMultiplier: 1,
      inventory: {},
      furniture: [
        "Quầy",
        "Máy lạnh",
        "TV"
      ],
      employees: []
    },

    biz_4: {
      id: "biz_4",
      name: "Quán Ăn Bình Dân",
      type: "Nhà hàng",
      x: 30,
      z: 30,
      owner: null,
      ownerId: null,
      rented: false,
      rentPrice: 1800,
      buyPrice: 18000,
      level: 1,
      vault: 0,
      revenue: 0,
      reputation: 50,
      open: false,
      priceMultiplier: 1,
      inventory: {
        "Đồ ăn": 30,
        "Cá": 10,
        "Thịt": 10,
        "Nước": 20
      },
      furniture: [
        "Bàn",
        "Ghế",
        "Bếp",
        "Nồi"
      ],
      employees: []
    }
  }
};

/* =========================================================
   BUILDINGS
========================================================= */

const buildingTypes = [
  "Nhà dân",
  "Cửa hàng",
  "Văn phòng",
  "Chung cư",
  "Công viên",
  "Trường học",
  "Bệnh viện",
  "Nhà hàng",
  "Khách sạn"
];

for (let i = 0; i < 55; i++) {
  let x = random(-100, 100);
  let z = random(-100, 100);

  if (Math.abs(x) < 12 && Math.abs(z) < 12) {
    x += 25;
  }

  gameState.buildings.push({
    id: `building_${i}`,
    type: buildingTypes[i % buildingTypes.length],
    x,
    z,
    width: randomInt(6, 13),
    height: randomInt(5, 20),
    depth: randomInt(6, 13)
  });
}

/* =========================================================
   NPC
========================================================= */

const npcRoles = [
  "Khách hàng",
  "Khách du lịch",
  "Cư dân",
  "Công nhân",
  "Học sinh",
  "Nhân viên giao hàng",
  "Khách khách sạn",
  "Khách nhà hàng"
];

for (let i = 0; i < 50; i++) {
  gameState.npcs.push({
    id: `npc_${i}`,
    role: npcRoles[i % npcRoles.length],
    x: random(-95, 95),
    z: random(-95, 95),
    rot: random(0, Math.PI * 2),
    speed: random(0.015, 0.045),
    targetTimer: randomInt(50, 300)
  });
}

/* =========================================================
   VEHICLES
========================================================= */

const vehicleTypes = [
  "Ô tô",
  "Xe máy",
  "Taxi",
  "Xe buýt",
  "Xe giao hàng",
  "Xe đạp"
];

for (let i = 0; i < 28; i++) {
  gameState.vehicles.push({
    id: `vehicle_${i}`,
    type: vehicleTypes[i % vehicleTypes.length],
    x: random(-100, 100),
    z: random(-100, 100),
    rot: random(0, Math.PI * 2),
    speed: random(0.05, 0.14)
  });
}

/* =========================================================
   PLAYER
========================================================= */

function createPlayer(data) {
  const id =
    "p_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8);

  return {
    id,
    name: safeString(data.name, "Người chơi").slice(0, 20),
    gender: data.gender === "female" ? "female" : "male",

    x: 0,
    y: 0.5,
    z: 0,
    rot: 0,

    money: 1000,

    energy: 100,
    hunger: 100,

    job: "Tự do",

    onBike: false,

    inventory: createInventory(),

    currentBusiness: null,

    lastMove: Date.now()
  };
}

/* =========================================================
   MARKET
========================================================= */

function updateMarket() {
  for (const item of ITEMS) {
    const marketItem = gameState.market[item];

    const variation = random(-0.15, 0.15);

    marketItem.buy = Math.max(
      2,
      Math.round(marketItem.buy * (1 + variation))
    );

    marketItem.sell = Math.max(
      marketItem.buy + 1,
      Math.round(marketItem.buy * random(1.35, 1.65))
    );
  }
}

/* =========================================================
   WEATHER
========================================================= */

function changeWeather() {
  gameState.world.weather =
    WEATHER_LIST[randomInt(0, WEATHER_LIST.length - 1)];

  gameState.world.weatherTimer = 0;

  updateMarket();

  broadcast({
    type: "WEATHER",
    weather: gameState.world.weather,
    market: gameState.market
  });
}

/* =========================================================
   NPC UPDATE
========================================================= */

function updateNPCs() {
  for (const npc of gameState.npcs) {
    npc.targetTimer--;

    if (npc.targetTimer <= 0) {
      npc.targetTimer = randomInt(80, 300);
      npc.rot += random(-1.8, 1.8);
    }

    npc.x += Math.cos(npc.rot) * npc.speed;
    npc.z += Math.sin(npc.rot) * npc.speed;

    if (npc.x < -105 || npc.x > 105) {
      npc.rot = Math.PI - npc.rot;
    }

    if (npc.z < -105 || npc.z > 105) {
      npc.rot = -npc.rot;
    }

    npc.x = clamp(npc.x, -105, 105);
    npc.z = clamp(npc.z, -105, 105);
  }
}

/* =========================================================
   VEHICLE UPDATE
========================================================= */

function updateVehicles() {
  for (const vehicle of gameState.vehicles) {
    vehicle.x += Math.cos(vehicle.rot) * vehicle.speed;
    vehicle.z += Math.sin(vehicle.rot) * vehicle.speed;

    if (
      vehicle.x < -110 ||
      vehicle.x > 110 ||
      vehicle.z < -110 ||
      vehicle.z > 110
    ) {
      vehicle.x = clamp(vehicle.x, -110, 110);
      vehicle.z = clamp(vehicle.z, -110, 110);
      vehicle.rot += Math.PI;
    }
  }
}

/* =========================================================
   GAME LOOP
========================================================= */

let tickCounter = 0;

setInterval(() => {
  tickCounter++;

  // 1 giây server ≈ 0.24 giờ game
  gameState.world.time += 0.024;

  if (gameState.world.time >= 24) {
    gameState.world.time -= 24;
    gameState.world.day++;
  }

  gameState.world.weatherTimer++;

  // Khoảng 60 giây đổi thời tiết
  if (gameState.world.weatherTimer >= 600) {
    changeWeather();
  }

  updateNPCs();
  updateVehicles();

  // Giảm năng lượng / đói
  if (tickCounter % 10 === 0) {
    for (const id of Object.keys(gameState.players)) {
      const player = gameState.players[id];

      player.energy = clamp(
        player.energy - (player.onBike ? 0.01 : 0.003),
        0,
        100
      );

      player.hunger = clamp(
        player.hunger - 0.004,
        0,
        100
      );
    }
  }
}, TICK_RATE);

/* =========================================================
   STATE BROADCAST
========================================================= */

setInterval(() => {
  broadcast({
    type: "TICK",
    state: gameState
  });
}, STATE_RATE);

/* =========================================================
   ACTIONS
========================================================= */

function buyItem(player, itemName, amount) {
  if (!ITEMS.includes(itemName)) {
    return { success: false, text: "Mặt hàng không tồn tại." };
  }

  const amountSafe = clamp(
    Math.floor(safeNumber(amount, 1)),
    1,
    50
  );

  const marketItem = gameState.market[itemName];
  const total = marketItem.buy * amountSafe;

  if (player.money < total) {
    return {
      success: false,
      text: "Không đủ tiền."
    };
  }

  player.money -= total;
  player.inventory[itemName] =
    (player.inventory[itemName] || 0) + amountSafe;

  return {
    success: true,
    text: `Đã mua ${itemName} x${amountSafe}.`
  };
}

function sellItem(player, itemName, amount) {
  if (!ITEMS.includes(itemName)) {
    return {
      success: false,
      text: "Mặt hàng không tồn tại."
    };
  }

  const amountSafe = clamp(
    Math.floor(safeNumber(amount, 1)),
    1,
    50
  );

  const current = player.inventory[itemName] || 0;

  if (current < amountSafe) {
    return {
      success: false,
      text: `Bạn không có đủ ${itemName}.`
    };
  }

  player.inventory[itemName] -= amountSafe;

  player.money +=
    gameState.market[itemName].sell * amountSafe;

  return {
    success: true,
    text: `Đã bán ${itemName} x${amountSafe}.`
  };
}

/* =========================================================
   BUSINESS
========================================================= */

function rentBusiness(player, biz) {
  if (biz.ownerId) {
    return {
      success: false,
      text: "Doanh nghiệp này đã có chủ."
    };
  }

  if (player.money < biz.rentPrice) {
    return {
      success: false,
      text: "Không đủ tiền thuê."
    };
  }

  player.money -= biz.rentPrice;

  biz.owner = player.name;
  biz.ownerId = player.id;
  biz.rented = true;

  player.currentBusiness = biz.id;

  return {
    success: true,
    text: `Đã thuê ${biz.name}.`
  };
}

function buyBusiness(player, biz) {
  if (biz.ownerId) {
    return {
      success: false,
      text: "Doanh nghiệp này đã có chủ."
    };
  }

  if (player.money < biz.buyPrice) {
    return {
      success: false,
      text: "Không đủ tiền mua doanh nghiệp."
    };
  }

  player.money -= biz.buyPrice;

  biz.owner = player.name;
  biz.ownerId = player.id;
  biz.rented = false;

  player.currentBusiness = biz.id;

  return {
    success: true,
    text: `Đã mua ${biz.name}.`
  };
}

function toggleBusiness(player, biz) {
  if (biz.ownerId !== player.id) {
    return {
      success: false,
      text: "Bạn không sở hữu doanh nghiệp này."
    };
  }

  biz.open = !biz.open;

  return {
    success: true,
    text: biz.open
      ? `${biz.name} đã mở cửa.`
      : `${biz.name} đã đóng cửa.`
  };
}

function upgradeBusiness(player, biz) {
  if (biz.ownerId !== player.id) {
    return {
      success: false,
      text: "Bạn không sở hữu doanh nghiệp này."
    };
  }

  const price = 2000 * biz.level;

  if (player.money < price) {
    return {
      success: false,
      text: `Cần ${price}$ để nâng cấp.`
    };
  }

  player.money -= price;

  biz.level++;
  biz.reputation = clamp(biz.reputation + 5, 0, 100);

  return {
    success: true,
    text: `Đã nâng cấp ${biz.name} lên cấp ${biz.level}.`
  };
}

function withdrawBusiness(player, biz) {
  if (biz.ownerId !== player.id) {
    return {
      success: false,
      text: "Bạn không sở hữu doanh nghiệp này."
    };
  }

  if (biz.vault <= 0) {
    return {
      success: false,
      text: "Két doanh nghiệp đang trống."
    };
  }

  const money = biz.vault;

  biz.vault = 0;
  player.money += money;

  return {
    success: true,
    text: `Đã rút ${money}$ từ doanh nghiệp.`
  };
}

function buyFurniture(player, biz, furnitureId) {
  if (biz.ownerId !== player.id) {
    return {
      success: false,
      text: "Bạn không sở hữu doanh nghiệp này."
    };
  }

  const furniture = FURNITURE.find(
    item => item.id === furnitureId
  );

  if (!furniture) {
    return {
      success: false,
      text: "Nội thất không tồn tại."
    };
  }

  if (player.money < furniture.price) {
    return {
      success: false,
      text: "Không đủ tiền mua nội thất."
    };
  }

  player.money -= furniture.price;
  biz.furniture.push(furniture.name);

  return {
    success: true,
    text: `Đã mua ${furniture.name}.`
  };
}

/* =========================================================
   NPC / BUILDING INTERACTION
========================================================= */

function interact(player) {
  let nearestNpc = null;
  let nearestNpcDistance = Infinity;

  for (const npc of gameState.npcs) {
    const d = distance(player, npc);

    if (d < nearestNpcDistance) {
      nearestNpc = npc;
      nearestNpcDistance = d;
    }
  }

  if (nearestNpc && nearestNpcDistance <= 5) {
    return {
      success: true,
      text: `${nearestNpc.role} đã nói chuyện với bạn.`
    };
  }

  let nearestBusiness = null;
  let nearestBusinessDistance = Infinity;

  for (const biz of Object.values(gameState.businesses)) {
    const d = distance(player, biz);

    if (d < nearestBusinessDistance) {
      nearestBusiness = biz;
      nearestBusinessDistance = d;
    }
  }

  if (nearestBusiness && nearestBusinessDistance <= 8) {
    return {
      success: true,
      text: `Bạn đang ở gần ${nearestBusiness.name}.`
    };
  }

  return {
    success: false,
    text: "Không có gì để tương tác ở gần đây."
  };
}

/* =========================================================
   ACTION HANDLER
========================================================= */

function handleAction(ws, player, data) {
  const action = safeString(data.action);

  switch (action) {
    case "BUY_ITEM": {
      const result = buyItem(
        player,
        safeString(data.item),
        data.amount
      );

      notify(ws, result.success, result.text);
      break;
    }

    case "SELL_ITEM": {
      const result = sellItem(
        player,
        safeString(data.item),
        data.amount
      );

      notify(ws, result.success, result.text);
      break;
    }

    case "CHANGE_JOB": {
      const job = safeString(data.job);

      if (!JOBS.includes(job)) {
        notify(ws, false, "Nghề không hợp lệ.");
        break;
      }

      player.job = job;

      notify(
        ws,
        true,
        `Đã chuyển sang nghề ${job}.`
      );

      break;
    }

    case "TOGGLE_BIKE": {
      player.onBike = !player.onBike;

      notify(
        ws,
        true,
        player.onBike
          ? "Đã lên xe máy."
          : "Đã xuống xe máy."
      );

      break;
    }

    case "OPERATE_BIZ": {
      const biz = gameState.businesses[data.bizId];

      if (!biz) {
        notify(ws, false, "Doanh nghiệp không tồn tại.");
        break;
      }

      let result = {
        success: false,
        text: "Thao tác không hợp lệ."
      };

      if (data.subAction === "RENT") {
        result = rentBusiness(player, biz);
      }

      if (data.subAction === "BUY") {
        result = buyBusiness(player, biz);
      }

      if (data.subAction === "TOGGLE") {
        result = toggleBusiness(player, biz);
      }

      if (data.subAction === "UPGRADE") {
        result = upgradeBusiness(player, biz);
      }

      if (data.subAction === "WITHDRAW") {
        result = withdrawBusiness(player, biz);
      }

      notify(ws, result.success, result.text);
      break;
    }

    case "BUY_FURNITURE": {
      const biz = gameState.businesses[data.bizId];

      if (!biz) {
        notify(ws, false, "Doanh nghiệp không tồn tại.");
        break;
      }

      const result = buyFurniture(
        player,
        biz,
        safeString(data.furnitureId)
      );

      notify(ws, result.success, result.text);
      break;
    }

    case "EAT": {
      const amount = player.inventory["Đồ ăn"] || 0;

      if (amount <= 0) {
        notify(ws, false, "Bạn không có đồ ăn.");
        break;
      }

      player.inventory["Đồ ăn"]--;
      player.hunger = clamp(
        player.hunger + 30,
        0,
        100
      );

      notify(ws, true, "Bạn đã ăn một phần đồ ăn.");
      break;
    }

    case "DRINK": {
      const amount = player.inventory["Nước"] || 0;

      if (amount <= 0) {
        notify(ws, false, "Bạn không có nước.");
        break;
      }

      player.inventory["Nước"]--;
      player.energy = clamp(
        player.energy + 15,
        0,
        100
      );

      notify(ws, true, "Bạn đã uống nước.");
      break;
    }

    case "INTERACT": {
      const result = interact(player);
      notify(ws, result.success, result.text);
      break;
    }

    case "CALL_TAXI": {
      const taxi = gameState.vehicles.find(
        vehicle => vehicle.type === "Taxi"
      );

      if (!taxi) {
        notify(ws, false, "Hiện không có taxi.");
        break;
      }

      taxi.x = player.x + random(-3, 3);
      taxi.z = player.z + random(-3, 3);
      taxi.rot = Math.atan2(
        player.z - taxi.z,
        player.x - taxi.x
      );

      notify(
        ws,
        true,
        "Taxi đang đến vị trí của bạn."
      );

      break;
    }

    case "HOTEL_CHECKIN": {
      const hotel = Object.values(
        gameState.businesses
      ).find(
        biz =>
          biz.type === "Khách sạn" &&
          distance(player, biz) <= 10
      );

      if (!hotel) {
        notify(
          ws,
          false,
          "Bạn cần đến gần khách sạn."
        );
        break;
      }

      const price = 100;

      if (player.money < price) {
        notify(
          ws,
          false,
          "Không đủ tiền nhận phòng."
        );
        break;
      }

      player.money -= price;
      player.energy = 100;
      player.hunger = 100;

      if (hotel.ownerId) {
        hotel.vault += price;
        hotel.revenue += price;
      }

      notify(
        ws,
        true,
        "Đã nhận phòng khách sạn."
      );

      break;
    }

    default:
      notify(
        ws,
        false,
        "Không nhận diện được thao tác."
      );
  }
}

/* =========================================================
   WEBSOCKET
========================================================= */

wss.on("connection", ws => {
  let playerId = null;

  ws.isAlive = true;

  ws.on("pong", () => {
    ws.isAlive = true;
  });

  ws.on("message", rawMessage => {
    try {
      const text = rawMessage.toString();

      if (text.length > 10000) {
        return;
      }

      const data = JSON.parse(text);

      if (!data || typeof data.type !== "string") {
        return;
      }

      /* =========================
         JOIN
      ========================= */

      if (data.type === "JOIN") {
        if (playerId) {
          return;
        }

        const player = createPlayer(data);

        playerId = player.id;

        gameState.players[playerId] = player;

        send(ws, {
          type: "INIT",
          id: playerId,
          state: gameState
        });

        broadcast({
          type: "SYSTEM",
          text: `${player.name} đã tham gia thành phố.`
        });

        return;
      }

      if (!playerId) {
        return;
      }

      const player = gameState.players[playerId];

      if (!player) {
        return;
      }

      /* =========================
         MOVE
      ========================= */

      if (data.type === "UPDATE_MOVE") {
        const x = clamp(
          safeNumber(data.x, player.x),
          -WORLD_SIZE / 2,
          WORLD_SIZE / 2
        );

        const y = clamp(
          safeNumber(data.y, 0.5),
          0,
          10
        );

        const z = clamp(
          safeNumber(data.z, player.z),
          -WORLD_SIZE / 2,
          WORLD_SIZE / 2
        );

        const rot = safeNumber(
          data.rot,
          player.rot
        );

        player.x = x;
        player.y = y;
        player.z = z;
        player.rot = rot;

        if (typeof data.onBike === "boolean") {
          player.onBike = data.onBike;
        }

        player.lastMove = Date.now();

        return;
      }

      /* =========================
         CHAT
      ========================= */

      if (data.type === "CHAT") {
        const text = safeString(data.text).slice(0, 300);

        if (!text) {
          return;
        }

        broadcast({
          type: "CHAT_MSG",
          sender: player.name,
          senderId: player.id,
          text
        });

        return;
      }

      /* =========================
         ACTION
      ========================= */

      if (data.type === "ACTION") {
        handleAction(ws, player, data);
        return;
      }

      /* =========================
         PING APP
      ========================= */

      if (data.type === "PING") {
        send(ws, {
          type: "PONG",
          time: Date.now()
        });
      }
    } catch (err) {
      console.error(
        "Message error:",
        err.message
      );
    }
  });

  ws.on("close", () => {
    if (!playerId) {
      return;
    }

    const player =
      gameState.players[playerId];

    if (player) {
      broadcast({
        type: "SYSTEM",
        text: `${player.name} đã rời thành phố.`
      });
    }

    delete gameState.players[playerId];
  });

  ws.on("error", err => {
    console.error(
      "WebSocket error:",
      err.message
    );
  });
});

/* =========================================================
   HEARTBEAT
========================================================= */

setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) {
      try {
        ws.terminate();
      } catch (_) {}
      continue;
    }

    ws.isAlive = false;

    try {
      ws.ping();
    } catch (_) {}
  }
}, 10000);

/* =========================================================
   SERVER
========================================================= */

server.on("error", err => {
  console.error(
    "HTTP Server error:",
    err.message
  );
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("========================================");
  console.log("     BUÔNG GÌ BÁN - 3D MULTIPLAYER");
  console.log("========================================");
  console.log(`Server: http://localhost:${PORT}`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log("========================================");
  console.log("");
});