# YR Finanças — Controle financeiro pessoal

Sistema web estático para controle de faturas de cartão, compras parceladas, compras de terceiros, devedores, recebimentos, cartões, estabelecimentos e categorias.

## Estrutura

```
controle-financeiro-pessoal/
├── index.html
├── styles.css
├── app.js
└── README.md
```

## Como rodar localmente

Opção simples:
1. Extraia o ZIP.
2. Abra o arquivo `index.html` no navegador.
3. Use normalmente.

Opção recomendada com servidor local:

```bash
cd controle-financeiro-pessoal
python -m http.server 8080
```

Depois abra `http://localhost:8080` no navegador.

## Como os dados são salvos

Os dados ficam no LocalStorage do navegador, na chave:

```text
fincard-pro-data-v1
```

Isso significa que os dados ficam no dispositivo/navegador usado. Se limpar o navegador, trocar de aparelho ou abrir em outro navegador, os dados não aparecem automaticamente.

## Backup

Na tela Configurações:
1. Clique em **Exportar JSON**.
2. Guarde o arquivo baixado em local seguro.
3. Para restaurar, clique em **Importar JSON** e selecione o arquivo.

## Hospedagem gratuita

Como o projeto é HTML, CSS e JavaScript puro, pode ser hospedado em qualquer hospedagem estática, como GitHub Pages, Netlify ou Vercel.

## Melhorias futuras sugeridas

- Backend com login para sincronizar entre celular e computador.
- Banco de dados real, como Supabase, Firebase ou PostgreSQL.
- Controle de fechamento de fatura baseado no dia de fechamento do cartão.
- Alertas automáticos de vencimento.
- Relatórios em PDF.
- Exportação para CSV/Excel.
- PWA para instalar no celular.
- Edição avançada de parcelas individuais.
- Rateio entre mais de uma pessoa na mesma compra.


## PWA

Esta versão inclui manifest.json, sw.js e ícones para instalação na tela inicial do celular. Após subir ao GitHub Pages, acesse com ?v=25 e limpe/cache se necessário.


## v25.4 navegação corrigida
- PC/tablet touch mantêm a barra inferior completa, como na v25 original.
- Telefone usa barra compacta com 5 botões e "Mais".
- Botão "Mais" abre o menu no telefone.
- Sem mudanças em Supabase, banco, compras ou parcelamento.


## v25.5 ícones
- Mantém a navegação da v25.4 funcionando.
- Troca os emojis antigos por símbolos mais limpos.
- Preserva a barra inferior completa no PC/tablet.
- Preserva a barra compacta com "Mais" no telefone.


## v25.6 mobile scroll
- Telefone volta a mostrar todos os itens na barra inferior.
- Barra inferior tem rolagem lateral.
- Remove o botão "Mais".
- Corrige filtros no telefone para não cortar ano e forma de pagamento.


## v25.7 cache fix
- Mantém as mudanças da v25.6.
- Força o navegador a baixar `styles.css?v=257` e `app.js?v=257`.
- Corrige o caso em que o telefone carregava CSS novo, mas mantinha app.js antigo com o botão "Mais".


## v25.8 lembrar mês do dashboard
- Lembra apenas o mês escolhido no dashboard.
- O ano continua automático pelo ano atual.
- Exemplo: se você deixou em julho, ao reabrir volta em julho do ano atual.
- Não altera banco, Supabase, compras, parcelas ou regras financeiras.


## v25.9 correção dos filtros do dashboard
- Corrige a troca de mês/ano/forma no dashboard.
- Ao mudar o mês, o dashboard recalcula imediatamente.
- Continua lembrando apenas o mês escolhido.
- O ano continua automático ao abrir o app.


## v25.10 correção do tema claro
- Corrige contraste e fundos no tema claro.
- Remove o efeito de camada cinza/escura na visão geral financeira.
- Mantém todas as correções da v25.9.


## v25.11 correção dos gráficos mobile
- Corrige gráficos vazando para fora do card no telefone.
- Limita canvas e altura dos gráficos no mobile.
- Ajusta legenda dos gráficos para telas pequenas.
- Mantém todas as melhorias da v25.10.


## v25.12 toque na aba ativa volta ao topo
- Ao tocar na aba atual novamente, a página rola suavemente para o topo.
- Ao trocar de página, a nova aba também abre no topo.
- Mantém todas as melhorias da v25.11.


## v25.13 dashboard PC redesign
- Redesign real do Dashboard para PC/tablet largo.
- Cards superiores com ícones em SVG inline.
- Resumo rápido redesenhado com gráfico circular CSS e insights úteis.
- Meus cartões redesenhado com cartões realistas em HTML/CSS.
- Não usa placeholders de imagem.
- Não altera banco, Supabase, compras, parcelas ou regras financeiras.
