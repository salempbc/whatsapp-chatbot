import express from "express";
import mongoose from "mongoose";

/**
 * Router factory: forwards async handler rejections to Express error handling
 * and validates every :id param as a MongoDB ObjectId.
 */
export const createRouter = () => {
  const router = express.Router();

  for (const verb of ["get", "post", "put", "patch", "delete"]) {
    const register = router[verb].bind(router);
    router[verb] = (path, ...handlers) =>
      register(
        path,
        ...handlers.map((h) =>
          typeof h === "function" && h.length < 4
            ? (req, res, next) => Promise.resolve(h(req, res, next)).catch(next)
            : h
        )
      );
  }

  router.param("id", (req, res, next, id) => {
    if (!id || typeof id !== "string" || !mongoose.Types.ObjectId.isValid(id.trim())) {
      return res.status(400).json({ error: "Invalid resource identifier format" });
    }
    next();
  });

  return router;
};
