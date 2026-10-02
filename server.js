const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const HOST = "0.0.0.0";

const server = http.createServer((req, res) => {
  // Cho phép index.html gọi server
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Kiểm tra server
  if (req.url === "/api/status") {
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8"
    });

    return res.end(JSON.stringify({
      online: true,
      game: "BUÔN GÌ BÁN"
    }));
  }

  // Mở game
  let file = req.url === "/" ? "index.html" : req.url.slice(1);

  file = decodeURIComponent(file.split("?")[0]);

  // Không cho truy cập lung tung ngoài thư mục game
  const filePath = path.join(__dirname, file);

  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      return res.end("404 - Không tìm thấy file");
    }

    const ext = path.extname(filePath).toLowerCase();

    const mime = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".svg": "image/svg+xml"
    };

    res.writeHead(200, {
      "Content-Type": mime[ext] || "application/octet-stream"
    });

    res.end(data);
  });
});

server.listen(PORT, HOST, () => {
  console.log("================================");
  console.log("       BUÔN GÌ BÁN");
  console.log("================================");
  console.log("SERVER ĐANG CHẠY");
  console.log("http://localhost:" + PORT);
  console.log("================================");
});