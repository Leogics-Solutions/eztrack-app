// Render the Dashboard component offline. No real API or accounting calls.
const fs = require('node:fs');
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');
const root = path.resolve(__dirname, '..');
const out = path.resolve(root, '../output/dashboard-sql-log-20261007/browser');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'loader.cjs'), `module.exports=function(source){return require(${JSON.stringify(require.resolve('typescript'))}).transpileModule(source,{compilerOptions:{jsx:4,module:99,target:7}}).outputText}`);
fs.writeFileSync(path.join(out, 'link.js'), `import React from 'react'; export default function Link(p){return React.createElement('a',p,p.children)}`);
fs.writeFileSync(path.join(out, 'org.js'), `export function useOrganization(){return {selectedOrganizationId:window.fixture.org}}`);
fs.writeFileSync(path.join(out, 'api.js'), `
const rows=[
 {id:'request-check-1',state:'QUEUED',queue_position:3,job_type:'payment_sql_preview',review_ids:[1570],reviews:[{id:1570,company:'MURNIRAYA SDN BHD',customer:'DIAMOND STREAM'}],company:'MURNIRAYA SDN BHD',customer:'DIAMOND STREAM',submitted_by:'Maincell Admin 2',submitted_email:'admin2@example.test',automatic:false,submitted_at:'2026-10-07T09:00:00Z'},
 {id:'request-post-2',state:'FAILED',queue_position:null,job_type:'order_batch',action:'SUBMIT',review_ids:[1658,1659],reviews:[{id:1658,company:'FLEXERO SDN BHD',customer:'INTERTRADE'},{id:1659,company:'FLEXERO SDN BHD',customer:'INTERTRADE'}],set_count:2,company:'FLEXERO SDN BHD',customer:'INTERTRADE',submitted_by:'Maincell Admin 3',submitted_email:'admin3@example.test',automatic:false,submitted_at:'2026-10-07T08:30:00Z',started_at:'2026-10-07T08:31:00Z',completed_at:'2026-10-07T08:32:00Z',error_message:'SQL customer code needs matching.'}
];
export async function getSqlRequestLog(filters,offset){
 window.fixture.calls.push({type:'read',filters,offset});
 if(window.fixture.fail) throw new Error('Fixture: request failed');
 const items=window.fixture.org===77?[]:rows.filter(r=>(!filters.company||r.company===filters.company)&&(!filters.state||r.state===filters.state));
 return {updated_at:'2026-10-07T09:00:10Z',items:offset?items.slice(1):items,total:filters.company||filters.state?items.length:51,limit:50,offset,has_more:!offset&&!filters.company&&!filters.state,companies:['FLEXERO SDN BHD','MURNIRAYA SDN BHD'],active_counts:{RUNNING:1,QUEUED:2,SCHEDULED:0,NEEDS_ATTENTION:0}};
}
export async function exportSqlRequestLog(filters){window.fixture.calls.push({type:'export',filters});return new Blob(['\\ufeffReview,Company\\r\\n1658,FLEXERO SDN BHD\\r\\n1659,FLEXERO SDN BHD\\r\\n'],{type:'text/csv;charset=utf-8'})}
`);
fs.writeFileSync(path.join(out, 'entry.tsx'), `
import React from 'react'; import {createRoot} from 'react-dom/client';
import {SqlRequestLogPanel} from ${JSON.stringify(path.join(root,'components/automation/SqlRequestLogPanel'))};
window.fixture={org:66,calls:[],fail:false};
const root=createRoot(document.getElementById('app'));
window.renderFixture=()=>root.render(<main className="mx-auto max-w-7xl p-6"><h1 className="mb-6 text-3xl font-bold">Dashboard — isolated UI verification</h1><SqlRequestLogPanel key={window.fixture.org}/></main>);
window.renderFixture();
`);
webpack({mode:'development',target:'web',devtool:false,entry:path.join(out,'entry.tsx'),output:{path:out,filename:'bundle.js'},
 resolve:{extensions:['.js','.ts','.tsx'],modules:[path.join(root,'node_modules'),'node_modules'],alias:{'@/services/AgentsService$':path.join(out,'api.js'),'@/lib/OrganizationContext$':path.join(out,'org.js'),'next/link$':path.join(out,'link.js'),'@':root}},
 module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,use:path.join(out,'loader.cjs')}]}
},(error,stats)=>{if(error||stats.hasErrors()){console.error(error||stats.toString({all:false,errors:true}));process.exitCode=1;}else console.log('Offline Dashboard bundle ready');});
