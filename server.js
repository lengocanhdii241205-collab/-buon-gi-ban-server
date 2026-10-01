const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(__dirname, "public");

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || "/").split("?")[0]);

  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  const filePath = path.join(PUBLIC_DIR, urlPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end("Không tìm thấy file: " + urlPath);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();

    const types = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml",
      ".ico": "image/x-icon",
    };

    res.writeHead(200, {
      "Content-Type": types[ext] || "application/octet-stream",
      "Cache-Control": "no-cache",
    });

    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

/* =========================================================
   UTILS
========================================================= */

function makeId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}

function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}

function pick(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function distance(a, b) {
  const dx = a.x - b.x;
  const dz = a.z - b.z;
  return Math.sqrt(dx * dx + dz * dz);
}

function send(ws, data) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(data) {
  const raw = JSON.stringify(data);

  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(raw);
    }
  }
}

function notice(ws, message) {
  send(ws, {
    type: "notice",
    message,
  });
}

function errorMessage(ws, message) {
  send(ws, {
    type: "error",
    message,
  });
}

/* =========================================================
   GAME DATA
========================================================= */

const game = {
  players: new Map(),
  npcs: new Map(),
  vehicles: new Map(),
  buildings: new Map(),
  businesses: new Map(),
  furniture: new Map(),
  rooms: new Map(),

  market: {
    vegetable: {
      name: "Rau củ",
      buy: 12,
      sell: 8,
    },
    rice: {
      name: "Gạo",
      buy: 18,
      sell: 12,
    },
    coffee: {
      name: "Cà phê",
      buy: 25,
      sell: 17,
    },
    milkTea: {
      name: "Trà sữa",
      buy: 30,
      sell: 20,
    },
    food: {
      name: "Đồ ăn",
      buy: 35,
      sell: 24,
    },
    water: {
      name: "Nước",
      buy: 8,
      sell: 5,
    },
    fish: {
      name: "Cá",
      buy: 28,
      sell: 19,
    },
    meat: {
      name: "Thịt",
      buy: 42,
      sell: 29,
    },
  },

  world: {
    day: 1,
    time: 8 * 60,
    weather: "sunny",
    weatherTimer: 120,
  },

  nextNpcSpawn: 0,
  nextVehicleSpawn: 0,
};

/* =========================================================
   ITEMS
========================================================= */

const ITEMS = {
  vegetable: {
    name: "Rau củ",
    price: 12,
  },

  rice: {
    name: "Gạo",
    price: 18,
  },

  coffee: {
    name: "Cà phê",
    price: 25,
  },

  milkTea: {
    name: "Trà sữa",
    price: 30,
  },

  food: {
    name: "Đồ ăn",
    price: 35,
  },

  water: {
    name: "Nước",
    price: 8,
  },

  fish: {
    name: "Cá",
    price: 28,
  },

  meat: {
    name: "Thịt",
    price: 42,
  },
};

/* =========================================================
   JOBS
========================================================= */

const JOBS = {
  unemployed: {
    name: "Tự do",
    salary: 0,
  },

  taxi: {
    name: "Tài xế xe ôm",
    salary: 35,
  },

  restaurant: {
    name: "Nhân viên nhà hàng",
    salary: 30,
  },

  kitchen: {
    name: "Đầu bếp",
    salary: 40,
  },

  barista: {
    name: "Barista",
    salary: 35,
  },

  shopkeeper: {
    name: "Nhân viên cửa hàng",
    salary: 30,
  },

  supermarket: {
    name: "Nhân viên siêu thị",
    salary: 32,
  },

  hotel: {
    name: "Nhân viên khách sạn",
    salary: 35,
  },

  delivery: {
    name: "Nhân viên giao hàng",
    salary: 38,
  },
};

/* =========================================================
   BUSINESS TYPES
========================================================= */

const BUSINESS_TYPES = {
  food: {
    name: "Quán ăn",
    rent: 300,
    price: 1000,
    color: 0xe67e22,
  },

  tea: {
    name: "Quán trà sữa",
    rent: 350,
    price: 1200,
    color: 0xf48fb1,
  },

  coffee: {
    name: "Quán cà phê",
    rent: 400,
    price: 1500,
    color: 0x795548,
  },

  restaurant: {
    name: "Nhà hàng",
    rent: 600,
    price: 2500,
    color: 0xc0392b,
  },

  vegetable: {
    name: "Sạp rau củ",
    rent: 180,
    price: 700,
    color: 0x27ae60,
  },

  supermarket: {
    name: "Siêu thị",
    rent: 1000,
    price: 5000,
    color: 0x3498db,
  },

  hotel: {
    name: "Khách sạn",
    rent: 1500,
    price: 8000,
    color: 0x9b59b6,
  },

  shop: {
    name: "Cửa hàng",
    rent: 300,
    price: 1300,
    color: 0x16a085,
  },
};

