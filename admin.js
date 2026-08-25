function getGroups() {
  const defaultGroups = [
    { name: "Calças Cargo<br>Grade com 14 peças<br>Distribuição: 2 P • 4 M • 4 G • 4 GG", items: [
      { name: "Grade Calças Cargo Preta", image: "Midias/Calças Cargo/Preta.jpg", quantity: 1 },
      { name: "Grade Calças Cargo Caqui", image: "Midias/Calças Cargo/Caqui.png", quantity: 1 },
      { name: "Grade Calças Cargo Areia", image: "Midias/Calças Cargo/Areia.jpg", quantity: 1 },
      { name: "Grade Calças Cargo Castor", image: "Midias/Calças Cargo/Castor.png", quantity: 1 },
      { name: "Grade Calças Cargo Verde Militar", image: "Midias/Calças Cargo/Verde.jpg", quantity: 1 },
      { name: "Grade Calças Cargo Azul Marinho", image: "Midias/Calças Cargo/Marinho.png", quantity: 1 },
      { name: "Grade Calças Cargo Cinza", image: "Midias/Calças Cargo/Cinza.png", quantity: 1 },
    ]},
    { name: "Bermudas Cargo<br>Grade com 14 peças<br>Distribuição: 2 P • 4 M • 4 G • 4 GG", items: [
    { name: "Grade Bermudas Cargo Preta", image: "Midias/Bermudas Cargo/Preta.png", quantity: 1 },
    ]},
    { name: "Calças Cargo Plus Size<br>Grade com 12 peças<br>Distribuição: 3 G1 • 3 G2 • 3 G3 • 3 G4", items: [

    ]},
    { name: "Bermudas Cargo Plus Size<br>Grade com 12 peças<br>Distribuição: 3 G1 • 3 G2 • 3 G3 • 3 G4", items: [

    ]},
    { name: "Calças Cargo com Punho<br>Grade com 14 peças<br>Distribuição: 2 P • 4 M • 4 G • 4 GG", items: [

    ]},
  ];
  // Retorna sempre os grupos padrão; a leitura de quantidades vem do Realtime Database
  return defaultGroups;
}

// admin.js

let groups = [];

