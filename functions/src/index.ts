import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.firestore();

// ============================================================================
// MODULE 1: TELEGRAM AI TRIAGE WEBHOOK
// ============================================================================
export const telegramWebhook = functions.https.onRequest(async (req, res) => {
    // Webhooks must be POST
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        const message = req.body.message;

        if (!message) {
            res.status(200).send({ success: true, note: 'No message object' });
            return;
        }

        const rawText = message.text || message.caption || "";
        const chatId = message.chat.id;
        const technicianName = message.from?.first_name || "Field Tech";

        console.log(`📥 Incoming from ${technicianName}: "${rawText}" | Photo: ${!!message.photo} | Video: ${!!message.video}`);

        // Loop Killer 1: Catch /start command
        if (rawText.trim() === '/start') {
            res.status(200).send({ success: true });
            return;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        const botToken = process.env.TELEGRAM_BOT_TOKEN;

        // Loop Killer 2: Soft fail on missing config
        if (!apiKey || !botToken) {
            console.error("❌ Configuration Error: Missing environment variables.");
            res.status(200).send({ success: false, error: 'Config Error' });
            return;
        }

        // --- FETCH VISUAL PIXELS (PHOTOS & VIDEOS) ---
        let imageBase64 = "";
        let fileIdToFetch = null;

        if (message.photo && message.photo.length > 0) {
            console.log("📸 Photo detected!");
            fileIdToFetch = message.photo[message.photo.length - 1].file_id;
        } else if (message.video) {
            console.log("🎥 Video detected! Grabbing the first frame thumbnail...");
            const thumbnail = message.video.thumbnail || message.video.thumb;
            if (thumbnail) {
                fileIdToFetch = thumbnail.file_id;
            }
        }

        if (fileIdToFetch) {
            try {
                const fileInfoRes = await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${fileIdToFetch}`);
                const fileInfo = await fileInfoRes.json();

                if (fileInfo.ok) {
                    const filePath = fileInfo.result.file_path;
                    const imageRes = await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
                    const arrayBuffer = await imageRes.arrayBuffer();
                    imageBase64 = Buffer.from(arrayBuffer).toString('base64');
                    console.log("✅ Visual successfully converted to Base64.");
                }
            } catch (err) {
                console.error("⚠️ Failed to fetch visual data:", err);
            }
        }

        // Drop empty ghost pings
        if (!rawText.trim() && !imageBase64) {
            res.status(200).send({ success: true });
            return;
        }

        const combinedText = rawText || "[Visual Uploaded]";

        // --- PASS TO GEMINI AI ---
        const geminiParts: any[] = [
            {
                text: `You are an intelligent aquaculture operation triage engine for aquagen farm specifically and shem adn filmign .
                     Analyze the farmer's text parameters and the accompanying image. Extract metrics into a strict, raw JSON object.
                     Do NOT use markdown code blocks (\`\`\`json). Return ONLY raw JSON.
                     
                     {
                       "event_type": "Categorize as 'Feeding', 'Weight Measurement', 'Water Quality', 'Harvesting', 'General Observation', or 'Unknown'",
                       "ponds": ["Extract all mentioned pond tags like 'A1', 'B2'. Empty array [] if none found."],
                       "metrics": {
                         "feed_amount": "Include weight with units (e.g., '2.5kg') if feeding, otherwise null",
                         "pellet_size": "Include pellet size if mentioned (e.g., '2mm'), otherwise null",
                         "average_weight_g": "Estimated or stated numerical fish weight in grams if sampling, otherwise null",
                         "water_parameters": "Key-value pairs if water tests are present (e.g., {'ph': 7.5}), otherwise null"
                       },
                       "ai_visual_verification": "Summarize what operations task is occurring based on the visual evidence and text.",
                       "confidence_score": 95
                     }

                     Farmer's Combined Message Context: "${combinedText}"`
            }
        ];

        if (imageBase64) {
            geminiParts.push({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
        }

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: geminiParts }],
                generationConfig: { responseMimeType: "application/json" }
            })
        });

        if (!response.ok) {
            console.error("Gemini API Failure:", await response.text());
            res.status(200).send({ success: false, error: 'Gemini Error' });
            return;
        }

        let aiData;
        try {
            const rawData = await response.json();
            const rawGeminiText = rawData.candidates[0].content.parts[0].text;
            const cleanJsonString = rawGeminiText.replace(/```(?:json)?\n?/g, '').replace(/```/g, '').trim();
            aiData = JSON.parse(cleanJsonString);
        } catch (error) {
            console.error("JSON Parsing Error:", error);
            res.status(200).send({ success: true, error: 'Parse Error' });
            return;
        }

        // --- SAVE OR UPDATE FIRESTORE ---
        const logEntry = {
            timestamp: new Date().toISOString(),
            technician_name: technicianName,
            chat_id: chatId,
            animal_type: "Fish",
            event_type: aiData.event_type || "General Observation",
            data: {
                ponds: aiData.ponds || [],
                metrics: aiData.metrics || {},
                ai_confidence: aiData.confidence_score || 0,
                notes: aiData.ai_visual_verification || "",
                original_text: combinedText
            },
            source: "Telegram"
        };

        try {
            const newDoc = await db.collection('logs').add(logEntry);
            console.log(`💾 Created new database log: ${newDoc.id}`);
        } catch (error) {
            console.error("Database Write Error:", error);
        }

        // --- INVENTORY DEDUCTION LOGIC ---
        if (aiData.event_type === "Feeding" && aiData.metrics && aiData.metrics.feed_amount && aiData.metrics.pellet_size) {
            try {
                // Parse amount (e.g., "2.5kg" -> 2.5)
                const amountMatch = String(aiData.metrics.feed_amount).match(/[\d.]+/);
                const amount = amountMatch ? parseFloat(amountMatch[0]) : 0;
                
                // Parse pellet size (e.g., "2 mm" -> "2mm")
                const pelletSize = String(aiData.metrics.pellet_size).toLowerCase().replace(/\s/g, '');
                
                if (amount > 0) {
                    const inventoryRef = db.collection('inventory');
                    const invSnapshot = await inventoryRef.get();
                    let targetItemDoc: admin.firestore.DocumentSnapshot | null = null;
                    
                    invSnapshot.forEach(doc => {
                        const item = doc.data();
                        const itemName = (item.item_name || "").toLowerCase().replace(/\s/g, '');
                        // Match item if it's feed and has the correct pellet size
                        if (itemName.includes('feed') && itemName.includes(pelletSize)) {
                            targetItemDoc = doc;
                        }
                    });

                    if (targetItemDoc) {
                        const currentQty = targetItemDoc.data()?.quantity || 0;
                        const newQty = Math.max(0, currentQty - amount);
                        const newStatus = newQty === 0 ? 'out_of_stock' : newQty < 20 ? 'low' : 'in_stock';
                        
                        await inventoryRef.doc(targetItemDoc.id).update({
                            quantity: newQty,
                            status: newStatus,
                            last_updated: new Date().toISOString()
                        });
                        console.log(`Deducted ${amount} from inventory item ${targetItemDoc.id}`);
                        
                        // Append inventory update note to aiData.ai_visual_verification so it's sent in Telegram response
                        aiData.ai_visual_verification += ` (Deducted ${amount} units of ${targetItemDoc.data()?.item_name} from inventory)`;
                    }
                }
            } catch (invErr) {
                console.error("Inventory deduction error:", invErr);
            }
        }

        // --- RESPOND TO THE USER (Clean HTML Format) ---
        const pondList = aiData.ponds && aiData.ponds.length > 0 ? aiData.ponds.join(', ') : 'None specified';

        const responseText = `✓ <b>Log Created</b>\n<b>Action:</b> ${aiData.event_type}\n<b>Location:</b> ${pondList}\n<blockquote>"${combinedText}"</blockquote>`;

        await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text: responseText,
                parse_mode: "HTML"
            })
        });

        res.status(200).send({ success: true });

    } catch (error: any) {
        console.error("Fatal Telegram Webhook Error:", error);
        res.status(200).send({ success: false, error: 'Internal Execution Failure' });
    }
});


