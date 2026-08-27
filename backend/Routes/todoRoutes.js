import express from "express";
import {
  getTodos,
  getTodo,
  createTodo,
  updateTodo,
  deleteTodo,
} from "../Controller/TodoController.js";
import { requireAuth } from "../Middleware/authMiddleware.js";

const router = express.Router();

router.use(requireAuth);

// GET all todos → /api/todos
router.get("/", getTodos);
// GET a single todo → /api/todos/:id
router.get("/:id", getTodo);
// CREATE a todo → /api/todos
router.post("/", createTodo);
// UPDATE a todo → /api/todos/:id
router.put("/:id", updateTodo);
// DELETE a todo → /api/todos/:id
router.delete("/:id", deleteTodo);

export default router;
