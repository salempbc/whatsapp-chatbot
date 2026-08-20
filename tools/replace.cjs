const fs = require('fs');
let html = fs.readFileSync('public/index.html', 'utf8');

html = html.replace('<body class="p-4 overflow-x-hidden">', '<body class="px-4 pt-4 overflow-x-hidden bg-[var(--tg-theme-bg-color,#f3f4f6)]">');
html = html.replace('<div id="app" v-cloak class="relative">', '<div id="app" v-cloak class="relative" style="padding-bottom: max(130px, calc(90px + env(safe-area-inset-bottom)));">');
html = html.replace('padding-bottom: calc(90px + env(safe-area-inset-bottom, 20px));', 'padding-bottom: 0;');
html = html.replace('background: var(--tg-theme-secondary-bg-color, #fff)', 'background: var(--tg-theme-secondary-bg-color, #ffffffcc); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);');
html = html.replace('border-radius: 1rem;', 'border-radius: 1.25rem;');

const s = html.indexOf('<!-- SETTINGS TAB -->');
const datalistStart = html.indexOf('<datalist id="role-options">', s);

if (s !== -1 && datalistStart !== -1) {
  const tpl = fs.readFileSync('tools/settings-tpl.html', 'utf8');
  html = html.substring(0, s) + tpl + '\n    ' + html.substring(datalistStart);
  fs.writeFileSync('public/index.html', html, 'utf8');
}