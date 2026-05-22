# Protótipo NIT

Protótipo navegável do aplicativo do Núcleo de Inovação Tecnológica, preparado para demonstração e coleta de feedback.

## Como abrir localmente

Abra `index.html` no navegador ou rode um servidor local:

```bash
cd web-prototype
python3 -m http.server 4173
```

Depois acesse `http://localhost:4173`.

## Como publicar para avaliação

Este protótipo pode ser publicado como site estático. Os caminhos mais simples são:

- Netlify
- Vercel
- GitHub Pages

Os arquivos de configuração e o passo a passo estão em:

- [`docs/publicacao.md`](./docs/publicacao.md)
- [`docs/github-pages.md`](./docs/github-pages.md)
- [`docs/roteiro-avaliacao.md`](./docs/roteiro-avaliacao.md)
- [`docs/modelo-feedback.md`](./docs/modelo-feedback.md)

## Escopo da Fase 1

- Dashboard por perfil.
- Login independente simulado por seleção de perfil/usuário.
- Pesquisador vê apenas seus próprios processos.
- Jurídico vê apenas processos atribuídos.
- Coordenador e Administrador veem visão ampla.
- Status global editável apenas por Coordenador NIT e Administrador.
- Processo NIT com numeração anual automática simulada.
- Ciclo 1 AACIIm com pré-análise IA simulada e decisão humana.
- Mensagens processuais.
- Pendências processuais.
- Biblioteca documental simulada com versionamento preservado.
- Linha do tempo do processo para o pesquisador.
- Relatórios internos com indicadores iniciais.

## Próximos passos técnicos

1. Migrar para Vite + React + TypeScript.
2. Persistir dados em backend local ou Supabase/PostgreSQL antes da migração Microsoft 365.
3. Implementar autenticação real e RBAC.
4. Integrar OpenAI API para análise AACIIm de arquivos.
5. Gerar PDFs de parecer e certificado.
6. Gerar artefatos SharePoint/Power Apps a partir do modelo em `docs/modelo-dados-fase1.md`.