/* =========================================================
   FURNITURE
========================================================= */

const FURNITURE = {
  table: {
    name: "Bàn",
    price: 80,
  },

  chair: {
    name: "Ghế",
    price: 40,
  },

  fridge: {
    name: "Tủ lạnh",
    price: 300,
  },

  stove: {
    name: "Bếp",
    price: 250,
  },

  pot: {
    name: "Nồi",
    price: 70,
  },

  coffeeMachine: {
    name: "Máy pha cà phê",
    price: 400,
  },

  milkTeaMachine: {
    name: "Máy trà sữa",
    price: 450,
  },

  counter: {
    name: "Quầy tính tiền",
    price: 250,
  },

  tv: {
    name: "TV",
    price: 350,
  },

  speaker: {
    name: "Loa",
    price: 180,
  },

  light: {
    name: "Đèn",
    price: 60,
  },

  plant: {
    name: "Cây cảnh",
    price: 50,
  },

  painting: {
    name: "Tranh",
    price: 90,
  },

  trash: {
    name: "Thùng rác",
    price: 30,
  },

  aircon: {
    name: "Máy lạnh",
    price: 500,
  },
};

/* =========================================================
   BUILDINGS
========================================================= */

function addBuilding(data) {
  const building = {
    id: data.id || makeId("building"),
    name: data.name || "Nhà",
    type: data.type || "house",

    x: data.x || 0,
    z: data.z || 0,

    width: data.width || 8,
    depth: data.depth || 8,
    height: data.height || 4,

    color: data.color || 0xffffff,
    roof: data.roof || 0x444444,

    interior: data.interior !== false,
  };

  game.buildings.set(building.id, building);

  return building;
}

function createCity() {
  const buildings = [
    {
      name: "Tiệm rau Bình Minh",
      type: "vegetable",
      x: -65,
      z: -42,
      width: 10,
      depth: 8,
      height: 5,
      color: 0x72b85a,
      roof: 0x3d7a32,
    },

    {
      name: "Quán Cà Phê Góc Phố",
      type: "coffee",
      x: -38,
      z: -42,
      width: 11,
      depth: 9,
      height: 5,
      color: 0x9b6b45,
      roof: 0x513526,
    },

    {
      name: "Trà Sữa Mây Hồng",
      type: "tea",
      x: -8,
      z: -42,
      width: 10,
      depth: 9,
      height: 5,
      color: 0xf1a6c1,
      roof: 0xb85c87,
    },

    {
      name: "Nhà Hàng Phố Việt",
      type: "restaurant",
      x: 25,
      z: -42,
      width: 14,
      depth: 10,
      height: 6,
      color: 0xd67a45,
      roof: 0x8d3d28,
    },

    {
      name: "Khách Sạn Mặt Trời",
      type: "hotel",
      x: 62,
      z: -40,
      width: 17,
      depth: 13,
      height: 10,
      color: 0x8b79c9,
      roof: 0x51428a,
    },

    {
      name: "Siêu Thị Mini",
      type: "supermarket",
      x: -65,
      z: 20,
      width: 16,
      depth: 12,
      height: 7,
      color: 0x4c9ed9,
      roof: 0x24608c,
    },

    {
      name: "Cửa Hàng Gia Dụng",
      type: "shop",
      x: -30,
      z: 22,
      width: 11,
      depth: 9,
      height: 5,
      color: 0x49a88d,
      roof: 0x28715f,
    },

    {
      name: "Nhà Phố 01",
      type: "house",
      x: 5,
      z: 20,
      width: 10,
      depth: 9,
      height: 5,
      color: 0xe9c89c,
      roof: 0xb47b52,
    },

    {
      name: "Nhà Phố 02",
      type: "house",
      x: 32,
      z: 20,
      width: 10,
      depth: 9,
      height: 5,
      color: 0xc9e1ec,
      roof: 0x66889b,
    },

    {
      name: "Nhà Phố 03",
      type: "house",
      x: 58,
      z: 20,
      width: 10,
      depth: 9,
      height: 5,
      color: 0xe5b7c7,
      roof: 0xa75c70,
    },

    {
      name: "Nhà Phố 04",
      type: "house",
      x: 85,
      z: 20,
      width: 9,
      depth: 9,
      height: 5,
      color: 0xe8d5a8,
      roof: 0x9e7c4e,
    },
  ];

  for (const data of buildings) {
    addBuilding(data);
  }
}

/* =========================================================
   PLAYER
========================================================= */

