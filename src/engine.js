// Deterministic stitch compiler and JEF/VP3 serializers. Document units are mm.
import {getFont,isRegistryFont,registerDocumentFonts} from './fonts.js';
import {bundledFontUsage,customFontUsage,measureText} from './fontHelpers.js';
export {bundledFontUsage,customFontUsage,measureText};
import {planPhoto,planContour,sampleRun,sampleLine} from './stitchplan.js';
import {FABRIC_PROFILES,FABRIC_PRESETS,DISTORTION_SCALE,distortionGrid} from './fabrics.js';
import {GLYPHS,parseSvgPath} from './lettering.js';
import {geometry,textPrimitives,cornerRadii} from './outlines.js';
import {pathDirs,motifLoops,motifPairLoops,sequinRuns,beadRuns,blingRuns} from './embellishments.js';
import {objectBounds} from './transforms.js';
import {HOOP_PRESETS,hoopSize,hoopLabel} from './hoops.js';
import {designWarnings,shapeArea,TIP_CATEGORIES,visibleTips} from './designChecks.js';
import {clipLines} from './clipMasks.js';
import {sameThread,parseThreadStock,nearestStockThread} from './threads.js';
export {parseThreadStock,nearestStockThread};
export {designWarnings,shapeArea,TIP_CATEGORIES,visibleTips};
import {svgPathFill} from './svgImport.js';
export {svgPathFill};
import {closeRing,clipRuns,satinFromRails,bartack} from './stitchRuns.js';
import {makeStitchLayer,importStitchLayer,decodeBase64} from './stitchImport.js';
import {fillRuns,satinRuns} from './fillStitch.js';
import {compile} from './compile.js';
export {compile};
export {makeStitchLayer,importStitchLayer};
export {satinFromRails};
import {exportSvg,exportPrintTemplate,exportAppliqueTemplates,jefWarnings} from './exports.js';
export {exportSvg,exportPrintTemplate,exportAppliqueTemplates,jefWarnings};
import {measureBetween} from './measure.js';
export {measureBetween};
import {applyOperations} from './operations.js';
export {applyOperations};
import {validateDocument} from './validate.js';
export {validateDocument};
import {sewingWorksheet} from './worksheet.js';
export {sewingWorksheet};
import {initialDocument,batchPlan,batchDocuments} from './document.js';
export {initialDocument,batchPlan,batchDocuments};
import {isClosedShape} from './shapeOps.js';
import {countSmallHoles,isSmallIsland} from './cleanup.js';
export {isClosedShape,countSmallHoles,isSmallIsland};
export {HOOP_PRESETS,hoopSize,hoopLabel};
export {textPrimitives,cornerRadii};
import {distP,railsFromLine,railsFromCenterline,widthAt} from './pathGeometry.js';
import {nodeFraction} from './editOps.js';
export {nodeFraction};
export {FABRIC_PROFILES,FABRIC_PRESETS,DISTORTION_SCALE,distortionGrid};
export {parseSvgPath};
export {railsFromLine,widthAt};
import {threadPlan,blockSeconds,blockTimeLabel,sewingSeconds,threadSpans,sewingSecondsUpTo} from './sewingTime.js';
import {encodeJef,encodeVp3,encodePec,encodePes,encodePesV6,encodeSew,encodeTbf,encodeXxx,encodeU01,encodeExp,encodeDst,encodeCol,encodeEdr,encode} from './encoders.js';
export {encodeJef,encodeVp3,encodePec,encodePes,encodePesV6,encodeSew,encodeTbf,encodeXxx,encodeU01,encodeExp,encodeDst,encodeCol,encodeEdr,encode};
export {threadPlan,blockSeconds,blockTimeLabel,sewingSeconds,threadSpans,sewingSecondsUpTo};



function polygonFill(rings,spacing,angle) {
  // Evenly spaced parallel rows with even/odd polygon clipping; each row becomes a boustrophedon path.
  const rad=angle*Math.PI/180,c=Math.cos(rad),s=Math.sin(rad),rotRings=rings.map(r=>r.map(([x,y])=>[x*c+y*s,-x*s+y*c])),rot=rotRings.flat();
  const minY=Math.min(...rot.map(p=>p[1])),maxY=Math.max(...rot.map(p=>p[1])),lines=[];
  // One direction per row: every other row runs right-to-left with its pieces visited in reverse, so the needle always leaves a
  // piece at the edge nearest the next one (a hole edge in the middle of a row, the outer edge between rows).
  const un=p=>[p[0]*c-p[1]*s,p[0]*s+p[1]*c];let reverse=false;
  for(let y=minY+spacing/2;y<maxY;y+=spacing){const xs=[];for(const ring of rotRings)for(let i=0;i<ring.length-1;i++){const [x1,y1]=ring[i],[x2,y2]=ring[i+1];if((y1<=y&&y2>y)||(y2<=y&&y1>y))xs.push(x1+(y-y1)*(x2-x1)/(y2-y1));}xs.sort((a,b)=>a-b);
    const row=[];for(let i=0;i+1<xs.length;i+=2)row.push([[xs[i],y],[xs[i+1],y]]);if(reverse){row.reverse();for(const seg of row)seg.reverse();}for(const [a,b] of row)lines.push([un(a),un(b)]);if(row.length)reverse=!reverse;}
  return lines;
}

export {geometry,objectBounds};




