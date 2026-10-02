const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;

const server = http.createServer((req, res) => {

  let file = req.url === "/"
    ? "index.html"
    : decodeURIComponent(req.url.slice(1));

  const filePath = path.join(__dirname, file);

  fs.readFile(filePath, (err, data) => {

    if (err) {
      res.writeHead(404, {
        "Content-Type": "text/plain; charset=utf-8"
      });

      res.end("404 - Không tìm thấy file");
      return;
    }

    let type = "text/html; charset=utf-8";

    if (file.endsWith(".js")) {
      type = "application/javascript; charset=utf-8";
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
  console.log(
    "Mở trình duyệt: http://localhost:" + PORT
  );
  console.log("================================");

});