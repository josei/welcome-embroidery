import {test,expect} from '@playwright/test';

// Every glyph in the sprite is drawn with the icon stroke width, so the visible ink reaches half a stroke beyond the
// geometry. The check measures that outer extent and requires the ink to sit inside the 24-unit view box and close to its
// centre. Cap markers and the play triangle are centred on purpose and are excluded.
const STROKE_HALF=0.85;
const CENTRE_LIMIT=0.75;
const EXEMPT=id=>id.startsWith('i-cap-')||id==='i-play';

test('every sprite glyph sits inside its view box and near its centre',async({page})=>{
 await page.setViewportSize({width:1600,height:1000});
 await page.goto('/');
 await expect(page.locator('header.top #name')).toBeVisible();
 const glyphs=await page.evaluate(()=>[...document.querySelectorAll('symbol[id^="i-"]')].map(symbol=>{
  let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
  for(const shape of symbol.querySelectorAll('path,rect,circle,line,polyline,polygon,ellipse')){
   const b=shape.getBBox();
   const m=shape.transform.baseVal.consolidate()?.matrix??{e:0,f:0};
   const x=b.x+m.e,y=b.y+m.f;
   minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x+b.width);maxY=Math.max(maxY,y+b.height);
  }
  return {id:symbol.id,minX,minY,maxX,maxY};
 }));
 expect(glyphs.length).toBeGreaterThan(0);
 const problems=[];
 for(const g of glyphs){
  if(EXEMPT(g.id))continue;
  const inkMinX=g.minX-STROKE_HALF,inkMinY=g.minY-STROKE_HALF,inkMaxX=g.maxX+STROKE_HALF,inkMaxY=g.maxY+STROKE_HALF;
  const outside=inkMinX<0||inkMinY<0||inkMaxX>24||inkMaxY>24;
  const offX=(inkMinX+inkMaxX)/2-12,offY=(inkMinY+inkMaxY)/2-12;
  if(outside||Math.abs(offX)>CENTRE_LIMIT||Math.abs(offY)>CENTRE_LIMIT)
   problems.push({id:g.id,outside,offX:+offX.toFixed(2),offY:+offY.toFixed(2)});
 }
 expect(problems).toEqual([]);
});
