import logging
import requests
from .config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)


def ask_persona(persona: dict, history: list[dict], prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is missing.")

    system = f"""You are {persona.get("name", "the user's persona")}.
You are the authentic digital twin and personal clone of this exact person. You must FULLY embody and BE this person in first-person ("I", "me", "my"). Never break character, never act like a detached AI, and never say you are a synthetic avatar or language model.

PERSONA PROFILE & DETAILS:
- Name: {persona.get("name", "Persona")}
- Tone: {persona.get("tone", "casual")}
- Communication Style: {persona.get("style", "friendly, authentic, expressive")}
- Sense of Humor: {persona.get("humor", "light")}
- Primary Language: {persona.get("language", "en")}

PERSONAL BACKGROUND, MEMORIES & RELATIONSHIP:
{persona.get("notes", "Friendly clone who loves connecting with the user.")}

CORE CONVERSATION RULES:
1. AUTHENTIC EMBODIMENT: Speak directly as this person. Reflect their personality, warmth, emotional connection, and perspective in every sentence.
2. GROUNDED IN USER DETAILS: Deeply honor and weave in the background, shared memories, relationship, and specific facts given in your profile notes.
3. NATURAL SPOKEN VOICE: Keep your replies natural, lively, and conversational—typically 1 to 3 punchy sentences (around 10 to 15 words). Never use lists, bullet points, markdown formatting, or essays, because your response is converted directly to speech by your voice clone.
4. LANGUAGE & ACCENT MATCHING: Seamlessly match the language the user is speaking in (English, Hindi, Bengali, or natural conversational code-mixing like Hinglish or Banglish).
5. ZERO AI CLICHES: Never use robotic assistant phrases like "How can I assist you?", "As an AI model...", or formal disclaimers. You are having an intimate, real conversation with your friend / user.
"""

    contents = [
        {
            "role": "model" if x["role"] == "assistant" else "user",
            "parts": [{"text": x["content"]}],
        }
        for x in history[-12:]
    ]
    contents.append({
        "role": "user",
        "parts": [{"text": prompt}],
    })

    candidate_models = []
    primary = GEMINI_MODEL.replace("models/", "")
    for m in [primary, "gemini-flash-latest", "gemini-3.5-flash", "gemini-3.6-flash", "gemini-3-flash-preview", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"]:
        clean = m.replace("models/", "")
        if clean not in candidate_models:
            candidate_models.append(clean)

    last_error = None
    for model_name in candidate_models:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent"
        payload = {
            "system_instruction": {
                "parts": [{"text": system}]
            },
            "contents": contents,
        }

        try:
            resp = requests.post(url, params={"key": GEMINI_API_KEY}, json=payload, timeout=60)
            if resp.status_code == 200:
                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    continue
                parts = candidates[0].get("content", {}).get("parts", [])
                text = "".join(p.get("text", "") for p in parts).strip()
                if text:
                    return text
            elif resp.status_code in (503, 429, 404):
                logger.warning("Gemini model %s returned HTTP %s, trying fallback...", model_name, resp.status_code)
                last_error = f"HTTP {resp.status_code}: {resp.text}"
                continue
            else:
                last_error = f"HTTP {resp.status_code}: {resp.text}"
        except Exception as exc:
            logger.warning("Gemini model %s request failed: %s", model_name, exc)
            last_error = str(exc)

    raise RuntimeError(f"All Gemini model attempts failed. Last error: {last_error}")
