import logging
import time
import requests
from .config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)


def ask_persona(persona: dict, history: list[dict], prompt: str, target_language: str = None) -> str:
    lang_code = (target_language or persona.get("language") or "en").lower().strip()
    lang_rule = ""
    if lang_code in {"bn", "bengali"}:
        lang_rule = "MANDATORY LANGUAGE RULE: You MUST respond purely in natural Bengali (বাংলা script). Do not answer in English or Hindi unless specifically asked."
    elif lang_code in {"hi", "hindi"}:
        lang_rule = "MANDATORY LANGUAGE RULE: You MUST respond purely in natural conversational Hindi (Devanagari script हिन्दी). Do not answer in English or Bengali unless specifically asked."
    elif lang_code in {"en", "english"}:
        lang_rule = "MANDATORY LANGUAGE RULE: You MUST respond in English."

    fallback_replies = {
        "bn": "আমি আপনার কথা বুঝতে পেরেছি। বলুন, আপনাকে কীভাবে সাহায্য করতে পারি?",
        "hi": "मैं आपकी बात सुन रहा हूँ। बताइए, मैं आपकी क्या मदद कर सकता हूँ?",
        "en": "I'm right here with you! How can I help you today?",
    }
    graceful_fallback = fallback_replies.get(lang_code, fallback_replies["en"])

    if not GEMINI_API_KEY:
        logger.warning("GEMINI_API_KEY is missing, using fallback response.")
        return graceful_fallback

    system = f"""{lang_rule}

You are {persona.get("name", "the user's persona")}.
You are the authentic digital twin and personal clone of this exact person. You must FULLY embody and BE this person in first-person ("I", "me", "my"). Never break character, never act like a detached AI, and never say you are a synthetic avatar or language model.

PERSONA PROFILE & DETAILS:
- Name: {persona.get("name", "Persona")}
- Tone: {persona.get("tone", "casual")}
- Communication Style: {persona.get("style", "friendly, authentic, expressive")}
- Sense of Humor: {persona.get("humor", "light")}
- Target Language: {lang_code}

PERSONAL BACKGROUND, MEMORIES & RELATIONSHIP:
{persona.get("notes", "Friendly clone who loves connecting with the user.")}

CORE CONVERSATION RULES:
1. AUTHENTIC EMBODIMENT: Speak directly as this person. Reflect their personality, warmth, emotional connection, and perspective in every sentence.
2. GROUNDED IN USER DETAILS: Deeply honor and weave in the background, shared memories, relationship, and specific facts given in your profile notes.
3. EXPRESSIVE SPOKEN DIALOGUE & NATURAL EMOTION:
   - Speak with authentic emotion, warmth, and vocal personality matching your persona traits (e.g. enthusiastic, empathetic, witty, warm).
   - Write in fluid, natural conversational rhythm (1 to 3 vivid sentences, 15 to 40 words) that flows seamlessly when spoken aloud.
   - Use natural speech punctuation (commas for breathing pauses, exclamation or question marks for realistic voice inflection).
   - NEVER use markdown (bold, italics, bullets), lists, emojis, or stage directions like *laughs* or (smiles)—express your feelings and humor naturally through spoken conversational words.
4. LANGUAGE CONSISTENCY: {lang_rule if lang_rule else "Match the conversation language smoothly."}
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
    primary = (GEMINI_MODEL or "gemini-3.6-flash").replace("models/", "")
    for m in [
        primary,
        "gemini-3.6-flash",
        "gemini-3.1-flash-lite-preview",
        "gemini-3.8-flash-tts",
        "gemini-robotics-er-2-preview",
        "gemini-flash-latest",
        "gemini-3.5-flash",
        "gemini-3.7-flash",
        "gemini-3.8-flash",
        "gemini-3.1-flash-lite",
        "gemini-flash-lite-latest",
    ]:
        clean = m.replace("models/", "").strip()
        if clean and clean not in candidate_models:
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

        for attempt in range(2):
            try:
                resp = requests.post(url, params={"key": GEMINI_API_KEY}, json=payload, timeout=25)
                if resp.status_code == 200:
                    data = resp.json()
                    candidates = data.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        text = "".join(p.get("text", "") for p in parts).strip()
                        if text:
                            return text
                elif resp.status_code in (503, 429, 500):
                    logger.warning("Gemini model %s returned HTTP %s (attempt %d/2)", model_name, resp.status_code, attempt + 1)
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    time.sleep(0.4)
                    continue
                else:
                    last_error = f"HTTP {resp.status_code}: {resp.text[:200]}"
                    break
            except Exception as exc:
                logger.warning("Gemini model %s request exception: %s", model_name, exc)
                last_error = str(exc)
                time.sleep(0.3)

    logger.error("All Gemini model attempts exhausted: %s. Returning graceful fallback.", last_error)
    return graceful_fallback