function createPlayer(ws, name, gender) {
  const player = {
    id: makeId("player"),
    ws,

    name:
      String(name || "Người chơi")
        .trim()
        .slice(0, 20) || "Người chơi",

    gender: gender === "female" ? "female" : "male",

    x: rand(-8, 8),
    z: rand(-8, 8),

    rotation: 0,

    money: 5000,

    energy: 100,
    hunger: 100,

    job: "unemployed",

    inventory: {
      vegetable: 5,
      rice: 5,
      coffee: 2,
      milkTea: 2,
      food: 2,
      water: 5,
      fish: 0,
      meat: 0,
    },

    bike: {
      active: false,
    },

    input: {
      dx: 0,
      dz: 0,
    },

    ownedBusinesses: [],

    rentedBusiness: null,

    furniture: [],

    connectedAt: Date.now(),

    lastSalaryDay: 0,
  };

  game.players.set(player.id, player);

  return player;
}

/* =========================================================
   NPC
========================================================= */

const NPC_ROLES = [
  "customer",
  "customer",
  "customer",
  "tourist",
  "resident",
  "worker",
  "student",
  "delivery",
  "hotel_guest",
  "restaurant_guest",
];

function createNPC() {
  const npc = {
    id: makeId("npc"),

    name: pick([
      "Minh",
      "Lan",
      "Nam",
      "Hà",
      "An",
      "Vy",
      "Khoa",
      "Mai",
      "Tú",
      "Linh",
    ]),

    gender: pick(["male", "female"]),

    role: pick(NPC_ROLES),

    x: rand(-95, 95),
    z: rand(-65, 65),

    targetX: rand(-95, 95),
    targetZ: rand(-65, 65),

    speed: rand(0.025, 0.06),

    state: "walking",

    money: randInt(200, 2500),

    targetBuilding: null,

    actionTimer: rand(2, 10),
  };

  game.npcs.set(npc.id, npc);

  return npc;
}

function ensureNPCs() {
  const target = 45;

  while (game.npcs.size < target) {
    createNPC();
  }
}

/* =========================================================
   VEHICLES
========================================================= */

const VEHICLE_TYPES = [
  "car",
  "car",
  "motorbike",
  "motorbike",
  "taxi",
  "bus",
  "delivery",
  "bicycle",
];

function createVehicle() {
  const type = pick(VEHICLE_TYPES);

  const vehicle = {
    id: makeId("vehicle"),
    type,

    x: rand(-105, 105),
    z: pick([-34, -10, 10, 34]),

    rotation: 0,

    speed:
      type === "bus"
        ? 0.07
        : type === "motorbike"
        ? 0.13
        : type === "bicycle"
        ? 0.08
        : 0.09,

    lane: pick([-1, 1]),

    route: pick(["horizontal", "vertical"]),
  };

  game.vehicles.set(vehicle.id, vehicle);

  return vehicle;
}

function ensureVehicles() {
  const target = 20;

  while (game.vehicles.size < target) {
    createVehicle();
  }
}

/* =========================================================
   BUSINESSES
========================================================= */

function createBusinesses() {
  for (const building of game.buildings.values()) {
    if (!BUSINESS_TYPES[building.type]) {
      continue;
    }

    const business = {
      id: makeId("business"),

      buildingId: building.id,

      type: building.type,

      name: building.name,

      ownerId: null,

      tenantId: null,

      level: 1,

      money: 0,

      price: BUSINESS_TYPES[building.type].price,

      employees: [],

      customers: 0,

      reputation: 50,

      stock: {
        vegetable: 20,
        rice: 20,
        coffee: 15,
        milkTea: 15,
        food: 15,
        water: 30,
        fish: 10,
        meat: 10,
      },

      furniture: [],

      open: true,

      dailyRevenue: 0,
    };

    game.businesses.set(business.id, business);
  }
}

/* =========================================================
   ROOM / HOTEL
========================================================= */

function createHotelRooms() {
  for (const business of game.businesses.values()) {
    if (business.type !== "hotel") continue;

    for (let i = 1; i <= 12; i++) {
      const room = {
        id: makeId("room"),

        businessId: business.id,

        number: i,

        occupied: false,

        guestId: null,

        price: 150 + business.level * 30,

        timer: 0,
      };

      game.rooms.set(room.id, room);
    }
  }
}

/* =========================================================
   MOVEMENT
========================================================= */

function updatePlayerMovement(player, dt) {
  let dx = Number(player.input.dx) || 0;
  let dz = Number(player.input.dz) || 0;

  const length = Math.sqrt(dx * dx + dz * dz);

  if (length > 1) {
    dx /= length;
    dz /= length;
  }

  const speed = player.bike.active ? 0.30 : 0.15;

  player.x += dx * speed * dt * 60;
  player.z += dz * speed * dt * 60;

  player.x = clamp(player.x, -105, 105);
  player.z = clamp(player.z, -75, 75);

  if (Math.abs(dx) > 0.01 || Math.abs(dz) > 0.01) {
    player.rotation = Math.atan2(dx, dz);
  }

  if (length > 0.01) {
    player.energy = clamp(
      player.energy - 0.003 * dt * 60,
      0,
      100
    );
  }
}

