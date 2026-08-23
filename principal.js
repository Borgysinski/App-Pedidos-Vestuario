function getGroups() {
  const defaultGroups = [
    { name: "Calças Cargo<br>Grade com 14 peças<br>Distribuição: 2 P • 4 M • 4 G • 4 GG", items: [
      { name: "Grade Calças Cargo Preta", image: "Midias/Calças Cargo/Preta.jpg", quantity: 0, cor: "#2e2e2e" },
      { name: "Grade Calças Cargo Caqui", image: "Midias/Calças Cargo/Caqui.png", quantity: 0, cor: "#a49262" },
      { name: "Grade Calças Cargo Areia", image: "Midias/Calças Cargo/Areia.jpg", quantity: 0, cor: "#ded4bd" },
      { name: "Grade Calças Cargo Castor", image: "Midias/Calças Cargo/Castor.png", quantity: 0, cor: "#766551" },
      { name: "Grade Calças Cargo Verde Militar", image: "Midias/Calças Cargo/Verde.jpg", quantity: 0, cor: "#5D6532" },
      { name: "Grade Calças Cargo Azul Marinho", image: "Midias/Calças Cargo/Marinho.png", quantity: 0, cor: "#1c2d4f" },
      { name: "Grade Calças Cargo Cinza", image: "Midias/Calças Cargo/Cinza.png", quantity: 0, cor: "#6a6d72" },
    ]},
    { name: "Bermudas Cargo<br>Grade com 14 peças<br>Distribuição: 2 P • 4 M • 4 G • 4 GG", items: [
      { name: "Grade Bermudas Cargo Preta", image: "Midias/Bermudas Cargo/Preta.png", quantity: 0, cor: "#2e2e2e" },
    ]},
    { name: "Calças Cargo Plus Size<br>Grade com 12 peças<br>Distribuição: 3 G1 • 3 G2 • 3 G3 • 3 G4", items: [

    ]},
    { name: "Bermudas Cargo Plus Size<br>Grade com 12 peças<br>Distribuição: 3 G1 • 3 G2 • 3 G3 • 3 G4", items: [

    ]},
    { name: "Calças Cargo com Punho<br>Grade com 14 peças<br>Distribuição: 2 P • 4 M • 4 G • 4 GG", items: [

    ]},
  ];
  // Retorna sempre os grupos padrão; não dependemos de localStorage
  return defaultGroups;
}

// Mantém os grupos em memória para aplicar atualizações em tempo real
let groups = getGroups();

// Gera o mesmo ID de produto usado no admin, a partir do nome do item
// (compartilhado entre o listener de estoque e a reserva no checkout)
function makeProdutoId(groupName, itemName) {
  const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, ' ');
  const base = `${stripHtml(itemName)}`;
  return base
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[.#$\[\]\//]/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim()
    .toLowerCase();
}

// ==========================================================
// CARRINHO DE COMPRAS
// ==========================================================

// 🔗 Número de WhatsApp que vai receber o pedido final (DDI+DDD+numero, só números)
const NUMERO_WHATSAPP = "5519974264534"; // <-- troque pelo seu número

// Carrinho em memória: cada item = { chave, name, image, groupName, quantity, estoqueDisponivel, cor }
let carrinho = [];

function chaveItem(groupName, itemName) {
  return `${groupName}__${itemName}`;
}

function obterQuantidadeNoCarrinho(groupName, itemName) {
  const chave = chaveItem(groupName, itemName);
  const existente = carrinho.find(c => c.chave === chave);
  return existente ? existente.quantity : 0;
}

// Ponto único de verdade: define a quantidade de um item no carrinho.
// 0 (ou menos) remove o item automaticamente. Retorna a quantidade final aplicada.
function sincronizarQuantidadeCarrinho(item, groupName, novaQtd) {
  novaQtd = parseInt(novaQtd, 10);
  if (isNaN(novaQtd) || novaQtd < 0) novaQtd = 0;

  const estoqueDisponivel = item.quantity || 0;
  if (novaQtd > estoqueDisponivel) novaQtd = estoqueDisponivel;

  const chave = chaveItem(groupName, item.name);
  const existente = carrinho.find(c => c.chave === chave);

  if (novaQtd <= 0) {
    if (existente) carrinho = carrinho.filter(c => c.chave !== chave);
  } else if (existente) {
    existente.quantity = novaQtd;
  } else {
    carrinho.push({
      chave,
      name: item.name,
      image: item.image,
      groupName,
      quantity: novaQtd,
      estoqueDisponivel,
      cor: item.cor || "#2a2a2a"
    });
  }

  renderCarrinho();
  sincronizarInputsCatalogo();
  return novaQtd;
}

