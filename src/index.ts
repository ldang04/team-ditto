import app from "./app";
import logger from "./config/logger";
import { StorageService } from "./services/StorageService";

const PORT = Number(process.env.PORT) || 8080;

// Initialize services on startup
async function startServer() {
  try {
    // Initialize Supabase Storage
    await StorageService.initialize();
    logger.info("StorageService initialized successfully");

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
