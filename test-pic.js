import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Node requires this extra step to get __dirname when using ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function fireRealPhoto() {
    try {
        const imagePath = path.join(__dirname, 'test.jpg');
        
        // 1. Read the real image file and convert it to a Base64 string
        const imageBuffer = fs.readFileSync(imagePath);
        const base64Image = imageBuffer.toString('base64');

        console.log("📸 Real photo encoded successfully. Sending to local AI webhook...");

        // 2. Fire it directly to your running local Firebase function
        const response = await fetch('http://127.0.0.1:5001/aquagen-farm/us-central1/whatsappWebhook', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text: "Just completed afternoon round.",
                imageBase64: base64Image
            })
        });

        const result = await response.json();
        console.log("\n🚀 Response from your AI Webhook:\n", JSON.stringify(result, null, 2));

    } catch (error) {
        console.error("Test script failed:", error);
    }
}

fireRealPhoto();