// Mantém os contadores exibidos no catálogo sempre iguais ao carrinho
// (útil quando a quantidade é alterada pelo painel do carrinho)
function sincronizarInputsCatalogo() {
  document.querySelectorAll(".input-qtd-item").forEach(input => {
    const chave = input.dataset.chave;
    const itemCarrinho = carrinho.find(c => c.chave === chave);
    input.value = itemCarrinho ? itemCarrinho.quantity : 0;
  });
}

function totalItensCarrinho() {
  return carrinho.reduce((soma, c) => soma + c.quantity, 0);
}

function montarMensagemPedido() {
  if (carrinho.length === 0) return "";
  let linhas = ["Olá! Gostaria de fazer o seguinte pedido:", ""];
  carrinho.forEach(c => {
    const nomeLimpo = c.name.replace(/<[^>]*>/g, " ").trim();
    linhas.push(`• ${nomeLimpo} — Qtd: ${c.quantity}`);
  });
  linhas.push("");
  linhas.push(`Total de grades: ${totalItensCarrinho()}`);
  return linhas.join("\n");
}

// Garante que o cliente esteja autenticado (anonimamente) antes de gravar no Firebase.
// Necessário porque as regras do Realtime Database exigem auth != null para escrita.
function garantirAutenticacaoCliente() {
  return new Promise((resolve) => {
    if (typeof firebase === 'undefined' || !firebase.auth) {
      resolve(null);
      return;
    }
    const usuarioAtual = firebase.auth().currentUser;
    if (usuarioAtual) {
      resolve(usuarioAtual);
      return;
    }
    firebase.auth().signInAnonymously()
      .then((cred) => resolve(cred.user))
      .catch((err) => {
        console.warn('Falha ao autenticar cliente anonimamente:', err);
        resolve(null);
      });
  });
}

// Salva o pedido no Firebase (nó "pedidos") para aparecer no painel admin.
// Se der erro (ex: sem internet), não trava o fluxo do cliente — o WhatsApp abre de qualquer forma.
async function salvarPedidoNoFirebase() {
  if (typeof firebase === 'undefined' || !firebase.database) return;
  try {
    await garantirAutenticacaoCliente();
    const payload = {
      itens: carrinho.map(c => ({
        nome: c.name.replace(/<[^>]*>/g, " ").trim(),
        grupo: (c.groupName || '').replace(/<[^>]*>/g, " ").trim(),
        quantidade: c.quantity
      })),
      totalItens: totalItensCarrinho(),
      status: "pendente",
      criadoEm: firebase.database.ServerValue.TIMESTAMP
    };
    await firebase.database().ref('pedidos').push(payload);
  } catch (err) {
    console.error('Não foi possível salvar o pedido no Firebase:', err);
  }
}

// Tenta reservar (debitar) o estoque de cada item do carrinho de forma atômica.
// Usa transação do Firebase: se dois clientes tentarem levar a última unidade ao
// mesmo tempo, o Firebase garante que só um dos dois consiga debitar com sucesso.
// Retorna um array com o resultado de cada item (sucesso ou não).
function reservarEstoqueCarrinho() {
  const tentativas = carrinho.map((c) => {
    const produtoId = makeProdutoId(c.groupName, c.name);
    const ref = firebase.database().ref('estoque/' + produtoId + '/quantity');

    return ref.transaction((quantidadeAtual) => {
      const atual = Number.isFinite(quantidadeAtual) ? quantidadeAtual : parseInt(quantidadeAtual || 0, 10);
      if (isNaN(atual) || atual < c.quantity) {
        // Retornar undefined aborta a transação sem alterar nada no banco
        return;
      }
      return atual - c.quantity;
    }).then((resultado) => ({
      nome: c.name,
      quantidadeSolicitada: c.quantity,
      produtoId,
      sucesso: !!resultado.committed
    }));
  });

  return Promise.all(tentativas);
}

