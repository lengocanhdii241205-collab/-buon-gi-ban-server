const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const DATA = path.join(ROOT, "data");
const SAVE_FILE = path.join(DATA, "saves.json");

if (!fs.existsSync(DATA)) {
    fs.mkdirSync(DATA, { recursive: true });
}

if (!fs.existsSync(SAVE_FILE)) {
    fs.writeFileSync(SAVE_FILE, "{}", "utf8");
}

function readDB() {
    try {
        return JSON.parse(
            fs.readFileSync(SAVE_FILE, "utf8")
        );
    } catch {
        return {};
    }
}

function writeDB(db) {
    fs.writeFileSync(
        SAVE_FILE,
        JSON.stringify(db, null, 2),
        "utf8"
    );
}

function sendJSON(res, status, data) {
    res.writeHead(status, {
        "Content-Type":
            "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods":
            "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":
            "Content-Type"
    });

    res.end(JSON.stringify(data));
}

function readBody(req) {
    return new Promise((resolve, reject) => {

        let body = "";

        req.on("data", chunk => {

            body += chunk;

            if (body.length > 10 * 1024 * 1024) {
                reject(
                    new Error("Dữ liệu quá lớn")
                );

                req.destroy();
            }
        });

        req.on("end", () => {

            if (!body) {
                resolve({});
                return;
            }

            try {
                resolve(JSON.parse(body));
            } catch {
                reject(
                    new Error("JSON không hợp lệ")
                );
            }
        });

        req.on("error", reject);
    });
}

const server = http.createServer(
    async (req, res) => {

        res.setHeader(
            "Access-Control-Allow-Origin",
            "*"
        );

        if (req.method === "OPTIONS") {
            res.writeHead(204);
            res.end();
            return;
        }

        /* STATUS */

        if (
            req.method === "GET" &&
            req.url === "/api/status"
        ) {
            sendJSON(res, 200, {
                ok: true,
                game: "BUÔN GÌ BÁN",
                online: true,
                saveSystem: true,
                npcSystem: true,
                version: "3.0"
            });

            return;
        }

        /* LOAD */

        if (
            req.method === "GET" &&
            req.url.startsWith("/api/load")
        ) {

            const url = new URL(
                req.url,
                "http://localhost"
            );

            const id =
                url.searchParams.get("id");

            if (!id) {
                sendJSON(res, 400, {
                    ok: false,
                    error: "Thiếu ID"
                });

                return;
            }

            const db = readDB();

            sendJSON(res, 200, {
                ok: true,
                save: db[id] || null
            });

            return;
        }

        /* SAVE */

        if (
            req.method === "POST" &&
            req.url === "/api/save"
        ) {

            try {

                const data =
                    await readBody(req);

                if (
                    typeof data.id !== "string" ||
                    !data.id
                ) {
                    sendJSON(res, 400, {
                        ok: false,
                        error: "ID không hợp lệ"
                    });

                    return;
                }

                if (!data.game) {
                    sendJSON(res, 400, {
                        ok: false,
                        error: "Thiếu game data"
                    });

                    return;
                }

                const db = readDB();

                db[data.id] = {
                    game: data.game,
                    updatedAt: Date.now()
                };

                writeDB(db);

                sendJSON(res, 200, {
                    ok: true,
                    message: "Đã lưu"
                });

            } catch (err) {

                sendJSON(res, 400, {
                    ok: false,
                    error: err.message
                });
            }

            return;
        }

        /* DELETE */

        if (
            req.method === "POST" &&
            req.url === "/api/delete"
        ) {

            try {

                const data =
                    await readBody(req);

                const db = readDB();

                delete db[data.id];

                writeDB(db);

                sendJSON(res, 200, {
                    ok: true
                });

            } catch (err) {

                sendJSON(res, 400, {
                    ok: false,
                    error: err.message
                });
            }

            return;
        }

        /* STATIC */

        let requestPath =
            req.url.split("?")[0];

        if (
            requestPath === "/" ||
            requestPath === ""
        ) {
            requestPath = "/index.html";
        }

        const filePath = path.resolve(
            ROOT,
            "." + decodeURIComponent(requestPath)
        );

        if (
            !filePath.startsWith(
                path.resolve(ROOT)
            )
        ) {
            res.writeHead(403);
            res.end("Forbidden");
            return;
        }

        fs.readFile(filePath, (err, data) => {

            if (err) {
                res.writeHead(404);
                res.end("404");
                return;
            }

            const ext =
                path.extname(filePath)
                    .toLowerCase();

            const types = {
                ".html":
                    "text/html; charset=utf-8",
                ".js":
                    "application/javascript; charset=utf-8",
                ".json":
                    "application/json; charset=utf-8",
                ".css":
                    "text/css; charset=utf-8",
                ".png":
                    "image/png",
                ".jpg":
                    "image/jpeg",
                ".jpeg":
                    "image/jpeg",
                ".webp":
                    "image/webp",
                ".svg":
                    "image/svg+xml"
            };

            res.writeHead(200, {
                "Content-Type":
                    types[ext] ||
                    "application/octet-stream"
            });

            res.end(data);
        });
    }
);

server.listen(
    PORT,
    HOST,
    () => {

        console.log("");
        console.log(
            "================================"
        );
        console.log(
            "       BUÔN GÌ BÁN"
        );
        console.log(
            "================================"
        );
        console.log(
            "SERVER: http://localhost:" + PORT
        );
        console.log(
            "API:    http://localhost:" +
            PORT +
            "/api/status"
        );
        console.log(
            "================================"
        );
        console.log("");
    }
);