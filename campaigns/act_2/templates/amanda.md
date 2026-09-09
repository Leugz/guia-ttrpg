---
type: character
name: "Amanda"
profile: "Analista"
occupation: "Cientista"
level: 6
portrait: "assets/portraits/amanda.png"
token_image: "assets/portraits/amanda.png"
resources:
  hp: { current: 26, max: 26 }
  dp: { current: 26, max: 26 }
attributes:
  physical: 8
  mind: 8
  emotion: 8
skills:
  - id: acrobacia
    name: "Acrobacia"
    governed_by: physical
    value: 4
  - id: burocracia
    name: "Aptidão: Burocracia"
    governed_by: mind
    value: 8
    parent: "aptidao"
  - id: exatas
    name: "Aptidão: Exatas"
    governed_by: mind
    value: 8
    parent: "aptidao"
  - id: atletismo
    name: "Atletismo"
    governed_by: physical
    value: 4
  - id: crime
    name: "Crime"
    governed_by: physical
    value: 6
  - id: disciplina
    name: "Disciplina"
    governed_by: emotion
    value: 6
  - id: enganacao
    name: "Enganação"
    governed_by: emotion
    value: 6
  - id: furtividade
    name: "Furtividade"
    governed_by: physical
    value: 4
  - id: intimidar
    name: "Intimidar"
    governed_by: emotion
    value: 4
  - id: intuicao
    name: "Intuição"
    governed_by: emotion
    value: 8
  - id: luta
    name: "Luta"
    governed_by: physical
    value: 4
  - id: maquinas
    name: "Máquinas"
    governed_by: mind
    value: 6
  - id: medicina
    name: "Medicina"
    governed_by: mind
    value: 6
  - id: ocultismo
    name: "Ocultismo"
    governed_by: mind
    value: 4
  - id: percepcao
    name: "Percepção"
    governed_by: mind
    value: 10
  - id: persuasao
    name: "Persuasão"
    governed_by: emotion
    value: 4
  - id: pesquisar
    name: "Pesquisar"
    governed_by: mind
    value: 10
  - id: pontaria
    name: "Pontaria"
    governed_by: physical
    value: 4
  - id: sobrevivencia
    name: "Sobrevivência"
    governed_by: mind
    value: 4
  - id: tecnologia
    name: "Tecnologia"
    governed_by: mind
    value: 10
  - id: vigor
    name: "Vigor"
    governed_by: physical
    value: 4
abilities:
  - id: avaliacao
    name: "Avaliação"
    description: "Você pode gastar uma ação e 2 PD para observar um ser ou um ambiente. Você recebe d4 d4 que pode usar em testes relativos àquele ser ou ambiente (você pode usá-los como quiser, recebendo +d4 d4 em um teste ou +d4 em dois testes). Você não pode acumular mais do que dois dados bônus por esta habilidade."
    active: false
    effects: []
  - id: foco_mental
    name: "Foco Mental"
    description: "Quando faz um teste mental, você pode gastar 4 PD para receber +d8 no teste."
    active: false
    effects:
      - operation: add
        quantity: 1
        unit: 8
        target: mind
  - id: olhar_infalivel
    name: "Olhar Infalível"
    description: "Quando faz um teste de examinar, você pode gastar 2 PD para rolar novamente um dos dados do teste."
    active: false
    effects: []
---
# Anotações de Amanda