// Desfaz reservas que já tinham dado certo, devolvendo a quantidade ao estoque.
// Usado quando algum OUTRO item do mesmo carrinho falhou, para não deixar
// unidades "presas" reservadas para um pedido que não vai ser enviado.
function devolverEstoqueReservado(itensParaDevolver) {
  const devolucoes = itensParaDevolver.map((item) => {
    const ref = firebase.database().ref('estoque/' + item.produtoId + '/quantity');
    return ref.transaction((quantidadeAtual) => {
      const atual = Number.isFinite(quantidadeAtual) ? quantidadeAtual : parseInt(quantidadeAtual || 0, 10);
      return (isNaN(atual) ? 0 : atual) + item.quantidadeSolicitada;
    });
  });
  return Promise.all(devolucoes);
}

async function finalizarPedido() {
  if (carrinho.length === 0) {
    alert("Seu carrinho está vazio. Ajuste a quantidade de alguma grade antes de finalizar.");
    return;
  }

  await garantirAutenticacaoCliente();

  const resultados = await reservarEstoqueCarrinho();
  const falhas = resultados.filter((r) => !r.sucesso);

  if (falhas.length > 0) {
    // Devolve ao estoque o que já tinha sido reservado com sucesso, já que o
    // pedido inteiro não vai ser enviado (evita "prender" estoque à toa)
    const sucessos = resultados.filter((r) => r.sucesso);
    if (sucessos.length > 0) {
      await devolverEstoqueReservado(sucessos);
    }

    const nomesFalha = falhas
      .map((f) => f.nome.replace(/<[^>]*>/g, " ").trim())
      .join(", ");
    alert(`Ops! Enquanto você finalizava, o estoque mudou e não há mais quantidade suficiente de: ${nomesFalha}. Ajuste a quantidade no carrinho e tente novamente.`);
    return;
  }

  // Todos os itens foram reservados com sucesso — agora sim registra o pedido e avisa no WhatsApp
  await salvarPedidoNoFirebase();

  const mensagem = encodeURIComponent(montarMensagemPedido());
  const url = `https://wa.me/${NUMERO_WHATSAPP}?text=${mensagem}`;
  window.open(url, "_blank");

  // Limpa o carrinho, já que o estoque foi debitado de verdade
  carrinho = [];
  renderCarrinho();
  sincronizarInputsCatalogo();
}

// ---- UI do carrinho (criada dinamicamente, sem precisar mexer no HTML) ----
// Posicionamento (lateral no desktop / gaveta de baixo no mobile) fica
// definido inteiramente no CSS através da classe "aberto".

function criarUICarrinho() {
  // Botão flutuante
  const botaoFlutuante = document.createElement("div");
  botaoFlutuante.id = "carrinho-flutuante";
  botaoFlutuante.innerHTML = `🛒 <span id="carrinho-contador">0</span>`;
  botaoFlutuante.addEventListener("click", toggleCarrinho);

  // Painel do carrinho
  const painel = document.createElement("div");
  painel.id = "carrinho-painel";
  painel.innerHTML = `
    <div id="carrinho-alca"></div>
    <div class="carrinho-header">
      <h2>Seu Pedido</h2>
      <span id="fechar-carrinho">&times;</span>
    </div>
    <div id="carrinho-itens"></div>
    <button id="btn-finalizar-pedido">Finalizar pedido no WhatsApp</button>
  `;

  document.body.appendChild(botaoFlutuante);
  document.body.appendChild(painel);

  document.getElementById("fechar-carrinho").addEventListener("click", fecharCarrinho);
  document.getElementById("btn-finalizar-pedido").addEventListener("click", finalizarPedido);
}

function toggleCarrinho() {
  const painel = document.getElementById("carrinho-painel");
  if (painel.classList.contains("aberto")) {
    fecharCarrinho();
  } else {
    abrirCarrinho();
  }
}

function abrirCarrinho() {
  document.getElementById("carrinho-painel").classList.add("aberto");
}

function fecharCarrinho() {
  document.getElementById("carrinho-painel").classList.remove("aberto");
}

