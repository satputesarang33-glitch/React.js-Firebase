import {
  getTodosByUserId,
  getTodoById,
  createTodoModel,
  updateTodoModel,
  deleteTodoModel,
} from "../Models/todomodels.js";

export async function getTodos(req, res, next) {
  try {
    const todos = await getTodosByUserId(req.user.uid);
    res.status(200).json({
      success: true,
      todos,
      message: "Todos fetched successfully",
    });
  } catch (error) {
    next(error);
  }
}

export async function getTodo(req, res, next) {
  try {
    const { id } = req.params;
    const todo = await getTodoById(id);
    if (!todo || todo.userId !== req.user.uid) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Todo fetched successfully",
      todo,
    });
  } catch (error) {
    next(error);
  }
}

export async function createTodo(req, res, next) {
  try {
    const title = req.body.title?.trim() || "";
    if (!title) {
      return res.status(400).json({
        success: false,
        message: "Title is required",
      });
    }
    if (title.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Title must be less than 100 characters",
      });
    }
    const todo = await createTodoModel(title, req.user.uid);
    res.status(201).json({
      success: true,
      message: "Todo created successfully",
      todo,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateTodo(req, res, next) {
  try {
    const { id } = req.params;
    const update = {};

    if (req.body.title !== undefined) {
      const title = String(req.body.title).trim();
      if (!title) {
        return res.status(400).json({
          success: false,
          message: "Title is required",
        });
      }
      if (title.length > 100) {
        return res.status(400).json({
          success: false,
          message: "Title must be less than 100 characters",
        });
      }
      update.title = title;
    }

    if (req.body.completed !== undefined) {
      if (typeof req.body.completed !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "Completed must be a boolean",
        });
      }
      update.completed = req.body.completed;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update",
      });
    }

    const todo = await updateTodoModel(id, update, req.user.uid);
    if (!todo) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Todo updated successfully",
      todo,
    });
  } catch (error) {
    next(error);
  }
}

export async function deleteTodo(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await deleteTodoModel(id, req.user.uid);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Todo not found",
      });
    }
    res.status(200).json({
      success: true,
      message: "Todo deleted successfully",
      deleted,
    });
  } catch (error) {
    next(error);
  }
}
