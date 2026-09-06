/*
 * Selvema Commercial — widget chatbot embarquable.
 * Intégration :
 *   <script src="https://VOTRE-DOMAINE/widget.js" data-selvema-client="ID" async></script>
 *
 * Comportement :
 *  - AVANT l'animation : outer, inner ET iframe sont chacun en opacity:0 +
 *    visibility:hidden + pointer-events:none, sans aucun style peignable (ni
 *    bordure, ni ombre, ni fond, ni lueur, ni poignée). Visibilité, bordure,
 *    fond et ombre ne sont posés qu'au tout début de showFrame(), en même
 *    temps que le zoom — jamais avant.
 *  - DÉCLENCHEMENT INTELLIGENT (100 % côté client, ici) :
 *      • délai adaptatif selon le type de page : bien 4 s, accueil 2 s,
 *        contact aucune ouverture auto (mini-barre seule).
 *      • scroll rapide vers le bas → ouverture accélérée à 1 s.
 *      • page de bien : accroche contextuelle « Ce bien vous intéresse ? … »
 *        et garantie d'ouverture au-delà de 30 s.
 *      • ne pas déranger : si le visiteur a fermé le widget (croix) OU a déjà
 *        conversé, plus aucune ouverture auto de toute la session (sessionStorage).
 *      Le type de page peut être forcé via data-selvema-page="property|home|contact".
 *  - à l'ouverture, la fenêtre surgit (zoom scale 0.5→1, 400ms ease-out) ; elle
 *    signale alors à l'iframe (postMessage "selvema-frame-shown") pour lancer la
 *    séquence interne : le personnage monte, puis l'accroche s'écrit (machine à écrire)
 *  - le cadre flotte alors en boucle (translateY -12px ↔ 0, 2 s, ease-in-out)
 *  - ancré en bas à droite : redimensionnable (CSS resize:both) entre 280×380 et
 *    500×700, sans sortir de l'écran
 *  - le bouton × le réduit en une barre compacte (accroche seule) ; un clic le rouvre
 */
