// WebGL2 thread preview: every needle-to-needle segment is an instanced ribbon shaded as a lit, slightly twisted cylinder
// (diffuse + Kajiya-Kay sheen along the thread), stacked by sewing order so later stitches ride over earlier ones, with
// soft thread shadows on a fabric plane whose texture follows the fabric (woven, knit, towel, denim). Orbit by dragging the fabric (drag right to turn it right, drag down to look more from above), zoom with the wheel, double-click to reset.
// Views: front three-quarter (the default), a close-up of the design, and a turntable that spins; a loupe magnifies the pixels under the pointer.
const VERT=`#version 300 es
precision highp float;
layout(location=0) in vec2 a_corner;      // x: 0/1 along the segment, y: -1/1 across it
layout(location=1) in vec4 a_seg;          // p0.xy, p1.xy (mm)
layout(location=2) in vec4 a_color;        // rgb, sequence 0..1
uniform mat4 u_vp;uniform float u_width;uniform float u_lift;uniform vec2 u_shadow;
out vec2 v_across;out vec3 v_color;out vec2 v_dir;out float v_len;out float v_pos;out vec3 v_world;
void main(){
  vec2 d=a_seg.zw-a_seg.xy;float len=max(length(d),1e-4);vec2 dir=d/len,n=vec2(-dir.y,dir.x);
  float w=u_width*(u_shadow.x>0.?1.5:1.);
  vec2 p=mix(a_seg.xy,a_seg.zw,a_corner.x)+n*a_corner.y*w*.5+dir*(a_corner.x*2.-1.)*w*.42+u_shadow;
  float z=u_shadow.x>0.?0.:u_lift*a_color.a+w*.18;
  v_across=vec2(a_corner.y,a_corner.x);v_color=a_color.rgb;v_dir=dir;v_len=len;v_pos=a_corner.x*len;v_world=vec3(p,z);
  gl_Position=u_vp*vec4(p,z,1.);
}`;
const FRAG=`#version 300 es
precision highp float;
in vec2 v_across;in vec3 v_color;in vec2 v_dir;in float v_len;in float v_pos;in vec3 v_world;
uniform float u_shadowPass;uniform vec3 u_eye;uniform vec3 u_light;uniform float u_alpha;
out vec4 o;
void main(){
  float s=v_across.x;float edge=1.-smoothstep(.9,1.,abs(s));
  if(u_shadowPass>.5){o=vec4(0.,0.,0.,.22*edge);return;}
  float h=sqrt(max(1.-s*s,0.));
  vec2 nn=vec2(-v_dir.y,v_dir.x);vec3 N=normalize(vec3(nn*s*.9,h+.15));
  float twist=sin(v_pos*7.5+s*2.2)*.5+.5;N=normalize(N+vec3(v_dir*(twist-.5)*.18,0.));
  vec3 L=normalize(u_light),V=normalize(u_eye-v_world),H=normalize(L+V);
  float diff=max(dot(N,L),0.);
  vec3 T=normalize(vec3(v_dir,0.));float th=dot(T,H),spec=pow(sqrt(max(1.-th*th,0.)),60.)*.32+pow(sqrt(max(1.-th*th,0.)),10.)*.05;
  float ao=mix(.62,1.,smoothstep(0.,.5,min(v_pos,v_len-v_pos)))*mix(.7,1.,h);
  float fiber=.93+.07*sin(v_pos*38.+s*5.);
  vec3 c=v_color*(.24+.78*diff)*ao*fiber+vec3(1.,.97,.9)*spec*mix(.5,1.,diff);
  o=vec4(c,edge*u_alpha);
}`;
const FABRIC_VERT=`#version 300 es
precision highp float;layout(location=0) in vec2 a_corner;uniform mat4 u_vp;uniform vec4 u_rect;out vec2 v_mm;
void main(){vec2 p=u_rect.xy+a_corner*u_rect.zw;v_mm=p;gl_Position=u_vp*vec4(p,0.,1.);}`;
const FABRIC_FRAG=`#version 300 es
precision highp float;in vec2 v_mm;uniform vec4 u_rect;uniform sampler2D u_pull;uniform sampler2D u_pullDir;uniform vec4 u_pullRect;uniform float u_pullOn;uniform float u_fabric;out vec4 o;
void main(){
  vec2 q=v_mm/.62;float warp=.5+.5*sin(q.x*6.2831),weft=.5+.5*sin(q.y*6.2831);float over=step(.5,fract((floor(q.x)+floor(q.y))*.5));
  float weave=mix(warp*.55+.45,weft*.55+.45,over);float grain=fract(sin(dot(floor(q*3.),vec2(12.9898,78.233)))*43758.5453);
  vec3 base=vec3(.945,.925,.875)*(.86+.14*weave)*(.97+.03*grain);
  if(u_fabric>.5){
    if(u_fabric<1.5){
      vec2 k=v_mm/.5;float row=sin(3.14159*fract(k.y)),ridge=abs(sin(3.14159*k.x));
      base=vec3(.93,.92,.91)*(.8+.12*row+.08*ridge)*(.97+.03*grain);
    }
    else if(u_fabric<2.5){
      vec2 t=v_mm/.9;t.x+=.5*mod(floor(t.y),2.);vec2 c=fract(t)-.5;
      float loop=1.-smoothstep(.15,.5,length(c));base=vec3(.96,.94,.9)*(.8+.2*loop)*(.97+.03*grain);
    }
    else{float tw=fract((v_mm.x+v_mm.y)/.42);float diag=smoothstep(0.,.5,tw)*(1.-smoothstep(.5,1.,tw));base=vec3(.33,.42,.58)*(.8+.2*diag)*(.97+.03*grain);}
  }
  vec2 e=min(v_mm-u_rect.xy,u_rect.xy+u_rect.zw-v_mm);float rim=smoothstep(0.,3.,min(e.x,e.y));vec2 uv=(v_mm-u_pullRect.xy)/u_pullRect.zw;if(u_pullOn>.5&&all(greaterThanEqual(uv,vec2(0.)))&&all(lessThanEqual(uv,vec2(1.)))){vec4 d=texture(u_pull,uv);vec2 dir=texture(u_pullDir,uv).rg*2.-1.;float lines=.5+.5*sin(dot(v_mm,vec2(-dir.y,dir.x))*6.2832/.8);base=mix(base,d.rgb,d.a);base*=mix(1.,.8+.2*lines,d.a);}o=vec4(base*mix(.88,1.,rim),1.);
}`;
// Fabric textures by index: the shader branches on it, woven (0) keeps the plain weave.
const FABRIC_INDEX={woven:0,knit:1,towel:2,denim:3};
const LOUPE=150,LOUPE_ZOOM=8,LOUPE_PX=300,SPIN_STEP=.008;
const hex=c=>{const m=/^#?([0-9a-f]{6})$/i.exec(c||'');const v=m?parseInt(m[1],16):0x527461;return [(v>>16&255)/255,(v>>8&255)/255,(v&255)/255];};
const mul=(a,b)=>{const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let s=0;for(let k=0;k<4;k++)s+=a[k*4+r]*b[c*4+k];o[c*4+r]=s;}return o;};
function compile(gl,type,src){const sh=gl.createShader(type);gl.shaderSource(sh,src);gl.compileShader(sh);if(!gl.getShaderParameter(sh,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(sh));return sh;}
function program(gl,v,f){const p=gl.createProgram();gl.attachShader(p,compile(gl,gl.VERTEX_SHADER,v));gl.attachShader(p,compile(gl,gl.FRAGMENT_SHADER,f));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(p));return p;}

