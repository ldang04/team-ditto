import express from "express";
import clientsRouter from "./routes/clientRoutes";
import projectsRouter from "./routes/projectRoutes";
import themesRouter from "./routes/themeRoutes";
import contentsRouter from "./routes/contentRoutes";
import textRouter from "./routes/textRoutes";
import imageRouter from "./routes/imageRoutes";
import validationRouter from "./routes/validationRoutes";
import rankingRouter from "./routes/rankingRoutes";
import { HealthController } from "./controllers/HealthController";

const app = express();
// Increase JSON body limit for base64 image uploads (default is 100kb)
app.use(express.json({ limit: '50mb' }));

// Health check routes (public)
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/vertex-test", HealthController.testVertex);

// Public routes
app.use("/api", clientsRouter);

// Protected routes
app.use("/api", projectsRouter);
app.use("/api", themesRouter);
app.use("/api", contentsRouter);

// Generation and validation routes (RESTful structure)
app.use("/api/text", textRouter);
app.use("/api/images", imageRouter);
app.use("/api/validate", validationRouter);
app.use("/api/rank", rankingRouter);

export default app;
