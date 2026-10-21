const ENTRIES_KEY = "buddy.entries.v1";
const PROFILE_KEY = "buddy.profile.v1";
const moods = [
  { id: "em baixo", label: "Em baixo", face: "🌧️" },
  { id: "ansioso", label: "Ansioso/a", face: "😟" },
  { id: "neutro", label: "Assim assim", face: "😐" },
  { id: "bem", label: "Bem", face: "🙂" },
  { id: "ótimo", label: "Muito bem", face: "☀️" }
];
const exercises = [
  { id: "breathing", mark: "mark-green", symbol: "◌", title: "Respiração tranquila", duration: "1 min", text: "Uma pausa guiada para abrandar e prestar atenção à respiração." },
  { id: "grounding", mark: "mark-peach", symbol: "✳", title: "Voltar ao presente", duration: "2 min", text: "Um exercício simples para reparar no que está à tua volta, sem pressa." },
  { id: "writing", mark: "mark-lilac", symbol: "✎", title: "Escrever para aliviar", duration: "Livre", text: "Organiza os pensamentos no papel, sem precisar de encontrar respostas." }
];

const app = document.querySelector("#app-content");
const toast = document.querySelector("#toast");
let entries = [];
let profile = { name: "" };
let selectedRole = "patient";
let toastTimeout;
let breathTimer;
let breathPhaseIndex = 0;
let breathSeconds = 4;
let breathRounds = 0;

const breathingPhases = [
  { label: "Inspira", seconds: 4, active: true },
  { label: "Segura", seconds: 4, active: false },
  { label: "Expira", seconds: 6, active: false }
];

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  })[character]);
}

function readStoredValue(key, fallback, validate) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return fallback;
    const value = JSON.parse(raw);
    if (!validate(value)) throw new Error("Os dados guardados não têm o formato esperado.");
    return value;
  } catch (error) {
    console.error(`Não foi possível ler os dados locais (${key}).`, error);
    throw new Error("Não foi possível ler os dados guardados neste dispositivo. Verifica as definições de armazenamento do navegador.");
  }
}

function persistValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Não foi possível guardar os dados locais (${key}).`, error);
    throw new Error("Não foi possível guardar os dados. Verifica se o armazenamento do navegador está disponível.");
  }
}

function createPatientId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `PAC-${suffix}`;
}

function createPsychologistId() {
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `PSI-${suffix}`;
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("visible");
  window.clearTimeout(toastTimeout);
  toastTimeout = window.setTimeout(() => toast.classList.remove("visible"), 3600);
}

function formatDate(value, options = { day: "numeric", month: "long", year: "numeric" }) {
  return new Intl.DateTimeFormat("pt-PT", options).format(new Date(value));
}

function getMood(id) {
  return moods.find((mood) => mood.id === id) || moods[2];
}

function getLatestEntry() {
  return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

function isToday(value) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
}

function renderWelcome() {
  app.innerHTML = `
    <section class="public-hero">
      <div class="public-copy">
        <p class="eyebrow">Um espaço para cuidar de ti</p>
        <h1>Um passo de cada vez.<br><span>Ao teu ritmo.</span></h1>
        <p class="public-lead">A Buddy ajuda-te a fazer pequenas pausas, perceber como te sentes e acompanhar os teus próprios registos, com calma e sem julgamentos.</p>
        <div class="public-actions">
          <a class="button public-cta" href="#role" data-route="role">Entrar <span aria-hidden="true">→</span></a>
          <a class="button button-secondary public-about-button" href="#sobre">Sobre Buddy <span aria-hidden="true">↓</span></a>
        </div>
        <p class="local-note">Sem conta online. Os teus dados ficam neste dispositivo.</p>
      </div>
      <div class="public-art" aria-hidden="true">
        <div class="art-sun"></div>
        <div class="art-card"><span>♡</span><p>Faz uma pausa.<br>Ouve-te.</p></div>
        <div class="art-caption">Há espaço para o que sentes.</div>
      </div>
    </section>
    <section class="about-section" id="sobre">
      <p class="eyebrow">Sobre a aplicação</p>
      <h2>Um lugar simples para te escutares.</h2>
      <p>A Buddy é um protótipo de bem-estar emocional pensado para te ajudar a registar como te sentes e experimentar exercícios breves de autocuidado. Podes rever os teus registos e escolher o que te faz sentido, sem pressas.</p>
      <div class="about-points">
        <article><span aria-hidden="true">✳</span><h3>Ao teu ritmo</h3><p>Faz um check-in quando quiseres. Não há uma frequência certa.</p></article>
        <article><span aria-hidden="true">⌂</span><h3>Mais consciência</h3><p>Observa os teus registos ao longo do tempo, sem te julgares.</p></article>
        <article><span aria-hidden="true">♡</span><h3>Privacidade local</h3><p>O perfil e os registos ficam guardados neste navegador.</p></article>
      </div>
      <p class="about-disclaimer">A Buddy não substitui o acompanhamento, diagnóstico ou tratamento prestado por profissionais de saúde. Esta versão não envia dados para um servidor.</p>
    </section>
    <div class="public-footer"><a class="brand" href="#welcome"><img src="./assets/images/logo.svg" alt="" width="30" height="30"><span>buddy<span class="brand-period">.</span></span></a><span>© ${new Date().getFullYear()} Buddy</span></div>`;
}

function renderAccess() {
  app.innerHTML = `
    <section class="access-page">
      <a class="text-button back-link" href="#role" data-route="role">← Alterar perfil</a>
      <p class="eyebrow">Bem-vindo/a à Buddy</p>
      <h1>Como queres continuar?</h1>
      <p class="intro">Perfil selecionado: <strong>${selectedRole === "psychologist" ? "Psicólogo" : "Paciente"}</strong>. Escolhe uma opção para continuar.</p>
      <div class="access-options">
        <a class="access-card card" href="#signup" data-route="signup">
          <span class="access-symbol mark-green" aria-hidden="true">＋</span>
          <span><strong>Criar conta</strong><small>Cria um perfil local para personalizar a Buddy.</small></span>
          <span class="access-arrow" aria-hidden="true">→</span>
        </a>
        <a class="access-card card" href="#signin" data-route="signin">
          <span class="access-symbol mark-peach" aria-hidden="true">↗</span>
          <span><strong>Iniciar sessão</strong><small>Continua neste dispositivo com o teu perfil local.</small></span>
          <span class="access-arrow" aria-hidden="true">→</span>
        </a>
      </div>
      <p class="privacy-box"><strong>Sobre o acesso:</strong> esta demonstração não tem contas online, autenticação nem palavras-passe. O perfil e os check-ins ficam no armazenamento local do navegador.${selectedRole === "psychologist" ? " A área profissional ainda está em desenvolvimento." : ""}</p>
    </section>`;
}

function renderRoleSelection() {
  app.innerHTML = `
    <section class="access-page role-page">
      <a class="text-button back-link" href="#welcome" data-route="welcome">← Voltar ao início</a>
      <p class="eyebrow">Vamos preparar o teu espaço</p>
      <h1>Como vais usar a Buddy?</h1>
      <p class="intro">Escolhe o perfil que melhor te representa. Podes continuar para criar um perfil local ou iniciar sessão.</p>
      <div class="access-options role-options">
        <button class="access-card card role-card" type="button" data-action="select-role" data-role="patient">
          <span class="access-symbol mark-green" aria-hidden="true">♡</span>
          <span><strong>Paciente</strong><small>Quero acompanhar como me sinto e cuidar do meu bem-estar.</small></span>
          <span class="access-arrow" aria-hidden="true">→</span>
        </button>
        <button class="access-card card role-card" type="button" data-action="select-role" data-role="psychologist">
          <span class="access-symbol mark-lilac" aria-hidden="true">✳</span>
          <span><strong>Psicólogo</strong><small>Sou profissional de psicologia e procuro ferramentas de apoio.</small></span>
          <span class="access-arrow" aria-hidden="true">→</span>
        </button>
      </div>
      <p class="privacy-box"><strong>Nota:</strong> a área de Psicólogo está em desenvolvimento. Esta versão ainda não inclui ferramentas profissionais nem gestão de pacientes.</p>
    </section>`;
}

function renderCreateAccount() {
  app.innerHTML = `
    <section class="access-page">
      <a class="text-button back-link" href="#access" data-route="access">← Voltar às opções</a>
      <p class="eyebrow">Novo perfil · ${selectedRole === "psychologist" ? "Psicólogo" : "Paciente"}</p>
      <h1>Criar conta</h1>
      <p class="intro">Nesta versão, vais criar um perfil local neste dispositivo — não é necessária uma conta online.</p>
      <form id="create-profile-form" class="form-card card access-form">
        <label class="field-label" for="new-profile-name">Como te podemos chamar?</label>
        <input class="text-input" id="new-profile-name" name="name" maxlength="50" autocomplete="given-name" placeholder="O teu nome" required>
        <p class="local-note">Não introduzas informação sensível. Este perfil não tem palavra-passe nem sincronização.</p>
        <button class="button" type="submit">Criar perfil e entrar <span aria-hidden="true">→</span></button>
      </form>
    </section>`;
}

function renderSignIn() {
  const name = profile.name.trim();
  app.innerHTML = `
    <section class="access-page">
      <a class="text-button back-link" href="#access" data-route="access">← Voltar às opções</a>
      <p class="eyebrow">O teu espaço · ${selectedRole === "psychologist" ? "Psicólogo" : "Paciente"}</p>
      <h1>Iniciar sessão</h1>
      <p class="intro">Continua com o perfil guardado localmente neste navegador.</p>
      <form id="sign-in-form" class="form-card card access-form">
        ${name ? `<div class="saved-profile"><span class="profile-avatar">${escapeHTML(name.charAt(0).toLocaleUpperCase("pt-PT"))}</span><span><strong>${escapeHTML(name)}</strong><small>Perfil neste dispositivo</small></span></div>` : ""}
        <label class="field-label" for="sign-in-name">${name ? "Podes alterar o nome do perfil (opcional)" : "Como queres que te chamemos?"}</label>
        <input class="text-input" id="sign-in-name" name="name" maxlength="50" autocomplete="given-name" value="${escapeHTML(name)}" placeholder="O teu nome" ${name ? "" : "required"}>
        <p class="local-note">Não existe palavra-passe nem conta online nesta demonstração.</p>
        <button class="button" type="submit">Entrar neste dispositivo <span aria-hidden="true">→</span></button>
      </form>
    </section>`;
}

function updateProfileHeader() {
  const name = profile.name.trim();
  document.querySelectorAll("[data-profile-name]").forEach((element) => {
    element.textContent = name || "O teu perfil";
  });
  document.querySelectorAll("[data-avatar]").forEach((element) => {
    element.textContent = name ? name.charAt(0).toLocaleUpperCase("pt-PT") : "U";
  });
}

function renderHome() {
  if (profile.role === "psychologist") {
    renderPsychologistHome();
    return;
  }

  const name = profile.name.trim();
  const firstName = name ? escapeHTML(name.split(/\s+/)[0]) : "Olá";
  const latest = getLatestEntry();
  const latestMarkup = latest
    ? `<article class="latest-card card">
        <span class="latest-mood" aria-hidden="true">${getMood(latest.mood).face}</span>
        <span class="latest-copy"><strong>${escapeHTML(getMood(latest.mood).label)}</strong><small>${formatDate(latest.createdAt, { day: "numeric", month: "short" })} · intensidade ${latest.intensity}/10</small></span>
        <span class="latest-intensity">${latest.intensity}/10</span>
      </article>`
    : `<div class="empty-state"><p>Ainda não tens registos. Um check-in pode ajudar-te a perceber como te sentes — sem julgamentos.</p><a class="button button-small" href="#checkin" data-route="checkin">Fazer o primeiro check-in</a></div>`;

  app.innerHTML = `
    <section class="welcome-grid">
      <div class="welcome-card">
        <p class="eyebrow">${formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</p>
        <h1>${firstName}, este espaço é teu.</h1>
        <p>Não precisas de ter tudo resolvido. Começa por perceber como estás, ao teu ritmo.</p>
        <a class="button" href="#checkin" data-route="checkin">Como me sinto? <span aria-hidden="true">→</span></a>
      </div>
      <article class="checkin-prompt card">
        <div>
          <span class="prompt-icon" aria-hidden="true">♡</span>
          <h2>Faz uma pausa</h2>
          <p>Um minuto para fazer check-in contigo pode ser suficiente por agora.</p>
        </div>
        <a class="text-button" href="#checkin" data-route="checkin">Registar como me sinto <span aria-hidden="true">→</span></a>
      </article>
    </section>
    <section>
      <div class="section-row"><div><h2>O teu check-in mais recente</h2><p>${entries.length ? `${entries.length} ${entries.length === 1 ? "registo guardado" : "registos guardados"} neste dispositivo` : "Os teus registos são privados e ficam neste dispositivo."}</p></div>
      ${entries.length ? '<a class="text-button" href="#history" data-route="history">Ver registos →</a>' : ""}</div>
      ${latestMarkup}
    </section>
    <section>
      <div class="section-row"><div><h2>Um momento para ti</h2><p>Escolhe o que te fizer sentido agora.</p></div><a class="text-button" href="#exercises" data-route="exercises">Ver todos →</a></div>
      ${renderExerciseCards(exercises.slice(0, 3))}
    </section>`;
}

function renderPsychologistHome() {
  const patientId = profile.linkedPatientId || "";
  const todaysCheckins = patientId
    ? entries
      .filter((entry) => entry.patientId === patientId && isToday(entry.createdAt))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];
  const feedbackMarkup = !patientId
    ? `<div class="patient-link-card card">
        <form id="patient-link-form">
          <label class="field-label" for="dashboard-patient-id">ID do paciente</label>
          <p class="form-help">Introduz o ID que o paciente vê na secção “O teu perfil” para associar o respetivo check-in.</p>
          <div class="patient-link-actions">
            <input class="text-input" id="dashboard-patient-id" name="patientId" maxlength="12" pattern="PAC-[A-Fa-f0-9]{8}" title="Usa o formato PAC- seguido de 8 caracteres hexadecimais." placeholder="PAC-XXXXXXXX" required>
            <button class="button" type="submit">Ver check-in</button>
          </div>
        </form>
      </div>`
    : todaysCheckins.length
      ? `<div class="feedback-list">${todaysCheckins.map((entry) => `
          <article class="latest-card card">
            <span class="latest-mood" aria-hidden="true">${getMood(entry.mood).face}</span>
            <span class="latest-copy"><strong>${escapeHTML(getMood(entry.mood).label)}</strong><small>Check-in de hoje às ${formatDate(entry.createdAt, { hour: "2-digit", minute: "2-digit" })} · intensidade ${entry.intensity}/10</small>${entry.note ? `<p class="feedback-note">${escapeHTML(entry.note)}</p>` : ""}</span>
            <span class="latest-intensity">${entry.intensity}/10</span>
          </article>`).join("")}</div>`
      : `<div class="empty-state"><p>O paciente <strong>${escapeHTML(patientId)}</strong> ainda não tem check-ins de hoje associados neste dispositivo.</p><p>Os check-ins não são sincronizados entre dispositivos nesta versão.</p><a class="text-button" href="#profile" data-route="profile">Ver perfil →</a></div>`;

  app.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Área profissional</p><h1>Início</h1><p>Resumo do feedback diário dos teus pacientes.</p></div><span class="date-note">${formatDate(new Date(), { weekday: "long", day: "numeric", month: "long" })}</span></div>
    <section>
      <div class="section-row"><div><h2>Check-in de hoje</h2><p>Paciente associado: ${escapeHTML(patientId || "nenhum")}</p></div>
        ${patientId ? '<a class="text-button" href="#profile" data-route="profile">Alterar paciente →</a>' : ""}
      </div>
      ${feedbackMarkup}
    </section>
    <p class="privacy-box"><strong>Privacidade e sincronização:</strong> o feedback é lido do armazenamento local deste navegador e só aparece aqui se o check-in tiver sido registado neste mesmo dispositivo com o ID associado. Não existe sincronização ou partilha online nesta demonstração.</p>`;
}