export function createThreadPreview(canvas){
  let gl;try{gl=canvas.getContext('webgl2',{antialias:true,alpha:false,preserveDrawingBuffer:true});}catch{}
  if(!gl)return {available:false};
  let threadProg,fabricProg;try{threadProg=program(gl,VERT,FRAG);fabricProg=program(gl,FABRIC_VERT,FABRIC_FRAG);}catch(error){console.warn('Thread preview disabled:',error.message);return {available:false};}
  const quad=new Float32Array([0,-1,1,-1,0,1,1,1]),quadBuf=gl.createBuffer(),instBuf=gl.createBuffer(),fabBuf=gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);gl.bufferData(gl.ARRAY_BUFFER,quad,gl.STATIC_DRAW);gl.bindBuffer(gl.ARRAY_BUFFER,fabBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,1,1]),gl.STATIC_DRAW);
  const vao=gl.createVertexArray();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,quadBuf);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  gl.bindBuffer(gl.ARRAY_BUFFER,instBuf);for(const [loc,off] of [[1,0],[2,16]]){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,4,gl.FLOAT,false,32,off);gl.vertexAttribDivisor(loc,1);}
  const fabVao=gl.createVertexArray();gl.bindVertexArray(fabVao);gl.bindBuffer(gl.ARRAY_BUFFER,fabBuf);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  const U=(p,n)=>gl.getUniformLocation(p,n),u={vp:U(threadProg,'u_vp'),width:U(threadProg,'u_width'),lift:U(threadProg,'u_lift'),shadow:U(threadProg,'u_shadow'),shadowPass:U(threadProg,'u_shadowPass'),light:U(threadProg,'u_light'),eye:U(threadProg,'u_eye'),fvp:U(fabricProg,'u_vp'),frect:U(fabricProg,'u_rect')};
  const ffabric=U(fabricProg,'u_fabric'),fpull=U(fabricProg,'u_pull'),fpullRect=U(fabricProg,'u_pullRect'),fpullOn=U(fabricProg,'u_pullOn'),fpullDir=U(fabricProg,'u_pullDir'),talpha=U(threadProg,'u_alpha');
  let count=0,shown=-1,segEnd=[],hoop={w:110,h:110},extent=120,yaw=0,tilt=.95,zoom=1,visible=false,raf=0;
  let view='front',spin=false,design={cx:0,cy:0,size:110},fabricKey='woven',loupeOn=false,hover=null,loupeCanvas=null;
  const reset=()=>{yaw=0;tilt=.95;zoom=1;};
  let camDist=200;
  let pullOn=false,pullRect=[0,0,1,1],pullTex=gl.createTexture(),pullDirTex=gl.createTexture();
  function matrix(aspect){
    // perspective camera orbiting its target: yaw around Z, tilt around X. Front and turntable orbit the hoop centre with a 34° lens;
    // the close-up orbits the design's centre, fitted to the design with a 48° lens, so the perspective is stronger
    const close=view==='close',FOV=(close?48:34)*Math.PI/180,f=1/Math.tan(FOV/2);
    const r=(close?design.size:Math.max(hoop.w,hoop.h))*.58/zoom,cy=Math.cos(yaw),sy=Math.sin(yaw),ct=Math.cos(tilt),st=Math.sin(tilt);
    const [tx,ty]=target();
    const D=camDist=f*r*(aspect>=1?1:1/aspect),near=D*.08,far=D*4;
    const rz=new Float32Array([cy,sy,0,0,-sy,cy,0,0,0,0,1,0,0,0,0,1]),rx=new Float32Array([1,0,0,0,0,ct,st,0,0,-st,ct,0,0,0,0,1]),back=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,-D,1]);
    const proj=new Float32Array([f/aspect,0,0,0,0,-f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]),shift=new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,-tx,-ty,0,1]);
    return mul(proj,mul(back,mul(rx,mul(rz,shift))));
  }
  function target(){return view==='close'?[design.cx,design.cy]:[0,0];}
  // The loupe copies the pixels under the pointer, enlarged, so it shows the frame the view is drawing.
  function showLoupe(){
    if(!loupeOn||!hover||drag||!visible){hideLoupe();return;}
    if(!loupeCanvas){
      loupeCanvas=document.createElement('canvas');loupeCanvas.id='preview3dLoupe';loupeCanvas.width=loupeCanvas.height=LOUPE_PX;
      loupeCanvas.hidden=true;document.body.append(loupeCanvas);
    }
    const r=canvas.getBoundingClientRect(),k=canvas.width/r.width,src=LOUPE/LOUPE_ZOOM*k;
    const cx=(hover.x-r.left)*k,cy=(hover.y-r.top)*k,ctx=loupeCanvas.getContext('2d');
    ctx.imageSmoothingEnabled=false;ctx.drawImage(canvas,cx-src/2,cy-src/2,src,src,0,0,LOUPE_PX,LOUPE_PX);
    loupeCanvas.style.left=`${hover.x+16}px`;loupeCanvas.style.top=`${hover.y+16}px`;loupeCanvas.hidden=false;
  }
  function hideLoupe(){if(loupeCanvas)loupeCanvas.hidden=true;}
  function draw(){
    raf=0;if(!visible)return;if(spin){if(!drag)yaw+=SPIN_STEP;raf=requestAnimationFrame(draw);}const dpr=Math.min(2,devicePixelRatio||1),w=Math.max(2,Math.round(canvas.clientWidth*dpr)),h=Math.max(2,Math.round(canvas.clientHeight*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
    gl.viewport(0,0,w,h);gl.clearColor(.906,.914,.894,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const vp=matrix(w/h);
    gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);gl.useProgram(fabricProg);gl.bindVertexArray(fabVao);gl.uniformMatrix4fv(u.fvp,false,vp);gl.uniform4f(u.frect,-hoop.w/2-3,-hoop.h/2-3,hoop.w+6,hoop.h+6);gl.uniform1f(ffabric,FABRIC_INDEX[fabricKey]);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,pullTex);gl.uniform1i(fpull,0);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,pullDirTex);gl.uniform1i(fpullDir,1);gl.activeTexture(gl.TEXTURE0);gl.uniform4f(fpullRect,pullRect[0],pullRect[1],pullRect[2],pullRect[3]);gl.uniform1f(fpullOn,pullOn?1:0);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
    const drawn=shown<0?count:Math.min(shown,count);if(!drawn)return;gl.useProgram(threadProg);gl.bindVertexArray(vao);gl.uniformMatrix4fv(u.vp,false,vp);gl.uniform1f(u.width,.5);gl.uniform1f(u.lift,.9);gl.uniform1f(talpha,pullOn?.5:1);{const [tx,ty]=target();gl.uniform3f(u.eye,tx+Math.sin(yaw)*Math.sin(tilt)*camDist,ty+Math.cos(yaw)*Math.sin(tilt)*camDist,Math.cos(tilt)*camDist);}{const lx=-.35,ly=-.45,c=Math.cos(yaw),sn=Math.sin(yaw);gl.uniform3f(u.light,c*lx+sn*ly,-sn*lx+c*ly,.82);}
    gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false);gl.uniform1f(u.shadowPass,1);gl.uniform2f(u.shadow,.14,.2);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,drawn);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.uniform1f(u.shadowPass,0);gl.uniform2f(u.shadow,0,0);gl.drawArraysInstanced(gl.TRIANGLE_STRIP,0,4,drawn);
    canvas.dataset.pull=pullOn?'on':'off';canvas.dataset.instances=String(count);canvas.dataset.yaw=yaw.toFixed(3);canvas.dataset.tilt=tilt.toFixed(3);canvas.dataset.zoom=zoom.toFixed(3);canvas.dataset.view=view;canvas.dataset.fabric=fabricKey;canvas.dataset.loupe=loupeOn?'on':'off';showLoupe();
  }
  const schedule=()=>{if(!raf&&visible)raf=requestAnimationFrame(draw);};
  let drag=null;
  canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY,id:e.pointerId};canvas.setPointerCapture?.(e.pointerId);hideLoupe();});
  canvas.addEventListener('pointermove',e=>{if(!drag||e.pointerId!==drag.id){hover={x:e.clientX,y:e.clientY};showLoupe();return;}yaw-=(e.clientX-drag.x)*.008;tilt=Math.max(0,Math.min(1.3,tilt-(e.clientY-drag.y)*.006));drag.x=e.clientX;drag.y=e.clientY;schedule();});
  const end=e=>{if(drag&&e.pointerId===drag.id)drag=null;};canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);canvas.addEventListener('pointerleave',()=>{hover=null;hideLoupe();});
  canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.5,Math.min(8,zoom*Math.exp(-e.deltaY*.0015)));schedule();},{passive:false});
  canvas.addEventListener('dblclick',()=>{reset();schedule();});
  new ResizeObserver(schedule).observe(canvas);
  return {
    available:true,
    setPlan(plan,hoopSize){
      hoop=hoopSize;const segs=[];let last=null,color=plan.colors?.[0]||'#527461',n=plan.stitches.length;
      segEnd=new Array(n);for(let i=0;i<n;i++){segEnd[i]=segs.length/8;const s=plan.stitches[i];if(s.cmd==='color'){color=s.thread||color;last=[s.x,s.y];continue;}if(s.cmd==='jump'){last=[s.x,s.y];continue;}if(s.cmd==='trim'||s.cmd==='end'){last=null;continue;}if(s.cmd!=='stitch')continue;if(last&&(last[0]!==s.x||last[1]!==s.y)){const [r,g,b]=hex(s.thread||color);segs.push(last[0],last[1],s.x,s.y,r,g,b,i/Math.max(1,n));}last=[s.x,s.y];}
      let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(let i=0;i<segs.length;i+=8){
        x0=Math.min(x0,segs[i],segs[i+2]);y0=Math.min(y0,segs[i+1],segs[i+3]);
        x1=Math.max(x1,segs[i],segs[i+2]);y1=Math.max(y1,segs[i+1],segs[i+3]);
      }
      design=x0<Infinity?{cx:(x0+x1)/2,cy:(y0+y1)/2,size:Math.max(x1-x0,y1-y0,10)}:{cx:0,cy:0,size:Math.max(hoopSize.w,hoopSize.h)};
      segEnd.push(segs.length/8);count=segs.length/8;gl.bindBuffer(gl.ARRAY_BUFFER,instBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(segs),gl.STATIC_DRAW);schedule();
    },
    setLimit(idx){const v=idx==null?-1:(idx<=0?0:(segEnd[Math.min(idx,segEnd.length-1)]??count));if(v!==shown){shown=v;schedule();}},
    show(on){visible=on;canvas.hidden=!on;if(!on)hideLoupe();if(on)schedule();},
    // Changing the view resets the camera to that view's start; the turntable keeps the angle it is at.
    setView(next){if(next===view)return;view=next;spin=next==='turntable';yaw=spin?yaw:0;tilt=.95;zoom=1;schedule();},
    setLoupe(on){if(on===loupeOn)return;loupeOn=on;if(!on){hover=null;hideLoupe();}else showLoupe();schedule();},
    setFabric(key){const next=key in FABRIC_INDEX?key:'woven';if(next===fabricKey)return;fabricKey=next;schedule();},
    setPull(grid){
      pullOn=Boolean(grid);
      if(grid){const data=new Uint8Array(grid.cols*grid.rows*4);for(let i=0;i<grid.values.length;i++){const f=grid.values[i],k=i*4;data[k]=Math.round(255*(1-f)+196*f);data[k+1]=Math.round(236*(1-f)+36*f);data[k+2]=Math.round(160*(1-f)+28*f);data[k+3]=Math.round(255*.9*f);}
        gl.bindTexture(gl.TEXTURE_2D,pullTex);gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,grid.cols,grid.rows,0,gl.RGBA,gl.UNSIGNED_BYTE,data);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        const dirData=new Uint8Array(grid.cols*grid.rows*4);for(let i=0;i<grid.cols*grid.rows;i++){const k=i*4;dirData[k]=Math.round((grid.dirs[i*2]*.5+.5)*255);dirData[k+1]=Math.round((grid.dirs[i*2+1]*.5+.5)*255);dirData[k+3]=255;}
        gl.bindTexture(gl.TEXTURE_2D,pullDirTex);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,grid.cols,grid.rows,0,gl.RGBA,gl.UNSIGNED_BYTE,dirData);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        pullRect=[grid.x0,grid.y0,grid.cols*grid.cell,grid.rows*grid.cell];}
      schedule();
    },
    reset(){reset();schedule();},
  };
}
