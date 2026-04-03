import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true
    },

    role: { type: String },

    isChild: { type: Boolean, default: false },
    isPastor: { type: Boolean, default: false },

    dob: { type: String }, // YYYY-MM-DD
    birthday: { type: String }, // MM-DD

    isMarried: { type: Boolean, default: false },
    spouseName: { type: String, trim: true },
    spouseGender: { type: String, enum: ["male", "female"] },

    weddingDate: { type: String }, // YYYY-MM-DD
    wedding: { type: String } // MM-DD
  },
  { timestamps: true }
);

/**
 * 🔒 VALIDATION
 */
memberSchema.pre("save", function (next) {
  if (this.isMarried) {
    if (!this.spouseName) {
      return next(new Error("Spouse name required"));
    }

    if (this.gender === this.spouseGender) {
      return next(new Error("Invalid gender pairing"));
    }
  }
  next();
});

/**
 * 🚫 UNIQUE NAME
 */
memberSchema.index({ name: 1 }, { unique: true });

/**
 * ✅ IMPORTANT: DEFAULT EXPORT
 */
const Member = mongoose.model("Member", memberSchema);

export default Member;