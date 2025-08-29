import * as fs from 'fs';

let html = fs.readFileSync('./dist/index.html', 'utf8');
html = html.replace(/<script type="module" crossorigin src="(.+?)"><\/script>/, (_, ex) => `<script type="module">${fs.readFileSync(`./dist/${ex}`)}</script>`);
html = html.replace(/<link rel="stylesheet" crossorigin href="(.+?)">/, (_, ex) => `<style>${fs.readFileSync(`./dist/${ex}`)}</style>`);
fs.writeFileSync('./dist/minko.html', html);