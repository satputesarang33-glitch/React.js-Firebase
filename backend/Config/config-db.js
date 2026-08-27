import dns from "dns";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Node's system DNS often fails Atlas SRV lookups on Windows (querySrv ECONNREFUSED)
dns.setServers(["8.8.8.8", "1.1.1.1"]);

export async function connectDB() {
    const uri = process.env.MONGODB_URI || process.env.MONGODB_URL;

    if (!uri) {
        console.error("Missing MONGODB_URL in .env");
        process.exit(1);
    }

    if (uri.includes("<") || uri.includes(">") || uri.includes("REPLACE_USERNAME")) {
        console.error(
            "Update MONGODB_URL in .env: use the real Atlas username with no < > brackets"
        );
        process.exit(1);
    }

    try {
        await mongoose.connect(uri);
        console.log("Connected to MongoDB");
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        process.exit(1);
    }
}
