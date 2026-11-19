"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "cms.site";
/** The website the person is working on ("" = all websites). Remembered in the browser and shared by every screen. */
export function useSite() {
  const [site, setSite] = useState("");
  useEffect(() => {
    const read = () => { try { setSite(localStorage.getItem(KEY) || ""); } catch { /* private mode */ } };
    read(); window.addEventListener("cms-site", read); window.addEventListener("storage", read);
    return () => { window.removeEventListener("cms-site", read); window.removeEventListener("storage", read); };
  }, []);
  const choose = useCallback((id: string) => { try { localStorage.setItem(KEY, id); } catch { /* ignore */ } window.dispatchEvent(new Event("cms-site")); }, []);
  return [site, choose] as const;
}
