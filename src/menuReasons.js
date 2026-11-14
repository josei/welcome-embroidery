// @ts-check
// Why a Menu row is disabled. Each row names its own reason, so the phone and tablet Menu says what is missing:
// "Not a group" for Ungroup on a plain object, not the generic "Select an object first". The rules match the
// flags toolbarSync and the stitch panel set for the toolbar buttons, so a row is disabled exactly when it has a reason.
import {t} from './i18n.js';

/** The reasons that name a selection count. */
export const NEEDS_ONE = 'Select an object first';
export const NEEDS_TWO = 'Select two or more objects';
export const NEEDS_THREE = 'Select three or more objects';

/**
 * @typedef {{id?: string, kind?: string, groupId?: unknown, clipId?: unknown, mask?: unknown, along?: unknown, closed?: boolean, handles?: unknown[]}} ReasonObject
 * @typedef {{count: number, selNode: number | null, primary?: ReasonObject, top?: ReasonObject, picked: ReasonObject[]}} ReasonContext
 */

/**
 * The reason a row with this id is unavailable in this selection, or undefined when it is available.
 * @param {string} id the menu row's id
 * @param {ReasonContext} ctx the selection: how many objects, the primary object, the top-most selected object, the selected node, and every selected object
 * @returns {string | undefined}
 */
export function menuReason(id, ctx) {
  const {count, selNode, primary, top, picked} = ctx;
  const path = primary?.kind === 'path';
  switch (id) {
    case 'menuGroup':
      return count < 2 ? t(NEEDS_TWO) : undefined;
    case 'menuUngroup':
      if (count < 1) return t(NEEDS_ONE);
      return picked.some(o => o.groupId) ? undefined : t('Not a group');
    case 'menuClip':
      if (count < 2) return t(NEEDS_TWO);
      // The top object is the mask: it must be a rectangle, an ellipse or a closed path.
      return top && (top.kind === 'rect' || top.kind === 'ellipse' || (top.kind === 'path' && top.closed))
        ? undefined : t('The top object must be a rectangle, ellipse or closed path');
    case 'menuUnclip':
      if (count < 1) return t(NEEDS_ONE);
      return picked.some(o => o.clipId || o.mask) ? undefined : t('Not clipped');
    case 'menuTextOnPath':
      return count === 2 && picked.some(o => o.kind === 'text') && picked.some(o => o.kind === 'path')
        ? undefined : t('Select one text and one path');
    case 'menuTextOffPath':
      if (count < 1) return t(NEEDS_ONE);
      return picked.some(o => o.along) ? undefined : t('Not text on a path');
    case 'menuEditNodes':
      if (count < 1) return t(NEEDS_ONE);
      if (count > 1) return t('Select one object to edit its nodes');
      return primary?.kind === 'stitch_layer' ? t('Stitch layers have no nodes') : undefined;
    case 'menuNodeAdd':
      if (count < 1) return t(NEEDS_ONE);
      return path ? undefined : t('Not a path');
    case 'menuNodeDelete':
    case 'menuNodeSmooth':
      if (count < 1) return t(NEEDS_ONE);
      if (!path) return t('Not a path');
      return selNode === null ? t('Select a node first') : undefined;
    case 'menuNodeCorner':
      if (count < 1) return t(NEEDS_ONE);
      if (!path) return t('Not a path');
      if (selNode === null) return t('Select a node first');
      return primary?.handles?.[selNode] ? undefined : t('This node is already a corner');
    default:
      return undefined;
  }
}
