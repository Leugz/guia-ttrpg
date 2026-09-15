# Cortinas

Coloque aqui os vídeos (`mp4`, `webm`) ou imagens (`gif`/`webp`/`png`/`jpg`)
usados pela cortina da mesa — a tela que o mestre fecha para pausar a sessão.

Prefira `mp4`: é o mesmo loop de um GIF por uma fração dos bytes. Os vídeos
tocam sem som, em loop infinito, e entram e saem com dois segundos de fade.

Os arquivos são empacotados junto com a aplicação, então todo mundo na mesa
resolve a mesma imagem sem precisar baixá-la pela rede. Depois de adicionar um
arquivo aqui, recompile (`pnpm tauri build`) para que ele apareça no painel da
cortina (**V**, ou o botão do olho na barra de ferramentas).

Cada ato também pode ter as suas, em
`campaigns/act_N/templates/assets/curtains/`.