/* =========================================================
   NPC MOVEMENT
========================================================= */

function chooseNPCTarget(npc) {
  npc.targetX = rand(-95, 95);
  npc.targetZ = rand(-65, 65);
  npc.actionTimer = rand(4, 12);
}

function updateNPC(npc, dt) {
  npc.actionTimer -= dt;

  if (npc.actionTimer <= 0) {
    chooseNPCTarget(npc);
  }

  const dx = npc.targetX - npc.x;
  const dz = npc.targetZ - npc.z;

  const dist = Math.sqrt(dx * dx + dz * dz);

  if (dist > 1) {
    npc.x += (dx / dist) * npc.speed * dt * 60;
    npc.z += (dz / dist) * npc.speed * dt * 60;
  }

  npc.x = clamp(npc.x, -105, 105);
  npc.z = clamp(npc.z, -75, 75);

  if (
    npc.role === "customer" ||
    npc.role === "restaurant_guest" ||
    npc.role === "hotel_guest"
  ) {
    tryNPCBusinessVisit(npc);
  }
}

function tryNPCBusinessVisit(npc) {
  if (Math.random() > 0.004) return;

  const businesses = [...game.businesses.values()].filter(
    (b) => b.open
  );

  if (!businesses.length) return;

  const business = pick(businesses);

  const building = game.buildings.get(business.buildingId);

  if (!building) return;

  npc.targetBuilding = business.id;
  npc.targetX = building.x;
  npc.targetZ = building.z;
}

/* =========================================================
   NPC BUSINESS ACTION
========================================================= */

function processNPCBusiness(npc) {
  if (!npc.targetBuilding) return;

  const business = game.businesses.get(npc.targetBuilding);

  if (!business) return;

  const building = game.buildings.get(business.buildingId);

  if (!building) return;

  if (distance(npc, building) > 4) return;

  if (business.type === "hotel") {
    business.customers += 1;
    business.money += 150;
    business.dailyRevenue += 150;
  } else if (business.type === "restaurant") {
    const amount = randInt(60, 180);

    business.customers += 1;
    business.money += amount;
    business.dailyRevenue += amount;
  } else if (business.type === "coffee") {
    const amount = randInt(25, 80);

    business.customers += 1;
    business.money += amount;
    business.dailyRevenue += amount;
  } else if (business.type === "tea") {
    const amount = randInt(25, 70);

    business.customers += 1;
    business.money += amount;
    business.dailyRevenue += amount;
  } else {
    const amount = randInt(15, 100);

    business.customers += 1;
    business.money += amount;
    business.dailyRevenue += amount;
  }

  npc.targetBuilding = null;
}

/* =========================================================
   VEHICLE UPDATE
========================================================= */

function updateVehicle(vehicle, dt) {
  if (vehicle.route === "horizontal") {
    vehicle.x += vehicle.speed * vehicle.lane * dt * 60;
    vehicle.rotation = vehicle.lane > 0 ? Math.PI / 2 : -Math.PI / 2;

    if (vehicle.x > 115) vehicle.x = -115;
    if (vehicle.x < -115) vehicle.x = 115;
  } else {
    vehicle.z += vehicle.speed * vehicle.lane * dt * 60;
    vehicle.rotation = vehicle.lane > 0 ? 0 : Math.PI;

    if (vehicle.z > 80) vehicle.z = -80;
    if (vehicle.z < -80) vehicle.z = 80;
  }
}

/* =========================================================
   WEATHER
========================================================= */

const WEATHER_TYPES = [
  "sunny",
  "cloudy",
  "light_rain",
  "heavy_rain",
  "storm",
  "windy",
];

function updateWeather(dt) {
  game.world.weatherTimer -= dt;

  if (game.world.weatherTimer > 0) {
    return;
  }

  game.world.weather = pick(WEATHER_TYPES);

  game.world.weatherTimer = rand(60, 180);
}

/* =========================================================
   WORLD CLOCK
========================================================= */

function updateWorld(dt) {
  /*
    1 giây thật = 1 phút trong game
    24 phút thật = 1 ngày game
  */

  game.world.time += dt;

  if (game.world.time >= 1440) {
    game.world.time -= 1440;

    game.world.day += 1;

    processDailyBusiness();
    processDailySalary();
  }

  updateWeather(dt);
}

function processDailyBusiness() {
  for (const business of game.businesses.values()) {
    business.dailyRevenue = 0;
    business.customers = 0;
  }
}

function processDailySalary() {
  for (const player of game.players.values()) {
    const job = JOBS[player.job];

    if (!job || !job.salary) continue;

    player.money += job.salary;
    player.lastSalaryDay = game.world.day;
  }
}

