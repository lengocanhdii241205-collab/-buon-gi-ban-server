// ============================================================
// BUÔNG GÌ BÁN - MULTIPLAYER GAME SERVER
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");
const WebSocket = require("ws");

const PORT = process.env.PORT || 3000;

const TICK_RATE = 30;
const STATE_RATE = 10;

const WORLD = {
  width: 210,
  depth: 150,
  dayLengthMinutes: 24,
  time: 8 * 60,
  day: 1,
  weather: "sunny"
};

// ============================================================
// UTILS
// ============================================================

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(random(min, max + 1));
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeId(prefix = "id") {
  return (
    prefix +
    "_" +
    Date.now().toString(36) +
    "_" +
    Math.random().toString(36).slice(2, 8)
  );
}

function distance(a, b) {
  return Math.hypot(
    (a.x || 0) - (b.x || 0),
    (a.z || 0) - (b.z || 0)
  );
}

function send(ws, data) {
  if (!ws) return;

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(data));
  }
}

function broadcast(room, data) {
  for (const player of room.players.values()) {
    send(player.ws, data);
  }
}

function notify(player, text, type = "info") {
  send(player.ws, {
    type: "notice",
    text,
    noticeType: type
  });
}

// ============================================================
// MARKET
// ============================================================

const MARKET_TEMPLATE = [
  {
    id: "rice",
    name: "Gạo",
    buy: 20,
    sell: 12
  },
  {
    id: "vegetable",
    name: "Rau",
    buy: 15,
    sell: 8
  },
  {
    id: "meat",
    name: "Thịt",
    buy: 45,
    sell: 28
  },
  {
    id: "fish",
    name: "Cá",
    buy: 40,
    sell: 25
  },
  {
    id: "milk",
    name: "Sữa",
    buy: 25,
    sell: 15
  },
  {
    id: "tea",
    name: "Trà",
    buy: 18,
    sell: 10
  },
  {
    id: "coffee",
    name: "Cà phê",
    buy: 30,
    sell: 18
  },
  {
    id: "sugar",
    name: "Đường",
    buy: 16,
    sell: 9
  },
  {
    id: "egg",
    name: "Trứng",
    buy: 22,
    sell: 13
  },
  {
    id: "noodle",
    name: "Mì",
    buy: 18,
    sell: 10
  }
];

function createMarket() {
  return MARKET_TEMPLATE.map(item => ({
    ...item
  }));
}

// ============================================================
// BUILDINGS
// ============================================================

const BUILDINGS = [
  {
    id: "market",
    name: "Siêu thị Bình Minh",
    type: "supermarket",
    x: -60,
    z: -25,
    width: 26,
    depth: 20,
    height: 9,
    color: 0x78b7e8,
    roof: 0xf5f5f5
  },
  {
    id: "hotel",
    name: "Khách sạn Mặt Trời",
    type: "hotel",
    x: 35,
    z: -35,
    width: 28,
    depth: 22,
    height: 14,
    color: 0xf0c36b,
    roof: 0xc45c5c
  },
  {
    id: "restaurant",
    name: "Quán Cơm Nhà",
    type: "restaurant",
    x: 45,
    z: 15,
    width: 24,
    depth: 18,
    height: 8,
    color: 0xe58c67,
    roof: 0xa94747
  },
  {
    id: "tea",
    name: "Trà Sữa Góc Phố",
    type: "tea",
    x: 5,
    z: 30,
    width: 20,
    depth: 16,
    height: 7,
    color: 0xd99ce8,
    roof: 0x8e5fa9
  },
  {
    id: "vegetable",
    name: "Sạp Rau Cô Ba",
    type: "vegetable",
    x: -40,
    z: 30,
    width: 18,
    depth: 14,
    height: 5,
    color: 0x83c779,
    roof: 0x4c9851
  },
  {
    id: "food",
    name: "Quán Ăn Bình Dân",
    type: "food",
    x: -10,
    z: -35,
    width: 22,
    depth: 17,
    height: 7,
    color: 0xe6a15b,
    roof: 0xb76a38
  },
  {
    id: "house1",
    name: "Nhà dân 1",
    type: "house",
    x: -80,
    z: 30,
    width: 18,
    depth: 16,
    height: 7,
    color: 0xb7d6ec,
    roof: 0x7a6a5a
  },
  {
    id: "house2",
    name: "Nhà dân 2",
    type: "house",
    x: 80,
    z: 30,
    width: 18,
    depth: 16,
    height: 7,
    color: 0xf0b5a4,
    roof: 0x735c4a
  }
];

// ============================================================
// JOBS
// ============================================================

const JOBS = {
  unemployed: {
    name: "Chưa có việc",
    salary: 0
  },

  driver: {
    name: "Tài xế xe ôm",
    salary: 120
  },

  waiter: {
    name: "Nhân viên phục vụ",
    salary: 100
  },

  cook: {
    name: "Đầu bếp",
    salary: 130
  },

  barista: {
    name: "Barista",
    salary: 120
  },

  supermarket: {
    name: "Nhân viên siêu thị",
    salary: 110
  },

  hotel: {
    name: "Nhân viên khách sạn",
    salary: 115
  },

  seller: {
    name: "Người bán hàng",
    salary: 100
  }
};

