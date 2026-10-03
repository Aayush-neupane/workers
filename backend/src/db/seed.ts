import bcrypt from "bcryptjs";
import { pool } from "./pool.js";

const ROLES = ["ADMIN", "WORKER", "CUSTOMER"] as const;
const PERMISSIONS = [
  "workers.verify",
  "workers.manage",
  "bookings.assign",
  "bookings.manage",
  "finance.settle",
  "finance.refund",
  "services.manage",
  "rewards.manage",
  "support.manage",
] as const;

await pool.query(
  `INSERT INTO roles(name) VALUES ${ROLES.map((_, i) => `($${i + 1})`).join(",")} ON CONFLICT (name) DO NOTHING`,
  [...ROLES],
);
await pool.query(
  `INSERT INTO permissions(name) VALUES ${PERMISSIONS.map((_, i) => `($${i + 1})`).join(",")} ON CONFLICT (name) DO NOTHING`,
  [...PERMISSIONS],
);
// Admin role holds every permission.
await pool.query(
  `INSERT INTO role_permissions(role_id, permission_id)
   SELECT r.id, p.id FROM roles r CROSS JOIN permissions p WHERE r.name = 'ADMIN'
   ON CONFLICT DO NOTHING`,
);

const email = "admin@workers.local";
const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
if (existing.rowCount === 0) {
  const hash = await bcrypt.hash("ChangeMe123!", 10);
  const u = await pool.query(
    `INSERT INTO users(email, password_hash, name, phone) VALUES ($1, $2, $3, $4) RETURNING id`,
    [email, hash, "Platform Admin", "9852600000"],
  );
  const role = await pool.query(`SELECT id FROM roles WHERE name = 'ADMIN'`);
  await pool.query(`INSERT INTO user_roles(user_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [
    u.rows[0].id,
    role.rows[0].id,
  ]);
  console.log("[db] seeded admin", email);
} else {
  console.log("[db] admin exists, skip");
}

// Damak coverage: wards 1-10 open.
for (let w = 1; w <= 10; w++) {
  await pool.query(`INSERT INTO coverage_wards(ward, is_open) VALUES ($1, true) ON CONFLICT (ward) DO NOTHING`, [w]);
}

// Platform settings (JSONB single row).
await pool.query(
  `INSERT INTO settings(id, value) VALUES ('platform', $1)
   ON CONFLICT (id) DO UPDATE SET value = EXCLUDED.value`,
  [
    JSON.stringify({
      zone: "Damak",
      globalCommissionBps: 1500,
      rewardPerNpr100: 1,
      milestoneBookings: 5,
      milestoneBonus: 100,
      redeemPoints: 100,
      redeemDiscountPaisa: 5000,
    }),
  ],
);

console.log("[db] seed ok");
await pool.end();
