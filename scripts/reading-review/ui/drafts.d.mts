export interface Draft { blockId:string; snapshotId:string; verdict:string; note:string; expectedDecisionId:string|null }
export type Drafts = Record<string,Record<string,Draft>>
export const STORAGE_KEY:string
export function scopeKey(pageId:string,snapshotId:string):string
export function readDrafts(storage:Pick<Storage,'getItem'>):Drafts
export function groupDrafts(drafts:Drafts,pageId:string,snapshotId:string):Record<string,Draft>
export function editDraft(drafts:Drafts,pageId:string,snapshotId:string,block:{id:string;decision?:{id?:string;verdict:string;note:string}|null},verdict:string,note:string):Drafts
export function clearSubmitted(drafts:Drafts,pageId:string,snapshotId:string,submitted:Draft[],saved?:{blockId:string;id:string}[]):Drafts
