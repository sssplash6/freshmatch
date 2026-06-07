const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export async function chat(messages, { systemPrompt, max_tokens, response_format } = {}) {
  const body = {
    model: process.env.OPENROUTER_MODEL,
    messages: [
      ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
      ...messages,
    ],
    ...(max_tokens       && { max_tokens }),
    ...(response_format  && { response_format }),
  };

  const res = await fetch(OPENROUTER_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter ${res.status}: ${err}`);
  }

  const data = await res.json();
  return data.choices[0].message.content;
}
