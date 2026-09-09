---
type: character
name: "Val"
profile: "Vigilante"
occupation: "Médico"
level: 6
portrait: "assets/portraits/val.png"
token_image: "assets/portraits/val.png"
resources:
  hp: { current: 18, max: 18 }
  dp: { current: 32, max: 32 }
attributes:
  physical: 6
  mind: 10
  emotion: 8
skills:
  - id: acrobacia
    name: "Acrobacia"
    governed_by: physical
    value: 4
  - id: exatas
    name: "Aptidão: Exatas"
    governed_by: mind
    value: 10
    parent: "aptidao"
  - id: atletismo
    name: "Atletismo"
    governed_by: physical
    value: 4
  - id: crime
    name: "Crime"
    governed_by: physical
    value: 4
  - id: disciplina
    name: "Disciplina"
    governed_by: emotion
    value: 10
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
    value: 4
  - id: medicina
    name: "Medicina"
    governed_by: mind
    value: 10
  - id: ocultismo
    name: "Ocultismo"
    governed_by: mind
    value: 8
  - id: percepcao
    name: "Percepção"
    governed_by: mind
    value: 6
  - id: persuasao
    name: "Persuasão"
    governed_by: emotion
    value: 8
  - id: pesquisar
    name: "Pesquisar"
    governed_by: mind
    value: 6
  - id: pontaria
    name: "Pontaria"
    governed_by: physical
    value: 10
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
  - id: prontidao
    name: "Prontidão"
    description: "No início de qualquer conflito, você pode gastar 3 PD. Se fizer isso, ganha uma rodada na qual pode agir antes dos demais personagens e NPCs."
    active: false
    effects: []
  - id: tecnica_medicinal
    name: "Técnica Medicinal"
    description: "Sempre que você usa um efeito que cura pontos de vida, seu efeito cura +1 PV (ou +1 PV por dado)."
    active: false
    effects: []
  - id: varredura_ampla
    name: "Varredura Ampla"
    description: "Quando investiga um ponto de interesse, você pode escolher duas perícias e receber informações de ambas."
    active: false
    effects: []
---
# Anotações de Val
