export const isAdmin = (id) => {
  if (!process.env.ADMIN_ID) return true;
  return String(id) === String(process.env.ADMIN_ID);
};

export const adminOnly = (fn) => (msg, ...rest) => {
  if (!isAdmin(msg.from.id)) return;
  return fn(msg, ...rest);
};
