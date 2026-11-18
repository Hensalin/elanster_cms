"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function ToLogin() {
  const router = useRouter();
  useEffect(() => { router.replace("/login"); }, [router]);
  return <p style={{ padding: 40 }}>Redirecting to sign in…</p>;
}
