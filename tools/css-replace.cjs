const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');
const newStyles = fs.readFileSync('tools/new-styles.html', 'utf8');

const headStart = html.indexOf('<style>');
const headEnd = html.indexOf('</style>') + 8;
html = html.substring(0, headStart) + newStyles + html.substring(headEnd);

// Strip inline tailwind background overrides
html = html.replace(/bg-\[var\(--tg-theme-bg-color,#f3f4f6\)\]/g, '');

fs.writeFileSync('public/index.html', html, 'utf8');