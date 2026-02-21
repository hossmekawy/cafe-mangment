const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;

    content = content
        .replace(/bg-white(?!\/)/g, 'bg-surface')
        .replace(/text-slate-900(?!\/)/g, 'text-textMain')
        .replace(/text-slate-800(?!\/)/g, 'text-textMain')
        .replace(/text-slate-700(?!\/)/g, 'text-textMain')
        .replace(/text-slate-600(?!\/)/g, 'text-textMuted')
        .replace(/text-slate-500(?!\/)/g, 'text-textMuted')
        .replace(/text-slate-400(?!\/)/g, 'text-textMuted')
        .replace(/border-slate-[123]00(?!\/)/g, 'border-slate-200 dark:border-white/10')
        // Carefully handle bg-slate-50 so it doesn't match hover:bg-slate-50 incorrectly here, though we've replaced it below. Wait, let's do hovers first.
        .replace(/hover:bg-slate-50(?!\/|0)/g, 'HOVER_BG_SLATE_50_TEMP')
        .replace(/hover:bg-slate-100(?!\/|0)/g, 'HOVER_BG_SLATE_100_TEMP')
        .replace(/bg-slate-50(?!\/|0)/g, 'bg-slate-50 dark:bg-white/5')
        .replace(/HOVER_BG_SLATE_50_TEMP/g, 'hover:bg-slate-50 dark:hover:bg-white/5')
        .replace(/HOVER_BG_SLATE_100_TEMP/g, 'hover:bg-slate-100 dark:hover:bg-white/10')
        .replace(/dark:border-white\/10 dark:border-white\/10/g, 'dark:border-white/10') // Cleanup
        .replace(/dark:bg-white\/5 dark:bg-white\/5/g, 'dark:bg-white/5')
        .replace(/dark:hover:bg-white\/5 dark:hover:bg-white\/5/g, 'dark:hover:bg-white/5')
        .replace(/dark:hover:bg-white\/10 dark:hover:bg-white\/10/g, 'dark:hover:bg-white/10');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Updated ${filePath}`);
    }
}

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
            replaceInFile(fullPath);
        }
    }
}

processDir('e:/projects/Cafe System/frontend/src/pages');
processDir('e:/projects/Cafe System/frontend/src/components');
