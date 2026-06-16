import axios from "axios";

// ── Azure TTS ─────────────────────────────────────────────────────────────────

const AZURE_KEYS = [
  process.env.AZURE_TTS_KEY,
  process.env.AZURE_TTS_KEY_2,
].filter((k): k is string => Boolean(k));

export async function generateAzureAudio(
  text: string,
  voiceName: string,
  rate: number = 1
): Promise<Buffer> {
  const region = process.env.AZURE_TTS_REGION || "southafricanorth";

  if (AZURE_KEYS.length === 0) {
    throw new Error("No Azure TTS key configured (AZURE_TTS_KEY)");
  }

  // Derive BCP-47 lang from voice name e.g. "fr-FR-DeniseNeural" → "fr-FR"
  const langCode = voiceName.match(/^([a-z]{2}-[A-Z]{2})/)?.[1] ?? "en-US";
  const escaped = text.replace(/[<>&'"]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c] || c));
  const ssml = `<speak version='1.0' xml:lang='${langCode}'>
    <voice name='${voiceName}'>
      <prosody rate='${rate}'>
        ${escaped}
      </prosody>
    </voice>
  </speak>`;

  let lastError: any;
  for (const key of AZURE_KEYS) {
    try {
      const response = await axios.post(
        `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`,
        ssml,
        {
          headers: {
            "Ocp-Apim-Subscription-Key": key,
            "Content-Type": "application/ssml+xml",
            "X-Microsoft-OutputFormat": "audio-16khz-32kbitrate-mono-mp3",
          },
          responseType: "arraybuffer",
          timeout: 15000,
        }
      );
      return Buffer.from(response.data);
    } catch (err: any) {
      lastError = err;
      console.warn(`Azure TTS key failed: ${err?.response?.status ?? err.message}`);
    }
  }
  throw lastError;
}

// ── ElevenLabs TTS ───────────────────────────────────────────────────────────

export const ELEVENLABS_VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel",  gender: "Female", style: "Narration" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella",   gender: "Female", style: "Calm" },
  { id: "AZnzlk1XvdvUeBnXmlld", name: "Domi",    gender: "Female", style: "Strong" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli",    gender: "Female", style: "Young" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam",    gender: "Male",   style: "Narration" },
  { id: "ErXwobaYiN019PkySvjV", name: "Antoni",  gender: "Male",   style: "Professional" },
  { id: "VR6AewLTigWG4xSOukaG", name: "Arnold",  gender: "Male",   style: "Crisp" },
  { id: "TxGEqnHWrfWFTfGW9XjX", name: "Josh",    gender: "Male",   style: "Deep" },
  { id: "yoZ06aMxZJJ28mfd3POQ", name: "Sam",     gender: "Male",   style: "Raspy" },
];

export async function generateElevenLabsAudio(
  text: string,
  voiceId: string = "21m00Tcm4TlvDq8ikWAM"
): Promise<Buffer> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error("ELEVENLABS_API_KEY not configured");

  const response = await axios.post(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      text: text.substring(0, 2500),
      model_id: "eleven_turbo_v2_5",
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    },
    {
      headers: {
        "xi-api-key": key,
        "Content-Type": "application/json",
        "Accept": "audio/mpeg",
      },
      responseType: "arraybuffer",
      timeout: 20000,
    }
  );
  return Buffer.from(response.data);
}

// ── VoiceRSS TTS ─────────────────────────────────────────────────────────────

export async function generateVoiceRSSAudio(
  text: string,
  lang: string = "en-us",
  voice?: string
): Promise<Buffer> {
  const key = process.env.VOICERSS_API_KEY;
  if (!key) throw new Error("VOICERSS_API_KEY not configured");

  const params = new URLSearchParams({
    key,
    src: text.substring(0, 1000),
    hl: lang,
    c: "MP3",
    f: "44khz_16bit_stereo",
    r: "0",
  });
  if (voice) params.set("v", voice);

  const response = await axios.get(`https://api.voicerss.org/?${params}`, {
    responseType: "arraybuffer",
    timeout: 15000,
  });

  // VoiceRSS returns a text error message if the key is invalid
  const buf = Buffer.from(response.data);
  if (buf.slice(0, 5).toString() === "ERROR") {
    throw new Error(`VoiceRSS error: ${buf.toString().substring(0, 100)}`);
  }
  return buf;
}

// ── StreamElements TTS (no key required) ─────────────────────────────────────

export const STREAMELEMENTS_VOICES = [
  "Brian", "Amy", "Emma", "Joey", "Salli", "Matthew", "Joanna", "Kendra",
  "Kimberly", "Ivy", "Justin", "Russell", "Nicole", "Geraint",
];

export async function generateStreamElementsAudio(
  text: string,
  voice: string = "Brian"
): Promise<Buffer> {
  const params = new URLSearchParams({ voice, text: text.substring(0, 1000) });
  const response = await axios.get(
    `https://api.streamelements.com/kappa/v2/speech?${params}`,
    { responseType: "arraybuffer", timeout: 15000 }
  );
  return Buffer.from(response.data);
}
