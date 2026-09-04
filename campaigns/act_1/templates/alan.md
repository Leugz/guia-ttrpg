---
type: character
name: ALAN
profile: EXECUTOR
occupation: CIENTISTA
level: 2
color: '#ae2c12'
resources:
  hp:
    current: 10
    max: 10
  dp:
    current: 16
    max: 16
attributes:
  physical: 6
  mind: 8
  emotion: 8
skills:
- id: acrobacia
  name: Acrobacia
  governed_by: physical
  value: 4
- id: aptidao
  name: Aptidão (Humanas)
  governed_by: mind
  value: 6
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
  value: 6
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
  value: 4
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
  value: 4
- id: vigor
  name: Vigor
  governed_by: physical
  value: 6
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
- id: foco_mental
  name: Foco Mental
  description: Quando faz um teste mental, você pode gastar 2 PD para receber +4 no teste.
  active: false
  effects: []
- id: impeto
  name: Ímpeto
  description: Você possui uma barra de ímpeto com três espaços. Sempre que falha em um teste, você preenche um espaço na barra. Você pode apagar espaços preenchidos para receber +4 em um teste ou aumentar um atributo em um passo até o fim da cena.
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
    dc: 7
    failed: false
---
