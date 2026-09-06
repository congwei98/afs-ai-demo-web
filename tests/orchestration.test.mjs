import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentCalls } from '../app/chat/agentCalls.mjs';
import { layoutOrchestration, nodeExecution } from '../app/chat/orchestration.mjs';
const node = (id, kind = 'agent') => ({id,name:id,kind,detail:'mock result',instruction:'plan',x:0,y:0});

test('arrows terminate at their source and target ports without crossing unrelated cards', () => {
  for (const [phase, ids] of Object.entries({intake:['router','cco-execution'],retention:['retention','repair-history','technical','mobility','warranty','customer-care','claim-process'],claim:['retention','claim-process','ocr','writer']})) {
    const nodes = ids.map(id=>node(id));
    const extra = phase === 'retention' ? [node('frd','source'),node('cco-retention','system')] : [node(phase === 'claim' ? 'cco-claim' : 'cco-intake','system')];
    for (const input of [nodes, [...nodes,...extra]]) {
      const graph = layoutOrchestration(phase,input,getAgentCalls(phase,input));
      for (const edge of graph.edges) {
        const source=graph.nodes.find(n=>n.id===edge.source), target=graph.nodes.find(n=>n.id===edge.target);
        assert.deepEqual(edge.route[0],[source.x,source.y+source.height/2]);
        assert.deepEqual(edge.route.at(-1),[target.x,target.y-target.height/2]);
        for (let i=1;i<edge.route.length;i++) {
          const [a,b]=[edge.route[i-1],edge.route[i]];
          assert.ok(a[0]===b[0] || a[1]===b[1]);
          for (const n of graph.nodes.filter(n=>n.id!==edge.source && n.id!==edge.target)) {
            const left=n.x-n.width/2,right=n.x+n.width/2,top=n.y-n.height/2,bottom=n.y+n.height/2;
            const intersects=a[0]===b[0] ? a[0]>left && a[0]<right && Math.max(a[1],b[1])>top && Math.min(a[1],b[1])<bottom : a[1]>top && a[1]<bottom && Math.max(a[0],b[0])>left && Math.min(a[0],b[0])<right;
            assert.equal(intersects,false,`${edge.id} crosses ${n.id}`);
          }
        }
      }
    }
  }
});
test('system links use the responsible execution or data agent',()=>{
  const nodes=[node('retention'),node('technical'),node('warranty'),node('frd','source')];
  assert.equal(getAgentCalls('retention',nodes)[2].source,'warranty');
  assert.deepEqual(getAgentCalls('intake',[node('router'),node('cco-intake','system')]),[]);
});
test('waiting, running and connected-only nodes do not show a completed result',()=>{
  assert.deepEqual(nodeExecution(node('technical'),'waiting','ready_investigation'),{events:[],result:null});
  assert.equal(nodeExecution(node('technical'),'running','running_investigation').result,null);
  assert.equal(nodeExecution(node('frd','source'),'done','complete').result,null);
  assert.match(nodeExecution(node('technical'),'done','waiting_customer').result,/6/);
});
test('missing documents do not claim successful approval and completed routing does not claim writeback',()=>{
  assert.match(nodeExecution(node('ocr'),'done','waiting_supplement').result,/缺失/);
  assert.match(nodeExecution(node('claim-process'),'done','ready_approval').result,/仍需等待/);
});