// ============================================================
// FURNITURE
// ============================================================

const FURNITURE = {
  table: {
    name: "Bàn",
    price: 150
  },

  chair: {
    name: "Ghế",
    price: 80
  },

  tv: {
    name: "TV",
    price: 500
  },

  speaker: {
    name: "Loa",
    price: 350
  },

  light: {
    name: "Đèn",
    price: 100
  },

  ac: {
    name: "Máy lạnh",
    price: 800
  },

  fan: {
    name: "Quạt",
    price: 180
  },

  fridge: {
    name: "Tủ lạnh",
    price: 700
  },

  coffee_machine: {
    name: "Máy pha cà phê",
    price: 900
  },

  milk_tea_machine: {
    name: "Máy pha trà sữa",
    price: 850
  },

  stove: {
    name: "Bếp",
    price: 450
  },

  pot: {
    name: "Nồi",
    price: 120
  },

  pan: {
    name: "Chảo",
    price: 120
  },

  plant: {
    name: "Cây cảnh",
    price: 90
  },

  painting: {
    name: "Tranh",
    price: 180
  },

  trash_bin: {
    name: "Thùng rác",
    price: 60
  },

  cash_register: {
    name: "Máy tính tiền",
    price: 600
  }
};

// ============================================================
// ROOMS
// ============================================================

const rooms = new Map();

function createRoom(id = "town") {
  const room = {
    id,

    players: new Map(),

    npcs: new Map(),

    vehicles: new Map(),

    businesses: new Map(),

    market: createMarket(),

    world: {
      ...WORLD
    },

    lastStateBroadcast: 0,

    lastMarketUpdate: 0,

    lastSalaryDay: 1
  };

  // ----------------------------------------------------------
  // NPC
  // ----------------------------------------------------------

  const npcRoles = [
    "customer",
    "customer",
    "customer",
    "customer",
    "hotel_guest",
    "restaurant_guest",
    "shop_owner",
    "supermarket_staff",
    "server",
    "kitchen",
    "barista",
    "homeowner"
  ];

  for (let i = 0; i < 45; i++) {
    const npc = createNPC(
      pick(npcRoles),
      i
    );

    room.npcs.set(npc.id, npc);
  }

  // ----------------------------------------------------------
  // VEHICLES
  // ----------------------------------------------------------

  const vehicleTypes = [
    "car",
    "car",
    "motorbike",
    "motorbike",
    "bus",
    "taxi",
    "delivery",
    "bicycle"
  ];

  for (let i = 0; i < 18; i++) {
    const vehicle = createVehicle(
      pick(vehicleTypes),
      i
    );

    room.vehicles.set(vehicle.id, vehicle);
  }

  // ----------------------------------------------------------
  // BUSINESSES
  // ----------------------------------------------------------

  for (const building of BUILDINGS) {
    if (
      [
        "supermarket",
        "hotel",
        "restaurant",
        "tea",
        "vegetable",
        "food"
      ].includes(building.type)
    ) {
      room.businesses.set(
        building.id,
        createBusiness(building)
      );
    }
  }

  rooms.set(id, room);

  return room;
}

function getAvailableRoom() {
  if (!rooms.has("town")) {
    return createRoom("town");
  }

  return rooms.get("town");
}

// ============================================================
// PLAYER
// ============================================================

function createPlayer(ws, name, gender) {
  return {
    id: makeId("player"),

    ws,

    name:
      String(name || "Người chơi")
        .slice(0, 20),

    gender:
      gender === "female"
        ? "female"
        : "male",

    x: random(-10, 10),

    z: random(-10, 10),

    rotation: 0,

    velocity: {
      x: 0,
      z: 0
    },

    input: {
      dx: 0,
      dz: 0,
      lastUpdate: Date.now()
    },

    money: 3000,

    job: "unemployed",

    inventory: {},

    bike: {
      owned: false,
      active: false
    },

    furniture: [],

    businessId: null,

    lastSalaryDay: 1,

    joinedAt: Date.now()
  };
}

// ============================================================
// PLAYER MOVEMENT
// ============================================================

function updatePlayerMovement(player, dt) {
  const input = player.input || {
    dx: 0,
    dz: 0,
    lastUpdate: 0
  };

  // Nếu mất input quá lâu thì dừng
  if (Date.now() - input.lastUpdate > 700) {
    input.dx = 0;
    input.dz = 0;
  }

  let dx = Number(input.dx) || 0;
  let dz = Number(input.dz) || 0;

  const length = Math.hypot(dx, dz);

  if (length > 1) {
    dx /= length;
    dz /= length;
  }

  const moving =
    Math.abs(dx) + Math.abs(dz) > 0.01;

  const maxSpeed =
    player.bike.active && player.bike.owned
      ? 0.30
      : 0.15;

  const acceleration = 0.20;
  const braking = 0.72;

  if (moving) {
    player.velocity.x +=
      (dx * maxSpeed - player.velocity.x) *
      acceleration;

    player.velocity.z +=
      (dz * maxSpeed - player.velocity.z) *
      acceleration;

    player.rotation =
      Math.atan2(dx, dz);
  } else {
    player.velocity.x *= braking;
    player.velocity.z *= braking;

    if (
      Math.abs(player.velocity.x) < 0.001
    ) {
      player.velocity.x = 0;
    }

    if (
      Math.abs(player.velocity.z) < 0.001
    ) {
      player.velocity.z = 0;
    }
  }

  player.x +=
    player.velocity.x *
    (dt * TICK_RATE);

  player.z +=
    player.velocity.z *
    (dt * TICK_RATE);

  player.x = clamp(
    player.x,
    -105,
    105
  );

  player.z = clamp(
    player.z,
    -75,
    75
  );
}