(function () {
  "use strict";

  if (window.__selvemaWidgetLoaded) return;
  window.__selvemaWidgetLoaded = true;

  var current = document.currentScript;
  if (!current) {
    var scripts = document.getElementsByTagName("script");
    for (var i = scripts.length - 1; i >= 0; i--) {
      if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
        current = scripts[i];
        break;
      }
    }
  }
  var ORIGIN = (function () {
    try {
      return new URL(current.src).origin;
    } catch (e) {
      return "";
    }
  })();

  var CLIENT_ID = current
    ? current.getAttribute("data-selvema-client") || ""
    : "";
  if (!CLIENT_ID) {
    console.warn(
      "[Selvema] Attribut data-selvema-client manquant sur la balise <script> — le widget ne peut pas se charger."
    );
    return;
  }

  var Z = 2147483000;
  var ACCENT = "#882de1"; // couleur des contours du client
  var BG = "#0a0a1a"; //     fond de la carte du client
  var TAGLINE = "Une question ? Je suis là pour vous aider.";
  var collapsed = false;

  // Accroche contextuelle sur une page de bien.
  var PROPERTY_TAGLINE =
    "Ce bien vous intéresse ? Je peux répondre à vos questions.";
  var taglineLocked = false; // vrai = page de bien, ne pas écraser via /api/widget

  // « Ne pas déranger », par client et par session (origine du site client).
  var KEY_DISMISSED = "selvema_dismissed_" + CLIENT_ID;
  var KEY_CONVERSED = "selvema_conversed_" + CLIENT_ID;

  // État du déclenchement.
  var openTimer = null;
  var autoOpened = false; // le widget a été ouvert automatiquement
  var suppressed = false; // ne pas déranger (croix cliquée ou conversation eue)
  var pageType = "other";


  function hexToRgba(hex, a) {
    var m = /^#?([0-9a-f]{6})$/i.exec(String(hex).trim());
    if (!m) return "rgba(136,45,225," + a + ")";
    var n = parseInt(m[1], 16);
    return (
      "rgba(" +
      ((n >> 16) & 255) +
      "," +
      ((n >> 8) & 255) +
      "," +
      (n & 255) +
      "," +
      a +
      ")"
    );
  }
  function boxShadow() {
    return (
      "0 18px 50px " +
      hexToRgba(ACCENT, 0.35) +
      ", 0 8px 24px rgba(0,0,0,0.45)"
    );
  }

  // ---- Animation de flottaison (sur le conteneur externe) -------------
  var style = document.createElement("style");
  style.textContent =
    "@keyframes selvema-float{" +
    "0%{transform:translateY(-12px)}" +
    "50%{transform:translateY(0)}" +
    "100%{transform:translateY(-12px)}}" +
    "@media (prefers-reduced-motion: reduce){" +
    ".selvema-frame-outer{animation:none !important}" +
    ".selvema-frame-inner{transition:none !important}}";
  document.head.appendChild(style);

  // ── AVANT L'ANIMATION : les 3 éléments (outer, inner, iframe) sont
  //    TOTALEMENT invisibles et n'ont AUCUN élément peignable. On l'impose
  //    explicitement sur chacun, dès leur création : opacity:0 +
  //    visibility:hidden + border:none + box-shadow:none + outline:none +
  //    background:transparent. Rien — pas même un contour d'iframe rendu dans
  //    son propre calque — ne peut apparaître avant que showFrame() ne (re)pose
  //    bordure / fond / ombre / visibilité, en même temps que le zoom.
  function killPaint(el) {
    el.style.border = "none";
    el.style.boxShadow = "none";
    el.style.outline = "none";
    el.style.background = "transparent";
    el.style.opacity = "0";
    el.style.visibility = "hidden";
  }

  // ---- Fenêtre : externe = position + flottaison + redimensionnement,
  //               interne = carte + zoom d'entrée
  var outer = document.createElement("div");
  outer.className = "selvema-frame-outer";
  outer.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:20px",
    "width:320px",
    "height:480px",
    "min-width:280px",
    "min-height:380px",
    // bornes hautes + garde-fou : jamais plus grand que l'écran (moins la marge)
    "max-width:min(500px, calc(100vw - 40px))",
    "max-height:min(700px, calc(100vh - 40px))",
    "border-radius:16px",
    "overflow:hidden",
    // invisible + non peignable + non cliquable pendant les 2 premières s.
    // visibility:hidden (et PAS display:none) → l'iframe reste « chaude » et la
    // séquence interne reste synchro.
    "visibility:hidden",
    "opacity:0",
    "background:transparent",
    "border:none",
    "box-shadow:none",
    "outline:none",
    "transition:opacity .3s ease",
    "resize:none",
    "z-index:" + Z,
    "pointer-events:none",
  ].join(";");

  var inner = document.createElement("div");
  inner.className = "selvema-frame-inner";
  inner.style.cssText = [
    "width:100%",
    "height:100%",
    "border-radius:16px",
    "overflow:hidden",
    // rien de peignable ni de visible avant showFrame
    "background:transparent",
    "border:none",
    "box-shadow:none",
    "outline:none",
    "opacity:0",
    "visibility:hidden",
    "transform:scale(0.5)",
    "transform-origin:100% 100%",
    "transition:opacity .4s ease-out, transform .4s ease-out",
  ].join(";");

  var iframe = document.createElement("iframe");
  // .src est posé dans mount(), une fois le type de page détecté (l'accroche
  // contextuelle d'une page de bien est passée en paramètre d'URL).
  iframe.title = "Assistant en ligne";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.setAttribute("frameborder", "0"); // vieux navigateurs
  // opacity:0 + visibility:hidden POSÉS DIRECTEMENT sur l'iframe : certains
  // navigateurs composent l'iframe dans son propre calque et peuvent la laisser
  // « percer » un parent en opacity:0 le temps d'une frame au premier rendu.
  iframe.style.cssText =
    "width:100%;height:100%;display:block;" +
    "border:none;box-shadow:none;outline:none;background:transparent;" +
    "opacity:0;visibility:hidden;transition:opacity .4s ease-out";

  // Ré-assertion explicite, élément par élément (ceinture + bretelles).
  killPaint(outer);
  killPaint(inner);
  killPaint(iframe);

  inner.appendChild(iframe);
  outer.appendChild(inner);

  // ---- Barre compacte (état réduit) ---------------------------------
  var bar = document.createElement("button");
  bar.type = "button";
  bar.className = "selvema-collapsed-bar";
  bar.setAttribute("aria-label", "Rouvrir l'assistant");
  bar.style.cssText = [
    "position:fixed",
    "right:20px",
    "bottom:20px",
    "max-width:280px",
    "display:flex",
    "align-items:center",
    "gap:8px",
    "text-align:left",
    // fond principal du widget (= --sv-bg / background_color côté iframe) ;
    // mis à jour par applyBackground() quand /api/widget/<id> répond.
    "background:" + BG,
    "color:#fff",
    // pas de bordure, pas d'ombre, pas de lueur en état réduit
    "border:0",
    "border-radius:9999px",
    "padding:11px 16px",
    "font:13px/1.3 Inter,-apple-system,Segoe UI,Roboto,sans-serif",
    "box-shadow:none",
    "cursor:pointer",
    "z-index:" + Z,
    "opacity:0",
    "transform:translateY(6px)",
    "pointer-events:none",
    "transition:opacity .3s ease, transform .2s ease",
  ].join(";");

  var barIcon = document.createElement("span");
  barIcon.style.cssText = "flex:0 0 auto;display:flex;line-height:0";
  barIcon.innerHTML =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>';

  var barText = document.createElement("span");
  barText.textContent = TAGLINE;
  barText.style.cssText =
    "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";

  bar.appendChild(barIcon);
  bar.appendChild(barText);
  bar.onmouseenter = function () {
    bar.style.transform = "translateY(0) scale(1.03)";
  };
  bar.onmouseleave = function () {
    bar.style.transform = "translateY(0) scale(1)";
  };

  function showBar() {
    bar.style.opacity = "1";
    bar.style.transform = "translateY(0)";
    bar.style.pointerEvents = "auto";
  }
  function hideBar() {
    bar.style.opacity = "0";
    bar.style.transform = "translateY(6px)";
    bar.style.pointerEvents = "none";
  }

  function showFrame() {
    collapsed = false;
    hideBar();
    // ── Le cadre devient visible ICI, jamais avant. C'est le SEUL endroit où
    //    l'on pose la bordure, le fond, l'ombre et la flottaison : ainsi rien
    //    n'a pu apparaître pendant les 2 s précédentes.
    inner.style.border = "1px solid " + ACCENT;
    inner.style.background = BG;
    outer.style.boxShadow = boxShadow();
    outer.style.animation = "selvema-float 2s ease-in-out infinite";
    // visibilité (re)posée ICI sur les 3 éléments, jamais avant.
    outer.style.visibility = "visible";
    inner.style.visibility = "visible";
    iframe.style.visibility = "visible";
    outer.style.pointerEvents = "auto";
    outer.style.resize = "both";
    // reflow avant de lancer l'opacité/zoom pour que la transition joue
    void outer.offsetWidth;
    outer.style.opacity = "1";
    inner.style.opacity = "1";
    iframe.style.opacity = "1";
    inner.style.transform = "scale(1)";
    // Signale à l'iframe que le cadre est affiché → déclenche la séquence
    // d'animation interne (personnage puis accroche).
    try {
      if (iframe.contentWindow) {
        iframe.contentWindow.postMessage({ type: "selvema-frame-shown" }, "*");
      }
    } catch (e) {}
  }

  function collapse() {
    collapsed = true;
    suppressed = true;
    if (openTimer) {
      clearTimeout(openTimer);
      openTimer = null;
    }
    // Croix cliquée → plus aucune ouverture auto de toute la session.
    try {
      sessionStorage.setItem(KEY_DISMISSED, "1");
    } catch (e) {}
    inner.style.opacity = "0";
    inner.style.transform = "scale(0.5)";
    // cadre entièrement invisible en état réduit — on retire TOUT ce qui peint
    inner.style.border = "0";
    inner.style.background = "transparent";
    inner.style.visibility = "hidden";
    iframe.style.opacity = "0";
    iframe.style.visibility = "hidden";
    outer.style.opacity = "0";
    outer.style.visibility = "hidden";
    outer.style.pointerEvents = "none";
    outer.style.boxShadow = "none";
    outer.style.animation = "none";
    outer.style.resize = "none";
    setTimeout(showBar, 180);
  }

  bar.addEventListener("click", function () {
    showFrame();
  });

  // color = couleur des CONTOURS du client (bordure du cadre + lueur).
  // On ne « peint » rien tant que le cadre n'est pas affiché : la valeur est
  // mémorisée, showFrame() l'appliquera.
  function applyAccent(color) {
    if (!color) return;
    ACCENT = color;
    if (!collapsed && outer.style.visibility === "visible") {
      inner.style.border = "1px solid " + ACCENT;
      outer.style.boxShadow = boxShadow();
    }
  }

  // Fond de la carte (mémorisé, appliqué par showFrame) — évite un flash si le
  // client a choisi un autre fond de zone de conversation.
  function applyBackground(color) {
    if (!color) return;
    BG = color;
    // La mini-barre réduite suit toujours le fond principal du widget,
    // qu'elle soit affichée ou non.
    bar.style.background = BG;
    if (!collapsed && outer.style.visibility === "visible") {
      inner.style.background = BG;
    }
  }

  window.addEventListener("message", function (e) {
    if (ORIGIN && e.origin !== ORIGIN) return;
    var t = e.data && e.data.type;
    if (t === "selvema-widget-close") collapse();
    if (t === "selvema-conversation-started") {
      // Le visiteur a écrit un message → plus d'ouverture auto cette session.
      suppressed = true;
      if (openTimer) {
        clearTimeout(openTimer);
        openTimer = null;
      }
      try {
        sessionStorage.setItem(KEY_CONVERSED, "1");
      } catch (e2) {}
    }
    // "selvema-widget-expand" : la fenêtre est déjà en grand, rien à faire.
  });

  function loadMeta() {
    try {
      fetch(ORIGIN + "/api/widget/" + encodeURIComponent(CLIENT_ID), {
        mode: "cors",
      })
        .then(function (r) {
          return r.ok ? r.json() : null;
        })
        .then(function (meta) {
          if (!meta) return;
          if (meta.widget_color) applyAccent(meta.widget_color);
          if (meta.background_color) applyBackground(meta.background_color);
          if (meta.tagline && !taglineLocked) {
            TAGLINE = meta.tagline;
            barText.textContent = TAGLINE;
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  DÉTECTION DU TYPE DE PAGE
  // ─────────────────────────────────────────────────────────────────────────

  function typeFromAttr() {
    var v =
      current &&
      (current.getAttribute("data-selvema-page") || "").toLowerCase().trim();
    if (v === "property" || v === "bien" || v === "annonce") return "property";
    if (v === "contact") return "contact";
    if (v === "home" || v === "accueil") return "home";
    return "";
  }

  function typeFromUrl() {
    var p = (location.pathname || "/").toLowerCase();
    if (
      /(^|\/)(contact|contacts|nous-contacter|contactez[-\w]*|contact-us)(\/|$|\.)/.test(
        p
      )
    )
      return "contact";
    if (
      /(^|\/)(bien|biens|annonce|annonces|propriete|proprietes|property|properties|listing|listings|a-vendre|a-louer|maison|appartement|estimation|ref)(\/|-|_|$)/.test(
        p
      ) ||
      /\/\d{4,}(\/|$|[-_])/.test(p) // identifiant numérique de bien dans l'URL
    )
      return "property";
    if (p === "/" || p === "" || /(^|\/)(index|accueil|home)(\.[a-z0-9]+)?$/.test(p))
      return "home";
    return "";
  }

  function typeFromMarkup() {
    try {
      var nodes = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (var i = 0; i < nodes.length; i++) {
        if (
          /"@type"\s*:\s*"(RealEstateListing|Residence|Apartment|House|SingleFamilyResidence|Accommodation|Offer|Product)"/i.test(
            nodes[i].textContent || ""
          )
        )
          return "property";
      }
    } catch (e) {}
    var og = document.querySelector('meta[property="og:type"]');
    if (og) {
      var c = (og.getAttribute("content") || "").toLowerCase();
      if (c === "product" || c === "article" || c.indexOf("realestate") !== -1)
        return "property";
    }
    // Heuristique de contenu : un prix ET (une surface OU un nombre de pièces).
    try {
      var txt = (
        (document.body && document.body.innerText) ||
        ""
      ).slice(0, 5000);
      var hasPrice = /\d[\d\s.]{2,}\s?(€|eur\b|euros)/i.test(
        document.title + " " + txt
      );
      var hasArea = /\d+\s?m(²|2|²)\b/i.test(txt);
      var hasRooms = /\b\d+\s?(pi[eè]ces?|chambres?|t\d|f\d)\b/i.test(txt);
      if (hasPrice && (hasArea || hasRooms)) return "property";
    } catch (e) {}
    return "";
  }

  function detectPageType() {
    return typeFromAttr() || typeFromUrl() || typeFromMarkup() || "other";
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  ORDONNANCEMENT DE L'OUVERTURE
  // ─────────────────────────────────────────────────────────────────────────

  function scheduleOpen(ms) {
    if (suppressed || autoOpened) return;
    if (openTimer) clearTimeout(openTimer);
    openTimer = setTimeout(function () {
      openTimer = null;
      if (suppressed || autoOpened || collapsed) return;
      autoOpened = true;
      showFrame();
    }, Math.max(0, ms));
  }

  // Scroll rapide vers le bas : ~700 px de descente cumulée en moins de 700 ms.
  var lastScrollY = 0,
    scrollWinStart = 0,
    scrollAccum = 0,
    fastScrollDone = false;
  function onScroll() {
    if (fastScrollDone || suppressed || autoOpened) return;
    var y = window.pageYOffset || document.documentElement.scrollTop || 0;
    var dy = y - lastScrollY;
    lastScrollY = y;
    if (dy <= 0) return;
    var now = Date.now();
    if (now - scrollWinStart > 700) {
      scrollWinStart = now;
      scrollAccum = 0;
    }
    scrollAccum += dy;
    if (scrollAccum >= 700) {
      fastScrollDone = true;
      window.removeEventListener("scroll", onScroll);
      scheduleOpen(1000); // il cherche quelque chose → on ouvre vite
    }
  }

  function mount() {
    document.body.appendChild(outer);
    document.body.appendChild(bar);

    // Ne pas déranger : croix déjà cliquée OU conversation déjà eue cette session.
    try {
      if (
        sessionStorage.getItem(KEY_DISMISSED) === "1" ||
        sessionStorage.getItem(KEY_CONVERSED) === "1"
      )
        suppressed = true;
    } catch (e) {}

    pageType = detectPageType();

    // URL de l'iframe : accroche contextuelle si page de bien.
    var src = ORIGIN + "/embed?c=" + encodeURIComponent(CLIENT_ID);
    if (pageType === "property") {
      src += "&t=" + encodeURIComponent(PROPERTY_TAGLINE);
      TAGLINE = PROPERTY_TAGLINE;
      taglineLocked = true;
      barText.textContent = TAGLINE;
    }
    iframe.src = src;

    loadMeta();

    // Ne pas déranger → aucune ouverture auto ; on montre juste la mini-barre
    // comme point d'entrée discret.
    if (suppressed) {
      setTimeout(showBar, 800);
      return;
    }

    // Page contact → pas d'ouverture auto (il est déjà en train de nous joindre).
    if (pageType === "contact") {
      setTimeout(showBar, 1200);
      return;
    }

    // Délai adaptatif : bien 4 s, accueil / autre 2 s.
    scheduleOpen(pageType === "property" ? 4000 : 2000);

    // Scroll rapide → ouverture accélérée à 1 s.
    lastScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
    scrollWinStart = Date.now();
    window.addEventListener("scroll", onScroll, { passive: true });

    // Page de bien : au-delà de 30 s sur la page, garantir l'ouverture
    // (l'accroche « Ce bien vous intéresse ? » est déjà en place).
    if (pageType === "property") {
      setTimeout(function () {
        scheduleOpen(0);
      }, 30000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
