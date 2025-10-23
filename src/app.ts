import express from "express";
import clientsRouter from "./routes/clientRoutes";
import projectsRouter from "./routes/projectRoutes";
import themesRouter from "./routes/themeRoutes";
import contentsRouter from "./routes/contentRoutes";
import computationRouter from "./routes/computationRoutes";
import { ComputationController } from "./controllers/Computation";

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
app.use("/api", computationRouter);

export default app;
