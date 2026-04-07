import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");

const FILES = {
  users: path.join(DATA_DIR, "users.json"),
  sessions: path.join(DATA_DIR, "sessions.json"),
  verifications: path.join(DATA_DIR, "lawyer_verifications.json"),
};

function nowIso() {
  return new Date().toISOString();
}

async function readJson(filePath, fallback = []) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

function randomId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, originalHash] = stored.split(":");
  const nextHash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(originalHash, "hex"), Buffer.from(nextHash, "hex"));
}

function normalizeEmail(email = "") {
  return String(email || "").trim().toLowerCase();
}

function sanitizeUser(user) {
  return {
    id: user.id,
    full_name: user.full_name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    practice_area: user.practice_area || "",
    verification_status: user.verification_status,
    is_verified_lawyer: Boolean(user.is_verified_lawyer),
    enrollment_number: user.enrollment_number || "",
    state_bar_council: user.state_bar_council || "",
    created_at: user.created_at,
    approved_at: user.approved_at || null,
  };
}

function sanitizeVerification(record) {
  return {
    id: record.id,
    user_id: record.user_id,
    full_name: record.full_name,
    email: record.email,
    phone: record.phone,
    enrollment_number: record.enrollment_number,
    state_bar_council: record.state_bar_council,
    practice_area: record.practice_area,
    verification_status: record.verification_status,
    id_card_name: record.id_card_name,
    id_card_data_url: record.id_card_data_url,
    rejection_reason: record.rejection_reason || "",
    submitted_at: record.submitted_at,
    reviewed_at: record.reviewed_at || null,
    reviewed_by: record.reviewed_by || null,
  };
}

export async function ensureAuthStorage() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const users = await readJson(FILES.users, []);
  const sessions = await readJson(FILES.sessions, []);
  const verifications = await readJson(FILES.verifications, []);

  const adminEmail = normalizeEmail(process.env.ADMIN_EMAIL || "admin@lexintel.local");
  const adminPassword = process.env.ADMIN_PASSWORD || "ChangeMe123!";
  const adminIndex = users.findIndex((user) => user.role === "admin");

  if (adminIndex === -1) {
    users.push({
      id: randomId("user"),
      full_name: "Platform Admin",
      email: adminEmail,
      phone: "",
      password_hash: hashPassword(adminPassword),
      role: "admin",
      verification_status: "approved",
      is_verified_lawyer: true,
      created_at: nowIso(),
      approved_at: nowIso(),
    });
  } else {
    const existingAdmin = users[adminIndex];
    users[adminIndex] = {
      ...existingAdmin,
      full_name: existingAdmin.full_name || "Platform Admin",
      email: adminEmail,
      phone: existingAdmin.phone || "",
      password_hash: hashPassword(adminPassword),
      role: "admin",
      verification_status: "approved",
      is_verified_lawyer: true,
      approved_at: existingAdmin.approved_at || nowIso(),
    };
  }

  await writeJson(FILES.users, users);
  await writeJson(FILES.sessions, sessions);
  await writeJson(FILES.verifications, verifications);
}

