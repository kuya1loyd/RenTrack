import fs from "node:fs";
let content = fs.readFileSync('app/dashboard/tenant/page.tsx', 'utf8');
content = content.replace(/^\uFEFF/, '');
fs.writeFileSync('app/dashboard/tenant/page.tsx', content, 'utf8');
console.log('Fixed BOM if present');