/* =========================================================
   BUSINESS HELPERS
========================================================= */

function getPlayerBusiness(player, businessId) {
  if (!businessId) return null;

  const business = game.businesses.get(businessId);

  if (!business) return null;

  if (
    business.ownerId !== player.id &&
    business.tenantId !== player.id
  ) {
    return null;
  }

  return business;
}

function playerOwnsBusiness(player, business) {
  return (
    business.ownerId === player.id ||
    business.tenantId === player.id
  );
}

/* =========================================================
   BUY ITEM
========================================================= */

function buyItem(player, item, amount) {
  amount = Math.max(1, Math.floor(Number(amount) || 1));

  const data = game.market[item];

  if (!data) {
    return {
      ok: false,
      message: "Không có mặt hàng này.",
    };
  }

  const cost = data.buy * amount;

  if (player.money < cost) {
    return {
      ok: false,
      message: "Không đủ tiền.",
    };
  }

  player.money -= cost;
  player.inventory[item] =
    (player.inventory[item] || 0) + amount;

  return {
    ok: true,
    message: `Đã mua ${amount} ${data.name}.`,
  };
}

/* =========================================================
   SELL ITEM
========================================================= */

function sellItem(player, item, amount) {
  amount = Math.max(1, Math.floor(Number(amount) || 1));

  const data = game.market[item];

  if (!data) {
    return {
      ok: false,
      message: "Không có mặt hàng này.",
    };
  }

  const owned = player.inventory[item] || 0;

  if (owned < amount) {
    return {
      ok: false,
      message: "Không đủ hàng.",
    };
  }

  const money = data.sell * amount;

  player.inventory[item] -= amount;
  player.money += money;

  return {
    ok: true,
    message: `Đã bán ${amount} ${data.name}, nhận ${money}$.`,
  };
}

/* =========================================================
   RENT BUSINESS
========================================================= */

function rentBusiness(player, businessId) {
  const business = game.businesses.get(businessId);

  if (!business) {
    return {
      ok: false,
      message: "Không tìm thấy cửa hàng.",
    };
  }

  if (business.ownerId || business.tenantId) {
    return {
      ok: false,
      message: "Cửa hàng này đã có người sử dụng.",
    };
  }

  const rent = BUSINESS_TYPES[business.type]?.rent || 300;

  if (player.money < rent) {
    return {
      ok: false,
      message: "Không đủ tiền thuê.",
    };
  }

  player.money -= rent;

  business.tenantId = player.id;

  player.rentedBusiness = business.id;

  return {
    ok: true,
    message: `Bạn đã thuê ${business.name}.`,
  };
}

/* =========================================================
   BUY BUSINESS
========================================================= */

function buyBusiness(player, businessId) {
  const business = game.businesses.get(businessId);

  if (!business) {
    return {
      ok: false,
      message: "Không tìm thấy cửa hàng.",
    };
  }

  if (business.ownerId || business.tenantId) {
    return {
      ok: false,
      message: "Cửa hàng đã có người sở hữu.",
    };
  }

  const price =
    business.price ||
    BUSINESS_TYPES[business.type]?.price ||
    1000;

  if (player.money < price) {
    return {
      ok: false,
      message: "Không đủ tiền mua cửa hàng.",
    };
  }

  player.money -= price;

  business.ownerId = player.id;

  player.ownedBusinesses.push(business.id);

  return {
    ok: true,
    message: `Bạn đã mua ${business.name}.`,
  };
}

/* =========================================================
   FURNITURE
========================================================= */

function buyFurniture(player, businessId, furnitureType) {
  const business = getPlayerBusiness(player, businessId);

  if (!business) {
    return {
      ok: false,
      message: "Bạn không sở hữu cửa hàng này.",
    };
  }

  const item = FURNITURE[furnitureType];

  if (!item) {
    return {
      ok: false,
      message: "Không có món nội thất này.",
    };
  }

  if (player.money < item.price) {
    return {
      ok: false,
      message: "Không đủ tiền.",
    };
  }

  player.money -= item.price;

  const furniture = {
    id: makeId("furniture"),

    businessId,

    type: furnitureType,

    x: rand(-3, 3),
    z: rand(-3, 3),

    rotation: 0,
  };

  business.furniture.push(furniture);
  player.furniture.push(furniture.id);

  game.furniture.set(furniture.id, furniture);

  return {
    ok: true,
    message: `Đã mua ${item.name}.`,
  };
}

/* =========================================================
   HIRE EMPLOYEE
========================================================= */