export async function registerLawyer(payload) {
  const users = await readJson(FILES.users, []);
  const email = normalizeEmail(payload.email);
  const phone = String(payload.phone || "").trim();

  if (!payload.full_name?.trim()) throw new Error("Full name is required");
  if (!email && !phone) throw new Error("Email or phone is required");
  if (!payload.password || String(payload.password).length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  const alreadyExists = users.some(
    (user) => user.email === email || (phone && user.phone && user.phone === phone)
  );
  if (alreadyExists) throw new Error("User already exists with this email or phone");

  const user = {
    id: randomId("user"),
    full_name: String(payload.full_name).trim(),
    email,
    phone,
    password_hash: hashPassword(String(payload.password)),
    role: "lawyer",
    verification_status: "not_submitted",
    is_verified_lawyer: false,
    practice_area: "",
    created_at: nowIso(),
    approved_at: null,
  };

  users.push(user);
  await writeJson(FILES.users, users);
  return sanitizeUser(user);
}

export async function loginUser({ emailOrPhone, password }) {
  const users = await readJson(FILES.users, []);
  const sessions = await readJson(FILES.sessions, []);
  const lookup = normalizeEmail(emailOrPhone);
  const rawLookup = String(emailOrPhone || "").trim();

  const user = users.find(
    (entry) => entry.email === lookup || (rawLookup && entry.phone === rawLookup)
  );
  if (!user || !verifyPassword(String(password || ""), user.password_hash)) {
    throw new Error("Invalid credentials");
  }

  const token = crypto.randomBytes(32).toString("hex");
  sessions.push({
    id: randomId("session"),
    token,
    user_id: user.id,
    created_at: nowIso(),
  });
  await writeJson(FILES.sessions, sessions);

  return { token, user: sanitizeUser(user) };
}

export async function getSessionUser(token) {
  if (!token) return null;
  const [sessions, users] = await Promise.all([
    readJson(FILES.sessions, []),
    readJson(FILES.users, []),
  ]);
  const session = sessions.find((entry) => entry.token === token);
  if (!session) return null;
  const user = users.find((entry) => entry.id === session.user_id);
  if (!user) return null;
  return sanitizeUser(user);
}

export async function destroySession(token) {
  const sessions = await readJson(FILES.sessions, []);
  const next = sessions.filter((entry) => entry.token !== token);
  await writeJson(FILES.sessions, next);
}

export async function submitLawyerVerification(userId, payload) {
  const [users, verifications] = await Promise.all([
    readJson(FILES.users, []),
    readJson(FILES.verifications, []),
  ]);
  const user = users.find((entry) => entry.id === userId);
  if (!user) throw new Error("User not found");
  if (user.role !== "lawyer") throw new Error("Only lawyer accounts can submit verification");

  const required = [
    "full_name",
    "enrollment_number",
    "state_bar_council",
    "practice_area",
    "id_card_name",
    "id_card_data_url",
  ];
  for (const field of required) {
    if (!String(payload[field] || "").trim()) {
      throw new Error(`${field} is required`);
    }
  }

  const existingIndex = verifications.findIndex((entry) => entry.user_id === userId);
  const verification = {
    id: existingIndex >= 0 ? verifications[existingIndex].id : randomId("verification"),
    user_id: userId,
    full_name: String(payload.full_name).trim(),
    email: user.email,
    phone: user.phone,
    enrollment_number: String(payload.enrollment_number).trim(),
    state_bar_council: String(payload.state_bar_council).trim(),
    practice_area: String(payload.practice_area).trim(),
    verification_status: "pending",
    id_card_name: String(payload.id_card_name).trim(),
    id_card_data_url: String(payload.id_card_data_url).trim(),
    rejection_reason: "",
    submitted_at: nowIso(),
    reviewed_at: null,
    reviewed_by: null,
  };

  if (existingIndex >= 0) verifications[existingIndex] = verification;
  else verifications.push(verification);

  user.full_name = verification.full_name;
  user.practice_area = verification.practice_area;
  user.enrollment_number = verification.enrollment_number;
  user.state_bar_council = verification.state_bar_council;
  user.verification_status = "pending";
  user.is_verified_lawyer = false;
  user.approved_at = null;

  await Promise.all([writeJson(FILES.users, users), writeJson(FILES.verifications, verifications)]);
  return sanitizeVerification(verification);
}

export async function getPendingVerifications() {
  const verifications = await readJson(FILES.verifications, []);
  return verifications
    .filter((entry) => entry.verification_status === "pending")
    .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
    .map(sanitizeVerification);
}

export async function reviewVerification(verificationId, adminUserId, action, rejectionReason = "") {
  const [users, verifications] = await Promise.all([
    readJson(FILES.users, []),
    readJson(FILES.verifications, []),
  ]);
  const index = verifications.findIndex((entry) => entry.id === verificationId);
  if (index < 0) throw new Error("Verification request not found");

  const verification = verifications[index];
  const user = users.find((entry) => entry.id === verification.user_id);
  if (!user) throw new Error("User not found");

  if (action === "approve") {
    verification.verification_status = "approved";
    verification.rejection_reason = "";
    user.verification_status = "approved";
    user.is_verified_lawyer = true;
    user.approved_at = nowIso();
  } else if (action === "reject") {
    verification.verification_status = "rejected";
    verification.rejection_reason = String(rejectionReason || "").trim() || "Verification rejected";
    user.verification_status = "rejected";
    user.is_verified_lawyer = false;
    user.approved_at = null;
  } else {
    throw new Error("Invalid review action");
  }

  verification.reviewed_at = nowIso();
  verification.reviewed_by = adminUserId;
  verifications[index] = verification;

  await Promise.all([writeJson(FILES.users, users), writeJson(FILES.verifications, verifications)]);
  return {
    user: sanitizeUser(user),
    verification: sanitizeVerification(verification),
  };
}
