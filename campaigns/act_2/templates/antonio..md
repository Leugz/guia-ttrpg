---
type: character
name: "Antônio"
profile: "Analista"
occupation: "Professor"
level: 6
portrait: "assets/portraits/antonio.png"
token_image: "assets/portraits/antonio.png"
resources:
  hp: { current: 24, max: 24 }
  dp: { current: 24, max: 24 }
attributes:
  physical: 6
  mind: 12
  emotion: 6
skills:
  - id: acrobacia
    name: "Acrobacia"
    governed_by: physical
    value: 4
  - id: humanas
    name: "Aptidão: Humanas"
    governed_by: mind
    value: 10
    parent: "aptidao"
  - id: burocracia
    name: "Aptidão: Burocracia"
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
    value: 8
  - id: disciplina
    name: "Disciplina"
    governed_by: emotion
    value: 10
  - id: enganacao
    name: "Enganação"
    governed_by: emotion
    value: 8
  - id: furtividade
    name: "Furtividade"
    governed_by: physical
    value: 6
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
    value: 4
  - id: medicina
    name: "Medicina"
    governed_by: mind
    value: 4
  - id: ocultismo
    name: "Ocultismo"
    governed_by: mind
    value: 10
  - id: percepcao
    name: "Percepção"
    governed_by: mind
    value: 8
  - id: persuasao
    name: "Persuasão"
    governed_by: emotion
    value: 4
  - id: pesquisar
    name: "Pesquisar"
    governed_by: mind
    value: 4
  - id: pontaria
    name: "Pontaria"
    governed_by: physical
    value: 6
  - id: sobrevivencia
    name: "Sobrevivência"
    governed_by: mind
    value: 4
  - id: tecnologia
    name: "Tecnologia"
    governed_by: mind
    value: 6
  - id: vigor
    name: "Vigor"
    governed_by: physical
    value: 8
abilities:
  - id: amor_pela_descoberta
    name: "Amor pela Descoberta"
    description: "Quando examina um ponto de interesse e recebe uma informação nova, você recupera 1 PD."
    active: false
    effects: []
  - id: avaliacao
    name: "Avaliação"
    description: "Você pode gastar uma ação e 2 PD para observar um ser ou um ambiente. Você recebe d4 d4 que pode usar em testes relativos àquele ser ou ambiente (você pode usá-los como quiser, recebendo +d4 d4 em um teste ou +d4 em dois testes). Você não pode acumular mais do que dois dados bônus por esta habilidade."
    active: false
    effects: []
  - id: mentoria
    name: "Mentoria"
    description: "Quando ajuda outro personagem, você pode fazer um teste da perícia que usou para ajudar contra DT 7. Se passar, o personagem ajudado pode substituir um dos dados rolados por ele pela sua rolagem alta."
    active: false
    effects: []
---
# Anotações de Antônio
