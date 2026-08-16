import sdk from "stremio-addon-sdk";
import addonInterface from "./addon.js";

const { serveHTTP } = sdk;
const port = Number(process.env.PORT) || 7576;

serveHTTP(addonInterface, { port });

console.log(`Torrent Search addon đang chạy tại: http://127.0.0.1:${port}`);
console.log(`Cài vào Stremio bằng URL: http://127.0.0.1:${port}/manifest.json`);