// ============================================================
// NPC
// ============================================================

function createNPC(role, index) {
  const genders = [
    "male",
    "female"
  ];

  return {
    id: makeId("npc"),

    name:
      `${role}_${index + 1}`,

    gender: pick(genders),

    role,

    x: random(-95, 95),

    z: random(-65, 65),

    targetX: random(-95, 95),

    targetZ: random(-65, 65),

    rotation: 0,

    speed: random(
      0.025,
      0.055
    ),

    state: "walking",

    waitUntil: 0,

    money: randomInt(
      500,
      3000
    ),

    activity: null,

    homeId: null,

    targetBusinessId: null
  };
}

function chooseNPCTarget(room, npc) {
  const buildings =
    BUILDINGS.filter(
      b =>
        b.type !== "house" ||
        npc.role === "homeowner"
    );

  if (
    npc.role === "hotel_guest"
  ) {
    const hotels =
      BUILDINGS.filter(
        b => b.type === "hotel"
      );

    if (hotels.length) {
      return pick(hotels);
    }
  }

  if (
    npc.role === "restaurant_guest"
  ) {
    const restaurants =
      BUILDINGS.filter(
        b =>
          b.type === "restaurant" ||
          b.type === "food"
      );

    if (restaurants.length) {
      return pick(restaurants);
    }
  }

  if (
    npc.role === "customer"
  ) {
    const shops =
      BUILDINGS.filter(
        b =>
          b.type === "supermarket" ||
          b.type === "tea" ||
          b.type === "vegetable" ||
          b.type === "food" ||
          b.type === "restaurant"
      );

    if (shops.length) {
      return pick(shops);
    }
  }

  return pick(buildings);
}

function updateNPC(
  room,
  npc,
  dt,
  now
) {
  if (npc.state === "waiting") {
    if (now >= npc.waitUntil) {
      npc.state = "walking";
    } else {
      return;
    }
  }

  if (npc.state === "walking") {
    const dx =
      npc.targetX - npc.x;

    const dz =
      npc.targetZ - npc.z;

    const dist =
      Math.hypot(dx, dz);

    if (dist < 2) {
      npc.state = "waiting";

      npc.waitUntil =
        now +
        randomInt(
          2000,
          7000
        );

      const building =
        chooseNPCTarget(
          room,
          npc
        );

      npc.targetX =
        building.x +
        random(
          -building.width / 2,
          building.width / 2
        );

      npc.targetZ =
        building.z +
        random(
          -building.depth / 2,
          building.depth / 2
        );

      npc.targetBusinessId =
        building.id;

      npc.activity =
        npc.role === "customer"
          ? "shopping"
          : npc.role === "hotel_guest"
          ? "booking"
          : npc.role === "restaurant_guest"
          ? "eating"
          : npc.role;

      return;
    }

    const nx = dx / dist;
    const nz = dz / dist;

    npc.x +=
      nx *
      npc.speed *
      (dt * TICK_RATE);

    npc.z +=
      nz *
      npc.speed *
      (dt * TICK_RATE);

    npc.rotation =
      Math.atan2(
        nx,
        nz
      );
  }
}

// ============================================================
// VEHICLES
// ============================================================

function createVehicle(type, index) {
  return {
    id: makeId("vehicle"),

    type,

    x: random(
      -100,
      100
    ),

    z: random(
      -70,
      70
    ),

    rotation:
      pick([
        0,
        Math.PI / 2,
        Math.PI,
        -Math.PI / 2
      ]),

    speed:
      type === "bus"
        ? 0.10
        : type === "motorbike"
        ? 0.17
        : type === "bicycle"
        ? 0.08
        : 0.12,

    laneOffset:
      random(
        -2,
        2
      ),

    route:
      randomInt(
        0,
        3
      )
  };
}

function updateVehicles(
  room,
  dt
) {
  for (const vehicle of room.vehicles.values()) {
    const speed =
      vehicle.speed *
      dt *
      TICK_RATE;

    if (
      vehicle.route === 0
    ) {
      vehicle.x += speed;

      if (vehicle.x > 110) {
        vehicle.x = -110;
      }

      vehicle.rotation =
        Math.PI / 2;
    }

    else if (
      vehicle.route === 1
    ) {
      vehicle.x -= speed;

      if (vehicle.x < -110) {
        vehicle.x = 110;
      }

      vehicle.rotation =
        -Math.PI / 2;
    }

    else if (
      vehicle.route === 2
    ) {
      vehicle.z += speed;

      if (vehicle.z > 80) {
        vehicle.z = -80;
      }

      vehicle.rotation = 0;
    }

    else {
      vehicle.z -= speed;

      if (vehicle.z < -80) {
        vehicle.z = 80;
      }

      vehicle.rotation =
        Math.PI;
    }
  }
}

// ============================================================
// BUSINESS
// ============================================================

