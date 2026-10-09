import pathlib
root=pathlib.Path(__file__).parent
d=root/'src'
shell=(d/'shell.html').read_text()
files=['anatomy.js','hierarchy.js','psych.js','diseases.js','glossary.js','cond_ext.js']+sorted(p.name for p in d.glob('ext_*.js'))
data='\n'.join('<script>\n'+(d/f).read_text()+'\n</script>' for f in files)
body=shell.replace('<!--DATA-->',data).replace('<!--APP-->',(d/'app.js').read_text())
head_end=body.index('</style>')+len('</style>')
page=('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
      '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
      '<meta name="description" content="Interactive 3D brain map for studying neuroscience, psychology and medicine.">\n'
      +body[:head_end]+'\n<style>html,body{margin:0}*{box-sizing:border-box}[hidden]{display:none!important}</style>\n</head>\n<body>\n'
      +body[head_end:]+'\n</body>\n</html>\n')
(root/'index.html').write_text(page)
print(len(page))
