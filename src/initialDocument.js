// @ts-check
// The document a new project starts with: a botanical badge.

/** @returns {Record<string, any>} */
export function initialDocument() {
  return {schema:'welcome/1',name:'Botanical badge',revision:0,hoop:110,settings:{spacing:.4,angle:32,underlay:true,compensation:.2},objects:[
    // Six-petal blossom: a smooth Bézier rosette (not a flat ellipse) filled with tatami rows blended across a
    // three-colour palette (coral -> peach -> gold) for thread-painted shading, finished with a crisp satin-like border.
    {id:'flower',name:'Wildflower',kind:'path',closed:true,smooth:true,
      points:[[0,-28.8],[3.6,-22.24],[11.09,-22.4],[7.2,-16],[11.09,-9.6],[3.6,-9.76],[0,-3.2],[-3.6,-9.76],[-11.09,-9.6],[-7.2,-16],[-11.09,-22.4],[-3.6,-22.24]],
      handles:[{i:[-2.5,-28.8],o:[2.5,-28.8]},{i:[1.44,-23.48],o:[5.76,-20.99]},{i:[9.84,-24.56],o:[12.33,-20.24]},{i:[7.2,-18.5],o:[7.2,-13.5]},{i:[12.33,-11.76],o:[9.84,-7.44]},{i:[5.76,-11.01],o:[1.44,-8.52]},{i:[2.5,-3.2],o:[-2.5,-3.2]},{i:[-1.44,-8.52],o:[-5.76,-11.01]},{i:[-9.84,-7.44],o:[-12.33,-11.76]},{i:[-7.2,-13.5],o:[-7.2,-18.5]},{i:[-12.33,-20.24],o:[-9.84,-24.56]},{i:[-5.76,-20.99],o:[-1.44,-23.48]}],
      x:-11.09,y:-28.8,w:22.18,h:25.6,
      thread:'#d9897e',stitch:'fill',fillMethod:'rows',blendPalette:['#d9897e','#e5b089','#d3ad61'],blendAngle:-100,border:true,borderThread:'#b5614f'},
    // Spiral-stitched center with its own ring border, so the eye lands on a round swirl rather than a flat dot.
    {id:'center',name:'Flower center',kind:'ellipse',x:-4.2,y:-20.2,w:8.4,h:8.4,thread:'#d3ad61',stitch:'fill',fillMethod:'spiral',underlayType:'center',border:true,borderThread:'#9c7a3a'},
    // Curved satin stem tapering from a wider base to a fine tip at the blossom: real tapered rails, not a thin running line.
    {id:'stem',name:'Stem',kind:'path',closed:false,smooth:false,
      points:[[2,24],[-3,10],[1,-3]],
      handles:[{i:[3.67,28.67],o:[0.33,19.33]},{i:[-2.67,19],o:[-3.33,1]},{i:[-0.33,1.33],o:[2.33,-7.33]}],
      x:-3,y:-3,w:5,h:27,
      thread:'#89a377',stitch:'satin',satinWidth:2.4,satinWidthEnd:.8,cap:'round'},
    // Pointed lanceolate leaf (Bézier again, not an ellipse) with a contour fill that reads as natural venation, plus a border.
    {id:'leaf',name:'Leaf',kind:'path',closed:true,smooth:true,
      points:[[-7,5],[-10.6,-6.45],[-27.35,-7.72],[-21.45,1.86]],
      handles:[{i:[-9.44,3.47],o:[-4.56,6.53]},{i:[-3.88,-2.25],o:[-17.32,-10.65]},{i:[-24.5,-5.94],o:[-30.2,-9.5]},{i:[-28.17,-2.34],o:[-14.73,6.06]}],
      x:-27.35,y:-7.72,w:20.35,h:12.72,
      thread:'#527461',stitch:'fill',fillMethod:'contour',border:true,borderThread:'#38503f'},
    // Cursive wordmark in a bundled script font (filled, not a mono running line), so the lettering reads as sewn calligraphy.
    {id:'letters',name:'Lettering',kind:'text',text:'Bloom',x:-13.45,y:33,w:26.9,h:11,thread:'#527461',stitch:'fill',fillMethod:'rows',font:'ttf/greatvibes'}
  ]};
}
