# Publicação do Protótipo

Este protótipo é um site estático. Não exige backend para abrir e pode ser publicado rapidamente para avaliação do NIT.

## Opção 1 — Netlify

1. Criar uma conta em [Netlify](https://www.netlify.com/).
2. Criar um novo site por upload manual ou conectando um repositório Git.
3. Publicar a pasta `web-prototype`.
4. Confirmar que o arquivo `netlify.toml` foi reconhecido.
5. Compartilhar a URL pública gerada.

## Opção 2 — Vercel

1. Criar uma conta em [Vercel](https://vercel.com/).
2. Importar o projeto ou subir a pasta `web-prototype`.
3. Confirmar que o diretório publicado é a raiz da pasta.
4. Compartilhar a URL pública.

## Opção 3 — GitHub Pages

1. Criar um repositório.
2. Enviar o conteúdo da pasta `web-prototype`.
3. Ativar GitHub Pages nas configurações do repositório.
4. Escolher a branch principal e a pasta raiz.
5. Compartilhar a URL pública do Pages.

## Recomendação

Para feedback rápido, a melhor opção costuma ser **Netlify** ou **Vercel**, porque o link sai mais rápido e sem depender de ajustes extras.

## Observações para a avaliação

- Os dados ficam no `localStorage` do navegador.
- Cada avaliador verá o protótipo com o estado criado no próprio navegador.
- O protótipo não deve ser usado ainda como sistema oficial de produção.
- A análise de IA e a geração real de PDF ainda estão simuladas.
