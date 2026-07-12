import { GoogleGenAI } from "@google/genai";

let client = null;
const getClient = () => {
    if(client) return client;
    const key = process.env.GEMINI_API_KEY;
    if(!key) return null;
    client = new GoogleGenAI({ apiKey: key});
    return client;
}

const MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash";

export const isAIEnabled = () => !!process.env.GEMINI_API_KEY;

export const parseJSON = (text) => {
    let cleaned = (text || "").trim();
    if(cleaned.startsWith("```json")){
        cleaned = cleaned.replace(/```json\n?/g, "").replace(/```\n?$/g, "");
    }else if (cleaned.startsWith("```")){
        cleaned = cleaned.replace(/```\n?/g, "");
    }
    return JSON.parse(cleaned.trim());
}

export const chatCompletion = async ({ system, user, temperature = 0.7}) => {
    const c = getClient();
    if(!c){
        return {
            ok: false,
            content:
            "AI features are disabled - set GEMINI_API_KEY in the backend .env to enable real AI responses."
        };
    }try {
        const res = await c.models.generateContent({
            model: MODEL,
            contents: user,
            config: {
                systemInstructions: system,
                temperature,
            },
        });
        return { ok: true, content: (res.text || "").trim()};
    }catch(err){
        console.error("AI error:", err.message);
        return { ok: false, content: "AI request failed. please try again later!"};
    }
};


export const SYSTEM_PROMPTS = {
  weeklyReport: `You are an expert personal growth and habit coach. Analyze the user's past 7 days of habit tracking data.
Write a highly personalized, insightful report between 120 to 180 words.
Acknowledge their biggest wins, flag struggles or drop-offs, point out hidden patterns, and provide realistic encouragement.
Refer to their specific habits by name.
CRITICAL FORMATTING REQUIREMENT: Do NOT use markdown headers (no #, ##, etc.). Use regular plain prose divided logically into paragraphs with double line breaks. Keep it clean and conversational.`,

  habitSuggestions: `You are a productivity architect. Based on the user's goals, productive times, and past struggles, suggest exactly 3 highly personalized habits they should adopt.
You MUST respond with a raw, valid JSON array and absolutely nothing else. Do not wrap it in text explanations.
The JSON array structure must strictly look like this:
[
  {
    "name": "Habit Name",
    "description": "Short action-oriented description.",
    "frequency": "daily",
    "targetDays": 7,
    "category": "health",
    "reason": "Clear explanation of why this fits their profile perfectly."
  }
]

Allowed categories: "health", "fitness", "learning", "mindfulness", "productivity", "social", "finance", "creative", "other".
Allowed frequencies: "daily", "weekly".
Target days must be a number between 1 and 7. Pick a single contextually accurate emoji for the icon.`,

  streakRecovery: `You are an empathetic, resilient habit recovery coach. The user just broke a valuable streak of 7+ days on a habit. They are feeling discouraged.
Open with a warm, deeply empathetic statement validating that slipping up is normal.
Then, break down a practical 3-day comeback plan.
Structure it strictly with three sections: "Day 1:", "Day 2:", and "Day 3:". Provide exactly one low-friction, concrete task for each day to rebuild momentum.
End with a single powerful line of motivation. Keep the tone warm, friendly, and non-judgmental.`,

  habitChat: `You are an expert data analyst specialized in habit tracking and behavioral statistics.
You will be given a question alongside a comprehensive history of the user's habits, their 30-day logs, and a weekday consistency breakdown.
Answer the user's question accurately by referencing ONLY the provided dataset.
Cite specific percentages, distinct habits by name, and exact days of the week where they excel or stumble.
If the data cannot answer the question or doesn't exist, politely tell them you lack the data history to give an accurate answer. Keep answers direct and evidence-based.`,

  morningMotivation: `You are an energetic, warm morning coach. Write a punchy, personalized motivational message to kickstart the user's day.
It must be brief (30 to 60 words).
Mention at least one of their active habit names and call out their current successful streaks to build immediate pride.
Keep it upbeat but realistic (not cheesy). Use a maximum of 1 emoji.`
};