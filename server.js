// =========================================================================
// 🚀 FILE CHUNG: SERVER NODE.JS + GIAO DIỆN & LOGIC GAME 10 PHẦN (HTML/JS)
// =========================================================================

const express = require('express');
const http = require('http');
const path = require('path');

const app = express();
const server = http.createServer(app);
const PORT = 3000;

// Bộ nhớ lưu trữ dữ liệu game trên server (Database RAM)
let serverGameState = {
  money: 15000000,
  stock: { SHELF_BOX: 5, FRIDGE_BOX: 3 },
  staff: { cashierCount: 0, restockerCount: 0 }
};

// API lấy dữ liệu game
app.get('/api/load', (req, res) => {
  res.json(serverGameState);
});

// API lưu dữ liệu game từ client gửi lên
app.use(express.json());
app.post('/api/save', (req, res) => {
  serverGameState = req.body;
  res.json({ success: true, message: "Đã lưu game lên server thành công!" });
});

// Phục vụ giao diện game trực tiếp từ server khi truy cập http://localhost:3000
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BUÔN GÌ BÁN - Game Quản Lý Siêu Thị Chibi</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background: #111;
      overflow: hidden;
      user-select: none;
      font-family: sans-serif;
    }
    canvas {
      display: block;
      background: #27ae60;
    }
    @keyframes floatUpFade {
      0% { transform: translateY(0) scale(1); opacity: 1; }
      100% { transform: translateY(-50px) scale(1.2); opacity: 0; }
    }
    .floating-money-text {
      position: absolute;
      color: #2ecc71;
      font-weight: 900;
      font-size: 1.1rem;
      text-shadow: 0 2px 4px rgba(0,0,0,0.6);
      pointer-events: none;
      z-index: 50;
      animation: floatUpFade 1s ease-out forwards;
    }
  </style>