function renderCarrinho() {
  const contador = document.getElementById("carrinho-contador");
  const itensDiv = document.getElementById("carrinho-itens");
  if (!contador || !itensDiv) return;

  contador.textContent = totalItensCarrinho();

  if (carrinho.length === 0) {
    itensDiv.innerHTML = `<p class="carrinho-vazio">Seu carrinho está vazio.</p>`;
    return;
  }

  itensDiv.innerHTML = "";
  carrinho.forEach(c => {
    const linha = document.createElement("div");
    linha.className = "carrinho-linha";
    linha.innerHTML = `
      <span class="cor-swatch" style="background:${c.cor};"></span>
      <img src="${c.image}" alt="${c.name}">
      <div class="carrinho-linha-info">
        <div class="carrinho-linha-nome">${c.name.replace(/<[^>]*>/g, " ")}</div>
        <div class="carrinho-linha-qtd">
          <input type="number" min="0" max="${c.estoqueDisponivel}" value="${c.quantity}"
            data-chave="${c.chave}" class="input-qtd-carrinho">
          <span class="carrinho-linha-max">(máx. ${c.estoqueDisponivel})</span>
        </div>
      </div>
      <span data-chave="${c.chave}" class="remover-item-carrinho">&times;</span>
    `;
    itensDiv.appendChild(linha);
  });

  // Listeners dos inputs de quantidade e botão remover
  itensDiv.querySelectorAll(".input-qtd-carrinho").forEach(input => {
    input.addEventListener("change", (e) => {
      const c = carrinho.find(x => x.chave === e.target.dataset.chave);
      if (!c) return;
      // reconstruímos um "item" mínimo pra reaproveitar a mesma função central
      const itemFicticio = { name: c.name, image: c.image, quantity: c.estoqueDisponivel, cor: c.cor };
      sincronizarQuantidadeCarrinho(itemFicticio, c.groupName, e.target.value);
    });
  });
  itensDiv.querySelectorAll(".remover-item-carrinho").forEach(span => {
    span.addEventListener("click", (e) => {
      const c = carrinho.find(x => x.chave === e.target.dataset.chave);
      if (!c) return;
      const itemFicticio = { name: c.name, image: c.image, quantity: c.estoqueDisponivel, cor: c.cor };
      sincronizarQuantidadeCarrinho(itemFicticio, c.groupName, 0);
    });
  });
}

// ==========================================================
// RENDERIZAÇÃO DO CATÁLOGO
// ==========================================================

