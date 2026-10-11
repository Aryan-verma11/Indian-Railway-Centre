export function auditContext(req) {
  return { actor: { id: req.auth?.userId, roll_number: req.auth?.rollNumber }, ip: req.ip };
}

export async function logAudit(executor, { actor = {}, ip }, action, target = {}, details = null) {
  await executor.execute(
    `INSERT INTO audit_logs (actor_user_id, actor_roll_number, action, target_user_id, target_roll_number, details, ip_address)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [actor.id ?? null, actor.roll_number ?? null, action, target.id ?? null,
      target.roll_number ?? null, details ? details.slice(0, 255) : null, (ip || '').slice(0, 45) || null],
  );
}
