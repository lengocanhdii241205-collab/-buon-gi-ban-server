const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const players = {};

const items = {
    rice: { name: "Gạo", price: 20 },
    fish: { name: "Cá", price: 35 },
    vegetable: { name: "Rau", price: 15 },
    phone: { name: "Điện thoại", price: 500 }
};

const jobs = [
    "Tự do",
    "Nông dân",
    "Tài xế",
    "Ngư dân",
    "Nhân viên cửa hàng",
    "Thợ sửa xe"
];

function id() {
    return Math.random().toString(36).slice(2, 10);
}

function send(ws, data) {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(data));
    }
}

function broadcast(data) {
    wss.clients.forEach(ws => {
        send(ws, data);
    });
}

function gameState() {
    return {
        players,
        world: {
            day: 1,
            time: 8,
            weather: "sunny"
        },
        market: items
    };
}

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/public/index.html");
});

wss.on("connection", ws => {

    let playerId = null;

    send(ws, {
        type: "SYSTEM",
        text: "Đã kết nối server."
    });

    ws.on("message", message => {

        let data;

        try {
            data = JSON.parse(message.toString());
        } catch {
            return;
        }

        // =========================
        // JOIN
        // =========================

        if (data.type === "JOIN") {

            playerId = id();

            players[playerId] = {
                id: playerId,
                name: String(data.name || "Player").slice(0, 20),
                gender: data.gender || "male",

                x: 0,
                y: 0.5,
                z: 0,
                rot: 0,

                money: 1000,
                energy: 100,
                hunger: 100,

                job: "Tự do",
                onBike: false,

                inventory: {
                    rice: 3,
                    fish: 1,
                    vegetable: 2
                }
            };

            send(ws, {
                type: "INIT",
                id: playerId,
                state: gameState()
            });

            broadcast({
                type: "SYSTEM",
                text: players[playerId].name + " đã vào thành phố."
            });

            return;
        }

        if (!playerId || !players[playerId]) {
            return;
        }

        const player = players[playerId];

        // =========================
        // DI CHUYỂN
        // =========================

        if (data.type === "UPDATE_MOVE") {

            player.x = Number(data.x) || 0;
            player.y = Number(data.y) || 0.5;
            player.z = Number(data.z) || 0;
            player.rot = Number(data.rot) || 0;

            player.x = Math.max(-120, Math.min(120, player.x));
            player.z = Math.max(-120, Math.min(120, player.z));

            return;
        }

        // =========================
        // CHAT
        // =========================

        if (data.type === "CHAT") {

            const text =
                String(data.text || "")
                    .trim()
                    .slice(0, 300);

            if (!text) return;

            broadcast({
                type: "CHAT_MSG",
                sender: player.name,
                text
            });

            return;
        }

        // =========================
        // ACTION
        // =========================

        if (data.type === "ACTION") {

            const action = data.action;

            // Xe máy
            if (action === "TOGGLE_BIKE") {

                player.onBike = !player.onBike;

                send(ws, {
                    type: "NOTIF",
                    text: player.onBike
                        ? "🛵 Đã lên xe máy."
                        : "🚶 Đã xuống xe máy."
                });

                return;
            }

            // Đổi nghề
            if (action === "CHANGE_JOB") {

                const job = String(data.job || "");

                if (!jobs.includes(job)) {
                    return;
                }

                player.job = job;

                send(ws, {
                    type: "NOTIF",
                    text: "💼 Nghề mới: " + job
                });

                return;
            }

            // Mua hàng
            if (action === "BUY_ITEM") {

                const item = items[data.item];

                if (!item) return;

                if (player.money < item.price) {

                    send(ws, {
                        type: "NOTIF",
                        success: false,
                        text: "Không đủ tiền."
                    });

                    return;
                }

                player.money -= item.price;

                player.inventory[data.item] =
                    (player.inventory[data.item] || 0) + 1;

                send(ws, {
                    type: "NOTIF",
                    text:
                        "🛒 Đã mua " +
                        item.name +
                        " -$" +
                        item.price
                });

                return;
            }

            // Bán hàng
            if (action === "SELL_ITEM") {

                const item = items[data.item];

                if (!item) return;

                const amount =
                    player.inventory[data.item] || 0;

                if (amount <= 0) {

                    send(ws, {
                        type: "NOTIF",
                        success: false,
                        text: "Bạn không có món này."
                    });

                    return;
                }

                player.inventory[data.item]--;

                player.money += item.price;

                send(ws, {
                    type: "NOTIF",
                    text:
                        "💰 Đã bán " +
                        item.name +
                        " +$" +
                        item.price
                });

                return;
            }

            // Ăn
            if (action === "EAT") {

                player.hunger =
                    Math.min(100, player.hunger + 25);

                send(ws, {
                    type: "NOTIF",
                    text: "🍜 Đã ăn. No hơn rồi!"
                });

                return;
            }

            // Uống
            if (action === "DRINK") {

                player.energy =
                    Math.min(100, player.energy + 20);

                send(ws, {
                    type: "NOTIF",
                    text: "🥤 Đã uống nước."
                });

                return;
            }

            // Tương tác
            if (action === "INTERACT") {

                send(ws, {
                    type: "NOTIF",
                    text: "💬 Bạn đang tương tác với khu vực gần đây."
                });

                return;
            }

            // Taxi
            if (action === "CALL_TAXI") {

                player.money -= 50;

                if (player.money < 0) {
                    player.money = 0;
                }

                player.x = 5;
                player.z = 5;

                send(ws, {
                    type: "NOTIF",
                    text: "🚕 Taxi đã đưa bạn đến khu trung tâm."
                });

                return;
            }

            // Khách sạn
            if (action === "HOTEL_CHECKIN") {

                if (player.money < 100) {

                    send(ws, {
                        type: "NOTIF",
                        success: false,
                        text: "Cần $100 để nhận phòng."
                    });

                    return;
                }

                player.money -= 100;
                player.energy = 100;
                player.hunger = 100;

                send(ws, {
                    type: "NOTIF",
                    text: "🏨 Đã nhận phòng. Năng lượng và thức ăn đầy."
                });

                return;
            }

            return;
        }
    });

    ws.on("close", () => {

        if (!playerId) return;

        const name =
            players[playerId]
                ? players[playerId].name
                : "Player";

        delete players[playerId];

        broadcast({
            type: "SYSTEM",
            text: name + " đã rời thành phố."
        });
    });

    ws.on("error", () => {});
});

// =========================
// GAME LOOP
// =========================

setInterval(() => {

    Object.values(players).forEach(player => {

        player.energy =
            Math.max(0, player.energy - 0.02);

        player.hunger =
            Math.max(0, player.hunger - 0.015);

    });

}, 1000);

// =========================
// GỬI STATE
// =========================

setInterval(() => {

    broadcast({
        type: "TICK",
        state: gameState()
    });

}, 200);

// =========================
// SERVER
// =========================

server.listen(PORT, "0.0.0.0", () => {

    console.log("");
    console.log("==============================");
    console.log("   BUÔN GÌ BÁN NẤY 3D");
    console.log("==============================");
    console.log("SERVER ĐANG CHẠY");
    console.log("PORT:", PORT);
    console.log("URL: http://localhost:" + PORT);
    console.log("==============================");
    console.log("");

});