import {getScopedHeaders} from './apiHelpers';
import {BASE_URL} from './config';
export type FormatProposal={id:string;message:string;explanation:string;changes:Array<{section:string;source:string;property:string;value:number|string}>;preview_hash?:string;preview_run_id?:number;applied_version?:number};
export type FormatTemplate={id:number;title:string;entity:string;document_type:string;variant:string;version:number;hash:string;history:Array<{version:number;at:string;actor_id:number;reason:string}>;proposals:FormatProposal[]};
export async function studio<T>(path='',body?:unknown,method?:string):Promise<T>{
  const response=await fetch(`${BASE_URL}/template-studio${path}`,{method:method||(body?'POST':'GET'),headers:{...getScopedHeaders(),'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(typeof value.detail==='string'?value.detail:'请求未完成，请刷新后再试。');}
  return response.json();
}
export async function studioPreview(source:number,proposal:string):Promise<Blob>{
  const response=await fetch(`${BASE_URL}/template-studio/${source}/proposals/${proposal}/preview`,{headers:getScopedHeaders()});
  if(!response.ok){const value=await response.json().catch(()=>({}));throw new Error(value.detail||'PDF 预览不可用。');}
  return response.blob();
}