function createBusiness(building) {
  return {
    id: building.id,

    buildingId: building.id,

    type: building.type,

    ownerId: null,

    ownerName: null,

    level: 1,

    income: 0,

    totalIncome: 0,

    priceMultiplier: 1,

    employees: [],

    furniture: [],

    stock: {},

    customers: 0,

    rooms: {},

    open: true
  };
}

function getPlayerBusiness(
  room,
  player
) {
  if (!player.businessId) {
    return null;
  }

  return room.businesses.get(
    player.businessId
  );
}

function rentBusiness(
  room,
  player,
  businessId
) {
  const business =
    room.businesses.get(
      businessId
    );

  if (!business) {
    notify(
      player,
      "Không tìm thấy cửa hàng.",
      "error"
    );

    return;
  }

  if (business.ownerId) {
    notify(
      player,
      "Cửa hàng này đã có chủ.",
      "error"
    );

    return;
  }

  if (player.businessId) {
    notify(
      player,
      "Bạn đang sở hữu một cơ sở khác.",
      "error"
    );

    return;
  }

  const rentPrice =
    1500;

  if (
    player.money <
    rentPrice
  ) {
    notify(
      player,
      `Cần ${rentPrice}$ để thuê.`,
      "error"
    );

    return;
  }

  player.money -=
    rentPrice;

  business.ownerId =
    player.id;

  business.ownerName =
    player.name;

  player.businessId =
    business.id;

  notify(
    player,
    `Bạn đã thuê ${business.id}!`,
    "success"
  );
}

function hireEmployee(
  room,
  player,
  role
) {
  const business =
    getPlayerBusiness(
      room,
      player
    );

  if (!business) {
    notify(
      player,
      "Bạn chưa có cơ sở kinh doanh.",
      "error"
    );

    return;
  }

  const job =
    JOBS[role];

  if (!job) {
    notify(
      player,
      "Công việc không tồn tại.",
      "error"
    );

    return;
  }

  const cost =
    job.salary * 5;

  if (
    player.money <
    cost
  ) {
    notify(
      player,
      `Cần ${cost}$ để thuê nhân viên.`,
      "error"
    );

    return;
  }

  player.money -=
    cost;

  business.employees.push({
    id: makeId("employee"),
    role,
    salary: job.salary
  });

  notify(
    player,
    `Đã thuê ${job.name}.`,
    "success"
  );
}

function updateBusinessIncome(
  room,
  dt
) {
  for (
    const business
    of room.businesses.values()
  ) {
    if (
      !business.ownerId ||
      !business.open
    ) {
      continue;
    }

    const building =
      BUILDINGS.find(
        b =>
          b.id ===
          business.buildingId
      );

    if (!building) {
      continue;
    }

    let chance =
      0.0009 *
      business.level;

    if (
      business.type ===
      "restaurant"
    ) {
      chance *= 1.4;
    }

    if (
      business.type ===
      "tea"
    ) {
      chance *= 1.2;
    }

    if (
      business.type ===
      "hotel"
    ) {
      chance *= 0.8;
    }

    if (
      Math.random() <
      chance *
      dt *
      TICK_RATE
    ) {
      const income =
        randomInt(
          20,
          100
        ) *
        business.level;

      business.income +=
        income;

      business.totalIncome +=
        income;

      business.customers++;
    }
  }
}

// ============================================================
// BUY / SELL
// ============================================================

function buyItem(
  room,
  player,
  itemId,
  quantity
) {
  quantity =
    clamp(
      Math.floor(
        Number(quantity) || 1
      ),
      1,
      99
    );

  const item =
    room.market.find(
      x => x.id === itemId
    );

  if (!item) {
    notify(
      player,
      "Không có mặt hàng này.",
      "error"
    );

    return;
  }

  const price =
    Math.round(
      item.buy *
      quantity
    );

  if (
    player.money <
    price
  ) {
    notify(
      player,
      "Không đủ tiền.",
      "error"
    );

    return;
  }

  player.money -=
    price;

  player.inventory[itemId] =
    (player.inventory[itemId] || 0) +
    quantity;

  notify(
    player,
    `Đã mua ${quantity} ${item.name}. -${price}$`,
    "success"
  );
}

function sellItem(
  room,
  player,
  itemId,
  quantity
) {
  quantity =
    clamp(
      Math.floor(
        Number(quantity) || 1
      ),
      1,
      99
    );

  const item =
    room.market.find(
      x => x.id === itemId
    );

  if (!item) {
    return;
  }

  const owned =
    player.inventory[itemId] ||
    0;

  if (
    owned <
    quantity
  ) {
    notify(
      player,
      "Không đủ hàng.",
      "error"
    );

    return;
  }

  const money =
    Math.round(
      item.sell *
      quantity
    );

  player.inventory[itemId] -=
    quantity;

  if (
    player.inventory[itemId] <= 0
  ) {
    delete player.inventory[itemId];
  }

  player.money +=
    money;

  notify(
    player,
    `Đã bán ${quantity} ${item.name}. +${money}$`,
    "success"
  );
}

// ============================================================
// JOB
// ============================================================

