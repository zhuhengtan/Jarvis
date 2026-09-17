const secret = /(?:sk|pk|api)[_-][A-Za-z0-9_-]{12,}|(?:token|password|secret)\s*[:=]\s*[^\s,;]+/i;
const lasting = /(?:remember|always|never|prefer|preference|from now on|决定|约定|规范|以后|始终|不要|记住|偏好)/i;
export function extractText(messages) { return messages.map(message => { const value = message; return (value.content ?? []).filter(block => block.type === "text").map(block => block.text ?? "").join("\n"); }).join("\n").trim(); }
export function candidateFromUserText(text, dshSessionId) { const content = text.trim(); if (content.length < 8 || content.length > 2_000 || secret.test(content) || !lasting.test(content))
    return undefined; const kind = /prefer|preference|偏好|以后|始终|不要/i.test(content) ? "preference" : /决定|约定|规范|decision/i.test(content) ? "decision" : "workflow"; return { scope: "project", kind, title: "DSH user-confirmed convention", content, sourceRefs: [`dsh:${dshSessionId}`] }; }
//# sourceMappingURL=policy.js.map