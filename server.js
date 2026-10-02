'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const SAVE_DIR = path.join(ROOT, 'data');
const SAVE_FILE = path.join(SAVE_DIR, 'savegame.json');
const MAX_BODY = 5 * 1024 * 1024;

function send(res, status, data, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store'
  });

  res.end(
    type.startsWith('application/json')
      ? JSON.stringify(data)
      : data
  );
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;

    req.on('data', chunk => {
      size += chunk.length;

      if (size > MAX_BODY) {
        reject(new Error('BODY_TOO_LARGE'));
        req.destroy();
        return;
      }

      body += chunk.toString('utf8');
    });

    req.on('end', () => {
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });

    req.on('error', reject);
  });
}

function saveData(data) {
  fs.mkdirSync(SAVE_DIR, { recursive: true });

  const tempFile = SAVE_FILE + '.tmp';

  fs.writeFileSync(
    tempFile,
    JSON.stringify(data, null, 2),
    'utf8'
  );

  fs.renameSync(tempFile, SAVE_FILE);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return send(res, 200, {
      ok: true,
      game: 'BUÔN GÌ BÁN'
    });
  }

  if (req.method === 'GET' && url.pathname === '/api/load') {
    if (!fs.existsSync(SAVE_FILE)) {
      return send(res, 404, { error: 'NO_SAVE' });
    }

    try {
      const data = JSON.parse(
        fs.readFileSync(SAVE_FILE, 'utf8')
      );

      return send(res, 200, data);
    } catch {
      return send(res, 500, {
        error: 'SAVE_READ_FAILED'
      });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/save') {
    try {
      const data = await readBody(req);

      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return send(res, 400, { error: 'INVALID_SAVE' });
      }

      saveData(data);

      return send(res, 200, {
        ok: true,
        saved: true
      });
    } catch (error) {
      const tooLarge = error.message === 'BODY_TOO_LARGE';

      return send(res, tooLarge ? 413 : 400, {
        error: tooLarge ? 'BODY_TOO_LARGE' : 'INVALID_JSON'
      });
    }
  }

  if (req.method === 'POST' && url.pathname === '/api/delete') {
    try {
      if (fs.existsSync(SAVE_FILE)) {
        fs.unlinkSync(SAVE_FILE);
      }

      return send(res, 200, {
        ok: true,
        deleted: true
      });
    } catch {
      return send(res, 500, {
        error: 'DELETE_FAILED'
      });
    }
  }

  if (
    req.method === 'GET' &&
    (url.pathname === '/' || url.pathname === '/index.html')
  ) {
    const indexFile = path.join(ROOT, 'index.html');

    if (!fs.existsSync(indexFile)) {
      return send(
        res,
        404,
        'Không tìm thấy index.html. Hãy đặt index.html và server.js cùng thư mục.',
        'text/plain; charset=utf-8'
      );
    }

    res.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store'
    });

    return fs.createReadStream(indexFile).pipe(res);
  }

  return send(res, 404, { error: 'NOT_FOUND' });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(
    `BUÔN GÌ BÁN đang chạy tại http://localhost:${PORT}`
  );
});