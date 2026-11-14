export function saveCapturedSnapshot(paths:Record<string,string>,pageInfo:{id:string;url:string;focus?:string},captured:any,screenshot:string):Promise<any>
export function saveBaselineRun(folder:string,result:Record<string,unknown>,captureArtifacts:()=>Promise<void>):Promise<void>
