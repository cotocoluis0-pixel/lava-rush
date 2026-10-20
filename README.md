# Lava Rush — guia rápido

Lava Rush é um protótipo multiplayer 3D para navegador. O site usa Three.js para a arena, Node.js/Express para servir a página e Socket.IO para salas e sincronização de jogadores.

## Rodar no computador

1. Instale Node.js LTS: https://nodejs.org/
2. Extraia o ZIP.
3. Abra um terminal dentro da pasta `lava-rush`.
4. Execute:
   ```bash
   npm install
   npm start
   ```
5. Abra http://localhost:3000

Para testar com duas pessoas no mesmo computador, abra o endereço em duas abas. Para amigos entrarem pela internet, publique o projeto num serviço que aceite aplicações Node.js persistentes, como Render ou Railway. Um site estático simples (por exemplo, apenas Netlify) não executa o servidor Socket.IO deste projeto.

## Publicar para amigos (Render)

1. Crie uma conta no GitHub e um repositório novo.
2. Envie os arquivos desta pasta ao repositório.
3. No Render, crie um **Web Service** conectado ao repositório.
4. Configure:
   - Build Command: `npm install`
   - Start Command: `npm start`
5. Publique e espere o serviço ficar pronto.
6. Abra a URL HTTPS gerada, crie uma sala e compartilhe o código.

Planos e limites gratuitos de hospedagem mudam com o tempo; confira as condições atuais do serviço escolhido.

## Controles

- PC: W/A/S/D ou setas para mover; Espaço para pular.
- Celular: direcional na tela e botão PULAR.
- Crie uma sala privada e compartilhe o código de 5 caracteres.

## Limitações desta primeira versão

- É um protótipo inicial, não um jogo pronto para produção.
- A sala e a rodada são mantidas em memória; reiniciar o servidor encerra as salas.
- A sincronização é simples e não tem proteção robusta contra trapaças.
- Não há contas, salvamento de moedas nem matchmaking público ainda.
- O código é gerado para uma sessão de servidor. Para um lançamento maior, seriam necessários validação de colisões no servidor, testes com vários dispositivos e melhorias de desempenho.
