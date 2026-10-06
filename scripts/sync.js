const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
fs.copyFileSync(path.join(root,'miniprogram/shared/domain.js'),path.join(root,'cloudfunctions/api/domain.js'));
fs.copyFileSync(path.join(root,'miniprogram/shared/season.js'),path.join(root,'cloudfunctions/api/season.js'));
console.log('Shared rules synced to cloud function.');

fs.copyFileSync(path.join(root,'miniprogram/shared/timetable.js'),path.join(root,'cloudfunctions/api/timetable.js'));