function hireEmployee(player, businessId, job) {
  const business = getPlayerBusiness(player, businessId);

  if (!business) {
    return {
      ok: false,
      message: "Bạn không sở hữu cửa hàng này.",
    };
  }

  if (!JOBS[job]) {
    return {
      ok: false,
      message: "Công việc không hợp lệ.",
    };
  }

  const cost = 300 + business.level * 100;

  if (player.money < cost) {
    return {
      ok: false,
      message: "Không đủ tiền thuê nhân viên.",
    };
  }

  player.money -= cost;

  const employee = {
    id: makeId("employee"),
    job,
    salary: JOBS[job].salary,
    name: pick([
      "Nhân viên A",
      "Nhân viên B",
      "Nhân viên C",
      "Nhân viên D",
    ]),
  };

  business.employees.push(employee);

  return {
    ok: true,
    message: `Đã thuê ${employee.name}.`,
  };
}

/* =========================================================
   UPGRADE BUSINESS
========================================================= */

function upgradeBusiness(player, businessId) {
  const business = getPlayerBusiness(player, businessId);

  if (!business) {
    return {
      ok: false,
      message: "Bạn không sở hữu cửa hàng này.",
    };
  }

  const cost = 1000 * business.level;

  if (player.money < cost) {
    return {
      ok: false,
      message: "Không đủ tiền nâng cấp.",
    };
  }

  player.money -= cost;

  business.level += 1;
  business.reputation = clamp(
    business.reputation + 5,
    0,
    100
  );

  return {
    ok: true,
    message: `Cửa hàng đã lên cấp ${business.level}.`,
  };
}

/* =========================================================
   WITHDRAW BUSINESS MONEY
========================================================= */

function withdrawBusiness(player, businessId, amount) {
  const business = getPlayerBusiness(player, businessId);

  if (!business) {
    return {
      ok: false,
      message: "Bạn không sở hữu cửa hàng này.",
    };
  }

  amount = Math.max(1, Math.floor(Number(amount) || 1));

  if (business.money < amount) {
    return {
      ok: false,
      message: "Cửa hàng không đủ tiền.",
    };
  }

  business.money -= amount;
  player.money += amount;

  return {
    ok: true,
    message: `Đã rút ${amount}$.`,
  };
}

/* =========================================================
   HOTEL
========================================================= */

function hotelCheckin(player, businessId) {
  const business = game.businesses.get(businessId);

  if (!business || business.type !== "hotel") {
    return {
      ok: false,
      message: "Đây không phải khách sạn.",
    };
  }

  const room = [...game.rooms.values()].find(
    (r) =>
      r.businessId === businessId &&
      !r.occupied
  );

  if (!room) {
    return {
      ok: false,
      message: "Khách sạn đã hết phòng.",
    };
  }

  if (player.money < room.price) {
    return {
      ok: false,
      message: "Không đủ tiền thuê phòng.",
    };
  }

  player.money -= room.price;

  room.occupied = true;
  room.guestId = player.id;
  room.timer = 300;

  business.money += room.price;

  return {
    ok: true,
    message: `Đã nhận phòng ${room.number}.`,
  };
}

/* =========================================================
   RESTAURANT
========================================================= */

function restaurantOrder(player, businessId, item) {
  const business = game.businesses.get(businessId);

  if (!business) {
    return {
      ok: false,
      message: "Không tìm thấy nhà hàng.",
    };
  }

  if (business.type !== "restaurant" && business.type !== "food") {
    return {
      ok: false,
      message: "Không thể gọi món ở đây.",
    };
  }

  const prices = {
    food: 80,
    rice: 45,
    meat: 90,
    fish: 85,
    water: 15,
  };

  const price = prices[item];

  if (!price) {
    return {
      ok: false,
      message: "Món ăn không tồn tại.",
    };
  }

  if (player.money < price) {
    return {
      ok: false,
      message: "Không đủ tiền.",
    };
  }

  player.money -= price;

  business.money += price;
  business.customers += 1;
  business.dailyRevenue += price;

  return {
    ok: true,
    message: `Đã gọi món ${ITEMS[item]?.name || item}.`,
  };
}

/* =========================================================
   TAXI
========================================================= */

function requestRide(player) {
  const taxiJobPlayers = [...game.players.values()].filter(
    (p) =>
      p.id !== player.id &&
      p.job === "taxi"
  );

  if (!taxiJobPlayers.length) {
    return {
      ok: false,
      message: "Hiện chưa có tài xế xe ôm.",
    };
  }

  const driver = pick(taxiJobPlayers);

  const price = randInt(30, 100);

  if (player.money < price) {
    return {
      ok: false,
      message: "Không đủ tiền đi xe.",
    };
  }

  player.money -= price;
  driver.money += price;

  return {
    ok: true,
    message: `Đã gọi xe. Cước ${price}$.`,
  };
}

/* =========================================================
   INTERACTION
========================================================= */

