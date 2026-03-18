const fs = require('fs');

// arquivo onde salva os dados
const file = 'dados.json';

// cria arquivo se não existir
if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify([]));
}

// ler dados
function lerDados() {
    return JSON.parse(fs.readFileSync(file));
}

// salvar dados
function salvarDados(dados) {
    fs.writeFileSync(file, JSON.stringify(dados, null, 2));
}

// detectar categoria automaticamente
function detectarCategoria(texto) {
    if (texto.includes('gasolina') || texto.includes('uber')) return 'Transporte';
    if (texto.includes('almoço') || texto.includes('comida')) return 'Alimentação';
    if (texto.includes('frete') || texto.includes('entregador')) return 'Logística';
    if (texto.includes('fornecedor')) return 'Estoque';
    if (texto.includes('venda') || texto.includes('vendi') || texto.includes('recebi')) return 'Receita';
    return 'Outros';
}

// adicionar movimentação
function adicionar(tipo, valor, descricao, dataManual = null) {
    const dados = lerDados();

    const data = dataManual
        ? new Date(dataManual.split('/').reverse().join('-'))
        : new Date();

    const categoria = detectarCategoria(descricao);

    dados.push({
        data: data.toISOString(),
        tipo,
        valor,
        descricao,
        categoria
    });

    salvarDados(dados);
}

// saldo total
function saldo() {
    const dados = lerDados();

    let total = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') total += item.valor;
        else total -= item.valor;
    });

    return total;
}

// relatório geral
function relatorio() {
    const dados = lerDados();

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        if (item.tipo === 'entrada') entradas += item.valor;
        else saidas += item.valor;
    });

    console.log('\n📊 RELATÓRIO GERAL');
    console.log('Entradas: R$', entradas);
    console.log('Saídas: R$', saidas);
    console.log('Saldo: R$', entradas - saidas);
}

// resumo por período
function resumoPeriodo(filtro) {
    const dados = lerDados();
    const hoje = new Date();

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        const dataItem = new Date(item.data);

        let incluir = false;

        if (filtro === 'hoje') {
            incluir = dataItem.toDateString() === hoje.toDateString();
        }

        if (filtro === 'semana') {
            const diff = (hoje - dataItem) / (1000 * 60 * 60 * 24);
            incluir = diff <= 7;
        }

        if (filtro === 'mes') {
            incluir =
                dataItem.getMonth() === hoje.getMonth() &&
                dataItem.getFullYear() === hoje.getFullYear();
        }

        if (incluir) {
            if (item.tipo === 'entrada') entradas += item.valor;
            else saidas += item.valor;
        }
    });

    console.log(`\n📊 RESUMO (${filtro.toUpperCase()})`);
    console.log('Entradas: R$', entradas);
    console.log('Saídas: R$', saidas);
    console.log('Saldo: R$', entradas - saidas);
}

// relatório por categoria
function relatorioDetalhado() {
    const dados = lerDados();

    let categorias = {};

    dados.forEach(item => {
        if (!categorias[item.categoria]) {
            categorias[item.categoria] = 0;
        }

        if (item.tipo === 'saida') {
            categorias[item.categoria] += item.valor;
        }
    });

    console.log('\n📊 GASTOS POR CATEGORIA');

    for (let cat in categorias) {
        console.log(`${cat}: R$ ${categorias[cat]}`);
    }
}

// exportar relatório para arquivo
function exportarRelatorio() {
    const dados = lerDados();

    let texto = 'RELATORIO FINANCEIRO\n\n';

    let entradas = 0;
    let saidas = 0;

    dados.forEach(item => {
        texto += `${item.data} | ${item.tipo} | R$${item.valor} | ${item.categoria} | ${item.descricao}\n`;

        if (item.tipo === 'entrada') entradas += item.valor;
        else saidas += item.valor;
    });

    texto += '\n--- RESUMO ---\n';
    texto += `Entradas: R$ ${entradas}\n`;
    texto += `Saídas: R$ ${saidas}\n`;
    texto += `Saldo: R$ ${entradas - saidas}\n`;

    fs.writeFileSync('relatorio.txt', texto);

    console.log('📁 Relatório exportado como relatorio.txt');
}

// interpretar mensagem
function interpretar(msg) {

    msg = msg.trim().toLowerCase();

    // comandos
    if (msg === 'relatorio') {
        relatorio();
        return;
    }

    if (msg === 'categorias') {
        relatorioDetalhado();
        return;
    }

    if (msg === 'exportar') {
        exportarRelatorio();
        return;
    }

    if (msg === 'hoje' || msg === 'semana' || msg === 'mes') {
        resumoPeriodo(msg);
        return;
    }

    const palavras = msg.split(' ');

    let tipo = '';
    let valor = 0;
    let dataManual = null;

    // detectar data no início
    if (palavras[0].includes('/')) {
        dataManual = palavras[0];
        palavras.shift();
    }

    const texto = palavras.join(' ');

    // identificar tipo
    if (texto.includes('vendi') || texto.includes('recebi')) {
        tipo = 'entrada';
    } else if (texto.includes('gastei') || texto.includes('paguei')) {
        tipo = 'saida';
    } else {
        console.log('❌ Não entendi a mensagem');
        return;
    }

    // encontrar valor
    for (let p of palavras) {
        if (!isNaN(parseFloat(p))) {
            valor = parseFloat(p);
            break;
        }
    }

    if (!valor) {
        console.log('❌ Valor não encontrado');
        return;
    }

    adicionar(tipo, valor, texto, dataManual);

    console.log('✅ Registrado!');
    console.log('💰 Saldo atual: R$', saldo());
}

// terminal
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

console.log('Digite: 18/03/2026 vendi 2000');

readline.on('line', (input) => {
    interpretar(input);
});