function setJob(
  player,
  jobId
) {
  if (!JOBS[jobId]) {
    notify(
      player,
      "Công việc không tồn tại.",
      "error"
    );

    return;
  }

  player.job =
    jobId;

  notify(
    player,
    `Bạn đã nhận việc: ${JOBS[jobId].name}`,
    "success"
  );
}

// ============================================================
// BIKE
// ============================================================

function toggleBike(
  player
) {
  if (!player.bike.owned) {
    const price =
      1200;

    if (
      player.money <
      price
    ) {
      notify(
        player,
        `Xe máy giá ${price}$.`,
        "error"
      );

      return;
    }

    player.money -=
      price;

    player.bike.owned =
      true;

    notify(
      player,
      "Bạn đã mua xe máy!",
      "success"
    );
  }

  player.bike.active =
    !player.bike.active;

  notify(
    player,
    player.bike.active
      ? "Đã lên xe."
      : "Đã xuống xe.",
    "info"
  );
}

// ============================================================
// FURNITURE
// ============================================================

function buyFurniture(
  player,
  furnitureId
) {
  const furniture =
    FURNITURE[furnitureId];

  if (!furniture) {
    notify(
      player,
      "Đồ nội thất không tồn tại.",
      "error"
    );

    return;
  }

  if (
    player.money <
    furniture.price
  ) {
    notify(
      player,
      "Không đủ tiền.",
      "error"
    );

    return;
  }

  player.money -=
    furniture.price;

  player.furniture.push({
    id: makeId("furniture"),
    type: furnitureId,
    x: 0,
    y: 0,
    z: 0,
    rotation: 0
  });

  notify(
    player,
    `Đã mua ${furniture.name}.`,
    "success"
  );
}

// ============================================================
// WORLD / DAY NIGHT / WEATHER
// ============================================================

function updateWorld(
  room,
  dt
) {
  room.world.time +=
    dt / 60;

  if (
    room.world.time >=
    24 * 60
  ) {
    room.world.time -=
      24 * 60;

    room.world.day++;

    for (
      const player
      of room.players.values()
    ) {
      if (
        player.lastSalaryDay !==
        room.world.day
      ) {
        const job =
          JOBS[player.job];

        if (
          job &&
          job.salary > 0
        ) {
          player.money +=
            job.salary;

          notify(
            player,
            `Bạn nhận lương ${job.salary}$.`,
            "success"
          );
        }

        player.lastSalaryDay =
          room.world.day;
      }
    }
  }

  // Thời tiết thay đổi ngẫu nhiên
  if (
    Math.random() <
    dt * 0.002
  ) {
    room.world.weather =
      pick([
        "sunny",
        "sunny",
        "cloudy",
        "light_rain",
        "heavy_rain",
        "storm"
      ]);
  }
}

function updateMarket(
  room
) {
  for (
    const item
    of room.market
  ) {
    const factor =
      random(
        0.85,
        1.20
      );

    item.buy =
      Math.max(
        5,
        Math.round(
          item.buy *
          factor
        )
      );

    item.sell =
      Math.max(
        2,
        Math.round(
          item.buy *
          random(
            0.45,
            0.75
          )
        )
      );
  }
}

// ============================================================
// CHAT
// ============================================================

function handleChat(
  room,
  player,
  text
) {
  text =
    String(text || "")
      .trim()
      .slice(0, 200);

  if (!text) {
    return;
  }

  broadcast(
    room,
    {
      type: "chat",

      playerId:
        player.id,

      name:
        player.name,

      text
    }
  );
}

// ============================================================
// BUSINESS FUNCTIONS
// ============================================================

function withdrawBusiness(
  room,
  player
) {
  const business =
    getPlayerBusiness(
      room,
      player
    );

  if (!business) {
    notify(
      player,
      "Bạn chưa có cửa hàng.",
      "error"
    );

    return;
  }

  const amount =
    Math.floor(
      business.income
    );

  if (amount <= 0) {
    notify(
      player,
      "Cửa hàng chưa có tiền.",
      "error"
    );

    return;
  }

  business.income = 0;

  player.money +=
    amount;

  notify(
    player,
    `Đã rút ${amount}$.`,
    "success"
  );
}

function upgradeBusiness(
  room,
  player
) {
  const business =
    getPlayerBusiness(
      room,
      player
    );

  if (!business) {
    notify(
      player,
      "Bạn chưa có cửa hàng.",
      "error"
    );

    return;
  }

  const price =
    3000 *
    business.level;

  if (
    player.money <
    price
  ) {
    notify(
      player,
      `Cần ${price}$ để nâng cấp.`,
      "error"
    );

    return;
  }

  player.money -=
    price;

  business.level++;

  notify(
    player,
    `Cửa hàng lên cấp ${business.level}.`,
    "success"
  );
}

function changeBusinessPrice(
  room,
  player,
  multiplier
) {
  const business =
    getPlayerBusiness(
      room,
      player
    );

  if (!business) {
    notify(
      player,
      "Bạn chưa có cửa hàng.",
      "error"
    );

    return;
  }

  business.priceMultiplier =
    clamp(
      Number(multiplier) || 1,
      0.5,
      3
    );

  notify(
    player,
    `Giá bán x${business.priceMultiplier.toFixed(2)}`,
    "success"
  );
}

// ============================================================
// INTERACTIONS
// ============================================================

