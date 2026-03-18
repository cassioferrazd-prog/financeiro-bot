const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const client = new Client();

// QR Code
client.on('qr', qr => {
    qrcode.generate(qr, { small: true });
});

// Conectado
client.on('ready', () => {
    console.log('✅ WhatsApp conectado!');
});

// Banco de dados
const file = 'dados.json';

if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]));
}

function lerDados() {
    return JSON.parse(fs.readFileSync(file));
}

function salvarDados(dados) {
    fs.writeFileSync(file, JSON.stringify(dados, null, 2));
}

// Categoria automática
function detectarCategoria(texto) {
    if (texto.includes('gasolina') || texto.includes('uber')) return 'Transporte';
    if (texto.includes('almoço') || texto.includes('comida')) return 'Alimentação';
    if (texto.includes('frete') || texto.includes('entregador')) return 'Logística';
    if (texto.includes('fornecedor')) return 'Estoque';
    if (texto.includes('vendi') || texto.includes('recebi')) return 'Receita';
    return 'Outros';
}

// Adicionar registro
function adicionar(tipo, valor, descricao) {
    const dados = lerDados();

    dados.push({
        data: new Date().toISOString(),
        tipo,
        valor,
        descricao,
        categoria: detectarCategoria(descricao)
    });

    salvarDados(dados);
}

// Saldo total
function saldo() {
    const dados = lerDados();
    let total = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') total += item.valor;
        else total -= item.valor;
    });

    return total;
}

// Filtro por período
function filtrarPeriodo(periodo) {
    const dados = lerDados();
    const agora = new Date();

    return dados.filter(item => {
        const data = new Date(item.data);

        if (periodo === 'dia') {
            return data.toDateString() === agora.toDateString();
        }

        if (periodo === 'semana') {
            const inicio = new Date();
            inicio.setDate(agora.getDate() - 7);
            return data >= inicio;
        }

        if (periodo === 'mes') {
            return data.getMonth() === agora.getMonth() &&
                   data.getFullYear() === agora.getFullYear();
        }
    });
}

// Resumo por período
function resumoPeriodo(periodo) {
    const dados = filtrarPeriodo(periodo);

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') entradas += item.valor;
        else saidas += item.valor;
    });

    return `📊 ${periodo.toUpperCase()}
Entradas: R$ ${entradas}
Saídas: R$ ${saidas}
Saldo: R$ ${entradas - saidas}`;
}

// ⚠️ CONFIRA SE ESTE NÚMERO ESTÁ CORRETO
const meuNumero = '556296132409@c.us';

// BOT PRINCIPAL (APENAS UM!)
client.on('message_create', msg => {

    // ignora mensagens de outros
    if (msg.from !== meuNumero) return;

    // ignora grupos
    if (msg.from.includes('@g.us')) return;

    let texto = msg.body.toLowerCase().trim();

    // só funciona com "bot"
    if (!texto.startsWith('bot')) return;

    texto = texto.replace('bot', '').trim();

    // comandos
    if (texto === 'saldo') {
        msg.reply(`💰 Saldo: R$ ${saldo()}`);
        return;
    }

    if (texto === 'dia' || texto === 'semana' || texto === 'mes') {
        msg.reply(resumoPeriodo(texto));
        return;
    }

    // identificar tipo
    let tipo = '';
    let valor = 0;

    if (texto.includes('vendi') || texto.includes('recebi')) tipo = 'entrada';
    if (texto.includes('gastei') || texto.includes('paguei')) tipo = 'saida';

    // pegar valor
    const palavras = texto.split(' ');

    for (let p of palavras) {
        if (!isNaN(parseFloat(p))) {
            valor = parseFloat(p);
            break;
        }
    }

    if (!tipo) {
        msg.reply('❌ Use: bot vendi 100 ou bot gastei 50');
        return;
    }

    if (!valor) {
        msg.reply('❌ Valor não encontrado');
        return;
    }

    adicionar(tipo, valor, texto);

    msg.reply(`✅ Registrado!\n💰 Saldo: R$ ${saldo()}`);
});

// iniciar
client.initialize();