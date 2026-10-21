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

  const installButton = document.querySelector(".install-button");

  if (typeof HTMLButtonElement === "undefined" || !(installButton instanceof HTMLButtonElement)) {
    return;
  }

  let installPrompt;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) {
      return;
    }

    await installPrompt.prompt();
    installPrompt = undefined;
    installButton.hidden = true;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = undefined;
    installButton.hidden = true;
  });
}
