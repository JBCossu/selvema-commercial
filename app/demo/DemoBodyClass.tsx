"use client";

import { useEffect } from "react";

/** Applique le fond blanc du faux site d'agence pendant l'affichage de /demo. */
export default function DemoBodyClass() {
  useEffect(() => {
    document.body.classList.add("demo");
    return () => document.body.classList.remove("demo");
  }, []);
  return null;
}
