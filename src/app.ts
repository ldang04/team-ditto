import express from "express";
import clientsRouter from "./routes/clientRoutes";
import projectsRouter from "./routes/projectRoutes";
import themesRouter from "./routes/themeRoutes";
import contentsRouter from "./routes/contentRoutes";
import textRouter from "./routes/textRoutes";
import imageRouter from "./routes/imageRoutes";
import validationRouter from "./routes/validationRoutes";
import { HealthController } from "./controllers/HealthController";

const app = express();
app.use(express.json());

// Health check route (public)
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

export default app;
