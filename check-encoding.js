import fs from "node:fs";
const content = fs.readFileSync('app/dashboard/tenant/page.tsx', 'utf8');
console.log('First 100 chars:', content.substring(0, 100));
console.log('First 10 bytes:', Buffer.from(content.substring(0, 10)).toString('hex'));
