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

Esta versão inclui manifest.json, sw.js e ícones para instalação na tela inicial do celular. Após subir ao GitHub Pages, acesse com ?v=20 e limpe/cache se necessário.