function interact(
  room,
  player,
  targetId
) {
  const building =
    BUILDINGS.find(
      b =>
        b.id ===
        targetId
    );

  if (!building) {
    notify(
      player,
      "Không tìm thấy địa điểm.",
      "error"
    );

    return;
  }

  const d =
    Math.hypot(
      player.x - building.x,
      player.z - building.z
    );

  if (d > 15) {
    notify(
      player,
      "Bạn đang đứng quá xa.",
      "error"
    );

    return;
  }

  const business =
    room.businesses.get(
      building.id
    );

  if (!business) {
    notify(
      player,
      building.name,
      "info"
    );

    return;
  }

  notify(
    player,
    `${building.name} - ${business.open ? "Đang mở" : "Đang đóng"}`,
    "info"
  );
}

// ============================================================
// HOTEL
// ============================================================

function hotelCheckIn(
  room,
  player,
  hotelId
) {
  const business =
    room.businesses.get(
      hotelId
    );

  if (
    !business ||
    business.type !==
      "hotel"
  ) {
    notify(
      player,
      "Đây không phải khách sạn.",
      "error"
    );

    return;
  }

  const price =
    250;

  if (
    player.money <
    price
  ) {
    notify(
      player,
      `Một đêm giá ${price}$.`,
      "error"
    );

    return;
  }

  player.money -=
    price;

  business.income +=
    price;

  business.totalIncome +=
    price;

  notify(
    player,
    `Đã thuê phòng. -${price}$`,
    "success"
  );
}

// ============================================================
// RESTAURANT
// ============================================================

function restaurantOrder(
  room,
  player,
  restaurantId,
  item = "food"
) {
  const business =
    room.businesses.get(
      restaurantId
    );

  if (
    !business ||
    ![
      "restaurant",
      "food",
      "tea"
    ].includes(
      business.type
    )
  ) {
    notify(
      player,
      "Không thể gọi món ở đây.",
      "error"
    );

    return;
  }

  const price =
    business.type === "tea"
      ? 45
      : 80;

  if (
    player.money <
    price
  ) {
    notify(
      player,
      "Không đủ tiền gọi món.",
      "error"
    );

    return;
  }

  player.money -=
    price;

  business.income +=
    price;

  business.totalIncome +=
    price;

  business.customers++;

  notify(
    player,
    `Đã gọi món ${item}. -${price}$`,
    "success"
  );
}

// ============================================================
// TAXI
// ============================================================

function requestRide(
  room,
  player
) {
  if (
    player.job !==
    "driver"
  ) {
    notify(
      player,
      "Bạn chưa làm tài xế.",
      "error"
    );

    return;
  }

  const reward =
    randomInt(
      80,
      180
    );

  player.money +=
    reward;

  notify(
    player,
    `Chuyến xe hoàn thành. +${reward}$`,
    "success"
  );
}

// ============================================================
// SERIALIZE
// ============================================================

function serializePlayer(
  player
) {
  return {
    id: player.id,

    name: player.name,

    gender: player.gender,

    x: player.x,

    z: player.z,

    rotation:
      player.rotation,

    money:
      player.money,

    job:
      player.job,

    inventory:
      player.inventory,

    bike:
      player.bike,

    furniture:
      player.furniture,

    businessId:
      player.businessId
  };
}

function serializeNPC(
  npc
) {
  return {
    id: npc.id,

    name: npc.name,

    gender: npc.gender,

    role: npc.role,

    x: npc.x,

    z: npc.z,

    rotation:
      npc.rotation,

    state:
      npc.state,

    activity:
      npc.activity
  };
}

function serializeVehicle(
  vehicle
) {
  return {
    id: vehicle.id,

    type: vehicle.type,

    x: vehicle.x,

    z: vehicle.z,

    rotation:
      vehicle.rotation
  };
}

function serializeBusiness(
  business
) {
  return {
    id: business.id,

    buildingId:
      business.buildingId,

    type:
      business.type,

    ownerId:
      business.ownerId,

    ownerName:
      business.ownerName,

    level:
      business.level,

    income:
      business.income,

    totalIncome:
      business.totalIncome,

    priceMultiplier:
      business.priceMultiplier,

    employees:
      business.employees,

    furniture:
      business.furniture,

    customers:
      business.customers,

    open:
      business.open
  };
}

// ============================================================
// STATE
// ============================================================

function buildState(
  room
) {
  return {
    type: "state",

    world: {
      day:
        room.world.day,

      time:
        room.world.time,

      weather:
        room.world.weather
    },

    players:
      Array.from(
        room.players.values()
      ).map(
        serializePlayer
      ),

    npcs:
      Array.from(
        room.npcs.values()
      ).map(
        serializeNPC
      ),

    vehicles:
      Array.from(
        room.vehicles.values()
      ).map(
        serializeVehicle
      ),

    buildings:
      BUILDINGS,

    businesses:
      Array.from(
        room.businesses.values()
      ).map(
        serializeBusiness
      ),

    market:
      room.market
  };
}

// ============================================================
// TRAFFIC
// ============================================================

function getTrafficLight(
  time
) {
  const cycle =
    Math.floor(
      time * 60
    ) % 90;

  if (cycle < 40) {
    return "green";
  }

  if (cycle < 45) {
    return "yellow";
  }

  return "red";
}

// ============================================================
// MESSAGE HANDLER
// ============================================================

