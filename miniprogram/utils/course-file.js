const X=require('../shared/xlsx-reader');
const Z=require('../shared/zju-import');
function call(fs,method,args){return new Promise((resolve,reject)=>fs[method](Object.assign({},args,{success:resolve,fail:reject})));}
async function read(file,wxAPI){
 const api=wxAPI||wx,fs=api.getFileSystemManager();
 if(!file||!file.path||(file.name&&!/\.xlsx$/i.test(file.name))||file.size>4*1024*1024)throw new Error('请选择教务网导出的 .xlsx 文件（4 MB 以内）');
 const data=await call(fs,'readFile',{filePath:file.path});const entries=X.zipEntries(data.data);
 const target=api.env.USER_DATA_PATH+'/course-import-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 try{
  await call(fs,'mkdir',{dirPath:target,recursive:true});
  await call(fs,'unzip',{zipFilePath:file.path,targetPath:target});
  const readXML=async name=>{const r=await call(fs,'readFile',{filePath:target+'/'+name,encoding:'utf8'});return r.data;};
  const strings=entries.some(e=>e.name==='xl/sharedStrings.xml')?X.sharedStrings(await readXML('xl/sharedStrings.xml')):[];
  const sheets=entries.filter(e=>/^xl\/worksheets\/sheet\d+\.xml$/.test(e.name));if(!sheets.length)throw new Error('工作簿没有支持的课表工作表');
  const matches=[];
  for(const sheet of sheets){const rows=X.worksheet(await readXML(sheet.name),strings);if(rows.some(r=>r.includes('课程代码')&&r.includes('上课时间')))matches.push(rows);}
  if(matches.length!==1)throw new Error('请导出一份学年的课表列表，文件须包含且只包含一张课表');
  return Z.parseRows(matches[0]);
 }finally{try{await call(fs,'rmdir',{dirPath:target,recursive:true});}catch(e){/* Best-effort cleanup; no source file is changed. */}}
}
module.exports={read};
