export default function Home() {
  return (<main style={{ maxWidth: 560, margin: "80px auto", padding: 24, background: "#fff", borderRadius: 20 }}>
    <h1 style={{ marginTop: 0 }}>Elanster CMS — backend API</h1>
    <p>This is the server part of the CMS. The admin screens are in the frontend app.</p>
    <p>Health check: <a href="/api/v1/health">/api/v1/health</a></p>
  </main>);
}
