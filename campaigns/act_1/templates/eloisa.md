---
type: character
name: ELOÍSA
profile: ANALISTA
occupation: ARTISTA
level: 2
color: '#4176ba'
resources:
  hp:
    current: 12
    max: 12
  dp:
    current: 14
    max: 14
attributes:
  physical: 8
  mind: 8
  emotion: 6
skills:
- id: acrobacia
  name: Acrobacia
  governed_by: physical
  value: 6
- id: aptidao
  name: Aptidão
  governed_by: mind
  value: 4
- id: atletismo
  name: Atletismo
  governed_by: physical
  value: 4
- id: crime
  name: Crime
  governed_by: physical
  value: 6
- id: disciplina
  name: Disciplina
  governed_by: emotion
  value: 6
- id: enganacao
  name: Enganação
  governed_by: emotion
  value: 4
- id: furtividade
  name: Furtividade
  governed_by: physical
  value: 4
- id: intimidar
  name: Intimidar
  governed_by: emotion
  value: 4
- id: intuicao
  name: Intuição
  governed_by: emotion
  value: 8
- id: luta
  name: Luta
  governed_by: physical
  value: 4
- id: maquinas
  name: Máquinas
  governed_by: mind
  value: 4
- id: medicina
  name: Medicina
  governed_by: mind
  value: 4
- id: ocultismo
  name: Ocultismo
  governed_by: mind
  value: 4
- id: percepcao
  name: Percepção
  governed_by: mind
  value: 6
- id: persuasao
  name: Persuasão
  governed_by: emotion
  value: 4
- id: pesquisar
  name: Pesquisar
  governed_by: mind
  value: 6
- id: pontaria
  name: Pontaria
  governed_by: physical
  value: 4
- id: sobrevivencia
  name: Sobrevivência
  governed_by: mind
  value: 4
- id: tecnologia
  name: Tecnologia
  governed_by: mind
  value: 6
- id: vigor
  name: Vigor
  governed_by: physical
  value: 4
- id: artes
  name: Artes
  governed_by: mind
  value: 4
  parent: aptidao
- id: atualidades
  name: Atualidades
  governed_by: mind
  value: 4
  parent: aptidao
- id: burocracia
  name: Burocracia
  governed_by: mind
  value: 4
  parent: aptidao
- id: exatas
  name: Exatas
  governed_by: mind
  value: 4
  parent: aptidao
- id: humanas
  name: Humanas
  governed_by: mind
  value: 4
  parent: aptidao
- id: tatica
  name: Tática
  governed_by: mind
  value: 4
  parent: aptidao
abilities:
- id: avaliacao
  name: Avaliação
  description: Você pode gastar uma ação e 2 PD para observar um ser ou um ambiente. Você recebe dois dados d4 que pode usar em testes relativos àquele ser ou ambiente (você pode usá-los como quiser, recebendo +d4 d4 em um teste ou +d4 em dois testes). Você não pode acumular mais do que dois dados bônus por esta habilidade.
  active: false
  effects: []
- id: foco_emocional
  name: Foco Emocional
  description: Quando faz um teste emocional, você pode gastar 2 PD para receber +4 no teste.
  active: false
  effects: []
inventory: []
active_effects: []
accessible_sheets: []
death_saves:
  hp:
    dc: 7
    failed: false
  dp:
    dc: 10
    failed: true
---