function interact(player, targetId) {
  if (!targetId) {
    return {
      ok: false,
      message: "Không có đối tượng.",
    };
  }

  const building = game.buildings.get(targetId);

  if (building) {
    const business = [...game.businesses.values()].find(
      (b) => b.buildingId === building.id
    );

    if (business) {
      return {
        ok: true,
        message: `${business.name} - cấp ${business.level}`,
        building,
        business,
      };
    }

    return {
      ok: true,
      message: building.name,
      building,
    };
  }

  const business = game.businesses.get(targetId);

  if (business) {
    return {
      ok: true,
      message: business.name,
      business,
    };
  }

  return {
    ok: false,
    message: "Không tìm thấy.",
  };
}

/* =========================================================
   BIKE
========================================================= */

function toggleBike(player) {
  player.bike.active = !player.bike.active;

  return player.bike.active;
}

/* =========================================================
   JOB
========================================================= */

function changeJob(player, job) {
  if (!JOBS[job]) {
    return {
      ok: false,
      message: "Nghề không tồn tại.",
    };
  }

  player.job = job;

  return {
    ok: true,
    message: `Bạn đã chọn nghề ${JOBS[job].name}.`,
  };
}

/* =========================================================
   STATE SERIALIZATION
========================================================= */

function serializePlayer(player) {
  return {
    id: player.id,

    name: player.name,
    gender: player.gender,

    x: player.x,
    z: player.z,

    rotation: player.rotation,

    money: Math.floor(player.money),

    energy: Math.floor(player.energy),
    hunger: Math.floor(player.hunger),

    job: player.job,

    inventory: player.inventory,

    bike: player.bike,

    ownedBusinesses: player.ownedBusinesses,

    rentedBusiness: player.rentedBusiness,
  };
}

function serializeNPC(npc) {
  return {
    id: npc.id,

    name: npc.name,

    gender: npc.gender,

    role: npc.role,

    x: npc.x,
    z: npc.z,
  };
}

function serializeVehicle(vehicle) {
  return {
    id: vehicle.id,

    type: vehicle.type,

    x: vehicle.x,
    z: vehicle.z,

    rotation: vehicle.rotation,
  };
}

function serializeBusiness(business) {
  return {
    id: business.id,

    buildingId: business.buildingId,

    type: business.type,

    name: business.name,

    ownerId: business.ownerId,
    tenantId: business.tenantId,

    level: business.level,

    money: Math.floor(business.money),

    price: business.price,

    employees: business.employees,

    customers: business.customers,

    reputation: business.reputation,

    stock: business.stock,

    furniture: business.furniture,

    open: business.open,

    dailyRevenue: Math.floor(business.dailyRevenue),
  };
}

function buildState() {
  return {
    type: "state",

    players: [...game.players.values()].map(
      serializePlayer
    ),

    npcs: [...game.npcs.values()].map(
      serializeNPC
    ),

    vehicles: [...game.vehicles.values()].map(
      serializeVehicle
    ),

    buildings: [...game.buildings.values()],

    businesses: [...game.businesses.values()].map(
      serializeBusiness
    ),

    market: game.market,

    world: game.world,
  };
}

/* =========================================================
   PLAYER CLEANUP
========================================================= */

function cleanupPlayer(player) {
  for (const room of game.rooms.values()) {
    if (room.guestId === player.id) {
      room.occupied = false;
      room.guestId = null;
      room.timer = 0;
    }
  }

  for (const business of game.businesses.values()) {
    business.employees =
      business.employees.filter(
        (employee) => employee.playerId !== player.id
      );
  }

  game.players.delete(player.id);
}

/* =========================================================
   MESSAGE HANDLER
========================================================= */

