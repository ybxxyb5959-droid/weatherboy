const fs=require('fs');
const out=['/* 손글씨 폰트(Gaegu 400·700, Poor Story 400): @fontsource 패키지의 글꼴 조각(@font-face)을 woff2 만 남겨 옮긴 것.',
' * 한글은 조각(unicode-range)으로 나뉘어 있어 화면에 쓰인 글자가 든 조각만 받는다. 구글 서버를 쓰지 않는다. 패키지를 올리면 node scripts/gen-fonts.cjs 로 다시 만든다. */'];
for(const [pkg,weights] of [['gaegu',[400,700]],['poor-story',[400]]]){
  for(const w of weights){
    const css=fs.readFileSync(`node_modules/@fontsource/${pkg}/${w}.css`,'utf8');
    const blocks=css.match(/@font-face\s*\{[^}]*\}/g)||[];
    for(const b of blocks){
      const m=b.match(/url\(\.\/files\/([^)]+\.woff2)\)/);
      const fam=b.match(/font-family:\s*([^;]+);/)[1];
      const range=(b.match(/unicode-range:\s*([^;]+);/)||[])[1];
      out.push(`@font-face{font-family:${fam};font-style:normal;font-display:swap;font-weight:${w};src:url(../../node_modules/@fontsource/${pkg}/files/${m[1]}) format('woff2');${range?`unicode-range:${range};`:''}}`);
    }
  }
}
fs.writeFileSync('src/styles/fonts.css',out.join('\n')+'\n');
console.log(out.length-2,'font-face blocks');
