---
type: character
name: "Heitor"
profile: "Executor"
occupation: "Policial"
level: 6
portrait: "assets/portraits/heitor.png"
token_image: "assets/portraits/heitor.png"
resources:
  hp: { current: 34, max: 34 }
  dp: { current: 20, max: 20 }
attributes:
  physical: 10
  mind: 6
  emotion: 8
skills:
  - id: acrobacia
    name: "Acrobacia"
    governed_by: physical
    value: 4
  - id: tatica
    name: "Aptidão: Tática"
    governed_by: mind
    value: 8
    parent: "aptidao"
  - id: atletismo
    name: "Atletismo"
    governed_by: physical
    value: 10
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
    value: 10
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
    value: 6
  - id: pontaria
    name: "Pontaria"
    governed_by: physical
    value: 8
  - id: sobrevivencia
    name: "Sobrevivência"
    governed_by: mind
    value: 4
  - id: tecnologia
    name: "Tecnologia"
    governed_by: mind
    value: 4
  - id: vigor
    name: "Vigor"
    governed_by: physical
    value: 8
abilities:
  - id: impeto
    name: "Ímpeto"
    description: "Você possui uma barra de ímpeto com cinco espaços. Sempre que falha em um teste, você preenche um espaço na barra. Você pode apagar espaços preenchidos para: (1) receber +d4 em um teste. (1) receber +d10 em um dano. (3) aumentar um atributo em um passo até o fim da cena. (5) fazer uma ação extra na rodada."
    active: false
    effects: []
  - id: incansavel
    name: "Incansável"
    description: "Uma vez por cena de conflito, você pode gastar 5 PV para fazer uma ação extra."
    active: false
    effects: []
  - id: linha_de_tiro
    name: "Linha de Tiro"
    description: "Você recebe proficiência com armas de fogo e, quando faz um teste de ataque com essas armas, pode gastar 4 PD para receber +d10 no teste."
    active: false
    effects:
      - operation: add
        quantity: 1
        unit: 10
        target: pontaria
---
# Anotações de Heitor
