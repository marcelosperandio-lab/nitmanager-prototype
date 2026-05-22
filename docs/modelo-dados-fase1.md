# Modelo de Dados - Fase 1

Este modelo representa a primeira versão local/protótipo, mantendo nomes internos em português e compatibilidade conceitual com SharePoint Lists.

## Processos_NIT

| Campo | Tipo | Observação |
| --- | --- | --- |
| ProcessoNIT_ID | texto | Gerado automaticamente no formato `NIT-AAAA-0001`, reiniciando por ano. |
| Titulo_Projeto | texto | Nome do projeto. |
| Resumo_Projeto | texto longo | Base para análise AACIIm. |
| Pesquisador_ID | texto | Identificador do autor/responsável. |
| Pesquisador_Nome | texto | Nome do pesquisador. |
| Orientador_Nome | texto | Nome do orientador. |
| Programa_Curso | texto | Programa ou curso. |
| Tipo_ProdutoTecnico | escolha | Aplicativo, Software, Manual, POP, Curso, Protocolo, Outro. |
| Fase_Atual | escolha | Ciclo 1 - AACIIm Inicial, Ciclo 2 - Jurídico, Ciclo 3 - Dissertação Final, Concluído, Suspenso, Arquivado. |
| Status_Atual | escolha | Submetido, Em triagem, Em avaliação, Aguardando ajustes, Em tramitação jurídica, Apto para submissão final, Em avaliação final, Certificado emitido, Encerrado, Indeferido. |
| Responsavel_Atual_ID | texto | Usuário interno responsável. |
| Juridico_Atribuido_ID | texto | Jurídico responsável, quando aplicável. |
| Data_Abertura_Processo | data | Abertura do processo. |
| Data_Ultima_Atualizacao | data | Última alteração. |
| Data_Limite_Ciclo1 | data | Prazo do ciclo 1. |
| Data_Limite_Ciclo2 | data | Prazo do ciclo 2. |
| Data_Limite_Ciclo3 | data | Prazo do ciclo 3. |
| ParecerInicial_Numero | texto | Formato oficial pendente. |
| CertificadoFinal_Numero | texto | Formato oficial pendente. |
| Possui_Pendencias_Abertas | booleano | Atualizado por regra. |
| Atrasado | booleano | Atualizado por regra. |
| Dias_Em_Atraso | número | Calculado a partir de prazos. |

## Ciclo1_AACIIm

| Campo | Tipo | Observação |
| --- | --- | --- |
| ProcessoNIT_ID | texto | Vínculo com `Processos_NIT`. |
| Arquivo_Projeto_ID | texto | Documento enviado na submissão inicial. |
| PreAnaliseGPT_Gerada | booleano | Indica se houve sugestão IA. |
| GPT_Aderencia | número | Escore sugerido. |
| GPT_Aplicabilidade | número | Escore sugerido. |
| GPT_Complexidade | número | Escore sugerido. |
| GPT_Inovacao | número | Escore sugerido. |
| GPT_Impacto | número | Escore sugerido. |
| GPT_SinteseAnalitica | texto longo | Síntese IA. |
| GPT_PontosFortes | texto longo | Pontos fortes. |
| GPT_Fragilidades | texto longo | Fragilidades. |
| GPT_RecomendacaoPreliminar | escolha | Favorável, Favorável com ajustes, Desfavorável no estado atual. |
| AvaliadorNIT_ID | texto | Membro do NIT. |
| Humano_SinteseFinal | texto longo | Parecer humano. |
| Humano_DecisaoFinal | escolha | Aprovado, Aprovado com ajustes, Reprovado, Devolvido para complementação. |
| ParecerInicial_Numero | texto | Gerado no encerramento do ciclo. |

## Mensagens_Processuais

| Campo | Tipo | Observação |
| --- | --- | --- |
| Mensagem_ID | texto | Identificador local. |
| ProcessoNIT_ID | texto | Vínculo com processo. |
| Ciclo | escolha | Ciclo 1, Ciclo 2, Ciclo 3. |
| Remetente_ID | texto | Usuário remetente. |
| Destinatario_ID | texto | Usuário destinatário. |
| Tipo_Mensagem | escolha | Solicitação de ajuste, Resposta, Esclarecimento, Devolutiva técnica, Devolutiva jurídica, Registro de decisão. |
| Assunto | texto | Assunto da mensagem. |
| Corpo_Mensagem | texto longo | Conteúdo. |
| Data_Envio | data | Envio. |
| Lida | booleano | Controle de leitura. |
| Pendencia_ID | texto opcional | Vínculo com pendência. |

## Pendencias_Processuais

| Campo | Tipo | Observação |
| --- | --- | --- |
| Pendencia_ID | texto | Identificador local. |
| ProcessoNIT_ID | texto | Vínculo com processo. |
| Ciclo | escolha | Ciclo 1, Ciclo 2, Ciclo 3. |
| Tipo_Pendencia | escolha | Documental, Técnica, Jurídica, Metodológica, Administrativa, Outra. |
| Descricao_Pendencia | texto longo | Descrição. |
| Prazo_Resposta | data | Prazo. |
| Status_Pendencia | escolha | Aberta, Respondida, Resolvida, Reaberta, Cancelada. |
| Responsavel_Resposta_ID | texto | Usuário responsável. |
| Critica | booleano | Prioridade crítica. |

## Documentos_Processos_NIT

| Campo | Tipo | Observação |
| --- | --- | --- |
| Documento_ID | texto | Identificador lógico. |
| ProcessoNIT_ID | texto | Vínculo com processo. |
| Tipo_Documento | escolha | Projeto inicial, Contrato de Convênio Acadêmico, Contrato de Prestação de Serviço, Termo Aditivo ao Contrato, Termo de Cessão de Direito, Parecer inicial, Certificado final. |
| Ciclo | escolha | Ciclo 1, Ciclo 2, Ciclo 3. |
| Nome_Arquivo | texto | Nome original. |
| Versao | número | Cada upload cria uma nova versão preservada. |
| Status_Documento | escolha | Submetido, Em análise, Aprovado, Substituído, Emitido. |
| Data_Upload | data | Data de envio. |
| EnviadoPor_ID | texto | Usuário responsável. |

## Regras da Fase 1

- O pesquisador visualiza apenas processos em que é o responsável.
- O jurídico visualiza apenas processos atribuídos a ele.
- Coordenador NIT e Administrador visualizam todos os processos.
- Apenas Coordenador NIT e Administrador alteram `Fase_Atual` e `Status_Atual`.
- Ciclo 2 depende do Ciclo 1, mas o Ciclo 3 pode retornar ao Ciclo 2.
- Processos podem ser Suspensos ou Arquivados em qualquer fase por Coordenador NIT ou Administrador.
- A pré-análise IA sugere escores, mas não decide.
- O parecer inicial pode ser emitido por membro NIT.
- O parecer final preliminar é emitido por membro NIT e validado pelo Coordenador.
- Certificado final é emitido pelo Coordenador NIT.
