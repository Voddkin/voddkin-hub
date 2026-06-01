const fs = require('fs');

let script = fs.readFileSync('script.js', 'utf8');

script = script.replace(
  "const ctx = DOM.bgCanvas.getContext('2d', { alpha: false });", 
  "const ctx = DOM.bgCanvas ? DOM.bgCanvas.getContext('2d', { alpha: false }) : null;"
);

script = script.replace(
    "const hwCores",
    "if (DOM.bgCanvas) {\nconst hwCores"
);

// We need to enclose the canvas logic in if (DOM.bgCanvas)
// Since it's big, let's do a better way: return early from the index.html specific init, or export it.
// Wait, script.js is wrapped in an IIFE: (function() {
