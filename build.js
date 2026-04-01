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
        registry.push({
            folder,
            name: meta.name,
            category: meta.category,
            project: meta.project,
            owner: meta.owner,
            date: meta.date,
            description: meta.description || ''
        });
    } catch (e) {
        console.warn(`Skipping ${folder}: invalid meta.json`);
    }
});

// Sort by date descending (YYYY MM DD)
registry.sort((a, b) => b.date.localeCompare(a.date));

fs.writeFileSync(
    path.join(toolsDir, 'registry.json'),
    JSON.stringify(registry, null, 2)
);

console.log(`Built registry: ${registry.length} tool(s)`);
