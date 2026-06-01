const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');

const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);
if (styleMatch) {
  fs.writeFileSync('styles.css', styleMatch[1].trim());
}

const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
if (scriptMatch) {
  fs.writeFileSync('script.js', scriptMatch[1].trim());
}

const newHtml = html.replace(/<style>[\s\S]*?<\/style>/, '<link rel="stylesheet" href="styles.css">')
                 .replace(/<script>[\s\S]*?<\/script>/, '<script src="script.js"></script>');
fs.writeFileSync('index.html', newHtml);