// Gera um ID seguro para Realtime Database a partir do nome do item
function makeProdutoId(groupName, itemName) {
  const stripHtml = (s) => (s || '').replace(/<[^>]*>/g, ' ');
  const base = `${stripHtml(itemName)}`;
  return base
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // remove acentos
    .replace(/[.#$\[\]\/]/g, '-') // remove caracteres inválidos em keys
    .replace(/\s+/g, '_') // espaços
    .replace(/_{2,}/g, '_') // múltiplos _
    .trim()
    .toLowerCase();
}

function loadGroups() {
  groups = getGroups();
}

// ==========================================================
// NAVEGAÇÃO DO MENU
// ==========================================================

function inicializarMenu() {
  const botoes = document.querySelectorAll(".menu-item");
  botoes.forEach((btn) => {
    btn.addEventListener("click", () => {
      const secaoAlvo = btn.dataset.secao;

      botoes.forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");

      document.querySelectorAll(".secao-admin").forEach((sec) => {
        sec.classList.remove("ativa");
      });
      document.getElementById(`secao-${secaoAlvo}`).classList.add("ativa");
    });
  });
}

// ==========================================================
// SEÇÃO 1: CHECK-IN DE ESTOQUE (editar quantidades)
// ==========================================================

function renderAdminInventory() {
  const adminInventoryDiv = document.getElementById("adminInventory");
  adminInventoryDiv.innerHTML = "";

  if (groups.length === 0) {
    adminInventoryDiv.innerHTML = "<p>Nenhum item cadastrado no estoque.</p>";
    return;
  }

  groups.forEach((group, gIndex) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "group";
    groupDiv.innerHTML = `<h2>${group.name}</h2>`;

    const itemsDiv = document.createElement("div");
    itemsDiv.className = "items";

group.items.forEach((item, iIndex) => {
  const itemDiv = document.createElement("div");
  itemDiv.className = "item";

  const nome = document.createElement("div");
  nome.textContent = item.name;

  const stepper = document.createElement("div");
  stepper.className = "stepper-qtd";

  const btnMenos = document.createElement("button");
  btnMenos.type = "button";
  btnMenos.className = "btn-qtd-menos";
  btnMenos.textContent = "−";

  const input = document.createElement("input");
  input.type = "number";
  input.min = "0";
  input.value = item.quantity || 0;
  input.className = "input-qtd-item";
  input.dataset.group = gIndex;
  input.dataset.index = iIndex;

  const btnMais = document.createElement("button");
  btnMais.type = "button";
  btnMais.className = "btn-qtd-mais";
  btnMais.textContent = "+";

  btnMenos.addEventListener("click", () => {
    const novoValor = Math.max(0, parseInt(input.value || 0, 10) - 1);
    input.value = novoValor;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  btnMais.addEventListener("click", () => {
    const novoValor = parseInt(input.value || 0, 10) + 1;
    input.value = novoValor;
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  stepper.appendChild(btnMenos);
  stepper.appendChild(input);
  stepper.appendChild(btnMais);

  itemDiv.appendChild(nome);
  itemDiv.appendChild(stepper);
  itemsDiv.appendChild(itemDiv);
});
    groupDiv.appendChild(itemsDiv);
    adminInventoryDiv.appendChild(groupDiv);
  });
}

function salvarEstoque() {
  const writes = [];
  let count = 0;
  groups.forEach((group) => {
    group.items.forEach((item) => {
      const produtoId = makeProdutoId(group.name, item.name);
      const ref = firebase.database().ref('estoque/' + produtoId);
      const payload = {
        group: (group.name || '').replace(/<[^>]*>/g, ' ').trim(),
        name: item.name,
        quantity: Number.isFinite(item.quantity) ? item.quantity : parseInt(item.quantity || 0, 10)
      };
      writes.push(ref.set(payload));
      count++;
    });
  });

  Promise.all(writes)
    .then(() => {
      console.log(`✔️ Total de itens gravados: ${count}`);
      alert("Estoque atualizado com sucesso!");
    })
    .catch((err) => alert("Erro ao atualizar estoque: " + err));
}

// ==========================================================
// SEÇÃO 2: ESTOQUE ATUAL (somente visualização, tempo real)
// ==========================================================

function renderEstoqueAtual() {
  const div = document.getElementById("estoqueAtual");
  if (!div) return;
  div.innerHTML = "";

  groups.forEach((group) => {
    const groupDiv = document.createElement("div");
    groupDiv.className = "group";
    groupDiv.innerHTML = `<h2>${group.name}</h2>`;

    const itemsDiv = document.createElement("div");
    itemsDiv.className = "items";

    group.items.forEach((item) => {
      const qtd = item.quantity || 0;
      const itemDiv = document.createElement("div");
      itemDiv.className = "item item-visualizacao";

      const classeAlerta = qtd === 0 ? "estoque-zerado" : (qtd <= 2 ? "estoque-baixo" : "estoque-ok");

      itemDiv.innerHTML = `
        <div class="item-visual-nome">${item.name}</div>
        <div class="item-visual-qtd ${classeAlerta}">${qtd} ${qtd === 1 ? "peça" : "peças"}</div>
      `;

      itemsDiv.appendChild(itemDiv);
    });

    groupDiv.appendChild(itemsDiv);
    div.appendChild(groupDiv);
  });
}

// ==========================================================
// SEÇÃO 3: PEDIDOS
// ==========================================================

let pedidosCache = {};
let filtroPedidoAtual = "todos";

function formatarDataPedido(timestamp) {
  if (!timestamp) return "Data desconhecida";
  const data = new Date(timestamp);
  return data.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function renderPedidos() {
  const div = document.getElementById("listaPedidos");
  if (!div) return;

  const entradas = Object.entries(pedidosCache)
    .filter(([, pedido]) => filtroPedidoAtual === "todos" || pedido.status === filtroPedidoAtual)
    .sort((a, b) => (b[1].criadoEm || 0) - (a[1].criadoEm || 0));

  if (entradas.length === 0) {
    div.innerHTML = `<p class="sem-pedidos">Nenhum pedido ${filtroPedidoAtual !== "todos" ? "com esse status" : ""} por enquanto.</p>`;
    return;
  }

  div.innerHTML = "";
  entradas.forEach(([id, pedido]) => {
    const card = document.createElement("div");
    card.className = "pedido-card";

    const listaItens = (pedido.itens || [])
      .map(it => `<li>${it.nome} — <strong>${it.quantidade}</strong> grade(s)</li>`)
      .join("");

    const statusAtual = pedido.status || "pendente";
    const rotuloStatus = statusAtual === "atendido" ? "Atendido" : "Pendente";
    const proximoStatus = statusAtual === "atendido" ? "pendente" : "atendido";
    const rotuloBotao = statusAtual === "atendido" ? "Reabrir pedido" : "Marcar como atendido";

    card.innerHTML = `
      <div class="pedido-header">
        <span class="pedido-status status-${statusAtual}">${rotuloStatus}</span>
        <span class="pedido-data">${formatarDataPedido(pedido.criadoEm)}</span>
      </div>
      <ul class="pedido-itens">${listaItens}</ul>
      <div class="pedido-total">Total: ${pedido.totalItens || 0} grade(s)</div>
      <button class="btn-status-pedido" data-id="${id}" data-proximo="${proximoStatus}">${rotuloBotao}</button>
    `;

    div.appendChild(card);
  });

  // Listeners dos botões de status (recriados a cada render)
  div.querySelectorAll(".btn-status-pedido").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const novoStatus = btn.dataset.proximo;
      firebase.database().ref('pedidos/' + id + '/status').set(novoStatus)
        .catch((err) => alert("Erro ao atualizar status do pedido: " + err));
    });
  });
}

function inicializarFiltrosPedidos() {
  document.querySelectorAll(".filtro-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filtro-btn").forEach((b) => b.classList.remove("ativo"));
      btn.classList.add("ativo");
      filtroPedidoAtual = btn.dataset.filtro;
      renderPedidos();
    });
  });
}

