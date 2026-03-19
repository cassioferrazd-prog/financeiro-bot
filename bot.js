const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const ARQUIVO_DADOS = 'dados.json';
const MEU_NUMERO = '5562996132409@c.us';

// cria arquivo de dados se não existir
if (!fs.existsSync(ARQUIVO_DADOS)) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify([]));
}

function lerDados() {
    return JSON.parse(fs.readFileSync(ARQUIVO_DADOS));
}

function salvarDados(dados) {
    fs.writeFileSync(ARQUIVO_DADOS, JSON.stringify(dados, null, 2));
}

// iniciar cliente WhatsApp
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// QR CODE
client.on('qr', qr => {
    console.log('================================');
    console.log('ESCANEIE O QR CODE ABAIXO');
    console.log('================================');

    qrcode.generate(qr, { small: true });
});

// conectado
client.on('ready', () => {
    console.log('✅ WhatsApp conectado!');
});

// autenticado
client.on('authenticated', () => {
    console.log('🔐 Autenticado com sucesso!');
});

// falha auth
client.on('auth_failure', msg => {
    console.log('❌ Falha na autenticação', msg);
});

// desconectado
client.on('disconnected', reason => {
    console.log('⚠️ WhatsApp desconectado', reason);
});

// função saldo
function saldoTotal() {
    const dados = lerDados();

    let total = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') total += item.valor;
        else total -= item.valor;
    });

    return total;
}

// adicionar lançamento
function adicionar(tipo, valor, descricao) {
    const dados = lerDados();

    dados.push({
        data: new Date().toISOString(),
        tipo,
        valor,
        descricao
    });

    salvarDados(dados);
}

// resumo do mês
function resumoMes() {

    const dados = lerDados();
    const agora = new Date();

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {

        const data = new Date(item.data);

        if (
            data.getMonth() === agora.getMonth() &&
            data.getFullYear() === agora.getFullYear()
        ) {

            if (item.tipo === 'entrada') entradas += item.valor;
            else saidas += item.valor;

        }

    });

    return `📊 RELATÓRIO DO MÊS

Entradas: R$ ${entradas}
Saídas: R$ ${saidas}
Saldo: R$ ${entradas - saidas}`;
}

// escutar mensagens
client.on('message_create', async msg => {

    if (msg.from.includes('@g.us')) return;

    if (msg.from !== MEU_NUMERO) return;

    let texto = msg.body.toLowerCase().trim();

    if (!texto.startsWith('bot')) return;

    const comando = texto.replace('bot', '').trim();

    // saldo
    if (comando === 'saldo') {

        await msg.reply(`💰 Saldo: R$ ${saldoTotal()}`);
        return;

    }

    // relatório
    if (comando === 'relatorio') {

        await msg.reply(resumoMes());
        return;

    }

    // entrada
    if (comando.startsWith('vendi') || comando.startsWith('recebi')) {

        const valor = parseFloat(comando.split(' ')[1]);

        if (!valor) {
            await msg.reply('❌ Valor inválido');
            return;
        }

        adicionar('entrada', valor, comando);

        await msg.reply(`✅ Entrada registrada

Saldo atual: R$ ${saldoTotal()}`);

        return;
    }

    // saída
    if (comando.startsWith('gastei') || comando.startsWith('paguei')) {

        const valor = parseFloat(comando.split(' ')[1]);

        if (!valor) {
            await msg.reply('❌ Valor inválido');
            return;
        }

        adicionar('saida', valor, comando);

        await msg.reply(`✅ Saída registrada

Saldo atual: R$ ${saldoTotal()}`);

        return;
    }

});

// iniciar bot
client.initialize();