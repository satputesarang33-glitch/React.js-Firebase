import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { connectDB } from "./Config/config-db.js";
import userRoutes from "./Routes/UserRoutes.js";
import { errorHandler, notFound } from "./Middleware/errorMiddleware.js";
import { verifySmtpConnection } from "./Utils/sendEmail.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, ".env"), override: true });

export const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || "http://localhost:3000" }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

app.use("/api/users", userRoutes);

app.use(notFound);
app.use(errorHandler);

await connectDB();
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server is running on port ${PORT}`);
  try {
    const smtp = await verifySmtpConnection();
    console.log(`[Email] ${smtp.message}`);
  } catch (err) {
    console.log(`[Email] SMTP check failed: ${err.message}`);
  }
});
export default app;
