---
type: character
name: VICTOR
profile: VIGILANTE
occupation: PROFESSOR
level: 2
color: '#4b7e2f'
resources:
  hp:
    current: 14
    max: 14
  dp:
    current: 14
    max: 14
attributes:
  physical: 8
  mind: 6
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
  value: 6
- id: crime
  name: Crime
  governed_by: physical
  value: 4
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
  value: 8
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
- id: mentoria
  name: Mentoria
  description: Quando ajuda outro personagem, você pode fazer um teste da perícia que usou para ajudar contra DT 7. Se passar, o personagem ajudado pode substituir um dos dados rolados por ele pela sua rolagem alta.
  active: false
  effects: []
- id: prontidao
  name: Prontidão
  description: No início de qualquer conflito, você pode gastar 3 PD. Se fizer isso, ganha uma rodada na qual pode agir antes dos demais personagens e NPCs.
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
