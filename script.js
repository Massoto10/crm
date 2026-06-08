const database = window.CRMDatabase.load();

const channelMap = {
  wpp: "whatsapp",
  instagram: "instagram"
};

let activeChannel = "wpp";
let activeIndex = 0;

const list = document.querySelector("#conversationList");
const thread = document.querySelector("#messageThread");
const tabs = document.querySelectorAll(".channel-tab");

function findCrmClient(id) {
  return database.crmClients.find((client) => client.id === id);
}

function findEndCustomer(id) {
  return database.endCustomers.find((customer) => customer.id === id);
}

function getLabels(customer) {
  return customer.labelIds
    .map((labelId) => database.labels.find((label) => label.id === labelId))
    .filter(Boolean);
}

function formatMoney(cents) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0
  }).format(cents / 100);
}

function formatElapsed(isoDate) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(isoDate).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.round(minutes / 60)} h`;
}

function formatTime(isoDate) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(isoDate));
}

function translateTemperature(value) {
  return {
    hot: "Lead quente",
    warm: "Lead morno",
    cold: "Lead frio"
  }[value];
}

function translateClassification(value) {
  return {
    strategic: "Estrategico",
    growth: "Crescimento",
    standard: "Padrao",
    at_risk: "Em risco"
  }[value];
}

function translateSla(value) {
  return {
    on_time: "No prazo",
    warning: "Atencao",
    late: "Atrasado"
  }[value];
}

function getActiveConversations() {
  return database.conversations
    .filter((conversation) => conversation.channelType === channelMap[activeChannel])
    .sort((a, b) => new Date(b.lastMessageAt) - new Date(a.lastMessageAt));
}

function getActiveContext() {
  const conversation = getActiveConversations()[activeIndex];
  const customer = findEndCustomer(conversation.endCustomerId);
  const client = findCrmClient(conversation.crmClientId);
  const labels = getLabels(customer);
  const messages = database.messages
    .filter((message) => message.conversationId === conversation.id)
    .sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));
  const tasks = database.tasks.filter((task) => task.endCustomerId === customer.id);

  return { conversation, customer, client, labels, messages, tasks };
}

function renderList() {
  const conversations = getActiveConversations();
  list.innerHTML = "";

  conversations.forEach((conversation, index) => {
    const customer = findEndCustomer(conversation.endCustomerId);
    const client = findCrmClient(conversation.crmClientId);
    const labels = getLabels(customer);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `conversation-card ${index === activeIndex ? "active" : ""}`;
    button.innerHTML = `
      <div class="avatar">${customer.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div>
      <div class="conversation-main">
        <strong>${customer.fullName}</strong>
        <span>${conversation.lastMessagePreview}</span>
        <em>${client.tradeName} - ${translateTemperature(customer.leadTemperature)} - ${labels.length} labels</em>
      </div>
      <div class="conversation-meta">
        <time>${formatElapsed(conversation.lastMessageAt)}</time>
        <span class="priority ${customer.priority}" aria-label="Prioridade ${customer.priority}"></span>
      </div>
    `;
    button.addEventListener("click", () => {
      activeIndex = index;
      renderList();
      renderDetail();
    });
    list.appendChild(button);
  });
}

function renderDetail() {
  const { conversation, customer, client, labels, messages, tasks } = getActiveContext();
  const initials = customer.fullName.split(" ").map((part) => part[0]).slice(0, 2).join("");
  const channelName = conversation.channelType === "whatsapp" ? "WhatsApp" : "Instagram";

  document.querySelector("#contactAvatar").textContent = initials;
  document.querySelector("#contactName").textContent = customer.fullName;
  document.querySelector("#contactMeta").textContent =
    `${channelName} - ${translateTemperature(customer.leadTemperature)} - Cliente CRM: ${client.tradeName}`;
  document.querySelector("#stageName").textContent = conversation.stage;
  document.querySelector("#profileAvatar").textContent = initials;
  document.querySelector("#profileName").textContent = customer.fullName;
  document.querySelector("#profileCompany").textContent =
    `${customer.companyName} - ${translateClassification(client.classification)}`;
  document.querySelector("#dealValue").textContent = formatMoney(customer.estimatedValueCents);
  document.querySelector("#owner").textContent = customer.assignedTo;
  document.querySelector("#lastTouch").textContent = formatElapsed(customer.lastContactAt);
  document.querySelector("#sla").textContent = translateSla(conversation.slaStatus);

  thread.innerHTML = messages
    .map((message) => `
      <div class="message ${message.senderType === "agent" ? "agent" : ""}">
        <strong>${message.senderName}</strong>
        <p>${message.body}</p>
        <time>${formatTime(message.sentAt)}</time>
      </div>
    `)
    .join("");

  document.querySelector("#tagList").innerHTML = labels
    .map((label) => `<span class="tag" style="border-color: ${label.color}; color: ${label.color};">${label.name}</span>`)
    .join("");

  document.querySelector(".task-list").innerHTML = tasks
    .map((task) => `
      <li>
        <span class="task-box ${task.status === "done" ? "checked" : ""}"></span>
        ${task.title}
      </li>
    `)
    .join("");
}

tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    activeChannel = tab.dataset.channel;
    activeIndex = 0;
    tabs.forEach((item) => {
      item.classList.toggle("active", item === tab);
      item.setAttribute("aria-selected", item === tab ? "true" : "false");
    });
    renderList();
    renderDetail();
  });
});

document.querySelector(".reply-box").addEventListener("submit", (event) => {
  event.preventDefault();
  const textarea = event.currentTarget.querySelector("textarea");
  const text = textarea.value.trim();
  if (!text) return;

  const { conversation, customer } = getActiveContext();
  const sentAt = new Date().toISOString();
  database.messages.push({
    id: `msg_${Date.now()}`,
    conversationId: conversation.id,
    senderType: "agent",
    senderName: "Agente",
    body: text,
    sentAt
  });
  conversation.lastMessagePreview = text;
  conversation.lastMessageAt = sentAt;
  customer.lastContactAt = sentAt;
  window.CRMDatabase.save(database);

  textarea.value = "";
  renderList();
  renderDetail();
  thread.scrollTop = thread.scrollHeight;
});

renderList();
renderDetail();
