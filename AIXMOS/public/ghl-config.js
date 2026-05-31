/**
 * AIXMOS — GoHighLevel integration config (source template)
 * Deployed copy: public/aixmos/ghl-config.js (generated via npm run prebuild)
 * Set NEXT_PUBLIC_GHL_* in .env / Vercel — see .env.example
 */
(function () {
  const PLACEHOLDER = (token) => token;

  window.AIXMOS_GHL = {
    checkout97: PLACEHOLDER("YOUR_GHL_97_CHECKOUT_LINK"),
    checkoutLLC: PLACEHOLDER("YOUR_GHL_LLC_CHECKOUT_LINK"),
    checkout3750: PLACEHOLDER("YOUR_GHL_3750_CHECKOUT_LINK"),
    operatorApply: PLACEHOLDER("YOUR_GHL_OPERATOR_APPLICATION_LINK"),
    webhookUrl: PLACEHOLDER("YOUR_GHL_WEBHOOK_URL"),
    formId: PLACEHOLDER("YOUR_GHL_FORM_ID"),
  };

  function isLiveUrl(url) {
    if (!url || typeof url !== "string") return false;
    if (url.startsWith("YOUR_GHL_")) return false;
    if (url === "[PASTE YOUR LINK]") return false;
    return url.startsWith("http://") || url.startsWith("https://");
  }

  window.wireAixmosGhl = function wireAixmosGhl() {
    const cfg = window.AIXMOS_GHL;
    if (!cfg) return;

    document.querySelectorAll("[data-ghl-href]").forEach((el) => {
      const key = el.getAttribute("data-ghl-href");
      const url = cfg[key];
      if (isLiveUrl(url)) el.setAttribute("href", url);
    });

    document.querySelectorAll("[data-ghl-card]").forEach((card) => {
      const key = card.getAttribute("data-ghl-card");
      const url = cfg[key];
      if (!isLiveUrl(url)) return;

      const open = () => window.open(url, "_blank", "noopener,noreferrer");
      card.addEventListener("click", open);
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

    const embed = document.getElementById("ghl-form-embed");
    if (embed && isLiveUrl(cfg.formEmbedUrl)) {
      embed.src = cfg.formEmbedUrl;
    }
  };
})();
