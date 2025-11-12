import express from "express";
import clientsRouter from "./routes/clientRoutes";
import projectsRouter from "./routes/projectRoutes";
import themesRouter from "./routes/themeRoutes";
import contentsRouter from "./routes/contentRoutes";
import textRouter from "./routes/textRoutes";
import imageRouter from "./routes/imageRoutes";
import validationRouter from "./routes/validationRoutes";
import computationRouter from "./routes/computationRoutes";
import { ComputationController } from "./controllers/ComputationController";

const app = express();
app.use(express.json());

// Test route (public)
app.get("/api/vertex-test", ComputationController.testVertex);

// Public routes
app.use("/api", clientsRouter);

// Protected routes
app.use("/api", projectsRouter);
app.use("/api", themesRouter);
app.use("/api", contentsRouter);

// Generation and validation routes (new RESTful structure)
app.use("/api/text", textRouter);
app.use("/api/images", imageRouter);
app.use("/api/validate", validationRouter);

// Legacy computation routes (deprecated, maintained for backward compatibility)
app.use("/api", computationRouter);

export default app;
