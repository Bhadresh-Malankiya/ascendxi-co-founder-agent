import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { ConnectorVault, connectorHash, connectorTransport, connectorUrl, redactConnector } from '../src/mastra/company/connector-security';
import { openConnector } from '../src/mastra/company/connector-runtime';

test('connector configuration rejects embedded secrets, private destinations and its own server',async()=>{
  for(const url of ['https://user:secret@example.com/mcp','https://example.com/mcp?token=secret','https://example.com/mcp#fragment','http://example.com/mcp','https://169.254.169.254/mcp','http://localhost:4111/mcp'])assert.throws(()=>connectorUrl(url,true));
  assert.throws(()=>connectorUrl('http://127.0.0.1:4229/mcp',false));
  assert.equal(connectorUrl('http://127.0.0.1:4229/mcp',true).port,'4229');
  await assert.rejects(connectorTransport('https://127.0.0.1:4229/mcp',false));
});
test('connector vault persists encrypted, identity-bound credentials with private permissions',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'ascendxi-vault-'));
  try{const vault=new ConnectorVault(dir),sealed=await vault.seal({secret:'controlled-private-value'},'profile:1');
    assert.ok(!sealed.includes('controlled-private-value'));
    assert.deepEqual(await new ConnectorVault(dir).open(sealed,'profile:1'),{secret:'controlled-private-value'});
    await assert.rejects(vault.open(sealed,'other:1'));
    assert.equal((await stat(join(dir,'connector-vault.key'))).mode&0o777,0o600);
    assert.equal((await stat(dir)).mode&0o777,0o700);
  }finally{await rm(dir,{recursive:true,force:true});}
});
test('canonical schema hashes survive key order and known credential fields are redacted',()=>{
  assert.equal(connectorHash({a:1,b:{d:2,c:3}}),connectorHash({b:{c:3,d:2},a:1}));
  const value=redactConnector({secret:'x',content:[{text:'{"apiKey":"private","status":"ok"}'},{text:'Bearer abc123 and controlled-private-value'}]},['controlled-private-value']);
  assert.doesNotMatch(JSON.stringify(value),/private-value|abc123|\\"private\\"/);
});
test('real Mastra MCP client discovers a controlled HTTP server and executes its exact read',async()=>{
  const methods:string[]=[];
  const server=createServer(async(req,res)=>{
    if(req.method==='DELETE'){res.writeHead(204).end();return;}
    if(req.method!=='POST'){res.writeHead(405).end();return;}
    let body='';for await(const chunk of req)body+=chunk;
    const message=JSON.parse(body);methods.push(message.method);
    if(message.id===undefined){res.writeHead(202).end();return;}
    let result:any;
    if(message.method==='initialize')result={protocolVersion:'2025-03-26',capabilities:{tools:{}},serverInfo:{name:'Controlled fixture',version:'1.0'}};
    if(message.method==='tools/list')result={tools:[{name:'read_status',description:'Controlled read only fixture',inputSchema:{type:'object',properties:{resource:{type:'string'}},required:['resource']},annotations:{readOnlyHint:true,destructiveHint:false}}]};
    if(message.method==='tools/call'){assert.equal(message.params.name,'read_status');assert.deepEqual(message.params.arguments,{resource:'fixture'});result={content:[{type:'text',text:'Controlled fixture status: available'}]};}
    res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result?{jsonrpc:'2.0',id:message.id,result}:{jsonrpc:'2.0',id:message.id,error:{code:-32601,message:'Method not found'}}));
  });
  server.listen(0,'127.0.0.1');await once(server,'listening');
  let session;try{
    const address=server.address() as any;
    session=await openConnector({kind:'http_mcp',name:'Controlled fixture',endpoint:'http://127.0.0.1:'+address.port+'/mcp',allowLocal:true,auth:'none',headerName:'X-API-Key',secret:''});
    assert.equal(session.catalog[0].name,'read_status');assert.equal(session.catalog[0].declaredReadOnly,true);
    const response=await session.execute('read_status',{resource:'fixture'});
    assert.match(JSON.stringify(response),/Controlled fixture status/);
    assert.ok(methods.includes('tools/list'));assert.ok(methods.includes('tools/call'));
  }finally{await session?.close();server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r()));}
});
