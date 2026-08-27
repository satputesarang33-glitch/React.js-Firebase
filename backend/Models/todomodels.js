import { db } from "../Firebase-01/Configfirebase-1.js";

const COLLECTION = "todos";


export function formatTodo(doc) {
  if (!doc) return null;

  const data = doc.data();

  return {
    id: doc.id,
    title: data.title || "",
    completed: Boolean(data.completed),
    userId: data.userId || null,
    createdAt: data.createdAt?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toISOString?.() || null,
  };
}


// Get all todos of user
export async function getTodosByUserId(userId) {
  const snapshot = await db()
    .collection(COLLECTION)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map(formatTodo)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}


// Get single todo
export async function getTodoById(id) {
  const doc = await db()
    .collection(COLLECTION)
    .doc(id)
    .get();

  return doc.exists ? formatTodo(doc) : null;
}


// Create todo
export async function createTodoModel(title, userId) {
  const todo = {
    title,
    completed: false,
    userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const ref = await db()
    .collection(COLLECTION)
    .add(todo);

  const doc = await ref.get();

  return formatTodo(doc);
}


// Update todo
export async function updateTodoModel(id, update, userId) {
  const ref = db()
    .collection(COLLECTION)
    .doc(id);

  const doc = await ref.get();

  if (!doc.exists) return null;


  if (doc.data().userId !== userId) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }


  await ref.update({
    ...update,
    updatedAt: new Date(),
  });


  const updated = await ref.get();

  return formatTodo(updated);
}


// Delete todo
export async function deleteTodoModel(id, userId) {
  const ref = db()
    .collection(COLLECTION)
    .doc(id);

  const doc = await ref.get();

  if (!doc.exists) return null;


  if (doc.data().userId !== userId) {
    const error = new Error("Forbidden");
    error.status = 403;
    throw error;
  }


  await ref.delete();

  return formatTodo(doc);
}