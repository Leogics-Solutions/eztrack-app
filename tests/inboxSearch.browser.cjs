// Offline page test: no real API, SQL or channel messages.
const fs=require('node:fs'),path=require('node:path');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const root=path.resolve(__dirname,'..'),out=path.resolve(root,'../output/inbox-search-20261007/browser');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'loader.cjs'),`module.exports=function(s){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(s,{compilerOptions:{jsx:4,module:99,target:7}}).outputText}`);
fs.writeFileSync(path.join(out,'layout.js'),`import React from 'react';export function AppLayout(p){return <main>{p.children}</main>}export function CaptureShell(p){return <div>{p.children}</div>}`);
fs.writeFileSync(path.join(out,'org.js'),`export function useOrganization(){return {selectedOrganizationId:66,isLoading:false}}`);
fs.writeFileSync(path.join(out,'router.js'),`const router={isReady:true,query:{workflow:'payment_knock_off'},replace(){},push(){}};export function useRouter(){return router}`);
fs.writeFileSync(path.join(out,'link.js'),`import React from 'react';export default function Link(p){return <a {...p}>{p.children}</a>}`);
fs.writeFileSync(path.join(out,'agents.js'),`export async function reanalyzeRun(){}export async function retryRunDelivery(){}`);
fs.writeFileSync(path.join(out,'api.js'),`
export async function updateCaptureEventDecision(){}export async function updateCaptureEventsBulkDecision(){}
export function listCaptureWorkInbox(params){
 const call={search:params.search,aborted:false};window.fixture.calls.push(call);
 return new Promise((resolve,reject)=>{
  const stop=()=>{call.aborted=true;clearTimeout(timer);reject(new DOMException('Aborted','AbortError'))};
  const timer=setTimeout(()=>{
   params.signal?.removeEventListener('abort',stop);
   if(window.fixture.fail){reject(new Error('Fixture network error'));return}
   const id=Number(params.search)||1553;
   const items=[{id:'review-'+id,stage:'TO_REVIEW',status:'PENDING_REVIEW',status_label:'Needs Review',
    source_type:'WECHAT',title:'Fixture payment '+id,preview:'Offline search test',filenames:[],
    payment_category:'CONFIRM_RECEIVED',payment_flags:[],capture_event_id:id,review_run_ids:[id],
    result_type:'agent_run',result_id:id,review_url:'/review/'+id,workflow_key:'payment_knock_off',
    workflow_name:'Payment Knock Off',received_at:'2026-10-07T09:00:00Z',updated_at:'2026-10-07T09:00:00Z'}];
   resolve({items,total:1,page:1,page_size:30,counts:{all:1,to_review:1,in_progress:0,completed:0},workflow_counts:{all:1,payment_knock_off:1,order_to_invoice:0,other:0}});
  },window.fixture.delays[params.search]??30);
  if(params.signal?.aborted)stop();else params.signal?.addEventListener('abort',stop,{once:true});
 });
}
`);
fs.writeFileSync(path.join(out,'entry.tsx'),`
import React from 'react';import {createRoot} from 'react-dom/client';import Page from ${JSON.stringify(path.join(root,'pages/capture/index'))};
window.fixture={calls:[],delays:{},fail:false};createRoot(document.getElementById('app')).render(<Page/>);
`);
webpack({mode:'development',target:'web',devtool:false,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},
resolve:{extensions:['.js','.tsx','.ts'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{
 '@/services/CaptureService$':path.join(out,'api.js'),'@/services/AgentsService$':path.join(out,'agents.js'),
 '@/components/layout$':path.join(out,'layout.js'),'@/components/capture/CaptureShell$':path.join(out,'layout.js'),
 '@/lib/OrganizationContext$':path.join(out,'org.js'),'next/router$':path.join(out,'router.js'),'next/link$':path.join(out,'link.js'),'@':root}},
module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(out,'loader.cjs')},{test:/layout.js$|link.js$/,use:path.join(out,'loader.cjs')}]}
},(error,stats)=>{if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1}else console.log('Offline Inbox search page bundle ready')});
