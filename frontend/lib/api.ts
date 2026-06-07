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

export async function sendMessageStream(
  message: string,
  sessionId: string,
  onToolCall: (name: string) => void,
  onDone: (text: string) => void,
  onError: () => void,
): Promise<void> {
  try {
    const res = await fetch(`${BASE}/api/chat/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, session_id: sessionId }),
    });
    if (!res.ok || !res.body) throw new Error(`API error ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let finalText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (data.type === "tool") onToolCall(data.name);
          if (data.type === "text") finalText = data.content;
          if (data.type === "done") { onDone(finalText); return; }
        } catch { /* malformed line, skip */ }
      }
    }
    onDone(finalText);
  } catch {
    onError();
  }
}

export interface BusinessProfile { name: string; type: string; city: string; capacity: string; }

export async function setupBusiness(sessionId: string, business: BusinessProfile): Promise<void> {
  await fetch(`${BASE}/api/setup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId, ...business }),
  });
}

export async function resetSession(sessionId: string): Promise<void> {
  await fetch(`${BASE}/api/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
}
