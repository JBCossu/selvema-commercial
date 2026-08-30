/*
 * Selvema Commercial — widget chatbot embarquable.
 * Intégration : <script src="https://VOTRE-DOMAINE/widget.js" async></script>
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

  var ACCENT = "#882de1";
  var Z = 2147483000;
  var open = false;

  // ---- Bouton lanceur -------------------------------------------------------
  var launcher = document.createElement("button");
  launcher.setAttribute("aria-label", "Ouvrir le chat");
  launcher.style.cssText = [
    "position:fixed",
    "bottom:20px",
    "right:20px",
    "width:60px",
    "height:60px",
    "border-radius:9999px",
    "border:1px solid " + ACCENT,
    "background:#000",
    "color:#fff",
    "cursor:pointer",
    "box-shadow:0 8px 30px rgba(136,45,225,0.45)",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "z-index:" + Z,
    "transition:transform .15s ease",
    "padding:0",
  ].join(";");
  launcher.onmouseenter = function () {
    launcher.style.transform = "scale(1.05)";
  };
  launcher.onmouseleave = function () {
    launcher.style.transform = "scale(1)";
  };

  var iconChat =
    '<svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.6L3 21l1.9-5.6A8.5 8.5 0 1 1 21 11.5z" stroke="#fff" stroke-width="2" stroke-linejoin="round"/></svg>';
  var iconClose =
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>';
  launcher.innerHTML = iconChat;

  // ---- Conteneur iframe ---------------------------------------------------
  var frameWrap = document.createElement("div");
  frameWrap.style.cssText = [
    "position:fixed",
    "bottom:92px",
    "right:20px",
    "width:390px",
    "height:600px",
    "max-width:calc(100vw - 32px)",
    "max-height:calc(100vh - 120px)",
    "border-radius:16px",
    "overflow:hidden",
    "box-shadow:0 20px 60px rgba(0,0,0,0.5)",
    "z-index:" + Z,
    "opacity:0",
    "transform:translateY(12px) scale(0.98)",
    "pointer-events:none",
    "transition:opacity .18s ease, transform .18s ease",
  ].join(";");

  var iframe = document.createElement("iframe");
  iframe.src = ORIGIN + "/embed";
  iframe.title = "Assistant en ligne";
  iframe.setAttribute("allow", "clipboard-write");
  iframe.style.cssText =
    "width:100%;height:100%;border:0;background:transparent;display:block";
  frameWrap.appendChild(iframe);

  function applyMobile() {
    if (window.matchMedia("(max-width: 480px)").matches) {
      frameWrap.style.width = "100vw";
      frameWrap.style.height = "100vh";
      frameWrap.style.bottom = "0";
      frameWrap.style.right = "0";
      frameWrap.style.maxWidth = "100vw";
      frameWrap.style.maxHeight = "100vh";
      frameWrap.style.borderRadius = "0";
    } else {
      frameWrap.style.width = "390px";
      frameWrap.style.height = "600px";
      frameWrap.style.bottom = "92px";
      frameWrap.style.right = "20px";
      frameWrap.style.maxWidth = "calc(100vw - 32px)";
      frameWrap.style.maxHeight = "calc(100vh - 120px)";
      frameWrap.style.borderRadius = "16px";
    }
  }
  window.addEventListener("resize", applyMobile);

  function setOpen(next) {
    open = next;
    applyMobile();
    if (open) {
      frameWrap.style.opacity = "1";
      frameWrap.style.transform = "translateY(0) scale(1)";
      frameWrap.style.pointerEvents = "auto";
      launcher.innerHTML = iconClose;
      launcher.setAttribute("aria-label", "Fermer le chat");
    } else {
      frameWrap.style.opacity = "0";
      frameWrap.style.transform = "translateY(12px) scale(0.98)";
      frameWrap.style.pointerEvents = "none";
      launcher.innerHTML = iconChat;
      launcher.setAttribute("aria-label", "Ouvrir le chat");
    }
  }

  launcher.addEventListener("click", function () {
    setOpen(!open);
  });

  window.addEventListener("message", function (e) {
    if (ORIGIN && e.origin !== ORIGIN) return;
    if (e.data && e.data.type === "selvema-widget-close") setOpen(false);
  });

  function mount() {
    document.body.appendChild(frameWrap);
    document.body.appendChild(launcher);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
