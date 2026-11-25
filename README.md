# D'Lola Doceria — site + painel (etapa 1: sem banco de dados)

Projeto estático (HTML, CSS e JavaScript puro). Abra `index.html` por um servidor local
(ex.: `python3 -m http.server`) ou publique a pasta em qualquer hospedagem estática.

## Estrutura

```
index.html            Site do cliente (rotas por hash: #/, #/cardapio, #/bolos, #/carrinho, #/pedido/ID)
admin/login.html      Login do painel (autenticação simulada)
admin/index.html      Painel (#/dashboard, #/produtos, #/categorias, #/estoque, #/bolos, #/pedidos, #/config)
admin/admin.js        Telas do painel
js/store.js           Telas do site, carrinho e checkout
js/db.js              ÚNICA camada de dados (hoje localStorage)  <- trocar na integração
js/ui.js              Modal, toast, helpers
css/                  base (tokens, claro/escuro), store, admin
_versao-anterior/     Arquivos de uma construção anterior, não usados (pode apagar)
```

## Como funciona hoje

- Dados de exemplo são criados na primeira abertura e ficam no `localStorage` do navegador.
- Site e painel precisam abrir na mesma origem (mesmo domínio) para compartilhar os dados.
- Login simulado: qualquer e-mail `@gmail.com` + senha de 6+ caracteres. **Não existe senha no código.**
- Pedidos feitos no site aparecem no painel; cancelar um pedido devolve o estoque.
- Imagens enviadas no painel são reduzidas e guardadas no navegador (limite de ~5 MB no total).
- Em Configurações há exportar/importar backup (.json) e restaurar os dados de exemplo.

## Ligando o banco de dados depois

Telas só falam com `window.DB` (`js/db.js`). Todas as funções já retornam Promise.
Para integrar (Firebase, Supabase etc.), reescreva `js/db.js` mantendo estas funções:

| DB.*                         | Tabela / coleção sugerida |
|------------------------------|---------------------------|
| `products.list/get/save/remove`   | `products` |
| `categories.list/save/remove/move/assignProducts` | `categories` |
| `cakes.get/saveConfig/saveItem/removeItem/moveItem` | `cake_config`, `cake_options(group)` |
| `orders.list/get/create/setStatus/remove` | `orders` + `order_items` |
| `settings.get/save`          | `settings` |
| `auth.login/logout/current`  | Auth real, liberando só o seu e-mail |

Pontos de atenção na versão real: validar preço e estoque no servidor (hoje isso acontece em
`orders.create`), proteger as rotas do painel com regras de segurança e guardar imagens em um
storage de arquivos em vez de data URL.
