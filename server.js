const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

const server = http.createServer((req, res) => {
    let file = req.url === "/" ? "index.html" : req.url.slice(1);

    file = path.join(__dirname, file);

    fs.readFile(file, (err, data) => {
        if (err) {
            res.writeHead(404, {
                "Content-Type": "text/plain; charset=utf-8"
            });

            res.end("Không tìm thấy file!");
            return;
        }

        let type = "text/plain";

        if (file.endsWith(".html")) {
            type = "text/html; charset=utf-8";
        }

        if (file.endsWith(".js")) {
            type = "text/javascript; charset=utf-8";
        }

        if (file.endsWith(".css")) {
            type = "text/css; charset=utf-8";
        }

        res.writeHead(200, {
            "Content-Type": type
        });

        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log("");
    console.log("================================");
    console.log("       BUÔN GÌ BÁN");
    console.log("================================");
    console.log("Game đang chạy tại:");
    console.log("http://localhost:" + PORT);
    console.log("================================");
});