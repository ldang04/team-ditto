/**
 * app.ts
 *
 * This file defines ...
 *
 */
import express from "express";
import clientsRouter from "./routes/clientRoutes";
import usersRouter from "./routes/userRoutes";
import projectsRouter from "./routes/projectRoutes";
import themesRouter from "./routes/themeRoutes";
import contentsRouter from "./routes/contentRoutes";
import computationRouter from "./routes/computationRoutes";
import { VertexAI } from "@google-cloud/vertexai";

const app = express();
app.use(express.json());

// Test route (public)
app.get("/api/vertex-test", async (req, res) => {
  try {
    console.log("GCP_PROJECT_ID from env:", process.env.GCP_PROJECT_ID);
    
    if (!process.env.GCP_PROJECT_ID) {
      return res.status(500).json({
        error: "GCP_PROJECT_ID not set",
        env_keys: Object.keys(process.env).filter(k => k.includes('GCP') || k.includes('GOOGLE'))
      });
    }
    
    const vertex = new VertexAI({ 
      project: process.env.GCP_PROJECT_ID,
      location: "us-central1"
    });
    
    const model = vertex.getGenerativeModel({
      model: process.env.VERTEX_MODEL_TEXT || "gemini-2.5-flash-lite",
    });

    const result = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: "Say hi from Vertex AI!" }] }],
    });

    const response = result.response.candidates?.[0]?.content?.parts?.[0]?.text || "No response generated";
    
    res.json({ 
      message: "Vertex AI test successful", 
      response: response 
    });
  } catch (error: any) {
    console.error("Vertex error:", error);
    res.status(500).json({ 
      error: "Vertex test failed", 
      details: error.message || "Unknown error"
    });
  }
});

// Public routes
app.use("/api", clientsRouter);

// Protected routes
app.use("/api", usersRouter);
app.use("/api", projectsRouter);
app.use("/api", themesRouter);
app.use("/api", contentsRouter);
app.use("/api", computationRouter);

export default app;