// Cria um "slug" (id amigável para URL/âncora) a partir de um texto
function slugify(texto) {
  return (texto || '')
    .replace(/<[^>]*>/g, ' ')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

// Pega só a primeira linha do nome do grupo (antes do <br>), usada como rótulo curto
function rotuloCurtoGrupo(nomeGrupo) {
  return (nomeGrupo || '').split('<br>')[0];
}

// Cria o menu de atalhos no topo da vitrine, um botão por grupo,
// que rola suavemente até a seção correspondente ao clicar.
function criarMenuGrupos() {
  const inventoryDiv = document.getElementById("inventory");
  if (!inventoryDiv) return;

  const menu = document.createElement("nav");
  menu.className = "menu-grupos";

  groups.forEach(group => {
    const slug = slugify(rotuloCurtoGrupo(group.name));
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "menu-grupo-btn";
    btn.textContent = rotuloCurtoGrupo(group.name);
    btn.addEventListener("click", () => {
      const alvo = document.getElementById(slug);
      if (alvo) {
        alvo.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
    menu.appendChild(btn);
  });

  inventoryDiv.parentNode.insertBefore(menu, inventoryDiv);
}

function renderInventory() {
  const inventoryDiv = document.getElementById("inventory");
  inventoryDiv.innerHTML = "";

  groups.forEach(group => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "group";
    groupDiv.id = slugify(rotuloCurtoGrupo(group.name));
    groupDiv.innerHTML = `<h2>${group.name}</h2>`;

    const itemsDiv = document.createElement("div");
    itemsDiv.className = (group.name.includes("Calças Cargo") ||
                          group.name.includes("Bermudas Cargo") ||
                          group.name.includes("Calças Cargo Plus Size") ||
                          group.name.includes("Bermudas Cargo Plus Size") ||
                          group.name.includes("Calça Cargo com Punho"))
                          ? "items special-layout" : "items";

    group.items.forEach(item => {
      // Só mostra o item se houver estoque disponível
      if (item.quantity && item.quantity > 0) {
        const itemDiv = document.createElement("div");
        itemDiv.className = "item";
        // Cor de fundo do card baseada na cor real do produto (com overlay escuro aplicado via CSS)
        itemDiv.style.setProperty("--item-color", item.cor || "#2a2a2a");

        const img = document.createElement("img");
        img.src = item.image;
        img.alt = item.name;

        const nomeWrapper = document.createElement("div");
        nomeWrapper.className = "item-nome-wrapper";

        const swatch = document.createElement("span");
        swatch.className = "cor-swatch";
        swatch.style.background = item.cor || "#2a2a2a";

        const nome = document.createElement("span");
        nome.className = "item-nome";
        nome.innerHTML = item.name;

        nomeWrapper.appendChild(swatch);
        nomeWrapper.appendChild(nome);

        const chave = chaveItem(group.name, item.name);
        const qtdAtualNoCarrinho = obterQuantidadeNoCarrinho(group.name, item.name);

        const controlesDiv = document.createElement("div");
        controlesDiv.className = "item-controles";

        const label = document.createElement("div");
        label.className = "qtd-label";
        label.textContent = "Quantidade de grades";

        const stepper = document.createElement("div");
        stepper.className = "stepper-qtd";

        const btnMenos = document.createElement("button");
        btnMenos.type = "button";
        btnMenos.className = "btn-qtd-menos";
        btnMenos.textContent = "−";

        const inputQtd = document.createElement("input");
        inputQtd.type = "number";
        inputQtd.min = "0";
        inputQtd.max = String(item.quantity);
        inputQtd.value = String(qtdAtualNoCarrinho);
        inputQtd.className = "input-qtd-item";
        inputQtd.dataset.chave = chave;

        const btnMais = document.createElement("button");
        btnMais.type = "button";
        btnMais.className = "btn-qtd-mais";
        btnMais.textContent = "+";

        btnMenos.addEventListener("click", () => {
          const atual = obterQuantidadeNoCarrinho(group.name, item.name);
          const novaQtd = sincronizarQuantidadeCarrinho(item, group.name, atual - 1);
          inputQtd.value = novaQtd;
        });

        btnMais.addEventListener("click", () => {
          const atual = obterQuantidadeNoCarrinho(group.name, item.name);
          const novaQtd = sincronizarQuantidadeCarrinho(item, group.name, atual + 1);
          inputQtd.value = novaQtd;
        });

        inputQtd.addEventListener("change", () => {
          const novaQtd = sincronizarQuantidadeCarrinho(item, group.name, inputQtd.value);
          inputQtd.value = novaQtd;
        });

        stepper.appendChild(btnMenos);
        stepper.appendChild(inputQtd);
        stepper.appendChild(btnMais);

        controlesDiv.appendChild(label);
        controlesDiv.appendChild(stepper);

        itemDiv.appendChild(img);
        itemDiv.appendChild(nomeWrapper);
        itemDiv.appendChild(controlesDiv);

        itemsDiv.appendChild(itemDiv);
      }
    });

    groupDiv.appendChild(itemsDiv);
    inventoryDiv.appendChild(groupDiv);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  criarUICarrinho();
  criarMenuGrupos();
  renderInventory();
});

console.log("principal.js carregado");

// Assina cada item individualmente, evitando dependência de leitura no nó pai.
// Cada item lê diretamente seu próprio valor no Firebase; se não existir NENHUM
// dado lá, o padrão é 0 (nunca o valor fixo do código) — assim um estoque vazio
// nunca aparece como "disponível" por engano.
(function initRealtimeEstoquePorItem() {
  if (typeof firebase === 'undefined' || !firebase?.apps?.length) {
    console.error('Firebase não inicializado no principal. Verifique os scripts e a configuração em index.html.');
    return;
  }

  groups.forEach((g) => {
    g.items.forEach((it) => {
      const produtoId = makeProdutoId(g.name, it.name);
      const ref = firebase.database().ref('estoque/' + produtoId);
      ref.on('value', function (snap) {
        const val = snap.val();
        const qty = val ? (Number.isFinite(val.quantity) ? val.quantity : parseInt(val.quantity || 0, 10)) : 0;
        it.quantity = isNaN(qty) ? 0 : qty;
        renderInventory();
      }, function (err) {
        console.error('Erro ao escutar item', produtoId, err);
      });
    });
  });
})();