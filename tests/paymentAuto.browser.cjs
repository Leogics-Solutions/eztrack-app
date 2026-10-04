// Render the real component with an offline API transport and no live server.
const fs = require('node:fs');
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, '../output/kenzee-payment-automation-20261003/browser');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'loader.cjs'), `module.exports=function(source){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source,{compilerOptions:{jsx:4,module:99,target:7}}).outputText}`);
fs.writeFileSync(path.join(out, 'api.js'), `
export async function getPaymentAutoStatus(id){return structuredClone(window.fixture.values[id])}
export async function setPaymentAutoPolicy(id,mode,options){window.fixture.calls.push([id,mode,options]);window.fixture.values[id].policy.mode=mode;}
`);
fs.writeFileSync(path.join(out, 'entry.tsx'), `
import React from 'react';import {createRoot} from 'react-dom/client';
import {PaymentAutoKnockoff} from ${JSON.stringify(path.join(root, 'components/automation/PaymentAutoKnockoff'))};
import {PaymentInvoiceBalance} from ${JSON.stringify(path.join(root, 'components/automation/PaymentInvoiceBalance'))};
const defaults={version:2,name_suffix_tolerance:true,partial_payments:true,foreign_invoices:true,
 unapplied_balance:true,receipt_before_invoice:true,finance_receipt_date:true,chase_missing_slip:true,
 reminder_interval_hours:24,sql_refresh_seconds:300,customer_rules:[{connection_id:7,customer_code:'300-A0005',oldest_open_first:true,default_payment_method:'BANK1'}]};
const view={policy:{mode:'PREVIEW',rules:defaults,include_run_ids:[1360,1418]},assessment:{eligible:false,reasons:[{code:'WAITING_SLIP',detail:'Waiting for the actual bank slip.'}]},can_configure:true,
 customer_scope:{connection_id:7,customer_code:'300-A0005',company_name:'METASPHERE SDN BHD',customer_name:'ACCURAUX SDN BHD',payment_methods:[{code:'BANK1',description:'Receiving account'}]},
 classification:{status:'WAITING_SLIP',reason:['Waiting for the actual bank slip.'],evidence:{review_id:1360,sql_connection_id:7,customer_code:'300-A0005',capture_ids:[3159]},responsible_role:'CS / source PIC',next_action:'Supply the actual slip; the system will recheck automatically.'}};
window.fixture={runId:1360,calls:[],values:{1360:view,1418:{...structuredClone(view),policy:{mode:'OFF',rules:{...defaults,customer_rules:[]},include_run_ids:[]},customer_scope:{...view.customer_scope,customer_code:'300-N0001',customer_name:'NAM FONG'},assessment:{eligible:false,reasons:[{code:'WAITING_RECEIPT',detail:'Waiting for Finance receipt confirmation.'}]},classification:{status:'WAITING_RECEIPT',responsible_role:'Finance',reason:['Waiting for Finance receipt confirmation.'],evidence:{review_id:1418,sql_connection_id:7,customer_code:'300-N0001',capture_ids:[3164]},next_action:'Finance confirms the actual bank receipt date; the system will recheck automatically.'}}}};
const root=createRoot(document.getElementById('app'));
window.renderFixture=()=>root.render(<main className="mx-auto max-w-5xl p-6"><PaymentAutoKnockoff runId={window.fixture.runId} jobId="" onJob={()=>{}}/><div data-testid="foreign-balance"><PaymentInvoiceBalance currency="USD" balance={100} rate={4.5} localContract={true}/></div></main>);
window.renderFixture();
`);
webpack({ mode:'development',target:'web',devtool:false,
 entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},
 resolve:{extensions:['.js','.ts','.tsx'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{'@/services/AgentsService$':path.join(out,'api.js'),'@':root}},
 module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(out,'loader.cjs')}]},
},(error,stats)=>{if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;}else console.log('Offline payment UI bundle ready');});
