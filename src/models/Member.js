import mongoose from "mongoose";

const normalize = (v) => (v ? v.trim().toLowerCase() : v);

const memberSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      set: normalize
    },

    gender: {
      type: String,
      enum: ["male", "female"],
      required: true
    },

    isChild: {
      type: Boolean,
      default: false
    },

    // 🎂 Birthday
    dob: String,
    birthday: String,

    // 💍 Wedding
    isMarried: {
      type: Boolean,
      default: false
    },

    spouseName: {
      type: String,
      trim: true,
      set: normalize
    },

    spouseGender: {
      type: String,
      enum: ["male", "female"]
    },

    weddingDate: String, // YYYY-MM-DD
    wedding: String,

    // ⛪ Roles
    isPastor: {
      type: Boolean,
      default: false
    },

    role: {
      type: String,
      enum: ["treasurer", "secretary", null],
      default: null
    }
  },
  { timestamps: true }
);

/**
 * 🔥 VALIDATION: spouse must be opposite gender
 */
memberSchema.pre("save", function (next) {
  if (this.isMarried && this.spouseGender) {
    if (this.gender === this.spouseGender) {
      return next(
        new Error("❌ Spouse gender must be opposite")
      );
    }
  }
  next();
});

/**
 * UNIQUE INDEXES
 */
memberSchema.index(
  { name: 1, birthday: 1 },
  { unique: true, partialFilterExpression: { birthday: { $exists: true } } }
);

memberSchema.index(
  { name: 1, spouseName: 1, wedding: 1 },
  {
    unique: true,
    partialFilterExpression: { isMarried: true }
  }
);

export default mongoose.model("Member", memberSchema);