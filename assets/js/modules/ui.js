export function updateCurrentYear() {
  if (typeof document === "undefined") {
    return;
  }

  const year = document.querySelector("[data-current-year]");

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }
}

export function setupInstallPrompt() {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return;
  }

  let installPrompt;
  let appInstalled = false;

  const isInstalled = () =>
    appInstalled || window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

  const updateInstallButton = () => {
    const installButton = document.querySelector(".install-button");
    if (typeof HTMLButtonElement !== "undefined" && installButton instanceof HTMLButtonElement) {
      installButton.hidden = isInstalled();
    }
  };

  const showInstallHelp = (message) => {
    const help = document.querySelector("#install-help");
    if (help) {
      help.textContent = message;
      help.hidden = false;
    }
  };

  const clearInstallHelp = () => {
    const help = document.querySelector("#install-help");
    if (help) {
      help.textContent = "";
      help.hidden = true;
    }
  };

  updateInstallButton();

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    clearInstallHelp();
    updateInstallButton();
  });

  document.addEventListener("click", async (event) => {
    const installButton = event.target.closest(".install-button");
    if (!installButton) {
      return;
    }

    if (isInstalled()) {
      updateInstallButton();
      return;
    }

    if (!installPrompt) {
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
      showInstallHelp(isIOS
        ? "Para instalar no iPhone/iPad: toca em Partilhar no Safari e escolhe «Adicionar ao ecrã principal»."
        : "A instalação não está disponível neste momento. Abre o menu do navegador e escolhe «Instalar aplicação» ou «Adicionar ao ecrã principal».");
      return;
    }

    const prompt = installPrompt;
    installPrompt = undefined;
    installButton.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      if (choice.outcome === "accepted") {
        updateInstallButton();
      }
    } catch (error) {
      console.error("Não foi possível iniciar a instalação da Buddy.", error);
      showInstallHelp("Não foi possível iniciar a instalação. Tenta novamente através do menu do navegador.");
    } finally {
      installButton.disabled = false;
    }
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    appInstalled = true;
    updateInstallButton();
  });

  window.addEventListener("hashchange", updateInstallButton);
}