// ============================================================================
// MODULE 2: ESP32 SHORT-POLLING ROUTE (MANUAL DROP TRIGGER)
// ============================================================================
export const feederPing = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'GET') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    const deviceId = req.query.device_id as string;
    if (!deviceId) {
        res.status(400).send({ error: 'Missing device_id parameter' });
        return;
    }

    try {
        const deviceRef = db.collection('devices').doc(deviceId);
        const doc = await deviceRef.get();

        if (!doc.exists) {
            res.status(200).send({ drop: false, note: 'Device not registered' });
            return;
        }

        const data = doc.data();

        // Check if the React app flipped the command switch
        if (data && data.feed_pending === true) {
            const gramsToDrop = data.target_grams || 100;

            // ATOMIC SAFETY KILL-SWITCH: Flip back to false instantly before replying
            await deviceRef.update({
                feed_pending: false,
                last_ping: new Date().toISOString()
            });

            console.log(`⚡ Command dispatched to ${deviceId}: Drop ${gramsToDrop}g`);
            res.status(200).send({ drop: true, grams: gramsToDrop });
            return;
        }

        // Standard idle response
        await deviceRef.update({ last_ping: new Date().toISOString() });
        res.status(200).send({ drop: false });

    } catch (error) {
        console.error(`Error handling ping for ${deviceId}:`, error);
        res.status(500).send({ drop: false, error: 'Internal Server Error' });
    }
});


// ============================================================================
// MODULE 3: ESP32 INGESTION & RECEIPT LOGGING
// ============================================================================
export const iotLog = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    // Simple security gate for the microcontroller
    const clientSecret = req.headers['x-iot-secret'];
    const expectedSecret = process.env.IOT_SECRET_KEY || "aquagen_default_secret_2026";

    if (clientSecret !== expectedSecret) {
        console.warn("⚠️ Unauthorized IoT Log attempt blocked.");
        res.status(401).send({ success: false, error: 'Unauthorized' });
        return;
    }

    try {
        const payload = req.body;

        if (!payload || !payload.device_id) {
            res.status(400).send({ success: false, error: 'Invalid JSON payload' });
            return;
        }

        // Format exactly like our Telegram AI logs so the frontend renders it natively
        const logEntry = {
            timestamp: new Date().toISOString(),
            technician_name: `Automated Feeder (${payload.device_id})`,
            animal_type: "Fish",
            event_type: "Feeding",
            data: {
                ponds: payload.pond_tag ? [payload.pond_tag] : ["Machakos_Main"],
                metrics: {
                    feed_amount: `${payload.grams_dispensed || 0}g`,
                    average_weight_g: null,
                    water_parameters: null
                },
                ai_confidence: 100,
                notes: `Hardware reported successful dispensing. Battery: ${payload.v_batt || 'N/A'}V`,
                original_text: `[IoT Hardware Receipt]: Event=${payload.event_type || 'Manual_Trigger'}, Dispensed=${payload.grams_dispensed}g`
            },
            source: "ESP32_IoT"
        };

        const docRef = await db.collection('logs').add(logEntry);
        console.log(`💾 Hardware log committed. Doc ID: ${docRef.id}`);

        res.status(200).send({ success: true, log_id: docRef.id });

    } catch (error) {
        console.error("Fatal IoT Logging Error:", error);
        res.status(500).send({ success: false, error: 'Database Write Failed' });
    }
});