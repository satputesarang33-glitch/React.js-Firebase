import express from "express";
import { register, login, me } from "../Controller/AuthController.js";
import { requireAuth } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.get("/me", requireAuth, me);

export default router;
