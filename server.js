'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const HOST = '0.0.0.0';
const PORT = Number(process.env.PORT) || 3000;

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, 'data');
const SAVE_FILE = path.join(DATA_DIR, 'save.json');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav'
};

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

function readBody(req, maxBytes = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.setEncoding('utf8');

    req.on('data', chunk => {
      size += Buffer.byteLength(chunk, 'utf8');

      if (size > maxBytes) {
        reject(new Error('Dữ liệu quá lớn.'));
        req.destroy();
        return;
      }

      body += chunk;
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function handleAPI(req, res, pathname) {
  if (pathname === '/api/save' && req.method === 'POST') {
    try {
      const body = await readBody(req);
      const data = JSON.parse(body);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return send(res, 400, {
          success: false,
          message: 'Dữ liệu lưu không hợp lệ.'
        });
      }

      await ensureDataDir();

      const tempFile = SAVE_FILE + '.tmp';
      await fs.writeFile(
        tempFile,
        JSON.stringify(data),
        'utf8'
      );
      await fs.rename(tempFile, SAVE_FILE);

      return send(res, 200, {
        success: true,
        message: 'Đã lưu game.'
      });
    } catch (err) {
      console.error('Lỗi lưu game:', err.message);

      if (!res.headersSent) {
        return send(res, 400, {
          success: false,
          message: 'Không thể lưu dữ liệu game.'
        });
      }
    }
    return;
  }

  if (pathname === '/api/load' && req.method === 'GET') {
    try {
      const raw = await fs.readFile(SAVE_FILE, 'utf8');
      const data = JSON.parse(raw);
      return send(res, 200, data);
    } catch (err) {
      if (err.code === 'ENOENT') {
        return send(res, 404, {
          success: false,
          message: 'Chưa có bản lưu.'
        });
      }

      console.error('Lỗi tải game:', err.message);
      return send(res, 500, {
        success: false,
        message: 'Không thể đọc bản lưu.'
      });
    }
  }

  if (pathname === '/api/delete' && req.method === 'POST') {
    try {
      await fs.rm(SAVE_FILE, { force: true });
      return send(res, 200, {
        success: true,
        message: 'Đã xóa bản lưu.'
      });
    } catch (err) {
      console.error('Lỗi xóa bản lưu:', err.message);
      return send(res, 500, {
        success: false,
        message: 'Không thể xóa bản lưu.'
      });
    }
  }

  if (pathname.startsWith('/api/')) {
    return send(res, 404, {
      success: false,
      message: 'API không tồn tại.'
    });
  }

  return false;
}

async function serveStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return send(res, 405, {
      success: false,
      message: 'Phương thức không được hỗ trợ.'
    });
  }

  let decoded;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return send(res, 400, 'Đường dẫn không hợp lệ.');
  }

  if (decoded.includes('\0') || decoded.includes('\\')) {
    return send(res, 400, 'Đường dẫn không hợp lệ.');
  }

  if (decoded === '/') decoded = '/index.html';

  const filePath = path.resolve(ROOT, '.' + decoded);
  const relative = path.relative(ROOT, filePath);

  if (
    relative.startsWith('..') ||
    path.isAbsolute(relative) ||
    relative === 'server.js' ||
    relative.startsWith('data' + path.sep) ||
    relative === 'data'
  ) {
    return send(res, 403, 'Không được phép truy cập.');
  }

  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      return send(res, 404, 'Không tìm thấy trang.');
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'X-Content-Type-Options': 'nosniff'
    });

    if (req.method === 'HEAD') return res.end();

    const stream = fs.createReadStream(filePath);
    stream.on('error', err => {
      console.error('Lỗi đọc file:', err.message);
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
    stream.pipe(res);
  } catch (err) {
    if (err.code === 'ENOENT' || err.code === 'ENOTDIR') {
      return send(res, 404, 'Không tìm thấy trang.');
    }

    console.error('Lỗi máy chủ:', err.message);
    return send(res, 500, 'Lỗi máy chủ.');
  }
}

const server = http.createServer(async (req, res) => {
  let pathname;

  try {
    pathname = new URL(req.url, 'http://localhost').pathname;
  } catch {
    return send(res, 400, 'Yêu cầu không hợp lệ.');
  }

  try {
    const handled = await handleAPI(req, res, pathname);
    if (handled !== false) return;

    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('Lỗi:', err.message);

    if (!res.headersSent) {
      send(res, 500, {
        success: false,
        message: 'Đã xảy ra lỗi máy chủ.'
      });
    } else {
      res.end();
    }
  }
});

server.listen(PORT, HOST, () => {
  console.log('====================================');
  console.log('  BUÔN GÌ BÁN - SERVER ĐÃ CHẠY');
  console.log('====================================');
  console.log(`Mở game: http://localhost:${PORT}`);
  console.log('Lưu game: /api/save');
  console.log('Tải game: /api/load');
  console.log('Xóa lưu: /api/delete');
  console.log('Nhấn Ctrl + C để tắt server.');
});
