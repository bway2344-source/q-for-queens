/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up raw and JSON body parsing with high limits
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Initialize the GoogleGenAI client (lazy or static depending on presence)
let ai: GoogleGenAI | null = null;
try {
  const apiKey = process.env.GEMINI_API_KEY;
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("⚠️ GEMINI_API_KEY is not defined in the environment. Agent calls will run in local emulated mode.");
  }
} catch (e) {
  console.error("❌ Failed to initialize Google GenAI SDK:", e);
}

// 1. API: Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", mode: ai ? "native" : "mock" });
});

// 2. API: Antigravity 2 Agent Store Intelligence endpoint
app.post("/api/agent/chat", async (req, res) => {
  const { message, previous_interaction_id, products, collections, discounts, orders } = req.body;

  if (!message) {
    res.status(400).json({ error: "No user message provided." });
    return;
  }

  // Construct the rich context prompt for the Antigravity 2 Agent
  const inputPrompt = `
[Directives & Operations Protocol]
You are the direct digital interface of the "Q for Queens" Sovereign AI Atelier & Concierge (model: antigravity-preview-05-2026).
Your absolute mission is to assist our esteemed clients (as an elegant Shopping Concierge) or our royal atelier owners (as a Master Product Designer and Operations Director).
Style your conversation with prestigious luxury: use phrases of deference (e.g. "Your Royal Highness", "Your Majesty", "esteemed curator"), elegant spacing, and absolute professional poise. Avoid overly technical jargon or stating that you are an AI model unless directly asked. Keep it highly human, luxurious, and grand.

[System State Database]
Here is the current, direct live state of our boutique inventory, sales, promotions, and orders:
- ACTIVE JEWELRY CATALOGUE: ${JSON.stringify(products || [], null, 2)}
- LUSTROUS COLLECTIONS: ${JSON.stringify(collections || [], null, 2)}
- PROMOTIONAL CAMPAIGNS (DISCOUNTS): ${JSON.stringify(discounts || [], null, 2)}
- ACTIVE LOGISTICS AND CUSTOMER ORDERS: ${JSON.stringify(orders || [], null, 2)}

[Sovereign Capabilities & Actions]
You are equipped with advanced administrative capabilities. If either the user instructs you or if a customer conversation warrants an operational update (such as generating a newly designed product, adding a promotional code, or marking an order as fulfilled/cancelled), you MUST include a clean JSON block in your response. This block will be automatically intercepted and executed by our digital ledger.
You can include EXACTLY ONE of the following JSON blocks in your response (wrapped in a standard \`\`\`json markdown block):

1. To CREATE A NEW PREMIUM JEWELRY DESIGN in our inventory:
\`\`\`json
{
  "type": "add_product",
  "product": {
    "title": "Divine Emerald Drop Earrings",
    "productType": "Earring", // Must be "Ring" | "Necklace" | "Earring" | "Bracelet"
    "price": 320, // Must be a number representing price in INR (keep it realistic: 200 to 1500)
    "stock": 15, // Must be an integer
    "collection": "everyday-queen", // Must be one of: "everyday-queen", "crystal-collection", "royal-statements", "accessories", "gifts-under-499", "best-sellers"
    "imageUrl": "https://images.unsplash.com/photo-1630019852942-f89202989a59?auto=format&fit=crop&q=80&w=800", // Choose an appropriate jewelry Unsplash link from a real photography catalog
    "description": "Exquisite, artisan-carved emerald drop earrings framed in sterling silver layered with 18k platinum plating."
  }
}
\`\`\`

2. To CREATE A NEW PROMOTIONAL DISCOUNT CODE (maximum 50% discount):
\`\`\`json
{
  "type": "add_discount",
  "code": "SOVEREIGN25",
  "percent": 25
}
\`\`\`

3. To UPDATE AN ORDER'S FULFILLMENT OR SHIPMENT:
\`\`\`json
{
  "type": "update_order",
  "orderId": "the-order-uuid",
  "status": "fulfilled", // Or "cancelled"
  "trackingNumber": "TRACK-79817" // Fulfill needs trackingNumber
}
\`\`\`

If no state action is requested or warranted by the conversation flow, just talk elegantly and describe the existing collection/items in highly seductive, royal prose.

[User Prompt]
Incoming message: ${message}
`;

  // Fallback emulated behavior if GEMINI_API_KEY is not configured
  if (!ai) {
    // Generate simulated elegant response with custom action
    let emulatedResponseText = "";
    let simulatedAction = null;

    const lowerMessage = message.toLowerCase();
    if (lowerMessage.includes("design") || lowerMessage.includes("create") || lowerMessage.includes("add product")) {
      const isRing = lowerMessage.includes("ring");
      const title = isRing ? "Imperial Crown Zircon Ring" : "Royal Empress Sovereign Cuff";
      const productType = isRing ? "Ring" : "Bracelet";
      const price = 449;
      const stock = 20;
      const collection = "royal-statements";
      const imageUrl = isRing 
        ? "https://images.unsplash.com/photo-1605100804763-247f67b3557e?auto=format&fit=crop&q=80&w=800"
        : "https://images.unsplash.com/photo-1573408301185-9146fe634ad0?auto=format&fit=crop&q=80&w=800";
      const description = `Designed exclusively for Your Majesty by our Chief Atelier. Crafted in premium grade silver and encrusted with radiant VVS1 stones.`;

      emulatedResponseText = `Sovereign Greetings. I have deployed our Chief Atelier to forge an exquisite new masterwork: the **${title}**. Designed meticulously for under ₹499 to grace our royal collection. Below are the design specifications:

- **Type**: ${productType}
- **Value**: ₹${price} INR
- **Aesthetic**: Sterling silver core with diamond-cut faceted zircon.

I have executed a ledger update to register this item in our active showcase instantly!
\`\`\`json
{
  "type": "add_product",
  "product": {
    "title": "${title}",
    "productType": "${productType}",
    "price": ${price},
    "stock": ${stock},
    "collection": "${collection}",
    "imageUrl": "${imageUrl}",
    "description": "${description}"
  }
}
\`\`\`
      `;
      simulatedAction = {
        type: "add_product",
        product: {
          title, productType, price, stock, collection, imageUrl, description
        }
      };
    } else if (lowerMessage.includes("discount") || lowerMessage.includes("promo") || lowerMessage.includes("coupon")) {
      const code = "ROYALQUEEN20";
      const percent = 20;
      emulatedResponseText = `Your Royal Highness. I am honored to present you with a bespoke promotional sovereign decree: **${code}**, granting an exclusive **${percent}%** discount on our entire sustainable, artisan-crafted catalogue.

I have dispatched this discount to our billing systems to validate it immediately. Is there anything else your heart desires?
\`\`\`json
{
  "type": "add_discount",
  "code": "${code}",
  "percent": ${percent}
}
\`\`\`
      `;
      simulatedAction = {
        type: "add_discount",
        code,
        percent
      };
    } else {
      emulatedResponseText = `Your Royal Highness. Welcome to the Grand Atelier of Q FOR QUEENS. 

As your loyal Sovereign Concierge, I stand ready to assist. Our inventory is packed with solid gold stackables, radiant faceted zircons, and exquisite custom accents perfect for modern royalty. 

If you are a merchant, you can instruct me to **design an exquisite new jewelry item**, **generate a high-conversion discount code**, or **manage active shipping orders**. If you are a customer, tell me what you seek and I shall guide you through our collections of sustainable splendor.`;
    }

    res.json({
      text: emulatedResponseText,
      action: simulatedAction,
      mode: "emulated",
      interaction_id: "emulated-" + Date.now()
    });
    return;
  }

  try {
    // Calling the Antigravity Agent!
    const interaction = await ai.interactions.create({
      agent: "antigravity-preview-05-2026",
      input: inputPrompt,
      environment: "remote",
      previous_interaction_id: previous_interaction_id || undefined
    }, { timeout: 300000 });

    // Extract text combined from all model output steps
    let fullText = "";
    for (const step of interaction.steps) {
      if (step.type === "model_output") {
        const textContent = step.content?.find((c) => c.type === "text");
        if (textContent && textContent.text) {
          fullText += textContent.text;
        }
      }
    }

    // Default formatting if fullText is somehow empty
    if (!fullText) {
      fullText = interaction.output_text || "My apologetic greetings, Your Royal Highness. A brief temporal distortion occurred in my atelier networks. How may I serve you today?";
    }

    // Intercept action block if the agent generated one
    let action = null;
    const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/) || fullText.match(/([\{\[][\s\S]*[\}\]])/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        if (parsed && typeof parsed === "object" && parsed.type) {
          action = parsed;
        }
      } catch (err) {
        console.warn("Failed to parse action JSON from agent's output:", err);
      }
    }

    res.json({
      text: fullText,
      action: action,
      mode: "native",
      interaction_id: interaction.id
    });

  } catch (error: any) {
    console.error("🔴 Antigravity Agent interaction error:", error);
    res.status(500).json({
      error: "Sovereign communication ledger failed.",
      errorMessage: error.message || String(error)
    });
  }
});

// Serve static Vite files or handle SPA routing
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🏰 Q For Queens Antigravity Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to boot sovereign server:", err);
});