</head>
<body>

  <!-- ==================== UI GIAO DIỆN HỆ THỐNG ==================== -->
  <div id="wallet-hud" style="position: absolute; top: 15px; left: 50%; transform: translateX(-50%); background: rgba(0,0,0,0.85); color: #2ecc71; padding: 10px 20px; border-radius: 20px; font-weight: bold; border: 2px solid #2ecc71; font-size: 1.1rem; z-index: 10;">
    💵 Tiền mặt: <span id="lbl-money">15.000.000</span> VNĐ 
    <button onclick="saveGameToServer()" style="margin-left: 10px; background: #3498db; color: #fff; border: none; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 0.8rem;">💾 Lưu Game</button>
  </div>

  <div id="interact-prompt" style="display: none; position: absolute; bottom: 100px; left: 50%; transform: translateX(-50%); background: #ff9f43; color: #fff; padding: 10px 20px; border-radius: 25px; font-weight: bold; border: 2px solid #fff; box-shadow: 0 4px 15px rgba(0,0,0,0.3); z-index: 15; cursor: pointer;">
    Bấm [ E ] hoặc Chạm vào đây để Thuê / Quản lý Mặt Bằng
  </div>

  <!-- Modal Thuê Mặt Bằng -->
  <div id="store-modal" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 320px; background: #ffffff; border-radius: 16px; border: 3px solid #54a0ff; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 30;">
    <h2 id="modal-store-title" style="color: #2e86de; font-size: 1.1rem; text-align: center; margin-top: 0; margin-bottom: 12px;">🏪 Mặt Bằng Cho Thuê</h2>
    <div id="modal-store-info" style="font-size: 0.85rem; color: #333; line-height: 1.6; margin-bottom: 15px;">
      • <b>Giá thuê:</b> 5.000.000 VNĐ<br>• <b>Trạng thái:</b> Chưa có chủ
    </div>
    <div id="store-rent-section">
      <label style="font-size: 0.8rem; font-weight: bold; display: block; margin-bottom: 4px;">Tên cửa hàng:</label>
      <input type="text" id="txt-store-name" value="Tiệm Tạp Hóa Vui Vẻ" style="width: 100%; padding: 8px; border-radius: 8px; border: 1px solid #ccc; margin-bottom: 12px; box-sizing: border-box;">
      <button onclick="rentCurrentStore()" style="width: 100%; padding: 10px; background: #10ac84; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">📝 Ký Hợp Đồng (5.000.000đ)</button>
    </div>
    <div id="store-manage-section" style="display: none;">
      <p style="color: #10ac84; font-weight: bold; text-align: center; margin-bottom: 10px;">✅ Bạn đang sở hữu mặt bằng này!</p>
      <button onclick="openFurnitureShop()" style="width: 100%; padding: 8px; background: #54a0ff; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; margin-bottom: 6px;">🛋️ Trang Trí & Đặt Nội Thất</button>
    </div>
    <button onclick="closeStoreModal()" style="width: 100%; padding: 8px; background: #ee5253; color: white; border: none; border-radius: 8px; font-weight: bold; margin-top: 8px; cursor: pointer;">Đóng</button>
  </div>

  <!-- Modal Shop Nội Thất -->
  <div id="furniture-shop-modal" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 350px; background: #ffffff; border-radius: 16px; border: 3px solid #10ac84; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 35;">
    <h2 style="color: #10ac84; font-size: 1.1rem; text-align: center; margin-top: 0; margin-bottom: 12px;">🛋️ Cửa Hàng Nội Thất</h2>
    <div style="max-height: 220px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f8f9fa; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
        <div><b>📦 Kệ Hàng</b><br><span style="color: #2ecc71; font-weight: bold;">2.000.000 VNĐ</span></div>
        <button onclick="selectFurnitureToPlace('SHELF', 2000000)" style="background: #10ac84; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Mua & Đặt</button>
      </div>
      <div style="display: flex; align-items: center; justify-content: space-between; background: #f8f9fa; padding: 10px; border-radius: 8px; border: 1px solid #ddd;">
        <div><b>❄️ Tủ Lạnh</b><br><span style="color: #2ecc71; font-weight: bold;">5.000.000 VNĐ</span></div>
        <button onclick="selectFurnitureToPlace('FRIDGE', 5000000)" style="background: #10ac84; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer;">Mua & Đặt</button>
      </div>
    </div>
    <button onclick="closeFurnitureShop()" style="width: 100%; padding: 8px; background: #ee5253; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Đóng</button>
  </div>

  <!-- Modal Kho Hàng -->
  <div id="restock-shop-modal" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 360px; background: #ffffff; border-radius: 16px; border: 3px solid #f39c12; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 36;">
    <h2 style="color: #f39c12; font-size: 1.1rem; text-align: center; margin-top: 0; margin-bottom: 12px;">📦 Kho Nhập Hàng</h2>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
      <button onclick="buyInventoryItem('SHELF_BOX', 500000, 10)" style="padding: 8px; background: #f39c12; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Nhập Thùng Kệ (+10): 500k</button>
      <button onclick="buyInventoryItem('FRIDGE_BOX', 800000, 10)" style="padding: 8px; background: #f39c12; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Nhập Thùng Tủ Lạnh (+10): 800k</button>
    </div>
    <div style="background: #e1f5fe; padding: 8px; border-radius: 6px; font-size: 0.85rem; color: #0277bd; text-align: center; margin-bottom: 10px;">
      Tồn kho: <b id="lbl-stock-count">0</b> thùng
    </div>
    <button onclick="closeRestockShop()" style="width: 100%; padding: 8px; background: #ee5253; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Đóng Kho</button>
  </div>

  <!-- Modal Nhân Sự -->
  <div id="staff-shop-modal" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 360px; background: #ffffff; border-radius: 16px; border: 3px solid #8e44ad; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 37;">
    <h2 style="color: #8e44ad; font-size: 1.1rem; text-align: center; margin-top: 0; margin-bottom: 12px;">👥 Thuê Nhân Sự</h2>
    <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px;">
      <button onclick="hireStaff('CASHIER')" style="padding: 8px; background: #8e44ad; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Thuê Thu Ngân (2.000.000đ)</button>
      <button onclick="hireStaff('RESTOCKER')" style="padding: 8px; background: #8e44ad; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">Thuê Bốc Vác (3.000.000đ)</button>
    </div>
    <div style="background: #f3e5f5; padding: 8px; border-radius: 6px; font-size: 0.85rem; color: #6a1b9a; text-align: center; margin-bottom: 10px;" id="lbl-staff-status">Chưa có ai</div>
    <button onclick="closeStaffShop()" style="width: 100%; padding: 8px; background: #ee5253; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer;">Đóng Quản Lý</button>
  </div>

  <!-- HUD Layout Mode & Hóa đơn -->
  <div id="layout-hud" style="display: none; position: absolute; top: 15px; right: 15px; background: rgba(0,0,0,0.85); color: #fff; padding: 10px; border-radius: 8px; border: 2px solid #54a0ff; z-index: 20; font-size: 0.85rem;">
    🛠️ Đang đặt nội thất. Click vào tiệm để đặt. Bấm [ESC] để hủy.
  </div>

  <div id="bills-hud" style="display: none; position: absolute; top: 70px; right: 15px; background: rgba(231, 76, 60, 0.95); color: #fff; padding: 10px; border-radius: 8px; z-index: 20; font-size: 0.85rem;">
    ⚡ Hóa đơn điện nước: <span id="lbl-bill-amount">1M</span><br>
    <button onclick="payStoreBills()" style="margin-top: 4px; width: 100%; background: #fff; color: #c0392b; border: none; padding: 4px; font-weight: bold; cursor: pointer;">Thanh Toán</button>
  </div>

  <!-- Canvas Game -->
  <canvas id="gameCanvas"></canvas>

  <!-- ==================== JAVASCRIPT GAME LOGIC (10 PHẦN) ==================== -->
  <script>
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Biến toàn cục game
    let playerMoney = 15000000;
    let playerStock = { SHELF_BOX: 5, FRIDGE_BOX: 3 };
    let playerStaff = { cashierCount: 0, restockerCount: 0 };
    
    let player = { x: 400, y: 300, w: 20, h: 20, speed: 3, color: '#f1c40f' };
    let keys = {};

    let MAP_WORLD = {
      buildings: [
        { x: 150, y: 100, w: 180, h: 140, type: 'APARTMENT_STORE', name: '🏪 Mặt Bằng A', isRented: false, customName: '', furnitureList: [] },
        { x: 500, y: 100, w: 180, h: 140, type: 'APARTMENT_STORE', name: '🏪 Mặt Bằng B', isRented: false, customName: '', furnitureList: [] }
      ]
    };

    let npcs = [
      { x: 200, y: 400, w: 16, h: 16, color: '#e74c3c', vx: 1, vy: 0, shoppingState: 'IDLE', targetStore: null, shoppingTimer: 0 },
      { x: 600, y: 400, w: 16, h: 16, color: '#3498db', vx: -1, vy: 0, shoppingState: 'IDLE', targetStore: null, shoppingTimer: 0 }
    ];

    const FURNITURE_TYPES = {
      SHELF:   { name: 'Kệ Hàng', w: 30, h: 20, color: '#d35400', profit: 150000, maxStock: 15 },
      FRIDGE:  { name: 'Tủ Lạnh', w: 25, h: 25, color: '#2980b9', profit: 250000, maxStock: 10 }
    };

    let nearStore = null;
    let isLayoutMode = false;
    let pendingFurniture = null;
    let mouseWorldPos = { x: 0, y: 0 };
    let currentBillAmount = 0;
    let billTimer = 0;

    // Đồng bộ dữ liệu từ Server khi vào game
    async function loadGameFromServer() {
      try {
        let res = await fetch('/api/load');
        let data = await res.json();
        playerMoney = data.money;
        playerStock = data.stock;
        playerStaff = data.staff;
        updateMoneyDisplay();
      } catch(e) { console.log("Lỗi tải dữ liệu từ server"); }
    }
    loadGameFromServer();

    async function saveGameToServer() {
      try {
        let res = await fetch('/api/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ money: playerMoney, stock: playerStock, staff: playerStaff })
        });
        let result = await res.json();
        alert(result.message);
      } catch(e) { alert("Lỗi kết nối lưu game!"); }
    }

    // Bắt phím di chuyển
    window.addEventListener('keydown', e => {
      keys[e.key.toLowerCase()] = true;
      if (e.key.toLowerCase() === 'e' && nearStore) openStoreModal();
      if (e.key === 'Escape' && isLayoutMode) cancelLayoutMode();
    });
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);

    function updatePlayer() {
      let dx = 0, dy = 0;
      if (keys['w'] || keys['arrowup']) dy = -player.speed;
      if (keys['s'] || keys['arrowdown']) dy = player.speed;
      if (keys['a'] || keys['arrowleft']) dx = -player.speed;
      if (keys['d'] || keys['arrowright']) dx = player.speed;

      player.x += dx;
      player.y += dy;
    }

    // Kiểm tra va chạm & tương tác cửa hàng
    function checkInteractions() {
      nearStore = null;
      let promptEl = document.getElementById('interact-prompt');
      
      MAP_WORLD.buildings.forEach(b => {
        let doorX = b.x + b.w / 2;
        let doorY = b.y + b.h + 15;
        if (Math.hypot(player.x - doorX, player.y - doorY) < 45) {
          nearStore = b;
          promptEl.style.display = 'block';
        }
      });
      if (!nearStore) promptEl.style.display = 'none';
    }

    // AI NPC đi dạo & mua sắm
    function updateNPCs() {
      const activeStores = MAP_WORLD.buildings.filter(b => b.isRented && b.furnitureList && b.furnitureList.length > 0);

      npcs.forEach(npc => {
        if (npc.shoppingState === 'IDLE') {
          npc.x += npc.vx;
          npc.y += npc.vy;
          if (Math.random() < 0.02) {
            npc.vx = (Math.random() - 0.5) * 2;
            npc.vy = (Math.random() - 0.5) * 2;
          }
          if (activeStores.length > 0 && Math.random() < 0.003) {
            npc.targetStore = activeStores[Math.floor(Math.random() * activeStores.length)];
            npc.shoppingState = 'WALKING_TO_STORE';
          }
        } else if (npc.shoppingState === 'WALKING_TO_STORE' && npc.targetStore) {
          let tx = npc.targetStore.x + npc.targetStore.w / 2;
          let ty = npc.targetStore.y + npc.targetStore.h / 2;
          let angle = Math.atan2(ty - npc.y, tx - npc.x);
          npc.x += Math.cos(angle) * 1.5;
          npc.y += Math.sin(angle) * 1.5;
          if (Math.hypot(tx - npc.x, ty - npc.y) < 15) {
            npc.shoppingState = 'SHOPPING';
            npc.shoppingTimer = 120;
          }
        } else if (npc.shoppingState === 'SHOPPING') {
          npc.shoppingTimer--;
          if (npc.shoppingTimer <= 0) {
            let availableItems = npc.targetStore.furnitureList.filter(f => f.currentStock > 0);
            if (availableItems.length > 0) {
              let item = availableItems[Math.floor(Math.random() * availableItems.length)];
              item.currentStock--;
              playerMoney += item.profit;
              updateMoneyDisplay();
              showRevenueNotification(item.profit);
            }
            npc.shoppingState = 'LEAVING';
            npc.shoppingTimer = 60;
          }
        } else if (npc.shoppingState === 'LEAVING') {
          npc.shoppingTimer--;
          npc.y += 1.5;
          if (npc.shoppingTimer <= 0) {
            npc.shoppingState = 'IDLE';
            npc.targetStore = null;
          }
        }
      });
    }

    // Tự động hóa nhân viên & Hóa đơn
    function updateStaffAndBills() {
      // Nhân viên bốc vác tự động châm hàng
      if (playerStaff.restockerCount > 0) {
        MAP_WORLD.buildings.forEach(b => {
          if (b.isRented && b.furnitureList) {
            b.furnitureList.forEach(f => {
              if (f.currentStock === 0) {
                let boxType = f.type === 'FRIDGE' ? 'FRIDGE_BOX' : 'SHELF_BOX';
                if (playerStock[boxType] > 0) {
                  playerStock[boxType]--;
                  f.currentStock = f.maxStock;
                }
              }
            });
          }
        });
      }

      // Hóa đơn định kỳ
      billTimer++;
      if (billTimer >= 3600) {
        billTimer = 0;
        currentBillAmount = 500000 + (playerStaff.cashierCount * 300000) + (playerStaff.restockerCount * 400000);
        document.getElementById('lbl-bill-amount').innerText = currentBillAmount.toLocaleString() + 'đ';
        document.getElementById('bills-hud').style.display = 'block';
      }
    }

    function showRevenueNotification(amt) {
      let el = document.createElement('div');
      el.className = 'floating-money-text';
      el.innerText = \`+\${amt.toLocaleString()} VNĐ\`;
      el.style.left = (window.innerWidth / 2 + Math.random() * 60 - 30) + 'px';
      el.style.top = (window.innerHeight / 2 + Math.random() * 40 - 20) + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1000);
    }

    function updateMoneyDisplay() {
      document.getElementById('lbl-money').innerText = playerMoney.toLocaleString('vi-VN');
    }

    // Vẽ Game lên Canvas
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Vẽ Tòa nhà / Mặt bằng
      MAP_WORLD.buildings.forEach(b => {
        ctx.fillStyle = b.isRented ? '#34495e' : '#7f8c8d';
        ctx.fillRect(b.x, b.y, b.w, b.h);
        ctx.strokeStyle = '#2c3e50';
        ctx.lineWidth = 3;
        ctx.strokeRect(b.x, b.y, b.w, b.h);

        ctx.fillStyle = '#fff';
        ctx.font = '12px sans-serif';
        ctx.fillText(b.isRented ? (b.customName || 'Cửa hàng') : b.name, b.x + 10, b.y + 25);

        // Vẽ nội thất bên trong
        if (b.furnitureList) {
          b.furnitureList.forEach(f => {
            ctx.fillStyle = f.color;
            ctx.fillRect(f.x, f.y, f.w, f.h);
            ctx.strokeStyle = '#000';
            ctx.strokeRect(f.x, f.y, f.w, f.h);
          });
        }
      });

      // Vẽ NPC
      npcs.forEach(n => {
        ctx.fillStyle = n.color;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.w/2, 0, Math.PI * 2);
        ctx.fill();
      });

      // Vẽ Player
      ctx.fillStyle = player.color;
      ctx.fillRect(player.x - player.w/2, player.y - player.h/2, player.w, player.h);

      // Vẽ Layout Preview nếu đang đặt đồ
      if (isLayoutMode && pendingFurniture) {
        ctx.fillStyle = 'rgba(46, 204, 113, 0.5)';
        ctx.fillRect(mouseWorldPos.x - pendingFurniture.w/2, mouseWorldPos.y - pendingFurniture.h/2, pendingFurniture.w, pendingFurniture.h);
      }
    }

    // Vòng lặp chính Game Loop
    function gameLoop() {
      updatePlayer();
      checkInteractions();
      updateNPCs();
      updateStaffAndBills();
      draw();
      requestAnimationFrame(gameLoop);
    }

    // Các hàm giao diện UI Modal
    function openStoreModal() {
      if (!nearStore) return;
      document.getElementById('store-modal').style.display = 'block';
      document.getElementById('modal-store-title').innerText = nearStore.isRented ? nearStore.customName : nearStore.name;
      document.getElementById('store-rent-section').style.display = nearStore.isRented ? 'none' : 'block';
      document.getElementById('store-manage-section').style.display = nearStore.isRented ? 'block' : 'none';
    }
    function closeStoreModal() { document.getElementById('store-modal').style.display = 'none'; }

    function rentCurrentStore() {
      if (playerMoney < 5000000) { alert("Không đủ tiền thuê!"); return; }
      let cName = document.getElementById('txt-store-name').value;
      playerMoney -= 5000000;
      nearStore.isRented = true;
      nearStore.customName = cName;
      updateMoneyDisplay();
      closeStoreModal();
      alert("Thuê thành công!");
    }

    function openFurnitureShop() { closeStoreModal(); document.getElementById('furniture-shop-modal').style.display = 'block'; }
    function closeFurnitureShop() { document.getElementById('furniture-shop-modal').style.display = 'none'; }

    function selectFurnitureToPlace(type, price) {
      if (playerMoney < price) { alert("Không đủ tiền!"); return; }
      pendingFurniture = { type, price, ...FURNITURE_TYPES[type] };
      isLayoutMode = true;
      closeFurnitureShop();
      document.getElementById('layout-hud').style.display = 'block';
    }
    function cancelLayoutMode() { isLayoutMode = false; pendingFurniture = null; document.getElementById('layout-hud').style.display = 'none'; }

    canvas.addEventListener('mousemove', e => {
      let rect = canvas.getBoundingClientRect();
      mouseWorldPos.x = e.clientX - rect.left;
      mouseWorldPos.y = e.clientY - rect.top;
    });

    canvas.addEventListener('click', () => {
      if (!isLayoutMode || !pendingFurniture || !nearStore) return;
      if (mouseWorldPos.x >= nearStore.x && mouseWorldPos.x <= nearStore.x + nearStore.w &&
          mouseWorldPos.y >= nearStore.y && mouseWorldPos.y <= nearStore.y + nearStore.h) {
        playerMoney -= pendingFurniture.price;
        updateMoneyDisplay();
        nearStore.furnitureList.push({
          type: pendingFurniture.type,
          x: mouseWorldPos.x - pendingFurniture.w/2,
          y: mouseWorldPos.y - pendingFurniture.h/2,
          w: pendingFurniture.w,
          h: pendingFurniture.h,
          color: pendingFurniture.color,
          profit: pendingFurniture.profit,
          maxStock: pendingFurniture.maxStock,
          currentStock: pendingFurniture.maxStock
        });
        cancelLayoutMode();
      } else {
        alert("Hãy đặt bên trong cửa hàng của bạn!");
      }
    });

    function buyInventoryItem(type, price, amount) {
      if (playerMoney < price) { alert("Không đủ tiền nhập hàng!"); return; }
      playerMoney -= price;
      playerStock[type] += amount;
      updateMoneyDisplay();
      alert("Nhập kho thành công!");
    }

    function hireStaff(type) {
      let cost = type === 'CASHIER' ? 2000000 : 3000000;
      if (playerMoney < cost) { alert("Không đủ tiền thuê nhân sự!"); return; }
      playerMoney -= cost;
      if (type === 'CASHIER') playerStaff.cashierCount++;
      if (type === 'RESTOCKER') playerStaff.restockerCount++;
      updateMoneyDisplay();
      document.getElementById('lbl-staff-status').innerText = \`\${playerStaff.cashierCount} Thu ngân, \${playerStaff.restockerCount} Bốc vác\`;
      alert("Thuê thành công!");
    }

    function payStoreBills() {
      if (playerMoney < currentBillAmount) { alert("Không đủ tiền trả hóa đơn!"); return; }
      playerMoney -= currentBillAmount;
      updateMoneyDisplay();
      document.getElementById('bills-hud').style.display = 'none';
      alert("Đã thanh toán hóa đơn xong!");
    }

    // Khởi chạy game loop
    gameLoop();
  </script>
</body>
</html>
  `);
});

server.listen(PORT, () => {
  console.log(\`🚀 Server & Game đã gộp chung thành công!\`);
  console.log(\`👉 Hãy mở trình duyệt và truy cập: http://localhost:\${PORT}\`);
});
