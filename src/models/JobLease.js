import mongoose from "mongoose";

const JobLeaseSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  holder: { type: String, required: true },
  expiresAt: { type: Date, required: true }
});

export default mongoose.models.JobLease || mongoose.model("JobLease", JobLeaseSchema);