function escutarPedidos() {
  firebase.database().ref('pedidos').on('value', (snap) => {
    pedidosCache = snap.val() || {};
    renderPedidos();
  }, (err) => {
    console.error('Erro ao escutar pedidos:', err);
  });
}

// ==========================================================
// INICIALIZAÇÃO
// ==========================================================

document.addEventListener("DOMContentLoaded", function () {
  // Garante autenticação para cumprir regras `.write: auth != null`
  try {
    if (firebase && firebase.auth) {
      firebase.auth().onAuthStateChanged(function (user) {
        if (!user) {
          firebase.auth().signInAnonymously().catch(function (err) {
            console.warn('Falha ao autenticar anonimamente:', err);
          });
        }
      });
    }
  } catch (e) {
    console.warn('Auth do Firebase não disponível:', e);
  }

  inicializarMenu();
  inicializarFiltrosPedidos();

  loadGroups();
  // Zera as quantidades iniciais; o Realtime Database preenche os valores salvos
  groups.forEach(g => g.items.forEach(it => it.quantity = 0));
  renderAdminInventory();
  renderEstoqueAtual();

  // Escuta quantidades em tempo real por item
  try {
    groups.forEach((g) => {
      g.items.forEach((it) => {
        const produtoId = makeProdutoId(g.name, it.name);
        const ref = firebase.database().ref('estoque/' + produtoId);
        ref.on('value', function (snap) {
          const val = snap.val();
          const qty = val ? (Number.isFinite(val.quantity) ? val.quantity : parseInt(val.quantity || 0, 10)) : 0;
          it.quantity = isNaN(qty) ? 0 : qty;
          renderAdminInventory();
          renderEstoqueAtual();
        }, function (err) {
          console.error('Erro ao escutar item', produtoId, err);
        });
      });
    });
  } catch (e) {
    console.error('Falha ao conectar aos itens no Realtime Database:', e);
  }

  escutarPedidos();

  // Atualiza em memória ao alterar um input do check-in
  document.getElementById("adminInventory").addEventListener("input", function (e) {
    if (e.target && e.target.matches("input[type='number']")) {
      const groupIndex = e.target.getAttribute("data-group");
      const itemIndex = e.target.getAttribute("data-index");
      const newQty = parseInt(e.target.value, 10);
      groups[groupIndex].items[itemIndex].quantity = isNaN(newQty) ? 0 : newQty;
    }
  });

  document.getElementById("saveBtn").addEventListener("click", salvarEstoque);
});