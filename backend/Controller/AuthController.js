const FIREBASE_AUTH_URL = "https://identitytoolkit.googleapis.com/v1/accounts";

function getWebApiKey() {
  return process.env.FIREBASE_WEB_API_KEY || process.env.FIREBASE_API_KEY;
}

function requireWebApiKey() {
  const apiKey = getWebApiKey();
  if (!apiKey) {
    const err = new Error(
      "FIREBASE_WEB_API_KEY is missing in .env (Firebase Console → Project settings → Web API Key)",
    );
    err.status = 500;
    throw err;
  }
  return apiKey;
}
// Make a request to the Firebase Auth API using the endpoint and body
async function firebaseAuthRequest(endpoint, body) {
  const apiKey = requireWebApiKey();
  const res = await fetch(`${FIREBASE_AUTH_URL}:${endpoint}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    const code = data?.error?.message || "";
    const err = new Error(mapFirebaseAuthError(code));
    err.status = statusForFirebaseAuthError(code);
    throw err;
  }
  return data;
}

async function signUpWithPassword(email, password) {
  return firebaseAuthRequest("signUp", {
    email,
    password,
    returnSecureToken: true,
  });
}

// Login a user by email and password using Firebase Auth
async function signInWithPassword(email, password) {
  return firebaseAuthRequest("signInWithPassword", {
    email,
    password,
    returnSecureToken: true,
  });
}

function statusForFirebaseAuthError(code = "") {
  if (code === "EMAIL_EXISTS") return 409;
  if (code === "OPERATION_NOT_ALLOWED") return 503;
  if (code === "INVALID_EMAIL" || code.startsWith("WEAK_PASSWORD")) {
    return 400;
  }
  if (code === "TOO_MANY_ATTEMPTS_TRY_LATER") return 429;
  return 401;
}

function mapFirebaseAuthError(code = "") {
  switch (code) {
    case "EMAIL_EXISTS":
      return "Email is already registered";
    case "INVALID_EMAIL":
      return "Invalid email address";
    case "WEAK_PASSWORD : Password should be at least 6 characters":
    case "WEAK_PASSWORD":
      return "Password must be at least 6 characters";
    case "EMAIL_NOT_FOUND":
    case "INVALID_PASSWORD":
    case "INVALID_LOGIN_CREDENTIALS":
      return "Invalid email or password";
    case "OPERATION_NOT_ALLOWED":
      return "Email/password sign-in is disabled in Firebase Console → Authentication → Sign-in method";
    case "TOO_MANY_ATTEMPTS_TRY_LATER":
      return "Too many attempts. Try again later";
    default:
      return code || "Authentication failed";
  }
}

function sessionResponse(session) {
  return {
    user: {
      uid: session.localId,
      email: session.email,
    },
    idToken: session.idToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
  };
}

// Register a user by email and password
export async function register(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase() || "";
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // signUp creates the user and returns tokens in one call (no orphan accounts)
    const session = await signUpWithPassword(email, password);
    res.status(201).json({
      success: true,
      message: "Registered successfully",
      ...sessionResponse(session),
    });
  } catch (error) {
    next(error);
  }
}

// Login a user by email and password
export async function login(req, res, next) {
  try {
    const email = req.body.email?.trim().toLowerCase() || "";
    const password = req.body.password || "";

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const session = await signInWithPassword(email, password);
    res.status(200).json({
      success: true,
      message: "Logged in successfully",
      ...sessionResponse(session),
    });
  } catch (error) {
    next(error);
  }
}

// Get the current user by email and password using Firebase Auth
export async function me(req, res, next) {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    res.status(200).json({ success: true, user: req.user });
  } catch (error) {
    next(error);
  }
}
