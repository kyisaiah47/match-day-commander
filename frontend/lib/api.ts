const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

export async function sendMessage(message: string, sessionId: string): Promise<string> {
  const res = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, session_id: sessionId }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.reply as string;
}

export async function resetSession(sessionId: string): Promise<void> {
  await fetch(`${BASE}/api/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}
