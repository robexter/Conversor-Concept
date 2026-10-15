#!/usr/bin/env python3
"""Execute a partir da raiz do repositório Conversor-Concept.
Altera SOMENTE index.html e sw.js. Cria backups .backup-antes-lavagem-v31.
"""
from pathlib import Path
import shutil
root=Path.cwd()
index=root/'index.html'
sw=root/'sw.js'
source=root/'Lavagem-J-3901-Concept-Interativo.html'
for p in (index,sw,source):
    if not p.is_file(): raise SystemExit(f'Arquivo obrigatório não encontrado: {p.name}')

def backup_and_write(path,content):
    old=path.read_text(encoding='utf-8')
    if content!=old:
        bak=path.with_name(path.name+'.backup-antes-lavagem-v31')
        if not bak.exists():shutil.copy2(path,bak)
        path.write_text(content,encoding='utf-8')
        print('Atualizado:',path.name)
    else: print('Já atualizado:',path.name)

quick="""  <a class="quick quick-link" id="lavagem-j3901-quick" href="./Lavagem-J-3901-Concept-Interativo.html?v=31"><strong>🧼 Lavagem J-3901 • V3.1</strong><small>HBF • pressão da 1ª roda • conteúdo integral</small></a>\n"""
card="""    <article class="integrated-item" id="lavagem-j3901-integrada" style="border-color:#3c7087;background:linear-gradient(180deg,#0d2938,#081722)">
      <div class="kind">LAVAGEM DA TURBINA • J-3901 • V3.1 INTEGRAL</div>
      <h3>🧼 Lavagem da Turbina J-3901</h3>
      <p>HBF, termodinâmica, conversão de energia, palhetamento, pressão da primeira roda, simuladores interativos, teoria integral e avaliação CIC.</p>
      <div class="integrated-actions"><a class="btn primary" href="./Lavagem-J-3901-Concept-Interativo.html?v=31">▶ Abrir treinamento V3.1</a></div>
    </article>
"""
s=index.read_text(encoding='utf-8')
if 'id="lavagem-j3901-quick"' not in s:
    anchor='  <a class="quick quick-link" href="./parada-j3901-manutencao.html"><strong>🛑 Parada J-3901</strong><small>isolamento + energias + manutenção</small></a>'
    if s.count(anchor)!=1: raise SystemExit('Não foi possível localizar o atalho original. Nada foi gravado.')
    s=s.replace(anchor,anchor+'\n'+quick,1)
if 'id="lavagem-j3901-integrada"' not in s:
    anchor='    <article class="integrated-item">\n      <div class="kind">PARADA PARA MANUTENÇÃO • J-3901</div>'
    if s.count(anchor)!=1: raise SystemExit('Não foi possível localizar o card de parada. Nada foi gravado.')
    s=s.replace(anchor,card+anchor,1)
old='<a class="btn" href="./parada-j3901-manutencao.html">🛑 Parada para manutenção</a>'
new=old+' <a class="btn" href="./Lavagem-J-3901-Concept-Interativo.html?v=31">🧼 Lavagem V3.1 • Conteúdo integral</a>'
if new not in s:
    if s.count(old)!=1: raise SystemExit('Não foi possível localizar o painel do J-3901. Nada foi gravado.')
    s=s.replace(old,new,1)
s=s.replace("navigator.serviceWorker.register('./sw.js')","navigator.serviceWorker.register('./sw.js?v=31-lavagem')")
s=s.replace("u.searchParams.set('v','4-b3901')","u.searchParams.set('v','31-lavagem')")
assert 'id="lavagem-j3901-quick"' in s and 'id="lavagem-j3901-integrada"' in s
w=sw.read_text(encoding='utf-8')
w=w.replace('conversor-concept-v16-lavagem-j3901','conversor-concept-v31-lavagem-j3901-integral')
w=w.replace('./Lavagem-J3901-CIC-V2-Refinada.html?v=2','./Lavagem-J-3901-Concept-Interativo.html?v=31')
w=w.replace('keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))',
            "keys.filter(k => k.startsWith('conversor-concept-') && k !== CACHE_NAME).map(k => caches.delete(k))")
if 'Lavagem-J-3901-Concept-Interativo.html?v=31' not in w:
    raise SystemExit('Não foi possível atualizar o cache PWA. Nenhum arquivo foi modificado.')
backup_and_write(index,s)
backup_and_write(sw,w)
print('Pronto: envie index.html, sw.js e o HTML V3.1 ao GitHub sem alterar os demais arquivos.')
