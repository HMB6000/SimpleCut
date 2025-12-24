
const path = require('path');

// Simulate App.tsx logic
const originalPath = "C:\\Users\\hmalu\\AppData\\Roaming\\simple-cut\\proxies\\proxy_Screen Recording 2025-11-19 094316.mp4";
const normalizedPath = originalPath.replace(/\\/g, '/');
const parts = normalizedPath.split('/');
const encodedParts = parts.map(p => p.includes(':') ? p : encodeURIComponent(p));
const fileUrl = `media:///${encodedParts.join('/')}`;

console.log("Generated URL:", fileUrl);

// Simulate main.ts logic
const url = fileUrl;
let decodedUrl = decodeURIComponent(url.replace('media://', ''));

if (process.platform === 'win32' && decodedUrl.startsWith('/') && /^\/[a-zA-Z]:/.test(decodedUrl)) {
    decodedUrl = decodedUrl.slice(1);
}

const finalPath = path.normalize(decodedUrl);
console.log("Decoded Path:", finalPath);

const expectedPath = originalPath;
console.log("Match?", finalPath === expectedPath);

console.log("Platform:", process.platform);
