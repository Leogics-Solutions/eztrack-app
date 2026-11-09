import { BASE_URL } from './config';
import { getScopedHeaders, getScopedHeadersForFormData, getSelectedOrganizationId } from './apiHelpers';

export type IssueState = 'OPEN'|'INVESTIGATING'|'WAITING_STAFF'|'WAITING_VENDOR'|'RESOLVED'|'CLOSED';
export interface SupportIssue {
  id:string; reporter_id:number|null; title:string; description:string; workflow:string; kind:string; priority:string; status:IssueState;
  review_id:number|null; source_reference:string|null; resolution:string|null; resolution_evidence:string|null; root_cause:string|null;
  version:number; created_at:string; updated_at:string; resolved_at:string|null; can_manage:boolean;
  diagnostic?:{method:string;finding:string;next_action:string;financial_action:false};
  events?:{id:number;actor_id:number|null;action:string;content:string;details:Record<string,unknown>|null;created_at:string}[];
  events_truncated?:boolean;
  attachments?:{id:string;filename:string;content_type:string;sha256:string;size:number}[];
}
export interface SupportList {items:SupportIssue[];total:number;can_manage:boolean;user_id:number}
export interface SupportMetrics {total:number;by_status:Record<string,number>;resolved_cause_counts:Record<string,number>;accuracy_note:string;accuracy_rate:null}

async function call<T>(org:number,path:string,options:RequestInit={}):Promise<T> {
  if(getSelectedOrganizationId()!==org)throw new Error('Company changed. Refresh this report.');
  const response=await fetch(`${BASE_URL}/support-issues${path}`,{...options,headers:options.body instanceof FormData?getScopedHeadersForFormData():getScopedHeaders()});
  if(getSelectedOrganizationId()!==org)throw new Error('Company changed. The response was discarded.');
  if(!response.ok){const e=await response.json().catch(()=>({}));throw new Error(typeof e.detail==='string'?e.detail:`Support request failed (${response.status}).`);}
  return response.json() as Promise<T>;
}
export const listSupport=(org:number,query:string)=>call<SupportList>(org,query);
export const supportMetrics=(org:number)=>call<SupportMetrics>(org,'/metrics');
export const supportDetail=(org:number,id:string)=>call<SupportIssue>(org,`/${encodeURIComponent(id)}`);
export const createSupport=(org:number,data:Record<string,unknown>)=>call<SupportIssue>(org,'',{method:'POST',body:JSON.stringify(data)});
export const updateSupport=(org:number,id:string,data:Record<string,unknown>)=>call<SupportIssue>(org,`/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(data)});
export const commentSupport=(org:number,id:string,content:string)=>call<SupportIssue>(org,`/${encodeURIComponent(id)}/comments`,{method:'POST',body:JSON.stringify({content})});
export function uploadSupport(org:number,id:string,file:File){const body=new FormData();body.append('file',file);return call<SupportIssue>(org,`/${encodeURIComponent(id)}/attachments`,{method:'POST',body});}
export async function downloadSupport(org:number,id:string,attachment:{id:string;filename:string}){
  if(getSelectedOrganizationId()!==org)throw new Error('Company changed.');
  const r=await fetch(`${BASE_URL}/support-issues/${encodeURIComponent(id)}/attachments/${encodeURIComponent(attachment.id)}`,{headers:getScopedHeadersForFormData()});
  if(!r.ok)throw new Error('Evidence download failed.');
  if(getSelectedOrganizationId()!==org)throw new Error('Company changed.');
  const blob=await r.blob();const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=attachment.filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
