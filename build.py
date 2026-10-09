import pathlib
d=pathlib.Path(__file__).parent/'src'
shell=(d/'shell.html').read_text()
data='\n'.join('<script>\n'+(d/f).read_text()+'\n</script>' for f in ['anatomy.js','hierarchy.js','psych.js','diseases.js','glossary.js','cond_ext.js']+sorted(p.name for p in d.glob('ext_*.js')))
out=shell.replace('<!--DATA-->',data).replace('<!--APP-->',(d/'app.js').read_text())
(pathlib.Path(__file__).parent/'index.html').write_text(out)
print(len(out))
