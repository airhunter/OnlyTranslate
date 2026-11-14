export interface SourceBlock { id: string; text: string; textIds: string[]; visible?: boolean; tag?: string }
export interface Snapshot { id: string; htmlHash?: string; url?: string; pageId?: string; assets?: {url:string;hash:string;type:string}[]; catalogue: { blocks: SourceBlock[] } }
export interface Decision { id?: string; blockId: string; snapshotId: string; textHash: string; verdict: string; note: string; confirmed: boolean; specification: number; reviewer: string; updatedAt: string }
export interface AcceptedIssue { id: string; pageId: string; snapshotId: string; blockId: string; decisionId: string; specification: number; expectedVerdict: string; htmlHash: string; textHash: string; acceptedSelectedTextIds: string[]; status: string; revision: number; reviewer: string; confirmedAt: string; reason: string }
export interface Run { snapshotId: string; targets: {textIds:string[]}[] }
export interface ComparedBlock extends SourceBlock { state:string; oldSelected:number; newSelected:number; added:string[]; removed:string[]; decision:Decision|null; violation:boolean; blockingViolation:boolean; acceptedIssue:AcceptedIssue|null; suspected:boolean }
export function hash(value: string | Uint8Array): string
export function readJson(path:string,fallback?:any):Promise<any>
export function validId(value:unknown):boolean
export function acceptedIssuesPath(decisionsDir:string):string
export function validateAcceptedIssues(document:unknown):AcceptedIssue[]
export function compare(snapshot:Snapshot,before:Run|null,after:Run|null,decisions?:Decision[],acceptedIssues?:AcceptedIssue[]):ComparedBlock[]
export function summarize(blocks:ComparedBlock[]):{added:number;removed:number;suspected:number;confirmed:number;violations:number;acceptedIssues:number;blockingViolations:number;totalBlocks:number}
export function validateDecision(input:{blockId:string;snapshotId:string;verdict:string;note:string},snapshot:Snapshot):Decision
export function writeJson(path:string,value:unknown):Promise<void>
