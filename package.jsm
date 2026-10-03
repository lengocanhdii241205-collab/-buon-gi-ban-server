<!-- ================================================================= -->
<!-- [MODULE 3: PACKAGE] LỚP VỎ ĐỒ HỌA 3D WEBGL & GIAO DIỆN ĐIỀU KHIỂN -->
<!-- ================================================================= -->
<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Cyber Bistro 3D - High Graphic Package</title>
    
    <!-- Tải bộ công cụ kết cấu đồ họa 3D -->
    <script src="https://cloudflare.com"></script>
    
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; user-select: none; -webkit-user-select: none; }
        body { background: #06030d; font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #ffffff; height: 100vh; overflow: hidden; position: relative; }
        #webgl-canvas-container { position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; }
        .hud-layer { position: absolute; z-index: 10; width: 100%; height: 100%; pointer-events: none; display: flex; flex-direction: column; justify-content: space-between; padding: 24px; }
        .clickable { pointer-events: auto; }
        .glass-card { background: rgba(255, 255, 255, 0.02); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 24px; padding: 16px 24px; box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6); }
        .top-status-bar { display: flex; justify-content: space-between; align-items: center; }
        .hud-text { font-size: 18px; font-weight: 900; letter-spacing: 0.5px; }
        .gold-glow { color: #ffd700; text-shadow: 0 0 10px rgba(255, 215, 0, 0.6); }
        .order-speech-bubble { position: absolute; top: 28%; left: 50%; transform: translate3d(-50%, -50%, 0); background: rgba(255, 255, 255, 0.95); color: #000000; padding: 12px 24px; border-radius: 50px; font-weight: 800; font-size: 15px; box-shadow: 0 0 25px rgba(255,255,255,0.5); display: none; z-index: 20; animation: floatBubble 2s infinite ease-in-out; }
        .kitchen-panel { width: 100%; display: flex; flex-direction: column; gap: 12px; }
        .cook-progress-track { width: 100%; height: 8px; background: rgba(255, 255, 255, 0.1); border-radius: 4px; overflow: hidden; }
        .cook-progress-fill { width: 0%; height: 100%; background: linear-gradient(90deg, #ff007f, #7f00ff); box-shadow: 0 0 10px #ff007f; }
        .button-grid-layout { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
        .control-btn { background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.01) 100%); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; color: white; padding: 18px 5px; font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.1s ease; }
        .control-btn:active { transform: scale(0.92); background: rgba(255, 0, 127, 0.3); border-color: #ff007f; }
        @keyframes floatBubble { 0% { transform: translate3d(-50%, -50%, 0); } 50% { transform: translate3d(-50%, -60%, 0); } 100% { transform: translate3d(-50%, -50%, 0); } }
    </style>
</head>
<body>

    <div id="webgl-canvas-container"></div>
    <div id="order-speech-bubble" class="order-speech-bubble">🍕 Loading...</div>

    <div class="hud-layer">
        <div class="top-status-bar glass-card clickable">
            <div class="hud-text">💰 GOLD: <span id="info-gold" class="gold-glow">100\$</span></div>
            <div class="hud-text">⭐ EXP: <span id="info-exp">0</span></div>
        </div>

        <div class="kitchen-panel glass-card clickable">
            <div class="cook-progress-track"><div id="info-progress" class="cook-progress-fill"></div></div>
            <div class="button-grid-layout">
                <button class="control-btn" onclick="handleCookRequest(101)">🍕 Pizza</button>
                <button class="control-btn" onclick="handleCookRequest(102)">🍔 Burger</button>
                <button class="control-btn" onclick="handleCookRequest(103)">🍣 Sushi</button>
                <button class="control-btn" onclick="handleCookRequest(104)">🍜 Mì Ý</button>
            </div>
        </div>
    </div>

    <!-- KHU VỰC LIÊN KẾT MODULE ĐỒ HỌA VỚI SERVER VÀ INDEX -->
    <script type="module">
        import { KitchenServer, TableServer } from './GameServer.js';

        let walletGold = 100;
        let walletExp = 0;
        const serverKitchen = new KitchenServer();
        const serverTable = new SystemTableServer(); // Lưu ý: Đổi tên theo class xuất từ file GameServer

        // --- CÀI ĐẶT THẾ GIỚI ĐỒ HỌA 3D (THREE.JS) ---
        const container3D = document.getElementById('webgl-canvas-container');
        const graphicScene = new THREE.Scene();
        graphicScene.background = new THREE.Color(0x06030d);
        graphicScene.fog = new THREE.FogExp2(0x06030d, 0.12);

        const mainCamera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
        mainCamera.position.set(0, 4.5, 5.5);
        mainCamera.lookAt(0, 0, 0);

        const webglRenderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        webglRenderer.setSize(window.innerWidth, window.innerHeight);
        webglRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // Chạy mượt 120Hz ProMotion của iPhone 16
        container3D.appendChild(webglRenderer.domElement);

        // Ánh sáng Neon cao cấp
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
        graphicScene.add(ambientLight);
        const neonPointLight = new THREE.PointLight(0x00f0ff, 2.5, 30);
        neonPointLight.position.set(0, 3, 0);
        graphicScene.add(neonPointLight);

        // Sàn nhà hàng 3D
        const floorMesh = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ color: 0x0f0a1c, roughness: 0.3, metalness: 0.3 }));
        floorMesh.rotation.x = -Math.PI / 2;
        graphicScene.add(floorMesh);

        // Bàn ăn 3D
        const tableMesh = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1.0, 32), new THREE.MeshStandardMaterial({ color: 0x1f123a, metalness: 0.7, roughness: 0.1 }));
        tableMesh.position.y = 0.5;
        graphicScene.add(tableMesh);

        // Viền đèn Neon quanh bàn
        const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
        const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(1.42, 0.04, 8, 32), ringMat);
        ringMesh.rotation.x = Math.PI / 2;
        ringMesh.position.y = 1.0;
        graphicScene.add(ringMesh);

        // Khách hàng NPC 3D lơ lửng
        const npcMat = new THREE.MeshStandardMaterial({ color: 0xff007f, roughness: 0.1, metalness: 0.6 });
        const npcMesh = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), npcMat);
        npcMesh.position.set(0, -10, 0); // Ẩn lúc chưa có khách
        graphicScene.add(npcMesh);

        let clockTime = new THREE.Clock();
        function renderLoop3D() {
            requestAnimationFrame(renderLoop3D);
            const timeDiff = clockTime.getElapsedTime();
            if (npcMesh.position.y > 0) {
                npcMesh.position.y = 1.9 + Math.sin(timeDiff * 2.8) * 0.12;
                npcMesh.rotation.y += 0.015;
            }
            webglRenderer.render(graphicScene, mainCamera);
        }
        renderLoop3D();

        // --- ĐỒNG BỘ GAMEPLAY VỚI SERVER ---
        function refreshStatUI() {
            document.getElementById("info-gold").innerText = `${walletGold}$`;
            document.getElementById("info-exp").innerText = walletExp;
        }

        function triggerNextCustomer() {
            setTimeout(() => {
                const targetCustomer = serverTable.spawnCustomer();
                if (targetCustomer) {
                    const bubble = document.getElementById("order-speech-bubble");
                    bubble.innerText = `🔔 Khách muốn: ${targetCustomer.foodName}`;
                    bubble.style.display = "block";

                    npcMesh.position.set(0, 1.9, 0);
                    npcMat.color.setHex(targetCustomer.color3d);
                    ringMat.color.setHex(0xff007f);
                    neonPointLight.color.setHex(0xff007f);
                }
            }, 2500);
        }

        window.handleCookRequest = async function(foodIndex) {
            if (serverKitchen.isStoveActive) return;
            const uiBar = document.getElementById("info-progress");
            
            const finishedIndex = await serverKitchen.processCooking(foodIndex, (percent) => {
                uiBar.style.width = `${percent}%`;
            });

            if (finishedIndex) {
                const result = serverTable.verifyAndServe(finishedIndex);
                uiBar.style.width = "0%";

                if (result.success) {
                    walletGold += result.data.price;
                    walletExp += result.data.exp;
                    refreshStatUI();

                    document.getElementById("order-speech-bubble").style.display = "none";
                    npcMesh.position.set(0, -10, 0);
                    ringMat.color.setHex(0x00f0ff);
                    neonPointLight.color.setHex(0x00f0ff);
                    
                    alert(`🎉 Thành công!\n+${result.data.price}$`);
                    triggerNextCustomer();
                } else {
                    alert(`😡 Thất bại: ${result.msg}`);
                }
            }
        }

        refreshStatUI();
        triggerNextCustomer();
        window.addEventListener('resize', () => {
            mainCamera.aspect = window.innerWidth / window.innerHeight;
            mainCamera.updateProjectionMatrix();
            webglRenderer.setSize(window.innerWidth, window.innerHeight);
        });
    </script>
</body>
</html>
