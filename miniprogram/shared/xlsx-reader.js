/* Small, bounded reader for official tabular XLSX exports. No formulas executed. */
const LIMIT=4*1024*1024;
function zipEntries(buffer){
 const a=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),v=new DataView(a.buffer,a.byteOffset,a.byteLength);
 if(a.length<22||a.length>LIMIT)throw new Error('请选择 4 MB 以内的 .xlsx 课表');
 let end=-1;for(let i=a.length-22;i>=Math.max(0,a.length-65557);i--)if(v.getUint32(i,true)===0x06054b50&&i+22+v.getUint16(i+20,true)===a.length){end=i;break;}
 if(end<0)throw new Error('文件不是有效的 XLSX');
 const count=v.getUint16(end+10,true),size=v.getUint32(end+12,true),offset=v.getUint32(end+16,true);
 if(v.getUint16(end+4,true)||v.getUint16(end+6,true)||count!==v.getUint16(end+8,true)||!count||count>100||offset+size!==end)throw new Error('不支持此压缩文件结构');
 let p=offset,total=0;const entries=[],names=new Set();
 for(let i=0;i<count;i++){
  if(p+46>end||v.getUint32(p,true)!==0x02014b50)throw new Error('课表压缩内容不完整');
  const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),packed=v.getUint32(p+20,true),unpacked=v.getUint32(p+24,true),n=v.getUint16(p+28,true),extra=v.getUint16(p+30,true),comment=v.getUint16(p+32,true),local=v.getUint32(p+42,true);
  if(p+46+n+extra+comment>end)throw new Error('课表压缩目录损坏');
  const bytes=a.slice(p+46,p+46+n);if(bytes.some(x=>x<32||x>126))throw new Error('请选择教务网导出的原始 XLSX 文件');
  const name=String.fromCharCode(...bytes);
  if(!name||name.startsWith('/')||name.includes('\\')||name.includes(':')||name.split('/').some(x=>x==='..'||x==='.')||names.has(name)||((v.getUint32(p+38,true)>>>16)&0xf000)===0xa000)throw new Error('课表包含不安全的路径');
  if(flags&1||![0,8].includes(method)||unpacked>2*1024*1024||(total+=unpacked)>8*1024*1024)throw new Error('课表过大或已加密');
  if(local+30>offset||v.getUint32(local,true)!==0x04034b50)throw new Error('课表压缩数据损坏');
  const ln=v.getUint16(local+26,true),le=v.getUint16(local+28,true);
  if(!(flags&8)&&(v.getUint32(local+18,true)!==packed||v.getUint32(local+22,true)!==unpacked))throw new Error('课表压缩大小不一致');
  if(local+30+ln+le+packed>offset||ln!==n||v.getUint16(local+6,true)!==flags||v.getUint16(local+8,true)!==method||bytes.some((b,j)=>b!==a[local+30+j]))throw new Error('课表压缩索引不一致');
  names.add(name);entries.push({name,size:unpacked});p+=46+n+extra+comment;
 }
 if(p!==end||!names.has('[Content_Types].xml'))throw new Error('不是 XLSX 工作簿');
 return entries;
}
function xml(s){if(typeof s!=='string'||s.length>2*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(s))throw new Error('课表 XML 内容不受支持');return s;}
function decode(s){return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,x)=>{if(x[0]==='#'){const n=x[1].toLowerCase()==='x'?parseInt(x.slice(2),16):Number(x.slice(1));if(!Number.isInteger(n)||n<1||n>0x10ffff||(n>=0xd800&&n<=0xdfff))throw new Error('课表字符编码错误');return String.fromCodePoint(n);}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[x];});}
function texts(s){return [...s.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');}
function sharedStrings(s){return [...xml(s).matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>texts(m[1]));}
function worksheet(s,strings){
 const rows=[];for(const match of xml(s).matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)){
  if(rows.length>=500)throw new Error('课表超过 500 行');const row=[];
  for(const cell of match[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
   const ref=/\br="([A-Z]+)\d+"/.exec(cell[1]);if(!ref)throw new Error('课表单元格缺少位置');
   let col=0;for(const ch of ref[1])col=col*26+ch.charCodeAt(0)-64;if(col>64)throw new Error('课表列数超出支持范围');
   const body=cell[2]||'',type=(/\bt="([^"]+)"/.exec(cell[1])||[])[1],value=(/<v\b[^>]*>([\s\S]*?)<\/v>/.exec(body)||[])[1];
   if(/<f\b/.test(body))throw new Error('请选择教务网原始导出文件，课表中不能含公式');
   if(type==='s'){if(!/^\d+$/.test(value||'')||Number(value)>=strings.length)throw new Error('课表文字索引无效');row[col-1]=strings[Number(value)];}
   else row[col-1]=type==='inlineStr'?texts(body):decode(value||'');
  }rows.push(row);
 }return rows;
}
module.exports={zipEntries,sharedStrings,worksheet};
