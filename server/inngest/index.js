import express from "express";
import cors from "cors";
import "dotenv/config";
import { Webhook } from "svix";
import { serve } from "inngest/express";
import { inngest, functions } from "./inngest/index.js"; // Проверете дали пътят до inngest файла е правилен

const app = express();
const PORT = process.env.PORT || 5000;

// 1. CORS настройка
app.use(cors());

// 2. Отделен Webhook Handler за Clerk (Трябва да е ПРЕДИ express.json())
// Важно: Svix изисква raw body (текстов или buffer формат) за верификация на подписите!
app.post(
  "/api/webhooks/clerk",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    try {
      const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

      if (!webhookSecret) {
        console.error(
          "CLERK_WEBHOOK_SECRET is missing in environment variables.",
        );
        return res.status(500).json({ error: "Missing webhook secret" });
      }

      const wh = new Webhook(webhookSecret);
      const headers = req.headers;
      const payload = req.body;

      // Верификация на Svix подписите от Clerk
      const evt = wh.verify(payload, {
        "svix-id": headers["svix-id"],
        "svix-timestamp": headers["svix-timestamp"],
        "svix-signature": headers["svix-signature"],
      });

      const { type, data } = evt;

      // Изпращаме събитието към Inngest с името от Clerk (user.created, user.deleted и т.н.)
      await inngest.send({
        name: type,
        data: data,
      });

      return res
        .status(200)
        .json({ success: true, message: "Webhook processed successfully" });
    } catch (err) {
      console.error("Webhook verification failed:", err.message);
      return res.status(400).json({ error: "Webhook verification failed" });
    }
  },
);

// 3. Стандартен Middleware за JSON за всички останали Express маршрути
app.use(express.json());

// 4. Inngest Serve Endpoint
app.use("/api/inngest", serve({ client: inngest, functions }));

// 5. Тестов маршрут
app.get("/", (req, res) => {
  res.send("PopcornPortal Server is running!");
});

// Стартиране на сървъра
app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});

export default app;
