import {createStore} from './store.js';

/**
 * The reference picture's position, size, opacity and switches, as the panel shows them.
 * referencePicture.ts sets them from the picture; ReferencePicture.tsx and ReferenceLayer.tsx read them.
 */
export interface ReferenceFields {
  refX: string;
  refY: string;
  refW: string;
  refH: string;
  refVisible: boolean;
  refLocked: boolean;
  /** The picture's opacity, 0.05 to 1. The slider previews it here before the edit is committed. */
  refOpacity: number;
  /** Whether the Reference image section is folded open. */
  refOpen: boolean;
}

export const referenceFieldsState = createStore<ReferenceFields>({
  refX: '',
  refY: '',
  refW: '',
  refH: '',
  refVisible: true,
  refLocked: false,
  refOpacity: 0.5,
  refOpen: false,
});

/** Changes some of the reference picture fields. */
export function setReferenceFields(patch: Partial<ReferenceFields>) {
  referenceFieldsState.set({...referenceFieldsState.get(), ...patch});
}
