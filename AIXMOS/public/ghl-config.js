/**
 * AIXMOS — GoHighLevel destinations.
 * Product-specific checkout URLs (when pasted in Vercel) can replace these.
 * Until then every CTA still lands on the live All In One Management GHL site
 * with a campaign so contacts are tagged into the right pipeline.
 */
(function () {
  const GHL = "https://allinonemanagementsolutions.com";
  function offer(campaign) {
    return GHL + "/?utm_source=aixmos&utm_medium=web&utm_campaign=" + encodeURIComponent(campaign);
  }

  window.AIXMOS_GHL = {
    checkout97: offer("member-97"),
    checkoutOpsKit: offer("ops-kit"),
    checkoutCommandKit: offer("command-kit"),
    checkoutDealerBundle: offer("dealer-bundle"),
    checkoutLLC: offer("llc-397"),
    checkout3750: offer("build-3750"),
    checkout7500: offer("build-7500"),
    checkout15000: offer("build-15000"),
    checkout25000: offer("build-25000"),
    creditGuidance: offer("credit-guidance"),
    consultCall: offer("strategy-call"),
    operatorApply: offer("operator-apply"),
    aixmode: offer("aixmode"),
    formEmbedUrl: "",
    webhookUrl: "",
    formId: "",
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
      if (isLiveUrl(url)) {
        el.setAttribute("href", url);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
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
      card.style.cursor = "pointer";
    });

    const embed = document.getElementById("ghl-form-embed");
    if (embed && isLiveUrl(cfg.formEmbedUrl)) {
      embed.src = cfg.formEmbedUrl;
    }
  };
})();
