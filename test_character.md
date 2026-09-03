---
type: character
name: Elian Thorne
profile: Combatente
occupation: Mercenário
level: 1
resources:
  hp:
    current: 15
    max: 20
  dp:
    current: 10
    max: 10
attributes:
  physical: 8
  mind: 6
  emotion: 4
skills:
- id: furtividade
  name: Furtividade
  governed_by: physical
  value: 6
- id: luta
  name: Luta
  governed_by: physical
  value: 8
- id: vigor
  name: Vigor
  governed_by: physical
  value: 6
- id: disciplina
  name: Disciplina
  governed_by: emotion
  value: 4
- id: acrobacia
  name: Acrobacia
  governed_by: physical
  value: 4
- id: atletismo
  name: Atletismo
  governed_by: physical
  value: 4
- id: crime
  name: Crime
  governed_by: physical
  value: 4
- id: pontaria
  name: Pontaria
  governed_by: physical
  value: 4
- id: aptidao
  name: Aptidão
  governed_by: mind
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
  value: 4
- id: pesquisar
  name: Pesquisar
  governed_by: mind
  value: 4
- id: sobrevivencia
  name: Sobrevivência
  governed_by: mind
  value: 4
- id: tecnologia
  name: Tecnologia
  governed_by: mind
  value: 4
- id: enganacao
  name: Enganação
  governed_by: emotion
  value: 4
- id: intimidar
  name: Intimidar
  governed_by: emotion
  value: 4
- id: intuicao
  name: Intuição
  governed_by: emotion
  value: 4
- id: persuasao
  name: Persuasão
  governed_by: emotion
  value: 4
abilities:
- id: reflexos
  name: Reflexos
  description: Adiciona um dado em esquivas.
  active: false
  effects:
  - operation: add
    quantity: 1
    unit: 4
    target: furtividade
- id: postura_defensiva
  name: Postura Defensiva
  description: Enquanto ativa, avança o dado de Físico em um passo.
  active: false
  effects:
  - operation: advance
    quantity: 1
    unit: step
    target: physical
- id: contatos_na_rua
  name: Contatos na Rua
  description: Conhece alguém em quase todo bairro da zona portuária.
  active: false
  effects: []
inventory:
- id: faca_tatica
  name: Faca Tática
  description: Leve, equilibrada, fácil de esconder.
  active: false
  effects:
  - operation: add
    quantity: 1
    unit: 6
    target: luta
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
# Histórico do Personagem

Anotações do jogador sobre a campanha vão aqui.

Este conteúdo é ignorado pelo sistema e exposto através da aba "Anotações".