function renderExerciseCards(list) {
  return `<div class="exercise-grid">${list.map((exercise) => `
    <article class="exercise-card">
      <span class="exercise-mark ${exercise.mark}" aria-hidden="true">${exercise.symbol}</span>
      <h3>${exercise.title}</h3>
      <p>${exercise.text}</p>
      <button class="text-button" type="button" data-exercise="${exercise.id}">Experimentar · ${exercise.duration} →</button>
    </article>`).join("")}</div>`;
}

function renderCheckin() {
  app.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Um momento de atenção</p><h1>Como te sentes?</h1><p>Não há respostas certas ou erradas. Regista apenas o que é verdade para ti agora.</p></div></div>
    <form id="checkin-form" class="form-card card">
      <section class="form-section">
        <h2>Escolhe o que se aproxima mais</h2>
        <p class="form-help">Podes sentir várias coisas ao mesmo tempo — escolhe a que está mais presente.</p>
        <div class="mood-options" role="radiogroup" aria-label="Estado de espírito">
          ${moods.map((mood, index) => `<div class="mood-option">
            <input id="mood-${index}" name="mood" type="radio" value="${mood.id}" ${index === 2 ? "checked" : ""} required>
            <label for="mood-${index}"><span aria-hidden="true">${mood.face}</span><span>${mood.label}</span></label>
          </div>`).join("")}
        </div>
      </section>
      <section class="form-section">
        <h2>Com que intensidade?</h2>
        <p class="form-help">De 1 (um pouco) a 10 (muito intenso).</p>
        <div class="range-row"><input id="intensity" name="intensity" type="range" min="1" max="10" value="5"><output id="intensity-output" class="range-number" for="intensity">5</output></div>
        <div class="range-labels"><span>Um pouco</span><span>Muito intenso</span></div>
      </section>
      <section class="form-section">
        <label class="field-label" for="checkin-note">Queres acrescentar alguma nota? <span style="font-weight:400;color:var(--muted)">(opcional)</span></label>
        <textarea id="checkin-note" class="text-area" name="note" maxlength="500" placeholder="Escreve só o que te apetecer."></textarea>
      </section>
      <div class="form-actions"><p>Este registo fica guardado apenas neste dispositivo. Não substitui apoio profissional.</p><button class="button" type="submit">Guardar check-in <span aria-hidden="true">→</span></button></div>
    </form>`;
}

function renderHistory() {
  const sorted = [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  app.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">A olhar para ti</p><h1>Os meus registos</h1><p>Uma coleção privada dos teus check-ins neste dispositivo.</p></div></div>
    ${sorted.length ? `
      <div class="history-toolbar"><span class="date-note">${sorted.length} ${sorted.length === 1 ? "registo" : "registos"}</span><button class="button button-secondary button-small" type="button" data-action="export">Exportar dados</button></div>
      <div class="history-list">${sorted.map((entry) => {
        const mood = getMood(entry.mood);
        return `<article class="history-item card">
          <span class="latest-mood" aria-hidden="true">${mood.face}</span>
          <span class="latest-copy"><strong>${escapeHTML(mood.label)} · ${entry.intensity}/10</strong>${entry.note ? `<p>${escapeHTML(entry.note)}</p>` : "<p>Sem nota adicional.</p>"}</span>
          <time datetime="${escapeHTML(entry.createdAt)}">${formatDate(entry.createdAt, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
        </article>`;
      }).join("")}</div>
      <div class="section-row"><span></span><button class="text-button danger-button button-small" type="button" data-action="clear">Apagar todos os registos</button></div>
    ` : `<div class="empty-state"><p>Ainda não tens registos guardados. Podes fazer um check-in sempre que te apetecer — não há uma frequência certa.</p><a class="button" href="#checkin" data-route="checkin">Fazer um check-in</a></div>`}`;
}

