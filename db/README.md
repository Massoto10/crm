# STN CRM database

## Entidades principais

`crm_clients`

Empresas que contratam e usam o CRM. Exemplo: Studio Rocha, Almeida Foods, Casa Vitta.

`end_customers`

Clientes finais de cada empresa que usa o CRM. Exemplo: uma pessoa que chama a Studio Rocha no WhatsApp ou a Casa Vitta no Instagram.

`labels`

Etiquetas reutilizaveis para classificacao comercial, perfil, risco, comportamento e canal.

`conversations`

Conversas por canal, sempre ligadas a um `crm_client` e a um `end_customer`.

`messages`

Historico de mensagens de cada conversa.

`tasks`

Proximas acoes comerciais ou operacionais vinculadas a um cliente final.

## Relacao

Um cliente do CRM pode ter muitos clientes finais.

Um cliente final pertence a um cliente do CRM.

Uma conversa pertence a um cliente do CRM e a um cliente final.

Labels podem ser globais ou especificas de um cliente do CRM.
