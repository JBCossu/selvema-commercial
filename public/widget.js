/*
 * Selvema Commercial — widget chatbot embarquable.
 * Intégration :
 *   <script src="https://VOTRE-DOMAINE/widget.js" data-selvema-client="ID" async></script>
 *
 * Comportement :
 *  - AVANT l'animation : le cadre est 100 % invisible — visibility:hidden +
 *    opacity:0 + pointer-events:none ET aucun style peignable (ni bordure, ni
 *    ombre, ni fond, ni lueur, ni poignée). Ces styles ne sont posés qu'au
 *    tout début de showFrame(), en même temps que le zoom.
 *  - après ~2 s, la fenêtre surgit (zoom scale 0.5→1, 400ms ease-out) ; elle
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

  // ── AVANT L'ANIMATION : les 3 éléments (outer, inner, iframe) n'ont AUCUN
  //    élément peignable. On l'impose explicitement sur chacun, dès leur
  //    création : border:none + box-shadow:none + outline:none +
  //    background:transparent. Rien ne peut donc laisser de contour avant que
  //    showFrame() ne (re)pose bordure / fond / ombre, en même temps que le zoom.
  function killPaint(el) {
    el.style.border = "none";
    el.style.boxShadow = "none";
    el.style.outline = "none";
    el.style.background = "transparent";
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
    // rien de peignable avant showFrame
    "background:transparent",
    "border:none",
    "box-shadow:none",
    "outline:none",
    "opacity:0",
    "transform:scale(0.5)",
    "transform-origin:100% 100%",
    "transition:opacity .4s ease-out, transform .4s ease-out",
  ].join(";");

  var iframe = document.createElement("iframe");
  iframe.src = ORIGIN + "/embed?c=" + encodeURIComponent(CLIENT_ID);
  iframe.title = "Assistant en ligne";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.setAttribute("frameborder", "0"); // vieux navigateurs
  iframe.style.cssText =
    "width:100%;height:100%;display:block;" +
    "border:none;box-shadow:none;outline:none;background:transparent";

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
    outer.style.visibility = "visible";
    outer.style.pointerEvents = "auto";
    outer.style.resize = "both";
    // reflow avant de lancer l'opacité/zoom pour que la transition joue
    void outer.offsetWidth;
    outer.style.opacity = "1";
    inner.style.opacity = "1";
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
    inner.style.opacity = "0";
    inner.style.transform = "scale(0.5)";
    // cadre entièrement invisible en état réduit — on retire TOUT ce qui peint
    inner.style.border = "0";
    inner.style.background = "transparent";
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
          if (meta.tagline) {
            TAGLINE = meta.tagline;
            barText.textContent = TAGLINE;
          }
        })
        .catch(function () {});
    } catch (e) {}
  }

  function mount() {
    document.body.appendChild(outer);
    document.body.appendChild(bar);
    loadMeta();

    // Ouverture automatique après 2 s — aucun clic nécessaire, toujours.
    setTimeout(showFrame, 2000);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
