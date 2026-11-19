"use client";
import { use } from "react";
import { useRouter } from "next/navigation";
import { BlogEditor } from "@/components/BlogEditor";

export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const router = useRouter();
  return <BlogEditor id={id} onCreated={(nid) => router.replace(`/blogs/${nid}`)} onBack={() => router.push("/content")} />;
}