function renderExercises() {
  app.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Pequenas pausas</p><h1>Exercícios</h1><p>Ideias simples de autocuidado. Escolhe só o que te fizer sentido.</p></div></div>
    <div class="privacy-box"><strong>Uma nota:</strong> estes exercícios são sugestões gerais de bem-estar e não substituem aconselhamento ou tratamento de um profissional de saúde.</div>
    <div class="section-row"><div><h2>Para experimentar</h2><p>Sem pressão e ao teu ritmo.</p></div></div>
    ${renderExerciseCards(exercises)}`;
}

function renderBreathing() {
  stopBreathing();
  app.innerHTML = `
    <div class="page-heading"><a class="text-button" href="#exercises" data-route="exercises">← Voltar aos exercícios</a></div>
    <section class="session-card card">
      <p class="eyebrow">Pausa guiada · cerca de 1 minuto</p>
      <h1>Respiração tranquila</h1>
      <p>Encontra uma posição confortável. Segue o ritmo sem forçar a respiração; podes parar quando quiseres.</p>
      <div class="breathing-circle" id="breathing-circle" aria-live="polite"><div><strong id="breathing-phase">Pronto?</strong><span id="breathing-count">4 ciclos · ao teu ritmo</span></div></div>
      <div class="session-actions">
        <button class="button" id="breathing-toggle" type="button" data-action="breath-start">Começar</button>
        <button class="button button-secondary" type="button" data-action="breath-reset">Recomeçar</button>
      </div>
      <div class="exercise-instructions"><p><strong>Inspira</strong> suavemente durante 4 segundos, <strong>segura</strong> durante 4 e <strong>expira</strong> durante 6. Repete quatro vezes.</p><p>Se sentires desconforto, volta à tua respiração habitual.</p></div>
    </section>`;
  resetBreathingDisplay();
}

function renderGrounding() {
  app.innerHTML = `
    <div class="page-heading"><a class="text-button" href="#exercises" data-route="exercises">← Voltar aos exercícios</a></div>
    <section class="session-card card">
      <p class="eyebrow">Pausa guiada · cerca de 2 minutos</p>
      <h1>Voltar ao presente</h1>
      <p>Olha à tua volta com curiosidade. Não precisas de mudar nada — apenas reparar.</p>
      <div class="exercise-instructions">
        <p><strong>1.</strong> Repara em cinco coisas que consegues ver.</p>
        <p><strong>2.</strong> Nota quatro coisas que consegues sentir com o corpo.</p>
        <p><strong>3.</strong> Escuta três sons à tua volta.</p>
        <p><strong>4.</strong> Procura dois cheiros e um sabor, se os encontrares.</p>
        <p>Quando estiveres pronto/a, volta ao que estavas a fazer.</p>
      </div>
    </section>`;
}

function renderWriting() {
  app.innerHTML = `
    <div class="page-heading"><a class="text-button" href="#exercises" data-route="exercises">← Voltar aos exercícios</a></div>
    <section class="session-card card">
      <p class="eyebrow">Pausa de escrita · ao teu ritmo</p>
      <h1>Escrever para aliviar</h1>
      <p>Se ajudar, escreve sem editar durante alguns minutos. O texto fica apenas nesta sessão e não é guardado.</p>
      <label class="field-label" for="writing-note" style="text-align:left">O que gostarias de tirar da cabeça?</label>
      <textarea id="writing-note" class="text-area" maxlength="1500" placeholder="Começa por onde quiseres…"></textarea>
      <div class="section-row"><span class="date-note">Esta nota desaparece ao saíres do exercício.</span><button class="button button-secondary button-small" type="button" data-action="clear-writing">Limpar nota</button></div>
    </section>`;
}

function renderProfile() {
  const isPatient = profile.role !== "psychologist";
  const profileDetails = isPatient
    ? `<div class="patient-details">
        <div><span>Nome do paciente</span><strong>${escapeHTML(profile.name.trim() || "Ainda não indicado")}</strong></div>
        <div><span>ID de paciente</span><strong class="patient-id">${escapeHTML(profile.patientId || "Será criado ao guardar o perfil")}</strong></div>
      </div>`
    : `<div class="patient-details">
        <div><span>Nome do psicólogo</span><strong>${escapeHTML(profile.name.trim() || "Ainda não indicado")}</strong></div>
        <div><span>ID Psicólogo</span><strong class="patient-id">${escapeHTML(profile.psychologistId || "Será criado ao guardar o perfil")}</strong></div>
        <div><span>ID paciente</span><strong class="patient-id">${escapeHTML(profile.linkedPatientId || "Ainda não associado")}</strong></div>
      </div>`;
  app.innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">Preferências</p><h1>O teu perfil</h1><p>Escolhe como gostarias de ser recebido/a.</p></div></div>
    <section class="profile-card-main card">
      <span class="profile-initial" aria-hidden="true">${profile.name ? escapeHTML(profile.name.trim().charAt(0).toLocaleUpperCase("pt-PT")) : "U"}</span>
      ${profileDetails}
      <form id="profile-form">
        <label class="field-label" for="profile-name">${isPatient ? "Nome do paciente" : "Nome do psicólogo"} <span style="font-weight:400;color:var(--muted)">(opcional)</span></label>
        <input class="text-input" id="profile-name" name="name" maxlength="50" autocomplete="given-name" value="${escapeHTML(profile.name)}" placeholder="O teu nome">
        ${isPatient ? "" : `<label class="field-label" for="linked-patient-id">ID paciente <span style="font-weight:400;color:var(--muted)">(opcional)</span></label>
        <input class="text-input" id="linked-patient-id" name="linkedPatientId" maxlength="12" pattern="PAC-[A-Fa-f0-9]{8}" title="Usa o formato PAC- seguido de 8 caracteres hexadecimais." value="${escapeHTML(profile.linkedPatientId || "")}" placeholder="PAC-XXXXXXXX">`}
        <div class="section-row"><span></span><button class="button" type="submit">Guardar preferências</button></div>
      </form>
      <div class="privacy-box"><strong>A tua privacidade:</strong> o teu nome e os teus dados são guardados localmente neste navegador. Os IDs são identificadores locais da demonstração, não contas online.</div>
      ${entries.length ? '<div class="section-row"><span></span><button class="text-button danger-button button-small" type="button" data-action="clear">Apagar todos os registos</button></div>' : ""}
    </section>`;
}

