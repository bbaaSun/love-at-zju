const test=require('node:test'),assert=require('node:assert/strict'),X=require('../miniprogram/shared/xlsx-reader');
function zip(names,patch={}){let offset=0;const heads=[],centers=[];for(const name of names){const n=Buffer.from(name),body=Buffer.from('test'),h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt32LE(4,18);h.writeUInt32LE(4,22);h.writeUInt16LE(n.length,26);const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt32LE(4,20);c.writeUInt32LE(patch.size||4,24);c.writeUInt16LE(n.length,28);c.writeUInt32LE(offset,42);heads.push(h,n,body);centers.push(c,n);offset+=30+n.length+4;}const center=Buffer.concat(centers),e=Buffer.alloc(22);e.writeUInt32LE(0x06054b50);e.writeUInt16LE(names.length,8);e.writeUInt16LE(names.length,10);e.writeUInt32LE(center.length,12);e.writeUInt32LE(offset,16);return Buffer.concat([...heads,center,e]);}
test('ZIP accepts bounded standard XLSX and rejects traversal, duplicate paths, bombs and truncation',()=>{
 assert.equal(X.zipEntries(zip(['[Content_Types].xml','xl/worksheets/sheet1.xml'])).length,2);
 for(const b of [zip(['[Content_Types].xml','../outside']),zip(['[Content_Types].xml','[Content_Types].xml']),zip(['[Content_Types].xml'],{size:9000000}),Buffer.from('not xlsx'),zip(['[Content_Types].xml']).subarray(0,40)])assert.throws(()=>X.zipEntries(b));
});
test('XLSX resolves sparse cells, rich shared strings, inline text and entities; rejects formulas and XXE',()=>{
 const strings=X.sharedStrings('<sst><si><r><t>课程</t></r><r><t>名称 &amp; &#x2161;</t></r></si></sst>');assert.deepEqual(strings,['课程名称 & Ⅱ']);
 const rows=X.worksheet('<worksheet><row r="1"><c r="B1" t="s"><v>0</v></c><c r="D1" t="inlineStr"><is><t>周一</t></is></c></row></worksheet>',strings);assert.equal(rows[0][1],strings[0]);assert.equal(rows[0][3],'周一');
 assert.throws(()=>X.sharedStrings('<!DOCTYPE x [<!ENTITY x SYSTEM "file:///x">]>'));
 assert.throws(()=>X.worksheet('<row><c r="A1"><f>1+1</f><v>2</v></c></row>',[]));assert.throws(()=>X.worksheet('<row><c r="A1" t="s"><v>99</v></c></row>',[]));
});
