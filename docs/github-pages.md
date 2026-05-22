# Publicação no GitHub Pages

Este protótipo já está preparado para publicar com **GitHub Pages** usando **GitHub Actions**.

## O que você precisa

- uma conta no GitHub;
- um repositório novo, por exemplo `nit-prototipo`;
- subir o conteúdo da pasta `web-prototype` para esse repositório.

## Estrutura recomendada

O ideal é que o conteúdo de `web-prototype` vire a raiz do repositório no GitHub.

Arquivos importantes já prontos:

- `.github/workflows/pages.yml`
- `.nojekyll`
- `index.html`

## Passo a passo

1. Criar um repositório novo no GitHub.
2. Enviar para esse repositório **os arquivos de dentro** de `web-prototype`.
3. Garantir que a branch principal se chame `main`.
4. No GitHub, abrir:
   - `Settings`
   - `Pages`
5. Em **Build and deployment**, escolher:
   - `Source`: `GitHub Actions`
6. Voltar para a aba `Actions`.
7. Aguardar o workflow **Deploy GitHub Pages** terminar.
8. Copiar a URL pública gerada pelo GitHub Pages.

## URL esperada

Ela deve ficar parecida com:

`https://SEU-USUARIO.github.io/nit-prototipo/`

## Observações

- Como o protótipo é estático, não precisa de build.
- O workflow publica o conteúdo da raiz do repositório.
- O estado do protótipo continua local no navegador de cada avaliador via `localStorage`.
- Se você alterar os arquivos e fizer novo push para `main`, o Pages atualiza automaticamente.

## Sugestão de nomes

- repositório: `nit-prototipo`
- branch principal: `main`
- descrição: `Protótipo navegável do aplicativo do Núcleo de Inovação Tecnológica`