function currentRoute() {
  const value = window.location.hash.slice(1) || "welcome";
  if (value === "home") return "dashboard";
  return ["welcome", "role", "access", "signup", "signin", "dashboard", "checkin", "history", "exercises", "profile", "exercise/breathing", "exercise/grounding", "exercise/writing"].includes(value) ? value : "welcome";
}

function render() {
  const route = currentRoute();
  const isPublicRoute = ["welcome", "role", "access", "signup", "signin"].includes(route);
  document.body.classList.toggle("public-view", isPublicRoute);
  document.querySelectorAll("[data-route]").forEach((link) => {
    const target = link.dataset.route;
    const active = target === route || (target === "exercises" && route.startsWith("exercise/"));
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  switch (route) {
    case "welcome": renderWelcome(); break;
    case "role": renderRoleSelection(); break;
    case "access": renderAccess(); break;
    case "signup": renderCreateAccount(); break;
    case "signin": renderSignIn(); break;
    case "dashboard": renderHome(); break;
    case "checkin": renderCheckin(); break;
    case "history": renderHistory(); break;
    case "exercises": renderExercises(); break;
    case "profile": renderProfile(); break;
    case "exercise/breathing": renderBreathing(); break;
    case "exercise/grounding": stopBreathing(); renderGrounding(); break;
    case "exercise/writing": stopBreathing(); renderWriting(); break;
    default: stopBreathing(); renderHome();
  }
  updateProfileHeader();
  app.focus({ preventScroll: true });
}

function saveEntry(form) {
  const data = new FormData(form);
  const mood = moods.find((option) => option.id === data.get("mood"));
  const intensity = Number(data.get("intensity"));
  const note = String(data.get("note") || "").trim();
  if (!mood || !Number.isInteger(intensity) || intensity < 1 || intensity > 10) {
    showToast("Confirma o estado de espírito e a intensidade antes de guardar.", true);
    return;
  }
  const nextEntries = [...entries, {
    id: crypto.randomUUID(),
    mood: mood.id,
    intensity,
    note,
    createdAt: new Date().toISOString(),
    ...(profile.role === "patient" && profile.patientId ? { patientId: profile.patientId } : {})
  }];
  persistValue(ENTRIES_KEY, nextEntries);
  entries = nextEntries;
  showToast("Check-in guardado neste dispositivo.");
  window.location.hash = "history";
}

function saveProfile(form) {
  const data = new FormData(form);
  const nextProfile = {
    ...profile,
    name: String(data.get("name") || "").trim(),
    role: profile.role || "patient"
  };
  if (nextProfile.role === "patient" && !nextProfile.patientId) {
    nextProfile.patientId = createPatientId();
  }
  if (nextProfile.role === "psychologist") {
    nextProfile.psychologistId ||= createPsychologistId();
    nextProfile.linkedPatientId = String(data.get("linkedPatientId") || "").trim().toUpperCase();
    if (nextProfile.linkedPatientId && !/^PAC-[A-F0-9]{8}$/.test(nextProfile.linkedPatientId)) {
      showToast("O ID do paciente deve ter o formato PAC-XXXXXXXX.", true);
      return;
    }
    delete nextProfile.patientId;
  }
  persistValue(PROFILE_KEY, nextProfile);
  profile = nextProfile;
  updateProfileHeader();
  showToast("Preferências guardadas.");
  render();
}

function linkPatient(form) {
  const data = new FormData(form);
  const patientId = String(data.get("patientId") || "").trim().toUpperCase();
  if (!/^PAC-[A-F0-9]{8}$/.test(patientId)) {
    showToast("O ID do paciente deve ter o formato PAC-XXXXXXXX.", true);
    return;
  }
  const nextProfile = { ...profile, linkedPatientId: patientId };
  persistValue(PROFILE_KEY, nextProfile);
  profile = nextProfile;
  showToast("Paciente associado. A verificar os check-ins de hoje.");
  render();
}

function createLocalProfile(form) {
  const name = String(new FormData(form).get("name") || "").trim();
  if (!name) {
    showToast("Escreve um nome para criares o teu perfil.", true);
    return;
  }
  const nextProfile = {
    name,
    role: selectedRole,
    ...(selectedRole === "patient" ? { patientId: createPatientId() } : { psychologistId: createPsychologistId(), linkedPatientId: "" })
  };
  persistValue(PROFILE_KEY, nextProfile);
  profile = nextProfile;
  showToast("Perfil local criado.");
  window.location.hash = "dashboard";
}

function signInLocally(form) {
  const submittedName = String(new FormData(form).get("name") || "").trim();
  const nextProfile = {
    ...profile,
    name: submittedName || profile.name,
    role: selectedRole
  };
  if (selectedRole === "patient" && !nextProfile.patientId) nextProfile.patientId = createPatientId();
  if (selectedRole === "patient") {
    delete nextProfile.psychologistId;
    delete nextProfile.linkedPatientId;
  } else {
    if (!nextProfile.psychologistId) nextProfile.psychologistId = createPsychologistId();
    if (typeof nextProfile.linkedPatientId !== "string") nextProfile.linkedPatientId = "";
    delete nextProfile.patientId;
  }
  persistValue(PROFILE_KEY, nextProfile);
  profile = nextProfile;
  showToast("A Buddy está pronta neste dispositivo.");
  window.location.hash = "dashboard";
}

function exportEntries() {
  const contents = JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
  const url = URL.createObjectURL(new Blob([contents], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "buddy-registos.json";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Os teus registos foram exportados.");
}

function clearEntries() {
  if (!entries.length || !window.confirm("Queres apagar permanentemente todos os teus registos deste dispositivo?")) return;
  persistValue(ENTRIES_KEY, []);
  entries = [];
  showToast("Registos apagados.");
  render();
}

function updateBreathingDisplay() {
  const phase = breathingPhases[breathPhaseIndex];
  const label = document.querySelector("#breathing-phase");
  const count = document.querySelector("#breathing-count");
  const circle = document.querySelector("#breathing-circle");
  const toggle = document.querySelector("#breathing-toggle");
  if (!label || !count || !circle || !toggle) return;
  label.textContent = phase.label;
  count.textContent = `${breathSeconds} segundos · ciclo ${Math.min(breathRounds + 1, 4)} de 4`;
  circle.classList.toggle("active", phase.active);
  toggle.textContent = "Pausar";
  toggle.dataset.action = "breath-pause";
}

function resetBreathingDisplay() {
  breathPhaseIndex = 0;
  breathSeconds = breathingPhases[0].seconds;
  breathRounds = 0;
  const label = document.querySelector("#breathing-phase");
  const count = document.querySelector("#breathing-count");
  const toggle = document.querySelector("#breathing-toggle");
  const circle = document.querySelector("#breathing-circle");
  if (label) label.textContent = "Pronto?";
  if (count) count.textContent = "4 ciclos · ao teu ritmo";
  if (toggle) { toggle.textContent = "Começar"; toggle.dataset.action = "breath-start"; }
  if (circle) circle.classList.remove("active");
}

function startBreathing() {
  if (breathTimer) return;
  updateBreathingDisplay();
  breathTimer = window.setInterval(() => {
    breathSeconds -= 1;
    if (breathSeconds <= 0) {
      breathPhaseIndex += 1;
      if (breathPhaseIndex >= breathingPhases.length) {
        breathPhaseIndex = 0;
        breathRounds += 1;
      }
      if (breathRounds >= 4) {
        stopBreathing();
        resetBreathingDisplay();
        const label = document.querySelector("#breathing-phase");
        const count = document.querySelector("#breathing-count");
        if (label) label.textContent = "Muito bem";
        if (count) count.textContent = "Terminaste os quatro ciclos.";
        showToast("Pausa concluída. Obrigado por este momento.");
        return;
      }
      breathSeconds = breathingPhases[breathPhaseIndex].seconds;
    }
    updateBreathingDisplay();
  }, 1000);
}

function stopBreathing() {
  if (breathTimer) window.clearInterval(breathTimer);
  breathTimer = undefined;
}

function handleClick(event) {
  const routeLink = event.target.closest("[data-route]");
  if (routeLink) {
    event.preventDefault();
    const route = routeLink.dataset.route;
    if (window.location.hash === `#${route}`) render();
    else window.location.hash = route;
    return;
  }
  const exerciseButton = event.target.closest("[data-exercise]");
  if (exerciseButton) {
    window.location.hash = `exercise/${exerciseButton.dataset.exercise}`;
    return;
  }
  if (event.target.closest('[data-action="select-role"]')) {
    const roleCard = event.target.closest('[data-action="select-role"]');
    selectedRole = roleCard.dataset.role;
    window.location.hash = "access";
    return;
  }
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "export") exportEntries();
  if (action === "clear") clearEntries();
  if (action === "breath-start") startBreathing();
  if (action === "breath-pause") {
    stopBreathing();
    const toggle = document.querySelector("#breathing-toggle");
    if (toggle) { toggle.textContent = "Continuar"; toggle.dataset.action = "breath-start"; }
  }
  if (action === "breath-reset") { stopBreathing(); resetBreathingDisplay(); }
  if (action === "clear-writing") {
    const note = document.querySelector("#writing-note");
    if (note) note.value = "";
  }
}

function initialize() {
  document.querySelector("[data-current-year]").textContent = String(new Date().getFullYear());
  app.addEventListener("click", handleClick);
  app.addEventListener("submit", (event) => {
    event.preventDefault();
    try {
      if (event.target.id === "checkin-form") saveEntry(event.target);
      if (event.target.id === "profile-form") saveProfile(event.target);
      if (event.target.id === "patient-link-form") linkPatient(event.target);
      if (event.target.id === "create-profile-form") createLocalProfile(event.target);
      if (event.target.id === "sign-in-form") signInLocally(event.target);
    } catch (error) {
      showToast(error.message, true);
    }
  });
  app.addEventListener("input", (event) => {
    if (event.target.id === "intensity") {
      const output = document.querySelector("#intensity-output");
      if (output) output.value = event.target.value;
    }
  });
  window.addEventListener("hashchange", render);
  try {
    entries = readStoredValue(ENTRIES_KEY, [], (value) => Array.isArray(value) && value.every((item) =>
      item && typeof item.id === "string" && moods.some((mood) => mood.id === item.mood)
      && Number.isInteger(item.intensity) && item.intensity >= 1 && item.intensity <= 10
      && typeof item.note === "string" && !Number.isNaN(Date.parse(item.createdAt))
      && (item.patientId === undefined || (typeof item.patientId === "string" && /^PAC-[A-F0-9]{8}$/.test(item.patientId)))));
    profile = readStoredValue(PROFILE_KEY, { name: "", role: "patient" }, (value) =>
      value && typeof value.name === "string" && value.name.length <= 50
      && (value.role === undefined || value.role === "patient" || value.role === "psychologist")
      && (value.patientId === undefined || (typeof value.patientId === "string" && /^PAC-[A-F0-9]{8}$/.test(value.patientId)))
      && (value.psychologistId === undefined || (typeof value.psychologistId === "string" && /^PSI-[A-F0-9]{8}$/.test(value.psychologistId)))
      && (value.linkedPatientId === undefined || (typeof value.linkedPatientId === "string" && (value.linkedPatientId === "" || /^PAC-[A-F0-9]{8}$/.test(value.linkedPatientId)))));
    if (profile.role !== "psychologist" && !profile.patientId) {
      profile = { ...profile, role: "patient", patientId: createPatientId() };
      persistValue(PROFILE_KEY, profile);
    }
    if (profile.role === "psychologist" && !profile.psychologistId) {
      profile = { ...profile, psychologistId: createPsychologistId(), linkedPatientId: profile.linkedPatientId || "" };
      persistValue(PROFILE_KEY, profile);
    }
    selectedRole = profile.role || "patient";
  } catch (error) {
    showToast(error.message, true);
  }
  render();
  if ("serviceWorker" in navigator && window.isSecureContext) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch((error) => {
        console.error("Não foi possível registar o service worker da Buddy.", error);
      });
    });
  }
}

initialize();
