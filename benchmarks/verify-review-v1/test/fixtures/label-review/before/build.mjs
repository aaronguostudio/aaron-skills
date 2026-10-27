import{mkdir,copyFile}from'node:fs/promises';await mkdir('dist',{recursive:true});for(const f of ['index.html','behavior.js'])await copyFile(f,'dist/'+f);console.log('Build complete');