function handleMessage(
  room,
  player,
  message
) {
  let msg;

  try {
    msg =
      typeof message ===
      "string"
        ? JSON.parse(message)
        : message;
  } catch {
    return;
  }

  if (!msg) {
    return;
  }

  const type =
    msg.type;

  // ----------------------------------------------------------
  // INPUT
  // ----------------------------------------------------------

  if (type === "input") {
    player.input = {
      dx: clamp(
        Number(msg.dx) || 0,
        -1,
        1
      ),

      dz: clamp(
        Number(msg.dz) || 0,
        -1,
        1
      ),

      lastUpdate:
        Date.now()
    };

    return;
  }

  // ----------------------------------------------------------
  // BIKE
  // ----------------------------------------------------------

  if (
    type === "bike_toggle"
  ) {
    toggleBike(player);
    return;
  }

  // ----------------------------------------------------------
  // BUY
  // ----------------------------------------------------------

  if (type === "buy") {
    buyItem(
      room,
      player,
      msg.itemId,
      msg.quantity
    );

    return;
  }

  // ----------------------------------------------------------
  // SELL
  // ----------------------------------------------------------

  if (type === "sell") {
    sellItem(
      room,
      player,
      msg.itemId,
      msg.quantity
    );

    return;
  }

  // ----------------------------------------------------------
  // JOB
  // ----------------------------------------------------------

  if (type === "job") {
    setJob(
      player,
      msg.job
    );

    return;
  }

  // ----------------------------------------------------------
  // RENT
  // ----------------------------------------------------------

  if (
    type === "rent_business"
  ) {
    rentBusiness(
      room,
      player,
      msg.businessId
    );

    return;
  }

  // ----------------------------------------------------------
  // FURNITURE
  // ----------------------------------------------------------

  if (
    type === "buy_furniture"
  ) {
    buyFurniture(
      player,
      msg.furnitureId
    );

    return;
  }

  // ----------------------------------------------------------
  // CHAT
  // ----------------------------------------------------------

  if (type === "chat") {
    handleChat(
      room,
      player,
      msg.text
    );

    return;
  }

  // ----------------------------------------------------------
  // HIRE
  // ----------------------------------------------------------

  if (
    type === "hire_employee"
  ) {
    hireEmployee(
      room,
      player,
      msg.role
    );

    return;
  }

  // ----------------------------------------------------------
  // WITHDRAW
  // ----------------------------------------------------------

  if (
    type ===
    "withdraw_business"
  ) {
    withdrawBusiness(
      room,
      player
    );

    return;
  }

  // ----------------------------------------------------------
  // UPGRADE
  // ----------------------------------------------------------

  if (
    type ===
    "upgrade_business"
  ) {
    upgradeBusiness(
      room,
      player
    );

    return;
  }

  // ----------------------------------------------------------
  // PRICE
  // ----------------------------------------------------------

  if (
    type ===
    "business_price"
  ) {
    changeBusinessPrice(
      room,
      player,
      msg.multiplier
    );

    return;
  }

  // ----------------------------------------------------------
  // INTERACT
  // ----------------------------------------------------------

  if (
    type === "interact"
  ) {
    interact(
      room,
      player,
      msg.targetId
    );

    return;
  }

  // ----------------------------------------------------------
  // HOTEL
  // ----------------------------------------------------------

  if (
    type ===
    "hotel_checkin"
  ) {
    hotelCheckIn(
      room,
      player,
      msg.hotelId
    );

    return;
  }

  // ----------------------------------------------------------
  // RESTAURANT
  // ----------------------------------------------------------

  if (
    type ===
    "restaurant_order"
  ) {
    restaurantOrder(
      room,
      player,
      msg.restaurantId,
      msg.item
    );

    return;
  }

  // ----------------------------------------------------------
  // RIDE
  // ----------------------------------------------------------

  if (
    type === "request_ride"
  ) {
    requestRide(
      room,
      player
    );

    return;
  }

  // ----------------------------------------------------------
  // PING
  // ----------------------------------------------------------

  if (
    type === "ping"
  ) {
    send(
      player.ws,
      {
        type: "pong",
        time: Date.now()
      }
    );

    return;
  }
}

// ============================================================
// HTTP SERVER
// ============================================================

const server =
  http.createServer(
    (req, res) => {
      let urlPath;

      try {
        urlPath =
          decodeURIComponent(
            (req.url || "/")
              .split("?")[0]
          );
      } catch {
        res.writeHead(
          400,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Bad request"
        );

        return;
      }

      if (
        urlPath === "/"
      ) {
        urlPath =
          "/index.html";
      }

      const publicDir =
        path.join(
          __dirname,
          "public"
        );

      const filePath =
        path.normalize(
          path.join(
            publicDir,
            urlPath.replace(
              /^\/+/,
              ""
            )
          )
        );

      // chống truy cập ra ngoài public
      if (
        filePath !==
          publicDir &&
        !filePath.startsWith(
          publicDir +
            path.sep
        )
      ) {
        res.writeHead(
          403,
          {
            "Content-Type":
              "text/plain; charset=utf-8"
          }
        );

        res.end(
          "Forbidden"
        );

        return;
      }

      fs.readFile(
        filePath,
        (err, data) => {
          if (err) {
            res.writeHead(
              404,
              {
                "Content-Type":
                  "text/plain; charset=utf-8"
              }
            );

            res.end(
              "404 - Không tìm thấy file"
            );

            return;
          }

          let contentType =
            "text/plain; charset=utf-8";

          if (
            filePath.endsWith(
              ".html"
            )
          ) {
            contentType =
              "text/html; charset=utf-8";
          }

          else if (
            filePath.endsWith(
              ".js"
            )
          ) {
            contentType =
              "application/javascript; charset=utf-8";
          }

          else if (
            filePath.endsWith(
              ".css"
            )
          ) {
            contentType =
              "text/css; charset=utf-8";
          }

          else if (
            filePath.endsWith(
              ".json"
            )
          ) {
            contentType =
              "application/json; charset=utf-8";
          }

          res.writeHead(
            200,
            {
              "Content-Type":
                contentType
            }
          );

          res.end(data);
        }
      );
    }
  );

