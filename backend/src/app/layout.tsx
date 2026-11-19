export const metadata = { title: "Elanster CMS API", robots: { index: false, follow: false } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f3f3f3" }}>{children}</body></html>);
}
