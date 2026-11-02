import { z } from "zod";

export { z };

/**
 * Express middleware that validates req.body against a zod schema, replacing it
 * with the parsed (stripped, trimmed) value. Responds 400 with the first issue.
 */
export const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body ?? {});
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path?.join(".") || "body";
    return res.status(400).json({ error: `Invalid ${field}: ${issue?.message || "invalid value"}` });
  }
  req.body = result.data;
  next();
};

export const loginSchema = z.object({
  secret: z.string().trim().min(1).max(256).optional()
});
