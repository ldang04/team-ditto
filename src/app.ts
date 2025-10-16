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

const app = express();
app.use(express.json());

// Public routes
app.use("/api", clientsRouter);

// Protected routes
app.use("/api", usersRouter);
app.use("/api", projectsRouter);
app.use("/api", themesRouter);
app.use("/api", contentsRouter);
app.use("/api", computationRouter);

export default app;
