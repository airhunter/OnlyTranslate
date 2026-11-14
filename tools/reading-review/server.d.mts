import type { Server } from 'node:http'
export function startServer(options?:{root?:string;port?:number;dataRoot?:string;paths?:Record<string,string>}):Promise<{server:Server;base:string;paths:Record<string,string>;close:()=>Promise<void>}>
