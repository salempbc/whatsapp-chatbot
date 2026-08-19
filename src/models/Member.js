import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true, // ✅ keep ONLY this (no separate index)
      trim: true
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true
    },

    role: {
      type: String // treasurer, secretary
    },

    isChild: {
      type: Boolean,
      default: false
    },

    isPastor: {
      type: Boolean,
      default: false
    },

    isDeleted: {
      type: Boolean,
      default: false
    },

    dob: {
      type: String // YYYY-MM-DD
    },

    birthday: {
      type: String, // MM-DD
      index: true
    },

    /**
     * 💍 Marriage Fields
     */
    isMarried: {
      type: Boolean,
      default: false
    },

    spouseName: {
      type: String,
      trim: true
    },

    spouseGender: {
      type: String,
      enum: ["male", "female"]
    },

    weddingDate: {
      type: String // YYYY-MM-DD
    },

    wedding: {
      type: String, // MM-DD
      index: true
    }
  },
  {
    timestamps: true
  }
);

/**
 * 🔒 VALIDATION LOGIC
 */
memberSchema.pre("save", function (next) {
  if (this.isMarried) {
    // spouse required
    if (!this.spouseName) {
      return next(new Error("Spouse name required for married members"));
    }

    // gender pairing check
    if (this.gender === this.spouseGender) {
      return next(
        new Error("Invalid marriage: same gender pairing not allowed")
      );
    }
  }

  next();
});


const Member = mongoose.model("Member", memberSchema);

export default Member;