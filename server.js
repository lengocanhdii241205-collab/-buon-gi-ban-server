"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 3000;
const HOST = "0.0.0.0";

const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const SAVE_FILE = path.join(DATA_DIR, "saves.json");

if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, {
        recursive: true
    });
}

if (!fs.existsSync(SAVE_FILE)) {
    fs.writeFileSync(
        SAVE_FILE,
        "{}",
        "utf8"
    );
}

function loadDatabase() {
    try {
        return JSON.parse(
            fs.readFileSync(
                SAVE_FILE,
                "utf8"
            )
        );
    } catch {
        return {};
    }
}

function saveDatabase(data) {
    fs.writeFileSync(
        SAVE_FILE,
        JSON.stringify(
            data,
            null,
            2
        ),
        "utf8"
    );
}

function sendJSON(res, status, data) {

    res.writeHead(
        status,
        {
            "Content-Type":
                "application/json; charset=utf-8",

            "Access-Control-Allow-Origin":
                "*",

            "Access-Control-Allow-Methods":
                "GET,POST,OPTIONS",

            "Access-Control-Allow-Headers":
                "Content-Type"
        }
    );

    res.end(
        JSON.stringify(data)
    );
}

function readBody(req) {

    return new Promise(
        (resolve,reject)=>{

            let data="";

            req.on(
                "data",
                chunk=>{

                    data+=chunk;

                    if(
                        data.length >
                        10*1024*1024
                    ){

                        reject(
                            new Error(
                                "Dữ liệu quá lớn."
                            )
                        );

                        req.destroy();
                    }
                }
            );

            req.on(
                "end",
                ()=>{

                    if(!data){
                        resolve({});
                        return;
                    }

                    try{

                        resolve(
                            JSON.parse(data)
                        );

                    }catch{

                        reject(
                            new Error(
                                "JSON không hợp lệ."
                            )
                        );
                    }
                }
            );

            req.on(
                "error",
                reject
            );
        }
    );
}

const server =
    http.createServer(
        async(req,res)=>{

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

            if(
                req.method==="OPTIONS"
            ){

                res.writeHead(204);

                res.end();

                return;
            }

            /* STATUS */

            if(
                req.method==="GET" &&
                req.url==="/api/status"
            ){

                return sendJSON(
                    res,
                    200,
                    {
                        ok:true,
                        game:"BUÔN GÌ BÁN",
                        server:"online",
                        version:"3.0",
                        saveSystem:true,
                        npcSystem:true,
                        trading:true
                    }
                );
            }

            /* LOAD */

            if(
                req.method==="GET" &&
                req.url.startsWith(
                    "/api/load"
                )
            ){

                const url =
                    new URL(
                        req.url,
                        "http://localhost"
                    );

                const id =
                    url.searchParams.get(
                        "id"
                    );

                if(!id){

                    return sendJSON(
                        res,
                        400,
                        {
                            ok:false,
                            error:
                                "Thiếu ID."
                        }
                    );
                }

                const db =
                    loadDatabase();

                return sendJSON(
                    res,
                    200,
                    {
                        ok:true,
                        save:
                            db[id] || null
                    }
                );
            }

            /* SAVE */

            if(
                req.method==="POST" &&
                req.url==="/api/save"
            ){

                try{

                    const body =
                        await readBody(req);

                    if(!body.id){

                        return sendJSON(
                            res,
                            400,
                            {
                                ok:false,
                                error:
                                    "Thiếu player ID."
                            }
                        );
                    }

                    if(!body.game){

                        return sendJSON(
                            res,
                            400,
                            {
                                ok:false,
                                error:
                                    "Thiếu game data."
                            }
                        );
                    }

                    const db =
                        loadDatabase();

                    db[body.id]={
                        game:body.game,
                        updatedAt:
                            Date.now()
                    };

                    saveDatabase(db);

                    return sendJSON(
                        res,
                        200,
                        {
                            ok:true,
                            message:
                                "Đã lưu game."
                        }
                    );

                }catch(error){

                    return sendJSON(
                        res,
                        400,
                        {
                            ok:false,
                            error:
                                error.message
                        }
                    );
                }
            }

            /* DELETE */

            if(
                req.method==="POST" &&
                req.url==="/api/delete"
            ){

                try{

                    const body =
                        await readBody(req);

                    if(!body.id){

                        return sendJSON(
                            res,
                            400,
                            {
                                ok:false,
                                error:
                                    "Thiếu ID."
                            }
                        );
                    }

                    const db =
                        loadDatabase();

                    delete db[body.id];

                    saveDatabase(db);

                    return sendJSON(
                        res,
                        200,
                        {
                            ok:true,
                            message:
                                "Đã xóa save."
                        }
                    );

                }catch(error){

                    return sendJSON(
                        res,
                        400,
                        {
                            ok:false,
                            error:
                                error.message
                        }
                    );
                }
            }

            /* STATIC FILES */

            let requestPath =
                req.url.split("?")[0];

            if(
                requestPath==="/" ||
                requestPath===""
            ){
                requestPath="/index.html";
            }

            let decoded;

            try{

                decoded =
                    decodeURIComponent(
                        requestPath
                    );

            }catch{

                res.writeHead(400);

                res.end("Bad Request");

                return;
            }

            const filePath =
                path.resolve(
                    ROOT,
                    "."+decoded
                );

            const rootPath =
                path.resolve(ROOT);

            if(
                !filePath.startsWith(
                    rootPath
                )
            ){

                res.writeHead(403);

                res.end(
                    "Forbidden"
                );

                return;
            }

            fs.readFile(
                filePath,
                (error,data)=>{

                    if(error){

                        res.writeHead(
                            404,
                            {
                                "Content-Type":
                                    "text/plain; charset=utf-8"
                            }
                        );

                        res.end(
                            "404 - Không tìm thấy file"
                        );

                        return;
                    }

                    const ext =
                        path.extname(
                            filePath
                        ).toLowerCase();

                    const types={

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
                            "image/svg+xml",

                        ".ico":
                            "image/x-icon"
                    };

                    res.writeHead(
                        200,
                        {
                            "Content-Type":
                                types[ext] ||
                                "application/octet-stream"
                        }
                    );

                    res.end(data);
                }
            );
        }
    );

server.listen(
    PORT,
    HOST,
    ()=>{
        console.log("");
        console.log(
            "===================================="
        );
        console.log(
            "          BUÔN GÌ BÁN"
        );
        console.log(
            "          GAME SERVER"
        );
        console.log(
            "===================================="
        );
        console.log(
            "Server đang chạy:"
        );
        console.log(
            "http://localhost:"+PORT
        );
        console.log(
            "API:"
        );
        console.log(
            "http://localhost:"+PORT+
            "/api/status"
        );
        console.log(
            "===================================="
        );
        console.log("");
    }
);