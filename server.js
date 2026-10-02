const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const DATA_DIR = path.join(__dirname, "data");
const SAVE_FILE = path.join(DATA_DIR, "saves.json");

// Tạo thư mục lưu game
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Tạo file save nếu chưa có
if (!fs.existsSync(SAVE_FILE)) {
    fs.writeFileSync(SAVE_FILE, "{}", "utf8");
}

// Đọc dữ liệu save
function readSaves() {
    try {
        return JSON.parse(
            fs.readFileSync(SAVE_FILE, "utf8")
        );
    } catch {
        return {};
    }
}

// Ghi dữ liệu save
function writeSaves(data) {
    fs.writeFileSync(
        SAVE_FILE,
        JSON.stringify(data, null, 2),
        "utf8"
    );
}

// Gửi JSON
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

// Gửi text
function sendText(res, status, text) {
    res.writeHead(status, {
        "Content-Type":
            "text/plain; charset=utf-8",

        "Access-Control-Allow-Origin": "*"
    });

    res.end(text);
}

// Đọc body POST
function readBody(req) {

    return new Promise((resolve, reject) => {

        let body = "";

        req.on("data", chunk => {

            body += chunk;

            // Không cho request quá lớn
            if (body.length > 10 * 1024 * 1024) {

                req.destroy();

                reject(
                    new Error("Dữ liệu quá lớn")
                );
            }
        });

        req.on("end", () => {

            if (!body) {
                resolve({});
                return;
            }

            try {

                resolve(
                    JSON.parse(body)
                );

            } catch {

                reject(
                    new Error("JSON không hợp lệ")
                );
            }
        });

        req.on("error", reject);
    });
}


// ======================================================
// SERVER
// ======================================================

const server = http.createServer(
    async (req, res) => {

        // CORS
        res.setHeader(
            "Access-Control-Allow-Origin",
            "*"
        );

        res.setHeader(
            "Access-Control-Allow-Methods",
            "GET,POST,OPTIONS"
        );

        res.setHeader(
            "Access-Control-Allow-Headers",
            "Content-Type"
        );


        // OPTIONS
        if (req.method === "OPTIONS") {

            res.writeHead(204);

            return res.end();
        }


        // ==================================================
        // SERVER STATUS
        // ==================================================

        if (
            req.method === "GET" &&
            req.url === "/api/status"
        ) {

            return sendJSON(res, 200, {

                ok: true,

                game: "BUÔN GÌ BÁN",

                server: "online",

                npcSystem: true,

                city: true,

                vehicles: true,

                weather: true,

                restaurant: true,

                time: Date.now()

            });
        }


        // ==================================================
        // LOAD GAME
        // ==================================================

        if (
            req.method === "GET" &&
            req.url.startsWith("/api/load")
        ) {

            const url = new URL(
                req.url,
                `http://${req.headers.host}`
            );

            const id =
                url.searchParams.get("id");


            if (!id) {

                return sendJSON(
                    res,
                    400,
                    {
                        ok: false,
                        error:
                            "Thiếu ID người chơi"
                    }
                );
            }


            const saves = readSaves();


            return sendJSON(
                res,
                200,
                {
                    ok: true,

                    save:
                        saves[id] || null
                }
            );
        }


        // ==================================================
        // SAVE GAME
        // ==================================================

        if (
            req.method === "POST" &&
            req.url === "/api/save"
        ) {

            try {

                const body =
                    await readBody(req);


                if (!body.id) {

                    return sendJSON(
                        res,
                        400,
                        {
                            ok: false,
                            error:
                                "Thiếu ID người chơi"
                        }
                    );
                }


                if (!body.game) {

                    return sendJSON(
                        res,
                        400,
                        {
                            ok: false,
                            error:
                                "Thiếu dữ liệu game"
                        }
                    );
                }


                const saves =
                    readSaves();


                saves[body.id] = {

                    game: body.game,

                    updatedAt:
                        Date.now()
                };


                writeSaves(saves);


                return sendJSON(
                    res,
                    200,
                    {
                        ok: true,

                        message:
                            "Đã lưu game lên server"
                    }
                );

            } catch (error) {

                return sendJSON(
                    res,
                    400,
                    {
                        ok: false,

                        error:
                            error.message
                    }
                );
            }
        }


        // ==================================================
        // DELETE SAVE
        // ==================================================

        if (
            req.method === "POST" &&
            req.url === "/api/delete"
        ) {

            try {

                const body =
                    await readBody(req);


                if (!body.id) {

                    return sendJSON(
                        res,
                        400,
                        {
                            ok: false,
                            error:
                                "Thiếu ID"
                        }
                    );
                }


                const saves =
                    readSaves();


                delete saves[body.id];


                writeSaves(saves);


                return sendJSON(
                    res,
                    200,
                    {
                        ok: true,

                        message:
                            "Đã xóa dữ liệu"
                    }
                );

            } catch (error) {

                return sendJSON(
                    res,
                    400,
                    {
                        ok: false,

                        error:
                            error.message
                    }
                );
            }
        }


        // ==================================================
        // STATIC FILE
        // ==================================================

        let file;

        if (
            req.url === "/" ||
            req.url === ""
        ) {

            file = "index.html";

        } else {

            file =
                decodeURIComponent(
                    req.url
                        .split("?")[0]
                        .replace(/^\/+/, "")
                );
        }


        // Chặn truy cập ngoài thư mục game
        const root =
            path.resolve(__dirname);

        const filePath =
            path.resolve(
                root,
                file
            );


        if (
            !filePath.startsWith(root)
        ) {

            return sendText(
                res,
                403,
                "Forbidden"
            );
        }


        fs.readFile(
            filePath,
            (error, data) => {

                if (error) {

                    return sendText(
                        res,
                        404,
                        "404 - Không tìm thấy file"
                    );
                }


                const ext =
                    path.extname(
                        filePath
                    ).toLowerCase();


                const mime = {

                    ".html":
                        "text/html; charset=utf-8",

                    ".js":
                        "application/javascript; charset=utf-8",

                    ".css":
                        "text/css; charset=utf-8",

                    ".json":
                        "application/json; charset=utf-8",

                    ".png":
                        "image/png",

                    ".jpg":
                        "image/jpeg",

                    ".jpeg":
                        "image/jpeg",

                    ".webp":
                        "image/webp",

                    ".svg":
                        "image/svg+xml",

                    ".ico":
                        "image/x-icon"
                };


                res.writeHead(
                    200,
                    {
                        "Content-Type":
                            mime[ext] ||
                            "application/octet-stream"
                    }
                );


                res.end(data);
            }
        );
    }
);


// ======================================================
// START
// ======================================================

server.listen(
    PORT,
    HOST,
    () => {

        console.log("");
        console.log(
            "======================================"
        );

        console.log(
            "          BUÔN GÌ BÁN SERVER"
        );

        console.log(
            "======================================"
        );

        console.log(
            "Server: ONLINE"
        );

        console.log(
            "Port:",
            PORT
        );

        console.log(
            "Game:",
            `http://localhost:${PORT}`
        );

        console.log(
            "API:",
            `http://localhost:${PORT}/api/status`
        );

        console.log(
            "======================================"
        );
        console.log("");
    }
);