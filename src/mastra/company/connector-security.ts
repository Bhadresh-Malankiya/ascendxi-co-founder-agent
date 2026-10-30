import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { lookup } from 'node:dns/promises';
import { Agent } from 'undici';
import ipaddr from 'ipaddr.js';

export function canonical(value: unknown): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (value && typeof value === 'object') return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+':'+canonical(v)).join(',')+'}';
  return JSON.stringify(value) ?? 'null';
}
export const connectorHash = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');

export function connectorUrl(value: string, local: boolean) {
  const url = new URL(value);
  if (url.username || url.password || url.search || url.hash) throw Error('Use an endpoint URL without credentials, query parameters or fragments. Put credentials in the private authentication field.');
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (loopback) {
    if (!local || !['http:','https:'].includes(url.protocol)) throw Error('Explicitly allow a local MCP server.');
    if (Number(url.port || (url.protocol==='https:'?443:80)) === Number(process.env.PORT || 4111)) throw Error('The company server cannot be its own connector.');
  } else {
    if (url.protocol !== 'https:') throw Error('Remote MCP endpoints require HTTPS.');
    if (ipaddr.isValid(url.hostname.replace(/^\[|\]$/g,'')) && ipaddr.process(url.hostname.replace(/^\[|\]$/g,'')).range() !== 'unicast') throw Error('Private and reserved network destinations are not allowed.');
  }
  return url;
}

/** DNS is validated once and pinned in this transport, closing the validation/fetch rebind gap. */
export async function connectorTransport(endpoint: string, allowLocal: boolean) {
  const url = connectorUrl(endpoint,allowLocal), host=url.hostname.replace(/^\[|\]$/g,'');
  const addresses = await lookup(host,{all:true});
  if (!addresses.length || addresses.some(a=>{
    const range=ipaddr.process(a.address).range();
    return range!=='unicast' && !(allowLocal && ['localhost','127.0.0.1','::1'].includes(host) && range==='loopback');
  })) throw Error('Endpoint resolves to a private or reserved network. Only explicitly allowed loopback servers are supported locally.');
  const dispatcher=new Agent({connect:{timeout:8000,lookup:(_host,options,callback)=>{
    const selected=addresses.filter(a=>!options.family || a.family===Number(options.family));
    if (!selected.length) {callback(Error('No approved address'),'',4);return;}
    if(options.all)(callback as any)(null,selected);
    else callback(null,selected[0].address,selected[0].family);
  }}});
  const request:typeof fetch = async (input,init={})=>{
    const dest=new URL(typeof input==='string'||input instanceof URL?String(input):input.url);
    if(dest.origin!==url.origin)throw Error('Connector redirects and cross-origin requests are not allowed.');
    const response=await fetch(input,{...init,redirect:'error',dispatcher,
      signal:AbortSignal.any([AbortSignal.timeout(20000),...(init.signal?[init.signal]:[])])} as RequestInit);
    if (!response.body) return response;
    let size=0;const reader=response.body.getReader();
    return new Response(new ReadableStream({async pull(controller){try{const chunk=await reader.read();if(chunk.done){controller.close();return;}size+=chunk.value.length;if(size>2_000_000){await reader.cancel();controller.error(Error('Connector response exceeds the supported size'));return;}controller.enqueue(chunk.value);}catch(e){controller.error(e);}},cancel(){return reader.cancel();}}),{status:response.status,statusText:response.statusText,headers:response.headers});
  };
  return {url,request,close:()=>dispatcher.destroy()};
}

export class ConnectorVault {
  constructor(private directory=process.env.ASCENDXI_PRIVATE_DIR || join(homedir(),'Library','Application Support','AscendXI Company OS','private')){}
  private async key() {
    await mkdir(this.directory,{recursive:true,mode:0o700});await chmod(this.directory,0o700);
    const path=join(this.directory,'connector-vault.key');
    try{await writeFile(path,randomBytes(32),{flag:'wx',mode:0o600});}catch(e:any){if(e.code!=='EEXIST')throw e;}
    await chmod(path,0o600);const key=await readFile(path);if(key.length!==32)throw Error('Connector vault key is invalid');return key;
  }
  async seal(value: unknown, identity: string) {
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',await this.key(),iv);cipher.setAAD(Buffer.from(identity));
    return Buffer.concat([iv,cipher.update(JSON.stringify(value),'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
  }
  async open(value: string, identity: string) {
    const data=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',await this.key(),data.subarray(0,12));decipher.setAAD(Buffer.from(identity));decipher.setAuthTag(data.subarray(-16));
    return JSON.parse(Buffer.concat([decipher.update(data.subarray(12,-16)),decipher.final()]).toString('utf8'));
  }
}

/** Known credentials and common credential fields never enter model evidence or UI receipts. */
export function redactConnector(value: unknown, secrets: string[]=[]): unknown {
  if(Array.isArray(value))return value.map(v=>redactConnector(v,secrets));
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,/token|password|secret|authorization|api.?key|cookie|private.?key|connection.?string|credential/i.test(k)?'[redacted]':redactConnector(v,secrets)]));
  if(typeof value==='string') {
    let text=value;for(const secret of secrets.filter(s=>s.length>3))text=text.split(secret).join('[redacted]');
    text=text.replace(/(Bearer\s+)[A-Za-z0-9._~+\/-]+=*/gi,'$1[redacted]');
    // MCP often embeds JSON inside text content.
    try{return JSON.stringify(redactConnector(JSON.parse(text),secrets));}catch{return text;}
  }
  return value;
}
