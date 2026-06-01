const fs = require('fs');
let s = fs.readFileSync('script.js', 'utf8');
s = s.replace(/const ctx = DOM\.bgCanvas\.getContext\('2d', \{ alpha: false \}\);/g, "const ctx = DOM.bgCanvas ? DOM.bgCanvas.getContext('2d', { alpha: false }) : null;");
fs.writeFileSync('script.js', s);
