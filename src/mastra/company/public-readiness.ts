import { createHash } from 'node:crypto';
/** Fixed public GET probes within the approved VocalXI readiness goal. No cookies,
 * credentials, arbitrary URLs, redirect following, browser actions or mutations. */
export async function publicReadiness(task:{product:string;key:string}, request:typeof fetch=fetch) {
  if(task.product!=='VocalXI'||!/^plan:vocalxi-bounded-pilot-readiness:\d+:(current-evidence|pilot-check)$/.test(task.key))return null;
  const checks=await Promise.all(['https://vocalxi.com/','https://vocalxi.com/pricing','https://vocalxi.com/login'].map(async url=>{
    const at=new Date().toISOString(),start=Date.now();
    try{
      const response=await request(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});
      const reader=response.body?.getReader(),chunks:Uint8Array[]=[];let size=0,truncated=false;
      if(reader)try{for(;;){const part=await reader.read();if(part.done)break;const remaining=64000-size;chunks.push(part.value.subarray(0,remaining));size+=Math.min(part.value.length,remaining);if(size>=64000){truncated=true;break;}}}finally{await reader.cancel();}
      const body=Buffer.concat(chunks).toString('utf8');
      return {url,at,status:response.status,elapsedMs:Date.now()-start,bytes:size,truncated,title:body.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.slice(0,180)??null,bodySha256:createHash('sha256').update(body).digest('hex')};
    }catch{return {url,at,status:null,elapsedMs:Date.now()-start,error:'Public HTTP probe failed or timed out; current availability is not established.'};}
  }));
  return {kind:'actual-public-http-observation',checks,limitations:['HTTP responses and page titles only; JavaScript pricing behavior, authenticated API/database state, voice, form submission, email and payments were not tested.','Historical source references remain dated evidence. Production repairs, new credentials, billing and deployment still need separately approved execution.']};
}