// ============================================================
// WEBSOCKET SERVER
// ============================================================

const wss =
  new WebSocket.Server({
    server
  });

// ============================================================
// CONNECTION
// ============================================================

wss.on(
  "connection",
  ws => {
    let player = null;
    let room = null;

    ws.on(
      "message",
      raw => {
        let msg;

        try {
          msg =
            JSON.parse(
              raw.toString()
            );
        } catch {
          return;
        }

        // ----------------------------------------------------
        // JOIN
        // ----------------------------------------------------

        if (
          !player &&
          msg.type === "join"
        ) {
          room =
            getAvailableRoom();

          player =
            createPlayer(
              ws,
              msg.name,
              msg.gender
            );

          room.players.set(
            player.id,
            player
          );

          send(
            ws,
            {
              type: "welcome",

              id:
                player.id,

              player:
                serializePlayer(
                  player
                )
            }
          );

          notify(
            player,
            "Đã vào thành phố!",
            "success"
          );

          send(
            ws,
            buildState(room)
          );

          broadcast(
            room,
            {
              type: "notice",
              text:
                `${player.name} đã tham gia thành phố.`
            }
          );

          return;
        }

        if (
          !player ||
          !room
        ) {
          return;
        }

        handleMessage(
          room,
          player,
          msg
        );
      }
    );

    // --------------------------------------------------------
    // DISCONNECT
    // --------------------------------------------------------

    ws.on(
      "close",
      () => {
        if (
          !player ||
          !room
        ) {
          return;
        }

        room.players.delete(
          player.id
        );

        broadcast(
          room,
          {
            type: "notice",
            text:
              `${player.name} đã rời thành phố.`
          }
        );

        player = null;
      }
    );

    ws.on(
      "error",
      () => {}
    );
  }
);

// ============================================================
// GAME LOOP
// ============================================================

let lastTick =
  Date.now();

let lastState =
  Date.now();

let lastMarket =
  Date.now();

setInterval(
  () => {
    const now =
      Date.now();

    let dt =
      (now - lastTick) /
      1000;

    // chống lag spike
    dt =
      clamp(
        dt,
        0,
        0.1
      );

    lastTick =
      now;

    // --------------------------------------------------------
    // UPDATE WORLD
    // --------------------------------------------------------

    for (
      const room
      of rooms.values()
    ) {
      // người chơi
      for (
        const player
        of room.players.values()
      ) {
        updatePlayerMovement(
          player,
          dt
        );
      }

      // NPC
      for (
        const npc
        of room.npcs.values()
      ) {
        updateNPC(
          room,
          npc,
          dt,
          now
        );
      }

      // xe
      updateVehicles(
        room,
        dt
      );

      // kinh doanh
      updateBusinessIncome(
        room,
        dt
      );

      // ngày / đêm / thời tiết
      updateWorld(
        room,
        dt
      );
    }

    // --------------------------------------------------------
    // MARKET
    // --------------------------------------------------------

    if (
      now - lastMarket >=
      60000
    ) {
      for (
        const room
        of rooms.values()
      ) {
        updateMarket(
          room
        );
      }

      lastMarket =
        now;
    }

    // --------------------------------------------------------
    // STATE
    // --------------------------------------------------------

    if (
      now - lastState >=
      1000 /
        STATE_RATE
    ) {
      for (
        const room
        of rooms.values()
      ) {
        broadcast(
          room,
          buildState(room)
        );
      }

      lastState =
        now;
    }
  },
  1000 /
    TICK_RATE
);

// ============================================================
// START SERVER
// ============================================================

server.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      "======================================"
    );

    console.log(
      " BUÔNG GÌ BÁN SERVER"
    );

    console.log(
      "======================================"
    );

    console.log(
      `Game size: ${WORLD.width}x${WORLD.depth}`
    );

    console.log(
      `Web: http://localhost:${PORT}`
    );

    console.log(
      `WebSocket: ws://localhost:${PORT}`
    );

    console.log(
      "Server đang chạy..."
    );
  }
);

// ============================================================
// ERROR HANDLING
// ============================================================

process.on(
  "uncaughtException",
  error => {
    console.error(
      "SERVER ERROR:",
      error
    );
  }
);

process.on(
  "unhandledRejection",
  error => {
    console.error(
      "PROMISE ERROR:",
      error
    );
  }
);