function handleMessage(ws, player, message) {
  if (!message || typeof message !== "object") {
    return;
  }

  switch (message.type) {
    case "input": {
      player.input.dx = clamp(
        Number(message.dx) || 0,
        -1,
        1
      );

      player.input.dz = clamp(
        Number(message.dz) || 0,
        -1,
        1
      );

      break;
    }

    case "bike_toggle": {
      const active = toggleBike(player);

      notice(
        ws,
        active
          ? "Đã lên xe máy."
          : "Đã xuống xe máy."
      );

      break;
    }

    case "buy": {
      const result = buyItem(
        player,
        message.item,
        message.amount
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "sell": {
      const result = sellItem(
        player,
        message.item,
        message.amount
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "job": {
      const result = changeJob(
        player,
        message.job
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "rent_business": {
      const result = rentBusiness(
        player,
        message.businessId
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "buy_business": {
      const result = buyBusiness(
        player,
        message.businessId
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "buy_furniture": {
      const result = buyFurniture(
        player,
        message.businessId,
        message.furnitureType
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "hire_employee": {
      const result = hireEmployee(
        player,
        message.businessId,
        message.job
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "withdraw_business": {
      const result = withdrawBusiness(
        player,
        message.businessId,
        message.amount
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "upgrade_business": {
      const result = upgradeBusiness(
        player,
        message.businessId
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "hotel_checkin": {
      const result = hotelCheckin(
        player,
        message.businessId
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "restaurant_order": {
      const result = restaurantOrder(
        player,
        message.businessId,
        message.item
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "request_ride": {
      const result = requestRide(player);

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        notice(ws, result.message);
      }

      break;
    }

    case "interact": {
      const result = interact(
        player,
        message.targetId
      );

      if (!result.ok) {
        errorMessage(ws, result.message);
      } else {
        send(ws, {
          type: "interaction",
          ...result,
        });
      }

      break;
    }

    case "business_price": {
      const business = getPlayerBusiness(
        player,
        message.businessId
      );

      if (!business) {
        errorMessage(
          ws,
          "Bạn không sở hữu cửa hàng này."
        );
        break;
      }

      const price = Math.max(
        1,
        Number(message.price) || business.price
      );

      business.price = price;

      notice(
        ws,
        `Đã đặt giá cửa hàng: ${price}$`
      );

      break;
    }

    case "chat": {
      const text = String(message.message || "")
        .trim()
        .slice(0, 200);

      if (!text) break;

      broadcast({
        type: "chat",
        playerId: player.id,
        name: player.name,
        message: text,
      });

      break;
    }

    case "ping": {
      send(ws, {
        type: "pong",
        time: Date.now(),
      });

      break;
    }

    default:
      break;
  }
}

/* =========================================================
   WEBSOCKET
========================================================= */

wss.on("connection", (ws) => {
  let player = null;

  send(ws, {
    type: "connected",
    message: "Đã kết nối máy chủ.",
  });

  ws.on("message", (raw) => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      errorMessage(ws, "Dữ liệu gửi lên không hợp lệ.");
      return;
    }

    if (message.type === "join") {
      if (player) {
        return;
      }

      player = createPlayer(
        ws,
        message.name,
        message.gender
      );

      send(ws, {
        type: "welcome",
        id: player.id,
        player: serializePlayer(player),
      });

      notice(
        ws,
        "Chào mừng đến với Buông Gì Bán!"
      );

      return;
    }

    if (!player) {
      errorMessage(
        ws,
        "Bạn chưa vào game."
      );
      return;
    }

    handleMessage(ws, player, message);
  });

  ws.on("close", () => {
    if (!player) return;

    cleanupPlayer(player);
  });

  ws.on("error", () => {
    if (!player) return;

    cleanupPlayer(player);
  });
});

/* =========================================================
   GAME LOOP
========================================================= */

let lastTime = Date.now();

function gameLoop() {
  const now = Date.now();

  let dt = (now - lastTime) / 1000;

  lastTime = now;

  dt = Math.min(dt, 0.1);

  updateWorld(dt);

  for (const player of game.players.values()) {
    updatePlayerMovement(player, dt);
  }

  for (const npc of game.npcs.values()) {
    updateNPC(npc, dt);
    processNPCBusiness(npc);
  }

  for (const vehicle of game.vehicles.values()) {
    updateVehicle(vehicle, dt);
  }

  for (const room of game.rooms.values()) {
    if (!room.occupied) continue;

    room.timer -= dt;

    if (room.timer <= 0) {
      room.occupied = false;
      room.guestId = null;
      room.timer = 0;
    }
  }

  setTimeout(gameLoop, 1000 / 30);
}

/* =========================================================
   STATE BROADCAST
========================================================= */

function broadcastState() {
  broadcast(buildState());
}

/* =========================================================
   MARKET UPDATE
========================================================= */

function updateMarket() {
  for (const item of Object.keys(game.market)) {
    const marketItem = game.market[item];

    const change = rand(-0.08, 0.08);

    marketItem.buy = Math.max(
      2,
      Math.round(marketItem.buy * (1 + change))
    );

    marketItem.sell = Math.max(
      1,
      Math.round(marketItem.buy * 0.68)
    );
  }
}

/* =========================================================
   STARTUP
========================================================= */

createCity();
createBusinesses();
createHotelRooms();

ensureNPCs();
ensureVehicles();

setInterval(broadcastState, 100);
setInterval(updateMarket, 60000);

gameLoop();

server.listen(PORT, "0.0.0.0", () => {
  console.log("=================================");
  console.log(" BUÔNG GÌ BÁN - SERVER");
  console.log("=================================");
  console.log("Game size: 1280x720");
  console.log(`Web: http://localhost:${PORT}`);
  console.log("WebSocket: ON");
  console.log(`Buildings: ${game.buildings.size}`);
  console.log(`Businesses: ${game.businesses.size}`);
  console.log(`NPCs: ${game.npcs.size}`);
  console.log(`Vehicles: ${game.vehicles.size}`);
  console.log("Server đang chạy...");
});