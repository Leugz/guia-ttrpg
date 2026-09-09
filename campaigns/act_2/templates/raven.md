---
type: character
name: "Raven"
profile: "Executor"
occupation: "Militar"
level: 6
portrait: "assets/portraits/raven.png"
token_image: "assets/portraits/raven.png"
resources:
  hp: { current: 28, max: 28 }
  dp: { current: 24, max: 24 }
attributes:
  physical: 10
  mind: 8
  emotion: 6
skills:
  - id: acrobacia
    name: "Acrobacia"
    governed_by: physical
    value: 4
  - id: tatica
    name: "Aptidão: Tática"
    governed_by: mind
    value: 10
    parent: "aptidao"
  - id: atletismo
    name: "Atletismo"
    governed_by: physical
    value: 8
  - id: crime
    name: "Crime"
    governed_by: physical
    value: 4
  - id: disciplina
    name: "Disciplina"
    governed_by: emotion
    value: 6
  - id: enganacao
    name: "Enganação"
    governed_by: emotion
    value: 4
  - id: furtividade
    name: "Furtividade"
    governed_by: physical
    value: 4
  - id: intimidar
    name: "Intimidar"
    governed_by: emotion
    value: 6
  - id: intuicao
    name: "Intuição"
    governed_by: emotion
    value: 4
  - id: luta
    name: "Luta"
    governed_by: physical
    value: 6
  - id: maquinas
    name: "Máquinas"
    governed_by: mind
    value: 10
  - id: medicina
    name: "Medicina"
    governed_by: mind
    value: 4
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
    value: 4
  - id: pontaria
    name: "Pontaria"
    governed_by: physical
    value: 10
  - id: sobrevivencia
    name: "Sobrevivência"
    governed_by: mind
    value: 8
  - id: tecnologia
    name: "Tecnologia"
    governed_by: mind
    value: 4
  - id: vigor
    name: "Vigor"
    governed_by: physical
    value: 10
abilities:
  - id: estoico
    name: "Estoico"
    description: "Você recebe +d6 em testes de trauma e, na primeira vez em que cada cena que faz um teste de trauma, recupera 9 PD."
    active: false
    effects:
      - operation: add
        quantity: 1
        unit: 6
        target: disciplina
  - id: impeto
    name: "Ímpeto"
    description: "Você possui uma barra de ímpeto com três espaços. Sempre que falha em um teste, você preenche um espaço na barra. Você pode apagar espaços preenchidos para: (1) receber +d4 em um teste. (3) aumentar um atributo em um passo até o fim da cena."
    active: false
    effects: []
  - id: para_bellum
    name: "Para Bellum"
    description: "Você recebe proficiência com armas de fogo e seu dano com essas armas aumenta em +2."
    active: false
    effects: []
---
# Anotações de Raven
