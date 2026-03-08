const fs = require('fs');
const path = require('path');

const toolsDir = path.join(__dirname, 'tools');
const registry = [];

fs.readdirSync(toolsDir).forEach(folder => {
    const folderPath = path.join(toolsDir, folder);
    if (!fs.statSync(folderPath).isDirectory()) return;

    const metaPath = path.join(folderPath, 'meta.json');
    if (!fs.existsSync(metaPath)) return;

    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        registry.push({ folder, ...meta });
    } catch (e) {
        console.warn(`Skipping ${folder}: invalid meta.json`);
    }
});

// Sort by date descending (DD.MM.YYYY)
registry.sort((a, b) => {
    const [ad, am, ay] = a.date.split('.');
    const [bd, bm, by] = b.date.split('.');
    return new Date(by, bm - 1, bd) - new Date(ay, am - 1, ad);
});

fs.writeFileSync(
    path.join(toolsDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
);

console.log(`Built registry: ${registry.length} tool(s)`);
