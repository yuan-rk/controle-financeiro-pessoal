# YR Finanças v31 — emergência sem PWA/cache

Esta versão foi feita para resolver o problema em que o site não carregava depois das versões v29/v30.

Mudanças:
- Desativa temporariamente o PWA.
- Remove o manifest do HTML temporariamente.
- Desregistra Service Workers antigos.
- Apaga caches antigos do navegador.
- O sw.js agora se remove sozinho e não intercepta mais os arquivos.
- Mantém o redesign e as funções do app.

Depois que o site estabilizar, o PWA pode ser reativado numa versão futura com cache mais seguro.
