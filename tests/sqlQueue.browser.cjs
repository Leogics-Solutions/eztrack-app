// Offline component bundle: no server, live API, accounting or message sends.
const fs = require('node:fs');
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, '../output/sql-dispatch-20261003/browser');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'loader.cjs'), `module.exports=function(source){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source,{compilerOptions:{jsx:4,module:99,target:7}}).outputText}`);
fs.writeFileSync(path.join(out, 'link.js'), `import React from 'react'; export default function Link(p){return React.createElement('a',p,p.children)}`);
fs.writeFileSync(path.join(out, 'api.js'), `
export async function paymentSubmitStatus(){return structuredClone(window.fixture.payment)}
export async function getOrderBatch(){return structuredClone(window.fixture.order)}
export async function getSqlDispatchPolicy(){return {batch_interval_minutes:30}}
export async function startOrderBatch(...args){
 window.fixture.calls.push(args);
 window.fixture.order={id:'order-job',status:'PENDING',action:args[1],result:{items:[]},queue_position:2,
  dispatch_mode:args[4]==='IMMEDIATE'?'IMMEDIATE':'BATCH',scheduled_for:new Date(args[4]==='IMMEDIATE'?Date.now()-1000:Date.now()+1800000).toISOString()};
 return structuredClone(window.fixture.order);
}
export const previewOrderBatchEmail=()=>{throw Error('Unexpected email')};
export const sendOrderBatchEmail=()=>{throw Error('Unexpected email')};
export const assignOrderBatchFiles=()=>{throw Error('Unexpected file mutation')};
export const getRunFile=()=>{throw Error('Unexpected download')};
`);
fs.writeFileSync(path.join(out, 'entry.tsx'), `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {PaymentSubmitProgress} from ${JSON.stringify(path.join(root, 'components/automation/PaymentSubmitProgress'))};
import {OrderBatchActions} from ${JSON.stringify(path.join(root, 'components/automation/OrderBatchActions'))};
const root=createRoot(document.getElementById('app'));
window.renderFixture=()=>root.render(<main className="mx-auto max-w-5xl p-6 space-y-6">
<h1 className="text-2xl font-semibold">SQL queue — isolated UI verification</h1>
<PaymentSubmitProgress key={'payment-'+window.fixture.key} runId={9001} jobId="payment-job" onFinished={()=>window.fixture.finished++}/>
<OrderBatchActions key={'order-'+window.fixture.key} runId={9002} total={2} outsourced={false} editable={true} onRefresh={()=>{}}/>
</main>);
window.fixture={key:1,finished:0,calls:[],order:null,
payment:{id:'payment-job',status:'PENDING',dispatch_mode:'BATCH',scheduled_for:new Date(Date.now()+1800000).toISOString(),result:{stage:'QUEUED'}}};
window.renderFixture();
`);
webpack({ mode: 'development', target: 'web', devtool: false,
  entry: path.join(out, 'entry.tsx'), output: { path: out, filename: 'bundle.js' },
  resolve: { extensions: ['.js', '.ts', '.tsx'], modules: [path.join(root, 'node_modules'), 'node_modules'],
    alias: { '@/services/AgentsService$': path.join(out, 'api.js'), 'next/link$': path.join(out, 'link.js'), '@': root } },
  module: { rules: [{ test: /\.tsx?$/, exclude: /node_modules/, use: path.join(out, 'loader.cjs') }] },
}, (error, stats) => {
  if (error || stats.hasErrors()) { console.error(error || stats.toString({all:false,errors:true})); process.exitCode=1; }
  else console.log('Offline UI bundle ready');
});
