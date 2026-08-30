"use client";

import { useEffect } from "react";

// Rend le <body> transparent pour que l'iframe se fonde dans le site du client.
export default function EmbedBodyClass() {
  useEffect(() => {
    document.body.classList.add("embed");
    return () => document.body.classList.remove("embed");
  }, []);
  return null;
}
